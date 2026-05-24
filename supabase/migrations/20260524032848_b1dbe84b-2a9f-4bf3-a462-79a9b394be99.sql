
-- 1. Donations: ensure user_id is not null on insert
DROP POLICY IF EXISTS "Users insert own donations" ON public.donations;
CREATE POLICY "Users insert own donations"
ON public.donations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 2. Remove any public read policies on notes storage bucket
DROP POLICY IF EXISTS "Notes files public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read notes" ON storage.objects;
DROP POLICY IF EXISTS "Notes public read" ON storage.objects;

-- 3. Restrict notes table direct reads to authenticated users
-- Public notes listing is served via the listNotes server function (supabaseAdmin)
DROP POLICY IF EXISTS "Notes readable by all" ON public.notes;
CREATE POLICY "Notes readable by authenticated"
ON public.notes
FOR SELECT
TO authenticated
USING (true);
