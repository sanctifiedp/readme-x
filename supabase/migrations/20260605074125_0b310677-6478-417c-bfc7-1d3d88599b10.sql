
-- 1) tournament_winners: dedupe admin policy, add user-can-read-own + super_admin
DROP POLICY IF EXISTS "Admins manage tournament winners" ON public.tournament_winners;
DROP POLICY IF EXISTS "Admins manage winners" ON public.tournament_winners;

CREATE POLICY "Admins and super admins manage winners"
ON public.tournament_winners
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users read own winner row"
ON public.tournament_winners
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) challenge_attempts: only own row visible until challenge completed
DROP POLICY IF EXISTS "Users read own challenge attempts" ON public.challenge_attempts;

CREATE POLICY "Users read own attempt or both after completion"
ON public.challenge_attempts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_attempts.challenge_id
      AND c.status = 'completed'
      AND (c.challenger_id = auth.uid() OR c.opponent_id = auth.uid())
  )
);

-- 3) friendships: lock down what UPDATE can change
DROP POLICY IF EXISTS "Users update own friendships" ON public.friendships;

CREATE POLICY "Addressee can accept or decline pending request"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id AND status = 'pending')
WITH CHECK (
  auth.uid() = addressee_id
  AND status IN ('accepted','declined')
  AND requester_id = (SELECT f.requester_id FROM public.friendships f WHERE f.id = friendships.id)
  AND addressee_id = (SELECT f.addressee_id FROM public.friendships f WHERE f.id = friendships.id)
);
