import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Send, Sparkles, Timer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { getAttempt, submitAttempt, saveAnswer } from "@/lib/exam.functions";
import { getHint } from "@/lib/practice.functions";

export const Route = createFileRoute("/_authenticated/exam/$attemptId")({
  component: ExamPage,
});

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function ExamPage() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const fetchAttempt = useServerFn(getAttempt);
  const submitFn = useServerFn(submitAttempt);
  const saveFn = useServerFn(saveAnswer);
  const hintFn = useServerFn(getHint);

  const { data, isLoading } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => fetchAttempt({ data: { attemptId } }),
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hintLoading, setHintLoading] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate initial state from server once
  useEffect(() => {
    if (!data || restoredRef.current) return;
    restoredRef.current = true;
    setAnswers(data.answers ?? {});
    const total = data.questions.length;
    const target = Math.min(Math.max(0, data.attempt.currentIndex ?? 0), Math.max(0, total - 1));
    setIdx(target);
  }, [data]);

  const submitMut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          attemptId,
          answers: (data?.questions ?? []).map((q) => ({
            questionId: q.id,
            chosenIndex: answers[q.id] ?? -1,
          })),
        },
      }),
    onSuccess: () => navigate({ to: "/results/$attemptId", params: { attemptId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const submitNow = useCallback(() => {
    if (!submitMut.isPending) submitMut.mutate();
  }, [submitMut]);

  // Timer tick
  useEffect(() => {
    const exp = data?.attempt?.expiresAt ? new Date(data.attempt.expiresAt).getTime() : null;
    if (!exp) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setRemaining(s);
      if (s <= 0) submitNow();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.attempt?.expiresAt, submitNow]);

  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, []);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (data.attempt.submittedAt) {
    navigate({ to: "/results/$attemptId", params: { attemptId } });
    return null;
  }

  const q = data.questions[idx];
  if (!q) return null;
  const total = data.questions.length;
  const isLast = idx === total - 1;

  const persistCurrentIndex = (nextIndex: number) => {
    // Fire-and-forget; server keeps last_activity_at + current_index
    void saveFn({
      data: {
        attemptId,
        questionId: q.id,
        chosenIndex: answers[q.id] ?? -1,
        currentIndex: nextIndex,
      },
    }).catch(() => { /* silent */ });
  };

  const goPrev = () => {
    if (idx === 0) return;
    const next = idx - 1;
    setIdx(next);
    persistCurrentIndex(next);
  };
  const goNext = () => {
    if (idx >= total - 1) return;
    const next = idx + 1;
    setIdx(next);
    persistCurrentIndex(next);
  };
  const jumpTo = (i: number) => {
    setIdx(i);
    persistCurrentIndex(i);
  };

  const handleSelect = (chosenIndex: number) => {
    setAnswers((a) => ({ ...a, [q.id]: chosenIndex }));
    setSavingId(q.id);
    // Persist and auto-advance
    const currentIndex = idx;
    void saveFn({
      data: { attemptId, questionId: q.id, chosenIndex, currentIndex },
    })
      .then(() => {
        setSavedFlash(q.id);
        setTimeout(() => setSavedFlash((v) => (v === q.id ? null : v)), 900);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setSavingId((v) => (v === q.id ? null : v)));

    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (!isLast) {
      autoAdvanceTimer.current = setTimeout(() => {
        setIdx((cur) => {
          const next = Math.min(total - 1, cur + 1);
          if (next !== cur) persistCurrentIndex(next);
          return next;
        });
      }, 400);
    }
  };

  const loadHint = async () => {
    if (hints[q.id]) return;
    setHintLoading(q.id);
    try {
      const res = await hintFn({ data: { questionId: q.id } });
      setHints((h) => ({ ...h, [q.id]: res.hint }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setHintLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{data.attempt.courseCode}</div>
            <h1 className="font-semibold truncate">{data.attempt.courseTitle}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {remaining !== null && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono ${
                remaining <= 60 ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
              }`}>
                <Timer className="h-3.5 w-3.5" /> {fmt(remaining)}
              </div>
            )}
            <div className="text-muted-foreground">
              Answered <span className="text-foreground font-semibold">{answeredCount}</span> / {total}
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {data.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => jumpTo(i)}
              className={`h-7 w-7 text-xs rounded-md border transition ${
                i === idx
                  ? "bg-primary text-primary-foreground border-primary"
                  : answers[qq.id] !== undefined
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Question {idx + 1} of {total}
            </div>
            <div className="text-xs text-muted-foreground h-4 flex items-center gap-1">
              {savingId === q.id ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
              ) : savedFlash === q.id ? (
                <><Check className="h-3 w-3 text-success" /> Saved</>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-lg font-medium leading-relaxed">{q.prompt}</p>

          <div className="mt-5 space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md mr-3 text-sm font-semibold ${
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {hints[q.id] ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><span className="font-semibold">Hint: </span>{hints[q.id]}</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={loadHint} disabled={hintLoading === q.id}>
                {hintLoading === q.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Show AI hint
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={goPrev} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {!isLast ? (
            <Button onClick={goNext}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (answeredCount < total) {
                  if (!confirm(`You've answered ${answeredCount} of ${total}. Finish exam anyway?`)) return;
                }
                submitNow();
              }}
              disabled={submitMut.isPending}
            >
              {submitMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Finish exam
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
