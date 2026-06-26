import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, DEFAULT_FROM_EMAIL } from "@/lib/resend";
import { APP_NAME, APP_URL } from "@/lib/constants";

const LOG_PREFIX = "[provider-activation]";

export interface ProviderActivationParams {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

function staffLoginUrl(redirectPath = "/portal/dashboard"): string {
  return `${APP_URL}/auth/login?redirect=${encodeURIComponent(redirectPath)}`;
}

async function findAuthUserByEmail(email: string, providerId?: string) {
  const normalized = email.trim().toLowerCase();

  if (providerId) {
    const { data: provider } = await supabaseAdmin
      .from("providers")
      .select("user_id")
      .eq("id", providerId)
      .maybeSingle();
    if (provider?.user_id) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(
        provider.user_id as string
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

async function linkProviderToAuthUser(
  providerId: string,
  userId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("providers")
    .update({ user_id: userId })
    .eq("id", providerId);
  if (error) {
    console.error(`${LOG_PREFIX} link provider failed:`, error.message);
  }
}

async function createRecoveryLink(email: string): Promise<string | null> {
  // Recovery links deliver tokens in the URL hash (implicit flow), which the
  // set-password page consumes directly — no /auth/callback (PKCE) hop needed.
  const redirectUrl = `${APP_URL}/auth/set-password?redirect=${encodeURIComponent("/portal/dashboard")}`;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: { redirectTo: redirectUrl },
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

async function sendNewProviderAccountEmail(
  params: ProviderActivationParams,
  setPasswordUrl: string
): Promise<void> {
  const firstName = params.firstName || "there";
  const html =
    `<p>Hi ${firstName},</p>` +
    `<p>Your Independent Contractor Agreement is signed. Set up your provider portal ` +
    `to view your dashboard, manage patients, and access your schedule.</p>` +
    emailButton(setPasswordUrl, "Set Your Password") +
    `<p style="color:#666;font-size:14px">This link expires in 24 hours. If it stops working, ` +
    `use "Forgot password" on the login page with this email address.</p>` +
    `<p>— The ${APP_NAME} Team</p>`;

  const text =
    `Hi ${firstName},\n\nYour contract is signed. Set up your provider portal at ${APP_URL}/portal/dashboard.\n\n` +
    `Set your password: ${setPasswordUrl}\n\n— The ${APP_NAME} Team`;

  await sendEmail({
    from: DEFAULT_FROM_EMAIL,
    to: params.email,
    subject: `Welcome to ${APP_NAME} — set up your provider portal`,
    html,
    text,
  });
}

async function sendExistingProviderAccountEmail(
  params: ProviderActivationParams
): Promise<void> {
  const firstName = params.firstName || "there";
  const loginUrl = staffLoginUrl("/portal/dashboard");

  const html =
    `<p>Hi ${firstName},</p>` +
    `<p>Your Independent Contractor Agreement is signed. Log in to your provider portal ` +
    `to view your dashboard, manage patients, and access your schedule.</p>` +
    emailButton(loginUrl, "Open Provider Portal") +
    `<p>— The ${APP_NAME} Team</p>`;

  const text =
    `Hi ${firstName},\n\nYour contract is signed. Open your provider portal: ${loginUrl}\n\n` +
    `— The ${APP_NAME} Team`;

  await sendEmail({
    from: DEFAULT_FROM_EMAIL,
    to: params.email,
    subject: `Your ${APP_NAME} contract is signed — access your portal`,
    html,
    text,
  });
}

/**
 * After DocuSeal ICA signing: create auth account (if needed) and email portal access.
 */
export async function activateProviderPortalAfterContract(
  params: ProviderActivationParams
): Promise<{ accountCreated: boolean; emailSent: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) {
    return { accountCreated: false, emailSent: false };
  }

  try {
    let authUser = await findAuthUserByEmail(email, params.providerId);

    if (authUser) {
      await linkProviderToAuthUser(params.providerId, authUser.id);
      await sendExistingProviderAccountEmail(params);
      return { accountCreated: false, emailSent: true };
    }

    const tempPassword = crypto.randomBytes(32).toString("base64url");
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: "provider" },
        user_metadata: {
          full_name: `${params.firstName} ${params.lastName}`.trim(),
        },
      });

    if (createErr) {
      const duplicate =
        createErr.message.toLowerCase().includes("already") ||
        createErr.message.toLowerCase().includes("registered");
      if (duplicate) {
        authUser = await findAuthUserByEmail(email, params.providerId);
        if (authUser) {
          await linkProviderToAuthUser(params.providerId, authUser.id);
          await sendExistingProviderAccountEmail(params);
          return { accountCreated: false, emailSent: true };
        }
      }
      console.error(`${LOG_PREFIX} createUser failed:`, createErr.message);
      return { accountCreated: false, emailSent: false };
    }

    if (!created.user) {
      return { accountCreated: false, emailSent: false };
    }

    await linkProviderToAuthUser(params.providerId, created.user.id);

    const setPasswordUrl = await createRecoveryLink(email);
    if (!setPasswordUrl) {
      console.error(`${LOG_PREFIX} no recovery link for new user`);
      return { accountCreated: true, emailSent: false };
    }

    await sendNewProviderAccountEmail(params, setPasswordUrl);
    return { accountCreated: true, emailSent: true };
  } catch (err) {
    console.error(`${LOG_PREFIX} activation failed:`, err);
    return { accountCreated: false, emailSent: false };
  }
}
