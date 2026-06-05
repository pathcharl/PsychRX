// ============================================================================
// ElevenLabs client — text-to-speech for the PsychRx "Carol" voice agent,
// using the official @elevenlabs/elevenlabs-js SDK.
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
// ============================================================================
import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY ?? "";

/** Default voice id for "Carol". */
export const CAROL_VOICE_ID = process.env.ELEVENLABS_CAROL_VOICE_ID ?? "";

let instance: ElevenLabsClient | null = null;

/** Lazily create the singleton ElevenLabs client. */
function getClient(): ElevenLabsClient {
  if (!instance) {
    if (!apiKey) {
      throw new Error("ElevenLabs is not configured. Set ELEVENLABS_API_KEY.");
    }
    instance = new ElevenLabsClient({ apiKey });
  }
  return instance;
}

/**
 * Singleton ElevenLabs client. The real client is created on first access so a
 * missing/placeholder key never throws at import time.
 */
const elevenlabs = new Proxy({} as ElevenLabsClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as ElevenLabsClient;

export interface TextToSpeechOptions {
  /** Override the voice id (defaults to Carol). */
  voiceId?: string;
  /** Model id, defaults to "eleven_multilingual_v2". */
  modelId?: string;
  /** Output format, e.g. "mp3_44100_128". */
  outputFormat?: ElevenLabs.TextToSpeechConvertRequestOutputFormat;
  /** Voice settings overriding the stored voice configuration. */
  voiceSettings?: ElevenLabs.VoiceSettings;
}

/**
 * Convert text to speech for the Carol voice.
 * Returns the audio as a ReadableStream<Uint8Array> (e.g. MP3 bytes).
 */
export async function textToSpeech(
  text: string,
  options: TextToSpeechOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const voiceId = options.voiceId ?? CAROL_VOICE_ID;
  if (!voiceId) {
    throw new Error(
      "No ElevenLabs voice id. Set ELEVENLABS_CAROL_VOICE_ID or pass voiceId."
    );
  }
  return getClient().textToSpeech.convert(voiceId, {
    text,
    modelId: options.modelId ?? "eleven_multilingual_v2",
    outputFormat: options.outputFormat ?? "mp3_44100_128",
    voiceSettings: options.voiceSettings,
  });
}

/** Convenience: convert text to speech and collect the audio into a Buffer. */
export async function textToSpeechBuffer(
  text: string,
  options?: TextToSpeechOptions
): Promise<Buffer> {
  const stream = await textToSpeech(text, options);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** List available voices on the account. */
export async function listVoices() {
  return getClient().voices.getAll();
}

export default elevenlabs;
