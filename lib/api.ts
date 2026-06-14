import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Standard JSON success response. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Standard JSON error response. */
export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/** 422 response built from a ZodError. */
export function validationError(error: ZodError) {
  return NextResponse.json(
    { error: "Validation failed", details: error.flatten() },
    { status: 422 }
  );
}

/**
 * Parse + validate a JSON request body against a zod schema.
 * Returns either `{ data }` or a ready-to-return error `Response`.
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { data: null, error: fail("Invalid JSON body", 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { data: null, error: validationError(result.error) };
  }
  return { data: result.data, error: null };
}

/** Map a Supabase/PostgREST error to an appropriate HTTP response. */
export function dbError(error: { code?: string; message: string }) {
  // 23505 unique_violation, 23503 foreign_key_violation, 23514 check_violation
  if (error.code === "23505") return fail(error.message, 409);
  if (error.code === "23503" || error.code === "23514")
    return fail(error.message, 400);
  return fail(error.message, 500);
}
