-- Link test patient ↔ provider for full portal messaging flow.
-- Patient: larrydeveloper7@gmail.com
-- Provider: olayiwolatiamiyu72@gmail.com
--
-- Run in Supabase SQL editor AFTER database/messaging.sql

-- 1. Assign care team (primary provider on patient)
update public.patients p
set
  primary_provider_id = pr.id,
  updated_at = now()
from public.providers pr
where lower(p.email) = lower('larrydeveloper7@gmail.com')
  and lower(pr.email) = lower('olayiwolatiamiyu72@gmail.com');

-- 2. Ensure auth roles (patient / provider — not admin)
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'patient')
where lower(email) = lower('larrydeveloper7@gmail.com');

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'provider')
where lower(email) = lower('olayiwolatiamiyu72@gmail.com');

-- 3. Link auth users to profile rows (if missing)
update public.patients p
set user_id = u.id
from auth.users u
where lower(p.email) = lower('larrydeveloper7@gmail.com')
  and lower(u.email) = lower('larrydeveloper7@gmail.com')
  and p.user_id is null;

update public.providers pr
set user_id = u.id
from auth.users u
where lower(pr.email) = lower('olayiwolatiamiyu72@gmail.com')
  and lower(u.email) = lower('olayiwolatiamiyu72@gmail.com')
  and pr.user_id is null;

-- 4. Upcoming appointment (care team + scheduling UI)
insert into public.appointments (
  patient_id,
  provider_id,
  scheduled_at,
  start_time,
  status,
  duration_minutes,
  session_modality
)
select
  p.id,
  pr.id,
  now() + interval '3 days',
  now() + interval '3 days',
  'scheduled',
  60,
  'video'
from public.patients p
join public.providers pr on lower(pr.email) = lower('olayiwolatiamiyu72@gmail.com')
where lower(p.email) = lower('larrydeveloper7@gmail.com')
  and not exists (
    select 1
    from public.appointments a
    where a.patient_id = p.id
      and a.provider_id = pr.id
      and a.status in ('scheduled', 'confirmed')
  );

-- 5. Verify linkage
select
  p.email as patient_email,
  p.primary_provider_id,
  pr.email as provider_email,
  pr.id as provider_id
from public.patients p
left join public.providers pr on pr.id = p.primary_provider_id
where lower(p.email) = lower('larrydeveloper7@gmail.com');
