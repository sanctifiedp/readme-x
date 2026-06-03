import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Timer, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { getChallengePlay, submitChallenge } from "@/lib/challenges.functions";

export const Route = createFileRoute("/_authenticated/challenge/$challengeId")({
  head: () => ({ meta: [{ title: "Challenge — ReadMe" }] }),
  component: ChallengePlayPage,
});

function ChallengePlayPage() {
  const { challengeId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getChallengePlay);
  const submitFn = useServerFn(submitChallenge);

  const { data, isLoading, error } = useQuery({
    queryKey: ["challenge-play", challengeId],
    queryFn: () => getFn({ data: { challengeId } }),
    retry: false,
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = useMutation({
    mutationFn: () => {
      const payload = (data?.questions ?? []).map((q) => ({
        questionId: q.id, chosenIndex: answers[q.id] ?? -1,
      }));
      return submitFn({ data: { challengeId, answers: payload } });
    },
    onSuccess: (res) => {
      toast.success(`Submitted! Score ${res.score}/${res.total}`);
      navigate({ to: "/challenges", search: {} });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remaining = useMemo(() => {
    if (!data) return 0;
    const exp = new Date(data.attempt.expiresAt).getTime();
    return Math.max(0, Math.floor((exp - now) / 1000));
  }, [data, now]);

  useEffect(() => {
    if (data && remaining === 0 && !data.attempt.submittedAt && !submit.isPending) {
      submit.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, data]);

  if (isLoading) return (
    <div className="min-h-screen flex flex-col"><SiteHeader />
      <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex flex-col"><SiteHeader />
      <div className="flex-1 flex items-center justify-center text-destructive">{(error as Error).message}</div>
    </div>
  );

  if (data!.attempt.submittedAt) {
    return (
      <div className="min-h-screen flex flex-col"><SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl text-center space-y-4">
          <h1 className="text-2xl font-bold">Already submitted</h1>
          <p className="text-muted-foreground">Score: {data!.attempt.score} / {data!.questions.length}</p>
          <Button asChild><Link to="/challenges" search={{}}>Back to challenges</Link></Button>
        </main>
      </div>
    );
  }

  const q = data!.questions[idx];
  const total = data!.questions.length;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{data!.challenge.courseCode}</div>
            <h1 className="text-lg font-semibold">{data!.challenge.courseTitle}</h1>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary font-mono">
            <Timer className="h-4 w-4" />{mm}:{ss}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">Question {idx + 1} of {total}</div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="font-medium">{q.prompt}</div>
          <RadioGroup
            value={answers[q.id]?.toString() ?? ""}
            onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
          >
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border p-3 hover:border-primary">
                <RadioGroupItem value={String(i)} id={`o-${q.id}-${i}`} />
                <Label htmlFor={`o-${q.id}-${i}`} className="flex-1 cursor-pointer">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Prev
          </Button>
          {idx < total - 1 ? (
            <Button onClick={() => setIdx(i => i + 1)}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data!.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setIdx(i)}
              className={`h-8 w-8 text-xs rounded-md border ${
                i === idx ? "bg-primary text-primary-foreground border-primary" :
                answers[qq.id] !== undefined ? "bg-primary/10 border-primary/40" : "border-border text-muted-foreground"
              }`}
            >{i + 1}</button>
          ))}
        </div>
      </main>
    </div>
  );
}
