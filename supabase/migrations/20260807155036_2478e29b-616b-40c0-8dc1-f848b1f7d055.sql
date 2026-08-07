-- Revoke direct EXECUTE on privileged SECURITY DEFINER functions from API roles.
-- These are only invoked by trusted server-side code (service_role) or as triggers.

REVOKE ALL ON FUNCTION public.award_xp(uuid, text, integer, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.bump_streak(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.leaderboard(text, text, text, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.enforce_academic_change_cooldown() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.enforce_question_cap() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_streak(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.leaderboard(text, text, text, integer) TO service_role;

-- has_role must stay executable: it is referenced inside RLS policies evaluated as the caller.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;