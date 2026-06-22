import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getUserRole, dashboardPathForRole, type UserRole } from "@/lib/roles";

const PROTECTED: { prefix: string; role: UserRole; loginPath?: string }[] = [
  { prefix: "/patient-portal", role: "patient", loginPath: "/patient-portal/login" },
  { prefix: "/patient", role: "patient", loginPath: "/patient-portal/login" },
  { prefix: "/portal", role: "provider", loginPath: "/auth/login" },
  { prefix: "/provider", role: "provider" },
  { prefix: "/admin", role: "admin" },
];

const PUBLIC_PATIENT_PORTAL_PATHS = [
  "/patient-portal/login",
  "/patient-portal/set-password",
];

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function applyCookies(response: NextResponse, cookies: CookieToSet[]): NextResponse {
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  let pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet;
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = req.nextUrl.pathname;

  // PKCE: exchange auth code on /auth/callback (email confirm, OAuth, magic link).
  if (path === "/auth/callback") {
    const code = req.nextUrl.searchParams.get("code");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    if (errorDescription) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("error", errorDescription);
      return applyCookies(NextResponse.redirect(loginUrl), pendingCookies);
    }

    if (code) {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const loginUrl = new URL("/auth/login", req.url);
          loginUrl.searchParams.set("error", error.message);
          return applyCookies(NextResponse.redirect(loginUrl), pendingCookies);
        }

        const { data } = await supabase.auth.getUser();
        const role = getUserRole(data.user);
        const next = req.nextUrl.searchParams.get("next");
        const destination =
          next && next.startsWith("/") ? next : dashboardPathForRole(role);
        return applyCookies(
          NextResponse.redirect(new URL(destination, req.url)),
          pendingCookies
        );
      } catch (err) {
        console.error("[middleware] PKCE exchange failed:", err);
        const loginUrl = new URL("/auth/login", req.url);
        loginUrl.searchParams.set(
          "error",
          "Could not verify your sign-in link. Check your network and try again."
        );
        return applyCookies(NextResponse.redirect(loginUrl), pendingCookies);
      }
    }

    return applyCookies(
      NextResponse.redirect(new URL("/auth/login", req.url)),
      pendingCookies
    );
  }

  // Refresh session — validates JWT via Supabase Auth server.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("[middleware] Supabase auth check failed:", err);
  }
  const role = getUserRole(user);

  if (path.startsWith("/auth")) {
    if (user && role && (path === "/auth/login" || path === "/auth/signup")) {
      return applyCookies(
        NextResponse.redirect(new URL(dashboardPathForRole(role), req.url)),
        pendingCookies
      );
    }
    return res;
  }

  const match = PROTECTED.find(
    (p) => path === p.prefix || path.startsWith(`${p.prefix}/`)
  );
  if (match) {
    if (
      match.prefix === "/patient-portal" &&
      PUBLIC_PATIENT_PORTAL_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
    ) {
      if (
        user &&
        role === "patient" &&
        path === "/patient-portal/login" &&
        req.nextUrl.searchParams.get("error") !== "profile"
      ) {
        return applyCookies(
          NextResponse.redirect(new URL("/patient-portal/dashboard", req.url)),
          pendingCookies
        );
      }
      return applyCookies(withPathHeader(res, path), pendingCookies);
    }

    if (!user) {
      // Session may still be hydrating — let the client auth gate resolve it.
      const hasAuthCookie = req.cookies
        .getAll()
        .some((c) => c.name.includes("auth-token"));
      if (match.prefix === "/patient-portal" && hasAuthCookie) {
        return applyCookies(withPathHeader(res, path), pendingCookies);
      }

      const loginPath = match.loginPath ?? "/auth/login";
      const loginUrl = new URL(loginPath, req.url);
      loginUrl.searchParams.set("redirect", path);
      return applyCookies(NextResponse.redirect(loginUrl), pendingCookies);
    }
    if (role !== match.role && role !== "admin") {
      return applyCookies(
        NextResponse.redirect(new URL(dashboardPathForRole(role), req.url)),
        pendingCookies
      );
    }
  }

  return applyCookies(withPathHeader(res, path), pendingCookies);
}

function withPathHeader(response: NextResponse, path: string): NextResponse {
  response.headers.set("x-pathname", path);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
