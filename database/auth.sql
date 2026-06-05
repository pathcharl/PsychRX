-- PsychRx auth role provisioning
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Why: Supabase Auth lets clients write to `user_metadata` (raw_user_meta_data),
-- so it must NEVER be trusted for authorization. Roles live in `app_metadata`
-- (raw_app_meta_data), which only the service role / database can set.
--
-- This trigger reads the `role` chosen at signup and copies it into app_metadata,
-- clamped to 'patient' or 'provider'. The 'admin' role can only be assigned
-- manually (see bottom of this file) and can never be self-assigned at signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired text;
begin
  desired := coalesce(new.raw_user_meta_data ->> 'role', 'patient');

  -- Prevent privilege escalation: only patient/provider allowed via signup.
  if desired not in ('patient', 'provider') then
    desired := 'patient';
  end if;

  new.raw_app_meta_data :=
    coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', desired);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  before insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Manually promote a user to admin (run as needed, replace the email):
--
--   update auth.users
--   set raw_app_meta_data =
--         coalesce(raw_app_meta_data, '{}'::jsonb)
--         || jsonb_build_object('role', 'admin')
--   where email = 'pathcharl@yahoo.com';
-- ---------------------------------------------------------------------------
