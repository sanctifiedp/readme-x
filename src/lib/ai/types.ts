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

/** A question the learner is reviewing, resolved server-side only. */
export type TutorQuestionContext = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  chosenIndex: number | null;
  chosenAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  hint: string | null;
};

/** Everything the tutor may know about the learner for a given request. */
export type TutorContext = {
  userId: string;
  school: string | null;
  faculty: string | null;
  department: string | null;
  level: string | null;
  /** Course the learner is currently studying / practising, when known. */
  courseCode: string | null;
  courseTitle: string | null;
  /** Question the learner is looking at, when the tutor is opened from a review. */
  question: TutorQuestionContext | null;
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
  attemptId?: string | null;
};

export type TutorResponse = {
  /** Assistant reply text (Markdown). */
  reply: string;
  /** Provider that produced the reply. */
  provider: string;
  model: string | null;
  /** True when no real AI provider is configured and a stub replied. */
  placeholder: boolean;
};

export const TUTOR_PLACEHOLDER_REPLY =
  "AI Tutor is not configured right now. Please try again later.";

export const STARTER_PROMPTS = [
  "Explain this topic.",
  "Why is my answer wrong?",
  "Teach me this course.",
  "Summarize this topic.",
  "Help me prepare for this exam.",
  "Generate practice questions.",
] as const;

/** Client-side guardrails mirrored by stricter server-side validation. */
export const TUTOR_LIMITS = {
  maxMessageChars: 2000,
  maxMessages: 30,
  maxTotalChars: 12000,
} as const;
