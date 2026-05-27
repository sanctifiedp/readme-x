
-- Drop overly broad policies on tournament_winners
DROP POLICY IF EXISTS "All time winners are publicly viewable" ON public.tournament_winners;
DROP POLICY IF EXISTS "Anyone can view tournament winners" ON public.tournament_winners;
DROP POLICY IF EXISTS "Public can view tournament winners" ON public.tournament_winners;
DROP POLICY IF EXISTS "Winner updates own payout form" ON public.tournament_winners;
DROP POLICY IF EXISTS "Winners update own payout form" ON public.tournament_winners;

-- Keep admin-only direct access; all reads/writes flow through server functions using the service role.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tournament_winners' AND policyname='Admins manage tournament winners'
  ) THEN
    CREATE POLICY "Admins manage tournament winners"
      ON public.tournament_winners
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
