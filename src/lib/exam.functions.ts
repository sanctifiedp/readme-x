import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const QUESTIONS_PER_EXAM = 30;

export const startAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: questions, error } = await supabaseAdmin
      .from("questions").select("id").eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    if (!questions || questions.length === 0) {
      throw new Error("No questions are available for this course yet.");
    }
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(QUESTIONS_PER_EXAM, shuffled.length)).map((q) => q.id);
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("exam_attempts")
      .insert({
        user_id: userId, course_id: data.courseId,
        question_ids: picked, total: picked.length,
        current_index: 0,
        last_activity_at: new Date().toISOString(),
      })
      .select("id").single();
    if (attemptError) throw new Error(attemptError.message);
    return { attemptId: attempt.id };
  });

export const getAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: attempt, error } = await supabaseAdmin
      .from("exam_attempts")
      .select("*, courses(code, title)")
      .eq("id", data.attemptId)
      .eq("user_id", userId)
      .single();
    if (error || !attempt) throw new Error("Attempt not found");

    const ids = attempt.question_ids as string[];
    const [{ data: questions }, { data: savedAnswers }] = await Promise.all([
      supabaseAdmin.from("questions").select("id, prompt, options").in("id", ids),
      supabaseAdmin
        .from("attempt_answers")
        .select("question_id, chosen_index")
        .eq("attempt_id", data.attemptId),
    ]);

    const ordered = ids
      .map((id) => questions?.find((q) => q.id === id))
      .filter(Boolean) as Array<{ id: string; prompt: string; options: unknown }>;

    const answers: Record<string, number> = {};
    for (const a of savedAnswers ?? []) {
      if (a.chosen_index !== null && a.chosen_index !== undefined) {
        answers[a.question_id] = a.chosen_index;
      }
    }

    return {
      attempt: {
        id: attempt.id,
        courseCode: attempt.courses?.code ?? "",
        courseTitle: attempt.courses?.title ?? "Practice",
        submittedAt: attempt.submitted_at,
        score: attempt.score,
        total: attempt.total,
        expiresAt: attempt.expires_at as string | null,
        durationSeconds: attempt.duration_seconds as number,
        startedAt: attempt.started_at as string,
        currentIndex: (attempt.current_index as number) ?? 0,
      },
      questions: ordered.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options as string[],
      })),
      answers,
    };
  });

export const saveAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attemptId: z.string().uuid(),
        questionId: z.string().uuid(),
        chosenIndex: z.number().int().min(-1).max(9),
        currentIndex: z.number().int().min(0).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: attempt, error } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, user_id, submitted_at, question_ids")
      .eq("id", data.attemptId)
      .single();
    if (error || !attempt) throw new Error("Attempt not found");
    if (attempt.user_id !== userId) throw new Error("Forbidden");
    if (attempt.submitted_at) throw new Error("Already submitted");
    const ids = (attempt.question_ids as string[]) ?? [];
    if (!ids.includes(data.questionId)) throw new Error("Question not in this attempt");

    // Determine correctness server-side
    let isCorrect = false;
    if (data.chosenIndex >= 0) {
      const { data: q } = await supabaseAdmin
        .from("questions").select("correct_index").eq("id", data.questionId).single();
      isCorrect = q ? data.chosenIndex === q.correct_index : false;
    }

    // Upsert without unique constraint: delete then insert
    await supabaseAdmin
      .from("attempt_answers")
      .delete()
      .eq("attempt_id", data.attemptId)
      .eq("question_id", data.questionId);
    await supabaseAdmin.from("attempt_answers").insert({
      attempt_id: data.attemptId,
      question_id: data.questionId,
      chosen_index: data.chosenIndex < 0 ? null : data.chosenIndex,
      is_correct: isCorrect,
    });

    const update: { last_activity_at: string; current_index?: number } = {
      last_activity_at: new Date().toISOString(),
    };
    if (typeof data.currentIndex === "number") update.current_index = data.currentIndex;
    await supabaseAdmin.from("exam_attempts").update(update).eq("id", data.attemptId);

    return { ok: true };
  });

