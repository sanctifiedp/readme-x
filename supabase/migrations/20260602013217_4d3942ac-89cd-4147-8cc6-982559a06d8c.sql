
-- =========================
-- FRIENDSHIPS
-- =========================
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending|accepted|declined
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT friendship_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendship_status_chk CHECK (status IN ('pending','accepted','declined'))
);

-- canonical-pair uniqueness so A↔B never has two rows
CREATE UNIQUE INDEX friendships_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_requester_idx ON public.friendships(requester_id);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users send requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users update own friendships"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users delete own friendships"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- =========================
-- CHALLENGES (1v1 quiz)
-- =========================
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  course_id uuid NOT NULL,
  question_count int NOT NULL DEFAULT 10,
  duration_seconds int NOT NULL DEFAULT 600,
  status text NOT NULL DEFAULT 'pending',  -- pending|accepted|declined|completed|expired
  question_ids jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  winner_user_id uuid,
  CONSTRAINT challenge_no_self CHECK (challenger_id <> opponent_id),
  CONSTRAINT challenge_status_chk CHECK (status IN ('pending','accepted','declined','completed','expired')),
  CONSTRAINT challenge_qcount_chk CHECK (question_count BETWEEN 5 AND 30),
  CONSTRAINT challenge_duration_chk CHECK (duration_seconds BETWEEN 60 AND 3600)
);
CREATE INDEX challenges_challenger_idx ON public.challenges(challenger_id);
CREATE INDEX challenges_opponent_idx ON public.challenges(opponent_id);
CREATE INDEX challenges_status_idx ON public.challenges(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Reads/writes all happen via server fns w/ supabaseAdmin; keep RLS strict for direct access.
CREATE POLICY "Participants read own challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- =========================
-- CHALLENGE ATTEMPTS (one row per participant)
-- =========================
CREATE TABLE public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score int,
  wrong int,
  answers jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL,
  UNIQUE (challenge_id, user_id)
);
CREATE INDEX challenge_attempts_user_idx ON public.challenge_attempts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_attempts TO authenticated;
GRANT ALL ON public.challenge_attempts TO service_role;

ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own challenge attempts"
  ON public.challenge_attempts FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_attempts.challenge_id
        AND (c.challenger_id = auth.uid() OR c.opponent_id = auth.uid())
    )
  );

-- =========================
-- SCHOOLS & DEPARTMENTS lookup
-- =========================
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE INDEX departments_school_idx ON public.departments(school_id);

GRANT SELECT ON public.schools TO anon, authenticated;
GRANT ALL ON public.schools TO service_role;
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools readable by all"
  ON public.schools FOR SELECT TO public USING (true);
CREATE POLICY "Departments readable by all"
  ON public.departments FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage schools"
  ON public.schools FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
