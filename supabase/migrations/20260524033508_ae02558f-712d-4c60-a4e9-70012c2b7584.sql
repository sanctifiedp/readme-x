
-- 1. Extend role enum with super_admin
alter type public.app_role add value if not exists 'super_admin';
