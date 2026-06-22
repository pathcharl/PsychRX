import Link from "next/link";
import { Logo } from "@/components/public/logo";
import { Separator } from "@/components/ui/separator";

const footerLinks = [
  { href: "/schedule", label: "Book Appointment" },
  { href: "/refer", label: "Refer a Patient" },
  { href: "/providers/join", label: "For Providers" },
  { href: "/providers/apply", label: "Provider Application" },
];

export function PublicFooter({ footerNote }: { footerNote?: string }) {
  return (
    <footer className="border-t border-navy/10 bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Logo variant="light" />
            <p className="text-sm text-white/70">
              Mental health care matched to you — Southwest Florida.
            </p>
            <a
              href="tel:18337792479"
              className="inline-block text-lg font-semibold text-teal-400 hover:text-teal-300"
            >
              1-833-PSYCHRX
            </a>
          </div>

          <nav className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <Separator className="my-8 bg-white/10" />

        <p className="text-center text-xs text-white/50">
          © {new Date().getFullYear()} PsychRx. All rights reserved.
        </p>
        {footerNote && (
          <p className="mt-2 text-center text-xs text-white/40">{footerNote}</p>
        )}
      </div>
    </footer>
  );
}
