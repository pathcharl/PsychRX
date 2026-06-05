import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, parseBody } from "@/lib/api";
import {
  processPhoneIntake,
  processFaxReferral,
  processPortalIntake,
  sendWelcomeSequence,
  addToWaitlist,
  type IntakeResult,
} from "@/lib/intake";
import {
  findBestMatchWithSlot,
  holdSlot,
  confirmBooking,
  logMatch,
} from "@/lib/matching";

export const runtime = "nodejs";

const intakeSchema = z.object({
  channel: z.enum(["phone", "fax", "portal"]).default("portal"),
  // Accept a flexible payload; channel processors pull the fields they need.
  data: z.record(z.string(), z.unknown()).default({}),
});

/**
 * POST /api/intake — accept intake from any channel, verify insurance,
 * create/update the patient, run the matching engine, and either book the
 * best slot or place the patient on the waitlist.
 */
export async function POST(req: NextRequest) {
  try {
    const { data: body, error } = await parseBody(req, intakeSchema);
    if (error) return error;

    let result: IntakeResult;
    switch (body.channel) {
      case "phone":
        result = await processPhoneIntake(body.data);
        break;
      case "fax":
        result = await processFaxReferral(body.data);
        break;
      default:
        result = await processPortalIntake(body.data);
    }

    const { patient, verification, intake } = result;

    // Welcome the patient (best-effort, non-blocking failures handled inside).
    await sendWelcomeSequence(patient);

    // Try to match + book immediately.
    try {
      const match = await findBestMatchWithSlot({
        id: patient.id,
        insurance_provider: patient.insurance_provider,
        language: patient.language,
        care_type: patient.care_type,
      });

      if (match) {
        const held = await holdSlot(match.slot.id, patient.id);
        if (held) {
          const booked = await confirmBooking(
            match.slot.id,
            patient.id,
            match.provider.id
          );
          if (booked) {
            await logMatch({
              patientId: patient.id,
              providerId: match.provider.id,
              slotId: match.slot.id,
              score: match.score,
              action: "booked",
              details: { via: "intake_api" },
            });
            return ok(
              {
                status: "booked",
                patient,
                insurance: verification,
                appointment: {
                  id: booked.appointmentId,
                  provider_id: match.provider.id,
                  provider_name: [match.provider.first_name, match.provider.last_name]
                    .filter(Boolean)
                    .join(" "),
                  scheduled_start: booked.slot.start_time,
                  match_score: match.score,
                },
              },
              201
            );
          }
        }
      }

      // No bookable match -> waitlist.
      const waitlistId = await addToWaitlist(patient, intake);
      await logMatch({
        patientId: patient.id,
        action: "no_match",
        details: { waitlistId },
      });
      return ok(
        {
          status: "waitlisted",
          patient,
          insurance: verification,
          waitlist_id: waitlistId,
          message:
            "No immediate opening; you've been added to the waitlist and we'll text you when a slot opens.",
        },
        202
      );
    } catch (matchErr) {
      // Matching failed but the patient exists — fall back to waitlist.
      console.error("intake error:", matchErr);
      const waitlistId = await addToWaitlist(patient, intake).catch(() => null);
      return ok(
        {
          status: "waitlisted",
          patient,
          insurance: verification,
          waitlist_id: waitlistId,
          message: "Saved your intake; matching will run shortly.",
          warning: matchErr instanceof Error ? matchErr.message : "matching_error",
        },
        202
      );
    }
  } catch (error) {
    console.error("intake error:", error);
    return fail(error instanceof Error ? error.message : "Intake failed", 500);
  }
}
