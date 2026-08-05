import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SiteHeader } from "@/components/SiteHeader";
import { askTutor } from "@/lib/tutor.functions";
import { STARTER_PROMPTS, type AiMessage } from "@/lib/ai/types";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({
    meta: [
      { title: "AI Tutor — ReadMe" },
      {
        name: "description",
        content: "Ask the ReadMe AI Tutor to explain topics, review wrong answers and plan your exam prep.",
      },
      { property: "og:title", content: "AI Tutor — ReadMe" },
      { property: "og:description", content: "Your personal study companion for topics, revision and exam prep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorPage,
});

function TutorPage() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askTutor);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || sending) return;
    const next: AiMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setSending(true);
    try {
      const res = await ask({ data: { surface: "tutor_page", messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error((e as Error).message || "Could not reach the AI Tutor.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col max-w-3xl w-full">
        <header className="flex items-start gap-3 pb-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI Tutor</h1>
            <p className="text-sm text-muted-foreground">
              Your study companion for explanations, revision and exam prep.
            </p>
          </div>
        </header>

        <div className="flex-1 rounded-xl border border-border/60 bg-card/40 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 min-h-[45vh] max-h-[62vh]">
            {messages.length === 0 && !sending && (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  Ask anything about your courses. Try one of these to get started:
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-3 text-left text-sm font-medium hover:bg-accent transition-colors min-h-11"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2.5"}>
                {m.role === "assistant" && (
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap break-words"
                      : "max-w-[85%] text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-2.5 items-center">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:300ms]" />
                  </span>
                  Tutor is thinking…
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="border-t border-border/60 bg-background/80 p-2.5 sm:p-3 flex items-end gap-2"
          >
            <Textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              placeholder="Ask your tutor anything…"
              rows={1}
              className="min-h-11 max-h-40 resize-none"
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()} className="h-11 w-11 shrink-0" aria-label="Send">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        <p className="pt-3 text-xs text-muted-foreground">
          AI Tutor is in preparation — replies are placeholders until the tutor goes live.
        </p>
      </main>
    </div>
  );
}
