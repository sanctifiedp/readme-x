import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Swords, Check, X, Trophy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SiteHeader } from "@/components/SiteHeader";
import { listMyChallenges, respondToChallenge, createChallenge } from "@/lib/challenges.functions";
import { listFriends } from "@/lib/friends.functions";
import { listCoursesPublic } from "@/lib/courses.functions";

const searchSchema = z.object({ opponentId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges — ReadMe" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ChallengesPage,
});

function ChallengesPage() {
  const { opponentId } = Route.useSearch();
  const fetchFn = useServerFn(listMyChallenges);
  const { data, isLoading } = useQuery({ queryKey: ["challenges"], queryFn: () => fetchFn() });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Swords className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-3xl font-bold">1v1 Challenges</h1>
              <p className="text-sm text-muted-foreground">Race a friend on a course question bank.</p>
            </div>
          </div>
          <NewChallengeDialog defaultOpponentId={opponentId} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data?.challenges.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No challenges yet. Send one from your friends list or with the button above.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.challenges.map((c) => <ChallengeRow key={c.id} c={c} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function ChallengeRow({ c }: { c: any }) {
  const qc = useQueryClient();
  const respondFn = useServerFn(respondToChallenge);
  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") => respondFn({ data: { challengeId: c.id, action } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["challenges"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canPlay = (c.status === "accepted" || (c.status === "pending" && !c.isChallenger)) && !c.mySubmitted;
  const isFinished = c.status === "completed";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-mono text-muted-foreground">{c.course.code}</div>
          <div className="font-medium">{c.course.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            vs <span className="font-medium text-foreground">{c.other.full_name || c.other.email}</span>
            {" · "}{c.questionCount} questions · {Math.round(c.durationSeconds / 60)} min
          </div>
          {isFinished && (
            <div className="mt-2 text-sm inline-flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-primary" />
              {c.winnerUserId === null ? "Draw" :
                c.winnerUserId === c.other.id ? `${c.other.full_name || "Opponent"} won` : "You won"}
              <span className="text-muted-foreground">· You {c.myScore ?? "—"} / Opponent {c.opponentScore ?? "—"}</span>
            </div>
          )}
          {!isFinished && c.mySubmitted && (
            <div className="mt-1 text-xs text-muted-foreground">You submitted ({c.myScore}/{c.questionCount}). Waiting for opponent…</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.status === "pending" && !c.isChallenger && (
            <>
              <Button size="sm" onClick={() => respond.mutate("accept")} disabled={respond.isPending}>
                <Check className="h-3.5 w-3.5 mr-1" />Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond.mutate("decline")} disabled={respond.isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {c.status === "pending" && c.isChallenger && (
            <span className="text-xs text-muted-foreground">Awaiting response</span>
          )}
          {canPlay && c.status === "accepted" && (
            <Button size="sm" asChild>
              <Link to="/challenge/$challengeId" params={{ challengeId: c.id }}>
                <Play className="h-3.5 w-3.5 mr-1" />Play
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewChallengeDialog({ defaultOpponentId }: { defaultOpponentId?: string }) {
  const [open, setOpen] = useState(!!defaultOpponentId);
  const [opponentId, setOpponentId] = useState(defaultOpponentId ?? "");
  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(600);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchFriends = useServerFn(listFriends);
  const fetchCourses = useServerFn(listCoursesPublic);
  const createFn = useServerFn(createChallenge);

  const { data: friends } = useQuery({ queryKey: ["friends"], queryFn: () => fetchFriends(), enabled: open });
  const { data: courses } = useQuery({ queryKey: ["courses-public"], queryFn: () => fetchCourses({ data: {} }), enabled: open });

  const create = useMutation({
    mutationFn: () => createFn({ data: { opponentId, courseId, questionCount: count, durationSeconds: duration } }),
    onSuccess: () => {
      toast.success("Challenge sent");
      qc.invalidateQueries({ queryKey: ["challenges"] });
      setOpen(false);
      navigate({ to: "/challenges", search: {} });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Swords className="h-4 w-4 mr-2" />New challenge</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Challenge a friend</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Friend</Label>
            <Select value={opponentId} onValueChange={setOpponentId}>
              <SelectTrigger><SelectValue placeholder="Pick a friend" /></SelectTrigger>
              <SelectContent>
                {friends?.friends.map((f: any) => (
                  <SelectItem key={f.otherUser.id} value={f.otherUser.id}>
                    {f.otherUser.full_name || f.otherUser.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Pick a course" /></SelectTrigger>
              <SelectContent>
                {courses?.filter((c: any) => c.questionCount >= 5).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.title} ({c.questionCount} Qs)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Questions</Label>
              <Input type="number" min={5} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Minutes</Label>
              <Input type="number" min={1} max={60} value={Math.round(duration / 60)} onChange={(e) => setDuration(Number(e.target.value) * 60)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!opponentId || !courseId || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
