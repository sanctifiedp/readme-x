import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, Users, Calendar } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { listTournaments, listAllTimeWinners, getPoolStatus } from "@/lib/tournaments.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — ReadMe" },
      { name: "description", content: "Compete against students in your school, department, and level. Win cash prizes funded by donations." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const listFn = useServerFn(listTournaments);
  const winnersFn = useServerFn(listAllTimeWinners);
  const poolFn = useServerFn(getPoolStatus);
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: winners } = useQuery({ queryKey: ["all-winners"], queryFn: () => winnersFn() });
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => poolFn() });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
            <p className="text-muted-foreground mt-1">Compete in your school, department and level. Winners are paid from the donation pool.</p>
          </div>
        </div>

        {pool && (
          <div className="mt-5 rounded-xl border border-border bg-card p-4 text-sm flex flex-wrap gap-x-6 gap-y-2">
            <span><span className="text-muted-foreground">Donation pool:</span> <span className="font-semibold">₦{pool.available.toLocaleString()}</span></span>
            <span className="text-muted-foreground">Donated all-time: ₦{pool.donated.toLocaleString()}</span>
            <span className="text-muted-foreground">Paid out: ₦{pool.paid.toLocaleString()}</span>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground italic">
          Competitions are funded by donations, and winners are paid from this pool.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Open & upcoming</h2>
        <div className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (tournaments?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No tournaments yet. Check back soon.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tournaments!.map((t) => (
                <Link key={t.id} to="/tournaments/$id" params={{ id: t.id }} className="block">
                  <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{t.title}</h3>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.target_school} · {t.target_department} · Level {t.target_level}
                        </div>
                      </div>
                      <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
                    </div>
                    <div className="mt-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                      <span><Trophy className="inline h-3.5 w-3.5 mr-1 text-primary" />₦{Number(t.prize_amount).toLocaleString()}</span>
                      <span className="text-muted-foreground">{t.question_count} Qs · {Math.round(t.duration_seconds / 60)}m</span>
                      {t.courses?.code && <span className="font-mono text-xs text-muted-foreground">{t.courses.code}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <h2 className="mt-10 text-xl font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> All-time winners</h2>
        <div className="mt-3 rounded-xl border border-border bg-card divide-y divide-border">
          {(winners?.length ?? 0) === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No winners yet — be the first.</div>
          ) : (
            winners!.map((w) => (
              <div key={w.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{w.winner_name ?? "Winner"}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.tournaments?.title} · {w.tournaments?.courses?.code}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₦{Number(w.prize_amount).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{new Date(w.decided_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
