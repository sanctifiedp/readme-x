import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const startPractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      courseId: z.string().uuid(),
      count: z.number().int().min(1).max(70),
      minutes: z.number().int().min(1).max(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: questions, error } = await supabaseAdmin
      .from("questions").select("id").eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    if (!questions || questions.length === 0) {
      throw new Error("This course has no questions yet. Ask an admin to add some.");
    }
    const pickN = Math.min(data.count, questions.length);
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, pickN).map((q) => q.id);
    const durationSeconds = data.minutes * 60;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("exam_attempts")
      .insert({
        user_id: context.userId,
        course_id: data.courseId,
        question_ids: shuffled,
        total: shuffled.length,
        duration_seconds: durationSeconds,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);
    return { attemptId: attempt.id };
  });

export const getHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
            content: `Question: ${q.prompt}\nOptions:\n${(q.options as string[]).map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`,
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
