"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/public/logo";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV_ITEMS = [
  { href: "/patient-portal/appointments", label: "My Appointments" },
  { href: "/patient-portal/messages", label: "Messages" },
  { href: "/patient-portal/billing", label: "Billing" },
  { href: "/patient-portal/account", label: "Account" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-navy/10 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo href="/patient-portal/dashboard" />
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal/10 text-teal"
                    : "text-navy/70 hover:bg-psych-bg hover:text-navy"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <LogoutButton loginPath="/patient-portal/login" className="ml-1" />
        </nav>
      </div>
    </header>
  );
}
