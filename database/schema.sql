-- ============================================================================
-- PsychRx — Complete Database Schema
-- ============================================================================
-- Target: Supabase (PostgreSQL 15+)
--
-- ⚠️  RUN THIS FILE ONLY ON A NEW / EMPTY DATABASE.
--     If you see "relation providers already exists", your base schema is
--     already applied — skip this file and run the incremental migrations
--     in order instead:
--       1. database/auth.sql
--       2. database/sms.sql
--       3. database/voice_fax.sql
--       4. database/matching.sql
--       5. database/payments.sql
--       6. database/onboarding_availability.sql
--       7. database/core_spec.sql
--     Or run database/apply_migrations.sql (safe to re-run).
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'providers'
  ) then
    raise exception
      'Base schema already applied (public.providers exists). '
      'Do not re-run schema.sql — use database/apply_migrations.sql instead.';
  end if;
end $$;

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. providers
-- ============================================================================
create table if not exists public.providers (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  credentials       text,                         -- e.g. MD, DO, PMHNP, LCSW
  specialty         text,
  npi               text unique,
  dea_number        text,
  license_number    text,
  license_state     text,
  email             text unique,
  phone             text,
  status            text not null default 'active'
                      check (status in ('active', 'inactive', 'pending')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_providers_status on public.providers (status);
create index if not exists idx_providers_last_name on public.providers (last_name);

-- ============================================================================
-- 2. referral_sources
-- ============================================================================
create table if not exists public.referral_sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              text not null default 'other'
                      check (type in ('physician', 'hospital', 'clinic',
                                      'online', 'self', 'insurance', 'other')),
  organization      text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  status            text not null default 'active'
                      check (status in ('active', 'inactive')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_referral_sources_type on public.referral_sources (type);
create index if not exists idx_referral_sources_status on public.referral_sources (status);

-- ============================================================================
-- 3. patients
-- ============================================================================
create table if not exists public.patients (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text not null,
  last_name                text not null,
  date_of_birth            date,
  gender                   text
                             check (gender in ('male', 'female', 'nonbinary',
                                               'other', 'unknown')),
  email                    text,
  phone                    text,
  address_line1            text,
  address_line2            text,
  city                     text,
  state                    text,
  zip                      text,
  insurance_provider       text,
  insurance_member_id      text,
  insurance_group_number   text,
  primary_provider_id      uuid references public.providers (id) on delete set null,
  referral_source_id       uuid references public.referral_sources (id) on delete set null,
  status                   text not null default 'active'
                             check (status in ('prospective', 'active',
                                               'inactive', 'discharged')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_patients_primary_provider on public.patients (primary_provider_id);
create index if not exists idx_patients_referral_source on public.patients (referral_source_id);
create index if not exists idx_patients_status on public.patients (status);
create index if not exists idx_patients_last_name on public.patients (last_name);
create index if not exists idx_patients_email on public.patients (email);

-- ============================================================================
-- 4. appointments
-- ============================================================================
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients (id) on delete cascade,
  provider_id       uuid not null references public.providers (id) on delete restrict,
  appointment_type  text not null default 'follow_up'
                      check (appointment_type in ('initial_eval', 'follow_up',
                                                  'therapy', 'medication_management',
                                                  'telehealth', 'intake')),
  status            text not null default 'scheduled'
                      check (status in ('scheduled', 'confirmed', 'completed',
                                        'cancelled', 'no_show', 'rescheduled')),
  scheduled_start   timestamptz not null,
  scheduled_end     timestamptz,
  location          text,
  telehealth_link   text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_appointments_patient on public.appointments (patient_id);
create index if not exists idx_appointments_provider on public.appointments (provider_id);
create index if not exists idx_appointments_start on public.appointments (scheduled_start);
create index if not exists idx_appointments_status on public.appointments (status);

-- ============================================================================
-- 5. encounters  (clinical visit / SOAP note)
-- ============================================================================
create table if not exists public.encounters (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid references public.appointments (id) on delete set null,
  patient_id        uuid not null references public.patients (id) on delete cascade,
  provider_id       uuid not null references public.providers (id) on delete restrict,
  encounter_date    timestamptz not null default now(),
  chief_complaint   text,
  subjective        text,
  objective         text,
  assessment        text,
  plan              text,
  diagnosis_codes   text[] not null default '{}',   -- ICD-10
  cpt_codes         text[] not null default '{}',   -- procedure codes
  status            text not null default 'draft'
                      check (status in ('draft', 'signed', 'amended', 'locked')),
  signed_by         uuid references public.providers (id) on delete set null,
  signed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_encounters_appointment on public.encounters (appointment_id);
create index if not exists idx_encounters_patient on public.encounters (patient_id);
create index if not exists idx_encounters_provider on public.encounters (provider_id);
create index if not exists idx_encounters_status on public.encounters (status);
create index if not exists idx_encounters_date on public.encounters (encounter_date);

-- ============================================================================
-- 6. insurance_claims
-- ============================================================================
create table if not exists public.insurance_claims (
  id                       uuid primary key default gen_random_uuid(),
  encounter_id             uuid references public.encounters (id) on delete set null,
  patient_id               uuid not null references public.patients (id) on delete cascade,
  provider_id              uuid references public.providers (id) on delete set null,
  claim_number             text unique,
  payer_name               text,
  payer_id                 text,
  cpt_codes                text[] not null default '{}',
  diagnosis_codes          text[] not null default '{}',
  billed_amount            numeric(10, 2) not null default 0,
  allowed_amount           numeric(10, 2),
  paid_amount              numeric(10, 2) not null default 0,
  patient_responsibility   numeric(10, 2) not null default 0,
  status                   text not null default 'draft'
                             check (status in ('draft', 'submitted', 'accepted',
                                               'rejected', 'denied', 'paid',
                                               'partially_paid', 'appealed')),
  clearinghouse            text
                             check (clearinghouse in ('office_ally', 'availity', 'other')),
  denial_reason            text,
  submitted_at             timestamptz,
  adjudicated_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_claims_encounter on public.insurance_claims (encounter_id);
create index if not exists idx_claims_patient on public.insurance_claims (patient_id);
create index if not exists idx_claims_provider on public.insurance_claims (provider_id);
create index if not exists idx_claims_status on public.insurance_claims (status);
create index if not exists idx_claims_payer on public.insurance_claims (payer_name);

-- ============================================================================
-- 7. payments
-- ============================================================================
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  patient_id               uuid references public.patients (id) on delete set null,
  claim_id                 uuid references public.insurance_claims (id) on delete set null,
  amount                   numeric(10, 2) not null,
  payment_type             text not null default 'patient'
                             check (payment_type in ('insurance', 'patient', 'copay',
                                                     'coinsurance', 'adjustment', 'refund')),
  payment_method           text
                             check (payment_method in ('card', 'cash', 'check',
                                                       'ach', 'stripe', 'other')),
  stripe_payment_intent_id text,
  status                   text not null default 'pending'
                             check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  payment_date             timestamptz not null default now(),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_payments_patient on public.payments (patient_id);
create index if not exists idx_payments_claim on public.payments (claim_id);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_date on public.payments (payment_date);

-- ============================================================================
-- 8. contracts  (payer / network contracts)
-- ============================================================================
create table if not exists public.contracts (
  id                  uuid primary key default gen_random_uuid(),
  payer_name          text not null,
  contract_type       text not null default 'in_network'
                        check (contract_type in ('in_network', 'out_of_network',
                                                 'single_case', 'group')),
  provider_id         uuid references public.providers (id) on delete set null,
  group_npi           text,
  reimbursement_rate  numeric(6, 2),               -- percent of fee schedule
  effective_date      date,
  expiration_date     date,
  status              text not null default 'pending'
                        check (status in ('active', 'pending', 'expired', 'terminated')),
  document_url        text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_contracts_provider on public.contracts (provider_id);
create index if not exists idx_contracts_status on public.contracts (status);
create index if not exists idx_contracts_payer on public.contracts (payer_name);

-- ============================================================================
-- 9. scraper_leads  (lead generation / prospecting)
-- ============================================================================
create table if not exists public.scraper_leads (
  id                            uuid primary key default gen_random_uuid(),
  source                        text,              -- where the lead was scraped
  business_name                 text,
  contact_name                  text,
  email                         text,
  phone                         text,
  website                       text,
  specialty                     text,
  address_line1                 text,
  city                          text,
  state                         text,
  zip                           text,
  lead_score                    integer
                                  check (lead_score between 0 and 100),
  status                        text not null default 'new'
                                  check (status in ('new', 'contacted', 'qualified',
                                                    'converted', 'rejected')),
  converted_referral_source_id  uuid references public.referral_sources (id) on delete set null,
  raw_data                      jsonb,
  scraped_at                    timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists idx_scraper_leads_status on public.scraper_leads (status);
create index if not exists idx_scraper_leads_score on public.scraper_leads (lead_score);
create index if not exists idx_scraper_leads_email on public.scraper_leads (email);
create index if not exists idx_scraper_leads_converted on public.scraper_leads (converted_referral_source_id);

-- ============================================================================
-- 10. workers_log  (background job / cron run log)
-- ============================================================================
create table if not exists public.workers_log (
  id                  uuid primary key default gen_random_uuid(),
  worker_name         text not null,
  job_type            text,
  status              text not null default 'started'
                        check (status in ('started', 'running', 'completed', 'failed')),
  records_processed   integer not null default 0,
  duration_ms         integer,
  error_message       text,
  metadata            jsonb,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_workers_log_name on public.workers_log (worker_name);
create index if not exists idx_workers_log_status on public.workers_log (status);
create index if not exists idx_workers_log_started on public.workers_log (started_at);

-- ============================================================================
-- 11. notifications
-- ============================================================================
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_type    text not null default 'staff'
                      check (recipient_type in ('provider', 'patient', 'staff', 'owner')),
  recipient_id      uuid,                          -- polymorphic; FK enforced in app layer
  channel           text not null default 'in_app'
                      check (channel in ('sms', 'email', 'push', 'in_app', 'voice')),
  subject           text,
  body              text,
  status            text not null default 'pending'
                      check (status in ('pending', 'sent', 'delivered', 'failed', 'read')),
  external_id       text,                          -- Twilio / Resend / provider id
  metadata          jsonb,
  sent_at           timestamptz,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications (recipient_type, recipient_id);
create index if not exists idx_notifications_status on public.notifications (status);
create index if not exists idx_notifications_channel on public.notifications (channel);

-- ============================================================================
-- 12. audit_log
-- ============================================================================
create table if not exists public.audit_log (
  id                uuid primary key default gen_random_uuid(),
  actor_id          uuid,                          -- auth.users id (no FK to keep auditing decoupled)
  actor_email       text,
  action            text not null
                      check (action in ('create', 'update', 'delete', 'view',
                                        'login', 'logout', 'export', 'other')),
  entity_type       text,                          -- table / resource name
  entity_id         uuid,
  changes           jsonb,                         -- { before, after }
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_audit_log_actor on public.audit_log (actor_id);
create index if not exists idx_audit_log_entity on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_action on public.audit_log (action);
create index if not exists idx_audit_log_created on public.audit_log (created_at);

-- ============================================================================
-- updated_at triggers (one per table)
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'providers', 'referral_sources', 'patients', 'appointments', 'encounters',
    'insurance_claims', 'payments', 'contracts', 'scraper_leads', 'workers_log',
    'notifications', 'audit_log'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- ============================================================================
-- Row Level Security (default-deny on every table)
-- ----------------------------------------------------------------------------
-- RLS is enabled with NO policies, so anon / authenticated roles have no
-- access through the Data API. The service_role key (server-side) bypasses
-- RLS. Add explicit policies before exposing any table to client roles.
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'providers', 'referral_sources', 'patients', 'appointments', 'encounters',
    'insurance_claims', 'payments', 'contracts', 'scraper_leads', 'workers_log',
    'notifications', 'audit_log'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end;
$$;
