import { type NextRequest } from "next/server";
import { handleDocusealWebhook } from "@/lib/docuseal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  console.log(
    "[api/webhooks/docuseal] incoming webhook",
    req.headers.get("content-type"),
    req.headers.get("user-agent")
  );
  return handleDocusealWebhook(req);
}
