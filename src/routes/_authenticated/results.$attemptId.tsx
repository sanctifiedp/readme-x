import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getResults } from "@/lib/exam.functions";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  component: ResultsPage,
});

function ResultsPage() {
  const { attemptId } = Route.useParams();
  const fetchResults = useServerFn(getResults);
  const { data, isLoading } = useQuery({
    queryKey: ["results", attemptId],
    queryFn: () => fetchResults({ data: { attemptId } }),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const pct = data.attempt.total ? Math.round(((data.attempt.score ?? 0) / data.attempt.total) * 100) : 0;
  const passed = pct >= 50;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
        </Link>

        <div className="rounded-2xl p-8 text-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          <Award className="h-12 w-12 mx-auto opacity-80" />
          <p className="mt-3 text-sm uppercase tracking-wider opacity-80">{data.attempt.courseCode} · {data.attempt.courseTitle}</p>
          <h1 className="text-6xl font-extrabold mt-2">{data.attempt.score} / {data.attempt.total}</h1>
          <p className="mt-2 text-2xl font-semibold opacity-90">{pct}%</p>
          <p className="mt-3 text-sm opacity-80">{passed ? "Great work — keep going." : "Keep practicing — you've got this."}</p>
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-4">Review</h2>
        <div className="space-y-4">
          {data.questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold shrink-0 ${
                  q.isCorrect ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{q.prompt}</p>
                  <div className="mt-3 space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex;
                      const isChosen = oi === q.chosenIndex;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${
                            isCorrect
                              ? "border-success/40 bg-success/10"
                              : isChosen
                                ? "border-destructive/40 bg-destructive/10"
                                : "border-border"
                          }`}
                        >
                          <span className="font-mono text-xs w-5">{String.fromCharCode(65 + oi)}.</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <CheckCircle2 className="h-4 w-4 text-success" />}
                          {isChosen && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link to="/dashboard">
            <Button size="lg">Back to dashboard</Button>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
