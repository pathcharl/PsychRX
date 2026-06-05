-- ============================================================================
-- PsychRx — Core product spec (idempotent)
-- Run in Supabase SQL editor on an EXISTING database.
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--
-- Does NOT drop or rename columns used by the current app (e.g.
-- scheduled_start, workers_log, license_expires_at). Adds the spec columns
-- alongside them so both shapes coexist during migration.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

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
-- providers — extend existing table
-- ----------------------------------------------------------------------------
alter table public.providers
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists provider_type text,
  add column if not exists license_expiry date,
  add column if not exists license_states text[],
  add column if not exists dea_expiry date,
  add column if not exists malpractice_carrier text,
  add column if not exists malpractice_expiry date,
  add column if not exists caqh_number text,
  add column if not exists caqh_last_attested date,
  add column if not exists conditions_treated text[],
  add column if not exists telehealth_link text,
  add column if not exists direct_phone text,
  add column if not exists direct_fax text,
  add column if not exists max_sessions_per_week integer default 20,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists insurance_panels text[],
  add column if not exists accepts_cash_pay boolean default true,
  add column if not exists cash_pay_rate numeric(10, 2),
  add column if not exists onboarding_step text default 'application',
  add column if not exists contract_signed boolean default false,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists docuseal_submission_id text,
  add column if not exists stripe_onboarding_complete boolean default false,
  add column if not exists rating numeric(3, 2),
  add column if not exists total_sessions integer default 0,
  add column if not exists no_show_count integer default 0,
  add column if not exists cancellation_count integer default 0;

-- Sync legacy column names → spec names when empty
update public.providers
set license_expiry = license_expires_at
where license_expiry is null and license_expires_at is not null;

update public.providers
set malpractice_expiry = malpractice_expires_at
where malpractice_expiry is null and malpractice_expires_at is not null;

update public.providers
set dea_expiry = dea_expires_at
where dea_expiry is null and dea_expires_at is not null;

create index if not exists idx_providers_user_id on public.providers (user_id);
create index if not exists idx_providers_npi on public.providers (npi);
create index if not exists idx_providers_onboarding_step on public.providers (onboarding_step);

-- ----------------------------------------------------------------------------
-- patients — extend existing table
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists dob date,
  add column if not exists address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists insurance_primary_payer_id text,
  add column if not exists insurance_primary_payer_name text,
  add column if not exists insurance_primary_member_id text,
  add column if not exists insurance_primary_group_number text,
  add column if not exists insurance_primary_verified boolean default false,
  add column if not exists insurance_primary_verified_at timestamptz,
  add column if not exists insurance_secondary_payer_id text,
  add column if not exists insurance_secondary_member_id text,
  add column if not exists preferred_provider_type text,
  add column if not exists preferred_language text default 'English',
  add column if not exists presenting_concerns text[],
  add column if not exists referral_source text,
  add column if not exists referral_source_npi text,
  add column if not exists intake_completed boolean default false,
  add column if not exists intake_completed_at timestamptz,
  add column if not exists carol_session_id text;

update public.patients
set dob = date_of_birth
where dob is null and date_of_birth is not null;

create index if not exists idx_patients_user_id on public.patients (user_id);

-- ----------------------------------------------------------------------------
-- appointments — extend existing table
-- ----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_minutes integer default 60,
  add column if not exists cpt_code text,
  add column if not exists icd10_codes text[],
  add column if not exists place_of_service text default '10',
  add column if not exists session_notes text,
  add column if not exists telehealth_url text,
  add column if not exists reminder_sent_24h boolean default false,
  add column if not exists reminder_sent_2h boolean default false,
  add column if not exists no_show_fee_amount numeric(10, 2) default 150.00,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists completed_at timestamptz;

update public.appointments
set scheduled_at = scheduled_start
where scheduled_at is null and scheduled_start is not null;

create index if not exists idx_appointments_scheduled_at on public.appointments (scheduled_at);

-- ----------------------------------------------------------------------------
-- encounters — extend existing table
-- ----------------------------------------------------------------------------
alter table public.encounters
  add column if not exists date_of_service date,
  add column if not exists cpt_code text,
  add column if not exists icd10_primary text,
  add column if not exists icd10_secondary text[],
  add column if not exists place_of_service text default '10',
  add column if not exists charge_amount numeric(10, 2),
  add column if not exists session_start time,
  add column if not exists session_end time,
  add column if not exists clinical_notes text,
  add column if not exists claim_status text default 'pending',
  add column if not exists claim_id text,
  add column if not exists stedi_submission_id text,
  add column if not exists payer_claim_id text,
  add column if not exists paid_amount numeric(10, 2),
  add column if not exists adjustment_amount numeric(10, 2),
  add column if not exists denial_code text,
  add column if not exists denial_reason text,
  add column if not exists era_received_at timestamptz,
  add column if not exists provider_payout_amount numeric(10, 2),
  add column if not exists provider_payout_status text default 'pending',
  add column if not exists provider_payout_at timestamptz;

update public.encounters
set date_of_service = encounter_date::date
where date_of_service is null and encounter_date is not null;