async function evaluateBadges(userId: string, ctx: { perfect: boolean; examsCompleted: number; streak: number }) {
  const codes: string[] = [];
  if (ctx.examsCompleted >= 1) codes.push("first_mock");
  if (ctx.perfect) codes.push("perfect_score");
  if (ctx.streak >= 7) codes.push("streak_7");
  if (ctx.examsCompleted >= 50) codes.push("fifty_exams");
  if (codes.length === 0) return [] as string[];

  const { data: badges } = await supabaseAdmin.from("badges").select("id, code").in("code", codes);
  if (!badges || badges.length === 0) return [];

  const { data: existing } = await supabaseAdmin
    .from("user_badges").select("badge_id").eq("user_id", userId);
  const already = new Set((existing ?? []).map((r) => r.badge_id));
  const toInsert = badges.filter((b) => !already.has(b.id)).map((b) => ({ user_id: userId, badge_id: b.id }));
  if (toInsert.length > 0) {
    await supabaseAdmin.from("user_badges").insert(toInsert);
  }
  return toInsert.map((r) => badges.find((b) => b.id === r.badge_id)?.code ?? "");
}

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z
          .array(z.object({ questionId: z.string().uuid(), chosenIndex: z.number().int().min(-1).max(9) }))
          .optional()
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: attempt, error: aerr } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, user_id, submitted_at, question_ids, total, course_id")
      .eq("id", data.attemptId)
      .single();
    if (aerr || !attempt) throw new Error("Attempt not found");
    if (attempt.user_id !== userId) throw new Error("Forbidden");
    if (attempt.submitted_at) return { score: attempt.total, total: attempt.total, awardedXp: 0, badges: [] };

    const questionIds = (attempt.question_ids as string[]) ?? [];

    // Apply any last-minute client answers via upsert-style write
    if (data.answers && data.answers.length > 0) {
      const { data: qRows } = await supabaseAdmin
        .from("questions").select("id, correct_index").in("id", questionIds);
      const correctMap = new Map<string, number>();
      qRows?.forEach((q) => correctMap.set(q.id, q.correct_index));
      for (const a of data.answers) {
        if (!questionIds.includes(a.questionId)) continue;
        await supabaseAdmin
          .from("attempt_answers")
          .delete()
          .eq("attempt_id", data.attemptId)
          .eq("question_id", a.questionId);
        const correct = correctMap.get(a.questionId);
        const ok = correct !== undefined && a.chosenIndex === correct;
        await supabaseAdmin.from("attempt_answers").insert({
          attempt_id: data.attemptId,
          question_id: a.questionId,
          chosen_index: a.chosenIndex < 0 ? null : a.chosenIndex,
          is_correct: ok,
        });
      }
    }

    // Ensure a row exists for every question (missing → unanswered)
    const { data: existingRows } = await supabaseAdmin
      .from("attempt_answers").select("question_id, is_correct").eq("attempt_id", data.attemptId);
    const answered = new Set((existingRows ?? []).map((r) => r.question_id));
    const missing = questionIds.filter((id) => !answered.has(id));
    if (missing.length > 0) {
      await supabaseAdmin
        .from("attempt_answers")
        .insert(missing.map((qid) => ({
          attempt_id: data.attemptId, question_id: qid, chosen_index: null, is_correct: false,
        })));
    }

    // Final score
    const { data: finalRows } = await supabaseAdmin
      .from("attempt_answers").select("is_correct").eq("attempt_id", data.attemptId);
    const score = (finalRows ?? []).filter((r) => r.is_correct).length;
    const total = attempt.total ?? questionIds.length;

    await supabaseAdmin
      .from("exam_attempts")
      .update({ submitted_at: new Date().toISOString(), score })
      .eq("id", data.attemptId);

    // Streak
    await supabaseAdmin.rpc("bump_streak", { _user_id: userId });

    // XP awards
    let awardedXp = 0;
    const courseId: string | undefined = attempt.course_id ?? undefined;
    if (score > 0) {
      const amt = score * 2;
      await supabaseAdmin.rpc("award_xp", { _user_id: userId, _kind: "correct_answer", _amount: amt, _course_id: courseId });
      awardedXp += amt;
    }
    await supabaseAdmin.rpc("award_xp", { _user_id: userId, _kind: "exam_complete", _amount: 5, _course_id: courseId });
    awardedXp += 5;
    const pct = total > 0 ? score / total : 0;
    if (pct >= 0.8 && pct < 1) {
      await supabaseAdmin.rpc("award_xp", { _user_id: userId, _kind: "high_score", _amount: 5, _course_id: courseId });
      awardedXp += 5;
    }
    if (pct === 1 && total > 0) {
      await supabaseAdmin.rpc("award_xp", { _user_id: userId, _kind: "perfect_score", _amount: 10, _course_id: courseId });
      awardedXp += 10;
    }

    // Fetch fresh streak + total exam count for badge/weekly evaluation
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("streak_count").eq("id", userId).single();
    const streak = prof?.streak_count ?? 0;

    // Weekly streak bonus (every 7 days)
    if (streak > 0 && streak % 7 === 0) {
      await supabaseAdmin.rpc("award_xp", { _user_id: userId, _kind: "weekly_streak", _amount: 10 });
      awardedXp += 10;
    }


    const { count: examsCompletedCount } = await supabaseAdmin
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("submitted_at", "is", null);

    const newBadges = await evaluateBadges(userId, {
      perfect: pct === 1 && total > 0,
      examsCompleted: examsCompletedCount ?? 0,
      streak,
    });

    return { score, total, awardedXp, badges: newBadges };
  });

