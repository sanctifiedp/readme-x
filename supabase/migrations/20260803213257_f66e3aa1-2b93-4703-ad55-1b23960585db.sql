ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS level_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_academic_change_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  -- users may never set the cooldown timestamps directly
  new.school_changed_at := old.school_changed_at;
  new.level_changed_at  := old.level_changed_at;

  if coalesce(new.school, '') <> coalesce(old.school, '') then
    if coalesce(old.school, '') <> '' then
      if old.school_changed_at is not null
         and old.school_changed_at > now() - interval '6 months' then
        raise exception 'SCHOOL_COOLDOWN: you can change your school again on %',
          to_char(old.school_changed_at + interval '6 months', 'YYYY-MM-DD');
      end if;
      new.school_changed_at := now();
    end if;
  end if;

  if coalesce(new.level, '') <> coalesce(old.level, '') then
    if coalesce(old.level, '') <> '' then
      if old.level_changed_at is not null
         and old.level_changed_at > now() - interval '6 months' then
        raise exception 'LEVEL_COOLDOWN: you can change your academic level again on %',
          to_char(old.level_changed_at + interval '6 months', 'YYYY-MM-DD');
      end if;
      new.level_changed_at := now();
    end if;
  end if;

  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.enforce_academic_change_cooldown() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_academic_change_cooldown ON public.profiles;
CREATE TRIGGER trg_enforce_academic_change_cooldown
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_academic_change_cooldown();