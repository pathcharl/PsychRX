"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getUserRole, dashboardPathForRole } from "@/lib/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const rawError = searchParams.get("error");
  const authError = rawError
    ? ({
        profile:
          "Your account is verified, but your profile is still being set up. Sign in below to continue.",
        inactive:
          "Your provider account is not active yet. Contact PsychRx if you believe this is a mistake.",
        "fetch failed":
          "Could not reach PsychRx servers. Check your internet connection and try again.",
        "Email link is invalid or has expired":
          "That verification link has expired or was already used. Sign in if you already verified, or sign up again for a new link.",
        "invalid flow state, flow state has expired":
          "That verification link expired or was opened in a different browser. Sign up again and click the new link in the same browser.",
      }[rawError] ?? decodeURIComponent(rawError.replace(/\+/g, " ")))
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      const redirect = searchParams.get("redirect");
      const destination =
        redirect && redirect.startsWith("/")
          ? redirect
          : dashboardPathForRole(getUserRole(data.user));
      router.push(destination);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      <Card className="w-full max-w-md border-navy-700 bg-white shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-navy-900">
            PsychRx
          </CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {authError}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white hover:bg-teal-700"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-navy-900" aria-hidden />}
    >
      <LoginForm />
    </Suspense>
  );
}
