import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { startExamAttempt } from "@/lib/exams.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/take/$examId")({
  component: TakeExamPage,
});

function TakeExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const startFn = useServerFn(startExamAttempt);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const res = await startFn({ data: { examId } });
        navigate({ to: "/exam/$attemptId", params: { attemptId: res.attemptId } });
      } catch (e) {
        toast.error((e as Error).message);
        navigate({ to: "/exams" });
      }
    })();
  }, [examId, navigate, startFn]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Preparing your exam…</p>
        </div>
      </div>
    </div>
  );
}
