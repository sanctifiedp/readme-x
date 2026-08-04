import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/account.functions";
import { useSessionUser } from "@/hooks/useSessionUser";

export const MY_PROFILE_KEY = ["my-profile"] as const;

/**
 * Single source of truth for the signed-in user's profile (incl. avatar URL).
 * Every surface that renders the user's avatar reads this query, so invalidating
 * ["my-profile"] refreshes the avatar app-wide with no reload.
 */
export function useMyProfile() {
  const session = useSessionUser();
  const fetchProfile = useServerFn(getMyProfile);
  return useQuery({
    queryKey: MY_PROFILE_KEY,
    queryFn: () => fetchProfile(),
    enabled: !!session.userId,
    staleTime: 60_000,
  });
}
