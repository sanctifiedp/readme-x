import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TutorResponse } from "@/lib/ai/types";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const TutorRequestSchema = z
  .object({
    surface: z
      .enum([
        "tutor_page",
        "post_exam_explanation",
        "practice_hint",
        "quiz_generation",
        "study_plan",
        "course_summary",
        "flashcards",
      ])
      .default("tutor_page"),
    messages: z.array(MessageSchema).min(1).max(30),
    courseId: z.string().uuid().nullable().optional(),
    questionId: z.string().uuid().nullable().optional(),
    attemptId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (v) => v.messages.reduce((n, m) => n + m.content.length, 0) <= 12000,
    "Your conversation is too long. Start a new chat to continue.",
  )
  .refine((v) => v.messages.at(-1)?.role === "user", "Nothing to send.");

/**
 * Simple in-memory per-user throttle. The backend has no shared rate-limiting
 * primitive, so this is a best-effort guard against runaway AI cost from a
 * single session; it resets on deploy and is per server instance.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

function throttle(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new Error("You're asking a lot very quickly — please wait a minute before sending more.");
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
}

/**
 * The ONLY entry point the frontend uses to talk to the AI layer.
 * Provider selection, model choice, prompts, context building and secrets all
 * stay server-side — the client cannot pick a provider or model.
 */
export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TutorRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<TutorResponse> => {
    throttle(context.userId);

    const [{ buildTutorContext, buildSystemPrompt, trimHistory }, { runCompletion, TutorProviderError }] =
      await Promise.all([import("@/lib/ai/context.server"), import("@/lib/ai/provider.server")]);

    const tutorContext = await buildTutorContext(context.userId, {
      courseId: data.courseId ?? null,
      questionId: data.questionId ?? null,
      attemptId: data.attemptId ?? null,
    });

    try {
      return await runCompletion({
        surface: data.surface,
        messages: trimHistory(data.messages),
        context: tutorContext,
        systemPrompt: buildSystemPrompt(data.surface, tutorContext),
      });
    } catch (err) {
      if (err instanceof TutorProviderError) throw new Error(err.message);
      console.error("[ai-tutor] unexpected failure", err);
      throw new Error("AI Tutor ran into a problem. Please try again.");
    }
  });
