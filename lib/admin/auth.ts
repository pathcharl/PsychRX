import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth";
import { getUserRole } from "@/lib/roles";

/**
 * Require an authenticated admin. Anyone else is redirected home.
 * Cached per-request so layout + page share one auth check.
 */
export const requireAdmin = cache(async (): Promise<User> => {
  const user = await getUser();
  if (!user) redirect("/auth/login?redirect=/admin/dashboard");

  const role = getUserRole(user);
  if (role !== "admin") redirect("/");

  return user;
});

/**
 * Non-redirecting admin check for route handlers / APIs.
 * Returns the admin `User`, or null when unauthenticated / not an admin.
 */
export async function getAdminApiUser(): Promise<User | null> {
  const user = await getUser();
  if (!user) return null;
  return getUserRole(user) === "admin" ? user : null;
}
