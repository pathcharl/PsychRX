"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, getUserRole } from "@/lib/roles";

type Status = "pending" | "verified";

function VerifyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const email = searchParams.get("email");
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // PKCE exchange runs server-side in middleware on /auth/callback.
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
      return;
    }

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("verified");
        setTimeout(() => {
          router.push(dashboardPathForRole(getUserRole(data.session!.user)));
          router.refresh();
        }, 1200);
      }
    }

    void checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      <Card className="w-full max-w-md border-navy-700 bg-white text-center shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex justify-center">
            {status === "pending" && <MailCheck className="size-12 text-teal-600" />}
            {status === "verified" && (
              <CheckCircle2 className="size-12 text-teal-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-navy-900">
            {status === "pending" && "Verify your email"}
            {status === "verified" && "Email verified"}
          </CardTitle>
          <CardDescription>
            {status === "pending" &&
              (email
                ? `We sent a verification link to ${email}. Click it to activate your account.`
                : "Check your inbox for a verification link to activate your account.")}
            {status === "verified" && "Redirecting you to your dashboard…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-teal-600 text-teal-700 hover:bg-teal-50"
            )}
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
          <Loader2 className="size-8 animate-spin text-teal-600" />
        </main>
      }
    >
      <VerifyView />
    </Suspense>
  );
}
