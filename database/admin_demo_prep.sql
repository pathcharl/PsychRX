-- ============================================================================
-- PsychRx — Admin dashboard schema prep (idempotent)
-- Run this ONCE in the Supabase SQL editor before scripts/seed-admin-demo.ts.
--
-- It only ADDS missing columns/tables that the admin dashboard reads. It is
-- safe to run multiple times (every statement is IF NOT EXISTS) and does not
-- touch or drop existing data.
-- ============================================================================

-- ---- providers -------------------------------------------------------------
alter table public.providers
  add column if not exists fill_rate      numeric(4,3) not null default 0,  -- 0..1 filled fraction
  add column if not exists oig_excluded   boolean not null default false,
  add column if not exists oig_checked_at timestamptz;

-- ---- patients --------------------------------------------------------------
alter table public.patients
  add column if not exists insurance_payer     text,
  add column if not exists primary_provider_id uuid references public.providers (id) on delete set null;

create index if not exists idx_patients_primary_provider
  on public.patients (primary_provider_id);

-- ---- appointments ----------------------------------------------------------
alter table public.appointments
  add column if not exists start_time         timestamptz,
  add column if not exists appointment_type   text,
  add column if not exists session_modality   text default 'video',
  add column if not exists session_started_at timestamptz,
  add column if not exists telehealth_link    text;

create index if not exists idx_appointments_start_time
  on public.appointments (start_time);

-- ---- audit_log -------------------------------------------------------------
alter table public.audit_log
  add column if not exists actor_id    uuid,
  add column if not exists actor_email text,
  add column if not exists entity_type text,
  add column if not exists entity_id   uuid,
  add column if not exists changes     jsonb;

-- ---- insurance_claims (table missing on this DB) ---------------------------
create table if not exists public.insurance_claims (
  id                     uuid primary key default gen_random_uuid(),
  patient_id             uuid references public.patients (id) on delete cascade,
  provider_id            uuid references public.providers (id) on delete set null,
  payer_name             text,
  billed_amount          numeric(10,2) not null default 0,
  paid_amount            numeric(10,2) not null default 0,
  status                 text not null default 'draft',
  denial_reason          text,
  submitted_at           timestamptz,
  adjudicated_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.insurance_claims enable row level security;

-- ---- balance_decisions (table missing on this DB) --------------------------
create table if not exists public.balance_decisions (
  id         uuid primary key default gen_random_uuid(),
  decision   text not null,
  reasoning  text,
  urgency    text not null default 'low',
  created_at timestamptz not null default now()
);

alter table public.balance_decisions enable row level security;
