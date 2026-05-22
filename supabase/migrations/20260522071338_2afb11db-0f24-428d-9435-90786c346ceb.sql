
-- Roles enum + table
create type public.app_role as enum ('admin', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  matric_no text,
  email text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Auto-create profile + student role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, matric_no)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'matric_no', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  correct_index int not null check (correct_index >= 0 and correct_index <= 3),
  source_material_id uuid references public.course_materials(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.questions(course_id);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  question_ids jsonb not null,
  score int,
  total int not null default 30,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index on public.exam_attempts(user_id, started_at desc);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen_index int,
  is_correct boolean,
  unique(attempt_id, question_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.chat_messages(created_at desc);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text not null default 'Unknown'
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.course_materials enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.chat_messages enable row level security;
alter table public.quotes enable row level security;

-- Profiles
create policy "Profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- User roles: readable by self, admins manage all
create policy "Users see own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Courses: public read, admin write
create policy "Courses readable by all" on public.courses
  for select using (true);
create policy "Admins manage courses" on public.courses
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Materials: authenticated read, admin write
create policy "Materials readable by authenticated" on public.course_materials
  for select to authenticated using (true);
create policy "Admins manage materials" on public.course_materials
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Questions: authenticated read (correct_index protected via server-side answer check), admin write
create policy "Questions readable by authenticated" on public.questions
  for select to authenticated using (true);
create policy "Admins manage questions" on public.questions
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Attempts: own only
create policy "Users read own attempts" on public.exam_attempts
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own attempts" on public.exam_attempts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own attempts" on public.exam_attempts
  for update to authenticated using (auth.uid() = user_id);

create policy "Users read own answers" on public.attempt_answers
  for select to authenticated using (
    exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );
create policy "Users insert own answers" on public.attempt_answers
  for insert to authenticated with check (
    exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );

-- Chat
create policy "Chat readable by authenticated" on public.chat_messages
  for select to authenticated using (true);
create policy "Users send own messages" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own messages" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id);

-- Quotes: public read, admin write
create policy "Quotes readable by all" on public.quotes
  for select using (true);
create policy "Admins manage quotes" on public.quotes
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Realtime for chat
alter publication supabase_realtime add table public.chat_messages;
alter table public.chat_messages replica identity full;
