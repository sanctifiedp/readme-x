import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TutorResponse } from "@/lib/ai/types";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const TutorRequestSchema = z.object({
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
  messages: z.array(MessageSchema).min(1).max(40),
  courseId: z.string().uuid().nullable().optional(),
  questionId: z.string().uuid().nullable().optional(),
});

/**
 * The ONLY entry point the frontend uses to talk to the AI layer.
 * Provider selection, prompts, context building and secrets all stay server-side.
 */
export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TutorRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<TutorResponse> => {
    const [{ buildTutorContext, buildSystemPrompt, trimHistory }, { runCompletion }] = await Promise.all([
      import("@/lib/ai/context.server"),
      import("@/lib/ai/provider.server"),
    ]);

    const tutorContext = await buildTutorContext(context.userId, {
      courseId: data.courseId ?? null,
      questionId: data.questionId ?? null,
    });

    return runCompletion({
      surface: data.surface,
      messages: trimHistory(data.messages),
      context: tutorContext,
      systemPrompt: buildSystemPrompt(data.surface, tutorContext),
    });
  });
