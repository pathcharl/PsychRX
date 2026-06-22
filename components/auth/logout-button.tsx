"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  /** Where to send the user after sign-out. */
  loginPath?: string;
  className?: string;
  /** `sidebar` matches navy portal sidebars; `default` is a compact outline button. */
  variant?: "default" | "sidebar";
}

export function LogoutButton({
  loginPath = "/auth/login",
  className,
  variant = "default",
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await createClient().auth.signOut();
      router.push(loginPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50",
          className
        )}
      >
        <LogOut className="size-4 shrink-0" />
        <span>{loading ? "Signing out…" : "Log out"}</span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className={cn("border-navy/20 text-navy hover:bg-psych-bg", className)}
    >
      <LogOut className="size-4" />
      {loading ? "Signing out…" : "Log out"}
    </Button>
  );
}
