// Alias endpoint for the DocuSeal contract-signing webhook.
import { handleDocusealWebhook } from "@/lib/docuseal";

export const runtime = "nodejs";

export const POST = handleDocusealWebhook;
