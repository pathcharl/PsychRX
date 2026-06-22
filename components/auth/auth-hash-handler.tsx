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
      const hasHashTokens =
        hashParams.has("access_token") || hashParams.has("refresh_token");

      if (!hasHashTokens) return null;

      const type = hashParams.get("type");
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[auth-hash] getSession failed:", error.message);
        return null;
      }

      let session = data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 150));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      if (!session) return null;

      stripHashFromUrl();

      const role = getUserRole(session.user);
      if (type === "recovery") {
        router.replace(setPasswordPathForRole(role));
        return session;
      }

      if (type === "signup" || type === "invite" || type === "magiclink") {
        router.replace(dashboardPathForRole(role));
        return session;
      }

      return session;
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
