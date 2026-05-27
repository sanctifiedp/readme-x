
CREATE TABLE IF NOT EXISTS public.course_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, DELETE ON public.course_bookmarks TO authenticated;
GRANT ALL ON public.course_bookmarks TO service_role;

ALTER TABLE public.course_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bookmarks" ON public.course_bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bookmarks" ON public.course_bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own bookmarks" ON public.course_bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_course_bookmarks_user ON public.course_bookmarks(user_id);
