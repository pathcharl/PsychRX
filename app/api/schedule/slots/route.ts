import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const OFFICE_TZ = process.env.OFFICE_TIMEZONE ?? "America/New_York";

function formatSlotLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Start/end of calendar day in office timezone, returned as UTC ISO strings. */
function dayBounds(dateStr: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  // Approximate ET as UTC-4 (EDT). Good enough for slot filtering in demo.
  const start = new Date(`${y}-${m}-${d}T04:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * GET /api/schedule/slots?provider_id=&date=YYYY-MM-DD
 * Open slots for one provider on a given day.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider_id");
  const date = searchParams.get("date");

  const parsed = z.string().uuid().safeParse(providerId);
  if (!parsed.success) return fail("provider_id is required", 400);
  if (!date) return fail("date is required (YYYY-MM-DD)", 400);

  const bounds = dayBounds(date);
  if (!bounds) return fail("Invalid date format", 400);

  const { data, error } = await supabaseAdmin
    .from("provider_slots")
    .select("id, start_time, end_time")
    .eq("provider_id", parsed.data)
    .eq("status", "open")
    .gte("start_time", bounds.start)
    .lt("start_time", bounds.end)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[schedule/slots]", error.message);
    return fail(error.message, 500);
  }

  const slots = (data ?? []).map((s) => ({
    id: s.id as string,
    start_time: s.start_time as string,
    end_time: (s.end_time as string) ?? null,
    label: formatSlotLabel(s.start_time as string),
  }));

  return ok({ slots });
}
