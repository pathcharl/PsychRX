-- PsychRx — messaging tables (idempotent)
-- Run in Supabase SQL editor before testing patient ↔ provider messages.

create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  conversation_type text,
  participants      jsonb,
  title             text,
  last_message_at   timestamptz,
  is_clinical       boolean default false,
  created_at        timestamptz default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete cascade,
  sender_id       uuid not null,
  sender_type     text,
  content         text not null,
  message_type      text default 'general',
  read_at         timestamptz,
  flagged         boolean default false,
  is_clinical     boolean default false,
  external_source text,
  created_at      timestamptz default now()
);

create index if not exists idx_messages_conversation on public.messages (conversation_id);
create index if not exists idx_messages_created on public.messages (created_at);
create index if not exists idx_conversations_last_message on public.conversations (last_message_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
