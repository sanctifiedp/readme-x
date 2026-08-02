import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MailWarning, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/useSessionUser";

const DISMISS_KEY = "readme:verify-banner-dismissed";

/**
 * Persistent (but non-blocking) reminder for signed-in users who have not
 * confirmed their email yet.
 */
export function VerifyEmailBanner() {
  const { loading, userId, email, verified } = useSessionUser();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });
  const [sending, setSending] = useState(false);

  if (loading || !userId || verified || dismissed) return null;

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent. Check your inbox.");
  };

  return (
    <div className="w-full border-b border-warning/30 bg-warning/10">
      <div className="container mx-auto flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <MailWarning className="h-4 w-4 shrink-0 text-warning" />
        <span className="flex-1 min-w-[12rem]">
          Verify your email to unlock XP, badges, streaks, leaderboards and saved exam history.
          You can keep practising in the meantime.
        </span>
        <button
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-medium hover:bg-accent disabled:opacity-60"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resend email
        </button>
        <Link
          to="/onboarding"
          className="rounded-md px-2.5 py-1 font-medium text-primary hover:underline"
        >
          Complete profile
        </Link>
        <button
          aria-label="Dismiss verification reminder"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
