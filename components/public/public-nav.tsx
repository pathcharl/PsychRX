"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/public/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/providers/join", label: "For Providers" },
  { href: "/refer", label: "Refer a Patient" },
];

export function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-navy/10 bg-psych-white/95 backdrop-blur supports-[backdrop-filter]:bg-psych-white/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-psych-text/80 transition-colors hover:text-teal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className={cn(
              buttonVariants({ size: "lg" }),
              "hidden bg-teal text-white hover:bg-teal-700 sm:inline-flex"
            )}
          >
            Book Appointment
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-navy/10 bg-psych-white md:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-psych-text hover:bg-psych-bg"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/schedule"
            onClick={() => setMobileOpen(false)}
            className={cn(
              buttonVariants(),
              "mt-2 bg-teal text-white hover:bg-teal-700"
            )}
          >
            Book Appointment
          </Link>
        </nav>
      </div>
    </header>
  );
}
