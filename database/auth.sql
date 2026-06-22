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

-- When a patient signs up, create a matching public.patients row automatically.
create or replace function public.handle_new_patient_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  full_name text;
  first_name text;
  last_name text;
begin
  user_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role',
    'patient'
  );

  if user_role <> 'patient' then
    return new;
  end if;

  if exists (select 1 from public.patients where user_id = new.id) then
    return new;
  end if;

  full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  first_name := nullif(split_part(full_name, ' ', 1), '');
  last_name := nullif(trim(substring(full_name from position(' ' in full_name))), '');

  if first_name is null then
    first_name := 'Patient';
  end if;
  if last_name is null or last_name = first_name then
    last_name := 'User';
  end if;

  insert into public.patients (user_id, first_name, last_name, email, status)
  values (new.id, first_name, last_name, new.email, 'active')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_patient on auth.users;

create trigger on_auth_user_created_patient
  after insert on auth.users
  for each row
  execute function public.handle_new_patient_profile();

-- When a provider signs up, create a matching public.providers row (placeholder NPI).
create or replace function public.handle_new_provider_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  full_name text;
  first_name text;
  last_name text;
  placeholder_npi text;
begin
  user_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role',
    'patient'
  );

  if user_role <> 'provider' then
    return new;
  end if;

  if exists (select 1 from public.providers where user_id = new.id) then
    return new;
  end if;

  full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  first_name := nullif(split_part(full_name, ' ', 1), '');
  last_name := nullif(trim(substring(full_name from position(' ' in full_name))), '');

  if first_name is null then
    first_name := 'Provider';
  end if;
  if last_name is null or last_name = first_name then
    last_name := 'User';
  end if;

  -- Dev placeholder: 10-digit unique NPI derived from auth user id (replace during onboarding).
  placeholder_npi := '9' || right(replace(new.id::text, '-', ''), 9);

  insert into public.providers (
    user_id, first_name, last_name, email, npi, license_state, status
  )
  values (
    new.id, first_name, last_name, new.email, placeholder_npi, 'FL', 'active'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provider on auth.users;

create trigger on_auth_user_created_provider
  after insert on auth.users
  for each row
  execute function public.handle_new_provider_profile();

-- ---------------------------------------------------------------------------
-- Manually promote a user to admin (run as needed, replace the email):
--
--   update auth.users
--   set raw_app_meta_data =
--         coalesce(raw_app_meta_data, '{}'::jsonb)
--         || jsonb_build_object('role', 'admin')
--   where email = 'pathcharl@yahoo.com';
-- ---------------------------------------------------------------------------
