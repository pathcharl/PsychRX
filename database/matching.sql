-- ============================================================================
-- PsychRx — Patient/provider matching + intake support
-- Run this in the Supabase SQL editor (after schema.sql).
--
-- Adds:
--   * provider matching attributes (insurances, languages, care types, ...)
--   * patient preference columns (language, care_type)
--   * provider_slots — bookable availability with 10-min holds
--   * waitlist       — unmatched patients + outstanding slot offers
--   * match_log      — audit of matching/offer/booking events
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- providers: matching attributes
-- ----------------------------------------------------------------------------
alter table public.providers
  add column if not exists accepts_new_patients boolean not null default true,
  add column if not exists languages            text[] not null default '{English}',
  add column if not exists insurances           text[] not null default '{}',
  add column if not exists care_types           text[] not null default '{}',
  add column if not exists specialties          text[] not null default '{}',
  add column if not exists fill_rate            numeric(4,3) not null default 0; -- 0..1 (filled fraction)

create index if not exists idx_providers_accepts_new on public.providers (accepts_new_patients);

-- ----------------------------------------------------------------------------
-- patients: matching preferences
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists language  text,
  add column if not exists care_type text;

-- ----------------------------------------------------------------------------
-- provider_slots
-- ----------------------------------------------------------------------------
create table if not exists public.provider_slots (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null references public.providers (id) on delete cascade,
  start_time          timestamptz not null,
  end_time            timestamptz,
  status              text not null default 'open'
                        check (status in ('open', 'held', 'booked', 'cancelled')),
  held_for_patient_id uuid references public.patients (id) on delete set null,
  hold_expires_at     timestamptz,
  appointment_id      uuid references public.appointments (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.provider_slots
  add column if not exists provider_id         uuid references public.providers (id) on delete cascade,
  add column if not exists start_time          timestamptz,
  add column if not exists end_time            timestamptz,
  add column if not exists status              text not null default 'open',
  add column if not exists held_for_patient_id uuid references public.patients (id) on delete set null,
  add column if not exists hold_expires_at     timestamptz,
  add column if not exists appointment_id      uuid references public.appointments (id) on delete set null,
  add column if not exists created_at          timestamptz not null default now(),
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_provider_slots_provider on public.provider_slots (provider_id);
create index if not exists idx_provider_slots_status on public.provider_slots (status);
create index if not exists idx_provider_slots_start on public.provider_slots (start_time);
create index if not exists idx_provider_slots_hold on public.provider_slots (hold_expires_at);

drop trigger if exists set_updated_at on public.provider_slots;
create trigger set_updated_at before update on public.provider_slots
  for each row execute function public.set_updated_at();

alter table public.provider_slots enable row level security;
alter table public.provider_slots force row level security;

-- ----------------------------------------------------------------------------
-- waitlist
-- ----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.patients (id) on delete cascade,
  status              text not null default 'waiting'
                        check (status in ('waiting', 'offered', 'booked',
                                          'expired', 'cancelled')),
  care_type           text,
  language            text,
  insurance           text,
  reason              text,
  source              text,
  priority            integer not null default 0,
  offered_slot_id     uuid references public.provider_slots (id) on delete set null,
  offered_provider_id uuid references public.providers (id) on delete set null,
  offered_at          timestamptz,
  offer_expires_at    timestamptz,
  matched_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.waitlist
  add column if not exists status              text not null default 'waiting',
  add column if not exists care_type           text,
  add column if not exists language            text,
  add column if not exists insurance           text,
  add column if not exists reason              text,
  add column if not exists source              text,
  add column if not exists priority            integer not null default 0,
  add column if not exists offered_slot_id     uuid references public.provider_slots (id) on delete set null,
  add column if not exists offered_provider_id uuid references public.providers (id) on delete set null,
  add column if not exists offered_at          timestamptz,
  add column if not exists offer_expires_at    timestamptz,
  add column if not exists matched_at          timestamptz,
  add column if not exists created_at          timestamptz not null default now(),
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_waitlist_patient on public.waitlist (patient_id);
create index if not exists idx_waitlist_status on public.waitlist (status);
create index if not exists idx_waitlist_offer_expires on public.waitlist (offer_expires_at);
create index if not exists idx_waitlist_priority on public.waitlist (priority);

drop trigger if exists set_updated_at on public.waitlist;
create trigger set_updated_at before update on public.waitlist
  for each row execute function public.set_updated_at();

alter table public.waitlist enable row level security;
alter table public.waitlist force row level security;

-- ----------------------------------------------------------------------------
-- match_log
-- ----------------------------------------------------------------------------
create table if not exists public.match_log (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references public.patients (id) on delete set null,
  provider_id  uuid references public.providers (id) on delete set null,
  slot_id      uuid references public.provider_slots (id) on delete set null,
  score        numeric(5,2),
  action       text not null default 'scored'
                 check (action in ('scored', 'matched', 'offered', 'booked',
                                   'no_match', 'offer_expired', 'error')),
  details      jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Repair: ensure all columns exist if an older match_log table is present.
alter table public.match_log
  add column if not exists patient_id  uuid references public.patients (id) on delete set null,
  add column if not exists provider_id uuid references public.providers (id) on delete set null,
  add column if not exists slot_id     uuid references public.provider_slots (id) on delete set null,
  add column if not exists score       numeric(5,2),
  add column if not exists action      text not null default 'scored',
  add column if not exists details     jsonb,
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists updated_at  timestamptz not null default now();

create index if not exists idx_match_log_patient on public.match_log (patient_id);
create index if not exists idx_match_log_provider on public.match_log (provider_id);
create index if not exists idx_match_log_action on public.match_log (action);
create index if not exists idx_match_log_created on public.match_log (created_at);

drop trigger if exists set_updated_at on public.match_log;
create trigger set_updated_at before update on public.match_log
  for each row execute function public.set_updated_at();

alter table public.match_log enable row level security;
alter table public.match_log force row level security;
