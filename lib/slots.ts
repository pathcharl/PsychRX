// ============================================================================
// Slot generation from availability_templates → provider_slots (available slots).
// Respects blocked_dates and skips slots that already exist.
// ============================================================================
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const DEFAULT_HORIZON_DAYS = Number(process.env.SLOT_HORIZON_DAYS ?? 30);

interface TemplateRow {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  appointment_type: string;
  is_active: boolean;
}

/** Parse "HH:mm:ss" or "HH:mm" into minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** UTC offset in ms for a timezone at a given instant. */
function timezoneOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - at.getTime();
}

/** Build a UTC ISO timestamp from a local date + wall-clock time in OFFICE_TIMEZONE. */
function localSlotIso(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const offset = timezoneOffsetMs(noon, OFFICE_TIMEZONE);
  const midnightUtc = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(midnightUtc + offset + (h * 3600 + m * 60) * 1000).toISOString();
}

/** Day-of-week for a YYYY-MM-DD date (0 = Sunday). */
function dow(dateStr: string): number {
  return parseISO(dateStr).getDay();
}

/**
 * Generate open provider_slots for one provider over the next `days` days.
 * Returns the number of new slots inserted.
 */
export async function generateSlotsForProvider(
  providerId: string,
  days: number = DEFAULT_HORIZON_DAYS
): Promise<number> {
  const { data: templates } = await supabaseAdmin
    .from("availability_templates")
    .select("*")
    .eq("provider_id", providerId)
    .eq("is_active", true);

  if (!templates?.length) return 0;

  const today = startOfDay(new Date());
  const horizonEnd = addDays(today, days);
  const dateRange: string[] = [];
  for (let d = today; d <= horizonEnd; d = addDays(d, 1)) {
    dateRange.push(format(d, "yyyy-MM-dd"));
  }

  const { data: blocked } = await supabaseAdmin
    .from("blocked_dates")
    .select("blocked_date")
    .eq("provider_id", providerId)
    .gte("blocked_date", dateRange[0])
    .lte("blocked_date", dateRange[dateRange.length - 1]);

  const blockedSet = new Set(
    (blocked ?? []).map((b: { blocked_date: string }) => b.blocked_date)
  );

  const rangeStart = `${dateRange[0]}T00:00:00.000Z`;
  const rangeEnd = `${dateRange[dateRange.length - 1]}T23:59:59.999Z`;

  const { data: existing } = await supabaseAdmin
    .from("provider_slots")
    .select("start_time")
    .eq("provider_id", providerId)
    .gte("start_time", rangeStart)
    .lte("start_time", rangeEnd);

  const existingSet = new Set(
    (existing ?? []).map((s: { start_time: string }) => s.start_time)
  );

  const rows: Array<{
    provider_id: string;
    start_time: string;
    end_time: string;
    status: string;
    source_template_id: string;
  }> = [];

  for (const dateStr of dateRange) {
    if (blockedSet.has(dateStr)) continue;
    const day = dow(dateStr);

    for (const tmpl of templates as TemplateRow[]) {
      if (tmpl.day_of_week !== day) continue;

      const startMin = timeToMinutes(tmpl.start_time);
      const endMin = timeToMinutes(tmpl.end_time);
      const duration = tmpl.slot_duration_minutes;

      for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
        const sh = Math.floor(cursor / 60);
        const sm = cursor % 60;
        const eh = Math.floor((cursor + duration) / 60);
        const em = (cursor + duration) % 60;
        const startTimeStr = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`;
        const endTimeStr = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
        const startIso = localSlotIso(dateStr, startTimeStr);
        const endIso = localSlotIso(dateStr, endTimeStr);

        if (existingSet.has(startIso)) continue;

        rows.push({
          provider_id: providerId,
          start_time: startIso,
          end_time: endIso,
          status: "open",
          source_template_id: tmpl.id,
        });
        existingSet.add(startIso);
      }
    }
  }

  if (!rows.length) return 0;

  const { error } = await supabaseAdmin.from("provider_slots").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Generate slots for all active, onboarded providers. */
export async function generateAllProviderSlots(
  days: number = DEFAULT_HORIZON_DAYS
): Promise<number> {
  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("status", "active")
    .eq("compliance_suspended", false);

  let total = 0;
  for (const p of providers ?? []) {
    total += await generateSlotsForProvider(p.id, days);
  }
  return total;
}
