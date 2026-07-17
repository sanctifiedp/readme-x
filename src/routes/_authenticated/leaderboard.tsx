import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Trophy, Loader2, Crown, Medal } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLeaderboard, getLeaderboardFilters } from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboards — ReadMe" },
      { name: "description", content: "Global, school, department and course XP leaderboards on ReadMe." },
    ],
  }),
  component: LeaderboardPage,
});

type Scope = "global" | "school" | "faculty" | "department" | "level" | "course";
type Window = "weekly" | "monthly" | "all";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function rankBadge(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return null;
}

function LeaderboardPage() {
  const fetchFilters = useServerFn(getLeaderboardFilters);
  const fetchLb = useServerFn(getLeaderboard);

  const { data: filtersData } = useQuery({
    queryKey: ["lb-filters"],
    queryFn: () => fetchFilters(),
  });

  const [scope, setScope] = useState<Scope>("global");
  const [win, setWin] = useState<Window>("all");
  const [courseId, setCourseId] = useState<string | undefined>(undefined);

  const scopeValue = useMemo(() => {
    if (scope === "school") return filtersData?.profile?.school ?? undefined;
    if (scope === "faculty") return filtersData?.profile?.faculty ?? undefined;
    if (scope === "department") return filtersData?.profile?.department ?? undefined;
    if (scope === "level") return filtersData?.profile?.level ?? undefined;
    if (scope === "course") return courseId;
    return undefined;
  }, [scope, filtersData, courseId]);

  const { data: rows, isFetching } = useQuery({
    queryKey: ["lb", scope, scopeValue ?? null, win],
    queryFn: () => fetchLb({ data: { scope, scopeValue, window: win, limit: 50 } }),
    enabled: scope === "global" || !!scopeValue,
  });

  const scopeLabel: Record<Scope, string> = {
    global: "Global",
    school: filtersData?.profile?.school ? `School · ${filtersData.profile.school}` : "School",
    faculty: filtersData?.profile?.faculty ? `Faculty · ${filtersData.profile.faculty}` : "Faculty",
    department: filtersData?.profile?.department ? `Department · ${filtersData.profile.department}` : "Department",
    level: filtersData?.profile?.level ? `Level · ${filtersData.profile.level}` : "Level",
    course: "Course",
  };

  const needsProfileValue =
    (scope === "school" && !filtersData?.profile?.school) ||
    (scope === "faculty" && !filtersData?.profile?.faculty) ||
    (scope === "department" && !filtersData?.profile?.department) ||
    (scope === "level" && !filtersData?.profile?.level);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-start gap-3 mb-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Leaderboards</h1>
            <p className="text-muted-foreground text-sm">
              Rankings by XP — earn XP by completing exams, scoring high, and keeping your streak alive.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 mb-6 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold">Scope</label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="school">My school</SelectItem>
                <SelectItem value="faculty">My faculty</SelectItem>
                <SelectItem value="department">My department</SelectItem>
                <SelectItem value="level">My level</SelectItem>
                <SelectItem value="course">By course</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground font-semibold">Window</label>
            <Select value={win} onValueChange={(v) => setWin(v as Window)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="all">All-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "course" && (
            <div>
              <label className="text-xs uppercase text-muted-foreground font-semibold">Course</label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Pick a course" /></SelectTrigger>
                <SelectContent>
                  {(filtersData?.courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {needsProfileValue ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Add your {scope} in <Link to="/settings" className="text-primary underline">Settings</Link> to see this leaderboard.
          </div>
        ) : scope === "course" && !courseId ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Pick a course above.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold">{scopeLabel[scope]}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {win === "all" ? "All-time" : win}
              </div>
            </div>
            {isFetching ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !rows || rows.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                No XP recorded yet in this range.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 text-center font-mono text-sm text-muted-foreground flex items-center justify-center gap-1">
                      {rankBadge(Number(r.rank)) ?? `#${r.rank}`}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.avatar_url ?? undefined} alt={r.full_name ?? ""} />
                      <AvatarFallback className="text-xs">{initials(r.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      {r.username ? (
                        <Link to="/u/$username" params={{ username: r.username }} className="font-medium truncate hover:text-primary block">
                          {r.full_name || `@${r.username}`}
                        </Link>
                      ) : (
                        <div className="font-medium truncate">{r.full_name || "Anonymous"}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[r.school, r.department, r.level].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{r.xp}</div>
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">XP</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
