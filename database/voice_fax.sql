-- ============================================================================
-- PsychRx — Carol AI voice + Telnyx fax support
-- Run this in the Supabase SQL editor (after schema.sql).
--
-- Adds:
--   * ai_interactions  — Carol voice/chat conversations + collected intake
--   * daily_send_log   — per-day outreach send log (fax/email/sms) with limits
-- ============================================================================

create extension if not exists pgcrypto;

-- Self-contained updated_at trigger function (also defined in schema.sql).
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
-- ai_interactions
-- ----------------------------------------------------------------------------
create table if not exists public.ai_interactions (
  id              uuid primary key default gen_random_uuid(),
  agent           text not null default 'carol',
  channel         text not null default 'voice'
                    check (channel in ('voice', 'sms', 'web', 'chat')),
  call_sid        text,                 -- Twilio CallSid (voice) / session id
  from_number     text,
  to_number       text,
  patient_id      uuid references public.patients (id) on delete set null,
  appointment_id  uuid references public.appointments (id) on delete set null,
  intent          text,
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'completed',
                                      'transferred', 'abandoned', 'failed')),
  transcript      jsonb not null default '[]'::jsonb,   -- [{role,text,at}]
  collected       jsonb not null default '{}'::jsonb,   -- intake fields
  summary         text,
  model           text,
  turns           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Repair: ensure all columns exist if an older ai_interactions table is present.
alter table public.ai_interactions
  add column if not exists agent          text not null default 'carol',
  add column if not exists channel        text not null default 'voice',
  add column if not exists call_sid       text,
  add column if not exists from_number    text,
  add column if not exists to_number      text,
  add column if not exists patient_id     uuid references public.patients (id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists intent         text,
  add column if not exists status         text not null default 'in_progress',
  add column if not exists transcript     jsonb not null default '[]'::jsonb,
  add column if not exists collected      jsonb not null default '{}'::jsonb,
  add column if not exists summary        text,
  add column if not exists model          text,
  add column if not exists turns          integer not null default 0,
  add column if not exists created_at     timestamptz not null default now(),
  add column if not exists updated_at     timestamptz not null default now();

create index if not exists idx_ai_interactions_call_sid on public.ai_interactions (call_sid);
create index if not exists idx_ai_interactions_status on public.ai_interactions (status);
create index if not exists idx_ai_interactions_patient on public.ai_interactions (patient_id);
create index if not exists idx_ai_interactions_created on public.ai_interactions (created_at);

drop trigger if exists set_updated_at on public.ai_interactions;
create trigger set_updated_at
  before update on public.ai_interactions
  for each row execute function public.set_updated_at();

alter table public.ai_interactions enable row level security;
alter table public.ai_interactions force row level security;

-- ----------------------------------------------------------------------------
-- daily_send_log
-- ----------------------------------------------------------------------------
create table if not exists public.daily_send_log (
  id            uuid primary key default gen_random_uuid(),
  send_date     date not null default current_date,
  channel       text not null default 'fax'
                  check (channel in ('fax', 'email', 'sms')),
  campaign      text not null default 'referral_outreach'
                  check (campaign in ('referral_outreach', 'provider_recruit',
                                      'monthly_partner', 'other')),
  target_type   text
                  check (target_type in ('referral_source', 'provider',
                                         'scraper_lead', 'patient', 'other')),
  target_id     uuid,
  to_number     text,
  status        text not null default 'queued'
                  check (status in ('queued', 'sent', 'failed', 'skipped')),
  external_id   text,                   -- Telnyx fax id / provider id
  error_message text,
  metadata      jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Repair: ensure all columns exist if an older daily_send_log table is present.
alter table public.daily_send_log
  add column if not exists send_date     date not null default current_date,
  add column if not exists channel       text not null default 'fax',
  add column if not exists campaign      text not null default 'referral_outreach',
  add column if not exists target_type   text,
  add column if not exists target_id     uuid,
  add column if not exists to_number     text,
  add column if not exists status        text not null default 'queued',
  add column if not exists external_id   text,
  add column if not exists error_message text,
  add column if not exists metadata      jsonb,
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists updated_at    timestamptz not null default now();

create index if not exists idx_daily_send_log_date on public.daily_send_log (send_date);
create index if not exists idx_daily_send_log_channel on public.daily_send_log (channel);
create index if not exists idx_daily_send_log_campaign on public.daily_send_log (campaign);
create index if not exists idx_daily_send_log_status on public.daily_send_log (status);
create index if not exists idx_daily_send_log_target on public.daily_send_log (target_type, target_id);

drop trigger if exists set_updated_at on public.daily_send_log;
create trigger set_updated_at
  before update on public.daily_send_log
  for each row execute function public.set_updated_at();

alter table public.daily_send_log enable row level security;
alter table public.daily_send_log force row level security;
