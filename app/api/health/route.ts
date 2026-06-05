import { ok } from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/health — simple liveness check. */
export async function GET() {
  return ok({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "psychrx",
  });
}
