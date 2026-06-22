"use client";

import { PortalMobileNav, PortalSidebar } from "./portal-sidebar";
import type { NextPaymentInfo, SidebarBadges } from "@/lib/portal/types";

interface PortalShellProps {
  children: React.ReactNode;
  providerName: string;
  credentials: string | null;
  badges: SidebarBadges;
  nextPayment: NextPaymentInfo;
}

export function PortalShell({
  children,
  providerName,
  credentials,
  badges,
  nextPayment,
}: PortalShellProps) {
  const sidebarProps = { providerName, credentials, badges, nextPayment };

  return (
    <div className="flex min-h-screen bg-psych-bg">
      <PortalSidebar {...sidebarProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalMobileNav {...sidebarProps} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
