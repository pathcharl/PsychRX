import { redirect } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, dashboardPathForRole, type UserRole } from "@/lib/roles";

export { getUserRole, dashboardPathForRole };
export type { UserRole };

/** @deprecated Use `createClient` from `@/lib/supabase/server`. */
export const createServerSupabase = createClient;

/** Get the current session (reads cookies; not re-validated). */
export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get the current user, validated against the Supabase Auth server. */
export async function getUser(): Promise<User | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Get the current user's role (or null). */
export async function getCurrentRole(): Promise<UserRole | null> {
  return getUserRole(await getUser());
}

/**
 * Require an authenticated user (optionally with a specific role).
 * Redirects to /auth/login if unauthenticated, or to the user's own
 * dashboard if the role doesn't match (admins are allowed everywhere).
 */
export async function requireAuth(role?: UserRole): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/auth/login");

  const current = getUserRole(user);
  if (role && current !== role && current !== "admin") {
    redirect(dashboardPathForRole(current));
  }
  return user;
}
