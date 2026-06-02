import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertFriends(a: string, b: string) {
  const { data } = await supabaseAdmin
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  if (!data) throw new Error("You can only challenge friends");
}

export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    opponentId: z.string().uuid(),
    courseId: z.string().uuid(),
    questionCount: z.number().int().min(5).max(30).default(10),
    durationSeconds: z.number().int().min(60).max(3600).default(600),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.opponentId === userId) throw new Error("Cannot challenge yourself");
    await assertFriends(userId, data.opponentId);

    const { data: questions, error } = await supabaseAdmin
      .from("questions").select("id").eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    if (!questions || questions.length < data.questionCount) {
      throw new Error(`This course needs at least ${data.questionCount} questions.`);
    }
    const ids = [...questions].sort(() => Math.random() - 0.5).slice(0, data.questionCount).map((q) => q.id);

    const { data: row, error: ierr } = await supabaseAdmin
      .from("challenges")
      .insert({
        challenger_id: userId,
        opponent_id: data.opponentId,
        course_id: data.courseId,
        question_count: data.questionCount,
        duration_seconds: data.durationSeconds,
        question_ids: ids,
      })
      .select("id").single();
    if (ierr) throw new Error(ierr.message);
    return { challengeId: row.id };
  });

async function fetchChallengeContext(challengeId: string, userId: string) {
  const { data: ch, error } = await supabaseAdmin
    .from("challenges")
    .select("*, courses(code, title)")
    .eq("id", challengeId).single();
  if (error || !ch) throw new Error("Challenge not found");
  if (ch.challenger_id !== userId && ch.opponent_id !== userId) throw new Error("Forbidden");
  return ch;
}

export const listMyChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: rows, error } = await supabaseAdmin
      .from("challenges")
      .select("id, challenger_id, opponent_id, course_id, status, question_count, duration_seconds, created_at, completed_at, winner_user_id, courses(code, title)")
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const others = new Set<string>();
    rows?.forEach((r: any) => { others.add(r.challenger_id); others.add(r.opponent_id); });
    others.delete(userId);
    const { data: profs } = others.size
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", Array.from(others))
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: atts } = ids.length
      ? await supabaseAdmin.from("challenge_attempts").select("challenge_id, user_id, score, submitted_at").in("challenge_id", ids)
      : { data: [] as any[] };
    return {
      challenges: (rows ?? []).map((r: any) => {
        const otherId = r.challenger_id === userId ? r.opponent_id : r.challenger_id;
        const myAttempt = atts?.find((a: any) => a.challenge_id === r.id && a.user_id === userId) ?? null;
        const oppAttempt = atts?.find((a: any) => a.challenge_id === r.id && a.user_id === otherId) ?? null;
        return {
          id: r.id,
          status: r.status,
          isChallenger: r.challenger_id === userId,
          other: pmap.get(otherId) ?? { id: otherId, full_name: "Unknown", email: "" },
          course: { code: r.courses?.code ?? "", title: r.courses?.title ?? "" },
          questionCount: r.question_count,
          durationSeconds: r.duration_seconds,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          winnerUserId: r.winner_user_id,
          myScore: myAttempt?.score ?? null,
          opponentScore: oppAttempt?.score ?? null,
          mySubmitted: !!myAttempt?.submitted_at,
          opponentSubmitted: !!oppAttempt?.submitted_at,
        };
      }),
    };
  });

export const respondToChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    challengeId: z.string().uuid(),
    action: z.enum(["accept", "decline"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ch = await fetchChallengeContext(data.challengeId, userId);
    if (ch.opponent_id !== userId) throw new Error("Only opponent can respond");
    if (ch.status !== "pending") throw new Error("Already handled");
    const update = data.action === "accept"
      ? { status: "accepted", accepted_at: new Date().toISOString() }
      : { status: "declined" };
    const { error } = await supabaseAdmin.from("challenges").update(update).eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChallengePlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ch = await fetchChallengeContext(data.challengeId, userId);
    if (ch.status === "declined") throw new Error("Challenge was declined");
    if (ch.status === "pending" && ch.opponent_id !== userId) throw new Error("Waiting for opponent");
    if (ch.status === "pending") throw new Error("Accept the challenge first");

    // Get or create my attempt
    let { data: attempt } = await supabaseAdmin
      .from("challenge_attempts").select("*").eq("challenge_id", data.challengeId).eq("user_id", userId).maybeSingle();
    if (!attempt) {
      const expires = new Date(Date.now() + ch.duration_seconds * 1000).toISOString();
      const { data: created, error: cerr } = await supabaseAdmin
        .from("challenge_attempts")
        .insert({ challenge_id: data.challengeId, user_id: userId, expires_at: expires })
        .select("*").single();
      if (cerr) throw new Error(cerr.message);
      attempt = created;
    }

    const qids = ch.question_ids as string[];
    const { data: qs } = await supabaseAdmin
      .from("questions").select("id, prompt, options").in("id", qids);
    const ordered = qids.map((id) => qs?.find((q) => q.id === id)).filter(Boolean) as any[];
    return {
      challenge: {
        id: ch.id,
        courseCode: ch.courses?.code ?? "",
        courseTitle: ch.courses?.title ?? "",
        durationSeconds: ch.duration_seconds,
      },
      attempt: {
        id: attempt.id,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
        submittedAt: attempt.submitted_at,
        score: attempt.score,
      },
      questions: ordered.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options as string[] })),
    };
  });

export const submitChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    challengeId: z.string().uuid(),
    answers: z.array(z.object({ questionId: z.string().uuid(), chosenIndex: z.number().int().min(-1).max(3) })),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ch = await fetchChallengeContext(data.challengeId, userId);
    const { data: attempt } = await supabaseAdmin
      .from("challenge_attempts").select("*").eq("challenge_id", data.challengeId).eq("user_id", userId).maybeSingle();
    if (!attempt) throw new Error("Start the challenge first");
    if (attempt.submitted_at) return { score: attempt.score ?? 0, total: ch.question_count };

    const ids = data.answers.map((a) => a.questionId);
    const { data: qs } = await supabaseAdmin
      .from("questions").select("id, correct_index").in("id", ids);
    const correct = new Map<string, number>();
    qs?.forEach((q) => correct.set(q.id, q.correct_index));
    let score = 0;
    let wrong = 0;
    for (const a of data.answers) {
      const c = correct.get(a.questionId);
      if (c !== undefined && a.chosenIndex === c) score++;
      else if (a.chosenIndex >= 0) wrong++;
    }
    await supabaseAdmin.from("challenge_attempts").update({
      score, wrong, answers: data.answers, submitted_at: new Date().toISOString(),
    }).eq("id", attempt.id);

    // If both submitted, decide winner & complete challenge
    const { data: bothAtt } = await supabaseAdmin
      .from("challenge_attempts").select("user_id, score, submitted_at").eq("challenge_id", data.challengeId);
    if (bothAtt && bothAtt.length === 2 && bothAtt.every((a: any) => a.submitted_at)) {
      const [a1, a2] = bothAtt;
      let winner: string | null = null;
      if ((a1.score ?? 0) > (a2.score ?? 0)) winner = a1.user_id;
      else if ((a2.score ?? 0) > (a1.score ?? 0)) winner = a2.user_id;
      await supabaseAdmin.from("challenges").update({
        status: "completed", completed_at: new Date().toISOString(), winner_user_id: winner,
      }).eq("id", data.challengeId);
    }
    return { score, total: ch.question_count };
  });
