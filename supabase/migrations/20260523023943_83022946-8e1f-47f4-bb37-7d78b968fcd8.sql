-- profile fields for school identification
alter table public.profiles
  add column if not exists school text,
  add column if not exists department text,
  add column if not exists level text;

-- exams table
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  course_id uuid references public.courses(id) on delete set null,
  school text,
  department text,
  level text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.exams enable row level security;
create policy "Exams readable by all" on public.exams for select to public using (true);
create policy "Admins manage exams" on public.exams for all to authenticated
  using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- link questions to a specific exam (nullable for backward compat)
alter table public.questions
  add column if not exists exam_id uuid references public.exams(id) on delete cascade;
create index if not exists idx_questions_exam on public.questions(exam_id);

-- link attempts to an exam
alter table public.exam_attempts
  add column if not exists exam_id uuid references public.exams(id) on delete set null;

-- donations
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  donor_name text not null,
  message text,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.donations enable row level security;

-- Public can see APPROVED donors only (without amounts — enforced by app-level projection)
create policy "Approved donations public" on public.donations for select to public
  using (status = 'approved');
create policy "Users see own donations" on public.donations for select to authenticated
  using (user_id = auth.uid());
create policy "Users insert own donations" on public.donations for insert to authenticated
  with check (user_id = auth.uid());
create policy "Admins manage donations" on public.donations for all to authenticated
  using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  school text,
  department text,
  level text,
  course_code text,
  link text,
  file_path text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "Notes readable by all" on public.notes for select to public using (true);
create policy "Admins manage notes" on public.notes for all to authenticated
  using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- storage bucket for note files
insert into storage.buckets (id, name, public) values ('notes', 'notes', true)
on conflict (id) do nothing;
create policy "Notes files public read" on storage.objects for select to public
  using (bucket_id = 'notes');
create policy "Admins upload notes" on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and has_role(auth.uid(), 'admin'));
create policy "Admins update notes" on storage.objects for update to authenticated
  using (bucket_id = 'notes' and has_role(auth.uid(), 'admin'));
create policy "Admins delete notes" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and has_role(auth.uid(), 'admin'));