"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUserRole, dashboardPathForRole } from "@/lib/roles";
import { PortalLoadingSkeleton } from "@/components/patient-portal/portal-loading-skeleton";

/** Wait this long for a session to appear before redirecting to login. */
const AUTH_TIMEOUT_MS = 3000;
const POLL_MS = 150;

type AuthPhase = "loading" | "ready";

function isLoginPath(pathname: string): boolean {
  return (
    pathname === "/patient-portal/login" ||
    pathname.startsWith("/patient-portal/login/")
  );
}

function isPublicPath(pathname: string): boolean {
  return (
    isLoginPath(pathname) ||
    pathname === "/patient-portal/set-password" ||
    pathname.startsWith("/patient-portal/set-password/")
  );
}

function isAllowedRole(user: User): boolean {
  const role = getUserRole(user);
  return role === "patient" || role === "admin";
}

/**
 * Client-side auth gate for the patient portal.
 * Shows a skeleton while the Supabase session hydrates; only redirects after
 * the timeout confirms there is no session (never while still loading).
 */
export function PatientPortalAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const publicRoute = isPublicPath(pathname);

  const [phase, setPhase] = useState<AuthPhase>(
    publicRoute ? "ready" : "loading"
  );
  const resolvedRef = useRef(publicRoute);

  useEffect(() => {
    if (publicRoute) {
      resolvedRef.current = true;
      setPhase("ready");
      return;
    }

    resolvedRef.current = false;
    setPhase("loading");

    const supabase = createClient();
    let cancelled = false;

    const finishReady = () => {
      if (cancelled || resolvedRef.current) return;
      resolvedRef.current = true;
      setPhase("ready");
      router.refresh();
    };

    const redirectToLogin = () => {
      if (cancelled || resolvedRef.current) return;
      resolvedRef.current = true;
      const loginUrl = `/patient-portal/login?redirect=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    };

    const redirectWrongRole = (user: User) => {
      if (cancelled || resolvedRef.current) return;
      resolvedRef.current = true;
      router.replace(dashboardPathForRole(getUserRole(user)));
    };

    const resolveSession = async (): Promise<
      "authenticated" | "unauthenticated" | "wrong_role"
    > => {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;

      if (!user) {
        const { data: userData } = await supabase.auth.getUser();
        user = userData.user;
      }

      if (!user) return "unauthenticated";
      if (!isAllowedRole(user)) return "wrong_role";
      return "authenticated";
    };

    const tryResolve = async () => {
      try {
        const outcome = await resolveSession();
        if (outcome === "authenticated") {
          finishReady();
          return true;
        }
        if (outcome === "wrong_role") {
          const { data } = await supabase.auth.getUser();
          if (data.user) redirectWrongRole(data.user);
          return true;
        }
      } catch (err) {
        console.error("[patient-portal] auth check failed:", err);
      }
      return false;
    };

    void tryResolve();

    const pollId = setInterval(() => {
      void tryResolve().then((done) => {
        if (done) clearInterval(pollId);
      });
    }, POLL_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      if (isAllowedRole(session.user)) {
        finishReady();
      } else {
        redirectWrongRole(session.user);
      }
    });

    const timeoutId = setTimeout(async () => {
      if (resolvedRef.current) return;
      const outcome = await resolveSession();
      if (outcome === "authenticated") {
        finishReady();
      } else if (outcome === "wrong_role") {
        const { data } = await supabase.auth.getUser();
        if (data.user) redirectWrongRole(data.user);
      } else {
        redirectToLogin();
      }
    }, AUTH_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [publicRoute, pathname, router]);

  if (!publicRoute && phase === "loading") {
    return <PortalLoadingSkeleton />;
  }

  return <>{children}</>;
}
