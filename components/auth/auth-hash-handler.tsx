"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, getUserRole } from "@/lib/roles";

function setPasswordPathForRole(role: ReturnType<typeof getUserRole>): string {
  if (role === "patient") {
    return "/patient-portal/set-password?redirect=/patient-portal/dashboard";
  }
  return "/auth/set-password?redirect=/portal/dashboard";
}

function stripHashFromUrl(): void {
  const clean =
    window.location.pathname + window.location.search;
  window.history.replaceState(null, "", clean || "/");
}

/**
 * Handles Supabase auth redirects that land on the wrong page with hash tokens
 * (#access_token=...&type=recovery) or a PKCE ?code= on non-callback routes.
 */
export function AuthHashHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    async function resolveHashSession() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorDescription = hashParams.get("error_description");

      if (errorDescription) {
        console.error("[auth-hash] link error:", errorDescription);
        stripHashFromUrl();
        router.replace(
          `/auth/login?error=${encodeURIComponent(errorDescription)}`
        );
        return null;
      }

      if (!accessToken || !refreshToken) return null;

      const type = hashParams.get("type");

      // The PKCE browser client does NOT auto-consume implicit hash tokens, so
      // we must explicitly establish the session from the link's tokens.
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        console.error(
          "[auth-hash] setSession failed:",
          error?.message ?? "no session"
        );
        stripHashFromUrl();
        router.replace(
          "/auth/login?error=" +
            encodeURIComponent(
              "Your link has expired or was already used. Use Forgot password to get a new one."
            )
        );
        return null;
      }

      stripHashFromUrl();

      const role = getUserRole(data.session.user);
      if (type === "recovery") {
        router.replace(setPasswordPathForRole(role));
        return data.session;
      }

      if (type === "signup" || type === "invite" || type === "magiclink") {
        router.replace(dashboardPathForRole(role));
        return data.session;
      }

      return data.session;
    }

    async function handleQueryCode() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (!code || pathname === "/auth/callback") return;

      const next = searchParams.get("next");
      let url = `/auth/callback?code=${encodeURIComponent(code)}`;
      if (next?.startsWith("/")) {
        url += `&next=${encodeURIComponent(next)}`;
      } else {
        url += `&next=${encodeURIComponent("/auth/set-password?redirect=/portal/dashboard")}`;
      }
      router.replace(url);
    }

    void handleQueryCode();
    void resolveHashSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        stripHashFromUrl();
        const role = getUserRole(session.user);
        router.replace(setPasswordPathForRole(role));
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
