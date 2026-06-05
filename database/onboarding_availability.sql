-- ============================================================================
-- PsychRx — Provider onboarding, availability, absences, compliance
-- Run this in the Supabase SQL editor (after schema.sql + matching.sql).
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
-- providers: compliance credential expiry dates
-- ----------------------------------------------------------------------------
alter table public.providers
  add column if not exists license_expires_at     date,
  add column if not exists malpractice_expires_at date,
  add column if not exists dea_expires_at         date,
  add column if not exists oig_excluded           boolean not null default false,
  add column if not exists oig_checked_at         timestamptz,
  add column if not exists compliance_suspended   boolean not null default false;

-- ----------------------------------------------------------------------------
-- contracts: DocuSeal linkage
-- ----------------------------------------------------------------------------
alter table public.contracts
  add column if not exists docuseal_submission_id text,
  add column if not exists contract_kind          text
    check (contract_kind is null or contract_kind in ('ica', 'baa', 'patient_consent', 'payer'));

create index if not exists idx_contracts_docuseal on public.contracts (docuseal_submission_id);

-- ----------------------------------------------------------------------------
-- provider_onboarding_status
-- Stages: 1 application, 2 credentials, 3 background, 4 contract (DocuSeal),
--         5 baa, 6 stripe, 7 availability, 8 complete
-- ----------------------------------------------------------------------------
create table if not exists public.provider_onboarding_status (
  id                      uuid primary key default gen_random_uuid(),
  provider_id             uuid not null unique references public.providers (id) on delete cascade,
  current_stage           integer not null default 1 check (current_stage between 1 and 8),
  stage_data              jsonb not null default '{}',
  completed_stages        integer[] not null default '{}',
  docuseal_submission_id  text,
  stripe_onboarding_url   text,
  status                  text not null default 'in_progress'
                            check (status in ('in_progress', 'complete', 'rejected')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.provider_onboarding_status
  add column if not exists provider_id            uuid references public.providers (id) on delete cascade,
  add column if not exists current_stage          integer not null default 1,
  add column if not exists stage_data             jsonb not null default '{}',
  add column if not exists completed_stages       integer[] not null default '{}',
  add column if not exists docuseal_submission_id text,
  add column if not exists stripe_onboarding_url  text,
  add column if not exists status                 text not null default 'in_progress',
  add column if not exists created_at             timestamptz not null default now(),
  add column if not exists updated_at             timestamptz not null default now();

create index if not exists idx_onboarding_provider on public.provider_onboarding_status (provider_id);
create index if not exists idx_onboarding_stage on public.provider_onboarding_status (current_stage);

drop trigger if exists set_updated_at on public.provider_onboarding_status;
create trigger set_updated_at before update on public.provider_onboarding_status
  for each row execute function public.set_updated_at();

alter table public.provider_onboarding_status enable row level security;
alter table public.provider_onboarding_status force row level security;

-- ----------------------------------------------------------------------------
-- availability_templates (weekly recurring schedule)
-- ----------------------------------------------------------------------------
create table if not exists public.availability_templates (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references public.providers (id) on delete cascade,
  day_of_week           integer not null check (day_of_week between 0 and 6),
  start_time            time not null,
  end_time              time not null,
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes > 0),
  appointment_type      text not null default 'follow_up',
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.availability_templates
  add column if not exists provider_id           uuid references public.providers (id) on delete cascade,
  add column if not exists day_of_week           integer,
  add column if not exists start_time            time,
  add column if not exists end_time              time,
  add column if not exists slot_duration_minutes integer not null default 60,
  add column if not exists appointment_type      text not null default 'follow_up',
  add column if not exists is_active             boolean not null default true,
  add column if not exists created_at            timestamptz not null default now(),
  add column if not exists updated_at            timestamptz not null default now();

create index if not exists idx_avail_templates_provider on public.availability_templates (provider_id);
create index if not exists idx_avail_templates_dow on public.availability_templates (day_of_week);

drop trigger if exists set_updated_at on public.availability_templates;
create trigger set_updated_at before update on public.availability_templates
  for each row execute function public.set_updated_at();

alter table public.availability_templates enable row level security;
alter table public.availability_templates force row level security;

-- ----------------------------------------------------------------------------
-- blocked_dates (provider unavailable on specific dates)
-- ----------------------------------------------------------------------------
create table if not exists public.blocked_dates (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers (id) on delete cascade,
  blocked_date  date not null,
  reason        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider_id, blocked_date)
);

alter table public.blocked_dates
  add column if not exists provider_id  uuid references public.providers (id) on delete cascade,
  add column if not exists blocked_date date,
  add column if not exists reason       text,
  add column if not exists created_at   timestamptz not null default now(),
  add column if not exists updated_at   timestamptz not null default now();

create index if not exists idx_blocked_dates_provider on public.blocked_dates (provider_id);
create index if not exists idx_blocked_dates_date on public.blocked_dates (blocked_date);

drop trigger if exists set_updated_at on public.blocked_dates;
create trigger set_updated_at before update on public.blocked_dates
  for each row execute function public.set_updated_at();

alter table public.blocked_dates enable row level security;
alter table public.blocked_dates force row level security;

-- ----------------------------------------------------------------------------
-- provider_absences
-- ----------------------------------------------------------------------------
create table if not exists public.provider_absences (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references public.providers (id) on delete cascade,
  absence_type          text not null check (absence_type in ('sick', 'vacation', 'emergency')),
  start_date            date not null,
  end_date              date not null,
  status                text not null default 'active'
                          check (status in ('active', 'resolved', 'cancelled')),
  coverage_provider_ids uuid[] not null default '{}',
  affected_appointment_ids uuid[] not null default '{}',
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.provider_absences
  add column if not exists provider_id              uuid references public.providers (id) on delete cascade,
  add column if not exists absence_type           text,
  add column if not exists start_date             date,
  add column if not exists end_date               date,
  add column if not exists status                 text not null default 'active',
  add column if not exists coverage_provider_ids  uuid[] not null default '{}',
  add column if not exists affected_appointment_ids uuid[] not null default '{}',
  add column if not exists notes                   text,
  add column if not exists created_at             timestamptz not null default now(),
  add column if not exists updated_at             timestamptz not null default now();

create index if not exists idx_absences_provider on public.provider_absences (provider_id);
create index if not exists idx_absences_dates on public.provider_absences (start_date, end_date);

drop trigger if exists set_updated_at on public.provider_absences;
create trigger set_updated_at before update on public.provider_absences
  for each row execute function public.set_updated_at();

alter table public.provider_absences enable row level security;
alter table public.provider_absences force row level security;

-- ----------------------------------------------------------------------------
-- oig_exclusions (monthly compliance check lookup)
-- ----------------------------------------------------------------------------
create table if not exists public.oig_exclusions (
  id           uuid primary key default gen_random_uuid(),
  npi          text,
  name         text,
  excluded_at  date,
  reason       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.oig_exclusions
  add column if not exists npi         text,
  add column if not exists name        text,
  add column if not exists excluded_at date,
  add column if not exists reason      text,
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists updated_at  timestamptz not null default now();

create index if not exists idx_oig_exclusions_npi on public.oig_exclusions (npi);

drop trigger if exists set_updated_at on public.oig_exclusions;
create trigger set_updated_at before update on public.oig_exclusions
  for each row execute function public.set_updated_at();

alter table public.oig_exclusions enable row level security;
alter table public.oig_exclusions force row level security;

-- provider_slots.source_template_id — track which template generated a slot
alter table public.provider_slots
  add column if not exists source_template_id uuid references public.availability_templates (id) on delete set null;
