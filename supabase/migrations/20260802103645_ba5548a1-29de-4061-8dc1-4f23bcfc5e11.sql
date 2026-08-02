create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  if uname is not null and exists (select 1 from public.profiles p where p.username = uname::citext) then
    uname := null;
  end if;

  insert into public.profiles (id, email, full_name, matric_no, school, faculty, department, level, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'matric_no', ''),
    nullif(new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'faculty', ''),
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'level', ''),
    uname::citext
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  if lower(new.email) = 'adeyigbeminiyi414@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  end if;
  return new;
end;
$$;