alter table public.questions alter column course_id drop not null;
alter table public.exam_attempts alter column course_id drop not null;