-- ----------------------------------------------------------------------------
-- contracts — extend existing table
-- ----------------------------------------------------------------------------
alter table public.contracts
  add column if not exists docuseal_template_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_pdf_url text;

-- ----------------------------------------------------------------------------
-- referrals (new)
-- ----------------------------------------------------------------------------
create table if not exists public.referrals (
  id                       uuid primary key default gen_random_uuid(),
  referring_provider_npi   text,
  referring_provider_name  text,
  referring_practice_name  text,
  referring_fax            text,
  referring_phone          text,
  patient_first_name       text,
  patient_last_name        text,
  patient_dob              date,
  patient_phone            text,
  patient_insurance        text,
  patient_member_id        text,
  diagnosis_codes          text[],
  urgency                  text default 'routine',
  notes                    text,
  fax_received_at          timestamptz,
  telnyx_fax_id            text,
  parsed_by_ai             boolean default false,
  patient_id               uuid references public.patients (id) on delete set null,
  appointment_id           uuid references public.appointments (id) on delete set null,
  status                   text default 'received'
                             check (status in (
                               'received', 'processing', 'matched',
                               'scheduled', 'completed', 'failed'
                             )),
  created_at               timestamptz default now()
);

create index if not exists idx_referrals_status on public.referrals (status);
create index if not exists idx_referrals_patient on public.referrals (patient_id);

alter table public.referrals enable row level security;
alter table public.referrals force row level security;

-- ----------------------------------------------------------------------------
-- sms_commands (new)
-- ----------------------------------------------------------------------------
create table if not exists public.sms_commands (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid references public.providers (id) on delete set null,
  from_phone    text not null,
  command       text not null,
  raw_message   text,
  processed     boolean default false,
  response_sent text,
  created_at    timestamptz default now()
);

create index if not exists idx_sms_commands_provider on public.sms_commands (provider_id);
create index if not exists idx_sms_commands_processed on public.sms_commands (processed);

alter table public.sms_commands enable row level security;
alter table public.sms_commands force row level security;

-- ----------------------------------------------------------------------------
-- outreach_contacts (new)
-- ----------------------------------------------------------------------------
create table if not exists public.outreach_contacts (
  id              uuid primary key default gen_random_uuid(),
  npi             text unique,
  first_name      text,
  last_name       text,
  credential      text,
  specialty       text,
  practice_name   text,
  address         text,
  city            text,
  state           text,
  zip             text,
  phone           text,
  fax             text,
  email           text,
  source          text,
  outreach_type   text check (outreach_type in (
                    'referral_source', 'provider_recruit', 'both'
                  )),
  contact_status  text default 'not_contacted'
                    check (contact_status in (
                      'not_contacted', 'faxed', 'emailed',
                      'called', 'responded', 'signed_up', 'rendering'
                    )),
  fax_sent_at     timestamptz,
  email_sent_at   timestamptz,
  responded_at    timestamptz,
  notes           text,
  tier            integer default 2,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_outreach_contacts_npi on public.outreach_contacts (npi);
create index if not exists idx_outreach_contacts_status on public.outreach_contacts (contact_status);

drop trigger if exists set_updated_at on public.outreach_contacts;
create trigger set_updated_at before update on public.outreach_contacts
  for each row execute function public.set_updated_at();

alter table public.outreach_contacts enable row level security;
alter table public.outreach_contacts force row level security;

-- ----------------------------------------------------------------------------
-- platform_metrics (new)
-- ----------------------------------------------------------------------------
create table if not exists public.platform_metrics (
  id                      uuid primary key default gen_random_uuid(),
  recorded_at             timestamptz default now(),
  active_providers        integer default 0,
  providers_by_type       jsonb,
  active_patients         integer default 0,
  appointments_this_week  integer default 0,
  revenue_this_week       numeric(10, 2) default 0,
  claims_pending          integer default 0,
  claims_paid_this_month  numeric(10, 2) default 0,
  fill_rate               numeric(5, 2),
  specialty_mix           jsonb,
  state_expansion_score   jsonb
);

create index if not exists idx_platform_metrics_recorded on public.platform_metrics (recorded_at);

alter table public.platform_metrics enable row level security;
alter table public.platform_metrics force row level security;

-- ----------------------------------------------------------------------------
-- worker_logs (new — spec name; app also uses workers_log)
-- ----------------------------------------------------------------------------
create table if not exists public.worker_logs (
  id                uuid primary key default gen_random_uuid(),
  worker_name       text not null,
  status            text check (status in ('started', 'completed', 'failed')),
  message           text,
  records_processed integer,
  error_details     text,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz default now()
);

create index if not exists idx_worker_logs_name on public.worker_logs (worker_name);
create index if not exists idx_worker_logs_created on public.worker_logs (created_at);

alter table public.worker_logs enable row level security;
alter table public.worker_logs force row level security;

-- Optional: provider_type check (only if column has no invalid values)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'providers_provider_type_check'
  ) then
    alter table public.providers
      add constraint providers_provider_type_check
      check (provider_type is null or provider_type in (
        'pmhnp', 'therapist', 'psychologist', 'psychiatrist', 'md_supervisor'
      ));
  end if;
exception when others then
  raise notice 'Skipped providers_provider_type_check: %', sqlerrm;
end $$;
