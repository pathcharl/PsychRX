// ============================================================================
// DocuSeal integration — provider contracts, patient consent, BAA.
// API docs: https://www.docuseal.com/docs/api
// ============================================================================
import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail } from "@/lib/api";
import { APP_URL } from "@/lib/constants";
import { activateProviderPortalAfterContract } from "@/lib/provider-portal/activation";

const API_BASE = process.env.DOCUSEAL_API_URL ?? "https://api.docuseal.com";
const TOKEN = process.env.DOCUSEAL_TOKEN ?? "";

export interface DocuSealSubmitter {
  email: string;
  role?: string;
  name?: string;
  phone?: string;
  external_id?: string;
  fields?: Array<{ name: string; default_value?: string }>;
}

export interface DocuSealSubmission {
  id: number | string;
  status?: string;
  submitters?: Array<{
    id: number;
    email: string;
    status: string;
    embed_src?: string;
    slug?: string;
  }>;
  audit_log_url?: string;
  documents?: Array<{ name?: string; url?: string }>;
}

export interface DocuSealTemplate {
  id: number;
  name: string;
  slug?: string;
  created_at?: string;
}

async function docusealFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!TOKEN) throw new Error("DocuSeal is not configured. Set DOCUSEAL_TOKEN.");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": TOKEN,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DocuSeal API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** List available DocuSeal templates. */
export async function listTemplates(): Promise<DocuSealTemplate[]> {
  const data = await docusealFetch<{ data?: DocuSealTemplate[] } | DocuSealTemplate[]>(
    "/templates"
  );
  return Array.isArray(data) ? data : (data.data ?? []);
}

/** Check signing status for a submission. */
export async function getSubmissionStatus(
  submissionId: string | number
): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>(`/submissions/${submissionId}`);
}

interface CreateSubmissionInput {
  templateId: number;
  submitters: DocuSealSubmitter[];
  metadata?: Record<string, string>;
  sendEmail?: boolean;
}

async function createSubmission(input: CreateSubmissionInput): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>("/submissions", {
    method: "POST",
    body: JSON.stringify({
      template_id: input.templateId,
      send_email: input.sendEmail ?? true,
      submitters: input.submitters.map((s) => ({
        email: s.email,
        role: s.role ?? "Signer",
        name: s.name,
        phone: s.phone,
        fields: s.fields,
        external_id: (s as DocuSealSubmitter & { external_id?: string }).external_id,
      })),
      metadata: input.metadata,
    }),
  });
}

interface ProviderLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  npi?: string | null;
  license_state?: string | null;
}

interface PatientLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

function providerName(p: ProviderLike): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Provider";
}

/** Prefill fields on the ICA template (PsychRx Services Agreement). */
function buildIcaSubmitterFields(
  provider: ProviderLike
): DocuSealSubmitter["fields"] {
  const fields: NonNullable<DocuSealSubmitter["fields"]> = [];
  const name = providerName(provider);

  if (name) {
    fields.push({ name: "Contracting Party", default_value: name });
  }
  if (provider.npi) {
    fields.push({ name: "NPI Number", default_value: provider.npi });
  }
  if (provider.license_state) {
    fields.push({ name: "License State(s)", default_value: provider.license_state });
  }

  return fields.length > 0 ? fields : undefined;
}

async function loadProviderContractFields(
  provider: ProviderLike
): Promise<ProviderLike> {
  if (provider.npi && provider.license_state) return provider;

  const { data } = await supabaseAdmin
    .from("providers")
    .select("npi, license_state")
    .eq("id", provider.id)
    .maybeSingle();

  return {
    ...provider,
    npi: provider.npi ?? (data as { npi?: string } | null)?.npi ?? null,
    license_state:
      provider.license_state ??
      (data as { license_state?: string } | null)?.license_state ??
      null,
  };
}

function templateId(envKey: string): number {
  const raw = process.env[envKey];
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) {
    throw new Error(`Missing or invalid ${envKey} for DocuSeal template.`);
  }
  return id;
}

