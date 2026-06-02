ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;