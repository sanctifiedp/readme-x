import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCourseDetail, startAttempt } from "@/lib/exam.functions";

export const Route = createFileRoute("/_authenticated/courses/$code")({
  component: CoursePage,
});

function CoursePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getCourseDetail);
  const startFn = useServerFn(startAttempt);

  const { data, isLoading } = useQuery({
    queryKey: ["course", code],
    queryFn: () => fetchDetail({ data: { code } }),
  });

  const startMut = useMutation({
    mutationFn: (courseId: string) => startFn({ data: { courseId } }),
    onSuccess: (res) => {
      navigate({ to: "/exam/$attemptId", params: { attemptId: res.attemptId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
        </Link>

        {isLoading ? (
          <div className="text-muted-foreground">Loading course…</div>
        ) : !data ? null : (
          <>
            <div className="flex items-start gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <BookOpen className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <div className="font-mono text-sm text-muted-foreground">{data.course.code}</div>
                <h1 className="text-3xl font-bold">{data.course.title}</h1>
                {data.course.description && (
                  <p className="text-muted-foreground mt-2">{data.course.description}</p>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg">Start a new exam</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.questionCount} questions available · You'll get 30 randomly drawn questions.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => startMut.mutate(data.course.id)}
                  disabled={startMut.isPending || data.questionCount === 0}
                >
                  {startMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Start exam
                </Button>
              </div>
              {data.questionCount === 0 && (
                <p className="mt-3 text-sm text-destructive">
                  No questions yet for this course. Ask the admin to upload materials.
                </p>
              )}
            </div>

            <section className="mt-8">
              <h2 className="font-semibold text-lg mb-3">Your attempts</h2>
              {data.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attempts yet.</p>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Score</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attempts.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-4 py-3">{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "In progress"}</td>
                          <td className="px-4 py-3">
                            {a.score != null ? `${a.score}/${a.total}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {a.submitted_at ? (
                              <Link to="/results/$attemptId" params={{ attemptId: a.id }}>
                                <Button size="sm" variant="ghost">View</Button>
                              </Link>
                            ) : (
                              <Link to="/exam/$attemptId" params={{ attemptId: a.id }}>
                                <Button size="sm">Resume</Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
