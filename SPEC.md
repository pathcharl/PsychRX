# ╔══════════════════════════════════════════════════════════════════╗
# ║          PSYCHRX COMPLETE MASTER BUILD PACKAGE v3              ║
# ║          Owner: Patrick Charles PMHNP-BC                       ║
# ╠══════════════════════════════════════════════════════════════════╣
# ║  PHASE 1 (BUILD NOW):   PsychRx — Commercial Insurance         ║
# ║  1-833-ANXIETY (future): Add separately when ready               ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# HOW TO USE THIS GUIDE:
# Open Cursor. Open new chat.
# Paste each numbered prompt in order.
# One prompt at a time.
# Test before moving to the next.
# Do not paste all at once.
#
# NOTE: This guide is PsychRx Phase 1 only.
# 1-833-ANXIETY is built and deployed separately.
# Do not mix Medicaid into this build.

# ══════════════════════════════════════════════════════════════════
# DAY 1 CHECKLIST — DO BEFORE OPENING CURSOR
# ══════════════════════════════════════════════════════════════════

# LEGAL:
# [ ] tmsearch.uspto.gov — search "PsychRx" — file if clear
# [ ] sunbiz.org — file PsychRx LLC
# [ ] irs.gov — get EIN (free, immediate)
# [ ] nppes.cms.hhs.gov — register Group NPI (free)

# CREDENTIALING (submit all same day — clock starts NOW):
# [ ] proview.caqh.org — create group CAQH profile
# [ ] availity.com — submit Aetna credentialing
# [ ] cignaforhcp.cigna.com — submit Cigna
# [ ] uhcprovider.com — submit United/Optum
# [ ] availity.com — submit BCBS FL
# [ ] humana.com/provider — submit Humana

# ACCOUNTS TO CREATE:
# [ ] cursor.com — Pro plan
# [ ] supabase.com — create project, upgrade to Pro (HIPAA BAA required)
# [ ] vercel.com — free account
# [ ] railway.app — free account
# [ ] twilio.com — claim 1-833-PSYCHRX (+18337972479)
# [ ] telnyx.com — fax number
# [ ] elevenlabs.io — Starter account
# [ ] stripe.com — business account
# [ ] anthropic.com — API access
# [ ] resend.com — free account
# [ ] officeally.com — free clearinghouse account

# FIRST ACTION BEFORE BUILDING:
# Send first 125 faxes to FL physicians this week.
# Target: pediatrics, OB/GYN, family medicine.
# Goal: 10 confirmed referral sources before first provider recruited.
# This is the most important first step.
# Do it before writing one line of code.


# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 1 — PROJECT SETUP
# ══════════════════════════════════════════════════════════════════

PROMPT_1 = """
Create Next.js 14 project called psychrx.

Run in terminal:

npx create-next-app@latest psychrx \
  --typescript --tailwind --eslint --app \
  --no-src-dir --import-alias "@/*"

cd psychrx

npm install \
  @supabase/supabase-js \
  @supabase/auth-helpers-nextjs \
  @supabase/realtime-js \
  stripe @stripe/stripe-js \
  twilio @anthropic-ai/sdk \
  node-cron date-fns zod \
  react-hook-form @hookform/resolvers \
  sonner lucide-react \
  canvas-confetti @types/canvas-confetti \
  bcryptjs @types/bcryptjs \
  pdf-lib resend tsx otplib

npx shadcn-ui@latest init --yes
npx shadcn-ui@latest add \
  button input label card badge dialog sheet \
  tabs select form toast progress calendar \
  table avatar separator dropdown-menu \
  alert switch textarea

Create .env.local with these variables:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_PSYCHRX=+18337972479
TELNYX_API_KEY=
TELNYX_CONNECTION_ID=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_CAROL_VOICE_ID=
OFFICE_ALLY_USERNAME=
OFFICE_ALLY_PASSWORD=
AVAILITY_CLIENT_ID=
AVAILITY_CLIENT_SECRET=
DOCUSEAL_TOKEN=
DOCUSEAL_URL=http://localhost:3001
TRACK1099_API_KEY=
PSYCHRX_GROUP_NPI=
PSYCHRX_EIN=
OWNER_PHONE=
OWNER_EMAIL=patrick@psychrx.com
BILLING_COORDINATOR_PHONE=
NEXT_PUBLIC_APP_URL=https://psychrx.com

Create next.config.js:
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'psychrx.com',
        '1833anxiety.com'
      ]
    }
  },
  images: {
    domains: ['psychrx.com', '1833anxiety.com']
  }
}

Create tailwind.config.js with custom colors:
navy: { 900: '#1B2B4B', 800: '#243A63' }
teal: { 600: '#0D9488', 500: '#14B8A6' }

Create .gitignore:
.env.local
.env
node_modules
.next
*.log
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 2 — COMPLETE DATABASE SCHEMA
# ══════════════════════════════════════════════════════════════════
# Create this file then run it in Supabase SQL editor

PROMPT_2 = """
Create database/schema.sql with the complete schema below.
After creating the file, run the entire contents
in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- ════════════════════════════════
-- PROVIDERS
-- ════════════════════════════════
create table providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  first_name text not null,
  last_name text not null,
  credentials text,
  provider_type text check (provider_type in (
    'pmhnp','therapist','psychologist',
    'psychiatrist','md_supervisor'
  )),
  npi text unique not null,
  email text unique,
  phone text,
  license_number text,
  license_state text default 'FL',
  license_expiry date,
  license_states text[],
  dea_number text,
  dea_expiry date,
  malpractice_carrier text,
  malpractice_expiry date,
  caqh_number text,
  caqh_last_attested date,
  specialties text[],
  conditions_treated text[],
  languages text[],
  telehealth_link text,
  direct_phone text,
  direct_fax text,
  max_sessions_per_week integer default 20,
  accepts_new_patients boolean default true,
  timezone text default 'America/New_York',
  insurance_panels text[],
  accepts_cash_pay boolean default true,
  status text default 'pending' check (status in (
    'pending','active','inactive','suspended'
  )),
  suspension_reason text,
  tier text default 'part_time' check (tier in (
    'micro','part_time','part_time_plus'
  )),
  platform text default 'psychrx' check (
    platform in ('psychrx','anxiety','both')
  ),
  onboarding_step integer default 1,
  onboarding_complete boolean default false,
  revenue_share decimal default 0.75,
  stripe_connect_id text,
  stripe_connect_ready boolean default false,
  all_time_sessions integer default 0,
  all_time_earnings decimal default 0,
  fill_rate decimal default 0,
  oig_check_passed boolean default false,
  oig_last_checked date,
  courtesy_waiver_used boolean default false,
  sms_opted_out boolean default false,
  pt_profile_url text,
  last_login timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table provider_licenses (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  state text not null,
  license_number text,
  license_type text,
  expiry_date date,
  status text default 'active',
  created_at timestamptz default now(),
  unique(provider_id, state)
);

create table provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  document_type text check (document_type in (
    'license','malpractice','w9','contract','baa',
    'dea','caqh','collaborative_agreement','other'
  )),
  file_url text,
  expiry_date date,
  verified boolean default false,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create table provider_milestones (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  milestone_id text not null,
  milestone_title text,
  awarded_at timestamptz default now(),
  unique(provider_id, milestone_id)
);

create table provider_onboarding_status (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  stage_1_application boolean default false,
  stage_2_documents_uploaded boolean default false,
  stage_3_documents_verified boolean default false,
  stage_4_contract_signed boolean default false,
  stage_5_w9_received boolean default false,
  stage_6_bank_connected boolean default false,
  stage_7_oig_check_passed boolean default false,
  stage_8_availability_set boolean default false,
  stage_9_roster_submitted boolean default false,
  stage_10_first_payer_approved boolean default false,
  stage_11_all_payers_approved boolean default false,
  stage_12_profile_live boolean default false,
  stage_13_first_patient_assigned boolean default false,
  current_stage integer default 1,
  blocked_on text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table collaborative_agreements (
  id uuid primary key default gen_random_uuid(),
  pmhnp_id uuid references providers(id),
  md_name text,
  md_npi text,
  md_license text,
  agreement_date date,
  expiry_date date,
  document_url text,
  status text default 'active',
  created_at timestamptz default now()
);

create table availability_templates (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  day_of_week integer check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  blocked_date date not null,
  start_time time,
  end_time time,
  reason text,
  block_reason text,
  created_at timestamptz default now()
);

create table available_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  slot_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'available' check (status in (
    'available','booked','blocked','held'
  )),
  held_until timestamptz,
  held_for_patient uuid,
  appointment_id uuid,
  created_at timestamptz default now()
);

create table provider_absences (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  absence_type text check (absence_type in (
    'same_day_sick','emergency','planned_vacation',
    'technology_failure','personal'
  )),
  reported_at timestamptz,
  start_date date,
  end_date date,
  affected_appointments uuid[],
  appointments_count integer,
  decision text,
  status text default 'pending_decision',
  covered_count integer default 0,
  rescheduled_count integer default 0,
  cancelled_count integer default 0,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- PATIENTS
-- ════════════════════════════════
create table patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  first_name text,
  last_name text,
  dob date,
  email text,
  phone text,
  address text,
  city text,
  state text default 'FL',
  zip text,
  platform text default 'psychrx' check (
    platform in ('psychrx','anxiety')
  ),
  insurance_payer text,
  insurance_id text,
  insurance_group text,
  insurance_verified boolean default false,
  insurance_verified_at timestamptz,
  secondary_insurance_payer text,
  secondary_insurance_id text,
  copay_amount decimal,
  deductible_remaining decimal,
  stripe_customer_id text,
  card_on_file boolean default false,
  primary_provider_id uuid references providers(id),
  secondary_provider_id uuid references providers(id),
  care_type text check (care_type in (
    'therapy','medication','testing','combined'
  )),
  preferred_times text[],
  preferred_days text[],
  preferred_language text default 'English',
  session_modality_preference text default 'video' check (
    session_modality_preference in ('video','phone','either')
  ),
  referred_by_npi text,
  referred_by_name text,
  referred_by_fax text,
  referral_date timestamptz,
  no_show_count integer default 0,
  no_show_risk text default 'low',
  reschedule_count_this_month integer default 0,
  scheduling_blocked boolean default false,
  courtesy_waiver_used boolean default false,
  courtesy_waiver_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  emergency_contact_consent boolean default false,
  preferred_pharmacy text,
  preferred_pharmacy_fax text,
  is_minor boolean default false,
  guardian_name text,
  guardian_phone text,
  telehealth_consent_signed boolean default false,
  audio_only_consent_signed boolean default false,
  audio_only_consent_date timestamptz,
  sms_opted_out boolean default false,
  status text default 'active' check (status in (
    'active','inactive','waitlist','discharged'
  )),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  document_type text check (document_type in (
    'superbill','telehealth_consent','services_agreement',
    'privacy_notice','audio_only_consent','other'
  )),
  encounter_id uuid,
  file_url text,
  signed_url text,
  date_of_service date,
  created_at timestamptz default now()
);

create table patient_behavior_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  action text check (action in (
    'scheduled','rescheduled','cancelled',
    'no_show','confirmed','late_cancel'
  )),
  appointment_id uuid,
  fee_charged decimal,
  fee_waived boolean default false,
  waiver_reason text,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- APPOINTMENTS + SESSIONS
-- ════════════════════════════════
create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  provider_id uuid references providers(id),
  slot_id uuid references available_slots(id),
  appointment_type text check (appointment_type in (
    'new_patient','follow_up','eval','crisis','phone'
  )),
  session_modality text default 'video' check (
    session_modality in ('video','phone')
  ),
  converted_from_video boolean default false,
  conversion_reason text,
  video_failure_reason text,
  is_coverage boolean default false,
  original_provider_id uuid,
  coverage_reason text,
  rescheduled_from uuid,
  reschedule_reason text,
  appointment_date date,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  telehealth_link text,
  status text default 'scheduled' check (status in (
    'scheduled','confirmed','completed',
    'no_show','cancelled','rescheduled'
  )),
  payment_method text check (
    payment_method in ('insurance','cash')
  ),
  copay_amount decimal,
  copay_collected boolean default false,
  clinical_urgency boolean default false,
  cancellation_protected boolean default false,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  reminder_24hr_sent boolean default false,
  reminder_morning_sent boolean default false,
  reminder_2hr_sent boolean default false,
  reminder_1hr_sent boolean default false,
  no_show_detected boolean default false,
  encounter_submitted boolean default false,
  platform text default 'psychrx',
  created_at timestamptz default now()
);

create table session_checkins (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  session_start timestamptz,
  patient_notified_at timestamptz,
  provider_notified_at timestamptz,
  session_started_at timestamptz,
  session_completed_at timestamptz,
  patient_running_late boolean default false,
  provider_confirmed boolean default false,
  provider_notified_for_noshow boolean default false,
  status text default 'pending',
  created_at timestamptz default now()
);

create table match_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  slot_id uuid,
  match_score integer,
  offered_at timestamptz,
  accepted_at timestamptz,
  expired_at timestamptz,
  outcome text default 'pending'
);

create table pending_confirmations (
  id uuid primary key default gen_random_uuid(),
  token uuid unique default gen_random_uuid(),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  slot_id uuid,
  expires_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  care_type text,
  insurance_payer text,
  platform text default 'psychrx',
  preferred_days text[],
  preferred_times text[],
  urgency text default 'routine',
  status text default 'waiting',
  notified_at timestamptz,
  notification_count integer default 0,
  created_at timestamptz default now()
);

create table slot_offers (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references available_slots(id),
  patient_id uuid references patients(id),
  waitlist_id uuid references waitlist(id),
  offered_at timestamptz default now(),
  expires_at timestamptz,
  response text default 'pending',
  responded_at timestamptz
);

-- ════════════════════════════════
-- CLINICAL
-- ════════════════════════════════
create table encounters (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id),
  provider_id uuid references providers(id),
  patient_id uuid references patients(id),
  date_of_service date not null,
  cpt_code text not null,
  addon_code text,
  icd10_primary text not null,
  icd10_secondary text,
  place_of_service text default '10',
  session_modality text default 'video',
  session_duration integer,
  session_start_time time,
  session_end_time time,
  charge_amount decimal,
  phone_session_reason text,
  ai_note_generated text,
  note_approved boolean default false,
  provider_attested boolean default false,
  attested_at timestamptz,
  ai_audit_approved boolean default false,
  ai_audit_issues jsonb,
  claim_id text,
  submitted_to_clearinghouse boolean default false,
  submitted_at timestamptz,
  expected_reimbursement decimal,
  amount_paid decimal,
  paid_at timestamptz,
  claim_status text default 'pending' check (claim_status in (
    'pending','submitted','paid',
    'denied','appealed','written_off'
  )),
  denial_reason text,
  denial_code text,
  appeal_submitted boolean default false,
  appeal_letter text,
  platform text default 'psychrx',
  created_at timestamptz default now()
);

create table outcome_measures (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  appointment_id uuid,
  measure_type text check (measure_type in (
    'PHQ9','GAD7','ASRS','PCL5','COLUMBIA'
  )),
  responses jsonb,
  total_score integer,
  severity text,
  critical_response boolean default false,
  q9_score integer,
  administered_by text default 'provider' check (
    administered_by in ('provider','carol_ai','patient_self')
  ),
  created_at timestamptz default now()
);

create table prior_authorizations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  payer text,
  service_type text,
  cpt_code text,
  auth_number text,
  approved boolean,
  start_date date,
  end_date date,
  sessions_approved integer,
  sessions_used integer default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

create table patient_discharges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  reason text,
  clinical_summary text,
  referrals_provided text[],
  notice_period_days integer,
  discharge_date date,
  patient_notified boolean default false,
  status text default 'initiated',
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- BILLING + PAYMENTS
-- ════════════════════════════════
create table no_show_fees (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  fee_amount decimal not null,
  provider_amount decimal not null,
  psychrx_amount decimal not null,
  stripe_charge_id text,
  fee_type text,
  waiver_applied boolean default false,
  collected boolean default true,
  created_at timestamptz default now()
);

create table outstanding_balances (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  amount decimal not null,
  reason text,
  appointment_id uuid,
  status text default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table failed_payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  amount decimal,
  reason text,
  appointment_id uuid,
  retry_count integer default 0,
  last_retry timestamptz,
  status text default 'pending',
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table provider_payments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  payment_period_start date,
  payment_period_end date,
  gross_collected decimal,
  psychrx_fee decimal,
  provider_amount decimal,
  session_count integer,
  unique_patients integer,
  no_show_fees_collected decimal default 0,
  stripe_transfer_id text,
  transfer_status text default 'pending',
  transferred_at timestamptz,
  celebration_level text,
  celebration_shown boolean default false,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- MESSAGING
-- ════════════════════════════════
create table conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text,
  participants jsonb,
  title text,
  last_message_at timestamptz,
  is_clinical boolean default false,
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  sender_id uuid not null,
  sender_type text,
  content text not null,
  message_type text default 'general',
  read_at timestamptz,
  flagged boolean default false,
  is_clinical boolean default false,
  external_source text,
  created_at timestamptz default now()
);

create table inbound_contacts (
  id uuid primary key default gen_random_uuid(),
  channel text check (channel in (
    'voice','sms','fax','email','portal'
  )),
  platform text default 'psychrx',
  from_number text,
  from_email text,
  caller_type text,
  entity_id uuid,
  intent text,
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  content text,
  routed_to text,
  ai_handled boolean default true,
  resolved boolean default false,
  processed boolean default false,
  created_at timestamptz default now()
);

