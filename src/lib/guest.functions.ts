import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Public: live username availability check used by the sign-up form. */
export const checkUsernamePublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ username: z.string().trim().max(40) }).parse(input))
  .handler(async ({ data }) => {
    const uname = data.username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      return { available: false, reason: "3–20 characters: letters, numbers or underscores only." };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", uname)
      .limit(1);
    if (error) throw new Error(error.message);
    const taken = (rows ?? []).length > 0;
    return { available: !taken, reason: taken ? "That username is taken." : undefined };
  });

/**
 * Public: build a temporary guest exam. No database rows are created —
 * guests get a session-only experience.
 */
export const startGuestExam = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        courseId: z.string().uuid(),
        count: z.number().int().min(1).max(70),
        minutes: z.number().int().min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id, code, title")
      .eq("id", data.courseId)
      .single();
    if (cErr || !course) throw new Error("Course not found");

    const { data: questions, error } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, image_path")
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    if (!questions || questions.length === 0) {
      throw new Error("This course has no questions yet.");
    }

    const picked = [...questions]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(data.count, questions.length));

    const { resolveQuestionImageUrls } = await import("./question-media.server");
    const imageUrls = await resolveQuestionImageUrls(picked.map((q) => q.image_path));

    return {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      durationSeconds: data.minutes * 60,
      questions: picked.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options as string[],
        imageUrl: q.image_path ? imageUrls[q.image_path] ?? null : null,
      })),
    };
  });

/**
 * Public: grade a guest attempt. Scoring happens server-side, nothing is
 * persisted, and no XP / badges / streaks / leaderboard rows are touched.
 */
export const gradeGuestExam = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        courseId: z.string().uuid(),
        answers: z
          .array(
            z.object({
              questionId: z.string().uuid(),
              chosenIndex: z.number().int().min(-1).max(9),
            }),
          )
          .max(70),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ids = data.answers.map((a) => a.questionId);
    if (ids.length === 0) return { score: 0, total: 0, questions: [] };

    const { data: rows, error } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, hint, explanation, image_path, course_id")
      .in("id", ids)
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);

    const { resolveQuestionImageUrls: resolveGuestImages } = await import("./question-media.server");
    const guestImageUrls = await resolveGuestImages((rows ?? []).map((r) => r.image_path));

    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    const detail = data.answers
      .map((a) => {
        const q = byId.get(a.questionId);
        if (!q) return null;
        return {
          id: q.id,
          prompt: q.prompt,
          options: q.options as string[],
          correctIndex: q.correct_index,
          chosenIndex: a.chosenIndex < 0 ? null : a.chosenIndex,
          isCorrect: a.chosenIndex === q.correct_index,
          hint: q.hint ?? null,
          explanation: q.explanation ?? null,
          imageUrl: q.image_path ? guestImageUrls[q.image_path] ?? null : null,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      prompt: string;
      options: string[];
      correctIndex: number;
      chosenIndex: number | null;
      isCorrect: boolean;
      hint: string | null;
      explanation: string | null;
      imageUrl: string | null;
    }>;

    return {
      score: detail.filter((d) => d.isCorrect).length,
      total: detail.length,
      questions: detail,
    };
  });

/** Public: single-sentence AI hint (cached on the question row). */
export const getHintPublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: q, error } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, hint")
      .eq("id", data.questionId)
      .single();
    if (error || !q) throw new Error("Question not found");
    if (q.hint && q.hint.trim()) return { hint: q.hint };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a study coach. Reply with ONE short sentence (max 20 words) that nudges the student toward the answer WITHOUT revealing which option is correct. No prefaces, no quotes.",
          },
          {
            role: "user",
            content: `Question: ${q.prompt}\nOptions:\n${(q.options as string[])
              .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
              .join("\n")}`,
          },
        ],
      }),
    });
    if (!resp.ok) {
      if (resp.status === 429) throw new Error("AI hints are rate-limited. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Contact admin.");
      throw new Error("Could not generate hint right now.");
    }
    const json = await resp.json();
    const hint = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!hint) throw new Error("Empty hint from AI");
    await supabaseAdmin.from("questions").update({ hint }).eq("id", q.id);
    return { hint };
  });
