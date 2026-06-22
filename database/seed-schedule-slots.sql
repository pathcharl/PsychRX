-- Open booking slots for active providers (next 14 weekdays).
-- Run in Supabase SQL editor so /schedule can list real providers + times.
--
-- Ensures test provider (olayiwolatiamiyu72@gmail.com) is bookable.

update public.providers
set
  status = 'active',
  accepts_new_patients = true
where status is distinct from 'active'
   or accepts_new_patients is distinct from true;

-- Weekday slots 9am–5pm ET (stored as UTC; adjust if your DB uses another TZ).
insert into public.provider_slots (provider_id, start_time, end_time, status)
select
  pr.id,
  slot_start,
  slot_start + interval '60 minutes',
  'open'
from public.providers pr
cross join lateral (
  select generate_series(
    date_trunc('day', now() at time zone 'America/New_York') + interval '1 day',
    date_trunc('day', now() at time zone 'America/New_York') + interval '14 days',
    interval '1 day'
  )::date as day
) days
cross join lateral (
  select (days.day + time '09:00') at time zone 'America/New_York' + (n * interval '60 minutes') as slot_start
  from generate_series(0, 7) as n
) slots
where pr.status = 'active'
  and pr.accepts_new_patients = true
  and extract(dow from days.day) between 1 and 5
  and slot_start > now()
  and not exists (
    select 1
    from public.provider_slots ps
    where ps.provider_id = pr.id
      and ps.start_time = slot_start
  );

-- Quick check: providers with open future slots
select
  pr.email,
  pr.first_name,
  pr.last_name,
  count(*) filter (where ps.status = 'open' and ps.start_time > now()) as open_slots
from public.providers pr
left join public.provider_slots ps on ps.provider_id = pr.id
where pr.status = 'active'
group by pr.id, pr.email, pr.first_name, pr.last_name
order by open_slots desc;
