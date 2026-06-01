-- 1. tournament_winners: stop exposing payout_details + prize_amount to public/anon
DROP POLICY IF EXISTS "Winners readable by all" ON public.tournament_winners;
-- Keep admin-only access; public listings go through listAllTimeWinners server fn (service role, safe columns only)

-- 2. exam_attempts: grading is server-side via supabaseAdmin; users must not write score/submitted_at
DROP POLICY IF EXISTS "Users update own attempts" ON public.exam_attempts;

-- 3. tournament_attempts: same — server-side grading only
DROP POLICY IF EXISTS "Users update own tourney attempts" ON public.tournament_attempts;

-- 4. questions.correct_index: defense-in-depth column revoke.
-- The only SELECT policy on questions is admin-only, but explicitly deny the answer key
-- to authenticated/anon roles at the column-privilege layer in case a policy is ever added.
REVOKE SELECT (correct_index) ON public.questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.questions FROM anon;
-- service_role keeps full access (used by all exam/practice/tournament server fns)