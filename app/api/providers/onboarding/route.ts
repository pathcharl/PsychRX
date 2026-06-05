import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { sendProviderAlert } from "@/lib/sms";
import { sendProviderContract, sendBAA } from "@/lib/docuseal";
import { createConnectAccount, getOnboardingLink } from "@/lib/stripe";
import { ONBOARDING_STAGES, STAGE_MESSAGES } from "@/lib/onboarding";

export const runtime = "nodejs";

const onboardingSchema = z.object({
  provider_id: z.string().uuid(),
  stage: z.number().int().min(1).max(8),
  data: z.record(z.string(), z.unknown()).optional(),
});

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  stripe_account_id: string | null;
}

async function getProvider(id: string): Promise<ProviderRow | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, email, phone, stripe_account_id")
    .eq("id", id)
    .maybeSingle();
  return (data as ProviderRow | null) ?? null;
}

async function upsertOnboarding(
  providerId: string,
  stage: number,
  stageData: Record<string, unknown>
) {
  const { data: existing } = await supabaseAdmin
    .from("provider_onboarding_status")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  const completed = new Set<number>(
    ((existing as { completed_stages?: number[] } | null)?.completed_stages ?? [])
  );
  completed.add(stage);

  const mergedData = {
    ...(((existing as { stage_data?: Record<string, unknown> } | null)?.stage_data) ?? {}),
    [`stage_${stage}`]: stageData,
  };

  const payload = {
    provider_id: providerId,
    current_stage: stage,
    stage_data: mergedData,
    completed_stages: Array.from(completed).sort((a, b) => a - b),
    status: stage >= 8 ? "complete" : "in_progress",
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("provider_onboarding_status")
      .update(payload)
      .eq("provider_id", providerId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("provider_onboarding_status")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Merge stage-specific fields into the provider record. */
async function applyStageData(
  providerId: string,
  stage: number,
  data: Record<string, unknown>
): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (stage === 1) {
    if (data.first_name) patch.first_name = data.first_name;
    if (data.last_name) patch.last_name = data.last_name;
    if (data.email) patch.email = data.email;
    if (data.phone) patch.phone = data.phone;
    if (data.specialty) patch.specialty = data.specialty;
    if (data.credentials) patch.credentials = data.credentials;
  }

  if (stage === 2) {
    if (data.npi) patch.npi = data.npi;
    if (data.dea_number) patch.dea_number = data.dea_number;
    if (data.license_number) patch.license_number = data.license_number;
    if (data.license_state) patch.license_state = data.license_state;
    if (data.license_expires_at) patch.license_expires_at = data.license_expires_at;
    if (data.malpractice_expires_at) patch.malpractice_expires_at = data.malpractice_expires_at;
    if (data.dea_expires_at) patch.dea_expires_at = data.dea_expires_at;
  }

  if (stage === 3 && Array.isArray(data.specialties)) {
    patch.specialties = data.specialties;
    if (Array.isArray(data.insurances)) patch.insurances = data.insurances;
    if (Array.isArray(data.languages)) patch.languages = data.languages;
    if (Array.isArray(data.care_types)) patch.care_types = data.care_types;
  }

  if (Object.keys(patch).length) {
    await supabaseAdmin.from("providers").update(patch).eq("id", providerId);
  }
}

/**
 * POST /api/providers/onboarding — submit an onboarding stage.
 * Stage 4 → DocuSeal ICA; stage 5 → BAA; stage 6 → Stripe Connect.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, onboardingSchema);
  if (error) return error;

  const provider = await getProvider(data.provider_id);
  if (!provider) return fail("Provider not found", 404);

  const stageData = data.data ?? {};

  try {
    await applyStageData(data.provider_id, data.stage, stageData);
    const onboarding = await upsertOnboarding(data.provider_id, data.stage, stageData);

    let docusealSubmissionId: string | null = null;
    let stripeOnboardingUrl: string | null = null;

    // Stage 4: send ICA via DocuSeal.
    if (data.stage === 4) {
      try {
        const { submission } = await sendProviderContract(provider);
        docusealSubmissionId = String(submission.id);
        await supabaseAdmin
          .from("provider_onboarding_status")
          .update({ docuseal_submission_id: docusealSubmissionId })
          .eq("provider_id", data.provider_id);
      } catch (err) {
        console.error("[onboarding] DocuSeal contract failed:", err);
      }
    }

    // Stage 5: send BAA.
    if (data.stage === 5) {
      try {
        await sendBAA(provider);
      } catch (err) {
        console.error("[onboarding] BAA send failed:", err);
      }
    }

    // Stage 6: Stripe Connect onboarding.
    if (data.stage === 6) {
      try {
        let accountId = provider.stripe_account_id;
        if (!accountId) {
          const account = await createConnectAccount(provider);
          accountId = account.id;
        }
        stripeOnboardingUrl = await getOnboardingLink(accountId);
        await supabaseAdmin
          .from("provider_onboarding_status")
          .update({ stripe_onboarding_url: stripeOnboardingUrl })
          .eq("provider_id", data.provider_id);
      } catch (err) {
        console.error("[onboarding] Stripe Connect failed:", err);
      }
    }

    // Stage 8: activate provider.
    if (data.stage === 8) {
      await supabaseAdmin
        .from("providers")
        .update({ status: "active", available: true })
        .eq("id", data.provider_id);
    }

    // SMS notification for this stage.
    const msg = STAGE_MESSAGES[data.stage];
    if (msg && provider.phone) {
      let text = msg;
      if (data.stage === 6 && stripeOnboardingUrl) {
        text += ` Set up payouts: ${stripeOnboardingUrl}`;
      }
      await sendProviderAlert(provider, text).catch(() => undefined);
    }

    return ok({
      onboarding,
      stage: data.stage,
      stage_name: ONBOARDING_STAGES[data.stage as keyof typeof ONBOARDING_STAGES],
      docuseal_submission_id: docusealSubmissionId,
      stripe_onboarding_url: stripeOnboardingUrl,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Onboarding failed", 500);
  }
}

/** GET /api/providers/onboarding?provider_id= — fetch current onboarding status. */
export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("provider_id");
  if (!providerId) return fail("provider_id is required", 400);

  const { data, error } = await supabaseAdmin
    .from("provider_onboarding_status")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return ok({ onboarding: null, current_stage: 1, status: "not_started" });
  return ok({ onboarding: data });
}
