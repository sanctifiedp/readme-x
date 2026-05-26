import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Send, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { getTournamentAttempt, submitTournamentAttempt } from "@/lib/tournaments.functions";

export const Route = createFileRoute("/_authenticated/tournament/$attemptId")({
  component: TournamentExamPage,
});

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function TournamentExamPage() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const fetchAttempt = useServerFn(getTournamentAttempt);
  const submitFn = useServerFn(submitTournamentAttempt);

  const { data, isLoading } = useQuery({
    queryKey: ["t-attempt", attemptId],
    queryFn: () => fetchAttempt({ data: { attemptId } }),
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);

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
    onSuccess: () => {
      toast.success("Submitted!");
      if (data?.attempt.tournamentId) navigate({ to: "/tournaments/$id", params: { id: data.attempt.tournamentId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitNow = useCallback(() => {
    if (!submitMut.isPending) submitMut.mutate();
  }, [submitMut]);

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

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (data.attempt.submittedAt) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-xl text-center">
          <Trophy className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Submission received</h1>
          <p className="text-muted-foreground mt-2">Score: {data.attempt.score} / {data.attempt.total}</p>
          <p className="text-sm text-muted-foreground mt-1">Final results will be announced when the tournament ends.</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/tournaments/$id", params: { id: data.attempt.tournamentId } })}>
            Back to tournament
          </Button>
        </main>
      </div>
    );
  }

  const q = data.questions[idx];
  if (!q) return null;
  const total = data.questions.length;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{data.attempt.courseCode} · Tournament</div>
            <h1 className="font-semibold truncate">{data.attempt.title}</h1>
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

        <div className="flex flex-wrap gap-1.5 mb-6">
          {data.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setIdx(i)}
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
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
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
          <p className="mt-4 text-xs text-muted-foreground">Tournament mode: hints are disabled. Auto-submits when time ends.</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {idx < total - 1 ? (
            <Button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (answeredCount < total && !confirm(`You've answered ${answeredCount} of ${total}. Submit?`)) return;
                submitNow();
              }}
              disabled={submitMut.isPending}
            >
              {submitMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
