import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __psychrxResend: Resend | undefined;
}

/** Singleton Resend email client. */
export const resend: Resend =
  globalThis.__psychrxResend ?? new Resend(apiKey);

if (process.env.NODE_ENV !== "production") {
  globalThis.__psychrxResend = resend;
}

/** Default "from" address for PsychRx transactional email. */
export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "PsychRx <noreply@psychrx.com>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/** Send a transactional email through Resend. */
export async function sendEmail(params: SendEmailParams) {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const toDisplay = recipients.join(", ");

  console.log("[resend] sending email to:", toDisplay);

  if (!apiKey) {
    console.error("[resend] send failed for:", toDisplay, "— RESEND_API_KEY not configured");
    throw new Error("Resend is not configured. Set RESEND_API_KEY.");
  }

  try {
    const response = await resend.emails.send({
      from: params.from ?? DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html ?? "",
      text: params.text,
      replyTo: params.replyTo,
    });

    if (response.error) {
      console.error(
        "[resend] send failed for:",
        toDisplay,
        "error:",
        response.error
      );
      console.log("[resend] send status: failed");
      return response;
    }

    console.log("[resend] send succeeded for:", toDisplay, "response:", response);
    console.log("[resend] send status: succeeded");
    return response;
  } catch (err) {
    console.error("[resend] send failed for:", toDisplay, "error:", err);
    console.log("[resend] send status: failed");
    throw err;
  }
}

export default resend;
