// ============================================================================
// Telnyx client — fax sending via the official Telnyx Node SDK.
// Docs: https://developers.telnyx.com/api/programmable-fax
// ============================================================================
import Telnyx from "telnyx";

const apiKey = process.env.TELNYX_API_KEY ?? "";
const connectionId = process.env.TELNYX_CONNECTION_ID ?? "";

let instance: Telnyx | null = null;

/** Lazily create the singleton Telnyx client. */
function getClient(): Telnyx {
  if (!instance) {
    if (!apiKey) {
      throw new Error("Telnyx is not configured. Set TELNYX_API_KEY.");
    }
    instance = new Telnyx({ apiKey });
  }
  return instance;
}

/**
 * Singleton Telnyx client. The real client is created on first access so a
 * missing/placeholder key never throws at import time.
 */
const telnyx = new Proxy({} as Telnyx, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as Telnyx;

export interface SendFaxParams {
  /** Destination fax number in E.164 format, e.g. +18005551234 */
  to: string;
  /** Sending fax number in E.164 format (must be a Telnyx number). */
  from: string;
  /** Publicly accessible URL of the PDF/TIFF/etc. to fax. */
  mediaUrl: string;
  /** Optional override of the connection (fax application) id. */
  connectionId?: string;
}

/** Send a fax. Returns the Telnyx fax resource. */
export async function sendFax(params: SendFaxParams) {
  const conn = params.connectionId ?? connectionId;
  if (!conn) {
    throw new Error("Telnyx connection id missing. Set TELNYX_CONNECTION_ID.");
  }
  return getClient().faxes.create({
    connection_id: conn,
    to: params.to,
    from: params.from,
    media_url: params.mediaUrl,
  });
}

/** Retrieve the status of a previously sent fax. */
export async function getFax(faxId: string) {
  return getClient().faxes.retrieve(faxId);
}

export default telnyx;
