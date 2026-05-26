import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trophy, Users, Calendar, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getTournament,
  registerForTournament,
  startTournamentAttempt,
  listMyTournamentState,
} from "@/lib/tournaments.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/tournaments/$id")({
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchT = useServerFn(getTournament);
  const fetchMine = useServerFn(listMyTournamentState);
  const registerFn = useServerFn(registerForTournament);
  const startFn = useServerFn(startTournamentAttempt);

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => fetchT({ data: { id } }),
  });
  const { data: mine } = useQuery({
    queryKey: ["tournament-mine", id, isAuthed],
    queryFn: () => fetchMine({ data: { id } }),
    enabled: !!isAuthed,
  });

  const registerMut = useMutation({
    mutationFn: () => registerFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Registered! You can now start when ready.");
      qc.invalidateQueries({ queryKey: ["tournament-mine", id] });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const startMut = useMutation({
    mutationFn: () => startFn({ data: { id } }),
    onSuccess: (r) => navigate({ to: "/tournament/$attemptId", params: { attemptId: r.attemptId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  const t = data.tournament;
  const closed = t.status === "completed" || t.status === "cancelled";
  const poolOk = data.pool.available >= Number(t.prize_amount);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/tournaments" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> All tournaments
        </Link>

        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{t.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t.target_school} · {t.target_department} · Level {t.target_level}
              </p>
            </div>
            <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
          </div>

          {t.description && <p className="mt-4 text-sm leading-relaxed">{t.description}</p>}

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Prize" value={`₦${Number(t.prize_amount).toLocaleString()}`} />
            <Stat label="Questions" value={`${t.question_count}`} />
            <Stat label="Time" value={`${Math.round(t.duration_seconds / 60)} min`} />
            <Stat label="Registered" value={`${data.registrationCount}`} />
          </div>

          <p className="mt-4 text-xs text-muted-foreground italic">
            Competitions are funded by donations, and winners are paid from this pool.
            {!poolOk && " The pool currently can't cover this prize — please donate to help unlock it."}
          </p>

          <div className="mt-6 flex gap-3 flex-wrap">
            {!isAuthed ? (
              <Link to="/auth"><Button>Sign in to register</Button></Link>
            ) : closed ? (
              <Badge variant="outline">Tournament closed</Badge>
            ) : mine?.attempt ? (
              mine.attempt.submitted_at ? (
                <Badge variant="outline">You've submitted — score {mine.attempt.score}</Badge>
              ) : (
                <Button onClick={() => navigate({ to: "/tournament/$attemptId", params: { attemptId: mine.attempt!.id } })}>
                  Resume attempt
                </Button>
              )
            ) : !mine?.registered ? (
              <Button onClick={() => registerMut.mutate()} disabled={registerMut.isPending || !t.registration_open}>
                {registerMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.registration_open ? "Register" : "Registration closed"}
              </Button>
            ) : (
              <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || !poolOk}>
                {startMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Start now
              </Button>
            )}
          </div>
        </div>

        {data.winner && (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Trophy className="h-5 w-5" /> Winner
            </div>
            <p className="mt-2">{data.winner.profiles?.full_name ?? "Winner"} · ₦{Number(data.winner.prize_amount).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Status: {data.winner.payout_status.replace("_", " ")}</p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
