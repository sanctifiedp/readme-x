import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Flame,
  Pin,
  PinOff,
  Play,
  Plus,
  Quote,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  addExtraCourse,
  getPersonalizedDashboard,
  pinCourse,
  removeExtraCourse,
  searchCoursesForAdd,
  unpinCourse,
} from "@/lib/dashboard.functions";
import { getRandomQuote } from "@/lib/quotes.functions";
import { useSessionUser } from "@/hooks/useSessionUser";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ReadMe" },
      { name: "description", content: "Your personalized study companion — pinned courses, XP, streaks, and recommendations." },
    ],
  }),
  component: Dashboard,
});

type Course = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  school?: string | null;
  department?: string | null;
  level?: string | null;
};

function CourseCard({
  course,
  action,
}: {
  course: Course;
  action?: React.ReactNode;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-[var(--shadow-glow)] transition flex flex-col gap-3">
      <Link
        to="/courses/$code"
        params={{ code: course.code }}
        className="flex items-start gap-3 flex-1 min-w-0"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{course.code}</div>
          <div className="font-semibold truncate">{course.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {[course.department, course.level].filter(Boolean).join(" · ")}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
      </Link>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function AddCourseDialog({
  onAdded,
  excludeIds,
}: {
  onAdded: () => void;
  excludeIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"carryover" | "elective" | "cross_level" | "other">("other");
  const searchFn = useServerFn(searchCoursesForAdd);
  const addFn = useServerFn(addExtraCourse);

  const { data: results, isFetching } = useQuery({
    queryKey: ["dash-add-search", q],
    queryFn: () => searchFn({ data: { q } }),
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: (courseId: string) => addFn({ data: { courseId, kind } }),
    onSuccess: () => {
      toast.success("Course added");
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-4 w-4" /> Add course
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a course</DialogTitle>
          <DialogDescription>
            Carry-over, elective, or a cross-level course you're taking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by code or title…"
                className="pl-9"
              />
            </div>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="carryover">Carry-over</SelectItem>
                <SelectItem value="elective">Elective</SelectItem>
                <SelectItem value="cross_level">Cross-level</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {isFetching ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">Searching…</div>
            ) : (results ?? []).length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No courses found.</div>
            ) : (
              (results ?? []).map((c) => {
                const already = excludeIds.has(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[c.department, c.level].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={already ? "ghost" : "default"}
                      disabled={already || addMut.isPending}
                      onClick={() => addMut.mutate(c.id)}
                    >
                      {already ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const session = useSessionUser();

  // Existing-user migration: nudge anyone missing profile essentials to onboarding.
  useEffect(() => {
    if (!session.userId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("username, school, department, level")
      .eq("id", session.userId)
      .maybeSingle()
      .then(({ data: p }) => {
        if (!alive || !p) return;
        if (!p.username || !p.school || !p.department || !p.level) {
          navigate({ to: "/onboarding" });
        }
      });
    return () => { alive = false; };
  }, [session.userId, navigate]);

  const fetchDash = useServerFn(getPersonalizedDashboard);
  const fetchQuote = useServerFn(getRandomQuote);
  const pinFn = useServerFn(pinCourse);
  const unpinFn = useServerFn(unpinCourse);
  const removeExtraFn = useServerFn(removeExtraCourse);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-v2"],
    queryFn: () => fetchDash(),
  });
  const { data: quote, refetch, isFetching } = useQuery({
    queryKey: ["dash-quote"],
    queryFn: () => fetchQuote(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dashboard-v2"] });

  const pinMut = useMutation({
    mutationFn: (courseId: string) => pinFn({ data: { courseId } }),
    onSuccess: () => { toast.success("Pinned"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpinMut = useMutation({
    mutationFn: (courseId: string) => unpinFn({ data: { courseId } }),
    onSuccess: () => { toast.success("Unpinned"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeExtraMut = useMutation({
    mutationFn: (courseId: string) => removeExtraFn({ data: { courseId } }),
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const profile = data?.profile;
  const excludeIds = new Set<string>([
    ...(data?.pinned.map((c) => c.id) ?? []),
    ...(data?.extra.map((c) => c.id) ?? []),
  ]);

  const combinedMine: Course[] = [
    ...(data?.pinned ?? []),
    ...(data?.extra ?? []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Welcome */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold break-words">
              Welcome{profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 break-words">
              {[profile?.school, profile?.department, profile?.level].filter(Boolean).join(" · ") ||
                "Add your school and department in Settings to unlock recommendations."}
            </p>
          </div>
          {data?.isAdmin && (
            <Link to="/admin" className="shrink-0">
              <Button variant="outline" className="w-full min-h-11 gap-2 md:w-auto">
                <ShieldCheck className="h-4 w-4" /> Admin panel
              </Button>
            </Link>
          )}
        </div>


        {/* Continue Exam */}
        {data?.unfinished && (
          <Link
            to="/exam/$attemptId"
            params={{ attemptId: data.unfinished.id }}
            className="block rounded-2xl border border-primary/40 bg-primary/5 p-5 hover:bg-primary/10 transition"
          >
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Play className="h-6 w-6" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wide text-primary font-semibold">Continue exam</div>
                <div className="font-semibold truncate">
                  {data.unfinished.courseCode} — {data.unfinished.courseTitle}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Question {Math.min(data.unfinished.currentIndex + 1, data.unfinished.total)} of {data.unfinished.total}
                  {data.unfinished.expiresAt && (
                    <> · expires {new Date(data.unfinished.expiresAt).toLocaleTimeString()}</>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary" />
            </div>
          </Link>
        )}

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

        {/* Today's Progress */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Today's progress</h2>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Today XP"
              value={`+${data?.todayXp ?? 0}`}
              sub={`Total ${profile?.xp ?? 0} XP`}
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Star className="h-4 w-4" />
                <span>ReadMe Level</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{profile?.readmeLevel ?? 1}</div>
              {profile && (
                <>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((profile.xp - profile.levelBaseXp) /
                              Math.max(1, profile.nextLevelXp - profile.levelBaseXp)) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {Math.max(0, profile.nextLevelXp - profile.xp)} XP to level {profile.readmeLevel + 1}
                  </div>
                </>
              )}
            </div>
            <StatCard
              icon={<Flame className="h-4 w-4" />}
              label="Streak"
              value={`${profile?.streak ?? 0} 🔥`}
              sub="Keep it going daily"
            />
            <StatCard
              icon={<Trophy className="h-4 w-4" />}
              label="Global rank"
              value={`#${data?.rank ?? "—"}`}
              sub="All-time XP"
            />

          </div>
        </section>

        {/* Performance insights */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Performance insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Weakest */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
                  <Target className="h-4 w-4" />
                </span>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Weakest subject</div>
              </div>
              {data?.weakest ? (
                <>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{data.weakest.code}</div>
                    <div className="font-semibold truncate">{data.weakest.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg score {data.weakest.average}%</div>
                  </div>
                  <Link to="/courses/$code" params={{ code: data.weakest.code }} className="mt-auto">
                    <Button size="sm" variant="outline" className="w-full">Practice now</Button>
                  </Link>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Complete a few exams to see the subject that needs the most attention.</div>
              )}
            </div>

            {/* Strongest */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Star className="h-4 w-4" />
                </span>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Strongest subject</div>
              </div>
              {data?.strongest ? (
                <>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{data.strongest.code}</div>
                    <div className="font-semibold truncate">{data.strongest.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Avg score {data.strongest.average}%</div>
                  </div>
                  <Link to="/courses/$code" params={{ code: data.strongest.code }} className="mt-auto">
                    <Button size="sm" variant="outline" className="w-full">Keep going</Button>
                  </Link>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Take a few exams to reveal your strongest area.</div>
              )}
            </div>

            {/* Recent performance */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Recent performance</div>
              </div>
              {data?.recent ? (
                <div className="space-y-1.5">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{data.recent.code}</div>
                    <div className="font-semibold truncate">{data.recent.title}</div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{data.recent.accuracy}%</span>
                    {data.recent.delta != null && (
                      <span className={`text-xs font-medium ${data.recent.delta >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {data.recent.delta >= 0 ? "▲" : "▼"} {Math.abs(data.recent.delta)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.recent.score}/{data.recent.total} correct · {data.totalAttempts ?? 0} exams · {data.totalQuestions ?? 0} questions answered
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Your last exam will appear here with score, accuracy and improvement.</div>
              )}
            </div>
          </div>
        </section>


        {/* My Courses (pinned + extras) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">My courses</h2>
              <p className="text-xs text-muted-foreground">Pinned favourites and courses you've added.</p>
            </div>
            <AddCourseDialog onAdded={invalidate} excludeIds={excludeIds} />
          </div>
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : combinedMine.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              Nothing here yet — pin a recommended course below or add a carry-over / elective.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.pinned ?? []).map((c) => (
                <CourseCard
                  key={`p-${c.id}`}
                  course={c}
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      onClick={() => unpinMut.mutate(c.id)}
                      disabled={unpinMut.isPending}
                    >
                      <PinOff className="h-3.5 w-3.5" /> Unpin
                    </Button>
                  }
                />
              ))}
              {(data?.extra ?? []).map((c) => (
                <CourseCard
                  key={`e-${c.id}`}
                  course={c}
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      onClick={() => removeExtraMut.mutate(c.id)}
                      disabled={removeExtraMut.isPending}
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Recommended */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Recommended for you</h2>
              <p className="text-xs text-muted-foreground">
                {profile?.school || profile?.department || profile?.level
                  ? "Based on your school, department, and level."
                  : "Set your academic details in Settings for personalized picks."}
              </p>
            </div>
            <Link to="/courses">
              <Button variant="ghost" size="sm">Browse all →</Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (data?.recommended ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No matching courses yet. Explore the full catalogue on the Practice page.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.recommended ?? []).map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => pinMut.mutate(c.id)}
                      disabled={pinMut.isPending}
                    >
                      <Pin className="h-3.5 w-3.5" /> Pin
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
