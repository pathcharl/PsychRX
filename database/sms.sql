-- ============================================================================
-- PsychRx — SMS routing + reminder support
-- Run this in the Supabase SQL editor AFTER schema.sql.
--
-- Adds:
--   * inbound_contacts        — log of inbound SMS / fax / voice (used by the
--                               Twilio + Telnyx webhooks and the SMS router)
--   * provider availability   — columns on providers for SICK / AVAIL / STOP
--   * appointment reminders    — timestamp flags written by reminder-worker
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared trigger function (defined here too so this script is self-contained
-- and does not depend on schema.sql having been run first).
-- ----------------------------------------------------------------------------
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
-- inbound_contacts
-- ----------------------------------------------------------------------------
create table if not exists public.inbound_contacts (
  id                  uuid primary key default gen_random_uuid(),
  channel             text not null default 'sms'
                        check (channel in ('sms', 'fax', 'voice', 'email')),
  direction           text not null default 'inbound'
                        check (direction in ('inbound', 'outbound')),
  from_number         text,
  to_number           text,
  body                text,                 -- raw message text (SMS/voice)
  command             text,                 -- parsed keyword: SICK/CONFIRM/etc
  media_url           text,                 -- fax / MMS media
  page_count          integer,
  external_id         text,                 -- Twilio/Telnyx provider id
  status              text not null default 'pending'
                        check (status in ('pending', 'processed', 'unmatched',
                                          'ignored', 'failed', 'received')),
  matched_provider_id uuid references public.providers (id) on delete set null,
  matched_patient_id  uuid references public.patients (id) on delete set null,
  reply               text,                 -- response sent back to the sender
  raw                 jsonb,
  processed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Repair: if an older inbound_contacts table already exists (from prior work),
-- `create table if not exists` above is a no-op, so ensure every column is
-- present before creating indexes that reference them.
alter table public.inbound_contacts
  add column if not exists channel             text not null default 'sms',
  add column if not exists direction           text not null default 'inbound',
  add column if not exists from_number         text,
  add column if not exists to_number           text,
  add column if not exists body                text,
  add column if not exists command             text,
  add column if not exists media_url           text,
  add column if not exists page_count          integer,
  add column if not exists external_id         text,
  add column if not exists status              text not null default 'pending',
  add column if not exists matched_provider_id uuid references public.providers (id) on delete set null,
  add column if not exists matched_patient_id  uuid references public.patients (id) on delete set null,
  add column if not exists reply               text,
  add column if not exists raw                 jsonb,
  add column if not exists processed_at        timestamptz,
  add column if not exists created_at          timestamptz not null default now(),
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_inbound_contacts_channel on public.inbound_contacts (channel);
create index if not exists idx_inbound_contacts_status on public.inbound_contacts (status);
create index if not exists idx_inbound_contacts_from on public.inbound_contacts (from_number);
create index if not exists idx_inbound_contacts_provider on public.inbound_contacts (matched_provider_id);
create index if not exists idx_inbound_contacts_patient on public.inbound_contacts (matched_patient_id);
create index if not exists idx_inbound_contacts_created on public.inbound_contacts (created_at);

drop trigger if exists set_updated_at on public.inbound_contacts;
create trigger set_updated_at
  before update on public.inbound_contacts
  for each row execute function public.set_updated_at();

alter table public.inbound_contacts enable row level security;
alter table public.inbound_contacts force row level security;

-- ----------------------------------------------------------------------------
-- providers: availability + SMS opt-out (driven by SICK / AVAIL / STOP)
-- ----------------------------------------------------------------------------
alter table public.providers
  add column if not exists available          boolean not null default true,
  add column if not exists unavailable_reason text,
  add column if not exists unavailable_since  timestamptz,
  add column if not exists sms_opt_out         boolean not null default false;

create index if not exists idx_providers_available on public.providers (available);

-- ----------------------------------------------------------------------------
-- appointments: reminder flags (null = not yet sent)
-- ----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists reminder_24h_sent_at     timestamptz,
  add column if not exists reminder_morning_sent_at timestamptz,
  add column if not exists reminder_2h_sent_at      timestamptz,
  add column if not exists reminder_1h_sent_at      timestamptz;
