import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth";
import { getUserRole, dashboardPathForRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";
import type { PortalProvider } from "./types";

/** Placeholder NPI for self-signup dev accounts (unique per auth user). */
function devNpiFromUserId(userId: string): string {
  const compact = userId.replace(/-/g, "");
  return `9${compact.slice(-9)}`;
}

function normalizeProvider(row: Record<string, unknown>): PortalProvider {
  return {
    id: row.id as string,
    user_id: (row.user_id as string) ?? null,
    first_name: (row.first_name as string) ?? "",
    last_name: (row.last_name as string) ?? "",
    credentials: (row.credentials as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    telehealth_link: (row.telehealth_link as string) ?? null,
    direct_phone: (row.direct_phone as string) ?? null,
    direct_fax: (row.direct_fax as string) ?? null,
    status: (row.status as string) ?? "pending",
    fill_rate: row.fill_rate != null ? Number(row.fill_rate) : null,
    revenue_share: row.revenue_share != null ? Number(row.revenue_share) : 0.75,
    stripe_connect_id: (row.stripe_connect_id as string) ?? null,
    stripe_account_id: (row.stripe_account_id as string) ?? null,
    stripe_connect_ready: Boolean(row.stripe_connect_ready),
    accepts_new_patients: row.accepts_new_patients !== false,
    caqh_last_attested: (row.caqh_last_attested as string) ?? null,
    malpractice_carrier: (row.malpractice_carrier as string) ?? null,
    malpractice_expiry: (row.malpractice_expiry as string) ?? null,
    pt_profile_url: (row.pt_profile_url as string) ?? null,
    license_state: (row.license_state as string) ?? null,
    provider_type: (row.provider_type as string) ?? null,
    all_time_earnings:
      row.all_time_earnings != null ? Number(row.all_time_earnings) : null,
    all_time_sessions:
      row.all_time_sessions != null ? Number(row.all_time_sessions) : null,
  };
}

export async function requireProviderPortalAuth(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/auth/login?redirect=/portal/dashboard");

  const role = getUserRole(user);
  if (role !== "provider" && role !== "admin") {
    redirect(dashboardPathForRole(role));
  }
  return user;
}

/**
 * When more than one providers row matches (e.g. an application created one and
 * an earlier login provisioned a duplicate), prefer the active record, then the
 * first. Mirrors the patient-portal resolution so an RLS hiccup can never strand
 * a provider on an empty/duplicate profile.
 */
function pickProvider(
  candidates: Record<string, unknown>[]
): Record<string, unknown> | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.find((c) => c.status === "active") ?? candidates[0];
}

export async function getPortalProvider(user: User): Promise<PortalProvider | null> {
  // Use the service-role client (not the RLS-bound client) so the lookup never
  // fails on RLS state — a failed lookup here would otherwise provision a second,
  // empty provider record and strand the user on a blank dashboard.
  const supabase = supabaseAdmin;

  const { data: byUser } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id);

  let chosen = pickProvider((byUser ?? []) as Record<string, unknown>[]);

  if (!chosen && user.email) {
    const { data: byEmail } = await supabase
      .from("providers")
      .select("*")
      .ilike("email", user.email);
    chosen = pickProvider((byEmail ?? []) as Record<string, unknown>[]);
    // Backfill the auth link so future lookups resolve by user_id directly.
    if (chosen && !chosen.user_id) {
      await supabase
        .from("providers")
        .update({ user_id: user.id })
        .eq("id", chosen.id as string);
    }
  }

  return chosen ? normalizeProvider(chosen) : null;
}

async function provisionProviderProfile(user: User): Promise<PortalProvider | null> {
  const role = getUserRole(user);
  if (role !== "provider" && role !== "admin") return null;

  const fullName = String(user.user_metadata?.full_name ?? "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "Provider";
  const lastName = nameParts.slice(1).join(" ") || "User";
  const npi = devNpiFromUserId(user.id);

  if (user.email) {
    const { data: byEmail } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail) {
      const { data: linked } = await supabaseAdmin
        .from("providers")
        .update({
          user_id: user.id,
          npi: (byEmail.npi as string) || npi,
        })
        .eq("id", byEmail.id)
        .select("*")
        .maybeSingle();
      if (linked) return normalizeProvider(linked as Record<string, unknown>);
    }
  }

  const { data: created, error } = await supabaseAdmin
    .from("providers")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      npi,
      license_state: "FL",
      status: "active",
    })
    .select("*")
    .single();

  if (error || !created) {
    console.error("[provider-portal] Failed to provision provider profile:", error);
    return null;
  }

  return normalizeProvider(created as Record<string, unknown>);
}

export const requirePortalProvider = cache(async (): Promise<{
  user: User;
  provider: PortalProvider;
}> => {
  const user = await requireProviderPortalAuth();
  let provider = await getPortalProvider(user);
  if (!provider) {
    provider = await provisionProviderProfile(user);
  }

  if (!provider) redirect("/auth/login?error=profile");
  if (provider.status !== "active" && getUserRole(user) !== "admin") {
    redirect("/auth/login?error=inactive");
  }

  return { user, provider };
});
