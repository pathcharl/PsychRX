-- ============================================================================
-- PsychRx — Stripe Connect payments
-- Run this in the Supabase SQL editor (after schema.sql).
--
-- Adds:
--   * provider Stripe Connect columns (account id + onboarding status)
--   * patient Stripe customer id
--   * appointment check-in / fee / payout tracking
--   * provider_payments — weekly 75/25 payout records
--   * no_show_fees      — $150 no-show fee records
-- 75% to provider, 25% to PsychRx on every transaction.
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
-- providers: Stripe Connect
-- ----------------------------------------------------------------------------
alter table public.providers
  add column if not exists stripe_account_id       text,
  add column if not exists stripe_onboarded        boolean not null default false,
  add column if not exists stripe_charges_enabled  boolean not null default false,
  add column if not exists stripe_payouts_enabled  boolean not null default false;

create index if not exists idx_providers_stripe_account on public.providers (stripe_account_id);

-- ----------------------------------------------------------------------------
-- patients: Stripe customer
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists stripe_customer_id text;

create index if not exists idx_patients_stripe_customer on public.patients (stripe_customer_id);

-- ----------------------------------------------------------------------------
-- appointments: check-in + payout tracking
-- ----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists checked_in_at        timestamptz,
  add column if not exists fee_amount           numeric(10,2),
  add column if not exists paid_to_provider     boolean not null default false,
  add column if not exists provider_payment_id  uuid,
  add column if not exists no_show_fee_charged  boolean not null default false;

create index if not exists idx_appointments_paid_to_provider on public.appointments (paid_to_provider);

-- ----------------------------------------------------------------------------
-- provider_payments (weekly payouts)
-- ----------------------------------------------------------------------------
create table if not exists public.provider_payments (
  id                 uuid primary key default gen_random_uuid(),
  provider_id        uuid not null references public.providers (id) on delete cascade,
  period_start       date,
  period_end         date,
  session_count      integer not null default 0,
  gross_amount       numeric(10,2) not null default 0,
  provider_amount    numeric(10,2) not null default 0,
  platform_amount    numeric(10,2) not null default 0,
  stripe_transfer_id text,
  status             text not null default 'pending'
                       check (status in ('pending', 'paid', 'failed')),
  celebration_level  text,
  metadata           jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.provider_payments
  add column if not exists provider_id        uuid references public.providers (id) on delete cascade,
  add column if not exists period_start       date,
  add column if not exists period_end         date,
  add column if not exists session_count      integer not null default 0,
  add column if not exists gross_amount       numeric(10,2) not null default 0,
  add column if not exists provider_amount    numeric(10,2) not null default 0,
  add column if not exists platform_amount    numeric(10,2) not null default 0,
  add column if not exists stripe_transfer_id text,
  add column if not exists status             text not null default 'pending',
  add column if not exists celebration_level  text,
  add column if not exists metadata           jsonb,
  add column if not exists created_at         timestamptz not null default now(),
  add column if not exists updated_at         timestamptz not null default now();

create index if not exists idx_provider_payments_provider on public.provider_payments (provider_id);
create index if not exists idx_provider_payments_status on public.provider_payments (status);
create index if not exists idx_provider_payments_period on public.provider_payments (period_start, period_end);

drop trigger if exists set_updated_at on public.provider_payments;
create trigger set_updated_at before update on public.provider_payments
  for each row execute function public.set_updated_at();

alter table public.provider_payments enable row level security;
alter table public.provider_payments force row level security;

-- ----------------------------------------------------------------------------
-- no_show_fees
-- ----------------------------------------------------------------------------
create table if not exists public.no_show_fees (
  id                       uuid primary key default gen_random_uuid(),
  appointment_id           uuid references public.appointments (id) on delete set null,
  patient_id               uuid references public.patients (id) on delete set null,
  provider_id              uuid references public.providers (id) on delete set null,
  amount                   numeric(10,2) not null default 150,
  provider_amount          numeric(10,2) not null default 0,
  platform_amount          numeric(10,2) not null default 0,
  stripe_payment_intent_id text,
  stripe_transfer_id       text,
  status                   text not null default 'charged'
                             check (status in ('charged', 'provider_paid',
                                               'uncollectible', 'failed', 'refunded')),
  charged_at               timestamptz,
  metadata                 jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.no_show_fees
  add column if not exists appointment_id           uuid references public.appointments (id) on delete set null,
  add column if not exists patient_id               uuid references public.patients (id) on delete set null,
  add column if not exists provider_id              uuid references public.providers (id) on delete set null,
  add column if not exists amount                   numeric(10,2) not null default 150,
  add column if not exists provider_amount          numeric(10,2) not null default 0,
  add column if not exists platform_amount          numeric(10,2) not null default 0,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_transfer_id       text,
  add column if not exists status                   text not null default 'charged',
  add column if not exists charged_at               timestamptz,
  add column if not exists metadata                 jsonb,
  add column if not exists created_at               timestamptz not null default now(),
  add column if not exists updated_at               timestamptz not null default now();

create index if not exists idx_no_show_fees_appointment on public.no_show_fees (appointment_id);
create index if not exists idx_no_show_fees_patient on public.no_show_fees (patient_id);
create index if not exists idx_no_show_fees_provider on public.no_show_fees (provider_id);
create index if not exists idx_no_show_fees_status on public.no_show_fees (status);

drop trigger if exists set_updated_at on public.no_show_fees;
create trigger set_updated_at before update on public.no_show_fees
  for each row execute function public.set_updated_at();

alter table public.no_show_fees enable row level security;
alter table public.no_show_fees force row level security;