create table ai_interactions (
  id uuid primary key default gen_random_uuid(),
  channel text,
  direction text,
  phone_number text,
  patient_id uuid references patients(id),
  platform text default 'psychrx',
  session_transcript text,
  intent_detected text,
  assessment_conducted boolean default false,
  assessment_type text,
  resolved boolean default false,
  escalated boolean default false,
  duration_seconds integer,
  carol_voice_used boolean default true,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- SCRAPER + CAMPAIGNS
-- ════════════════════════════════
create table referral_sources (
  id uuid primary key default gen_random_uuid(),
  npi text unique,
  provider_name text,
  specialty text,
  taxonomy_code text,
  practice_name text,
  address text,
  city text,
  state text default 'FL',
  zip text,
  phone text,
  fax text,
  email text,
  solo_or_group text,
  score integer default 0,
  campaign text check (campaign in (
    'provider_recruit','referral_source'
  )),
  touch_count integer default 0,
  fax_sent_at timestamptz,
  sms_sent_at timestamptz,
  email_sent_at timestamptz,
  last_contact timestamptz,
  last_referral_date date,
  responded boolean default false,
  response_type text,
  converted boolean default false,
  campaign_complete boolean default false,
  do_not_contact boolean default false,
  total_referrals integer default 0,
  converted_patients integer default 0,
  reactivation_sent_at timestamptz,
  monthly_summary_last_sent date,
  created_at timestamptz default now()
);

create table campaign_config (
  id uuid primary key default gen_random_uuid(),
  campaign_type text unique not null,
  status text default 'active',
  fax_allocation integer default 50,
  sms_allocation integer default 50,
  priority text default 'normal',
  specialty_target text,
  updated_at timestamptz default now()
);

create table supply_demand_log (
  id uuid primary key default gen_random_uuid(),
  decision text not null,
  urgency text,
  provider_fax_pct integer,
  referrer_fax_pct integer,
  therapist_fill_rate decimal,
  pmhnp_fill_rate decimal,
  therapist_waitlist integer,
  pmhnp_waitlist integer,
  referrals_this_week integer,
  reasoning text,
  created_at timestamptz default now()
);

create table provider_fill_metrics (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  metric_date date default current_date,
  total_slots integer,
  booked_slots integer,
  available_slots integer,
  fill_rate decimal,
  revenue_at_risk decimal,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- CONTRACTS + COMPLIANCE
-- ════════════════════════════════
create table contracts (
  id uuid primary key default gen_random_uuid(),
  contract_type text,
  party_id uuid,
  party_type text,
  docuseal_id text,
  signed_at timestamptz,
  signed_by text,
  file_url text,
  created_at timestamptz default now()
);

create table two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer default 0,
  created_at timestamptz default now()
);

create table security_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text,
  affected_patients integer,
  description text,
  status text default 'active',
  detected_at timestamptz,
  notification_deadline timestamptz,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_type text,
  action text,
  table_name text,
  record_id uuid,
  ip_address text,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- IDENTITY REGISTRY
-- ════════════════════════════════
create table phone_registry (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique not null,
  entity_type text,
  entity_id uuid,
  entity_name text,
  verified boolean default false,
  created_at timestamptz default now()
);

create table pharmacy_registry (
  id uuid primary key default gen_random_uuid(),
  pharmacy_name text,
  chain text,
  phone text,
  fax text,
  address text,
  ncpdp_id text,
  created_at timestamptz default now()
);

-- ════════════════════════════════
-- SYSTEM + EXPANSION
-- ════════════════════════════════
create table system_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

create table expansions (
  id uuid primary key default gen_random_uuid(),
  state text unique,
  priority_score integer,
  reasons text[],
  status text default 'pending',
  triggered_at timestamptz,
  approved_at timestamptz,
  launched_at timestamptz,
  providers_recruited integer default 0
);

create table daily_send_log (
  id uuid primary key default gen_random_uuid(),
  channel text,
  contact_id uuid,
  campaign text,
  sent_at timestamptz default now()
);

create table opt_outs (
  phone text primary key,
  opted_out_at timestamptz default now(),
  source text
);

-- ════════════════════════════════
-- INDEXES
-- ════════════════════════════════
create index on available_slots (provider_id, slot_date, status);
create index on appointments (patient_id, status);
create index on appointments (provider_id, appointment_date);
create index on appointments (status, start_time);
create index on encounters (claim_status);
create index on encounters (provider_id, date_of_service);
create index on provider_payments (provider_id, transfer_status);
create index on referral_sources (score desc);
create index on referral_sources (campaign, touch_count, campaign_complete);
create index on waitlist (status, care_type);
create index on messages (conversation_id, created_at);
create index on audit_log (user_id, created_at);
create index on phone_registry (phone_number);
create index on patients (phone);
create index on providers (npi);

-- ════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════
alter table patients enable row level security;
alter table appointments enable row level security;
alter table encounters enable row level security;
alter table messages enable row level security;
alter table provider_payments enable row level security;

create policy "providers_see_own_patients"
on patients for select
using (
  primary_provider_id = auth.uid()
  or secondary_provider_id = auth.uid()
  or exists (
    select 1 from appointments
    where patient_id = patients.id
    and provider_id = auth.uid()
  )
);

create policy "patients_see_own_record"
on patients for select
using (user_id = auth.uid());

create policy "providers_see_own_appointments"
on appointments for select
using (provider_id = auth.uid());

create policy "patients_see_own_appointments"
on appointments for select
using (
  patient_id = (
    select id from patients where user_id = auth.uid()
  )
);

create policy "providers_see_own_payments"
on provider_payments for select
using (provider_id = auth.uid());

-- Seed campaign config
insert into campaign_config
  (campaign_type, fax_allocation, sms_allocation)
values
  ('provider_recruit', 40, 40),
  ('referral_source', 60, 60)
on conflict (campaign_type) do nothing;
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPTS 3-16 — IMPLEMENTATION
# ══════════════════════════════════════════════════════════════════

PROMPT_3 = """
Create all files in the lib/ directory.

lib/supabase.ts — Supabase client (admin + public)
lib/twilio.ts — SMS sender, PSYCHRX_PHONE constant
lib/elevenlabs.ts — synthesizeCarol(text) returns Buffer
lib/stripe.ts — stripe client, FEES constants (no_show: 15000, late_cancel_2hr: 15000, late_cancel_24hr: 10000)
lib/anthropic.ts — anthropic client, callCarol(message, history, context) function

Carol system prompt in lib/anthropic.ts:
Carol is warm, late 50s, Midwestern, 30 years healthcare experience.
Never robotic. Never rushed. Never says "Certainly!" or "Absolutely!"
Uses: "Let me look into that." "All right." "Sure thing." "You take care now."
PSYCHRX LINE: commercial insurance, video sessions preferred.

Crisis protocol: any mention of suicidal thoughts → give 988 immediately,
do not hold, alert provider, do not continue conversation.
Cannot handle prescriptions or clinical decisions.
Always verify patient identity before accessing records.

lib/constants.ts:
INSURANCE_PAYERS array: Aetna, Cigna, United/Optum, BCBS FL, Humana
CPT_CODES object with all codes: 90837/90834/90832 (therapy video), 99213/99214/99215 (E&M), 90833 (addon), 98966/98967/98968 (phone therapy), 99441/99442/99443 (phone E&M), 90791/90792 (eval)
PRIOR_AUTH_MATRIX per payer with always_require arrays and after_sessions thresholds
selectPhoneCPT(providerType, minutes, isInitial) function that returns correct CPT code
ICD10_COMMON array with 15 most common mental health diagnoses
"""

PROMPT_4 = """
Create the complete Carol AI VA system.

app/api/voice/inbound/route.ts:
Twilio webhook for all inbound calls.
Detect which number was called using the To field.
PSYCHRX: "Good [morning/afternoon/evening]. You've reached PsychRx. This is Carol. How can I help you today?"
Identify caller from phone_registry.
Synthesize greeting via ElevenLabs.
Upload audio to Supabase temp-audio bucket (public).
Return TwiML gather with audio URL.
Store call context in Supabase ai_interactions (not memory).

app/api/voice/process/route.ts:
Twilio speech gather webhook.
FIRST: check speech for crisis words before anything else.
Crisis words: 'kill myself', 'want to die', 'hurt myself', 'suicidal', 'end it all', 'not worth living', 'take my life', 'better off dead'
If crisis: synthesize crisis response, play it, hang up, alert provider + owner via SMS, log.
Crisis response: "I hear you, and I want to make sure you get the right support right now. Please call or text 988 — that's the Suicide and Crisis Lifeline, available any time, day or night. If you are in immediate danger, please call 911. I am also letting your care team know. You don't have to go through this alone."
If not crisis: get call context from Supabase, get patient context, call Claude with Carol system prompt, synthesize response, store audio, return TwiML, update conversation history.

app/api/sms/inbound/route.ts:
Handles ALL inbound SMS to both numbers.
Check these commands first (case-insensitive):
  Patient commands: CONFIRM, TAKE, SKIP, STOP
  Provider commands: ATTENDED, NOSHOW, LATE, SICK, SICK [date], EMERGENCY, VACATION [dates], VIDEO DOWN, COVER, RESCHEDULE, PHONE, CANCEL, CALLNOW, YES, NO
Crisis check on every message regardless.
Everything else: call Carol AI and SMS response back.
Log all interactions to ai_interactions table.

app/api/fax/inbound/route.ts:
Telnyx webhook for inbound faxes.
Verify Telnyx signature.
Identify sender from phone_registry and referral_sources.
Use Claude to classify fax content:
  If patient name + DOB visible: referral fax → createPatientFromReferral()
  If pharmacy name visible: pharmacy contact → alert relevant provider
  If insurance company: log + route to billing queue
  Unknown: log to inbound_contacts for review
For referrals: create patient record, add to waitlist, trigger instant matching, queue 24-hour fax-back confirmation to referring physician.

services/communication/identity-resolver.ts:
resolveIdentity(channel, identifier) returns { entityType, entityId, entity, confidence }
Check order:
1. phone_registry (fastest — cache of known numbers)
2. patients table by phone column
3. providers table by phone column
4. pharmacy_registry by phone/fax
5. referral_sources by fax
6. Unknown → Claude classifies content

services/ai-va/call-context.ts:
storeCallContext(callSid, context) — Supabase upsert
getCallContext(callSid) — Supabase select
updateCallContext(callSid, updates) — Supabase update
TTL 4 hours. Uses Supabase not Redis (handles Railway restarts).
"""

PROMPT_5 = """
Create all workers in the workers/ directory.

workers/index.ts:
Import all workers. Start realtime listeners.
Print startup confirmation to console.
Add HTTP health endpoint on port 3001 returning 200 for Railway health check.

workers/realtime.worker.ts:
Subscribe to Supabase Realtime postgres_changes:

1. patients INSERT → handleNewPatient(patient)
   Run matching engine immediately (<1 second).
   Find best available provider + slot.
   Hold slot 2 hours.
   SMS patient with confirmation link.
   If no match: add to waitlist, SMS patient about waitlist.
   Trigger balance engine check.

2. providers INSERT where status=active → handleNewProvider(provider)
   Find top 5 waiting patients matching this provider type + insurance.
   SMS provider: "Welcome! You have [X] patients waiting. Set availability: psychrx.com/portal/availability"
   Begin matching process for each waiting patient.

3. appointments UPDATE where status changes to cancelled → handleCancellation(appointment)
   Release slot (status=available, appointment_id=null).
   Fill algorithm fires automatically from slot update listener.

4. available_slots UPDATE where status changes to available (was booked or held) → handleSlotOpened(slot)
   Find best waitlist match using scoring algorithm.
   Offer slot with 30-minute expiry.
   SMS patient with TAKE/SKIP options.

5. inbound_contacts INSERT where channel=fax and caller_type=referral_source → handleInboundReferral(contact)
   Parse fax content with Claude.
   Create patient record.
   Add to waitlist with urgency=referred.
   Trigger instant matching.
   Queue confirmation fax to referring physician within 15 minutes.

6. provider_fill_metrics UPDATE where fill_rate drops more than 15 points → handleFillRateDrop(metrics)
   Find waitlist patients for this provider.
   Offer open slots immediately.

Matching algorithm findBestProviderMatch(patient):
Query active providers accepting new patients with patient's insurance panel.
For each candidate: check license in patient's state, find available slots, score by time preference match, day preference match, slot proximity, language match, specialty match, fill rate bonus (prefer providers with more availability).
Return top match with slot and confirmation token.
Store token in pending_confirmations with 2-hour expiry.

workers/reminder.worker.ts:
cron every 15 minutes.
processReminders(): Send 24hr reminder, morning same-day reminder, 2hr reminder, 1hr reminder. Include join link for video or "provider will call you" for phone.
detectNoShows(): Find appointments past start time with no session_started_at. At +20 min SMS provider "Did patient attend? Reply ATTENDED/NOSHOW/LATE". At +35 min with no response auto-process no-show.
processNoShow(appointmentId): Mark no_show, charge $150 to Stripe, split 75/25, SMS patient, SMS provider, release slot, add to patient_behavior_log.
startCheckinSequences(): Find sessions starting in next 15 min. SMS patient with join link or "provider will call". SMS provider with patient summary and phone number.

workers/payment.worker.ts:
cron Sunday 6 PM: processWeeklyPayments()
Get all paid encounters from last 7 days.
Group by provider.
Calculate: gross, psychrx_fee (25%), provider_amount (75%).
Create Stripe Connect transfer for each provider.
Determine celebration level: standard/good ($1K+)/great ($2K+)/milestone (best week ever).
Send celebration email via Resend + SMS to provider.
Check and award milestones: first session, 10 sessions, 50 sessions, $1K earned, $10K earned.
Update all_time_sessions and all_time_earnings.
cron Sunday 7 PM: sendOwnerWeeklySummary() via SMS.

workers/billing.worker.ts:
cron daily 10 AM.
checkTimelyFiling(): Alert at 30/14/7 days before timely filing deadline per payer.
checkRevenueKPIs(): Clean claim rate (target 95%), denial rate (target <5%), collection rate (target 95%). SMS owner if outside targets.
flagStaleClaimscheck(): Claims submitted >21 days without payment status update.

workers/compliance.worker.ts:
cron daily 9 AM.
checkDocumentExpiry(): For each active provider check license, malpractice, DEA expiry. Alert at 90/60/30/14/7 days. SUSPEND at 0 days: block future slots, SMS provider and owner, SMS affected patients to reschedule.
checkCAQHAttestation(): Alert at 100 days since last attestation. Critical alert at 115 days.
runOIGChecks(): Check OIG LEIE API for each provider. NPI match = immediate suspension + owner SMS "CONTACT ATTORNEY IMMEDIATELY". Rate limit: 1 second between checks.
checkCollaborativeAgreements(): Alert FL PMHNPs at 90/60/30 days before agreement expiry.
sendMonthlySatisfactionSurvey(): 1st of month. SMS providers 1-5 rating. Score <3 alerts owner.

workers/campaign.worker.ts:
cron daily 9 AM weekdays.
Read campaign_config for current allocations.
For each eligible contact in pipeline:
  touch_count=0: send introduction fax
  touch_count=1: send follow-up SMS (after 5 days)
  touch_count=2: send email (after 7 days)
  touch_count=3: send final fax (after 8 days)
  touch_count>=4: campaign complete

isEligibleToContact(contactId, channel) — 6 checks:
  1. do_not_contact flag
  2. Max touches per channel (fax:4, sms:3, email:3)
  3. Any channel within 2 days
  4. Channel-specific gaps (fax-fax:5 days, sms-sms:7 days, fax-sms:3 days)
  5. Send window (Mon-Fri 8AM-6PM only)
  6. Daily platform limits (fax:500, sms:300, email:400)

Provider recruit fax content: Include live waitlist count pulled from database. "We have [X] patients waiting for a [specialty] right now."
Referral source fax content: Specialty-specific. Pediatrics mentions ADHD. OB/GYN mentions postpartum. Family med mentions all conditions.
Monthly 1st: Send summary fax to all active referrers with stats.
Every 60 days: Reactivation fax to lapsed referrers.

workers/balance.worker.ts:
cron every 4 hours.
getPlatformSnapshot(): therapist fill rate + waitlist, PMHNP fill rate + waitlist, referral rate this week + trend, active referrers, current allocations.

8 decision states:
1. CRITICAL_PROVIDER_SURPLUS (fill<0.45): provider=0%, referrer=100%, urgency=critical
2. PROVIDER_SURPLUS (fill<0.60): provider=20%, referrer=80%, urgency=high
3. MAINTAIN_BALANCE (healthy): provider=40%, referrer=60%, urgency=low
4. PATIENT_SURPLUS (waitlist>20 or fill>0.88): provider=70%, referrer=30%, urgency=medium
5. CRITICAL_PATIENT_SURPLUS (waitlist>35 or fill>0.97): provider=90%, referrer=10%, urgency=critical
6. PMHNP_SPECIFIC (PMHNP fill < therapist fill by 10%): specialty_target=pmhnp, provider=70%, referrer=30%
7. THERAPIST_SPECIFIC (therapist fill < PMHNP fill by 10%): specialty_target=therapist, provider=60%, referrer=40%
8. REFERRAL_DROPPING (trend=down AND rate<15/week AND fill<optimal): provider=30%, referrer=70%

After every decision: update campaign_config, log to supply_demand_log.
SMS owner only if urgency>low OR decision changed from last check.

scoreAndRankContacts(): cron Sunday 3 AM. Re-score every contact. Higher score = contacted first.
Provider recruit scoring: has fax +20, has phone +15, has email +10, PMHNP taxonomy +30, LCSW/LMFT/LPC +20, already responded +40, SW Florida city +25, solo practice +15.
Referral source scoring: peds/OB taxonomy +40, family/internal med +30, has fax +20, already active referrer +50, group practice +10, SW Florida +20.

workers/coverage.worker.ts:
SMS command handlers (called from SMS inbound route):
SICK/ILL/COVID → find today's remaining apts → SMS provider COVER/RESCHEDULE/PHONE/CANCEL options → store in provider_absences → SMS owner
EMERGENCY → same as SICK but urgency=emergency
VACATION [dates] → Claude extracts start_date + end_date → block all slots in range → reschedule all appointments in range → SMS provider confirmation
VIDEO DOWN → find active or next-30-min session → SMS provider patient's phone number → SMS patient "provider will call shortly"
COVER → findAndAssignCoverage(): same provider_type + matching insurance + no time conflict + under caseload limit + FL licensed → SMS candidate "YES or NO (15 min)" → if YES create coverage appointment, cancel original, notify patient with new link → if NO try next candidate → if none: reschedule
RESCHEDULE → rescheduleAllAffected(): find next available slot per patient, cancel original, create new, SMS each patient
PHONE → convertToPhoneSessions(): update session_modality=phone, SMS each patient "provider will call you at your appointment time"
CANCEL → cancelWithWaiver(): cancel all, SMS patients with no-charge notice
CALLNOW → convert current session to phone, send patient phone number to provider

workers/nppes.worker.ts:
cron daily 2 AM: scanNewNPIs()
Query NPPES API for FL providers (state=FL).
For each result: check if NPI already in referral_sources.
New NPI: score and insert with correct campaign type.
Updated NPI: update contact info.
Mental health taxonomy codes → campaign=provider_recruit.
Referral specialty taxonomy codes → campaign=referral_source.
Alert owner if >20 new contacts added.

cron monthly 1st 3 AM: send owner SMS about monthly sync.

workers/expansion.worker.ts:
cron Monday 8 AM: checkExpansionReadiness()
FL threshold check: active_providers>=25, monthly_revenue>=50000, fill_rate>=0.75, claim_approval_rate>=0.90.
All 4 must be true.
If true: score all candidate states. State scoring: NP full practice +40, counseling compact +20, PSYPACT +15, high shortage +15, large population +10, owner already holds license +30 bonus.
Your licenses (WA, CO, CA) get +30 each → always top candidates.
SMS owner: recommended state + score + reasons.
Owner replies YES → expansion.status=approved, scraper activates for new state, action items SMS.
Owner replies NO → skip, try next state next Monday.
"""

PROMPT_6 = """
Create AI scribe and phone session system.

app/api/scribe/generate/route.ts:
Input: sessionSummary, providerType, cptCode, icd10, sessionDuration, sessionStart, sessionEnd, sessionModality, phoneReason, assessmentResults, patientFirstName

For phone sessions prepend this exact header to the note:
AUDIO-ONLY TELEPHONE SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session type: Audio-only telephone (not video)
Place of service: 10 (Patient home)
Reason: [phoneReason]
Patient location confirmed: State of Florida
Patient confirmed not in emergency requiring in-person evaluation.
Verbal consent for audio-only telehealth: Obtained via IVR on [date].
Session start time: [sessionStart]
Session end time: [sessionEnd]
Total session minutes: [sessionDuration]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mental status exam for phone: "Appearance: Unable to assess via telephone."

If assessmentResults provided in input:
Include scored results in the Objective section.
Format: "[Measure] administered by phone: Total score [X] — [severity]. [Interpretation]."

Audit the note after generation and return:
approved: true/false
issues: array of blocking problems
warnings: array of non-blocking concerns

Checks:
Time supports CPT code (53+ min for 90837, 38-52 for 90834, etc.)
Start/stop times present for time-based codes
ICD-10 appears in Assessment section
Risk assessment addresses SI and HI
Plan includes 988 and 911 for safety emergencies
Audio-only header present for phone sessions
PDMP documented if PMHNP + patient has controlled substance flag
No repeated phrases suggesting copy-paste

PROMPT_7 = """
Create the coverage algorithm.

services/scheduling/coverage.ts

handleProviderAbsence(providerPhone, message, reportedAt):
Parse message to detect:
SICK/ILL/NOT WELL/COVID → same_day_sick
EMERGENCY/FAMILY EMERGENCY → emergency
VACATION/PTO/TIME OFF → planned_vacation
VIDEO DOWN/DOXY DOWN/TECH ISSUE → technology_failure

For same_day_sick or emergency:
1. Find all appointments today after reportedAt that are scheduled or confirmed.
2. SMS provider: "PsychRx: Got it. You have [X] sessions today. Reply: COVER (find coverage) / RESCHEDULE (move to next available) / PHONE (you call from home) / CANCEL (cancel with no charge to patients)"
3. Insert into provider_absences with status=pending_decision.
4. SMS owner immediately.

processCoverageDecision(providerPhone, decision):
Find pending absence for this provider.
Get affected appointments.
Route to: findAndAssignCoverage / rescheduleAllAffected / convertToPhoneSessions / cancelWithWaiver

findAndAssignCoverage(appointments, absentProvider):
For each appointment find a candidate who:
  - Same provider_type as absent provider
  - Has insurance panel matching patient's payer
  - No existing appointment at this exact start_time
  - Active caseload under limit
  - Licensed in patient's state
SMS first candidate: "PsychRx: Coverage needed. [Patient first name + last initial] at [time] — same as your specialty. Reply YES to cover, NO to pass. 15 minutes."
If YES in 15 min: create new appointment with covering provider, cancel original, SMS patient new link.
If NO or timeout: try next candidate.
If no candidate: rescheduleOneAppointment instead.

handlePlannedVacation(provider, message):
Call Claude to extract dates: returns {"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","found":bool}
If not found: SMS provider "Please reply: VACATION [start date] to [end date]. Example: VACATION Dec 20 to Jan 3"
Update all available_slots in date range to status=blocked, block_reason=provider_vacation.
Find all appointments in date range. Reschedule each.
SMS provider: "PsychRx: Vacation [start] to [end] blocked. [X] appointments rescheduled. Patients notified."

handleTechnologyFailure(provider, failedAt):
Find appointment where start_time <= failedAt <= end_time (active session).
If found: SMS provider "Your session is still active. Call patient now: [patient phone]. Reply CALLNOW when connected."
SMS patient: "PsychRx: Technical issue with your video session. Your provider will call you at this number shortly."
If CALLNOW received: update appointment session_modality=phone, conversion_reason=technology_failure.
If no active session: find next appointment within 30 min. Offer PHONE/DELAY 15min/CANCEL options.
"""

PROMPT_8 = """
Create billing and contract systems.

services/billing/superbill.ts:
generateAndDeliverSuperbill(encounterId):
Pull encounter + patient + provider + appointment from Supabase.
Build PDF using pdf-lib:
  Header: navy rectangle, "PsychRx" in white, "SUPERBILL" label
  Practice section: PsychRx LLC, Group NPI, EIN, 1-833-PSYCHRX, psychrx.com
  Provider section: first name, last name, credentials, individual NPI, license number + state
  Patient section: full name, date of birth (spelled out)
  Service section: date of service, CPT code + description, ICD-10 + description, place of service, charge amount
  For phone sessions: note POS 10, phone CPT code, audio-only modifier, reason for telephone
  Payment section: "Amount charged: $X / Amount paid by patient: $X / Balance due: $0"
  Instructions: 4-step OON reimbursement guide
  Footer: navy bar with contact info
Store in Supabase storage bucket superbills/[patient_id]/[encounter_id].pdf.
Create signed URL with 30-day expiry.
Insert into patient_documents.
Email patient via Resend with download link.
SMS patient with short URL.

services/payments/stripe-connect.ts:
createProviderStripeAccount(providerId, email): Create Express account, store stripe_connect_id.
getProviderOnboardingLink(stripeConnectId, providerId): Return account link URL.
transferToProvider(stripeConnectId, amountCents, description): Create transfer.
checkProviderStripeStatus(stripeConnectId): Return {ready, issues}.

services/contracts/docuseal.ts:
sendProviderContracts(providerId):
Create ICA document via DocuSeal API.
ICA key terms to include:
  Provider is independent contractor not employee
  Revenue split: provider 75%, PsychRx 25%
  No-show fee split: same 75/25
  Provider maintains own malpractice insurance
  Provider responsible for PDMP checks, DEA compliance, Ryan Haight
  Provider may list 1-833-PSYCHRX as contact on Psychology Today profile
  PsychRx manages PT profile during agreement — provider reclaims within 5 days of termination
  30-day written termination notice required
  12-month patient non-solicitation after termination
Create BAA document via DocuSeal API.
BAA key terms: HIPAA compliance obligations, 60-day breach reporting, minimum necessary access.
Both sent to provider email simultaneously.
Webhook at /api/contracts/sign-webhook receives completion events.
On both signed: advance onboarding to next stage, SMS provider.

sendPatientConsents(patientId, platform):
PsychRx platform: Telehealth Informed Consent (FL Statute 456.47), Patient Services Agreement, Notice of Privacy Practices.
All via DocuSeal embedded signing.
Block appointment booking until all consents signed.

services/billing/edi.ts:
This file handles claim submission to Office Ally.
Use the Stedi API to convert encounter data to EDI 837P format.
Stedi documentation: stedi.com/app/guides/healthcare

buildClaim837P(encounter):
Format encounter object as Stedi JSON payload.
Key fields: billing_provider (Group NPI), rendering_provider (individual NPI), subscriber (patient + member ID + payer), service_line (CPT + ICD-10 + charge + POS + date).
Submit to Stedi API which converts to EDI and routes to Office Ally.
Return claim_id from response.
Store claim_id in encounters.claim_id.

parseERA835(eraFile):
Parse EDI 835 Electronic Remittance Advice from Office Ally.
Extract per claim: paid amount, denial code, denial reason, patient responsibility, adjustment codes.
CO adjustments = contractual write-off (patient does not owe).
PR adjustments = patient responsibility (patient owes).
Update encounters table: amount_paid, paid_at, claim_status, denial_code, denial_reason.
Trigger provider payment calculation after posting.
"""

PROMPT_9 = """
Create both public websites.

app/page.tsx — psychrx.com homepage:
Design system: #1B2B4B navy, #0D9488 teal, #F8FAFC background.
Typography: Playfair Display for headlines, DM Sans for body.

Sections:
1. Nav: sticky, logo left, "For Providers" + "Refer a Patient" center, "Book Appointment" teal button right.

2. Hero: two-column grid. Left column:
   Badge pill: green dot + "AVAILABLE THIS WEEK · SOUTHWEST FLORIDA"
   Headline: "Mental health care matched to you." (teal "matched to you")
   Subline: "Board-certified therapists and psychiatric providers. Major insurance accepted. Sessions available this week."
   Two buttons: "Book Your Appointment →" (teal) and "1-833-PSYCHRX" (ghost)
   Insurance pills: Aetna, Cigna, United, BCBS FL, Humana
   Right column: patient portal preview card showing upcoming appointment with green Join Session button.

3. Stats bar: white background, 4 columns separated by borders: "120+ Licensed providers", "3 days Average wait", "24/7 Online scheduling", "5 Major insurance plans"

4. Services: 3 hover cards. Therapy (LCSW·LMFT·LPC), Medication Management (PMHNP·Psychiatrist), Psychological Testing (PhD·PsyD). Teal icon, title, credential line, description.

5. How it works: 4 numbered steps with connecting vertical line. 1-Tell us what you need, 2-Verify insurance, 3-We match you instantly, 4-Meet this week. CTA button.

6. Provider CTA: full-width navy section with teal glow circles. "Join PsychRx. We fill your schedule." 5 benefit items with checkmarks. Apply button.

7. Footer: logo, 1-833-PSYCHRX, links.

Dark theme: #0F1923 background, #14B8A6 teal accent.
Typography: Syne font headings.

app/refer/page.tsx — Physician referral form:
Your info: name, NPI, fax, practice name.
Patient info: name, DOB, phone, insurance.
Reason: checkboxes (ADHD, anxiety, depression, postpartum, PTSD, medication management, therapy, testing).
Urgency: radio buttons (routine/soon/urgent).
Notes textarea.
Submit → POST /api/referrals/submit
Success state: "We'll fax you confirmation within 24 hours of the patient being seen."

app/providers/join/page.tsx:
8-item benefits grid with checkmarks.
Provider types accepted list.
Earnings calculator: input sessions per week → shows monthly earnings at 75%.
Apply Now button.

app/providers/apply/page.tsx:
6-step application:
Step 1: Basic info (name, credentials, NPI, email, phone, provider_type)
Step 2: License + malpractice upload
Step 3: Insurance panels checkboxes
Step 4: Specialties + conditions treated
Step 5: Weekly availability builder
Step 6: Review + submit
On submit: create providers record → send DocuSeal contracts → welcome SMS.

app/schedule/page.tsx — 7-step booking:
Step 1: Service type (3 large clickable cards)
Step 2: Insurance select + member ID + verify button (shows result or cash pay rates)
Step 3: Provider match (2-3 cards: first name + last initial + credentials + next available — no photos, no full last names, no browsing)
Step 4: Time selection (14-day calendar + time slots by morning/afternoon/evening)
Step 5: Patient info (name, DOB, email, phone, state, emergency contact — required)
Step 6: Card on file (Stripe Payment Element + disclosure + checkbox agreeing to cancellation policy)
Step 7: Confirmation (checkmark animation, appointment details, add-to-calendar buttons)
NO form tags anywhere. Use button onClick handlers only.
Progress bar updates each step. Back button on each step.
"""

PROMPT_10 = """
Create complete patient portal at app/patient-portal/

app/patient-portal/layout.tsx:
Auth check — redirect to /patient-portal/login if not authenticated.
Top navigation: My Appointments, Messages, Billing, Account.
Crisis footer on every page — always visible:
"If you are in crisis: Call or text 988 | Emergency: Call 911"
Teal background bar, white text, bottom of every page.

app/patient-portal/dashboard/page.tsx:
NEXT APPOINTMENT CARD (most prominent element):
Provider first name + credentials.
Date fully spelled out: "Thursday, November 14 at 2:00 PM"
Session type badge: VIDEO SESSION or PHONE SESSION
VIDEO: large teal "Join Session" button → appointment.telehealth_link. Button activates (green glow) 15 minutes before session.
PHONE: "Your provider will call you at your appointment time" badge. Show patient's phone number on file.
Add to Google Calendar link.
Add to Apple Calendar link.
Reschedule link (small, below card).

MY CARE TEAM:
Cards for each assigned provider (up to 2). First name, credentials, specialties (3 max). Message button.

OUTCOME MEASURES (if due based on session count):
Yellow banner: "Your provider has requested a brief questionnaire. It takes 2 minutes."
Take questionnaire button → /patient-portal/questionnaire

RECENT MESSAGES: 2 previews with timestamps. View All link.

BILLING SUMMARY: Insurance payer, copay amount, outstanding balance if any.

QUICK ACTIONS ROW: Schedule Appointment, Message Provider, Download Superbill, Update Insurance.

app/patient-portal/appointments/page.tsx:
UPCOMING section:
Each appointment: provider, date/time, modality badge, action buttons.
RESCHEDULE: check reschedule_count_this_month. If >=2 show "Monthly limit reached. Call 1-833-PSYCHRX." If <2 show calendar. If <24hr show $100 fee warning. If <2hr show $150 fee warning. 
CANCEL: 24+hr = no fee confirm modal. Under 24hr = $100 fee disclosed, must type CANCEL to confirm. Under 2hr = $150 fee. 

REQUEST SOONER APPOINTMENT: urgency selector (routine/soon/urgent) + reason → adds to waitlist.

PAST APPOINTMENTS: date, provider, session type, amount billed, insurance paid, patient owed. Download Superbill per session.

app/patient-portal/messages/page.tsx:
Message type selector before composing:
[General Message] [Refill Request] [Side Effect Report] [Urgent Concern]
Urgent Concern shows: "For emergencies call 911 or 988. Providers respond within 1 business day. This is not a crisis service."
Refill Request form: medication name, days remaining, pharmacy name + location.
Side Effect Report form: medication, symptom description, severity 1-10, duration.
If severity >= 8: triggers provider urgent SMS alert in addition to portal message.
Thread: provider messages left in teal bubbles, patient messages right in navy bubbles.
Clinical disclaimer always at bottom: "This is secure clinical messaging. For emergencies call 988 or 911."
No PHI in SMS notifications — SMS only says "New message in your PsychRx portal."

app/patient-portal/billing/page.tsx:
Insurance with update form.
Superbill list with download buttons.
Outstanding balance with pay button (Stripe).
Payment plan option if balance > $100.
FSA/HSA: "This receipt can be submitted to your FSA or HSA for reimbursement."

app/patient-portal/account/page.tsx:
Email update (verification code via SMS).
Phone update (verification code via SMS).
Address fields.
Emergency contact (name, phone, relationship).
Preferred pharmacy (name, location).
Session modality preference: Video preferred / Phone preferred / No preference.
SMS notification preference toggle.
Telehealth consent status with date signed.
"""

PROMPT_11 = """
Create complete provider portal at app/portal/

app/portal/layout.tsx:
Auth check — provider must have status=active.
LEFT SIDEBAR (navy background):
Top: PsychRx logo + provider name + credentials.
Navigation items with lucide-react icons:
  Dashboard, Schedule, My Patients, Submit Note, Earnings, Messages, Availability, Documents, Settings
Badge counts on Messages and Submit Note (unread/overdue counts).
Bottom of sidebar: gradient card showing next payment amount + date (Friday).

app/portal/dashboard/page.tsx:
PAYMENT CELEBRATION BANNER:
Check provider_payments where celebration_shown=false.
If exists: full-width banner with emoji + "Your payment of $[amount] is on its way!" + session count + patients helped + dismiss button.
Dismiss sets celebration_shown=true.
Celebration levels: standard=💰, good=🎉, great=🚀, milestone=🏆

TODAY'S SESSIONS LIST:
Time + patient first name + last initial + insurance payer + session type.
Video sessions: "Join Doxy" button (teal, activates green 15 min before) → provider.telehealth_link
Phone sessions: "Call Patient" button showing patient phone number (tap to dial).
Completed sessions: green "✓ Done" badge.

METRICS CARDS (2x2 grid):
Card 1: Fill Rate — gauge showing percentage, green >80%, yellow 60-80%, red <60%.
Card 2: Notes Due — count in red if any, Submit Now link.
Card 3: Next Payment — estimated amount based on this week's completed sessions.
Card 4: Document Alerts — any expiring within 60 days with upload button.

EXTERNAL ALERTS (if any pharmacy calls or PA requests came in):
Formatted alert cards with action buttons and provider's direct phone for callback.


app/portal/scribe/page.tsx:
Step 1: Select appointment from today's completed sessions list.
Step 2: Confirm session type (new patient/follow-up) + modality. If phone: select reason (provider_preference / technology_failure / patient_request).
Step 3: Text area for session summary OR microphone button for voice dictation (Web Speech API).
Placeholder: "Type 2-3 sentences about the session. AI will generate the complete clinical note."
Step 4: AI generates note (stream the response for real-time UX).
Step 5: Review complete note. CPT suggestion shown with reasoning.
Step 6: Audit results displayed. Green checkmarks for passed checks. Red items for issues. Yellow for warnings.
Step 7: Attest and Submit button. Creates encounter record. Claim queued for submission.

app/portal/patients/page.tsx:
Search input. Filter tabs: All / Active / No Upcoming / High Risk.
Patient cards: name, next appointment date, insurance, session count, no-show risk badge (green/yellow/red).
Click → /portal/patients/[id]

app/portal/patients/[id]/page.tsx:
Patient header: name, DOB, insurance, verification badge.
Care summary: primary diagnosis, treatment start date, total sessions, last outcome measure score.
PHQ-9 trend chart (line chart showing scores over time if multiple entries).
Upcoming appointments: reschedule/cancel buttons.
Session history: date, CPT description, amount, claim status.
Messages thread.
Internal referral button: "Refer to medication management" or "Refer to therapy" → creates internal_referral record.
Action buttons: Schedule New, Submit Note, Message Patient.

app/portal/earnings/page.tsx:
Current period: sessions, gross billed, PsychRx fee (25%), your amount (75%).
Payment history table: date range, sessions, gross, your amount, transfer status, date paid.
Milestones: unlocked achievements displayed with award date.
YTD total + all-time total.
Download CSV for 1099 tax preparation.
1099 YTD amount notice.

app/portal/availability/page.tsx:
Weekly schedule grid: toggle each day, set start/end times, session duration, buffer minutes, max sessions per day.
New patients toggle.
Block specific date picker + reason field.
Vacation request input: "VACATION Dec 20 to Jan 3" format. Submit sends VACATION command to coverage algorithm.
Save generates available_slots records for next 60 days.

app/portal/documents/page.tsx:
Documents list with color-coded expiry: green (>60 days), yellow (14-60 days), red (<14 days), grey (missing/expired).
Upload button per document type.
CAQH last attested date with manual update field + link to proview.caqh.org.
Collaborative agreement status + expiry for FL PMHNPs.
ICA signed status + BAA signed status. Request new contracts button.

app/portal/settings/page.tsx:
Email update with SMS verification.
Phone update with SMS verification.
Bank account: "Connect Bank Account" button → redirect to Stripe Connect onboarding URL.
Doxy.me link update field.
Direct prescribing phone + fax for pharmacy/insurance callbacks.
Psychology Today profile URL field.
Platform preference: PsychRx only at this stage.
"""

PROMPT_12 = """
Create complete admin dashboard at app/admin/

app/admin/layout.tsx:
Auth check — admin role only. Anyone else redirect to home.
Dark sidebar with admin navigation.

app/admin/dashboard/page.tsx:
LIVE METRICS ROW (refresh every 60 seconds):
Active providers, active patients, sessions today, claims pending ($), your 25% this week, overall fill rate.

LIVE PAYMENT FEED (Supabase Realtime):
Subscribe to encounters where claim_status changes to paid.
Animate new card in: "[Payer] paid $[amount] — [patient initial] with [provider initial], CPT [code], Your 25%: $[amount]"
Show last 10. Stack newest at top.

LIVE SESSION MONITOR:
All appointments within next 3 hours.
Status badges:
  ✅ In Progress (session_started_at exists)
  🔔 Starting Soon (within 30 min, no started_at)
  ⚠️ Overdue (past start time, no started_at) — row highlighted red
  📅 Upcoming (>30 min away)
For Overdue rows: "Charge No-Show" button.
For In Progress: "Provider Confirmed" badge if ATTENDED reply received.

PROVIDER PIPELINE:
Kanban view of all providers in onboarding.
Stages match provider_onboarding_status columns.
Provider stuck in same stage >7 days → amber highlight.
Click provider → view their onboarding status detail.

BILLING CENTER:
Claims pipeline: Pending X | Submitted $X | Paid $X | Denied X (needs action)
Denied claims work queue: patient, CPT, denial code, denial reason, "Generate Appeal" button.
Timely filing alerts: claims within 30 days of deadline highlighted.

CAMPAIGN METRICS:
Provider recruit row: faxes sent today, this week responses, conversions, current allocation %.
Referral sources row: faxes sent today, active referrers, referrals this week, conversion rate.
Balance engine row: current decision, urgency level, last run timestamp, next run countdown.
Allocation bar: shows current Provider %% | Referrers %% split visually.

OWNER ACTIONS:
"Send Weekly Report SMS Now" button — triggers summary SMS immediately.
"Force Balance Check" button — runs balance engine immediately.

app/admin/providers/page.tsx:
Full table: name, type, platform, status, fill rate, sessions/month, next payment, document status, actions.
Filters: status, provider_type, platform.
Per-row: View | Suspend | Activate | Message.
Suspended providers shown in red.

app/admin/balance/page.tsx:
Current decision with explanation.
Allocation sliders for manual override (with warning: "Balance engine will revert at next run").
Force rerun button.
Decision log: last 10 decisions with timestamps, reasoning, urgency.
Scraper queue: contacts pending outreach, sent today, remaining capacity.

app/admin/compliance/page.tsx:
All providers × all document types in grid.
Color-coded by expiry.
OIG check history: last checked, result, next scheduled.
CAQH attestation status.
Security incidents list.
Audit log viewer with user + action + timestamp.

app/admin/coverage/page.tsx:
Active absences with status.
Coverage decisions in progress.
Today's affected sessions.
Covered / rescheduled / cancelled counts.
"""

PROMPT_13 = """
Create all API routes.

app/api/appointments/book/route.ts (POST):
1. Verify patient from Supabase session.
2. Check telehealth_consent_signed on patient record.
3. If phone session preference: check audio_only_consent_signed.
4. Check prior auth required (checkPriorAuth from constants).
5. Hold slot: status=held, held_until=now+2hours, held_for_patient=patientId.
6. Create appointment record.
7. Create pending_confirmation with token + 2hr expiry.
8. SMS patient with confirmation link: psychrx.com/confirm/[token]
9. SMS provider: "New patient matched — [day] at [time]. View: psychrx.com/portal"
10. Create session_checkin record.
11. Return { appointmentId, token, telehealthLink }

app/api/appointments/confirm/[token]/route.ts (POST):
1. Find pending_confirmation by token.
2. Check not expired (expires_at > now).
3. Update appointment status=confirmed.
4. Update slot status=booked.
5. Delete pending_confirmation.
6. Return { success, appointmentDetails }

app/api/appointments/reschedule/route.ts (POST):
1. Check reschedule_count_this_month on patient.
2. If >=2 return error: "Monthly reschedule limit reached. Call 1-833-PSYCHRX."
3. Calculate hours until appointment.
4. If <24hr: charge $100 fee to patient Stripe customer 
5. If <2hr: charge $150 fee 
6. Release old slot: status=available, appointment_id=null.
7. Create new appointment on requested slot.
8. Increment reschedule_count_this_month.
9. Log to patient_behavior_log.
10. SMS patient confirmation of new time.
11. Return { success, newAppointment }

app/api/appointments/cancel/route.ts (POST):
1. Calculate hours until appointment.
2. Determine fee: 24+hr=$0, <24hr=$100, <2hr=$150.

4. If fee>0: check courtesy_waiver_used. If false: apply waiver, set courtesy_waiver_used=true, fee=$0.
5. Charge fee if applicable to patient.stripe_customer_id.
6. Update appointment status=cancelled.
7. Release slot to fill algorithm.
8. Log to patient_behavior_log.
9. SMS patient with fee info and reschedule link.
10. Return { success, feeCharged }

app/api/insurance/verify/route.ts (POST):
Input: { payer, member_id, dob, service_type }
Development mode: return mock data { verified:true, planName:"Aetna PPO", copay:30, deductible:500, active:true }
Production (Availity): POST to Availity eligibility API with OAuth token.
Parse response for active status, plan name, copay, deductible.
Update patients table with verified data and insurance_verified_at timestamp.
Return { verified, planName, copay, deductible, active }

app/api/referrals/submit/route.ts (POST):
1. Create patient record from form data.
2. Add to waitlist with urgency based on form selection.
3. If referral_sources record exists for referring NPI: increment total_referrals.
4. SMS patient within 15 minutes.
5. Queue fax-back confirmation to referring physician's fax number.
6. Trigger instant matching via realtime event (INSERT fires automatically).
7. Return { success, patientId }

app/api/fax/inbound/route.ts (POST — Telnyx webhook):
Verify Telnyx webhook signature.
Identify sender from fax number using resolveIdentity('fax', fromNumber).
Use Claude to read and classify fax content.
If referral: extract patient name, DOB, phone, insurance, reason, urgency. Create patient. Queue confirmation fax.
If pharmacy: log + find relevant provider + SMS provider with pharmacy phone.
If unknown: log to inbound_contacts for manual review.
Return 200 immediately (Telnyx requires fast response).

app/api/voice/inbound/route.ts (POST — Twilio webhook):
Detect called number from To field.
Select time-appropriate greeting and identify caller.
Identify caller.
Synthesize greeting via ElevenLabs.
Upload audio to Supabase temp-audio bucket.
Store call context in ai_interactions.
Return TwiML VoiceResponse with gather pointing to /api/voice/process.

app/api/voice/process/route.ts (POST — Twilio gather):
Check SpeechResult for crisis words first.
If crisis: synthesize crisis response, return TwiML to play and hang up, alert provider and owner via SMS.
If not crisis: get context from ai_interactions, call callCarol(), synthesize response, store audio, return TwiML gather, update conversation history.

app/api/sms/inbound/route.ts (POST — Twilio webhook):
Crisis check on every message first.
Command detection (case-insensitive trim).
Route known commands to appropriate handlers.
Everything else: call callCarol() and SMS the response.
Log to ai_interactions.

app/api/providers/onboard/route.ts (POST):
Accept step number + step data.
Step 1: Create providers record with status=pending.
Step 3: Call DocuSeal API to send ICA + BAA. Store docuseal_ids in contracts table.
Step 5: Create Stripe Connect Express account. Return onboarding URL in response.
Step 13 (complete): Set provider status=active. SMS welcome message. Queue OIG check.
Update provider_onboarding_status at each step.

app/api/stripe/connect/route.ts (POST):
Get or create Stripe Connect account for provider.
Return onboarding URL for redirect.

app/api/stripe/webhook/route.ts (POST):
Verify Stripe webhook signature using stripe-signature header.
Handle payment_intent.succeeded: update encounter amount_paid + claim_status=paid.
Handle account.updated: update provider stripe_connect_ready status.
Handle transfer.created: update provider_payment transfer_status=sent.
Return 200 for all events.

app/api/scribe/generate/route.ts (POST):
Already specified in Prompt 6. Connect it to encounter creation after attestation.

app/api/contracts/sign-webhook/route.ts (POST — DocuSeal webhook):
When document signed event received:
Update contracts table with signed_at timestamp.
Check if both ICA and BAA signed for this provider.
If both signed: advance provider_onboarding_status to next stage. SMS provider "Contracts signed ✓ — next step: connect bank account at psychrx.com/portal/settings"

app/api/payments/setup-intent/route.ts (POST):
Get or create Stripe customer for patient.
Create Stripe SetupIntent.
Return client_secret for frontend Stripe Elements.
"""

PROMPT_14 = """
Create services/compliance/gap-fixes.ts with all 25 gap implementations.

GAP 1 — Telehealth consent blocking:
requireTelehealthConsent(patientId): Query patient_documents for signed telehealth_consent within last 365 days. Return true/false. Booking API checks this before proceeding.

GAP 2 — Two-factor authentication:
send2FA(userId, phone): Generate 6-digit code. Hash with bcrypt (10 rounds). Store in two_factor_codes with 10-minute expiry. SMS code to provider.
verify2FA(userId, code): Check hash matches. Check not expired. Check attempts <5. If >5 attempts: lock. On success: delete code record. Return true/false.
Apply to all portal login flows in middleware.

GAP 3 — Prior authorization workflow:
checkPriorAuth(patientId, cptCode, payer): Check PRIOR_AUTH_MATRIX from constants for always-required CPT codes. Check session count thresholds by counting paid claims for this patient+CPT. Return { required, reason, portal, phone } if PA needed. Block appointment booking if required and no auth_number in prior_authorizations for this patient.

GAP 4 — State licensure verification:
checkProviderLicensedInState(providerId, patientState): Query provider_licenses for active license in patient's state. Return { eligible, reason }. Check in booking flow before confirming.

GAP 5 — Controlled substance compliance:
checkControlledSubstanceCompliance(providerId): Check DEA number present + not expired. Return { compliant, warnings }. Warn if phone session for new patient requesting controlled substances.

GAP 6 — PDMP reminders:
Pre-session SMS to PMHNPs for patients with controlled substance flag. "FL law requires PDMP check before prescribing. Check eforcse.com. Document in note: PDMP checked [date] — [findings]."

GAP 7 — HIPAA breach response:
logSecurityIncident(type, description, patientCount): Insert into security_incidents. SMS owner immediately with action steps. Start 60-day HHS notification countdown reminder.
Anomaly detection: if any user accesses >100 records in 1 hour → flag in security_incidents.

GAP 8 — Patient discharge workflow:
initiateDischarge(patientId, providerId, reason, summary):
Notice periods by reason: treatment_goals_met=30 days, patient_request=0 days, non_attendance=14 days, behavioral_violation=0 days, escalation_of_care=7 days.
Create patient_discharges record. Notify patient. Keep existing appointments during notice period.

GAP 9 — Outcome measures:
checkOutcomeMeasureDue(patientId, careType): Count sessions since last outcome_measures entry. Medication=every 3 sessions, Therapy=every 4 sessions. Return { due, measure }.
checkCriticalOutcomeResponse(patientId, measure, question, score): If PHQ-9 Q9 score>0: add cancellation_protection on upcoming appointments, alert provider via urgent SMS, SMS patient with 988 and provider notification.

GAP 10 — OIG exclusion screening:
checkOIGExclusion(provider): Call https://exclusions.oig.hhs.gov/api/1.0/ with provider last_name + first_name + state. If NPI matches exclusion: suspend provider immediately, SMS owner "OIG EXCLUSION CONFIRMED — CONTACT ATTORNEY IMMEDIATELY." Update provider oig_check_passed + oig_last_checked. 1 second rate limit between checks.

GAP 11 — Emergency contact validation:
validateEmergencyContact(patient): Return false if emergency_contact_name or emergency_contact_phone is empty. Required at patient intake step 5.

GAP 12 — Recording consent detection:
In message handling: detect phrases like "record this session", "I am recording", "screen recording." If detected: log and SMS provider about FL two-party consent law requirement.

GAP 13 — Collaborative agreement tracking:
Check collaborative_agreements for PMHNPs. Alert at 90/60/30 days before expiry. Include link to upload renewal document.

GAP 14 — Caseload limits enforcement:
checkCaseload(providerId): Get provider_type + tier. Look up LIMITS (therapist_micro:20, therapist_part_time:35, therapist_part_time_plus:55, pmhnp_micro:50, pmhnp_part_time:90, pmhnp_part_time_plus:130). Count active patients. If at limit: set accepts_new_patients=false. Re-enable when patient discharges.

GAP 15 — SEO provider profile pages:
app/providers/[slug]/page.tsx with generateStaticParams from active providers. Schema.org LocalBusiness + Physician markup. Meta title and description using provider name + specialties + insurance. Does not show on directory — just SEO.

GAP 16 — Failed payment recovery:
handleFailedPayment(patientId, amount, appointmentId): Insert failed_payments record. If amount >=$100: set patients.scheduling_blocked=true. Schedule 3 retries: 24hr, 72hr, 168hr. SMS patient with payment link.

GAP 17 — 13-stage onboarding pipeline:
Already in schema as provider_onboarding_status. Admin dashboard shows kanban view. Flag providers stuck >7 days. SMS admin alert.

GAP 18 — Referral source relationship management:
Monthly 1st: summary fax to all active referrers (referred in last 30 days) with their referral stats.
Day 60 of no referral: reactivation fax to lapsed active referrers.

GAP 19 — CAQH re-attestation monitoring:
Alert provider at 100 days since caqh_last_attested. Critical alert at 115 days. Owner alert at 115 days. Note: missing CAQH attestation removes provider from all insurance panels.

GAP 20 — Minimum necessary access:
enforceMinimumNecessary(userId, userType, resourceType, resourceId): Admin sees all. Providers see only their patients (verified via appointments join). Patients see only their own records. Log unauthorized access attempts to audit_log.

GAP 21 — Waitlist analytics:
Track avg wait time, drop-off rate, entries by care_type in waitlist table. Include in weekly owner summary.

GAP 22 — Provider satisfaction surveys:
Monthly 1st cron: SMS all active providers "PsychRx check-in: Rate your experience 1-5 (1=not satisfied, 5=excellent). Reply with number." Score <3: SMS owner with provider name.

GAP 23 — Coordination of benefits:
secondary_insurance_payer and secondary_insurance_id fields already in schema. Bill primary first. If primary denies: bill secondary. Document in encounters.

GAP 24 — Technology requirements disclosure:
Display at booking Step 1 before service selection: "Requirements: Reliable internet (10+ Mbps), device with camera and microphone, private quiet space. Chrome or Firefox recommended."

GAP 25 — Revenue cycle KPIs:
calculateRevenueKPIs(): Last 30 days. Clean claim rate (paid/total, target 95%), denial rate (denied/total, target <5%), collection rate (collected/billed, target 95%), days in AR (avg days from service to payment, target <30). SMS owner if any metric outside target.
"""

PROMPT_15 = """
Create deployment configuration.

vercel.json:
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}

