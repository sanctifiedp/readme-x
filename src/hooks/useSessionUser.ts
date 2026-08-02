import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  verified: boolean;
};

/** Client-side session snapshot. Server functions still re-verify everything. */
export function useSessionUser(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    userId: null,
    email: null,
    verified: false,
  });

  useEffect(() => {
    let alive = true;
    const apply = (user: { id: string; email?: string | null; email_confirmed_at?: string | null } | null) => {
      if (!alive) return;
      setState({
        loading: false,
        userId: user?.id ?? null,
        email: user?.email ?? null,
        verified: !!user?.email_confirmed_at,
      });
    };
    supabase.auth.getUser().then(({ data }) => apply(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
