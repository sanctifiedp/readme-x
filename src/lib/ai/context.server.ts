/**
 * Builds the learner context the AI Tutor is grounded on.
 * Read-only: it never mutates XP, badges, dashboards or exam state.
 *
 * Only the fields relevant to the request surface are collected, and no
 * directly identifying data (name, email, matric number, username, user id)
 * is ever placed in the prompt sent to the provider.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AiMessage, TutorContext, TutorQuestionContext, TutorSurface } from "./types";

export async function buildTutorContext(
  userId: string,
  opts: { courseId?: string | null; questionId?: string | null; attemptId?: string | null } = {},
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
  let question: TutorQuestionContext | null = null;

  if (opts.questionId) {
    question = await resolveQuestion(userId, opts.questionId, opts.attemptId ?? null);
  }

  // Fall back to the course attached to the attempt when none was passed.
  let courseId = opts.courseId ?? null;
  if (!courseId && opts.attemptId) {
    const { data: att } = await supabaseAdmin
      .from("exam_attempts")
      .select("course_id")
      .eq("id", opts.attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    courseId = att?.course_id ?? null;
  }

  if (courseId) {
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("code, title")
      .eq("id", courseId)
      .maybeSingle();
    courseCode = course?.code ?? null;
    courseTitle = course?.title ?? null;
  }

  return {
    userId,
    school: profile?.school ?? null,
    faculty: profile?.faculty ?? null,
    department: profile?.department ?? null,
    level: profile?.level ?? null,
    courseCode,
    courseTitle,
    question,
    examHistory,
    weakSubjects,
    xp: profile?.xp ?? 0,
    streakCount: profile?.streak_count ?? 0,
  };
}

/**
 * Resolves a question plus (when the learner owns the attempt) their answer.
 * The learner's chosen answer is only ever read from their own attempt.
 */
async function resolveQuestion(
  userId: string,
  questionId: string,
  attemptId: string | null,
): Promise<TutorQuestionContext | null> {
  const { data: q } = await supabaseAdmin
    .from("questions")
    .select("id, prompt, options, correct_index, explanation, hint")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) return null;

  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  const correctIndex = typeof q.correct_index === "number" ? q.correct_index : null;

  let chosenIndex: number | null = null;
  let isCorrect: boolean | null = null;

  if (attemptId) {
    const { data: attempt } = await supabaseAdmin
      .from("exam_attempts")
      .select("id")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .not("submitted_at", "is", null)
      .maybeSingle();
    if (attempt) {
      const { data: answer } = await supabaseAdmin
        .from("attempt_answers")
        .select("chosen_index, is_correct")
        .eq("attempt_id", attemptId)
        .eq("question_id", questionId)
        .maybeSingle();
      chosenIndex = answer?.chosen_index ?? null;
      isCorrect = answer?.is_correct ?? null;
    }
  }

  return {
    id: q.id,
    prompt: q.prompt,
    options,
    correctIndex,
    correctAnswer: correctIndex !== null ? options[correctIndex] ?? null : null,
    chosenIndex,
    chosenAnswer: chosenIndex !== null ? options[chosenIndex] ?? null : null,
    isCorrect,
    explanation: q.explanation ?? null,
    hint: q.hint ?? null,
  };
}

/** Turns the context into the system prompt a provider will receive. */
export function buildSystemPrompt(surface: TutorSurface, ctx: TutorContext | null): string {
  const lines = [
    "You are ReadMe AI Tutor, a patient study coach inside the ReadMe exam-practice app used by Nigerian university students.",
    "",
    "Teaching rules:",
    "- Teach; do not just hand over answers. Explain the underlying concept first, then apply it.",
    "- When a student's answer was wrong, explain why their option is wrong AND why the correct option is right.",
    "- Pitch the explanation at the student's academic level when it is known.",
    "- Use short paragraphs, simple Markdown (headings, bold, bullet lists, fenced code blocks for code, plain text for formulas).",
    "- Never invent facts, citations, statistics or exam syllabi. If you do not know, say so and suggest how the student can verify it.",
    "- Only use the context given below; do not claim knowledge of material that was not provided or retrieved.",
    "- Encourage understanding: end with a short check-for-understanding question or next step when it helps.",
    "- If asked to generate practice questions, exam papers or downloadable resources, explain that ReadMe's question generation is not available yet, then teach the topic and offer a few informal self-test prompts instead.",
    "- You cannot browse the web or open links. Say so plainly if asked.",
    "- Keep answers focused and reasonably concise (usually under 350 words) unless the student asks for depth.",
    `Request surface: ${surface}.`,
  ];

  if (ctx) {
    const profile: string[] = [];
    if (ctx.school) profile.push(`School: ${ctx.school}`);
    if (ctx.faculty) profile.push(`Faculty: ${ctx.faculty}`);
    if (ctx.department) profile.push(`Department: ${ctx.department}`);
    if (ctx.level) profile.push(`Academic level: ${ctx.level}`);
    profile.push(`XP: ${ctx.xp}`, `Study streak: ${ctx.streakCount} day(s)`);
    lines.push("", "Learner context (do not read this back verbatim):", ...profile.map((p) => `- ${p}`));

    if (ctx.courseCode || ctx.courseTitle) {
      lines.push(`- Current course: ${[ctx.courseCode, ctx.courseTitle].filter(Boolean).join(" — ")}`);
    }
    if (ctx.weakSubjects.length) lines.push(`- Weaker courses recently: ${ctx.weakSubjects.join(", ")}`);
    if (ctx.examHistory.length) {
      lines.push(
        `- Recent scores: ${ctx.examHistory
          .slice(0, 5)
          .map((h) => `${h.courseCode ?? "course"} ${h.score}/${h.total}`)
          .join("; ")}`,
      );
    }

    const q = ctx.question;
    if (q) {
      lines.push(
        "",
        "Question the student is reviewing:",
        `Question: ${q.prompt}`,
        "Options:",
        ...q.options.map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`),
      );
      if (q.correctAnswer)
        lines.push(
          `Correct answer: ${q.correctIndex !== null ? String.fromCharCode(65 + q.correctIndex) + ". " : ""}${q.correctAnswer}`,
        );
      if (q.chosenAnswer)
        lines.push(
          `Student selected: ${q.chosenIndex !== null ? String.fromCharCode(65 + q.chosenIndex) + ". " : ""}${q.chosenAnswer}` +
            (q.isCorrect === null ? "" : q.isCorrect ? " (correct)" : " (incorrect)"),
        );
      else if (q.chosenIndex === null) lines.push("Student left this question unanswered.");
      if (q.explanation) lines.push(`Existing explanation from the question bank: ${q.explanation}`);
      if (q.hint) lines.push(`Existing hint: ${q.hint}`);
    }
  }

  return lines.join("\n");
}

/** Keeps request payloads bounded before they reach a provider. */
export function trimHistory(messages: AiMessage[], max = 20): AiMessage[] {
  return messages.filter((m) => m.role !== "system").slice(-max);
}
