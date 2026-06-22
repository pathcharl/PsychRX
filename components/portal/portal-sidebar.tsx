"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CalendarClock,
  DollarSign,
  FileText,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Settings,
  Users,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/public/logo";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NextPaymentInfo, SidebarBadges } from "@/lib/portal/types";
import { formatCurrency } from "@/lib/portal/utils";
import { LogoutButton } from "@/components/auth/logout-button";

const NAV = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/schedule", label: "Schedule", icon: Calendar },
  { href: "/portal/patients", label: "My Patients", icon: Users },
  { href: "/portal/scribe", label: "Submit Note", icon: PenLine, badgeKey: "notesDue" as const },
  { href: "/portal/earnings", label: "Earnings", icon: DollarSign },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare, badgeKey: "unreadMessages" as const },
  { href: "/portal/availability", label: "Availability", icon: CalendarClock },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

interface PortalSidebarProps {
  providerName: string;
  credentials: string | null;
  badges: SidebarBadges;
  nextPayment: NextPaymentInfo;
}

function NavLinks({
  badges,
  onNavigate,
}: {
  badges: SidebarBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const count = item.badgeKey ? badges[item.badgeKey] : 0;

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
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <Badge className="bg-teal text-white hover:bg-teal">{count}</Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function PaymentCard({ nextPayment }: { nextPayment: NextPaymentInfo }) {
  return (
    <div className="mx-3 mb-4 rounded-xl bg-gradient-to-br from-teal to-teal-700 p-4 text-white shadow-lg">
      <p className="text-xs font-medium uppercase tracking-wide text-white/80">
        Next Payment
      </p>
      <p className="mt-1 font-heading text-2xl font-bold">
        {formatCurrency(nextPayment.amount)}
      </p>
      <p className="mt-1 text-sm text-white/90">{nextPayment.date}</p>
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

export function PortalSidebar({
  providerName,
  credentials,
  badges,
  nextPayment,
}: PortalSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-navy lg:flex">
      <div className="border-b border-white/10 px-5 py-5">
        <Logo variant="light" className="text-lg" />
        <p className="mt-3 font-medium text-white">{providerName}</p>
        {credentials && (
          <p className="text-sm text-white/60">{credentials}</p>
        )}
      </div>
      <NavLinks badges={badges} />
      <SidebarLogout />
      <PaymentCard nextPayment={nextPayment} />
    </aside>
  );
}

export function PortalMobileNav({
  providerName,
  badges,
  nextPayment,
}: PortalSidebarProps) {
  return (
    <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-4 py-3 lg:hidden">
      <div>
        <Logo variant="light" className="text-base" />
        <p className="text-xs text-white/70">{providerName}</p>
      </div>
      <Sheet>
        <SheetTrigger
          className="inline-flex size-9 items-center justify-center rounded-md text-white hover:bg-white/10"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-none bg-navy p-0 text-white">
          <div className="border-b border-white/10 px-5 py-5">
            <Logo variant="light" />
            <p className="mt-2 font-medium">{providerName}</p>
          </div>
          <NavLinks badges={badges} />
          <SidebarLogout />
          <PaymentCard nextPayment={nextPayment} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
