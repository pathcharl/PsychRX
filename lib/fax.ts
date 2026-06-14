// ============================================================================
// Fax helpers — outbound faxes via Telnyx, inbound fax text extraction via
// Claude. Text content is rendered to a PDF, hosted in Supabase Storage, and
// faxed by URL (Telnyx requires a publicly reachable media URL).
// ============================================================================
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Anthropic from "@anthropic-ai/sdk";
import { sendFax as telnyxSendFax } from "@/lib/telnyx";
import { supabaseAdmin } from "@/lib/supabase";
import { anthropic, DEFAULT_CLAUDE_MODEL } from "@/lib/anthropic";
import { uploadPublic } from "@/lib/storage";
import { toE164 } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Telnyx-owned fax number used as the sender. */
const FAX_FROM = process.env.TELNYX_FAX_FROM ?? "";
const FAX_BUCKET = process.env.FAX_OUTBOX_BUCKET ?? "fax-outbox";

export interface FaxContact {
  id?: string | null;
  name?: string | null;
  /** Preferred fax number; falls back to `phone`/`contact_phone`. */
  fax?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
}

export interface FaxResult {
  to: string;
  faxId: string | null;
  mediaUrl: string;
  skipped?: boolean;
  reason?: string;
}

function contactFaxNumber(c: FaxContact): string {
  return toE164(c.fax) || toE164(c.contact_phone) || toE164(c.phone) || "";
}

