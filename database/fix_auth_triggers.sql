-- ============================================================================
-- Fix auth provisioning triggers (idempotent).
-- Run this in the Supabase SQL editor. Safe to run multiple times.
--
-- Changes vs the original auth.sql:
--   1. New signups now LINK to an existing patients/providers row that has the
--      same email (created by a prior booking or /providers/apply) instead of
--      inserting a duplicate row.
--   2. New PROVIDER signups are created with status 'pending' instead of
--      'active'. Self-signup must not grant an active provider account; that was
--      a security hole and also caused re-applying to return HTTP 409.
-- ============================================================================

-- Patient profile provisioning ------------------------------------------------
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

  -- Claim an existing patient row with the same email (not already linked).
  if new.email is not null then
    update public.patients
    set user_id = new.id
    where user_id is null
      and lower(email) = lower(new.email);
    if found then
      return new;
    end if;
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

-- Provider profile provisioning ----------------------------------------------
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

  -- Claim an existing provider row with the same email (e.g. from an
  -- application) instead of creating a duplicate.
  if new.email is not null then
    update public.providers
    set user_id = new.id
    where user_id is null
      and lower(email) = lower(new.email);
    if found then
      return new;
    end if;
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

  placeholder_npi := '9' || right(replace(new.id::text, '-', ''), 9);

  insert into public.providers (
    user_id, first_name, last_name, email, npi, license_state, status
  )
  values (
    new.id, first_name, last_name, new.email, placeholder_npi, 'FL', 'pending'
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Triggers (recreate to be safe; unchanged targets) ---------------------------
drop trigger if exists on_auth_user_created_patient on auth.users;
create trigger on_auth_user_created_patient
  after insert on auth.users
  for each row
  execute function public.handle_new_patient_profile();

drop trigger if exists on_auth_user_created_provider on auth.users;
create trigger on_auth_user_created_provider
  after insert on auth.users
  for each row
  execute function public.handle_new_provider_profile();
