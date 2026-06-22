"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  Receipt,
  ShieldCheck,
  CalendarClock,
  Scale,
  Megaphone,
  Settings,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/public/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FillRateGauge } from "./fill-rate-gauge";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/providers", label: "Providers", icon: Stethoscope },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/admin/coverage", label: "Coverage", icon: CalendarClock },
  { href: "/admin/balance", label: "Balance", icon: Scale },
  { href: "/admin/campaign", label: "Campaign", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 px-5 py-3">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-medium text-white/80">System Live</span>
    </div>
  );
}

function GaugeFooter({ fillRate }: { fillRate: number }) {
  return (
    <div className="mx-3 mb-4 flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/60">
        Platform Fill Rate
      </p>
      <FillRateGauge rate={fillRate} size={88} light />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
      <Logo variant="light" href="/admin/dashboard" className="text-lg" />
      <span className="rounded-md bg-teal px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
        Admin
      </span>
    </div>
  );
}

function SidebarLogout() {
  return (
    <div className="border-t border-white/10 px-3 py-3">
      <LogoutButton variant="sidebar" loginPath="/auth/login" />
    </div>
  );
}

export function AdminSidebar({ fillRate }: { fillRate: number }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy lg:flex">
      <Header />
      <LiveIndicator />
      <NavLinks />
      <SidebarLogout />
      <GaugeFooter fillRate={fillRate} />
    </aside>
  );
}

export function AdminMobileNav({ fillRate }: { fillRate: number }) {
  return (
    <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <Logo variant="light" href="/admin/dashboard" className="text-base" />
        <span className="rounded-md bg-teal px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
          Admin
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        <Sheet>
          <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md text-white hover:bg-white/10">
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 border-none bg-navy p-0 text-white"
          >
            <Header />
            <LiveIndicator />
            <NavLinks />
            <SidebarLogout />
            <GaugeFooter fillRate={fillRate} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
