// ============================================================================
// Appointment helpers shared by the booking / reschedule / cancel APIs.
//
// The deployed `appointments` table is a hybrid of several migrations, so the
// scheduled time may live in `scheduled_at`, `scheduled_start`, or `start_time`
// depending on the environment. These helpers read/write defensively (mirroring
// lib/patient-portal/utils.ts:getAppointmentTime) so routes work regardless of
// which columns physically exist.
// ============================================================================
import { supabaseAdmin } from "@/lib/supabase";

/** Candidate columns that may hold the appointment's scheduled time. */
const TIME_COLUMNS = ["scheduled_at", "scheduled_start", "start_time"] as const;

/** Read the scheduled time from an appointment row, trying all known columns. */
export function appointmentTime(
  row: Record<string, unknown> | null | undefined
): string | null {
  if (!row) return null;
  for (const col of TIME_COLUMNS) {
    const value = row[col];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/**
 * Best-effort: write the scheduled time to every time column that exists.
 * Each column is updated independently so a missing column never aborts the
 * others. Returns the number of columns successfully written.
 */
export async function setAppointmentTime(
  id: string,
  iso: string
): Promise<number> {
  let written = 0;
  for (const col of TIME_COLUMNS) {
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ [col]: iso })
      .eq("id", id);
    if (!error) written += 1;
  }
  return written;
}

/**
 * Apply a partial update to an appointment, tolerating columns that don't
 * exist on this database. Tries the combined update first; on failure (e.g.
 * unknown column or check violation) it retries each field individually,
 * ignoring per-field failures.
 */
export async function patchAppointment(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const { error } = await supabaseAdmin
    .from("appointments")
    .update(Object.fromEntries(entries))
    .eq("id", id);
  if (!error) return;

  for (const [key, value] of entries) {
    await supabaseAdmin
      .from("appointments")
      .update({ [key]: value })
      .eq("id", id);
  }
}

/** Number of whole hours between now and `iso` (negative if in the past). */
export function hoursUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return (ms - Date.now()) / 3_600_000;
}

/**
 * Cancellation / late-reschedule fee based on how soon the appointment is.
 *   < 2 hours  → $150
 *   < 24 hours → $100
 *   otherwise  → no fee
 * Mirrors lib/patient-portal/utils.ts:getCancellationFee.
 */
export function lateChangeFee(
  iso: string | null | undefined
): { fee: number; label: string } | null {
  const hours = hoursUntil(iso);
  if (hours === null) return null;
  if (hours < 2) return { fee: 150, label: "$150 late fee (within 2 hours)" };
  if (hours < 24) return { fee: 100, label: "$100 fee (within 24 hours)" };
  return null;
}

/** Free any provider_slots bound to this appointment (best-effort). */
export async function releaseSlotForAppointment(
  appointmentId: string
): Promise<void> {
  await supabaseAdmin
    .from("provider_slots")
    .update({
      status: "open",
      appointment_id: null,
      held_for_patient_id: null,
      hold_expires_at: null,
    })
    .eq("appointment_id", appointmentId);
}
