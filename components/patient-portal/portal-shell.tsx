"use client";

import { usePathname } from "next/navigation";
import { PortalNav } from "./portal-nav";
import { CrisisFooter } from "./crisis-footer";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/patient-portal/login";

  return (
    <div className="flex min-h-screen flex-col bg-psych-bg">
      {!isLogin && <PortalNav />}
      <div className="flex-1">{children}</div>
      <CrisisFooter />
    </div>
  );
}
