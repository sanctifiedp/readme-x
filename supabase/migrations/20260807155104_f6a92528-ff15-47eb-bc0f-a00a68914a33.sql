-- has_role is only needed by RLS policies that target the authenticated role.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;