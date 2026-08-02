import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-side source of truth for email verification.
 * Never trust a client-supplied "verified" flag.
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  return !!data.user.email_confirmed_at;
}

export async function assertEmailVerified(userId: string): Promise<void> {
  const ok = await isEmailVerified(userId);
  if (!ok) {
    throw new Error(
      "Verify your email to unlock saved progress. You can still practice instantly as a guest.",
    );
  }
}
