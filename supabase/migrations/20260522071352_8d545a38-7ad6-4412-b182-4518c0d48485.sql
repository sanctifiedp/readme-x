
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
-- Keep authenticated allowed (needed in RLS policies evaluated as the caller)
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
