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
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options")
      .in("id", ids);

    const ordered = ids
      .map((id) => questions?.find((q) => q.id === id))
      .filter(Boolean) as Array<{ id: string; prompt: string; options: unknown }>;

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
      },
      questions: ordered.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options as string[],
      })),
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z.array(z.object({ questionId: z.string().uuid(), chosenIndex: z.number().int().min(-1).max(3) })),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: attempt, error: aerr } = await supabaseAdmin
      .from("exam_attempts")
      .select("id, user_id, submitted_at, question_ids, total")
      .eq("id", data.attemptId)
      .single();
    if (aerr || !attempt) throw new Error("Attempt not found");
    if (attempt.user_id !== userId) throw new Error("Forbidden");
    if (attempt.submitted_at) return { score: attempt.total, total: attempt.total };

    const ids = data.answers.map((a) => a.questionId);
    const { data: qs } = await supabaseAdmin
      .from("questions")
      .select("id, correct_index")
      .in("id", ids);
    const correctMap = new Map<string, number>();
    qs?.forEach((q) => correctMap.set(q.id, q.correct_index));

    let score = 0;
    const rows = data.answers.map((a) => {
      const correct = correctMap.get(a.questionId);
      const ok = correct !== undefined && a.chosenIndex === correct;
      if (ok) score++;
      return {
        attempt_id: data.attemptId,
        question_id: a.questionId,
        chosen_index: a.chosenIndex < 0 ? null : a.chosenIndex,
        is_correct: ok,
      };
    });

    if (rows.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("attempt_answers").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const { error: upErr } = await supabaseAdmin
      .from("exam_attempts")
      .update({ submitted_at: new Date().toISOString(), score })
      .eq("id", data.attemptId);
    if (upErr) throw new Error(upErr.message);

    return { score, total: attempt.total };
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
