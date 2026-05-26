-- Tournaments
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  target_school text NOT NULL,
  target_department text NOT NULL,
  target_level text NOT NULL,
  prize_amount numeric NOT NULL CHECK (prize_amount >= 0),
  min_participants integer NOT NULL DEFAULT 2 CHECK (min_participants >= 1),
  min_donation_pool numeric NOT NULL DEFAULT 0 CHECK (min_donation_pool >= 0),
  registration_open boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','cancelled')),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  question_count integer NOT NULL DEFAULT 20 CHECK (question_count BETWEEN 1 AND 70),
  duration_seconds integer NOT NULL DEFAULT 1800 CHECK (duration_seconds BETWEEN 60 AND 1800),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  winner_user_id uuid,
  winner_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments readable by all" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins manage tournaments" ON public.tournaments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Registrations
CREATE TABLE public.tournament_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own registrations" ON public.tournament_registrations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage registrations" ON public.tournament_registrations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
-- Insert is done via server fn with eligibility checks; allow direct user insert only matching uid
CREATE POLICY "Users insert own registration" ON public.tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Attempts
CREATE TABLE public.tournament_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_ids jsonb NOT NULL,
  score integer,
  wrong_count integer,
  duration_used_seconds integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL,
  UNIQUE (tournament_id, user_id)
);
ALTER TABLE public.tournament_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tourney attempts" ON public.tournament_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own tourney attempts" ON public.tournament_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tourney attempts" ON public.tournament_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Winners
CREATE TABLE public.tournament_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  prize_amount numeric NOT NULL,
  payout_status text NOT NULL DEFAULT 'pending_form' CHECK (payout_status IN ('pending_form','pending_approval','paid')),
  payout_details jsonb,
  decided_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);
ALTER TABLE public.tournament_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Winners readable by all" ON public.tournament_winners FOR SELECT USING (true);
CREATE POLICY "Winner updates own payout form" ON public.tournament_winners FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage winners" ON public.tournament_winners FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournament_attempts_t ON public.tournament_attempts(tournament_id);
CREATE INDEX idx_tournament_registrations_t ON public.tournament_registrations(tournament_id);