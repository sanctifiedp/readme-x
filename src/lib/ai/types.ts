/**
 * Client-safe AI types shared by the frontend and the server layer.
 * The frontend NEVER talks to an AI provider directly — it only ever
 * calls the `askTutor` server function in `src/lib/tutor.functions.ts`.
 */

export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

/** Everything the tutor may eventually know about the learner. */
export type TutorContext = {
  userId: string;
  school: string | null;
  faculty: string | null;
  department: string | null;
  level: string | null;
  /** Course the learner is currently studying / practising, when known. */
  courseCode: string | null;
  courseTitle: string | null;
  /** Question the learner is looking at, when the tutor is opened from an exam. */
  questionId: string | null;
  questionPrompt: string | null;
  /** Recent exam performance summary (most recent first). */
  examHistory: Array<{ courseCode: string | null; score: number; total: number; takenAt: string }>;
  weakSubjects: string[];
  xp: number;
  streakCount: number;
};

/** Where the tutor was opened from — future features hook in here. */
export type TutorSurface =
  | "tutor_page"
  | "post_exam_explanation"
  | "practice_hint"
  | "quiz_generation"
  | "study_plan"
  | "course_summary"
  | "flashcards";

export type TutorRequest = {
  surface: TutorSurface;
  messages: AiMessage[];
  /** Optional pointers the server resolves into a full TutorContext. */
  courseId?: string | null;
  questionId?: string | null;
};

export type TutorResponse = {
  /** Assistant reply text. */
  reply: string;
  /** Provider that produced the reply — "placeholder" until one is connected. */
  provider: string;
  model: string | null;
  /** True while no real AI provider is configured. */
  placeholder: boolean;
};

export const TUTOR_PLACEHOLDER_REPLY =
  "AI Tutor is currently being prepared. This feature will become available soon.";

export const STARTER_PROMPTS = [
  "Explain this topic.",
  "Why is my answer wrong?",
  "Teach me this course.",
  "Summarize this chapter.",
  "Generate practice questions.",
  "Help me prepare for my exam.",
] as const;