railway.toml:
[build]
builder = "nixpacks"

[deploy]
startCommand = "npx tsx workers/index.ts"
restartPolicyType = "always"
healthcheckPath = "/health"
healthcheckTimeout = 10

workers/health.ts:
Simple HTTP server on port 3001.
GET /health returns 200 with JSON { status: "ok", timestamp: new Date() }
Railway uses this to verify workers are running.

middleware.ts (Next.js middleware for route protection):
/portal/* routes: require authenticated Supabase session with provider role. Redirect to /portal/login if not authenticated.
/patient-portal/* routes: require authenticated Supabase session with patient role. Redirect to /patient-portal/login if not authenticated.
/admin/* routes: require authenticated Supabase session with admin role. Redirect to /admin/login if not.
/api/* routes: pass through (they do their own auth).
All other routes: public, pass through.

Supabase storage buckets to create in Supabase dashboard:
1. documents — private, no public access, for provider and patient documents
2. temp-audio — public, Carol voice files, set lifecycle rule to delete after 4 hours
3. superbills — private, for patient superbill PDFs

package.json scripts to add:
"workers": "tsx workers/index.ts"
"workers:dev": "tsx watch workers/index.ts"
"health": "tsx workers/health.ts"
"""

PROMPT_16 = """
Create tests/integration-checklist.md with complete integration test checklist.

Include these sections:

SECTION 1 — DATABASE:
Verify all tables exist in Supabase Table Editor.
Verify RLS policies by testing with provider user (can see own patients only) and patient user (can see own record only).
Verify campaign_config is seeded with two rows.
Verify all indexes exist in Supabase.

SECTION 2 — ELEVENLABS CAROL SETUP:
Go to elevenlabs.io → Voice Design.
Settings: gender=female, age=middle_aged, accent=american, accent_strength=0.3.
Description: "Warm, professional healthcare office manager. Midwestern. Calm. Unhurried. Trustworthy."
Stability: 0.75, Similarity boost: 0.80, Style: 0.20.
Save Voice ID to ELEVENLABS_CAROL_VOICE_ID in .env.local.

SECTION 3 — CAROL VOICE TESTS:
Call 1-833-PSYCHRX — Carol answers with correct greeting.
Text crisis keywords to 1-833-PSYCHRX — receive 988 response.
Text CONFIRM as patient — receive appointment confirmation.
Text SICK TODAY as provider — receive coverage options.
Text STOP — opt-out is logged in opt_outs table.

SECTION 4 — PATIENT JOURNEY:
Visit psychrx.com — loads with correct branding.
Complete 7-step booking — appointment created in database.
Insurance verify returns mock data in development.
Card on file collected via Stripe.
Confirmation SMS received on owner phone.
Log into patient portal — dashboard shows appointment.
Message provider — provider gets SMS notification.

SECTION 5 — PROVIDER JOURNEY:
Complete provider application — DocuSeal contracts sent to email.
Stripe Connect onboarding link works.
Log into portal — dashboard loads with correct data.
Submit encounter note — AI generates complete SOAP note.
Audit result shows approved.
Earnings page shows payment history.

SECTION 6 — WORKERS:
Run: npm run workers
All workers start without errors in console.
Health endpoint at localhost:3001/health returns 200.
Realtime listeners subscribe (confirm in console output).
Balance engine logs decision to supply_demand_log.

SECTION 7 — ADMIN:
/admin/dashboard loads.
Live session monitor shows today's appointments.
Provider pipeline shows onboarding stages.
Balance page shows current decision and allocation bars.

DEPLOYMENT STEPS:
1. Push codebase to GitHub private repository.
2. Vercel: connect GitHub repo, set all env vars from .env.local, deploy.
3. Railway: connect GitHub repo, set all env vars, set start command: npx tsx workers/index.ts, deploy.
4. Configure Twilio webhooks:
   Voice: https://psychrx.com/api/voice/inbound
   SMS: https://psychrx.com/api/sms/inbound
5. Configure Telnyx webhook: https://psychrx.com/api/fax/inbound
6. Configure Stripe webhook: https://psychrx.com/api/stripe/webhook
7. Configure DocuSeal webhook: https://psychrx.com/api/contracts/sign-webhook
8. Verify Supabase Pro plan active (HIPAA BAA available in dashboard).
9. Sign BAAs: Supabase, Twilio, Stripe, Anthropic.
10. Add Group NPI to PSYCHRX_GROUP_NPI env var.
11. Add EIN to PSYCHRX_EIN env var.
"""

# ══════════════════════════════════════════════════════════════════
# AUTONOMOUS OPERATION — WHAT RUNS WITHOUT YOU
# ══════════════════════════════════════════════════════════════════

AUTONOMOUS_OPERATION = """
EVERY 15 MINUTES — 24/7:
Appointment reminders (5-touch sequence per patient)
No-show detection at +20 minutes
$150 no-show fee auto-charged (split 75/25)
Session check-in sequences
Slot fill when cancelled — waitlist match in <60 seconds

EVERY 4 HOURS:
Supply-demand balance check
Scraper allocation adjustment (provider% vs referrer%)
Fill rate monitoring per provider
Provider churn risk detection

DAILY 9 AM WEEKDAYS:
Fax/SMS/email outreach campaigns
License + document expiry checks
OIG exclusion verification (monthly 1st)
PDMP reminders to PMHNPs

DAILY 10 AM:
Billing KPI review
Timely filing deadline alerts
Stale claim flags

SUNDAY 6 PM:
Provider weekly payments via Stripe Connect
Celebration emails + SMS
Milestone awards

SUNDAY 7 PM:
Owner weekly summary SMS

MONDAY 8 AM:
State expansion threshold check
Provider-patient balance review

REALTIME (<1 SECOND):
New patient signup → instant provider match → SMS
New provider joins → waitlist patients notified
Appointment cancelled → slot released → fill algorithm
Slot opens → waitlist offer sent

MONTHLY 1ST:
NPPES full NPI scan
CAQH attestation alerts
Active referrer monthly summary faxes
Provider satisfaction survey
OIG monthly check all providers

YOUR WEEKLY TIME: 15-20 MINUTES
Read Monday morning SMS report.
Reply YES or NO to any expansion alerts.
Review flagged compliance items.
Everything else is automatic.
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 17 — REFERRAL PARTNER SYSTEM + FAST-TRACK URL
# ══════════════════════════════════════════════════════════════════

PROMPT_17 = """
Add three features to the platform. These build on the existing
referral_sources table and campaign infrastructure.

────────────────────────────────────────────────────────────────
FEATURE 1: Fast-track physician referral URL
app/refer/[npi]/page.tsx

Dynamic page where [npi] is the referring physician's NPI number.
Every fax we send to physicians will include this URL at the bottom:
"Refer instantly: psychrx.com/refer/[their NPI]"

On page load:
1. Fetch from referral_sources table by NPI
2. If found: display physician name and practice pre-filled
3. If not found: show generic form with NPI captured
4. Display 6-field form:
   - Patient first name
   - Patient last name
   - Patient date of birth
   - Patient phone number
   - Reason (dropdown: ADHD/Anxiety/Depression/Postpartum/PTSD/
     Trauma/Medication Management/Therapy/Testing/Other)
   - Urgency (Routine/Soon/Urgent)
5. Submit: POST /api/referrals/submit with referring_npi attached
6. Success screen:
   "Referral received for [patient first name].
    We will contact them within 24 hours and
    fax you confirmation when they are scheduled."
7. Track: update referral_sources.total_referrals++

Create app/api/referrals/[npi]/stats/route.ts (GET):
Returns { physician_name, total_referrals, tier, patients_helped }
Used by the page to show a small thank-you stat if returning partner.

────────────────────────────────────────────────────────────────
FEATURE 2: Referral partner tier system

Add to referral_sources table:
  alter table referral_sources
    add column if not exists mobile_phone text,
    add column if not exists referral_tier text
      default 'standard'
      check (referral_tier in ('standard','gold','platinum')),
    add column if not exists tier_upgraded_at timestamptz,
    add column if not exists fast_track_url text
      generated always as
      ('https://psychrx.com/refer/' || coalesce(npi,'')) stored;

Tier thresholds (evaluated monthly on 1st of month):
  standard:  0-3 referrals in last 30 days
  gold:      4-11 referrals in last 30 days
  platinum:  12+ referrals in last 30 days

Add to campaign.worker.ts monthly 1st job:
evaluateReferralTiers():
  For each referral_source where responded=true:
    Count referrals in last 30 days
    Calculate new tier
    If tier changed upward:
      Update referral_tier and tier_upgraded_at
      Send tier upgrade fax (see content below)
    Send monthly summary fax regardless

TIER UPGRADE FAX CONTENT:
Standard → Gold:
"TO: Dr. [name]
FROM: PsychRx Mental Health Network
RE: You are now a Gold Partner!

Dr. [name], your practice referred [X] patients to PsychRx
this month. Thank you.

As a Gold Partner your referrals receive:
✓ Priority scheduling — appointment within 48 hours guaranteed
✓ Direct fax confirmation on every patient seen
✓ Monthly outcome summary for your records

Continue referring at:
psychrx.com/refer/[NPI]
Or fax to 1-833-PSYCHRX"

Gold → Platinum:
"TO: Dr. [name]
FROM: PsychRx — Patrick Charles, PMHNP-BC
RE: Platinum Partner Status

Dr. [name], your practice is one of PsychRx's
highest-volume referral partners. [X] patients
referred this month.

As a Platinum Partner:
✓ Same-day scheduling available for urgent referrals
✓ Monthly patient outcome summaries
✓ Direct line to our clinical coordinator
✓ Named as preferred referral partner in our records

psychrx.com/refer/[NPI] | 1-833-PSYCHRX"

MONTHLY SUMMARY FAX (all active partners, 1st of month):
"TO: Dr. [name] | FROM: PsychRx
RE: Monthly Partner Report

Partner tier: [STANDARD/GOLD/PLATINUM]
Referrals from your practice this month: [X]
Patients scheduled: [X]
Average days to appointment: [X]

[If within 2 referrals of next tier:]
You are [X] referrals away from [tier] status this month.

Refer instantly: psychrx.com/refer/[NPI]"

────────────────────────────────────────────────────────────────
FEATURE 3: NPPES mobile phone extraction

In workers/nppes.worker.ts update scanNewNPIs():
When parsing NPPES results, also extract:
  addresses[1]?.telephone_number as mobile_phone
  (Mailing address field — sometimes a personal mobile)

Store in referral_sources.mobile_phone (separate from phone).

In campaign.worker.ts isEligibleToContact():
For SMS channel: try mobile_phone first, fall back to phone.
Mobile numbers have higher SMS deliverability than landlines.
Track which field delivered successfully per contact.
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 18 — FINANCIAL FAIRNESS SYSTEM
# ══════════════════════════════════════════════════════════════════

PROMPT_18 = """
Create services/billing/financial-fairness.ts:

const FPL_2026: Record<number, number> = {
  1: 15650, 2: 21150, 3: 26650, 4: 32150,
  5: 37650, 6: 43150, 7: 48650, 8: 54150
}

export function calculateFPL(
  annualIncome: number,
  householdSize: number
): number {
  const fpl = FPL_2026[Math.min(householdSize, 8)]
  return (annualIncome / fpl) * 100
}

export const SLIDING_SCALE_TIERS = {
  A: { fpl_max: 100, therapy_60: 10, therapy_45: 8,
       med_99214: 15, med_99213: 10, eval: 25 },
  B: { fpl_max: 150, therapy_60: 25, therapy_45: 20,
       med_99214: 35, med_99213: 25, eval: 50 },
  C: { fpl_max: 200, therapy_60: 50, therapy_45: 40,
       med_99214: 65, med_99213: 50, eval: 100 },
  D: { fpl_max: 300, therapy_60: 100, therapy_45: 80,
       med_99214: 120, med_99213: 90, eval: 175 },
  E: { fpl_max: 999, therapy_60: 200, therapy_45: 165,
       med_99214: 200, med_99213: 165, eval: 325 }
}

export function getSlidingScaleTier(fplPercentage: number) {
  if (fplPercentage <= 100) return 'A'
  if (fplPercentage <= 150) return 'B'
  if (fplPercentage <= 200) return 'C'
  if (fplPercentage <= 300) return 'D'
  return 'E'
}

export const BILLING_HARD_RULES = {
  NO_SAME_DAY_CANCELLATION: {
    description: 'No billing for cancellation within 24 hours',
    hours_minimum: 24,
    requires_override: 'medical_director'
  },
  QUESTIONNAIRE_PROTECTION: {
    description: 'Distress flag = automatic appointment protection',
    triggers: ['mental_health_struggling','suicidal_thoughts','medication_concerns']
  },
  NO_NOTICE_WITHIN_72_HOURS: {
    description: 'No final balance notice within 72 hours of appointment',
    hours_minimum: 72
  },
  CLINICAL_URGENCY_SLA: {
    description: 'Provider urgency flag = 4 hour resolution',
    sla_hours: 4
  },
  COMMUNICATION_SLA: {
    standard: 24,
    billing_dispute: 4,
    clinical_urgency: 1,
    cancellation_complaint: 2
  },
  BALANCE_HOLD_NOT_CANCEL: {
    description: 'Balance = hold future scheduling, never cancel existing'
  },
  PAYMENT_PLAN_THRESHOLD: {
    description: 'Auto-offer payment plan for balance over $100',
    threshold: 100
  }
} as const
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 19 — MULTI-DATABASE SCRAPER EXPANSION
# ══════════════════════════════════════════════════════════════════
# Adds 12 new data sources beyond NPPES.
# All free. No captcha. Direct downloads or simple scrapers.
# Adds 60,000-100,000 new FL contacts to referral pipeline.

PROMPT_19 = """
Expand the data ingestion system to pull from 12 additional
databases beyond NPPES. Create workers/data-ingestion.worker.ts
that runs these on schedule.

────────────────────────────────────────────────────────────────
DATABASE SCHEMA ADDITIONS

Run in Supabase SQL editor before building the worker:

-- Add source tracking to referral_sources
alter table referral_sources
  add column if not exists source_database text
    default 'nppes'
    check (source_database in (
      'nppes','pecos','fl_mqa','fl_ahca','fl_bar',
      'fl_cert_board','fl_corps','samhsa','cms_nursing',
      'pt_directory','nbcc','nasw','apa_locator',
      'aamft','mdvip','castle_connolly','hrsa_fqhc'
    )),
  add column if not exists referral_source_type text
    check (referral_source_type in (
      'physician','therapist','psychologist','pmhnp',
      'lcsw','lmft','lmhc','bcba','cap','peer_support',
      'family_law_attorney','pi_attorney','workers_comp_attorney',
      'criminal_attorney','immigration_attorney','elder_law_attorney',
      'substance_abuse_facility','crisis_unit',
      'partial_hospitalization','eap_program',
      'urgent_care','hospital_discharge','pharmacist',
      'concierge_medicine','addiction_counselor','school_counselor',
      'snf_facility','home_health_agency','staffing_agency','unknown'
    )),
  add column if not exists mobile_phone text,
  add column if not exists referral_tier text
    default 'standard'
    check (referral_tier in ('standard','gold','platinum')),
  add column if not exists tier_upgraded_at timestamptz,
  add column if not exists last_referral_date date,
  add column if not exists patient_source text;

-- Add source tracking to patients
alter table patients
  add column if not exists patient_source text
    check (patient_source in (
      'physician_referral','eap','hospital_discharge',
      'payer_directory','self_schedule','pt_directory',
      'school_counselor','attorney_referral','facility_discharge',
      'peer_support','pharmacist','urgent_care','other'
    ));

create index if not exists on referral_sources (source_database);
create index if not exists on referral_sources (referral_source_type);
create index if not exists on referral_sources (referral_tier);

────────────────────────────────────────────────────────────────
WORKER SCHEDULE

workers/data-ingestion.worker.ts:

Import and schedule all functions:

DAILY (API calls — lightweight):
cron '0 2 * * *':  scanNewNPIs()         // already in nppes.worker
                   scanPECOS()            // active Medicare billers
                   scanSAMHSAfacilities() // treatment facilities

WEEKLY Sunday 3 AM:
cron '0 3 * * 0':  scoreAndRankContacts() // re-score all contacts
                   syncCMSUtilization()   // high-volume physicians

MONTHLY 1st 3 AM:
cron '0 3 1 * *':  scrapeFLMQA()          // LMHC, LMFT, BCBA, CAP
                   scrapeFLBar()          // attorneys
                   scrapeFLAHCA()         // facilities
                   scrapeFLCertBoard()    // peer support, CAP
                   scrapePTDirectory()    // Psychology Today
                   scrapeNBCC()           // national counselors
                   scrapeNASW()           // social workers
                   scrapeAPALocator()     // psychologists
                   scrapeAAMFT()          // marriage therapists
                   scrapeMDVIP()          // concierge medicine
                   notifyOwnerOfNewContacts()

────────────────────────────────────────────────────────────────
FUNCTION 1: scanPECOS()
Cross-reference NPPES with active Medicare billers.
Download URL: data.cms.gov/provider-characteristics/
  medicare-provider-supplier-enrollment/
  order-and-referring-providers
Format: CSV. No API key needed. Free.

Parse CSV and for each row:
  Look up NPI in referral_sources table
  If found: update pecos_verified=true, pecos_last_checked=today
  Active Medicare biller = higher score (+15 bonus)

Add to referral_sources:
  alter table referral_sources
    add column if not exists pecos_verified boolean default false,
    add column if not exists pecos_last_checked date;

────────────────────────────────────────────────────────────────
FUNCTION 2: scrapeFLMQA()
Florida Department of Health Medical Quality Assurance
URL: mqa-internet.doh.state.fl.us/MQASearchServices/Home
No captcha. POST request to their search endpoint.

License types to scrape:
  MH → LMHC (Licensed Mental Health Counselor)
  MF → LMFT (Licensed Marriage and Family Therapist)
  SW → LCSW (Clinical Social Worker)
  ABA → BCBA (Board Certified Behavior Analyst)
  AP → CAP (Certified Addiction Professional)
  PY → Psychologist (PhD/PsyD)

For each license type:
1. POST to search endpoint with license_type filter
2. Parse paginated HTML results with cheerio
3. Extract: name, license_type, city, zip, status
4. Filter: status = Active only
5. Filter: skip if NPI already exists in referral_sources
   (MQA has no NPI — match by name+city if possible)
6. Insert new records:
   source_database = 'fl_mqa'
   campaign = 'provider_recruit' (for LMHC/LMFT/LCSW)
   OR campaign = 'referral_source' (for BCBA/CAP)
   score = 15 (base — no fax yet)
   referral_source_type = appropriate type

Rate limit: 2 second delay between page requests.
Estimated new contacts: 20,000-30,000

────────────────────────────────────────────────────────────────
FUNCTION 3: scrapeFLBar()
Florida Bar attorney directory.
URL: www.floridabar.org/directories/find-mbr/
No captcha. POST to their search endpoint.

Practice areas to scrape:
  - Family Law (practice_area_code = 'FAM')
  - Personal Injury (practice_area_code = 'PER')
  - Workers Compensation (practice_area_code = 'WRK')
  - Criminal Law (practice_area_code = 'CRI')
  - Elder Law (practice_area_code = 'ELD')
  - Immigration (practice_area_code = 'IMM')

Counties to target first:
  Lee, Collier, Charlotte, Sarasota, Manatee
  (SW Florida priority)

For each attorney found:
  source_database = 'fl_bar'
  campaign = 'referral_source'
  referral_source_type = appropriate attorney type
  score = 20 (attorneys are high-value referrers)

ATTORNEY OUTREACH NOTE:
Different message template than physicians.
Lead with: psychological evaluations + expert witness.
NOT clinical referrals.
Cash pay framing. No insurance discussion.
Letter format — not fax cover sheet style.

Rate limit: 2 seconds between pages.
Estimated new contacts: 6,000-8,000 SW Florida

────────────────────────────────────────────────────────────────
FUNCTION 4: scrapeFLAHCA()
Florida AHCA facility database.
URL: ahca.myflorida.com/MCHQ/Health_Facility_Regulation
Direct CSV download — no scraping needed.

Facility types to import:
  substance_abuse_treatment → referral_source_type='substance_abuse_facility'
  crisis_stabilization_unit → referral_source_type='crisis_unit'
  partial_hospitalization → referral_source_type='partial_hospitalization'
  intensive_outpatient → referral_source_type='partial_hospitalization'
  residential_treatment → referral_source_type='substance_abuse_facility'

For SNFs and ALFs: add to referral_sources with
  referral_source_type='snf_facility'
  Note: these are 1-833-NURSING targets primarily
  Tag with platform='nursing' in a separate column

Add to referral_sources:
  alter table referral_sources
    add column if not exists platform_target text
      default 'psychrx'
      check (platform_target in ('psychrx','nursing','both'));

SNFs and ALFs: platform_target='nursing'
Mental health facilities: platform_target='psychrx'

Estimated new contacts: 4,000-6,000

────────────────────────────────────────────────────────────────
FUNCTION 5: scrapeFLCertBoard()
Florida Certification Board
URL: flcertificationboard.org/find-a-professional
No captcha. Simple paginated HTML.

Credentials to scrape:
  MCAP/CAP → Certified Addiction Professional
  CPRS → Certified Peer Recovery Specialist
  CCJP → Criminal Justice Addiction Professional

These are referral sources not providers.
Addiction counselors refer co-occurring patients.
Peer support specialists see highest-need patients daily.

Insert as:
  campaign = 'referral_source'
  referral_source_type = 'cap' or 'peer_support'
  score = 25 (high-acuity patient referrers)
  source_database = 'fl_cert_board'

Rate limit: 2 seconds between pages.
Estimated new contacts: 8,000-10,000

────────────────────────────────────────────────────────────────
FUNCTION 6: scrapePTDirectory()
Psychology Today therapist directory
URL: psychologytoday.com/us/therapists/florida
No captcha. Paginated HTML by city.

Cities to scrape (FL priority list):
  Fort Myers, Naples, Cape Coral, Bonita Springs,
  Sarasota, Tampa, St. Pete, Orlando, Miami, Jacksonville,
  Gainesville, Tallahassee, Boca Raton, Fort Lauderdale

For each therapist listing extract:
  Name, credentials, phone, specialties, insurance accepted,
  city, accepting new patients flag

Insert as:
  campaign = 'provider_recruit' (therapists to join platform)
  referral_source_type = appropriate type from credentials
  score = 30 (actively marketing = motivated)
  source_database = 'pt_directory'

IMPORTANT: These providers are actively advertising.
They want more patients.
Your pitch: "We send you patients, handle billing, you keep 75%"
is extremely compelling to a PT-listed therapist
paying $29.95/month for 1-4 leads.

Rate limit: 1 request per 2 seconds to avoid IP block.
Run overnight — ~5 hours for full FL scrape.
Estimated new contacts: 6,000-8,000

────────────────────────────────────────────────────────────────
FUNCTION 7: scrapeNBCC()
National Board for Certified Counselors
URL: nbcc.org/search/counselorfind
No captcha. Filter by state=Florida.

These are nationally certified counselors.
Higher credential bar than state license alone.
More professional engagement.

Insert as:
  campaign = 'provider_recruit'
  referral_source_type = 'lmhc'
  source_database = 'nbcc'
  score = 25

Estimated new FL contacts: 2,000-3,000

────────────────────────────────────────────────────────────────
FUNCTION 8: scrapeNASW()
National Association of Social Workers
URL: socialworkers.org/Find-Social-Workers
Filter by Florida. No captcha.

Insert as:
  campaign = 'provider_recruit'
  referral_source_type = 'lcsw'
  source_database = 'nasw'
  score = 25

Estimated new FL contacts: 3,000-5,000

────────────────────────────────────────────────────────────────
FUNCTION 9: scrapeAPALocator()
American Psychological Association locator
URL: locator.apa.org — filter Florida
No captcha observed.

Psychologists: CANNOT prescribe → refer ALL medication to PMHNPs.
Best referral source for medication management.
Can also join platform for testing services.

Insert as:
  campaign = 'referral_source' (primary — refer med mgmt)
  referral_source_type = 'psychologist'
  source_database = 'apa_locator'
  score = 35 (high value — refer everything prescribing)

Estimated new FL contacts: 4,000-6,000

────────────────────────────────────────────────────────────────
FUNCTION 10: scrapeAAMFT()
American Association of Marriage and Family Therapy
URL: therapistlocator.net — filter Florida
No captcha. Paginated results.

Insert as:
  campaign = 'provider_recruit'
  referral_source_type = 'lmft'
  source_database = 'aamft'
  score = 25

Estimated new FL contacts: 2,000-3,000

────────────────────────────────────────────────────────────────
FUNCTION 11: scrapeMDVIP()
MDVIP concierge medicine physician directory
URL: mdvip.com/find-a-doctor — filter Florida
No captcha.

Concierge physicians: high-income patients, high trust referrals.
Their patients have premium insurance or cash pay.
Best patient profile for PsychRx revenue.

Insert as:
  campaign = 'referral_source'
  referral_source_type = 'concierge_medicine'
  source_database = 'mdvip'
  score = 45 (premium patients, high trust referrals)

Outreach: personal letter from Patrick PMHNP-BC.
Not a fax. A professional letter to their office.
Concierge physicians respond to peer-level outreach.

Estimated FL contacts: 150-250

────────────────────────────────────────────────────────────────
FUNCTION 12: syncSAMHSAfacilities()
SAMHSA treatment facility locator API
URL: api.findtreatment.gov
Register for free API key at findtreatment.gov/developers

Query: state=FL, service=MH (mental health)
Also query: state=FL, service=SA (substance abuse)

These facilities discharge patients who need outpatient follow-up.
They are referral sources not providers.

Insert as:
  campaign = 'referral_source'
  referral_source_type = 'substance_abuse_facility'
  source_database = 'samhsa'
  score = 35

Estimated FL contacts: 600-900

────────────────────────────────────────────────────────────────
FUNCTION 13: syncCMSUtilization()
CMS Medicare Provider Utilization Data
URL: data.cms.gov/provider-summary-by-type-of-service/
  medicare-physician-other-practitioners/
  medicare-physician-other-practitioners-by-provider
Direct CSV download. Annual file. Free.

Parse and cross-reference with existing referral_sources by NPI.
For each match found:
  Update score based on patient volume:
    total_beneficiaries > 2000: score += 30
    total_beneficiaries 1000-2000: score += 20
    total_beneficiaries 500-1000: score += 10
    total_beneficiaries < 500: score += 0

High-volume physicians are contacted FIRST.
A PCP seeing 3,000 patients/year has more referral capacity
than one seeing 300.

This makes your scraper 10x smarter.
Same fax budget — better targeting.

────────────────────────────────────────────────────────────────
FUNCTION 14: notifyOwnerOfNewContacts()
Run at end of monthly scrape cycle.
Count new contacts added this month by source.
SMS owner:

"PsychRx Monthly Data Sync Complete

New contacts added:
FL MQA (therapists/BCBA): [X]
FL Bar (attorneys): [X]
FL AHCA (facilities): [X]
FL Cert Board (peer support): [X]
PT Directory: [X]
NBCC/NASW/APA/AAMFT: [X]
MDVIP: [X]
SAMHSA: [X]

Total new in pipeline: [X]
Cumulative database: [X] contacts

psychrx.com/admin/contacts"

────────────────────────────────────────────────────────────────
SCORING UPDATES FOR NEW SOURCE TYPES

Update scoreAndRankContacts() in balance.worker.ts
to score new referral_source_types:

Referral source scoring additions:
  psychologist: +35 (refers ALL med mgmt, high volume)
  concierge_medicine: +45 (premium patients, high trust)
  substance_abuse_facility: +35 (discharge referrals, consistent)
  crisis_unit: +40 (post-crisis patients need follow-up urgently)
  family_law_attorney: +30 (custody evals, cash pay)
  pi_attorney: +30 (PTSD/trauma evals, cash pay)
  bcba: +25 (autism+anxiety comorbidity referrals)
  peer_support: +25 (high-acuity patients, consistent)
  cap: +25 (co-occurring disorders, consistent)
  urgent_care: +30 (acute presentations, immediate need)
  eap_program: +40 (employer-referred, insured, reliable)

Provider recruit scoring additions:
  pt_directory: +30 (actively marketing, motivated)
  nbcc: +25 (nationally certified, professionally engaged)
  nasw: +25 (professionally active member)
  aamft: +25 (professionally active member)

────────────────────────────────────────────────────────────────
OUTREACH MESSAGE TEMPLATES FOR NEW TYPES

Add to getFaxTemplate() in campaign.worker.ts:

PSYCHOLOGIST (referral source):
"TO: Dr. [name], PhD/PsyD
FROM: PsychRx Mental Health Network
RE: Prescribing Partner for Your Psychology Patients

Dr. [name],

PsychRx provides medication management for patients
already working with psychologists and therapists.

When your patients need psychiatric medication:
✓ Same-week PMHNP availability
✓ You remain the primary treating provider
✓ We fax you updates after every session
✓ Aetna · Cigna · United · BCBS FL accepted

Collaborative care model — not replacing you.

Fax: 1-833-PSYCHRX
Refer online: psychrx.com/refer/[physician NPI]"

SUBSTANCE ABUSE FACILITY (referral source):
"TO: Clinical Director, [facility name]
FROM: PsychRx Mental Health Network
RE: Outpatient Referral Partnership

[Facility name],

PsychRx accepts step-down referrals for patients
completing your residential or intensive program.

For your patients needing outpatient continuation:
✓ Therapy — same week
✓ Medication management (non-controlled)
✓ Telehealth — no transportation barrier
✓ Major insurance accepted + cash pay

We close the loop — fax update on every patient seen.

Fax: 1-833-PSYCHRX | psychrx.com/refer"

ATTORNEY (referral source — letter format):
"TO: [Attorney name], Esq.
FROM: PsychRx Mental Health — Patrick Charles, PMHNP-BC
RE: Psychological Evaluation Services

[Attorney name],

PsychRx provides board-certified psychological
evaluations for legal matters including:

  Family law: Custody evaluations, parenting assessment
  Personal injury: PTSD, trauma, psychological injury
  Workers compensation: Psychological injury documentation
  Immigration: Asylum trauma evaluation

Board-certified providers. Reports in 10 business days.
Cash pay accepted directly from attorney or client.

Call: 1-833-PSYCHRX
Email: evals@psychrx.com"

PEER SUPPORT SPECIALIST (referral source):
"TO: [Name], CPRS
FROM: PsychRx Mental Health Network
RE: Mental Health Referral Partnership

[Name],

The patients you support often need therapy and
psychiatric medication alongside peer support.

When your clients need clinical services:
✓ Same-week telehealth appointments
✓ Therapy and medication management
✓ Accepts Medicaid (Phase 2) and most insurance
✓ No transportation barrier — telehealth only

Refer: psychrx.com/refer or 1-833-PSYCHRX"

────────────────────────────────────────────────────────────────
1-833-NURSING DATABASE ADDITIONS

While building this worker, also add these
as platform_target='nursing' records:

Add scrapeCMSNursingHomes():
Download: data.cms.gov/provider-data/dataset/4pq5-n9py
CSV of all US nursing homes.
Filter: state=FL for now.
These are 1-833-NURSING customers (SNFs need agency nurses).

Add scrapeCMSStaffingData():
Download: data.cms.gov/provider-data/dataset/tj9n-bqtv
Nursing home staffing hours per resident per day.
Cross-reference with nursing home database by NPI.

Flag understaffed facilities:
  If RN hours < 0.75/resident/day: understaffed_flag=true
  These facilities need agency nurses TODAY.
  Score them highest in 1-833-NURSING outreach.

Add to referral_sources schema:
  alter table referral_sources
    add column if not exists understaffed_flag boolean default false,
    add column if not exists rn_hours_per_resident decimal,
    add column if not exists bed_count integer,
    add column if not exists cms_star_rating integer;

Add scrapeFLAHCAHomeHealth():
From FL AHCA facility download — filter for home health agencies.
These are the STAFFING AGENCY customers for 1-833-NURSING.
platform_target = 'nursing'

Estimated FL nursing homes: 684
Estimated FL home health agencies: 4,000+
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 20 — INTEGRATION TEST UPDATE
# ══════════════════════════════════════════════════════════════════

PROMPT_20 = """
Update tests/integration-checklist.md to add new sections:

SECTION 8 — FAST-TRACK REFERRAL URL:
[ ] Visit psychrx.com/refer/1234567890 (any NPI)
[ ] Page loads and shows physician name if NPI exists
[ ] Form submits and creates patient record
[ ] Referral_sources.total_referrals increments
[ ] Confirmation screen shows correctly

SECTION 9 — TIER SYSTEM:
[ ] Insert test referral_source with total_referrals=5
[ ] Run evaluateReferralTiers() manually
[ ] Verify tier changed to 'gold'
[ ] Verify tier_upgraded_at populated
[ ] Verify upgrade fax queued

SECTION 10 — DATA INGESTION WORKER:
[ ] Run: npx tsx workers/data-ingestion.worker.ts
[ ] Worker starts without errors
[ ] Check Supabase: new records with source_database values
[ ] Verify FL MQA records inserted
[ ] Verify scores populated on new records
[ ] Verify platform_target='nursing' on SNF records
[ ] Owner SMS received with monthly summary

SECTION 11 — NEW SCORING:
[ ] Run scoreAndRankContacts()
[ ] Verify psychologists score higher than standard physicians
[ ] Verify MDVIP contacts have highest scores
[ ] Verify understaffed SNFs flagged correctly

SECTION 12 — ATTORNEY OUTREACH:
[ ] Verify attorney message template different from physician
[ ] Verify cash pay framing in attorney fax content
[ ] Verify no insurance discussion in attorney messages

DATABASE VERIFICATION:
[ ] source_database column added to referral_sources
[ ] referral_source_type column added
[ ] platform_target column added
[ ] mobile_phone column added
[ ] referral_tier column with correct check constraint
[ ] fast_track_url generated column works
[ ] patient_source column added to patients
[ ] cms_star_rating, understaffed_flag, bed_count on referral_sources
[ ] pecos_verified column added
"""

# ══════════════════════════════════════════════════════════════════
# COMPLETE DATABASE LIST — ALL NEW COLUMNS SUMMARY
# ══════════════════════════════════════════════════════════════════

NEW_SCHEMA_ADDITIONS = """
Run all of these in Supabase SQL editor
AFTER running the main schema.sql:

-- Core additions to referral_sources
alter table referral_sources
  add column if not exists source_database text default 'nppes',
  add column if not exists referral_source_type text,
  add column if not exists mobile_phone text,
  add column if not exists referral_tier text default 'standard',
  add column if not exists tier_upgraded_at timestamptz,
  add column if not exists fast_track_url text
    generated always as
    ('https://psychrx.com/refer/' || coalesce(npi,'')) stored,
  add column if not exists platform_target text default 'psychrx',
  add column if not exists pecos_verified boolean default false,
  add column if not exists pecos_last_checked date,
  add column if not exists understaffed_flag boolean default false,
  add column if not exists rn_hours_per_resident decimal,
  add column if not exists bed_count integer,
  add column if not exists cms_star_rating integer,
  add column if not exists last_referral_date date;

-- Source tracking on patients
alter table patients
  add column if not exists patient_source text;

-- Indexes for new columns
create index if not exists idx_referral_source_database
  on referral_sources (source_database);
create index if not exists idx_referral_source_type
  on referral_sources (referral_source_type);
create index if not exists idx_referral_tier
  on referral_sources (referral_tier);
create index if not exists idx_platform_target
  on referral_sources (platform_target);
create index if not exists idx_understaffed
  on referral_sources (understaffed_flag)
  where understaffed_flag = true;
"""

# ══════════════════════════════════════════════════════════════════
# COMPLETE DATABASE PRIORITY REFERENCE
# What each database adds and which side it serves
# ══════════════════════════════════════════════════════════════════

DATABASE_REFERENCE = """
COMPLETE DATABASE MAP — PSYCHRX + 1-833-NURSING

TIER 1 — DIRECT DOWNLOAD, NO SCRAPING:
─────────────────────────────────────────────────────────────────
Database            | Access      | New Contacts | Side       | Time
─────────────────────────────────────────────────────────────────
NPPES               | API         | 51,100 FL    | Both       | Done
PECOS               | CSV dl      | Cross-ref    | Both       | 10 min
CMS Utilization     | CSV dl      | Cross-ref    | Referral   | 20 min
FL AHCA             | CSV dl      | 5,400+       | Both       | 10 min
SAMHSA Facilities   | API         | 800 FL       | Referral   | 5 min
OIG LEIE            | CSV dl      | Compliance   | Compliance | Done
CMS Nursing Homes   | CSV dl      | 684 FL       | Nursing    | 10 min
CMS Staffing Data   | CSV dl      | Cross-ref    | Nursing    | 10 min

TIER 2 — SIMPLE SCRAPER, NO CAPTCHA:
─────────────────────────────────────────────────────────────────
Database            | Method      | New Contacts | Side       | Build
─────────────────────────────────────────────────────────────────
FL MQA              | POST+parse  | 20,000-30,000| Provider   | 1 week
FL Bar              | POST+parse  | 6,000-8,000  | Referral   | 1 week
FL Cert Board       | GET+parse   | 8,000-10,000 | Referral   | 1 week
Psychology Today    | GET+parse   | 6,000-8,000  | Provider   | 1 week
NBCC national       | GET+parse   | 2,000-3,000  | Provider   | 1 week
NASW directory      | GET+parse   | 3,000-5,000  | Provider   | 1 week
APA locator         | GET+parse   | 4,000-6,000  | Both       | 1 week
AAMFT directory     | GET+parse   | 2,000-3,000  | Provider   | 1 week
MDVIP concierge     | GET+parse   | 150-250      | Referral   | 1 week
FL AHCA Home Health | CSV dl      | 4,000+       | Nursing    | 1 week

WHICH SIDE EACH DATABASE PRIMARILY SERVES:
─────────────────────────────────────────────────────────────────
PROVIDER RECRUITMENT (people who join and see patients):
  FL MQA LMHC:    14,000+ — therapists missing from NPPES
  FL MQA LMFT:    8,000+  — therapists missing from NPPES
  FL MQA LCSW:    overlaps NPPES but adds cash-pay only
  FL MQA BCBA:    8,000+  — also refer autism+anxiety patients
  Psychology Today: 8,000 — actively marketing, highly motivated
  NBCC:           nationally certified counselors
  NASW:           professionally active social workers
  AAMFT:          professionally active marriage therapists
  APA:            psychologists (also referral for med mgmt)

PATIENT REFERRAL SOURCES (people who send patients):
  FL AHCA:        substance abuse facilities, crisis units
  FL Bar:         family law, PI, workers comp attorneys
  FL Cert Board:  peer support specialists, CAPs
  APA locator:    psychologists (cannot prescribe — refer all med mgmt)
  SAMHSA:         treatment facility discharge referrals
  MDVIP:          concierge medicine — premium patients
  CMS Utilization: identifies highest-volume referrers to prioritize

1-833-NURSING TARGETS:
  CMS Nursing Homes:  684 FL SNFs — primary platform customers
  CMS Staffing Data:  identifies understaffed facilities — HOT leads
  FL AHCA Home Health: 4,000+ agencies — supply side of platform

COMBINED TOTAL ADDRESSABLE (FL):
  Current NPPES:    51,100 contacts
  New databases:    60,000-100,000 additional
  COMBINED:         110,000-150,000 FL contacts
  At 8% response:   8,800-12,000 active referral relationships
  At 2.1 ref/month: 18,480-25,200 referrals/month
  At 55% booking:   10,164-13,860 new patients/month
  Provider constraint at this volume: 400-500 providers needed
  Balance engine handles provider recruitment automatically
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 21 — CLINICAL WORKFLOWS
# Crisis, Labs, Refills, Prior Auth, Pharmacy, Side Effects,
# Emergency Therapy, Geographic Verification, Liability
# ══════════════════════════════════════════════════════════════════

PROMPT_21 = """
Add complete clinical workflow infrastructure.
These are the day-to-day operational flows
that happen between scheduling and billing.

────────────────────────────────────────────────────────────────
SECTION 1: GEOGRAPHIC VERIFICATION AT SESSION TIME

Add to workers/reminder.worker.ts
in the 15-minute pre-session check-in:

Carol sends SMS to patient 15 minutes before session:
"PsychRx: Your session with [provider first name]
starts in 15 minutes.
Quick confirmation: Are you currently located
in [patient.state] for today's session?
Reply YES to receive your video link.
Reply NO if you are in a different state."

If YES: send Doxy link immediately.
If NO: collect which state they are in.
  Check if provider is licensed in that state.
  If licensed: proceed, update session_state field.
  If not licensed: cannot proceed.
    SMS patient: "Your provider is not licensed
    in the state you are currently in.
    We are working to reschedule your session.
    No charge will apply."
    SMS provider immediately with situation.
    No-show fee does NOT apply.
    Log geographic_block in appointments table.

Add to appointments table:
  alter table appointments
    add column if not exists session_state text,
    add column if not exists geographic_verified boolean default false,
    add column if not exists geographic_block boolean default false;

Add to encounters table:
  alter table encounters
    add column if not exists patient_location_confirmed boolean default false,
    add column if not exists patient_location_state text;

Document patient location in every AI-generated note:
"Patient confirmed location: State of [state]
at time of session. Provider licensed in [state]."

────────────────────────────────────────────────────────────────
SECTION 2: COMPLETE CRISIS ESCALATION PROTOCOL

Expand services/compliance/gap-fixes.ts
completeCrisisProtocol(patientId, source, context):

Source options:
  carol_voice — detected on inbound call
  carol_sms — detected in SMS
  phq9_q9 — PHQ-9 question 9 score > 0
  provider_flag — provider manually flagged
  outcome_critical — any outcome measure critical response

Actions in sequence (all within 60 seconds):
1. SMS provider immediately:
   "URGENT: [patient first name] has been flagged
   for crisis. Patient phone: [phone].
   Please reach out immediately.
   988 has been provided."

2. SMS emergency contact if consent given:
   "This is PsychRx. [Patient first name] has
   reached out to us and we want to make sure
   they have support. Please check on them
   when you are able. If you believe they are
   in immediate danger please call 911."

3. Set on appointments table:
   cancellation_protected = true
   clinical_urgency = true
   on all future appointments for this patient.

4. Block any cancellation of next 3 appointments.
   No cancellation fee. No no-show fee.
   Patient cannot be dropped for 30 days after crisis.

5. Schedule crisis follow-up within 24 hours.
   Override waitlist. Override normal matching.
   Find any available provider immediately.
   SMS patient: "We have scheduled a follow-up
   for you tomorrow. [date] at [time].
   Your Doxy link: [link]"

6. Generate crisis documentation in encounters:
   Source of crisis identification.
   Resources provided (988, 911).
   Who was notified and when.
   Follow-up scheduled.
   Provider response time logged.

7. SMS owner if provider does not respond
   within 15 minutes:
   "URGENT: Crisis patient [first name] —
   provider [name] has not responded.
   Patient phone: [phone]. Please follow up."

8. Add Columbia C-SSRS to outcome_measures
   as measure_type = 'COLUMBIA'.
   Any YES response triggers this protocol.

Carol crisis response script (exact words):
"I hear you and I want to make sure
you get the right support right now.
Please call or text 988 — that is the
Suicide and Crisis Lifeline.
They are available right now, day or night.
If you are in immediate danger please call 911.
I am also letting your care team know
so they can reach out to you.
You do not have to go through this alone."

Then hang up gracefully.
Never ask questions that extend the call.
Never ask for more details.
Give 988. Notify team. End call.

────────────────────────────────────────────────────────────────
SECTION 3: LAB ORDER AND RESULT ROUTING

Create app/api/labs/route.ts

Provider orders labs from portal:
  Select patient.
  Select lab panel from dropdown:
    CBC, CMP, TSH, Lipid Panel,
    HbA1c, Vitamin D, B12,
    Lithium level, Valproate level,
    Medication metabolite levels.
  Select lab: LabCorp or Quest.
  Add clinical indication.
  Submit.

On submission:
  Generate lab requisition PDF using pdf-lib.
  Include: patient name, DOB, insurance,
    ordering provider NPI, clinical indication,
    panels ordered, date ordered.
  Fax requisition to nearest LabCorp or Quest
    based on patient zip code.
    LabCorp fax finder: use their locator API.
    Quest fax finder: use their locator API.
  SMS patient:
    "PsychRx: Dr. [first name] has ordered
    labs for you. Take this confirmation
    number to any [LabCorp/Quest] location:
    [confirmation]. No appointment needed."
  Log to new labs table.

Create labs table:
  create table labs (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references patients(id),
    provider_id uuid references providers(id),
    appointment_id uuid references appointments(id),
    lab_vendor text check (lab_vendor in ('labcorp','quest')),
    panels_ordered text[],
    clinical_indication text,
    requisition_fax_number text,
    fax_sent boolean default false,
    fax_sent_at timestamptz,
    results_received boolean default false,
    results_received_at timestamptz,
    results_file_url text,
    provider_reviewed boolean default false,
    provider_reviewed_at timestamptz,
    critical_value boolean default false,
    status text default 'ordered' check (status in (
      'ordered','faxed','resulted','reviewed','critical'
    )),
    created_at timestamptz default now()
  );

Inbound lab results:
  Results faxed to provider's direct fax
    OR to 1-833-PSYCHRX fax line.
  Carol classifies inbound fax as lab_result.
  Identifies patient from name + DOB on result.
  Uploads to Supabase storage labs/ bucket.
  Creates signed URL.
  Updates labs table: results_received = true.
  SMS provider:
    "PsychRx: Lab results received for
    [patient first name]. View in portal."
  If critical value detected by Carol:
    Set critical_value = true.
    SMS provider marked URGENT.
    Add to provider dashboard as red alert.

────────────────────────────────────────────────────────────────
SECTION 4: REFILL REQUEST WORKFLOW

Expand app/api/refills/route.ts

Patient portal refill request:
  Medication name (free text).
  Days of supply remaining (number).
  Pharmacy name.
  Pharmacy phone.
  Pharmacy fax (auto-populated from pharmacy_registry).
  Any side effects or concerns (optional).

On submission:
  Route to provider as priority message.
  Include in provider portal dashboard
    as a card: "Refill Request — [patient name]
    [medication] — [days] days remaining"
  SMS provider:
    "PsychRx: Refill request from [patient first name].
    [medication]. [days] days remaining.
    View portal to approve."

Provider approves in portal:
  Clicks Approve Refill.
  System marks refill_requests.approved = true.
  SMS provider immediately:
    "Refill approved for [patient first name]. Send via your e-prescribe system."
  SMS patient:
    "PsychRx: Your refill for [medication]
    has been sent to [pharmacy name].
    Allow 24-48 hours for processing."
  Log to refill_requests table.

CONTROLLED SUBSTANCE REFILL RULES:
If medication is flagged as controlled substance:
  Add mandatory PDMP check reminder to provider:
    "REQUIRED: Check PDMP before approving.
    FL law requires PDMP verification before
    prescribing controlled substances.
    Document in note: PDMP checked [date]."
  Cannot approve without provider attestation
    that PDMP was checked.
  Block approval button until
    provider checks PDMP attestation checkbox.

RYAN HAIGHT COMPLIANCE:
For new patients requesting controlled substances:
  Flag immediately:
    "Controlled substances cannot be prescribed
    to new patients via telehealth without
    a prior in-person evaluation under
    the Ryan Haight Act.
    Please schedule an in-person evaluation
    or discuss alternative medications."
  Block refill approval for new patients.
  Existing patients (3+ completed sessions):
    Allow with PDMP check.

Create refill_requests table:
  create table refill_requests (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references patients(id),
    provider_id uuid references providers(id),
    medication_name text not null,
    days_remaining integer,
    is_controlled boolean default false,
    controlled_schedule text,
    pharmacy_name text,
    pharmacy_fax text,
    pdmp_checked boolean default false,
    pdmp_checked_at timestamptz,
    approved boolean default false,
    approved_at timestamptz,
    sent_to_pharmacy boolean default false,
    sent_at timestamptz,
    status text default 'pending' check (status in (
      'pending','approved','denied','sent'
    )),
    denial_reason text,
    created_at timestamptz default now()
  );

────────────────────────────────────────────────────────────────
SECTION 5: PRIOR AUTHORIZATION SUBMISSION

Expand app/api/prior-auth/route.ts

Current system: blocks booking if PA required.
Add: actual PA submission workflow.

Provider requests PA from portal:
  Select patient and payer.
  Select CPT code.
  Select ICD-10 codes.
  Add clinical justification (free text).
  Upload supporting documentation if needed.

On submission:
  Submit to Availity PA portal via API.
    Availity PA endpoint:
    POST /availity/v1/prior-authorizations
  Store auth request ID in prior_authorizations.
  SMS provider:
    "PA request submitted to [payer].
    Reference: [auth_id].
    Typical response: 2-5 business days."

PA decision received (webhook or polling):
  Approved:
    Update prior_authorizations.approved = true.
    Store auth_number.
    Update sessions_approved count.
    SMS provider: "PA approved. Auth: [number].
    [X] sessions approved through [date]."
    Unblock patient scheduling automatically.
  Denied:
    Update claim_status = 'denied'.
    SMS provider with denial reason.
    Generate appeal letter template using Claude:
      Clinical justification paragraph.
      Supporting literature references.
      Provider can edit and submit.
    SMS provider: "PA denied. Reason: [reason].
    Appeal letter drafted in portal."

PA session tracking:
  Decrement sessions_approved on each claim.
  Alert provider at 2 sessions remaining:
    "PA for [patient first name] has 2 sessions
    remaining. Submit renewal now to avoid gap."
  Auto-submit PA renewal if provider approves.

────────────────────────────────────────────────────────────────
SECTION 6: PHARMACY ISSUE ROUTING

Add to app/api/voice/inbound and fax inbound:

Carol identifies pharmacy callers from
pharmacy_registry table by inbound number.

If pharmacy calls 1-833-PSYCHRX:
  Carol: "Thank you for calling PsychRx.
    This is Carol. Are you calling about
    a prescription for a patient?"
  Pharmacy confirms patient name.
  Carol identifies patient from patients table.
  Identifies their primary provider.
  Carol: "I am going to alert Dr. [first name]
    right now. They will call you back
    at this number within the hour."
  SMS provider immediately:
    "PHARMACY: [pharmacy name] calling about
    [patient first name].
    Issue: [what Carol collected].
    Call back: [pharmacy phone]."
  Log to inbound_contacts as pharmacy_call.

Common pharmacy issues Carol handles:
  Prescription not received:
    Route to provider to resend via their own e-prescribe system.
  Insurance denied at pharmacy:
    Route to billing coordinator or provider.
    May need PA or formulary alternative.
  Prescription expired:
    Route to provider for renewal.
  Wrong quantity or directions:
    Route to provider to correct and resend.
  Patient at wrong pharmacy:
    Carol collects correct pharmacy fax.
    Provider resends to correct location.

Add pharmacy_calls to inbound_contacts:
  caller_type = 'pharmacy'
  Route separately from patient and provider calls.
  Provider response time tracked.
  Escalate to admin if no response in 60 minutes.

────────────────────────────────────────────────────────────────
SECTION 7: SIDE EFFECT TRACKING

Expand outcome_measures to include side effects.
Create side_effect_reports table:

  create table side_effect_reports (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references patients(id),
    provider_id uuid references providers(id),
    medication_name text not null,
    symptom_description text not null,
    severity integer check (severity between 1 and 10),
    duration_days integer,
    onset_date date,
    resolved boolean default false,
    resolved_date date,
    action_taken text,
    reported_via text check (reported_via in (
      'portal','carol_sms','carol_voice','provider'
    )),
    provider_reviewed boolean default false,
    created_at timestamptz default now()
  );

If severity >= 7:
  SMS provider marked URGENT:
    "URGENT: [patient first name] reporting
    severe side effect (severity [X]/10)
    from [medication]. Symptom: [description].
    Review portal immediately."
  Add to provider dashboard as red alert.
  Block refill approval for this medication
    until provider reviews and documents action.

If severity >= 9:
  Also SMS owner.
  Flag for immediate provider outreach.
  Consider whether emergency appointment needed.

Carol side effect detection on inbound call:
  Detect phrases: "side effect", "reaction",
    "medication making me", "pill is causing",
    "feels wrong", "since I started taking"
  Carol collects:
    Which medication.
    What symptom.
    Severity 1-10.
    How long.
  Creates side_effect_reports record.
  Routes to provider per severity above.

Add to AI scribe:
  If side_effect_reports exist for patient
    with created_at in last 30 days:
  Pre-populate in note:
    "Patient-reported side effect since
    last visit: [medication] causing [symptom].
    Severity: [X]/10. Duration: [days] days."
  Provider confirms or edits.

────────────────────────────────────────────────────────────────
SECTION 8: EMERGENCY THERAPY APPOINTMENTS

Create app/api/appointments/emergency/route.ts

Trigger sources:
  Patient requests urgent appointment in portal.
  Carol detects urgent language on call.
  Provider flags patient as needing urgent care.
  PHQ-9 score indicates acute deterioration.

On emergency appointment request:
  Set clinical_urgency = true.
  Override normal matching algorithm.
  Find ANY available therapist slot
    within next 24-48 hours.
  Specialty match preferred but not required.
  Insurance match preferred but not required.
  If no slot found in 24 hours:
    Find slot within 72 hours.
    SMS patient: "We are prioritizing
    your request and have found the earliest
    available appointment."

Protections on emergency appointments:
  No cancellation fee ever.
  No no-show fee ever.
  Cannot be cancelled by system automatically.
  Cancellation requires admin approval.
  Provider cannot decline without providing coverage.

SMS patient immediately:
  "PsychRx: We have prioritized your request.
  Your appointment is confirmed:
  [date] at [time] with [provider first name].
  Join here: [doxy link]
  If you are in crisis right now
  please call or text 988."

SMS provider:
  "URGENT: Emergency appointment scheduled.
  [patient first name] — [date] [time].
  Clinical urgency flagged. Please review
  patient history before session."

────────────────────────────────────────────────────────────────
SECTION 9: INCIDENT REPORTING SYSTEM

Add to app/admin/incidents/ page and API.

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  incident_type text check (incident_type in (
    'patient_complaint','medication_error',
    'crisis_event','boundary_violation',
    'billing_dispute','hipaa_concern',
    'provider_concern','technology_failure',
    'adverse_event','other'
  )),
  reported_by uuid,
  reported_by_type text check (reported_by_type in (
    'provider','patient','admin','carol_ai'
  )),
  patient_id uuid references patients(id),
  provider_id uuid references providers(id),
  incident_date timestamptz,
  description text not null,
  immediate_action_taken text,
  status text default 'open' check (status in (
    'open','under_review','resolved','escalated'
  )),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

Rules:
  Cannot be edited after 24 hours — immutable record.
  Owner SMS immediately on creation.
  Stored permanently — never deleted.
  Admin dashboard shows open incidents count.
  Escalate automatically if open > 72 hours.

────────────────────────────────────────────────────────────────
SECTION 10: DOXY.ME INTEGRATION

Doxy.me is used by all providers at free tier.
PsychRx does not manage Doxy accounts.
Each provider creates their own free account.
Each provider has their own waiting room URL.

Onboarding flow addition:
  Step: "Enter your Doxy.me waiting room URL.
  If you do not have one yet, create a free
  account at doxy.me. Your URL looks like:
  doxy.me/yourname"
  Stored in providers.telehealth_link.

How Doxy connects to PsychRx:
  Reminder worker sends provider's Doxy link
    to patient in every reminder SMS.
  Carol sends Doxy link when patient confirms
    geographic location pre-session.
  Patient portal shows JOIN SESSION button
    linking to provider's Doxy URL.
    Button activates green glow 15 minutes before.
  Provider portal shows JOIN SESSION button
    linking to their own Doxy URL.

Doxy waiting room queue:
  Doxy manages the queue natively.
  Patient enters name in Doxy waiting room.
  Provider sees them in their Doxy dashboard.
  Provider admits them when ready.
  PsychRx does not build or manage this queue.
  Doxy free tier handles it completely.

Video failure handling (already in coverage worker):
  Provider texts VIDEO DOWN.
  System identifies active session.
  SMS provider patient's phone number.
  SMS patient provider will call shortly.
  Session converts to phone modality.
  CPT code updates to phone equivalent.
  Audio-only header added to AI scribe automatically.

Doxy Pro or Clinic upgrade:
  Provider's personal decision.
  Their cost. Their account.
  If they upgrade they get group sessions,
    custom branding, advanced queue.
  PsychRx integration is the same regardless.
  Only the telehealth_link URL matters.

────────────────────────────────────────────────────────────────
SECTION 11: PROVIDER EMR INDEPENDENCE

Providers are 1099 independent contractors.
They use their own clinical tools.
PsychRx does not mandate an EMR.

What each provider brings:
  Their own Doxy.me account (free).
  Their own clinical documentation style.
  Their own e-prescribe account (DrFirst, Surescripts, or equivalent).
  Their own DEA registration.
  Their own malpractice insurance.

What PsychRx provides:
  Patient matching and scheduling.
  Insurance billing infrastructure.
  AI scribe for note generation.
  Stripe Connect weekly payments.
  Carol AI for patient communication.
  Compliance monitoring and alerts.
  Provider portal for schedule management.

AI scribe is optional:
  Provider can use their own documentation.
  Or use PsychRx AI scribe.
  If they use their own: upload note PDF
    to encounter record for billing.
  If they use AI scribe: note generated
    in portal, attested, submitted.
  Either way: encounter must be attested
    before claim submits.

Patient records ownership:
  Clinical notes generated on PsychRx
    are stored in Supabase encounters table.
  Provider retains clinical responsibility.
  Patient can request records via portal.
  Records portable on patient request.
  HIPAA release of records workflow:
    Patient requests in portal.
    Admin approves.
    Records compiled and sent to patient
      or designated provider within 30 days.

────────────────────────────────────────────────────────────────
SECTION 12: SCRAPER TARGETING — PAIN MANAGEMENT AND PEDIATRICS

Add to workers/nppes.worker.ts and
workers/data-ingestion.worker.ts:

PAIN MANAGEMENT (add as referral_source):
Taxonomy codes:
  208VP0014X — Pain Medicine
  2084P0802X — Pain Medicine (Psychiatry subspec)
  208VP0000X — Pain Medicine general
  261QP3300X — Pain Clinic

Scoring: +40 (highest referral value)
Reason: chronic pain + depression comorbidity 60%+
Fax content: specialty-specific for pain practices.
referral_source_type = 'pain_management'

PEDIATRICS (increase scoring):
Taxonomy: 208000000X — Pediatrics
Already in scraper as referral_source.
Update score from standard to +40.
Reason: ADHD referrals = your core specialty.
Fax content: ADHD-specific for pediatricians.
  "We specialize in ADHD evaluation and
  medication management for your patients.
  Same-week telehealth availability.
  Aetna, Cigna, United, BCBS FL accepted."
referral_source_type = 'pediatrician'

CHILD AND ADOLESCENT PSYCHIATRY (add as provider_recruit):
Taxonomy: 2084P0800X — Psychiatry (Child and Adolescent)
campaign = 'provider_recruit'
referral_source_type = 'child_psychiatrist'
Score: +35 (high demand, very low supply in FL)

DISCHARGE PLANNERS (targeting strategy):
Do not use fax campaign for this group.
Direct phone outreach is more effective.

Add to admin dashboard:
  Hospital Outreach Tracker section.
  Manual entry: hospital name, contact name,
    phone, last contact date, status, notes.
  Not automated — manual relationship tracking.
  Target hospitals by county:
    Lee County: Lee Health system (4 hospitals)
    Collier County: NCH Healthcare (2 hospitals)
    Charlotte County: Fawcett Memorial
    Sarasota County: Sarasota Memorial
    Manatee County: Manatee Memorial

  For each hospital:
    Call behavioral health or case management department.
    Ask for discharge planner or care coordinator.
    Introduce PsychRx as outpatient referral partner.
    Offer the /refer/[npi] fast-track URL.
    Follow up with a professional letter.
    Track in hospital outreach tracker.

────────────────────────────────────────────────────────────────
SECTION 13: CAROL SCOPE OF PRACTICE GUARDRAILS

Add hard stops to Carol system prompt in lib/anthropic.ts:

Carol NEVER:
  Gives clinical advice of any kind.
  Suggests a diagnosis.
  Comments on whether a medication is appropriate.
  Recommends a dosage or dosage change.
  Interprets lab results.
  Advises on drug interactions.
  Tells a patient whether their symptoms are serious.
  Recommends stopping or starting any medication.

When patient asks clinical questions Carol says:
  "That is a clinical question that I am not
  able to answer. Your provider is the right
  person to address that. You can send them
  a secure message through your portal at
  psychrx.com/patient-portal or bring it up
  at your next session."

When patient asks about their diagnosis:
  Same redirect to provider.

When patient asks about medication side effects:
  "I can help you report that to your provider
  right now. What medication and what are you
  experiencing?"
  Then collect side effect report (Section 7 above).
  Do NOT comment on whether the side effect is normal.

Add to Carol system prompt:
SCOPE_GUARDRAIL = true
If any message classified as clinical_advice_request:
  Use redirect language above.
  Log to ai_interactions with intent = clinical_advice_request.
  Do not attempt to answer.
  No exceptions.

────────────────────────────────────────────────────────────────
SECTION 14: INSURANCE PARITY ENGINE

Create services/compliance/insurance-parity.ts

DATABASE ADDITIONS:
alter table providers
  add column if not exists payer_concentration_flag boolean default false,
  add column if not exists payer_concentration_last_checked date,
  add column if not exists dominant_payer text,
  add column if not exists dominant_payer_pct decimal;

create table payer_health_log (
  id uuid primary key default gen_random_uuid(),
  payer_name text not null,
  flag_type text check (flag_type in (
    'payment_delay','denial_spike',
    'rate_change','network_threat',
    'concentration_warning'
  )),
  affected_providers integer,
  affected_patients integer,
  notes text,
  resolved boolean default false,
  created_at timestamptz default now()
);

create table provider_payer_mix (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  payer_name text not null,
  session_count integer default 0,
  pct_of_caseload decimal default 0,
  revenue_this_month decimal default 0,
  calculated_at timestamptz default now(),
  unique(provider_id, payer_name)
);

FUNCTION 1: calculatePayerMix(providerId)
Query last 90 days completed appointments by payer.
Upsert into provider_payer_mix table.
Return payer breakdown sorted by pct desc.

FUNCTION 2: checkPayerConcentration(providerId)
Thresholds:
  WARNING: single payer > 50% of caseload
  CRITICAL: single payer > 70% of caseload
  HEALTHY: no single payer > 40%

If CRITICAL:
  Set payer_concentration_flag = true.
  SMS provider:
    "PsychRx: Heads up — [X]% of your caseload
    is covered by [payer]. High concentration
    on one payer creates income risk.
    Your portal shows patients on other payers
    available if you want to diversify."
  SMS owner.

Provider portal card (show if flag = true):
  "Your caseload is [X]% [payer name].
  We have [N] patients on your waitlist
  under other payers if you want to
  balance your payer mix."

FUNCTION 3: checkPlatformPayerHealth()
Run weekly Monday 8 AM in compliance.worker.ts.
For each active payer:
  denial_rate_this_week = denied / total claims
  avg_days_to_payment
  platform_concentration_pct

Alerts:
  denial_rate > 15%: SMS owner — denial spike
  avg_days > 45: SMS owner — payment delay
  single payer > 60% platform revenue: SMS owner

FUNCTION 4: flagNetworkThreat(payerName, notes)
Admin-triggered from admin dashboard.
Calculate affected providers and patients.
SMS owner with exposure summary.
Add informational note to affected provider portals:
  "We are monitoring a potential change
  with one of your covered payers.
  No action needed now.
  We will notify you immediately if
  anything changes that affects your patients."
Do NOT name the payer until confirmed.

Admin dashboard — Payer Health Monitor section:
  Table: payer name, denial rate, avg days paid,
    platform concentration %, status indicator.
  Button: Flag Network Threat per payer.
  Payer health log history.
  Provider concentration report.
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 22 — INTEGRATION TEST UPDATE FOR PROMPTS 21
# ══════════════════════════════════════════════════════════════════

PROMPT_22 = """
Update tests/integration-checklist.md
to add testing for all Prompt 21 features.

SECTION 13 — GEOGRAPHIC VERIFICATION:
[ ] Patient receives location confirmation SMS 15 min before session
[ ] YES reply sends Doxy link
[ ] NO reply checks provider license in new state
[ ] Geographic block logged in appointments table
[ ] Patient confirmed location appears in AI note

SECTION 14 — CRISIS PROTOCOL:
[ ] Text crisis keyword to Carol — 988 response received
[ ] Provider receives crisis SMS within 60 seconds
[ ] Emergency contact SMS sent if consent on file
[ ] Follow-up appointment created within 24 hours
[ ] Crisis documentation created in encounters table
[ ] Owner SMS fires if provider does not respond in 15 min
[ ] cancellation_protected = true on future appointments

SECTION 15 — LABS:
[ ] Provider can order labs from portal
[ ] Lab requisition PDF generated correctly
[ ] Fax sent to correct LabCorp or Quest location
[ ] Patient receives SMS with confirmation number
[ ] Inbound lab result fax classified by Carol correctly
[ ] Provider SMS notification on result receipt
[ ] Critical value flag triggers urgent provider SMS

SECTION 16 — REFILLS:
[ ] Patient submits refill request in portal
[ ] Provider receives SMS notification
[ ] PDMP attestation checkbox blocks controlled substance approval
[ ] New patient controlled substance blocked (Ryan Haight)
[ ] Approval marks refill approved and SMS sent to provider with pharmacy details
[ ] Patient SMS when refill sent to pharmacy

SECTION 17 — PRIOR AUTH:
[ ] PA submission routes to Availity sandbox
[ ] Auth request ID stored in prior_authorizations
[ ] Provider SMS on decision received
[ ] Approved: patient scheduling unblocked automatically
[ ] Denied: appeal letter generated by Claude
[ ] Session count decrements on each claim
[ ] Renewal alert fires at 2 sessions remaining

SECTION 18 — PHARMACY:
[ ] Pharmacy call identified by Carol from phone registry
[ ] Provider SMS with pharmacy callback number within 60 seconds
[ ] Logged to inbound_contacts as pharmacy_call
[ ] Escalated to admin if no provider response in 60 min

SECTION 19 — SIDE EFFECTS:
[ ] Patient submits side effect in portal
[ ] Severity 7+ triggers urgent provider SMS
[ ] Severity 9+ triggers owner SMS
[ ] Carol detects side effect language on call
[ ] Side effect pre-populated in AI scribe note
[ ] Refill blocked until provider reviews severity 7+

SECTION 20 — EMERGENCY APPOINTMENTS:
[ ] Emergency request bypasses normal waitlist
[ ] Slot found within 24-48 hours
[ ] clinical_urgency = true on appointment record
[ ] No cancellation fee applied
[ ] Provider and patient both receive SMS
[ ] Provider cannot decline without coverage

SECTION 21 — DOXY INTEGRATION:
[ ] Provider Doxy link stored in telehealth_link
[ ] Reminder SMS includes correct Doxy link
[ ] Patient portal JOIN button links to provider Doxy URL
[ ] Provider portal JOIN button links to their own Doxy URL
[ ] VIDEO DOWN command converts session to phone
[ ] CPT code updates automatically on phone conversion

SECTION 22 — PARITY ENGINE:
[ ] calculatePayerMix() returns correct percentages
[ ] Provider SMS fires when single payer > 70%
[ ] Provider portal card shows when flag = true
[ ] Platform payer health runs Monday 8 AM
[ ] Denial spike alert fires when > 15%
[ ] flagNetworkThreat() creates payer_health_log record
[ ] Admin payer health monitor displays correctly

SECTION 23 — SCRAPER UPDATES:
[ ] Pain management taxonomy codes added to scraper
[ ] Pediatric contacts score +40 in scoring engine
[ ] Pain management fax template is specialty-specific
[ ] Pediatric fax template mentions ADHD specifically
[ ] Child psychiatry added as provider_recruit campaign
[ ] Hospital outreach tracker visible in admin dashboard
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 23 — PMHNP CLINICAL PROFILE + CREDENTIALING INTAKE
# ══════════════════════════════════════════════════════════════════

PROMPT_23 = """
Expand the provider onboarding system for PMHNPs specifically.
This covers clinical profile collection, prescribing preferences,
supervision requirements, malpractice verification,
credentialing data collection, and 1099 bank setup.

────────────────────────────────────────────────────────────────
SECTION 1: DATABASE ADDITIONS

Run in Supabase SQL editor:

create table pmhnp_clinical_profiles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,

  -- Age Groups
  sees_children boolean default false,
  sees_children_min_age integer,
  sees_adolescents boolean default false,
  sees_adolescents_min_age integer default 13,
  sees_adolescents_max_age integer default 17,
  sees_adults boolean default true,
  sees_geriatric boolean default false,
  sees_geriatric_min_age integer default 65,

  -- Populations
  populations_comfortable text[],
  -- Options: adhd, anxiety, depression, ptsd, bipolar,
  -- schizophrenia, ocd, eating_disorders, substance_use,
  -- personality_disorders, postpartum, grief, autism,
  -- chronic_pain_comorbid, developmental_disabilities,
  -- forensic, military_veterans, lgbtq, intellectual_disability

  populations_avoid text[],

  -- Prescribing Comfort
  prescribes_stimulants boolean default false,
  prescribes_benzodiazepines boolean default false,
  prescribes_antipsychotics boolean default false,
  prescribes_mood_stabilizers boolean default false,
  prescribes_antidepressants boolean default true,
  prescribes_sleep_medications boolean default false,
  prescribes_naltrexone boolean default false,
  prescribes_suboxone boolean default false,
  prescribes_ketamine boolean default false,

  -- Medication Classes Comfortable With
  medication_classes text[],
  -- Options: ssri, snri, tricyclic, maoi,
  -- stimulants_amphetamine, stimulants_methylphenidate,
  -- benzodiazepines, buspirone, antipsychotics_typical,
  -- antipsychotics_atypical, mood_stabilizers, lithium,
  -- anticonvulsants, sleep_aids, naltrexone, buprenorphine,
  -- clonidine, guanfacine, beta_blockers, hydroxyzine

  -- Controlled Substance
  has_dea_license boolean default false,
  dea_schedules_authorized text[],
  -- Options: II, III, IV, V
  comfortable_prescribing_schedule_ii boolean default false,
  comfortable_prescribing_schedule_iii boolean default false,

  -- Experience
  years_experience integer,
  years_pmhnp_experience integer,
  previous_settings text[],
  -- Options: inpatient, outpatient, partial_hospitalization,
  -- community_mental_health, private_practice, corrections,
  -- telehealth, emergency, school, military

  -- Supervision
  requires_supervision boolean default false,
  supervision_state text,
  supervising_physician_name text,
  supervising_physician_npi text,
  supervising_physician_license text,
  supervising_physician_state text,
  collaborative_agreement_signed boolean default false,
  collaborative_agreement_expiry date,
  collaborative_agreement_url text,

  -- Malpractice
  malpractice_carrier text,
  malpractice_policy_number text,
  malpractice_coverage_amount text,
  -- Options: 1M/3M, 1M/6M, 2M/4M, other
  malpractice_expiry date,
  malpractice_certificate_url text,
  malpractice_verified boolean default false,
  malpractice_verified_at timestamptz,

  -- Clinical Preferences
  max_patients_per_day integer default 10,
  preferred_session_length integer default 30,
  -- minutes: 15, 20, 30, 45, 60
  comfortable_with_complex_cases boolean default false,
  comfortable_with_crisis_patients boolean default false,
  comfortable_with_suicidal_ideation boolean default false,
  requires_therapy_concurrent boolean default false,
  -- Requires patient to also be in therapy

  -- Languages
  clinical_languages text[],
  interpreter_comfortable boolean default false,

  -- Telehealth Specific
  has_reliable_internet boolean default true,
  has_private_space boolean default true,
  has_doxy_account boolean default false,
  doxy_link text,
  backup_video_platform text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider_id)
);

create table provider_credentialing_info (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,

  -- Personal
  date_of_birth date,
  ssn_last_four text,
  gender text,
  home_address text,
  home_city text,
  home_state text,
  home_zip text,
  personal_email text,
  personal_phone text,

  -- Professional
  npi text,
  npi_type text default '1',
  taxonomy_code text,
  caqh_number text,
  caqh_username text,
  caqh_last_attested date,
  upin text,

  -- Education
  nursing_school text,
  nursing_degree text,
  nursing_graduation_year integer,
  pmhnp_program text,
  pmhnp_degree text,
  pmhnp_graduation_year integer,
  board_certification text,
  -- ANCC, AANP, APMHNP
  board_cert_number text,
  board_cert_expiry date,
  board_cert_url text,

  -- All State Licenses
  licenses jsonb,
  -- Array of: { state, license_number, issue_date,
  --   expiry_date, status, license_url, is_compact }

  -- DEA
  dea_number text,
  dea_state text,
  dea_schedule text,
  dea_expiry date,
  dea_certificate_url text,

  -- Work History (last 10 years)
  work_history jsonb,
  -- Array of: { employer, address, phone, supervisor,
  --   start_date, end_date, reason_for_leaving,
  --   may_contact boolean }

  -- Malpractice History
  has_prior_malpractice_claims boolean default false,
  malpractice_claims_details text,
  has_license_actions boolean default false,
  license_action_details text,
  has_felony boolean default false,
  felony_details text,
  has_medicare_exclusion boolean default false,

  -- Insurance Panels Previously
  prior_insurance_panels jsonb,
  -- Array of: { payer, effective_date, termination_date,
  --   termination_reason, provider_id_number }

  -- Hospital Privileges (if any)
  hospital_privileges jsonb,

  -- References (3 professional)
  references jsonb,
  -- Array of: { name, title, organization,
  --   phone, email, relationship, years_known }

  -- Documents Collected
  cv_url text,
  photo_id_url text,
  nursing_diploma_url text,
  pmhnp_diploma_url text,
  board_cert_url text,
  all_license_urls jsonb,
  malpractice_cert_url text,
  dea_cert_url text,
  caqh_attestation_url text,
  collaborative_agreement_url text,
  w9_url text,
  voided_check_url text,

  -- Credentialing Status Per Payer
  aetna_status text default 'not_started',
  aetna_provider_id text,
  aetna_effective_date date,
  cigna_status text default 'not_started',
  cigna_provider_id text,
  cigna_effective_date date,
  united_status text default 'not_started',
  united_provider_id text,
  united_effective_date date,
  bcbs_fl_status text default 'not_started',
  bcbs_fl_provider_id text,
  bcbs_fl_effective_date date,
  humana_status text default 'not_started',
  humana_provider_id text,
  humana_effective_date date,

  -- Credentialing Notes
  credentialing_notes text,
  credentialing_coordinator text,
  submitted_to_caqh_at timestamptz,
  submitted_to_aetna_at timestamptz,
  submitted_to_cigna_at timestamptz,
  submitted_to_united_at timestamptz,
  submitted_to_bcbs_at timestamptz,
  submitted_to_humana_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider_id)
);

create table provider_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  stripe_connect_id text,
  stripe_connect_ready boolean default false,
  stripe_onboarding_url text,
  bank_account_verified boolean default false,
  routing_number_last_four text,
  account_number_last_four text,
  account_type text check (account_type in ('checking','savings')),
  bank_name text,
  account_holder_name text,
  w9_on_file boolean default false,
  w9_url text,
  ein_or_ssn text check (ein_or_ssn in ('ein','ssn')),
  tax_id_last_four text,
  business_name text,
  business_type text,
  -- individual, sole_proprietor, llc, s_corp, c_corp
  ytd_payments decimal default 0,
  requires_1099 boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(provider_id)
);

create table supervision_requirements (
  id uuid primary key default gen_random_uuid(),
  state text unique not null,
  requires_supervision boolean not null,
  supervision_type text,
  -- collaborative_agreement, supervisory_agreement,
  -- none_required, full_practice_authority
  supervision_notes text,
  full_practice_authority boolean default false,
  effective_date date,
  source_url text,
  last_verified date,
  created_at timestamptz default now()
);

-- Seed supervision requirements for your license states
insert into supervision_requirements
  (state, requires_supervision, supervision_type,
   full_practice_authority, supervision_notes)
values
  ('FL', true, 'collaborative_agreement', false,
   'FL requires collaborative agreement with MD/DO for PMHNPs operating mental health clinics'),
  ('CA', false, 'none_required', true,
   'CA granted full practice authority effective 2023'),
  ('WA', false, 'none_required', true,
   'WA full practice authority'),
  ('CO', false, 'none_required', true,
   'CO full practice authority'),
  ('AZ', false, 'none_required', true,
   'AZ full practice authority'),
  ('IA', false, 'none_required', true,
   'IA full practice authority'),
  ('NH', false, 'none_required', true,
   'NH full practice authority')
on conflict (state) do nothing;

create index on pmhnp_clinical_profiles (provider_id);
create index on provider_credentialing_info (provider_id);
create index on provider_bank_accounts (provider_id);
create index on supervision_requirements (state);

────────────────────────────────────────────────────────────────
SECTION 2: PMHNP ONBOARDING FLOW — EXPANDED

Update app/providers/apply/page.tsx
Add PMHNP-specific steps after the base 6-step application.

When provider_type = 'pmhnp':
  Show additional steps 7-12.
  Other provider types skip to standard onboarding.

STEP 7: CLINICAL PROFILE
  Subheading: "Help us match you with the right patients."

  Age groups you see:
    [ ] Children (specify minimum age: ___)
    [ ] Adolescents (13-17)
    [ ] Adults (18-64)
    [ ] Geriatric (65+)

  Populations you are comfortable treating:
    Checkboxes for all populations list above.
    Note: "This helps us match appropriately.
    You will never be assigned cases
    outside your comfort areas."

  Populations you prefer not to treat:
    Same list. Optional. Checkboxes.

  Years of experience as PMHNP: (number input)
  Previous practice settings: (multi-select)

  Complex cases:
    [ ] I am comfortable with complex psychiatric cases
    [ ] I am comfortable with actively suicidal patients
    [ ] I require patients to be in concurrent therapy
        for medication management cases

STEP 8: PRESCRIBING PROFILE
  Subheading: "Your prescribing preferences
  help us send appropriate patient referrals."

  DEA License:
    [ ] I have an active DEA license
    DEA Number: ___
    DEA State: ___
    DEA Expiry: ___
    Upload DEA certificate.

  Medication classes I prescribe: (checkboxes)
    [ ] Antidepressants (SSRIs, SNRIs, TCAs)
    [ ] Anxiolytics (non-controlled: buspirone, hydroxyzine)
    [ ] Benzodiazepines (controlled — DEA required)
    [ ] Stimulants — Amphetamine-based (Adderall, Vyvanse)
    [ ] Stimulants — Methylphenidate-based (Ritalin, Concerta)
    [ ] Antipsychotics (typical and atypical)
    [ ] Mood Stabilizers (Lithium, Lamictal, Depakote)
    [ ] Sleep Medications (non-controlled)
    [ ] Sleep Medications (controlled — Ambien, etc.)
    [ ] Buprenorphine/Suboxone (requires X-waiver)
    [ ] Naltrexone
    [ ] Clonidine/Guanfacine
    [ ] Beta-blockers for anxiety

  Note displayed prominently:
  "Controlled substance prescribing via telehealth
  requires compliance with the Ryan Haight Act
  and applicable state laws. PsychRx will only
  route controlled substance requests to providers
  who have confirmed DEA authorization and
  appropriate patient relationships."

STEP 9: SUPERVISION AND MALPRACTICE
  Subheading: "Required for compliance and patient safety."

  State supervision check (auto-populated):
  System checks supervision_requirements table
  for each state the provider is licensed in.

  For FL license (requires supervision):
    Yellow banner:
    "Florida requires a collaborative agreement
    with a licensed MD or DO for PMHNPs.
    Please provide your supervising physician details."

    Supervising physician name: ___
    Supervising physician NPI: ___
    Supervising physician license number: ___
    Supervising physician state: ___
    Agreement expiry date: ___
    Upload collaborative agreement: [file upload]

  For full practice authority states (CA, WA, CO, AZ, IA, NH):
    Green banner:
    "[State] grants full practice authority.
    No collaborative agreement required."

  Malpractice Insurance:
    Carrier name: ___
    Policy number: ___
    Coverage amount: (dropdown)
      $1M per occurrence / $3M aggregate
      $1M per occurrence / $6M aggregate
      $2M per occurrence / $4M aggregate
      Other: ___
    Policy expiry date: ___
    Upload certificate of insurance: [file upload]

    Note: "Minimum required coverage:
    $1M per occurrence / $3M aggregate.
    PsychRx does not provide malpractice insurance.
    You must maintain your own active policy."

STEP 10: CREDENTIALING INFORMATION
  Subheading: "This information is used to credential
  you with insurance panels. It is stored securely
  and only used for credentialing purposes."

  Personal information:
    Date of birth
    SSN last four digits only
    Home address (used for credentialing not public)

  Education:
    Nursing school and graduation year
    PMHNP program and graduation year
    Board certification type (ANCC/AANP/APMHNP)
    Board certification number
    Board certification expiry
    Upload board certification

  CAQH:
    CAQH number (if existing)
    CAQH username
    Note: "If you do not have a CAQH profile
    we will help you create one. It is required
    for insurance credentialing."

  Work history (last 5 years minimum):
    Dynamic form — add up to 10 positions.
    Each: employer, address, supervisor,
    start date, end date, reason for leaving.

  Prior malpractice claims:
    [ ] I have had no malpractice claims
    [ ] I have had prior malpractice claims
        (details required — will not automatically disqualify)

  Prior license actions:
    [ ] No license actions or restrictions
    [ ] I have had prior license actions
        (details required)

  Professional references:
    3 required. Each:
    Name, title, organization, phone, email,
    years known, professional relationship.

  Document uploads:
    CV/Resume (required)
    Photo ID (required)
    Nursing diploma or transcript
    PMHNP diploma or transcript
    All state licenses (upload each)

STEP 11: BANK ACCOUNT + TAX
  Subheading: "How you get paid."

  Payment setup:
    Connect Bank Account button
    → Stripe Connect Express onboarding
    → Provider connects bank account securely
    → Platform never sees full account numbers
    → Stripe handles all payment security

  Tax information:
    Are you billing as:
      [ ] Individual (SSN)
      [ ] Business (EIN)
    If business:
      Business name: ___
      Business type: (dropdown)
        Sole proprietor
        Single-member LLC
        Multi-member LLC
        S-Corporation
        C-Corporation
      EIN: ___

    W9 Upload:
      Upload completed W9 form.
      Or: fill W9 digitally via DocuSeal.

    Note: "Payments over $600/year require
    a 1099-NEC. Your tax information is
    used solely for IRS reporting purposes."

  Payment schedule:
    Payments processed every Friday.
    ACH transfer to connected bank account.
    Estimated arrival: 1-2 business days.

STEP 12: REVIEW AND ATTESTATION
  Show summary of all information entered.
  Provider reviews each section.
  Final attestation checkbox:

  "I attest that all information provided
  is accurate and complete to the best of
  my knowledge. I understand that false
  or misleading information may result in
  immediate termination from the PsychRx
  network and reporting to relevant
  licensing boards."

  Provider signs via DocuSeal.
  Timestamp recorded.
  Application submitted.

────────────────────────────────────────────────────────────────
SECTION 3: AUTOMATED CREDENTIALING WORKFLOW

Create services/credentialing/credentialing.ts

ON PMHNP APPLICATION SUBMISSION:

STEP 1: IMMEDIATE AUTOMATED CHECKS
  Run these instantly on submission:

  a. NPPES verification:
     Call NPPES API with provider NPI.
     Verify: name matches, NPI active,
     taxonomy code is PMHNP,
     address on file.
     Flag if any mismatch.

  b. OIG exclusion check:
     Check LEIE API immediately.
     Flag and suspend if found.

  c. Board certification verification:
     ANCC verification: nursingworld.org/certification/verify
     AANP verification: aanp.org/certification/verify
     Automated HTTP request to verification endpoint.
     Store verified status.

  d. State license verification:
     Check each state license against
     state nursing board verification URLs.
     FL: flhealthsource.gov
     CA: rn.ca.gov
     WA: doh.wa.gov
     CO: dora.colorado.gov
     AZ: azbn.gov
     IA: nursing.iowa.gov
     NH: oplc.nh.gov
     Store: active/inactive/expired/suspended.

  e. Malpractice verification:
     Upload certificate reviewed by admin.
     System checks: expiry date in future,
     coverage amounts meet minimum,
     provider name matches.
     Flag if below minimum coverage.

  f. Collaborative agreement check (FL):
     If FL license and supervision_required = true:
     Check collaborative_agreement_signed = true.
     Check collaborative_agreement_expiry > today + 30 days.
     Block activation if missing.

STEP 2: CAQH PROFILE CHECK
  If caqh_number provided:
    Note: CAQH does not have a public API.
    Admin manually logs into CAQH ProView.
    Verifies profile is complete and attested.
    Updates caqh_last_attested in system.
    Marks caqh_verified = true.

  If no caqh_number:
    SMS provider:
    "PsychRx: You will need a CAQH ProView
    profile for insurance credentialing.
    Create one free at proview.caqh.org.
    Once created reply with your CAQH number."
    Hold credentialing until CAQH number received.

STEP 3: CREDENTIALING PACKET GENERATION
  Once all verifications pass:
  Generate credentialing packet per payer.

  Each payer needs:
    Completed application (payer-specific form)
    CV/resume
    Copy of all licenses
    Copy of board certification
    Copy of DEA certificate
    Copy of malpractice certificate
    CAQH number and attestation date
    Collaborative agreement (if FL)
    W9
    Headshot (some payers require)

  SMS admin (you or credentialing coordinator):
  "PsychRx: New PMHNP ready for credentialing.
  [Provider name] — all verifications passed.
  Documents are ready in admin portal.
  Submit to: Aetna, Cigna, United, BCBS FL, Humana.
  Start with Aetna (fastest approval typically)."

STEP 4: CREDENTIALING STATUS TRACKING
  Admin updates status per payer in admin portal.
  Status options:
    not_started
    packet_submitted
    pending_approval
    approved (with effective date)
    denied (with reason)
    resubmitted
    on_hold

  Automated alerts:
  If pending_approval for > 90 days:
    SMS admin: "Credentialing alert:
    [Provider] has been pending with [Payer]
    for 90 days. Follow up recommended."

  When approved:
    Update provider_credentialing_info.
    Store effective date.
    Store provider ID number.
    If all 5 payers approved:
      SMS provider: "Great news — you are now
      credentialed with all 5 insurance panels.
      You can start seeing insured patients."
    If partial approval:
      SMS provider: "You are now credentialed
      with [payer]. You can see [payer] patients
      now. [X] payers still pending."

────────────────────────────────────────────────────────────────
SECTION 4: PATIENT MATCHING USING CLINICAL PROFILE

Update services/scheduling/matching.ts
filterProvidersByPatientNeeds(patient, providers):

Additional filters using pmhnp_clinical_profiles:

AGE FILTER:
  If patient.dob indicates patient is under 18:
    Only providers where sees_adolescents = true.
  If patient.dob indicates patient is over 65:
    Prefer providers where sees_geriatric = true.
  If patient.dob indicates child under 13:
    Only providers where sees_children = true
    AND sees_children_min_age <= patient_age.

POPULATION FILTER:
  If patient has diagnosis flagged in intake:
    Match to providers whose populations_comfortable
    includes that diagnosis category.
    Exclude providers whose populations_avoid
    includes that diagnosis category.
    Never assign a provider to a population
    they have flagged as prefer to avoid.

CONTROLLED SUBSTANCE FILTER:
  If patient needs stimulant (ADHD):
    Only providers where prescribes_stimulants = true
    AND has_dea_license = true.
  If patient needs benzo:
    Only providers where prescribes_benzodiazepines = true
    AND has_dea_license = true.
  If patient needs Suboxone:
    Only providers where prescribes_suboxone = true.

SUPERVISION FILTER:
  If patient is in state where provider
  requires supervision:
    Check collaborative_agreement_signed = true.
    Check collaborative_agreement_expiry > today.
    Block if supervision not in place.

COMPLEX CASE FILTER:
  If patient has prior suicide attempt in intake:
    Only providers where
    comfortable_with_suicidal_ideation = true.
  If case flagged as complex:
    Only providers where
    comfortable_with_complex_cases = true.

CONCURRENT THERAPY FILTER:
  If provider requires_therapy_concurrent = true:
    Patient must have an active therapist
    on PsychRx or a documented outside therapist.
    Block assignment if no therapist confirmed.

LANGUAGE FILTER:
  If patient.preferred_language != 'English':
    Check provider.clinical_languages includes
    patient preferred language.
    Prefer providers who speak patient language.

────────────────────────────────────────────────────────────────
SECTION 5: ADMIN CREDENTIALING DASHBOARD

Add to app/admin/credentialing/page.tsx:

PROVIDER PIPELINE VIEW:
  Table: all PMHNPs in credentialing pipeline.
  Columns:
    Provider name
    NPI
    States licensed
    CAQH status (verified/pending/missing)
    Aetna status + days pending
    Cigna status + days pending
    United status + days pending
    BCBS FL status + days pending
    Humana status + days pending
    Malpractice expiry
    Collaborative agreement status (FL)
    Actions

  Color coding:
    Green: approved
    Yellow: pending < 90 days
    Red: pending > 90 days or expired
    Grey: not started

  BULK ACTIONS:
    Select multiple providers.
    Export credentialing packet (zip of all documents).
    Mark selected as submitted to payer.
    Send reminder to providers with missing documents.

CREDENTIALING ALERTS:
  Expiring soon (60 days): license, malpractice, DEA,
    board cert, collaborative agreement.
  Pending too long (90+ days): payer applications.
  Missing documents: block activation.
  Supervision gap: FL providers without collab agreement.

CREDENTIALING NOTES:
  Per-provider notes field.
  Credentialing coordinator can log:
    Who they spoke to at payer.
    Reference numbers.
    Expected timelines.
    Issues encountered.
  Timestamped automatically.
  Cannot be deleted — audit trail.

────────────────────────────────────────────────────────────────
SECTION 6: SUPERVISION MONITORING WORKER

Add to workers/compliance.worker.ts:

checkSupervisionRequirements():
  Run daily 9 AM.

  For each active PMHNP:
    Get their licensed states.
    For each state:
      Check supervision_requirements table.
      If requires_supervision = true:
        Check collaborative_agreement_signed.
        Check collaborative_agreement_expiry.

    If agreement expires in 90 days:
      SMS provider: "Your collaborative agreement
      with Dr. [name] expires in 90 days.
      Please begin renewal process.
      Upload renewed agreement in your portal."

    If agreement expires in 30 days:
      SMS provider AND owner: URGENT alert.

    If agreement expired:
      Suspend provider from FL patients immediately.
      SMS provider: "Your collaborative agreement
      has expired. You cannot see FL patients
      until a valid agreement is on file.
      Upload renewed agreement to reactivate."
      SMS owner: "[Provider] collaborative agreement
      expired. FL patients reassigned pending renewal."

    If no agreement on file for FL:
      Block from FL patient assignment entirely.
      Flag in admin credentialing dashboard.

────────────────────────────────────────────────────────────────
SECTION 7: 1099 AND PAYMENT COMPLIANCE

Add to services/payments/tax-compliance.ts:

track1099Payments(providerId):
  Run after every provider payment.
  Accumulate ytd_payments in provider_bank_accounts.
  When ytd_payments crosses $600:
    Flag requires_1099 = true.
    Add to 1099 tracking list.

generate1099Reports():
  Run January 1 each year for prior year.
  For each provider where ytd_payments >= $600:
    Generate 1099-NEC data.
    Provider name, address, SSN/EIN last four.
    Total payments for year.
    Export to Track1099 or Stripe Tax.

  SMS owner January 1:
  "PsychRx: 1099 season.
  [X] providers require 1099-NEC this year.
  Total payments: $[amount].
  Review in admin portal under Tax Reports."

  Provider notification:
  SMS each provider January 15:
  "PsychRx: Your 1099-NEC for [year] is
  available in your earnings portal.
  Total payments: $[amount].
  Download for your tax records."

W9 VERIFICATION:
  Block first payment if w9_on_file = false.
  SMS provider: "Please upload your W9 to
  receive your first payment.
  Upload at psychrx.com/portal/settings"

EIN vs SSN HANDLING:
  Never store full SSN or EIN.
  Store last four digits only.
  Full number handled by Stripe only.
  Stripe is the secure storage layer.

────────────────────────────────────────────────────────────────
SECTION 8: PRESCRIBING SAFETY GUARDRAILS

Add to services/compliance/prescribing-safety.ts:

checkPrescribingEligibility(providerId, patientId, medicationType):

  CONTROLLED SUBSTANCE CHECK:
    If medicationType in ['stimulant','benzo','sleep_controlled']:
      Check provider.has_dea_license = true.
      Check provider.dea_expiry > today.
      Check provider.prescribes_[type] = true.
      Check patient has completed 2+ video sessions.
        (Ryan Haight — established relationship required)
      Check PDMP was documented in last session note.
      If any check fails:
        Block prescribing.
        Return specific reason.
        Log to audit_log.

  NEW PATIENT CONTROLLED SUBSTANCE:
    If patient.completed_sessions < 2:
      Block controlled substance prescribing entirely.
      SMS provider:
      "Controlled substances require an established
      patient relationship (minimum 2 completed
      video sessions) under the Ryan Haight Act.
      This patient has completed [X] sessions."

  PEDIATRIC PRESCRIBING:
    If patient_age < 18:
      Check provider.sees_children or sees_adolescents.
      If provider not cleared for minors:
        Block assignment entirely.
        Never allow prescribing to minors
        by providers not cleared for that age group.

  POPULATION MISMATCH:
    If patient diagnosis in provider.populations_avoid:
      Flag for review.
      Do not auto-assign.
      Require manual admin approval.

  SUPERVISION STATE PRESCRIBING:
    If patient_state requires supervision:
      Check collaborative_agreement is active.
      If not active: block prescribing in that state.
      Log to audit_log with specific reason.
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 24 — INTEGRATION TESTS FOR PROMPT 23
# ══════════════════════════════════════════════════════════════════

PROMPT_24 = """
Update tests/integration-checklist.md
to add testing for all Prompt 23 features.

SECTION 24 — PMHNP CLINICAL PROFILE:
[ ] PMHNP application shows extended steps 7-12
[ ] Other provider types skip PMHNP-specific steps
[ ] Age group selections save correctly to database
[ ] Population checkboxes save to populations_comfortable array
[ ] Prescribing profile saves controlled substance flags
[ ] DEA license upload and verification works
[ ] Clinical profile used in patient matching correctly
[ ] Adolescent patient only matched to providers with sees_adolescents = true
[ ] Stimulant request only routed to DEA-licensed providers

SECTION 25 — SUPERVISION REQUIREMENTS:
[ ] FL license triggers collaborative agreement requirement
[ ] Full practice authority states show green banner
[ ] Supervision_requirements table seeded correctly
[ ] FL provider blocked from FL patients without agreement
[ ] Collaborative agreement expiry alert fires at 90 days
[ ] Expired agreement suspends FL patient access automatically
[ ] Supervising physician NPI verified against NPPES

SECTION 26 — MALPRACTICE VERIFICATION:
[ ] Certificate upload stores in Supabase documents bucket
[ ] Expiry date extracted and stored
[ ] Below minimum coverage flagged in admin
[ ] Expiry alert fires at 90/60/30/14/7 days
[ ] Provider suspended if malpractice expires

SECTION 27 — CREDENTIALING INTAKE:
[ ] All credentialing fields save to provider_credentialing_info
[ ] NPPES verification runs on submission
[ ] OIG check runs immediately on submission
[ ] Board certification verification attempted automatically
[ ] State license verification runs for each state
[ ] CAQH number missing triggers SMS to provider
[ ] Work history saves as JSONB correctly
[ ] Professional references save as JSONB correctly

SECTION 28 — CREDENTIALING DASHBOARD:
[ ] Admin credentialing table shows all PMHNPs
[ ] Color coding correct (green/yellow/red/grey)
[ ] 90-day pending alert fires correctly
[ ] Status update saves and timestamps correctly
[ ] Credentialing notes cannot be deleted
[ ] Export credentialing packet generates zip file
[ ] Bulk status update works correctly

SECTION 29 — BANK ACCOUNT AND 1099:
[ ] Stripe Connect onboarding link generated correctly
[ ] Bank account verified status updates on Stripe webhook
[ ] W9 upload blocks first payment if missing
[ ] YTD payments accumulate correctly
[ ] $600 threshold triggers requires_1099 flag
[ ] 1099 report generates correctly for prior year
[ ] Provider receives 1099 notification SMS January 15
[ ] SSN/EIN only stored as last four digits

SECTION 30 — PRESCRIBING SAFETY:
[ ] Stimulant request blocked for non-DEA providers
[ ] New patient controlled substance blocked correctly
[ ] Ryan Haight 2-session requirement enforced
[ ] Pediatric patient blocked from non-pediatric providers
[ ] Population mismatch flagged for admin review
[ ] FL patient blocked if collaborative agreement expired
[ ] All blocks logged to audit_log with specific reason
[ ] PDMP documentation required before controlled substance
"""

# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 25 — THERAPY MODALITIES + RECURRING SCHEDULE ENGINE
# ══════════════════════════════════════════════════════════════════

PROMPT_25 = """
See Prompt 26 test section below for all features.
The full implementation code was added as part of the appended build.
"""


# ══════════════════════════════════════════════════════════════════
# CURSOR PROMPT 26 — INTEGRATION TESTS FOR PROMPT 25
# ══════════════════════════════════════════════════════════════════

PROMPT_26 = """
Update tests/integration-checklist.md
for Prompt 25 features.

SECTION 31 — THERAPY MODALITIES:
[ ] Therapist application shows modality steps
[ ] Primary modality required before submission
[ ] All modality checkboxes save to array correctly
[ ] Specialty certifications upload and store correctly
[ ] Couples therapy option only shows couples-eligible providers
[ ] Family therapy option only shows family-eligible providers
[ ] Modality match boosts provider score in matching algorithm
[ ] EMDR patient routed to EMDR providers preferentially
[ ] OCD patient routed to ERP providers preferentially
[ ] Trauma patient routed to trauma-modality providers

SECTION 32 — RECURRING SCHEDULE SETUP:
[ ] Booking step 7A shows frequency options
[ ] Weekly selection creates recurring_schedules record correctly
[ ] Biweekly selection creates record with frequency=biweekly
[ ] Monthly selection creates record with frequency=monthly
[ ] As-needed selection skips recurring setup entirely
[ ] next_scheduled_date calculated correctly for each frequency
[ ] Patient receives SMS confirmation of recurring setup
[ ] Patient confirmation checkbox required before proceeding

SECTION 33 — AUTO-BOOKING WORKER:
[ ] processRecurringSchedules() runs daily 8 AM
[ ] Slot available: appointment auto-created correctly
[ ] Slot unavailable: adjacent time checked automatically
[ ] Adjacent time booked: patient SMS with KEEP/RESCHEDULE
[ ] No slot at all: patient and provider both SMS notified
[ ] Skip date respected: occurrence skipped correctly
[ ] Paused schedule: no booking during pause period
[ ] Pause end: schedule resumes automatically
[ ] next_scheduled_date advances correctly after each booking
[ ] Weekly: advances exactly 7 days
[ ] Biweekly: advances exactly 14 days
[ ] Monthly: advances exactly 28 days

SECTION 34 — PATIENT SCHEDULE MANAGEMENT:
[ ] Recurring schedule shows in patient portal
[ ] Pause: sets pause_start and pause_end correctly
[ ] Pause: auto-booking stops during pause
[ ] Resume: auto-booking resumes on pause_end
[ ] Change time: updates all future bookings
[ ] Skip one: adds to skip_dates, returns to normal after
[ ] Change frequency: recalculates next_scheduled_date
[ ] Cancel: stops all future auto-bookings
[ ] Cancel: already-booked appointments remain

SECTION 35 — NO-SHOW ON RECURRING:
[ ] No-show fee charges correctly on recurring appointment
[ ] Schedule does not cancel after one no-show
[ ] Three consecutive no-shows pauses schedule automatically
[ ] Provider and admin SMS on three consecutive no-shows
[ ] 7-day advance reminder fires for recurring patients only
[ ] Reminder includes next auto-booked date

SECTION 36 — MEDICATION MANAGEMENT CADENCE:
[ ] After first PMHNP appointment: frequency recommendation generated
[ ] Provider can override AI frequency suggestion
[ ] Patient receives YES/NO SMS for auto-schedule
[ ] YES response creates recurring_schedule automatically
[ ] New medication flag triggers biweekly minimum
[ ] Provider confirmation required to reduce frequency
[ ] Stability confirmation logged in encounters table

SECTION 37 — ADMIN RECURRING DASHBOARD:
[ ] Recurring schedule metrics display correctly
[ ] Failed auto-bookings listed for admin action
[ ] No-show rate comparison shows recurring vs as-needed
[ ] Alert fires when failed auto-booking > 5%
[ ] Recurring vs as-needed ratio displayed
"""
