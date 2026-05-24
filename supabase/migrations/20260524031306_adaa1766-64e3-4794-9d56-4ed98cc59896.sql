
UPDATE storage.buckets SET public = false WHERE id = 'notes';
DROP POLICY IF EXISTS "Authenticated can read notes objects" ON storage.objects;
CREATE POLICY "Authenticated can read individual notes objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notes' AND name IS NOT NULL);
