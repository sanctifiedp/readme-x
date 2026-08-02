import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Loader2, Send, Sparkles, Timer, Award,
  CheckCircle2, XCircle, UserPlus, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { startGuestExam, gradeGuestExam, getHintPublic } from "@/lib/guest.functions";
import { useSessionUser } from "@/hooks/useSessionUser";

const GUEST_CONFIG_PREFIX = "readme:guest-exam:";

export const Route = createFileRoute("/guest-exam/$courseId")({
  head: () => ({
    meta: [
      { title: "Practice exam — ReadMe" },
      { name: "description", content: "Take a timed ReadMe practice exam instantly — no sign-up needed." },
      { property: "og:title", content: "Practice exam — ReadMe" },
      { property: "og:description", content: "Timed CBT practice with instant scoring on ReadMe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestExamPage,
});

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

type Result = Awaited<ReturnType<typeof gradeGuestExam>>;

function GuestExamPage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const startFn = useServerFn(startGuestExam);
  const gradeFn = useServerFn(gradeGuestExam);
  const hintFn = useServerFn(getHintPublic);
  const session = useSessionUser();

  const config = useMemo(() => {
    if (typeof window === "undefined") return { count: 20, minutes: 15 };
    try {
      const raw = sessionStorage.getItem(GUEST_CONFIG_PREFIX + courseId);
      if (raw) {
        const parsed = JSON.parse(raw) as { count?: number; minutes?: number };
        return {
          count: Math.max(1, Math.min(70, parsed.count ?? 20)),
          minutes: Math.max(1, Math.min(30, parsed.minutes ?? 15)),
        };
      }
    } catch { /* ignore */ }
    return { count: 20, minutes: 15 };
  }, [courseId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["guest-exam", courseId, config.count, config.minutes],
    queryFn: () => startFn({ data: { courseId, ...config } }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hintLoading, setHintLoading] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef<number | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data && startedAt.current === null) startedAt.current = Date.now();
  }, [data]);

  const gradeMut = useMutation({
    mutationFn: () =>
      gradeFn({
        data: {
          courseId,
          answers: (data?.questions ?? []).map((q) => ({
            questionId: q.id,
            chosenIndex: answers[q.id] ?? -1,
          })),
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      window.scrollTo({ top: 0 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitNow = useCallback(() => {
    if (!gradeMut.isPending && !result) gradeMut.mutate();
  }, [gradeMut, result]);

  useEffect(() => {
    if (!data || result) return;
    const dur = data.durationSeconds;
    const tick = () => {
      const started = startedAt.current ?? Date.now();
      const s = Math.max(0, dur - Math.floor((Date.now() - started) / 1000));
      setRemaining(s);
      if (s <= 0) submitNow();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data, result, submitNow]);

  useEffect(() => () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, []);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-destructive">{(error as Error)?.message ?? "Could not start this practice."}</p>
          <Button variant="outline" onClick={() => navigate({ to: "/courses" })}>Browse courses</Button>
        </div>
      </div>
    );
  }

  /* ---------------- Result view ---------------- */
  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    const timeUsed = startedAt.current ? Math.floor((Date.now() - startedAt.current) / 1000) : null;
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl space-y-6">
          <div className="rounded-2xl p-8 text-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <Award className="h-12 w-12 mx-auto opacity-80" />
            <p className="mt-3 text-sm uppercase tracking-wider opacity-80">
              {data.courseCode} · {data.courseTitle}
            </p>
            <h1 className="text-6xl font-extrabold mt-2">{result.score} / {result.total}</h1>
            <p className="mt-2 text-2xl font-semibold opacity-90">{pct}%</p>
            {timeUsed !== null && (
              <p className="mt-2 text-sm opacity-90">Time used: {fmt(Math.min(timeUsed, data.durationSeconds))}</p>
            )}
          </div>

          {/* Conversion prompt */}
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold">
                    {session.userId ? "Verify your email to keep this progress" : "Save this score — create a free account"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {session.userId
                      ? "Verified accounts earn XP, badges and streaks, and keep a full exam history."
                      : "Accounts keep your exam history, XP, badges, streaks and leaderboard rank. This guest result isn't saved."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/auth">{session.userId ? "Go to account" : "Create free account"}</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/courses">Keep practising as guest</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setResult(null);
                      setAnswers({});
                      setIdx(0);
                      startedAt.current = Date.now();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" /> Retake
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold">Review</h2>
            {result.questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  {q.isCorrect
                    ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium">{i + 1}. {q.prompt}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options.map((opt, oi) => (
                        <li
                          key={oi}
                          className={
                            oi === q.correctIndex
                              ? "text-success font-medium"
                              : oi === q.chosenIndex
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {String.fromCharCode(65 + oi)}. {opt}
                          {oi === q.correctIndex && " ✓"}
                          {oi === q.chosenIndex && oi !== q.correctIndex && " ✗ your answer"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  /* ---------------- Exam view ---------------- */
  const q = data.questions[idx];
  if (!q) return null;
  const total = data.questions.length;
  const isLast = idx === total - 1;

  const handleSelect = (chosenIndex: number) => {
    setAnswers((a) => ({ ...a, [q.id]: chosenIndex }));
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (!isLast) {
      autoAdvanceTimer.current = setTimeout(() => {
        setIdx((cur) => Math.min(total - 1, cur + 1));
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
            <div className="font-mono text-xs text-muted-foreground">{data.courseCode}</div>
            <h1 className="font-semibold truncate">{data.courseTitle}</h1>
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

        <p className="mb-4 text-xs text-muted-foreground">
          {session.userId ? "Unverified session" : "Guest session"} — results aren't saved and no XP or badges are earned.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-6">
          {data.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setIdx(i)}
              aria-label={`Go to question ${i + 1}`}
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
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Question {idx + 1} of {total}
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
                    selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
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
          <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {!isLast ? (
            <Button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (answeredCount < total && !confirm(`You've answered ${answeredCount} of ${total}. Finish anyway?`)) return;
                submitNow();
              }}
              disabled={gradeMut.isPending}
            >
              {gradeMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Finish exam
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
