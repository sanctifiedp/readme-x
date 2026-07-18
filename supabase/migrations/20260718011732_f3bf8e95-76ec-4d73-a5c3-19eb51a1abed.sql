
-- 1) Enable RLS on device_fingerprints (service-role only access)
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- 2) Restrict profiles: drop overly permissive public-read policy
DROP POLICY IF EXISTS "profiles public read basic" ON public.profiles;

-- 3) Restrict user_badges to owner + admins
DROP POLICY IF EXISTS "user_badges public read" ON public.user_badges;
CREATE POLICY "Users read own badges" ON public.user_badges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4) Fix search_path on readme_level
CREATE OR REPLACE FUNCTION public.readme_level(_xp integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  select greatest(1, floor(sqrt(greatest(_xp,0)::numeric / 50))::int + 1)
$function$;

-- 5) Revoke EXECUTE on SECURITY DEFINER functions that don't need public/authenticated access.
-- has_role() is used in RLS policies (invoked by the querying role) so authenticated must retain EXECUTE.
REVOKE ALL ON FUNCTION public.award_xp(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leaderboard(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_question_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
