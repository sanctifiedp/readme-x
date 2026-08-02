import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Timer, ListChecks, Play, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { getCoursePublic } from "@/lib/courses.functions";
import { startPractice } from "@/lib/practice.functions";
import { useSessionUser } from "@/hooks/useSessionUser";

export const Route = createFileRoute("/practice/$courseId")({
  head: () => ({
    meta: [
      { title: "Start practice — ReadMe" },
      { name: "description", content: "Set your question count and timer, then start a ReadMe practice exam — no account required." },
      { property: "og:title", content: "Start practice — ReadMe" },
      { property: "og:description", content: "Take a timed CBT practice exam instantly on ReadMe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PracticeSetup,
});

export const GUEST_CONFIG_PREFIX = "readme:guest-exam:";

function PracticeSetup() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getCoursePublic);
  const startFn = useServerFn(startPractice);
  const session = useSessionUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ["course-public", courseId],
    queryFn: () => getFn({ data: { courseId } }),
    retry: false,
  });

  const max = data?.questionCount ?? 70;
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(15);

  const savesProgress = !!session.userId && session.verified;

  const startMut = useMutation({
    mutationFn: async () => {
      const cfg = { count: Math.min(count, max || 1), minutes };
      if (savesProgress) {
        const res = await startFn({ data: { courseId, ...cfg } });
        return { kind: "saved" as const, attemptId: res.attemptId };
      }
      sessionStorage.setItem(GUEST_CONFIG_PREFIX + courseId, JSON.stringify(cfg));
      return { kind: "guest" as const };
    },
    onSuccess: (res) => {
      if (res.kind === "saved") navigate({ to: "/exam/$attemptId", params: { attemptId: res.attemptId } });
      else navigate({ to: "/guest-exam/$courseId", params: { courseId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl space-y-6">
        <Link to="/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to courses
        </Link>

        <div>
          <div className="font-mono text-xs text-muted-foreground">{data!.code}</div>
          <h1 className="text-3xl font-bold">{data!.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data!.questionCount} questions in the bank · {[data!.school, data!.department, data!.level && `Level ${data!.level}`].filter(Boolean).join(" · ")}
          </p>
        </div>

        {!session.loading && !savesProgress && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm flex items-start gap-2">
            <UserCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span>
              {session.userId
                ? "Your email isn't verified yet, so this session won't be saved and won't earn XP or badges. You can still practise fully."
                : "You're practising as a guest — full exam access, but results, XP and badges aren't saved."}{" "}
              <Link to="/auth" className="text-primary font-medium hover:underline">
                {session.userId ? "Verify to save progress" : "Create a free account"}
              </Link>
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-semibold">Set up your practice</h2>

          <div className="space-y-1.5">
            <Label htmlFor="count" className="flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Number of questions (max 70)</Label>
            <Input id="count" type="number" min={1} max={Math.min(70, max)} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(70, Number(e.target.value) || 1)))} />
            <p className="text-xs text-muted-foreground">
              {Math.min(count, max)} random questions will be drawn from the {max}-question bank.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minutes" className="flex items-center gap-1.5"><Timer className="h-4 w-4" /> Time limit (max 30 minutes)</Label>
            <Input id="minutes" type="number" min={1} max={30} value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            <p className="text-xs text-muted-foreground">The exam will auto-submit when the timer hits zero.</p>
          </div>

          <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || max === 0} size="lg" className="w-full">
            {startMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Start practice
          </Button>
        </div>
      </main>
    </div>
  );
}
