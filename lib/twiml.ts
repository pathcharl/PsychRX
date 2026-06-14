// ============================================================================
// Minimal TwiML builders for Twilio Voice (Carol).
// We prefer ElevenLabs audio via <Play> and fall back to <Say> when no audio
// URL is available.
// ============================================================================

/** Escape a string for safe inclusion in XML. */
export function xmlEscape(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[
        c
      ]!)
  );
}

/** Default Twilio <Say> voice — a warm, natural neural voice. */
const SAY_VOICE = "Polly.Joanna-Neural";

export interface VoicePrompt {
  /** Public URL of pre-rendered ElevenLabs audio. */
  audioUrl?: string | null;
  /** Fallback text spoken via Twilio TTS when no audio URL is present. */
  sayText?: string | null;
}

function promptVerbs(prompt: VoicePrompt): string {
  if (prompt.audioUrl) return `<Play>${xmlEscape(prompt.audioUrl)}</Play>`;
  if (prompt.sayText)
    return `<Say voice="${SAY_VOICE}">${xmlEscape(prompt.sayText)}</Say>`;
  return "";
}

function wrap(inner: string): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Play a prompt, then gather the caller's speech and POST the result to
 * `actionPath`. Re-prompts via `actionPath` if the caller is silent.
 */
export function gatherSpeechResponse(opts: {
  prompt: VoicePrompt;
  actionPath: string;
}): Response {
  const gather =
    `<Gather input="speech" method="POST" action="${xmlEscape(opts.actionPath)}" ` +
    `speechTimeout="auto" speechModel="phone_call" language="en-US" actionOnEmptyResult="true">` +
    `${promptVerbs(opts.prompt)}</Gather>` +
    `<Redirect method="POST">${xmlEscape(opts.actionPath)}</Redirect>`;
  return wrap(gather);
}

/** Play a final prompt and hang up. */
export function hangupResponse(prompt: VoicePrompt): Response {
  return wrap(`${promptVerbs(prompt)}<Hangup/>`);
}

/** Play a prompt then transfer (dial) to a human number. */
export function dialResponse(opts: {
  prompt: VoicePrompt;
  dialNumber: string;
}): Response {
  return wrap(
    `${promptVerbs(opts.prompt)}<Dial>${xmlEscape(opts.dialNumber)}</Dial>`
  );
}

/** Bare empty/ack response. */
export function emptyResponse(): Response {
  return wrap("");
}