export const getResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: attempt, error } = await supabaseAdmin
      .from("exam_attempts")
      .select("*, courses(code, title)")
      .eq("id", data.attemptId)
      .eq("user_id", userId)
      .single();
    if (error || !attempt) throw new Error("Attempt not found");

    const ids = attempt.question_ids as string[];
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, hint")
      .in("id", ids);
    const { data: answers } = await supabaseAdmin
      .from("attempt_answers")
      .select("question_id, chosen_index, is_correct")
      .eq("attempt_id", data.attemptId);

    return {
      attempt: {
        id: attempt.id,
        courseCode: attempt.courses?.code ?? "",
        courseTitle: attempt.courses?.title ?? "Practice",
        score: attempt.score,
        total: attempt.total,
        submittedAt: attempt.submitted_at as string | null,
        startedAt: attempt.started_at as string,
      },
      questions: ids.map((id) => {
        const q = questions?.find((x) => x.id === id);
        const a = answers?.find((x) => x.question_id === id);
        return {
          id,
          prompt: q?.prompt ?? "",
          options: (q?.options as string[]) ?? [],
          correctIndex: q?.correct_index ?? -1,
          chosenIndex: a?.chosen_index ?? null,
          isCorrect: a?.is_correct ?? false,
          hint: q?.hint ?? null,
        };
      }),
    };
  });

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select("id, code, title, description")
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [{ data: courses }, { data: attempts }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("courses").select("id, code, title, description").order("code"),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, course_id, score, total, submitted_at, courses(code, title)")
        .eq("user_id", userId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(10),
      supabaseAdmin.from("profiles").select("full_name, matric_no, email").eq("id", userId).single(),
    ]);

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "super_admin") ?? false;

    return {
      courses: courses ?? [],
      attempts:
        attempts?.map((a) => ({
          id: a.id,
          score: a.score,
          total: a.total,
          submittedAt: a.submitted_at,
          courseCode: a.courses?.code ?? "",
          courseTitle: a.courses?.title ?? "",
        })) ?? [],
      profile: profile ?? null,
      isAdmin,
    };
  });

export const getCourseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .select("id, code, title, description")
      .eq("code", data.code)
      .single();
    if (error || !course) throw new Error("Course not found");

    const [{ count: questionCount }, { data: attempts }] = await Promise.all([
      supabaseAdmin.from("questions").select("id", { count: "exact", head: true }).eq("course_id", course.id),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, score, total, submitted_at")
        .eq("user_id", userId)
        .eq("course_id", course.id)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

    return {
      course,
      questionCount: questionCount ?? 0,
      attempts: attempts ?? [],
    };
  });