/** Send the Independent Contractor Agreement (ICA) to a provider. */
export async function sendProviderContract(
  provider: ProviderLike
): Promise<{ submission: DocuSealSubmission; contractId: string }> {
  if (!provider.email) throw new Error("Provider email is required for contract signing.");

  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .insert({
      payer_name: "PsychRx",
      contract_type: "group",
      contract_kind: "ica",
      provider_id: provider.id,
      status: "pending",
      effective_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const enriched = await loadProviderContractFields(provider);

  const submission = await createSubmission({
    templateId: templateId("DOCUSEAL_PROVIDER_ICA_TEMPLATE_ID"),
    submitters: [
      {
        email: enriched.email!,
        role: "Contracting Party",
        name: providerName(enriched),
        phone: enriched.phone ?? undefined,
        external_id: provider.id,
        fields: buildIcaSubmitterFields(enriched),
      },
    ],
    metadata: {
      contract_id: contract.id,
      provider_id: provider.id,
      type: "ica",
    },
  });

  await supabaseAdmin
    .from("contracts")
    .update({ docuseal_submission_id: String(submission.id) })
    .eq("id", contract.id);

  await supabaseAdmin
    .from("providers")
    .update({ docuseal_submission_id: String(submission.id) })
    .eq("id", provider.id);

  return { submission, contractId: contract.id };
}

/** Send patient consent forms via DocuSeal. */
export async function sendPatientConsent(
  patient: PatientLike
): Promise<{ submission: DocuSealSubmission; contractId: string }> {
  if (!patient.email) throw new Error("Patient email is required for consent forms.");

  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .insert({
      payer_name: "PsychRx",
      contract_type: "single_case",
      contract_kind: "patient_consent",
      status: "pending",
      notes: `Patient consent for ${patient.id}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const submission = await createSubmission({
    templateId: templateId("DOCUSEAL_PATIENT_CONSENT_TEMPLATE_ID"),
    submitters: [
      {
        email: patient.email,
        role: "Patient",
        name: [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient",
        phone: patient.phone ?? undefined,
      },
    ],
    metadata: {
      contract_id: contract.id,
      patient_id: patient.id,
      type: "patient_consent",
    },
  });

  await supabaseAdmin
    .from("contracts")
    .update({ docuseal_submission_id: String(submission.id) })
    .eq("id", contract.id);

  return { submission, contractId: contract.id };
}

/** Send a Business Associate Agreement (BAA) to a provider. */
export async function sendBAA(
  provider: ProviderLike
): Promise<{ submission: DocuSealSubmission; contractId: string }> {
  if (!provider.email) throw new Error("Provider email is required for BAA signing.");

  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .insert({
      payer_name: "PsychRx",
      contract_type: "group",
      contract_kind: "baa",
      provider_id: provider.id,
      status: "pending",
      effective_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const submission = await createSubmission({
    templateId: templateId("DOCUSEAL_BAA_TEMPLATE_ID"),
    submitters: [
      {
        email: provider.email,
        role: "Provider",
        name: providerName(provider),
        fields: [{ name: "Provider Name", default_value: providerName(provider) }],
      },
    ],
    metadata: {
      contract_id: contract.id,
      provider_id: provider.id,
      type: "baa",
    },
  });

  await supabaseAdmin
    .from("contracts")
    .update({ docuseal_submission_id: String(submission.id) })
    .eq("id", contract.id);

  return { submission, contractId: contract.id };
}

/** Build an embed/signing URL when DocuSeal returns a submitter slug. */
export function signingUrl(submission: DocuSealSubmission): string | null {
  const slug = submission.submitters?.[0]?.slug;
  if (!slug) return null;
  const base = process.env.DOCUSEAL_URL ?? APP_URL;
  return `${base}/s/${slug}`;
}

// ---------------------------------------------------------------------------
// Webhook handler (used by /api/webhooks/docuseal and /api/contracts/sign-webhook)
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[docuseal/webhook]";

const COMPLETION_EVENTS = new Set([
  "form.completed",
  "submission.completed",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function pickMetadata(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  for (const src of sources) {
    const meta = asRecord(src?.metadata);
    if (meta && Object.keys(meta).length > 0) return meta;
  }
  return {};
}

/** DocuSeal form.completed uses data.id for submitter id — not submission id. */
function resolveSubmissionId(
  eventType: string,
  data: Record<string, unknown>
): string | null {
  const submission = asRecord(data.submission);

  const fromField =
    asString(data.submission_id) ??
    asString(submission?.id) ??
    asString(data.metadata?.submission_id);

  if (fromField) return fromField;

  if (eventType === "submission.completed") {
    return asString(data.id);
  }

  const submitters = Array.isArray(data.submitters) ? data.submitters : [];
  const first = asRecord(submitters[0]);
  return asString(first?.submission_id);
}

function resolveSubmitterEmail(data: Record<string, unknown>): string | null {
  const direct = asString(data.email);
  if (direct) return direct;

  const submitters = Array.isArray(data.submitters) ? data.submitters : [];
  for (const item of submitters) {
    const email = asString(asRecord(item)?.email);
    if (email) return email;
  }
  return null;
}

function resolveCompletedAt(
  data: Record<string, unknown>,
  fallback?: string
): string {
  const submitters = Array.isArray(data.submitters) ? data.submitters : [];
  const first = asRecord(submitters[0]);
  return (
    asString(data.completed_at) ??
    asString(first?.completed_at) ??
    fallback ??
    new Date().toISOString()
  );
}

function resolveDocumentUrl(data: Record<string, unknown>): string | null {
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const firstDoc = asRecord(docs[0]);
  return (
    asString(firstDoc?.url) ??
    asString(data.audit_log_url) ??
    asString(asRecord(data.submission)?.audit_log_url) ??
    asString(data.combined_document_url)
  );
}

function resolveExternalProviderId(data: Record<string, unknown>): string | null {
  return (
    asString(data.external_id) ??
    asString(data.application_key) ??
    asString(
      asRecord(
        Array.isArray(data.submitters) ? asRecord(data.submitters[0]) : null
      )?.external_id
    )
  );
}

/**
 * DocuSeal Cloud webhooks are unsigned by default.
 * Only enforce auth when DOCUSEAL_WEBHOOK_SECRET is explicitly set.
 */
function isAuthorized(req: NextRequest): boolean {
  const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!webhookSecret) return true;

  const provided =
    req.headers.get("x-docuseal-signature") ??
    req.headers.get("x-docuseal-token") ??
    req.nextUrl.searchParams.get("secret") ??
    "";

  return provided === webhookSecret;
}

async function findContract(params: {
  contractId: string | null;
  submissionId: string | null;
}) {
  if (params.contractId) {
    const { data } = await supabaseAdmin
      .from("contracts")
      .select("id, provider_id, docuseal_submission_id")
      .eq("id", params.contractId)
      .maybeSingle();
    if (data) return data;
  }

  if (params.submissionId) {
    const { data } = await supabaseAdmin
      .from("contracts")
      .select("id, provider_id, docuseal_submission_id")
      .eq("docuseal_submission_id", params.submissionId)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function findProviderId(params: {
  providerIdFromMeta: string | null;
  externalProviderId: string | null;
  submissionId: string | null;
  submitterEmail: string | null;
  contractProviderId: string | null;
}): Promise<string | null> {
  const candidates = [
    params.contractProviderId,
    params.providerIdFromMeta,
    params.externalProviderId,
  ].filter(Boolean) as string[];

  for (const id of candidates) {
    const { data } = await supabaseAdmin
      .from("providers")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (data?.id) {
      console.log(`${LOG_PREFIX} matched provider by id:`, data.id);
      return data.id as string;
    }
  }

  if (params.submissionId) {
    const { data } = await supabaseAdmin
      .from("providers")
      .select("id, email")
      .eq("docuseal_submission_id", params.submissionId)
      .maybeSingle();
    if (data?.id) {
      console.log(
        `${LOG_PREFIX} matched provider by docuseal_submission_id:`,
        data.id,
        data.email
      );
      return data.id as string;
    }
  }

  if (params.submitterEmail) {
    const { data } = await supabaseAdmin
      .from("providers")
      .select("id, email")
      .ilike("email", params.submitterEmail)
      .maybeSingle();
    if (data?.id) {
      console.log(
        `${LOG_PREFIX} matched provider by email:`,
        data.email,
        "→",
        data.id
      );
      return data.id as string;
    }
  }

  console.log(`${LOG_PREFIX} no provider match`, params);
  return null;
}

/** Process DocuSeal webhook events (form.completed / submission.completed). */
export async function handleDocusealWebhook(req: NextRequest) {
  if (!isAuthorized(req)) {
    console.warn(`${LOG_PREFIX} rejected — invalid webhook secret`);
    return fail("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  console.log(`${LOG_PREFIX} raw payload:`, JSON.stringify(body, null, 2));

  const root = asRecord(body);
  if (!root) return fail("Invalid webhook payload", 422);

  const eventType = asString(root.event_type);
  if (!eventType) return fail("Missing event_type", 422);

  console.log(`${LOG_PREFIX} event_type:`, eventType);

  if (!COMPLETION_EVENTS.has(eventType)) {
    console.log(`${LOG_PREFIX} ignored event:`, eventType);
    return ok({ received: true, ignored: eventType });
  }

  const data = asRecord(root.data);
  if (!data) return fail("Missing data object", 422);

  const submissionId = resolveSubmissionId(eventType, data);
  const submitterEmail = resolveSubmitterEmail(data);
  const completedAt = resolveCompletedAt(data, asString(root.timestamp));
  const documentUrl = resolveDocumentUrl(data);
  const metadata = pickMetadata(data, asRecord(data.submission));
  const contractId = asString(metadata.contract_id);
  const providerIdFromMeta = asString(metadata.provider_id);
  const externalProviderId = resolveExternalProviderId(data);

  console.log(`${LOG_PREFIX} parsed fields:`, {
    submissionId,
    submitterEmail,
    completedAt,
    contractId,
    providerIdFromMeta,
    externalProviderId,
    documentUrl,
    dataId: data.id,
    dataSubmissionId: data.submission_id,
  });

  if (!submissionId && !contractId && !submitterEmail && !externalProviderId) {
    return ok({
      received: true,
      linked: false,
      reason: "missing_identifiers",
    });
  }

  const existingContract = await findContract({
    contractId,
    submissionId,
  });

  console.log(`${LOG_PREFIX} contract lookup:`, existingContract ?? "not found");

  const contractUpdate = {
    status: "signed",
    signed_at: completedAt,
    ...(submissionId ? { docuseal_submission_id: submissionId } : {}),
    ...(documentUrl
      ? { signed_pdf_url: documentUrl, document_url: documentUrl }
      : {}),
  };

  if (existingContract?.id) {
    const { error } = await supabaseAdmin
      .from("contracts")
      .update(contractUpdate)
      .eq("id", existingContract.id);
    if (error) {
      console.error(`${LOG_PREFIX} contract update failed:`, error.message);
      return fail(error.message, 500);
    }
    console.log(`${LOG_PREFIX} updated contract:`, existingContract.id);
  } else if (contractId) {
    const { error } = await supabaseAdmin
      .from("contracts")
      .update(contractUpdate)
      .eq("id", contractId);
    if (error) {
      console.error(`${LOG_PREFIX} contract update by id failed:`, error.message);
    }
  }

  const providerId = await findProviderId({
    providerIdFromMeta,
    externalProviderId,
    submissionId,
    submitterEmail,
    contractProviderId: existingContract?.provider_id ?? null,
  });

  let providerActivated = {
    accountCreated: false,
    emailSent: false,
  };

  if (providerId) {
    const { data: providerRow, error: providerErr } = await supabaseAdmin
      .from("providers")
      .update({
        contract_signed: true,
        contract_signed_at: completedAt,
        ...(submissionId ? { docuseal_submission_id: submissionId } : {}),
        onboarding_step: "contract_signed",
      })
      .eq("id", providerId)
      .select("id, email, first_name, last_name, contract_signed")
      .maybeSingle();

    if (providerErr) {
      console.error(`${LOG_PREFIX} provider update failed:`, providerErr.message);
      return fail(providerErr.message, 500);
    }

    console.log(`${LOG_PREFIX} updated provider:`, providerRow);

    if (providerRow?.email) {
      providerActivated = await activateProviderPortalAfterContract({
        providerId: providerRow.id as string,
        email: providerRow.email as string,
        firstName: (providerRow.first_name as string) ?? "",
        lastName: (providerRow.last_name as string) ?? "",
      });
      console.log(`${LOG_PREFIX} portal activation:`, providerActivated);
    }
  } else {
    console.warn(
      `${LOG_PREFIX} could not resolve provider — contract_signed not updated`
    );
  }

  return ok({
    received: true,
    linked: Boolean(providerId),
    event_type: eventType,
    submission_id: submissionId,
    submitter_email: submitterEmail,
    completed_at: completedAt,
    provider_id: providerId,
    contract_id: existingContract?.id ?? contractId,
    portal: providerActivated,
  });
}
