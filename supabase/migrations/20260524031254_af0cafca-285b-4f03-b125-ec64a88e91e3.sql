
-- 1) Lock down profiles: own row + admin only
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Lock down questions: admin only (clients get questions via server fns using service role)
DROP POLICY IF EXISTS "Questions readable by authenticated" ON public.questions;

-- 3) Donations: remove public exposure of donor_name/amount/message; donor wall served via server fn
DROP POLICY IF EXISTS "Approved donations public" ON public.donations;

-- 4) Realtime chat: require auth on realtime.messages for chat-room topic
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read chat-room" ON realtime.messages;
CREATE POLICY "Authenticated can read chat-room" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (realtime.topic() = 'chat-room')
    AND (auth.uid() IS NOT NULL)
  );

-- 5) Revoke EXECUTE on SECURITY DEFINER functions from client roles
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 6) Notes storage bucket: prevent unauthenticated listing
DROP POLICY IF EXISTS "Public can read notes" ON storage.objects;
DROP POLICY IF EXISTS "Notes readable by all" ON storage.objects;
DROP POLICY IF EXISTS "Public read notes bucket" ON storage.objects;
CREATE POLICY "Authenticated can read notes objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notes');
