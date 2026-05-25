
-- Add school/department/level to courses for filtering
alter table public.courses
  add column if not exists school text,
  add column if not exists department text,
  add column if not exists level text;

-- Add AI hint cache to questions
alter table public.questions
  add column if not exists hint text;

-- Add timing fields to exam_attempts
alter table public.exam_attempts
  add column if not exists duration_seconds integer not null default 1800,
  add column if not exists expires_at timestamptz;

-- Enforce 500-question cap per course
create or replace function public.enforce_question_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  if new.course_id is null then
    return new;
  end if;
  select count(*) into cnt from public.questions where course_id = new.course_id;
  if cnt >= 500 then
    raise exception 'This course has reached the maximum of 500 questions.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_question_cap on public.questions;
create trigger trg_enforce_question_cap
  before insert on public.questions
  for each row execute function public.enforce_question_cap();
