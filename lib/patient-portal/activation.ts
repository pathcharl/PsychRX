import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, DEFAULT_FROM_EMAIL } from "@/lib/resend";
import { APP_NAME, APP_URL } from "@/lib/constants";

const LOG_PREFIX = "[patient-activation]";
const PORTAL_LOGIN = `${APP_URL}/patient-portal/login`;

export interface ScheduleBookingEmailParams {
  patientId: string;
  email: string;
  firstName: string;
  lastName: string;
  providerName: string;
  when: string;
}

function portalLoginUrl(redirectPath = "/patient-portal/dashboard"): string {
  return `${PORTAL_LOGIN}?redirect=${encodeURIComponent(redirectPath)}`;
}

async function findAuthUserByEmail(email: string, patientId?: string) {
  const normalized = email.trim().toLowerCase();

  if (patientId) {
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("user_id")
      .eq("id", patientId)
      .maybeSingle();
    if (patient?.user_id) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(
        patient.user_id as string
      );
      if (data.user) return data.user;
    }
  }

  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error(`${LOG_PREFIX} listUsers failed:`, error.message);
      return null;
    }
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === normalized
    );
    if (match) return match;
    if (data.users.length < 1000) break;
    page++;
  }
  return null;
}

async function linkPatientToAuthUser(
  patientId: string,
  userId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("patients")
    .update({ user_id: userId })
    .eq("id", patientId);
  if (error) {
    console.error(`${LOG_PREFIX} link patient failed:`, error.message);
  }
}

async function createRecoveryLink(email: string): Promise<string | null> {
  // Recovery links deliver tokens in the URL hash (implicit flow), which the
  // set-password page consumes directly — no /auth/callback (PKCE) hop needed.
  const redirectUrl = `${APP_URL}/patient-portal/set-password?redirect=${encodeURIComponent("/patient-portal/dashboard")}`;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: redirectUrl,
    },
  });
  if (error) {
    console.error(`${LOG_PREFIX} generateLink failed:`, error.message);
    return null;
  }
  return data.properties?.action_link ?? null;
}

function emailButton(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${label}</a></p>`;
}

function appointmentSummary(params: ScheduleBookingEmailParams): string {
  return (
    `<p><strong>Provider:</strong> ${params.providerName}<br/>` +
    `<strong>When:</strong> ${params.when}</p>`
  );
}

async function sendNewAccountEmail(
  params: ScheduleBookingEmailParams,
  setPasswordUrl: string
): Promise<void> {
  const firstName = params.firstName || "there";
  const html =
    `<p>Hi ${firstName},</p>` +
    `<p>Your appointment is confirmed. Set up your patient portal to view details, ` +
    `message your provider, and manage your appointments.</p>` +
    appointmentSummary(params) +
    emailButton(setPasswordUrl, "Set Your Password") +
    `<p style="color:#666;font-size:14px">This link expires in 24 hours. If it stops working, ` +
    `use "Forgot password" on the login page with this email address.</p>` +
    `<p>— The ${APP_NAME} Team</p>`;

  const text =
    `Hi ${firstName},\n\nYour appointment is confirmed. Set up your patient portal to view details, ` +
    `message your provider, and manage your appointments.\n\n` +
    `Provider: ${params.providerName}\nWhen: ${params.when}\n\n` +
    `Set your password: ${setPasswordUrl}\n\n— The ${APP_NAME} Team`;

  await sendEmail({
    from: DEFAULT_FROM_EMAIL,
    to: params.email,
    subject: `Your ${APP_NAME} appointment is confirmed — set up your portal`,
    html,
    text,
  });
}

async function sendExistingAccountEmail(
  params: ScheduleBookingEmailParams
): Promise<void> {
  const firstName = params.firstName || "there";
  const loginUrl = portalLoginUrl("/patient-portal/dashboard");

  const html =
    `<p>Hi ${firstName},</p>` +
    `<p>Your appointment is confirmed.</p>` +
    appointmentSummary(params) +
    `<p>Log in to your patient portal to view details, message your provider, ` +
    `and manage your appointments.</p>` +
    emailButton(loginUrl, "View Patient Portal") +
    `<p>— The ${APP_NAME} Team</p>`;

  const text =
    `Hi ${firstName},\n\nYour appointment is confirmed.\n\n` +
    `Provider: ${params.providerName}\nWhen: ${params.when}\n\n` +
    `View your portal: ${loginUrl}\n\n— The ${APP_NAME} Team`;

  await sendEmail({
    from: DEFAULT_FROM_EMAIL,
    to: params.email,
    subject: `Your ${APP_NAME} appointment is confirmed`,
    html,
    text,
  });
}

/**
 * After public schedule booking: ensure auth account + send the right email.
 * New patients get a recovery link to set their password; existing users get confirmation.
 */
export async function activatePatientPortalAfterBooking(
  params: ScheduleBookingEmailParams
): Promise<{ accountCreated: boolean; emailSent: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) {
    return { accountCreated: false, emailSent: false };
  }

  try {
    let authUser = await findAuthUserByEmail(email, params.patientId);

    if (authUser) {
      await linkPatientToAuthUser(params.patientId, authUser.id);
      await sendExistingAccountEmail(params);
      return { accountCreated: false, emailSent: true };
    }

    const tempPassword = crypto.randomBytes(32).toString("base64url");
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: "patient" },
        user_metadata: {
          full_name: `${params.firstName} ${params.lastName}`.trim(),
        },
      });

    if (createErr) {
      const duplicate =
        createErr.message.toLowerCase().includes("already") ||
        createErr.message.toLowerCase().includes("registered");
      if (duplicate) {
        authUser = await findAuthUserByEmail(email, params.patientId);
        if (authUser) {
          await linkPatientToAuthUser(params.patientId, authUser.id);
          await sendExistingAccountEmail(params);
          return { accountCreated: false, emailSent: true };
        }
      }
      console.error(`${LOG_PREFIX} createUser failed:`, createErr.message);
      return { accountCreated: false, emailSent: false };
    }

    if (!created.user) {
      return { accountCreated: false, emailSent: false };
    }

    await linkPatientToAuthUser(params.patientId, created.user.id);

    const setPasswordUrl = await createRecoveryLink(email);
    if (!setPasswordUrl) {
      console.error(`${LOG_PREFIX} no recovery link for new user`);
      return { accountCreated: true, emailSent: false };
    }

    await sendNewAccountEmail(params, setPasswordUrl);
    return { accountCreated: true, emailSent: true };
  } catch (err) {
    console.error(`${LOG_PREFIX} activation failed:`, err);
    return { accountCreated: false, emailSent: false };
  }
}
