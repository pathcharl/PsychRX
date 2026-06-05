import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __psychrxAnthropic: Anthropic | undefined;
}

/** Singleton Anthropic (Claude) client. */
export const anthropic: Anthropic =
  globalThis.__psychrxAnthropic ?? new Anthropic({ apiKey });

if (process.env.NODE_ENV !== "production") {
  globalThis.__psychrxAnthropic = anthropic;
}

/** Default Claude model used across PsychRx. */
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

export interface ClaudeMessageOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Convenience helper: send a single prompt and return the concatenated text.
 */
export async function askClaude(
  prompt: string,
  options: ClaudeMessageOptions = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error("Anthropic is not configured. Set ANTHROPIC_API_KEY.");
  }
  const response = await anthropic.messages.create({
    model: options.model ?? DEFAULT_CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.7,
    system: options.system,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export default anthropic;
