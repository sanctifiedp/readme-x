/**
 * AI provider abstraction (server-only).
 *
 * Adding another provider later means implementing `AiProvider` and registering
 * it in `providers` — no frontend, server-function or prompt changes required.
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
  /**
   * Future web-grounding hook: a retrieval step (e.g. Brave Search) can place
   * already-fetched source snippets here and every provider will include them
   * as extra grounding. Never populated today; normal replies need no search.
   */
  webContext?: Array<{ title: string; url: string; snippet: string }> | null;
};

export type AiProvider = {
  name: string;
  /** Model id used for this call, or null for providers without one. */
  model: string | null;
  /** True when the provider is a stub rather than a real LLM. */
  placeholder: boolean;
  complete: (input: AiCompletionInput) => Promise<TutorResponse>;
};

/** Raised for problems we are happy to show the student (never provider internals). */
export class TutorProviderError extends Error {}

const REQUEST_TIMEOUT_MS = 60_000;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const DEFAULT_MODEL = "openai/gpt-5.6-sol";

/** Fallback provider used only when no AI credentials are configured. */
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

function buildGroundingBlock(input: AiCompletionInput): string | null {
  if (!input.webContext?.length) return null;
  return [
    "Retrieved web sources (cite these by title when you use them; do not invent others):",
    ...input.webContext.map((s, i) => `${i + 1}. ${s.title} — ${s.url}\n${s.snippet}`),
  ].join("\n");
}

/** Lovable AI Gateway (Responses API). Streams on the wire, returns final text. */
const lovableProvider: AiProvider = {
  name: "lovable",
  model: DEFAULT_MODEL,
  placeholder: false,
  async complete(input): Promise<TutorResponse> {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return placeholderProvider.complete(input);

    const instructions = [input.systemPrompt, buildGroundingBlock(input)].filter(Boolean).join("\n\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(GATEWAY_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          stream: true,
          instructions,
          input: input.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: [
              {
                type: m.role === "assistant" ? "output_text" : "input_text",
                text: m.content,
              },
            ],
          })),
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new TutorProviderError("The tutor took too long to reply. Please try again.");
      }
      console.error("[ai-tutor] gateway request failed", err);
      throw new TutorProviderError("The tutor is unreachable right now. Please try again shortly.");
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      clearTimeout(timer);
      console.error("[ai-tutor] gateway error", res.status, detail.slice(0, 500));
      if (res.status === 429) {
        throw new TutorProviderError("The tutor is busy right now. Please try again in a moment.");
      }
      if (res.status === 402) {
        throw new TutorProviderError("AI Tutor is temporarily unavailable. Please try again later.");
      }
      throw new TutorProviderError("The tutor could not answer that. Please try again.");
    }

    try {
      const reply = await readOutputText(res.body);
      if (!reply.trim()) {
        throw new TutorProviderError("The tutor did not produce an answer. Try rephrasing your question.");
      }
      return { reply, provider: "lovable", model: DEFAULT_MODEL, placeholder: false };
    } catch (err) {
      if (err instanceof TutorProviderError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new TutorProviderError("The tutor took too long to reply. Please try again.");
      }
      console.error("[ai-tutor] stream failed", err);
      throw new TutorProviderError("The tutor's reply was interrupted. Please try again.");
    } finally {
      clearTimeout(timer);
    }
  },
};

/** Reads a Responses-API SSE stream and joins the output text deltas. */
async function readOutputText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let final: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          out += evt.delta;
        } else if (evt.type === "response.completed" && typeof evt.response?.output_text === "string") {
          final = evt.response.output_text;
        }
      } catch {
        // Ignore keep-alives and partial frames.
      }
    }
  }

  return out.trim() ? out : final ?? "";
}

/**
 * Registry of available providers, keyed by the value of `AI_TUTOR_PROVIDER`.
 * Future entries can be added here (e.g. "openai", "anthropic") without any
 * change to the Tutor UI or `askTutor`.
 */
const providers: Record<string, () => AiProvider> = {
  lovable: () => lovableProvider,
  placeholder: () => placeholderProvider,
};

export function resolveProvider(): AiProvider {
  const requested = process.env["AI_TUTOR_PROVIDER"];
  const factory = (requested ? providers[requested] : undefined) ?? providers["lovable"]!;
  return factory();
}

/** Single entry point every AI feature should call. */
export async function runCompletion(input: AiCompletionInput): Promise<TutorResponse> {
  return resolveProvider().complete(input);
}
