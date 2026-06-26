"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, getUserRole } from "@/lib/roles";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "no-session">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      // 1) Existing session (handler already established it).
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        if (!cancelled) setPhase("ready");
        return;
      }

      // 2) Fallback: consume recovery tokens straight from the URL hash.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        if (!cancelled) setPhase(data.session && !error ? "ready" : "no-session");
        return;
      }

      if (!cancelled) setPhase("no-session");
    }

    void ensureSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy-900 p-8">
        <Loader2 className="size-8 animate-spin text-teal-600" />
      </main>
    );
  }

  if (phase === "no-session") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-12">
        <Card className="w-full max-w-md border-navy-700 bg-white text-center shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-navy-900">
              Link expired
            </CardTitle>
            <CardDescription>
              This password setup link has expired or was already used. Request a
              new one from the login page using &quot;Forgot password.&quot;
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-teal hover:bg-teal-700"
              onClick={() => router.push("/auth/login")}
            >
              Go to login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password set successfully.");
      const redirect = searchParams.get("redirect");
      if (redirect?.startsWith("/")) {
        router.push(redirect);
      } else if (userData.user) {
        router.push(dashboardPathForRole(getUserRole(userData.user)));
      } else {
        router.push("/auth/login");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-12">
      <Card className="w-full max-w-md border-navy-700 bg-white shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-navy-900">
            Set your password
          </CardTitle>
          <CardDescription>
            Create a password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal hover:bg-teal-700"
            >
              {loading ? "Saving…" : "Set password & continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-navy-900 p-8">
          <Loader2 className="size-8 animate-spin text-teal-600" />
        </main>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
