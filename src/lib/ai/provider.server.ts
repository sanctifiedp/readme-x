/**
 * AI provider abstraction (server-only).
 *
 * Adding a real provider later means implementing `AiProvider` and registering
 * it in `resolveProvider()` — no frontend or server-function changes required.
 * API keys are read from server env (secrets) inside the provider call only,
 * never at module scope and never shipped to the browser.
 */
import type { AiMessage, TutorContext, TutorResponse, TutorSurface } from "./types";
import { TUTOR_PLACEHOLDER_REPLY } from "./types";

export type AiCompletionInput = {
  surface: TutorSurface;
  messages: AiMessage[];
  context: TutorContext | null;
  systemPrompt: string;
};

export type AiProvider = {
  name: string;
  /** Model id used for this call, or null for providers without one. */
  model: string | null;
  /** True when the provider is a stub rather than a real LLM. */
  placeholder: boolean;
  complete: (input: AiCompletionInput) => Promise<TutorResponse>;
};

/** Default provider until a real LLM is wired up. Never errors. */
const placeholderProvider: AiProvider = {
  name: "placeholder",
  model: null,
  placeholder: true,
  async complete() {
    return {
      reply: TUTOR_PLACEHOLDER_REPLY,
      provider: "placeholder",
      model: null,
      placeholder: true,
    };
  },
};

/**
 * Registry of available providers, keyed by the value of `AI_TUTOR_PROVIDER`.
 * Future entries: "lovable", "openai", "anthropic", "google", "xai".
 */
const providers: Record<string, () => AiProvider> = {
  placeholder: () => placeholderProvider,
};

export function resolveProvider(): AiProvider {
  const requested = process.env["AI_TUTOR_PROVIDER"];
  const factory = requested ? providers[requested] : undefined;
  return factory ? factory() : placeholderProvider;
}

/** Single entry point every AI feature should call. */
export async function runCompletion(input: AiCompletionInput): Promise<TutorResponse> {
  const provider = resolveProvider();
  return provider.complete(input);
}
