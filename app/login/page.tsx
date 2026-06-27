import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse, Stethoscope } from "lucide-react";
import { PageShell } from "@/components/public/page-shell";

export const metadata: Metadata = {
  title: "Log in · PsychRx",
  description: "Access your PsychRx patient or provider portal.",
};

const OPTIONS = [
  {
    href: "/patient-portal/login",
    title: "Log in as a Patient",
    description:
      "View your appointments, message your provider, and manage your visits.",
    icon: HeartPulse,
  },
  {
    href: "/auth/login",
    title: "Log in as a Provider",
    description:
      "Access your dashboard, schedule, patients, and earnings.",
    icon: Stethoscope,
  },
];

export default function LoginChooserPage() {
  return (
    <PageShell footerNote="PsychRx is a service of Balance Point Medical Corp">
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-psych-text/70">
            Choose how you&apos;d like to sign in.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex flex-col items-start rounded-2xl border border-navy/10 bg-white p-6 text-left transition-all hover:border-teal/40 hover:shadow-md"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                <opt.icon className="size-6" />
              </div>
              <p className="mt-4 font-heading text-lg font-semibold text-navy">
                {opt.title}
              </p>
              <p className="mt-1 text-sm text-psych-text/60">
                {opt.description}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-psych-text/60">
          New patient?{" "}
          <Link
            href="/schedule"
            className="font-medium text-teal hover:text-teal-700"
          >
            Book an appointment
          </Link>{" "}
          to get started.
        </p>
      </div>
    </PageShell>
  );
}
