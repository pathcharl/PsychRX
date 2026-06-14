// ============================================================================
// DocuSeal integration — provider contracts, patient consent, BAA.
// API docs: https://www.docuseal.com/docs/api
// ============================================================================
import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail } from "@/lib/api";
import { APP_URL } from "@/lib/constants";

const API_BASE = process.env.DOCUSEAL_API_URL ?? "https://api.docuseal.com";
const TOKEN = process.env.DOCUSEAL_TOKEN ?? "";

export interface DocuSealSubmitter {
  email: string;
  role?: string;
  name?: string;
  phone?: string;
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

const docusealEventSchema = z.object({
  event_type: z.string(),
  timestamp: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      submission_id: z.union([z.string(), z.number()]).optional(),
      email: z.string().optional(),
      completed_at: z.string().optional(),
      status: z.string().optional(),
      audit_log_url: z.string().url().optional(),
      submitters: z
        .array(
          z.object({
            email: z.string().optional(),
            completed_at: z.string().optional(),
          })
        )
        .optional(),
      documents: z
        .array(z.object({ name: z.string().optional(), url: z.string().optional() }))
        .optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
});

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.DOCUSEAL_TOKEN;
  if (!secret) return true;
  const provided =
    req.headers.get("x-docuseal-signature") ??
    req.headers.get("x-docuseal-token") ??
    "";
  return provided === secret;
}

/** Process DocuSeal webhook events (form.completed / submission.completed). */
export async function handleDocusealWebhook(req: NextRequest) {
  if (!isAuthorized(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = docusealEventSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid webhook payload", 422, parsed.error.flatten());
  }

  const { event_type, data } = parsed.data;

  if (event_type !== "form.completed" && event_type !== "submission.completed") {
    return ok({ received: true, ignored: event_type });
  }

  const submissionId = String(
    data.submission_id ?? data.id ?? data.metadata?.submission_id ?? ""
  );
  const submitterEmail =
    data.email ?? data.submitters?.[0]?.email ?? null;
  const completedAt =
    data.completed_at ??
    data.submitters?.[0]?.completed_at ??
    parsed.data.timestamp ??
    new Date().toISOString();
  const documentUrl = data.documents?.[0]?.url ?? data.audit_log_url ?? null;

  const contractId =
    typeof data.metadata?.contract_id === "string"
      ? data.metadata.contract_id
      : null;

  let contractQuery = supabaseAdmin.from("contracts").select("id, provider_id");

  if (contractId) {
    contractQuery = contractQuery.eq("id", contractId);
  } else if (submissionId) {
    contractQuery = contractQuery.eq("docuseal_submission_id", submissionId);
  } else {
    return ok({ received: true, linked: false, reason: "missing_submission_id" });
  }

  const { data: existingContract } = await contractQuery.maybeSingle();

  const contractUpdate = {
    status: "signed",
    signed_at: completedAt,
    docuseal_submission_id: submissionId || null,
    ...(documentUrl ? { signed_pdf_url: documentUrl, document_url: documentUrl } : {}),
  };

  let providerId = existingContract?.provider_id ?? null;

  if (existingContract?.id) {
    const { error } = await supabaseAdmin
      .from("contracts")
      .update(contractUpdate)
      .eq("id", existingContract.id);
    if (error) return fail(error.message, 500);
  } else if (contractId) {
    const { error } = await supabaseAdmin
      .from("contracts")
      .update(contractUpdate)
      .eq("id", contractId);
    if (error) return fail(error.message, 500);
    const { data: c } = await supabaseAdmin
      .from("contracts")
      .select("provider_id")
      .eq("id", contractId)
      .maybeSingle();
    providerId = c?.provider_id ?? null;
  }

  if (providerId) {
    const { error: providerErr } = await supabaseAdmin
      .from("providers")
      .update({
        contract_signed: true,
        contract_signed_at: completedAt,
        docuseal_submission_id: submissionId || null,
        onboarding_step: "contract_signed",
      })
      .eq("id", providerId);
    if (providerErr) return fail(providerErr.message, 500);
  } else if (submitterEmail) {
    await supabaseAdmin
      .from("providers")
      .update({
        contract_signed: true,
        contract_signed_at: completedAt,
        docuseal_submission_id: submissionId || null,
      })
      .eq("email", submitterEmail);
  }

  return ok({
    received: true,
    linked: true,
    submission_id: submissionId,
    submitter_email: submitterEmail,
    completed_at: completedAt,
    provider_id: providerId,
  });
}
