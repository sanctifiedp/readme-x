/**
 * Builds the learner context the AI Tutor will be grounded on.
 * Read-only: it never mutates XP, badges, dashboards or exam state.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AiMessage, TutorContext, TutorSurface } from "./types";

export async function buildTutorContext(
  userId: string,
  opts: { courseId?: string | null; questionId?: string | null } = {},
): Promise<TutorContext> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("school, faculty, department, level, xp, streak_count")
    .eq("id", userId)
    .maybeSingle();

  const { data: attempts } = await supabaseAdmin
    .from("exam_attempts")
    .select("score, total, created_at, courses(code, title)")
    .eq("user_id", userId)
    .not("submitted_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  type AttemptRow = {
    score: number | null;
    total: number | null;
    created_at: string;
    courses: { code: string | null; title: string | null } | null;
  };
  const rows = (attempts ?? []) as unknown as AttemptRow[];

  const examHistory = rows.map((r) => ({
    courseCode: r.courses?.code ?? null,
    score: r.score ?? 0,
    total: r.total ?? 0,
    takenAt: r.created_at,
  }));

  // Weakest courses by average percentage across the recent history.
  const byCourse = new Map<string, { sum: number; n: number }>();
  for (const r of examHistory) {
    if (!r.courseCode || r.total <= 0) continue;
    const bucket = byCourse.get(r.courseCode) ?? { sum: 0, n: 0 };
    bucket.sum += (r.score / r.total) * 100;
    bucket.n += 1;
    byCourse.set(r.courseCode, bucket);
  }
  const weakSubjects = [...byCourse.entries()]
    .map(([code, b]) => ({ code, avg: b.sum / b.n }))
    .filter((c) => c.avg < 60)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((c) => c.code);

  let courseCode: string | null = null;
  let courseTitle: string | null = null;
  if (opts.courseId) {
    const { data: course } = await supabaseAdmin
      .from("courses").select("code, title").eq("id", opts.courseId).maybeSingle();
    courseCode = course?.code ?? null;
    courseTitle = course?.title ?? null;
  }

  let questionPrompt: string | null = null;
  if (opts.questionId) {
    const { data: q } = await supabaseAdmin
      .from("questions").select("prompt").eq("id", opts.questionId).maybeSingle();
    questionPrompt = q?.prompt ?? null;
  }

  return {
    userId,
    school: profile?.school ?? null,
    faculty: profile?.faculty ?? null,
    department: profile?.department ?? null,
    level: profile?.level ?? null,
    courseCode,
    courseTitle,
    questionId: opts.questionId ?? null,
    questionPrompt,
    examHistory,
    weakSubjects,
    xp: profile?.xp ?? 0,
    streakCount: profile?.streak_count ?? 0,
  };
}

/** Turns the context into the system prompt a provider will receive. */
export function buildSystemPrompt(surface: TutorSurface, ctx: TutorContext | null): string {
  const lines = [
    "You are ReadMe AI Tutor, a patient Nigerian university study coach.",
    "Explain clearly, use short paragraphs, and never reveal exam answers outright when a student is mid-attempt.",
    `Surface: ${surface}.`,
  ];
  if (ctx) {
    lines.push(
      "Learner profile:",
      `- School: ${ctx.school ?? "unknown"}`,
      `- Faculty: ${ctx.faculty ?? "unknown"}`,
      `- Department: ${ctx.department ?? "unknown"}`,
      `- Level: ${ctx.level ?? "unknown"}`,
      `- XP: ${ctx.xp}, streak: ${ctx.streakCount} day(s)`,
    );
    if (ctx.courseCode) lines.push(`- Current course: ${ctx.courseCode} ${ctx.courseTitle ?? ""}`.trim());
    if (ctx.questionPrompt) lines.push(`- Current question: ${ctx.questionPrompt}`);
    if (ctx.weakSubjects.length) lines.push(`- Weak subjects: ${ctx.weakSubjects.join(", ")}`);
    if (ctx.examHistory.length) {
      lines.push(
        `- Recent scores: ${ctx.examHistory
          .slice(0, 5)
          .map((h) => `${h.courseCode ?? "course"} ${h.score}/${h.total}`)
          .join("; ")}`,
      );
    }
  }
  return lines.join("\n");
}

/** Keeps request payloads bounded before they reach a provider. */
export function trimHistory(messages: AiMessage[], max = 20): AiMessage[] {
  return messages.slice(-max);
}
