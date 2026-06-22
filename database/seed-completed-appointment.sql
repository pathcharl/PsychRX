-- Insert one completed past appointment (demo / scribe testing).
-- Matches live DB: start_time + scheduled_at (NOT scheduled_start).
-- Prereq: core_spec.sql columns (scheduled_at, duration_minutes, cpt_code).

insert into public.appointments (
  patient_id,
  provider_id,
  scheduled_at,
  start_time,
  status,
  duration_minutes,
  cpt_code,
  completed_at
)
select
  p.id,
  pr.id,
  now() - interval '2 hours',
  now() - interval '2 hours',
  'completed',
  60,
  '90837',
  now() - interval '2 hours'
from patients p
cross join providers pr
limit 1;
