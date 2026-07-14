
-- Batch A: ReadMe V2.0 foundation (additive only)

create extension if not exists citext;

-- ============ profiles: identity + gamification ============
alter table public.profiles add column if not exists username citext;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists faculty text;
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists streak_count integer not null default 0;
alter table public.profiles add column if not exists streak_last_day date;

-- Backfill usernames from email prefix, ensuring uniqueness
do $$
declare r record; base text; candidate text; n int;
begin
  for r in select id, email from public.profiles where username is null loop
    base := lower(regexp_replace(coalesce(split_part(r.email,'@',1),'user'), '[^a-z0-9_]', '', 'g'));
    if length(base) < 3 then base := base || 'user'; end if;
    if length(base) > 18 then base := substring(base,1,18); end if;
    candidate := base;
    n := 0;
    while exists(select 1 from public.profiles where username = candidate::citext) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;
    update public.profiles set username = candidate::citext where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_username_key on public.profiles (username);
alter table public.profiles
  add constraint profiles_username_format check (
    username is null or username ~ '^[A-Za-z0-9_]{3,20}$'
  ) not valid;
alter table public.profiles validate constraint profiles_username_format;

-- ============ courses: extra academic fields ============
alter table public.courses add column if not exists faculty text;
alter table public.courses add column if not exists semester text;
alter table public.courses add column if not exists academic_level text;
-- backfill academic_level from existing level
update public.courses set academic_level = level where academic_level is null and level is not null;

-- ============ pinned + extra courses ============
create table if not exists public.pinned_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  unique (user_id, course_id)
);
grant select, insert, update, delete on public.pinned_courses to authenticated;
grant all on public.pinned_courses to service_role;
alter table public.pinned_courses enable row level security;
create policy "own pins select" on public.pinned_courses for select to authenticated using (auth.uid() = user_id);
create policy "own pins write" on public.pinned_courses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_extra_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null default 'extra' check (kind in ('carryover','elective','extra')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
grant select, insert, update, delete on public.user_extra_courses to authenticated;
grant all on public.user_extra_courses to service_role;
alter table public.user_extra_courses enable row level security;
create policy "own extra select" on public.user_extra_courses for select to authenticated using (auth.uid() = user_id);
create policy "own extra write" on public.user_extra_courses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ badges ============
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.badges to authenticated, anon;
grant all on public.badges to service_role;
alter table public.badges enable row level security;
create policy "badges public read" on public.badges for select using (true);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
grant select on public.user_badges to authenticated;
grant all on public.user_badges to service_role;
alter table public.user_badges enable row level security;
create policy "user_badges public read" on public.user_badges for select to authenticated using (true);

-- Seed default badges
insert into public.badges (code, name, description, icon) values
  ('first_mock','First Mock Exam','Complete your first mock exam.','Sparkles'),
  ('perfect_score','Perfect Score','Score 100% on a mock exam.','Trophy'),
  ('streak_7','7-Day Streak','Study 7 days in a row.','Flame'),
  ('fifty_exams','50 Exams Completed','Complete 50 mock exams.','Target')
on conflict (code) do nothing;

-- ============ XP events ledger ============
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  kind text not null,
  amount integer not null,
  created_at timestamptz not null default now()
);
create index if not exists xp_events_user_created_idx on public.xp_events (user_id, created_at desc);
create index if not exists xp_events_course_idx on public.xp_events (course_id, created_at desc);
grant select on public.xp_events to authenticated;
grant all on public.xp_events to service_role;
alter table public.xp_events enable row level security;
create policy "own xp select" on public.xp_events for select to authenticated using (auth.uid() = user_id);

-- ============ exam_attempts: resume support ============
alter table public.exam_attempts add column if not exists current_index integer not null default 0;
alter table public.exam_attempts add column if not exists last_activity_at timestamptz not null default now();

-- ============ helper functions ============
create or replace function public.readme_level(_xp integer)
returns integer language sql immutable as $$
  select greatest(1, floor(sqrt(greatest(_xp,0)::numeric / 50))::int + 1)
$$;

create or replace function public.award_xp(_user_id uuid, _kind text, _amount integer, _course_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _amount is null or _amount = 0 then return; end if;
  insert into public.xp_events(user_id, course_id, kind, amount) values (_user_id, _course_id, _kind, _amount);
  update public.profiles set xp = coalesce(xp,0) + _amount where id = _user_id;
end $$;

create or replace function public.bump_streak(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare last_day date; today date := (now() at time zone 'utc')::date; new_count int;
begin
  select streak_last_day into last_day from public.profiles where id = _user_id;
  if last_day = today then return; end if;
  if last_day = today - 1 then
    update public.profiles set streak_count = coalesce(streak_count,0) + 1, streak_last_day = today where id = _user_id
      returning streak_count into new_count;
  else
    update public.profiles set streak_count = 1, streak_last_day = today where id = _user_id;
  end if;
end $$;

-- Leaderboard RPC: aggregate XP by scope & window, return public profile fields only
create or replace function public.leaderboard(
  _scope text default 'global',      -- global | school | faculty | department | level | course
  _scope_value text default null,    -- e.g. school name, dept name, level, or course_id::text
  _window text default 'all',        -- weekly | monthly | all
  _limit int default 50
) returns table (
  user_id uuid, username text, full_name text, avatar_url text,
  school text, department text, level text, xp bigint, rank bigint
)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz;
begin
  since := case _window
    when 'weekly' then now() - interval '7 days'
    when 'monthly' then now() - interval '30 days'
    else 'epoch'::timestamptz end;

  return query
  with ev as (
    select e.user_id, sum(e.amount)::bigint as xp
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
    where e.created_at >= since
      and (
        _scope = 'global'
        or (_scope = 'school'     and p.school     = _scope_value)
        or (_scope = 'faculty'    and p.faculty    = _scope_value)
        or (_scope = 'department' and p.department = _scope_value)
        or (_scope = 'level'      and p.level      = _scope_value)
        or (_scope = 'course'     and e.course_id::text = _scope_value)
      )
    group by e.user_id
  )
  select p.id, p.username::text, p.full_name, p.avatar_url,
         p.school, p.department, p.level,
         ev.xp,
         rank() over (order by ev.xp desc) as rank
  from ev join public.profiles p on p.id = ev.user_id
  order by ev.xp desc
  limit _limit;
end $$;

grant execute on function public.leaderboard(text, text, text, int) to authenticated;
grant execute on function public.readme_level(integer) to authenticated, anon;

-- Public read of minimal profile fields for public profile pages
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles public read basic') then
    create policy "profiles public read basic" on public.profiles for select to authenticated using (true);
  end if;
end $$;
