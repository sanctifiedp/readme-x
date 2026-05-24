
-- 2. Backfill super_admin role for owner if account exists
insert into public.user_roles (user_id, role)
select p.id, 'super_admin'::public.app_role
from public.profiles p
where lower(p.email) = 'adeyigbeminiyi414@gmail.com'
on conflict do nothing;

-- Also ensure owner has admin role
insert into public.user_roles (user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where lower(p.email) = 'adeyigbeminiyi414@gmail.com'
on conflict do nothing;

-- 3. Update handle_new_user trigger to grant super_admin to owner email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, matric_no, school, department, level)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'matric_no', ''),
    nullif(new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'level', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  if lower(new.email) = 'adeyigbeminiyi414@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  end if;
  return new;
end;
$function$;

-- 4. Tighten user_roles: only super_admins can insert/update/delete
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Super admins manage roles"
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

-- 5. Chat rooms
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.chat_rooms enable row level security;

create policy "Rooms readable by authenticated"
on public.chat_rooms
for select
to authenticated
using (true);

create policy "Admins manage rooms"
on public.chat_rooms
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Seed default room
insert into public.chat_rooms (id, name, description)
values ('00000000-0000-0000-0000-000000000001', 'General', 'Default class chat room')
on conflict (id) do nothing;

-- 6. Add room_id to chat_messages
alter table public.chat_messages
  add column if not exists room_id uuid references public.chat_rooms(id) on delete cascade;

update public.chat_messages
  set room_id = '00000000-0000-0000-0000-000000000001'
  where room_id is null;

alter table public.chat_messages alter column room_id set not null;
alter table public.chat_messages alter column room_id set default '00000000-0000-0000-0000-000000000001';

create index if not exists chat_messages_room_id_created_at_idx
  on public.chat_messages (room_id, created_at);

-- 7. Admin moderation: allow admins to delete any chat message
drop policy if exists "Admins delete any message" on public.chat_messages;
create policy "Admins delete any message"
on public.chat_messages
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- 8. Realtime
alter publication supabase_realtime add table public.chat_rooms;
