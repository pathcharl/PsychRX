"use client";

import { Suspense, useMemo, useState } from "react";
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
import { getUserRole } from "@/lib/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const authError =
    searchParams.get("error") === "profile"
      ? "Your account is verified, but we couldn't set up your patient profile. Sign in below to try again, or contact support."
      : searchParams.get("error");

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

      const role = getUserRole(data.user);
      if (role !== "patient") {
        toast.error("This login is for patients only");
        await supabase.auth.signOut();
        return;
      }

      const redirect = searchParams.get("redirect");
      router.push(
        redirect?.startsWith("/patient-portal")
          ? redirect
          : "/patient-portal/dashboard"
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-navy/10 bg-white shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-heading text-3xl text-navy">
            Patient Portal
          </CardTitle>
          <CardDescription>
            Sign in to manage appointments, messages, and billing
          </CardDescription>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={
                    email
                      ? `/auth/forgot-password?email=${encodeURIComponent(email)}`
                      : "/auth/forgot-password"
                  }
                  className="text-xs font-medium text-teal hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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
              className="w-full bg-teal hover:bg-teal-700"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-navy/60">
            Need help? Call{" "}
            <a href="tel:18337792479" className="text-teal hover:underline">
              1-833-PSYCHRX
            </a>
          </p>
          <p className="mt-2 text-center text-sm text-navy/60">
            <Link href="/auth/login" className="text-teal hover:underline">
              Staff login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function PatientPortalLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-8">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
