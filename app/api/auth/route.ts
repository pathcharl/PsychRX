import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const authSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    email: z.string().email(),
    password: z.string().min(1),
  }),
  z.object({
    action: z.literal("signup"),
    email: z.string().email(),
    password: z.string().min(8),
    full_name: z.string().optional(),
    role: z.enum(["patient", "provider", "admin"]).default("patient"),
  }),
  z.object({
    action: z.literal("logout"),
    access_token: z.string().min(1),
  }),
]);

/** Extract a Bearer token from the Authorization header. */
function getBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** GET /api/auth — session check using the Authorization: Bearer <token> header. */
export async function GET(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return fail("Missing bearer token", 401);

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return fail("Invalid or expired session", 401);

  return ok({ authenticated: true, user: data.user });
}

/** POST /api/auth — { action: "login" | "signup" | "logout", ... } */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, authSchema);
  if (error) return error;

  try {
    switch (data.action) {
      case "login": {
        const { data: result, error: signInError } =
          await supabaseAdmin.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
        if (signInError) return fail(signInError.message, 401);
        return ok({ user: result.user, session: result.session });
      }

      case "signup": {
        // Role is set in app_metadata (server-controlled, not user-editable).
        const { data: result, error: signUpError } =
          await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: data.full_name ? { full_name: data.full_name } : {},
            app_metadata: { role: data.role },
          });
        if (signUpError) return fail(signUpError.message, 400);
        return ok({ user: result.user }, 201);
      }

      case "logout": {
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
          data.access_token
        );
        if (signOutError) return fail(signOutError.message, 400);
        return ok({ success: true });
      }
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Authentication error", 500);
  }
}
