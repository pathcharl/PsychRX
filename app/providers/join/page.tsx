"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, DollarSign } from "lucide-react";
import { PageShell } from "@/components/public/page-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const BENEFITS = [
  "75% revenue share on every session",
  "We fill your schedule with matched patients",
  "No credentialing paperwork — we handle it",
  "Flexible telehealth from anywhere in Florida",
  "Dedicated support team for your practice",
  "Weekly direct deposit payments",
  "Malpractice coverage guidance included",
  "Join a growing network of 120+ providers",
];

const PROVIDER_TYPES = [
  "Psychiatrists (MD/DO)",
  "Psychiatric Nurse Practitioners (PMHNP)",
  "Licensed Clinical Social Workers (LCSW)",
  "Licensed Marriage & Family Therapists (LMFT)",
  "Licensed Professional Counselors (LPC)",
  "Psychologists (PhD/PsyD)",
  "Physician Assistants (PA)",
];

const SESSION_RATE = 150;
const REVENUE_SHARE = 0.75;

export default function ProviderJoinPage() {
  const [sessionsPerWeek, setSessionsPerWeek] = useState(20);

  const monthlyEarnings = Math.round(
    sessionsPerWeek * 4 * SESSION_RATE * REVENUE_SHARE
  );

  return (
    <PageShell>
      <section className="bg-navy py-16 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="font-heading text-4xl font-bold sm:text-5xl">
            Join PsychRx
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            We fill your schedule. You focus on patient care. Keep 75% of every
            session.
          </p>
          <Link
            href="/providers/apply"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 bg-teal text-white hover:bg-teal-700"
            )}
          >
            Apply Now
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-center text-3xl font-bold text-navy">
            Why providers choose PsychRx
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-xl border border-navy/10 bg-white p-4"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal/10">
                  <Check className="size-4 text-teal" />
                </span>
                <p className="text-sm text-psych-text/80">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-navy/10 bg-psych-bg py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-bold text-navy sm:text-3xl">
                Provider types we accept
              </h2>
              <p className="mt-2 text-psych-text/70">
                Licensed mental health professionals across Florida.
              </p>
              <ul className="mt-6 space-y-3">
                {PROVIDER_TYPES.map((type) => (
                  <li key={type} className="flex items-center gap-2 text-psych-text/80">
                    <Check className="size-4 shrink-0 text-teal" />
                    {type}
                  </li>
                ))}
              </ul>
            </div>

            <Card className="border-navy/10 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="size-5 text-teal" />
                  <CardTitle className="font-heading text-navy">
                    Earnings calculator
                  </CardTitle>
                </div>
                <CardDescription>
                  Estimate your monthly earnings at 75% revenue share
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessions">Sessions per week</Label>
                  <Input
                    id="sessions"
                    type="number"
                    min={1}
                    max={40}
                    value={sessionsPerWeek}
                    onChange={(e) =>
                      setSessionsPerWeek(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
                <div className="rounded-xl bg-navy p-6 text-center text-white">
                  <p className="text-sm text-white/60">Estimated monthly earnings</p>
                  <p className="mt-1 font-heading text-4xl font-bold text-teal-400">
                    ${monthlyEarnings.toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-white/50">
                    Based on ${SESSION_RATE}/session × {sessionsPerWeek} sessions/week ×
                    75%
                  </p>
                </div>
                <Link
                  href="/providers/apply"
                  className={cn(
                    buttonVariants(),
                    "w-full bg-teal text-white hover:bg-teal-700"
                  )}
                >
                  Apply Now
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-heading text-2xl font-bold text-navy">
            Ready to grow your practice?
          </h2>
          <p className="mt-2 text-psych-text/70">
            Applications reviewed within 48 hours.
          </p>
          <Link
            href="/providers/apply"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-6 bg-teal text-white hover:bg-teal-700"
            )}
          >
            Start Application
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