function extractFaxId(res: unknown): string | null {
  const r = res as { data?: { id?: string }; id?: string } | null;
  return r?.data?.id ?? r?.id ?? null;
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

/** Render a simple, single-column text document to a PDF buffer. */
async function renderPdf(title: string, body: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [612, 792]; // US Letter
  const margin = 54;
  const maxWidth = pageSize[0] - margin * 2;
  const fontSize = 11;
  const lineHeight = 16;

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawLine = (text: string, f = font, size = fontSize) => {
    if (y < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
    page.drawText(text, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  };

  // Word-wrap a paragraph to maxWidth.
  const wrap = (text: string, f = font, size = fontSize): string[] => {
    const out: string[] = [];
    for (const rawLine of text.split("\n")) {
      const words = rawLine.split(/\s+/);
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) > maxWidth && current) {
          out.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      out.push(current);
    }
    return out;
  };

  drawLine(APP_NAME, bold, 20);
  y -= 6;
  drawLine(title, bold, 14);
  y -= 10;
  for (const line of wrap(body)) drawLine(line);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function renderAndHost(title: string, body: string): Promise<string> {
  const pdf = await renderPdf(title, body);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const path = `${slug}-${Date.now()}.pdf`;
  return uploadPublic(FAX_BUCKET, path, pdf, "application/pdf");
}

async function logOutboundFax(opts: {
  to: string;
  mediaUrl: string;
  subject: string;
  faxId: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("inbound_contacts").insert({
      channel: "fax",
      direction: "outbound",
      to_number: opts.to,
      from_number: FAX_FROM || null,
      media_url: opts.mediaUrl,
      body: opts.subject,
      external_id: opts.faxId,
      status: "queued",
    });
  } catch {
    // best-effort logging
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Send a fax to `to` using a pre-hosted media URL. */
export async function sendFax(
  to: string,
  fileUrl: string,
  subject = "Fax from PsychRx"
): Promise<FaxResult> {
  const e164 = toE164(to);
  if (!e164) return { to: "", faxId: null, mediaUrl: fileUrl, skipped: true, reason: "invalid_number" };
  if (!FAX_FROM) {
    throw new Error("No sending fax number. Set TELNYX_FAX_FROM (a Telnyx number).");
  }

  const res = await telnyxSendFax({ to: e164, from: FAX_FROM, mediaUrl: fileUrl });
  const faxId = extractFaxId(res);
  await logOutboundFax({ to: e164, mediaUrl: fileUrl, subject, faxId });
  return { to: e164, faxId, mediaUrl: fileUrl };
}

/** Render `content` to a PDF and fax it (used by referral/recruit/monthly helpers). */
async function sendTextFax(
  to: string,
  title: string,
  content: string,
  subject: string
): Promise<FaxResult> {
  const e164 = toE164(to);
  if (!e164) {
    return { to: "", faxId: null, mediaUrl: "", skipped: true, reason: "invalid_number" };
  }
  const mediaUrl = await renderAndHost(title, content);
  return sendFax(e164, mediaUrl, subject);
}

/** Send a referral-outreach fax to a referral source / partner practice. */
export async function sendReferralFax(
  referralSource: FaxContact,
  content: string
): Promise<FaxResult> {
  const to = contactFaxNumber(referralSource);
  if (!to) {
    return { to: "", faxId: null, mediaUrl: "", skipped: true, reason: "no_fax_number" };
  }
  const greeting = referralSource.name ? `Dear ${referralSource.name},` : "Hello,";
  const body = `${greeting}\n\n${content}\n\nWarm regards,\nThe ${APP_NAME} Team`;
  return sendTextFax(to, "Referral Partnership", body, "Referral outreach");
}

/** Send a provider-recruitment fax. */
export async function sendProviderRecruitFax(
  provider: FaxContact,
  content: string
): Promise<FaxResult> {
  const to = contactFaxNumber(provider);
  if (!to) {
    return { to: "", faxId: null, mediaUrl: "", skipped: true, reason: "no_fax_number" };
  }
  const greeting = provider.name ? `Dear ${provider.name},` : "Hello,";
  const body = `${greeting}\n\n${content}\n\nSincerely,\n${APP_NAME} Provider Recruitment`;
  return sendTextFax(to, "Join Our Provider Network", body, "Provider recruitment");
}

/** Send a monthly partner summary fax built from a stats object. */
export async function sendMonthlyPartnerFax(
  referralSource: FaxContact,
  stats: Record<string, string | number>
): Promise<FaxResult> {
  const to = contactFaxNumber(referralSource);
  if (!to) {
    return { to: "", faxId: null, mediaUrl: "", skipped: true, reason: "no_fax_number" };
  }
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const lines = Object.entries(stats)
    .map(([k, v]) => `  - ${k.replace(/_/g, " ")}: ${v}`)
    .join("\n");
  const greeting = referralSource.name ? `Dear ${referralSource.name},` : "Hello,";
  const body =
    `${greeting}\n\nHere is your ${month} referral partnership summary:\n\n${lines}\n\n` +
    `Thank you for partnering with ${APP_NAME}. We look forward to continuing to ` +
    `care for the patients you refer.\n\nWarm regards,\nThe ${APP_NAME} Team`;
  return sendTextFax(to, `Monthly Summary — ${month}`, body, "Monthly partner summary");
}

// ---------------------------------------------------------------------------
// Inbound fax parsing (OCR via Claude vision/document understanding)
// ---------------------------------------------------------------------------

export interface ParsedFax {
  text: string;
  fields: Record<string, unknown>;
  unsupported?: boolean;
}

const IMAGE_TYPES: Record<string, Anthropic.Base64ImageSource["media_type"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Download an inbound fax and extract its text + key referral fields. */
export async function parseFaxContent(faxUrl: string): Promise<ParsedFax> {
  const res = await fetch(faxUrl);
  if (!res.ok) {
    throw new Error(`Failed to download fax (${res.status}): ${faxUrl}`);
  }
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const ext = (faxUrl.split("?")[0].split(".").pop() ?? "").toLowerCase();
  const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");

  let mediaBlock: Anthropic.ContentBlockParam;
  if (contentType.includes("pdf") || ext === "pdf") {
    mediaBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  } else if (IMAGE_TYPES[ext] || contentType.startsWith("image/")) {
    const mediaType = IMAGE_TYPES[ext] ?? "image/png";
    mediaBlock = {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    };
  } else {
    // e.g. TIFF — not directly understood by the model.
    return { text: "", fields: {}, unsupported: true };
  }

  const prompt =
    "This is an inbound fax to a psychiatry practice (often a patient referral). " +
    "Extract the full readable text, then return ONLY a JSON object with keys: " +
    '"text" (the transcribed text), and "fields" (an object with any of: ' +
    "patient_name, patient_dob, patient_phone, referring_provider, " +
    "referring_practice, reason_for_referral, insurance, urgency). " +
    "Omit fields that are not present. Respond with JSON only, no prose.";

  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: prompt }] }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      text: typeof json.text === "string" ? json.text : raw,
      fields: (json.fields as Record<string, unknown>) ?? {},
    };
  } catch {
    return { text: raw, fields: {} };
  }
}
