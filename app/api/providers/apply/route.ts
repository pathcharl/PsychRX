import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { sendEmail, DEFAULT_FROM_EMAIL } from "@/lib/resend";
import { sendProviderContract } from "@/lib/docuseal";
import { APP_NAME } from "@/lib/constants";

export const runtime = "nodejs";

const applySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  npi: z.string().min(1),
  email: z.string().email(),
  provider_type: z.enum([
    "pmhnp",
    "therapist",
    "psychologist",
    "psychiatrist",
    "md_supervisor",
  ]),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  license_state: z.string().optional(),
  malpractice_carrier: z.string().min(1),
  malpractice_expiry: z.string().min(1),
  credentials: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});

/**
 * POST /api/providers/apply — submit a new provider application.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, applySchema);
  if (error) return error;

  const applicationFields = {
    first_name: data.first_name,
    last_name: data.last_name,
    npi: data.npi,
    email: data.email,
    phone: data.phone ?? null,
    provider_type: data.provider_type,
    license_number: data.license_number ?? null,
    license_state: data.license_state ?? "FL",
    malpractice_carrier: data.malpractice_carrier,
    malpractice_expiry: data.malpractice_expiry,
    credentials: data.credentials ?? null,
    specialties: data.specialties ?? [],
    languages: data.languages ?? ["English"],
    status: "pending",
    onboarding_step: "application",
    accepts_new_patients: true,
  };

  const { data: byEmail } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, email, status")
    .eq("email", data.email)
    .maybeSingle();

  const { data: byNpi } = await supabaseAdmin
    .from("providers")
    .select("id, email, status")
    .eq("npi", data.npi)
    .maybeSingle();

  if (byEmail && byNpi && byEmail.id !== byNpi.id) {
    return fail(
      "This email and NPI are already registered to different provider records.",
      409
    );
  }

  const existing = byEmail ?? byNpi;

  let provider: { id: string; first_name: string; last_name: string; email: string };
  let isResubmission = false;

  if (existing) {
    if (existing.status !== "pending") {
      return fail(
        "A provider with this email or NPI is already registered.",
        409
      );
    }

    isResubmission = true;
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("providers")
      .update(applicationFields)
      .eq("id", existing.id)
      .select("id, first_name, last_name, email")
      .single();

    if (updateErr) return dbError(updateErr);
    provider = updated;
    console.log("[providers/apply] updated pending application for:", data.email);
  } else {
    const { data: created, error: dbErr } = await supabaseAdmin
      .from("providers")
      .insert(applicationFields)
      .select("id, first_name, last_name, email")
      .single();

    if (dbErr) return dbError(dbErr);
    provider = created;
  }

  console.log("[providers/apply] triggering provider welcome email for:", data.email);

  try {
    const emailResult = await sendEmail({
      from: DEFAULT_FROM_EMAIL,
      to: data.email,
      subject: `Welcome to ${APP_NAME} — application received`,
      html: `
        <p>Hi ${data.first_name},</p>
        <p>Thank you for applying to join ${APP_NAME}. We've received your application and will review it shortly.</p>
        <p>You'll receive a separate email with your Independent Contractor Agreement to sign via DocuSeal.</p>
        <p>— The ${APP_NAME} team</p>
      `,
      text:
        `Hi ${data.first_name},\n\nThank you for applying to join ${APP_NAME}. ` +
        `We've received your application and will review it shortly.\n\n` +
        `You'll receive a separate email with your contract to sign via DocuSeal.\n\n— The ${APP_NAME} team`,
    });

    if (emailResult.error) {
      console.error(
        "[providers/apply] provider welcome email failed for:",
        data.email,
        emailResult.error
      );
    } else {
      console.log(
        "[providers/apply] provider welcome email succeeded for:",
        data.email,
        emailResult
      );
    }
  } catch (err) {
    console.error("[providers/apply] provider welcome email failed for:", data.email, err);
  }

  try {
    await sendProviderContract({
      ...provider,
      npi: data.npi,
      license_state: data.license_state ?? "FL",
    });
    console.log("[providers/apply] DocuSeal contract sent for:", data.email);
  } catch (err) {
    console.error("[providers/apply] DocuSeal contract failed:", err);
  }

  return ok(
    {
      provider_id: provider.id,
      ...(isResubmission ? { message: "Pending application updated." } : {}),
    },
    isResubmission ? 200 : 201
  );
}
