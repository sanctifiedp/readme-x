import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Quote, RefreshCw, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { getDashboard, listCourses } from "@/lib/exam.functions";
import { getRandomQuote } from "@/lib/quotes.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ReadMe" },
      { name: "description", content: "Your courses, past attempts, and daily inspiration." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchDash = useServerFn(getDashboard);
  const fetchQuote = useServerFn(getRandomQuote);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash() });
  const { data: quote, refetch, isFetching } = useQuery({ queryKey: ["dash-quote"], queryFn: () => fetchQuote() });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome{data?.profile?.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data?.profile?.matric_no ? `Matric: ${data.profile.matric_no}` : "Ready to study?"}
            </p>
          </div>
          {data?.isAdmin && (
            <Link to="/admin">
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Admin panel
              </Button>
            </Link>
          )}
        </div>

        {/* Quote */}
        <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
          <div className="flex items-start gap-3">
            <Quote className="h-5 w-5 mt-1 opacity-80" />
            <div className="flex-1">
              <p className="text-lg md:text-xl font-medium">"{quote?.text ?? "Loading…"}"</p>
              <p className="text-sm opacity-80 mt-2">— {quote?.author ?? ""}</p>
            </div>
            <button onClick={() => refetch()} className="p-2 rounded-full hover:bg-white/10" aria-label="New quote">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Courses */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Your courses</h2>
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : data?.courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No courses available yet. Ask the admin to add a course.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.courses.map((c) => (
                <Link
                  key={c.id}
                  to="/courses/$code"
                  params={{ code: c.code }}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-primary hover:shadow-[var(--shadow-glow)] transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                      <div className="font-semibold truncate">{c.title}</div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent attempts */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent attempts</h2>
          {data?.attempts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No attempts yet. Pick a course above to start.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Course</th>
                    <th className="text-left px-4 py-3">Score</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.attempts.map((a) => {
                    const pct = a.score != null && a.total ? Math.round((a.score / a.total) * 100) : 0;
                    return (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted-foreground">{a.courseCode}</div>
                          <div className="font-medium">{a.courseTitle}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${pct >= 50 ? "text-success" : "text-destructive"}`}>
                            {a.score}/{a.total}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">({pct}%)</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to="/results/$attemptId" params={{ attemptId: a.id }}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
