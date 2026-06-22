import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ok } from "@/lib/api";

export const runtime = "nodejs";

const OFFICE_TZ = process.env.OFFICE_TIMEZONE ?? "America/New_York";

/** Map public schedule service → provider_type values in DB. */
const SERVICE_PROVIDER_TYPES: Record<string, string[]> = {
  therapy: ["therapist", "psychologist", "psychiatrist"],
  medication: ["pmhnp", "psychiatrist", "md_supervisor"],
  testing: ["psychologist", "psychiatrist"],
};

function formatSlotTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * GET /api/schedule/providers?service_type=therapy
 * Active providers accepting new patients who have at least one open slot.
 */
export async function GET(req: NextRequest) {
  const serviceType = new URL(req.url).searchParams.get("service_type") ?? "";
  const allowedTypes = SERVICE_PROVIDER_TYPES[serviceType];

  const providerQuery = supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, credentials, provider_type")
    .eq("status", "active")
    .eq("accepts_new_patients", true);

  const { data: providers, error } = await providerQuery;
  if (error) {
    console.error("[schedule/providers]", error.message);
    return ok({ providers: [] });
  }

  let list = providers ?? [];
  if (allowedTypes?.length) {
    list = list.filter(
      (p) =>
        !p.provider_type || allowedTypes.includes(p.provider_type as string)
    );
  }

  const now = new Date().toISOString();
  const results: Array<{
    id: string;
    first_name: string;
    last_name: string;
    credentials: string | null;
    next_available: string;
    next_slot_id: string;
    next_slot_start: string;
  }> = [];

  for (const p of list) {
    const { data: slot } = await supabaseAdmin
      .from("provider_slots")
      .select("id, start_time")
      .eq("provider_id", p.id)
      .eq("status", "open")
      .gt("start_time", now)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!slot) continue;

    results.push({
      id: p.id as string,
      first_name: (p.first_name as string) ?? "",
      last_name: (p.last_name as string) ?? "",
      credentials: (p.credentials as string) ?? null,
      next_available: formatSlotTime(slot.start_time as string),
      next_slot_id: slot.id as string,
      next_slot_start: slot.start_time as string,
    });
  }

  results.sort(
    (a, b) =>
      new Date(a.next_slot_start).getTime() -
      new Date(b.next_slot_start).getTime()
  );

  return ok({ providers: results });
}
