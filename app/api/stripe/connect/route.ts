import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody } from "@/lib/api";
import { createConnectAccount, getOnboardingLink } from "@/lib/stripe";

export const runtime = "nodejs";

interface ProviderRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  stripe_account_id: string | null;
}

async function getProvider(id: string): Promise<ProviderRow | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, email, first_name, last_name, stripe_account_id")
    .eq("id", id)
    .maybeSingle();
  return (data as ProviderRow | null) ?? null;
}

/**
 * GET /api/stripe/connect?provider_id=... — returns an onboarding link for the
 * provider's connected account (creating the account first if needed).
 */
export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("provider_id");
  if (!providerId) return fail("provider_id is required", 400);

  const provider = await getProvider(providerId);
  if (!provider) return fail("Provider not found", 404);

  try {
    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const account = await createConnectAccount(provider);
      accountId = account.id;
    }
    const url = await getOnboardingLink(accountId);
    return ok({ provider_id: providerId, account_id: accountId, onboarding_url: url });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to create onboarding link", 500);
  }
}

const createSchema = z.object({ provider_id: z.string().uuid() });

/**
 * POST /api/stripe/connect — creates a new Express connected account for a
 * provider and returns the onboarding link.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, createSchema);
  if (error) return error;

  const provider = await getProvider(data.provider_id);
  if (!provider) return fail("Provider not found", 404);

  if (provider.stripe_account_id) {
    const url = await getOnboardingLink(provider.stripe_account_id).catch(() => null);
    return ok({
      provider_id: provider.id,
      account_id: provider.stripe_account_id,
      onboarding_url: url,
      existing: true,
    });
  }

  try {
    const account = await createConnectAccount(provider);
    const url = await getOnboardingLink(account.id);
    return ok(
      { provider_id: provider.id, account_id: account.id, onboarding_url: url },
      201
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to create Connect account", 500);
  }
}
