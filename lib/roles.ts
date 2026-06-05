import type { User } from "@supabase/supabase-js";

export type UserRole = "patient" | "provider" | "admin";

/**
 * Read the user's role from app_metadata (server-controlled, not user-editable).
 * Returns null if no recognized role is present.
 */
export function getUserRole(user: User | null | undefined): UserRole | null {
  const role = (user?.app_metadata as { role?: unknown } | undefined)?.role;
  if (role === "patient" || role === "provider" || role === "admin") {
    return role;
  }
  return null;
}

/** Map a role to its post-login dashboard path. */
export function dashboardPathForRole(role: UserRole | null): string {
  switch (role) {
    case "patient":
      return "/patient/dashboard";
    case "provider":
      return "/provider/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/auth/login";
  }
}
