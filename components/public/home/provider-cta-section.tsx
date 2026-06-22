import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BENEFITS = [
  "We fill your schedule with matched patients",
  "No credentialing paperwork — we handle it",
  "75% revenue share on every session",
  "Flexible telehealth from anywhere in Florida",
  "Dedicated support team for your practice",
];

export function ProviderCtaSection() {
  return (
    <section className="relative overflow-hidden bg-navy py-16 sm:py-24">
      <div className="absolute -left-24 top-1/2 size-64 -translate-y-1/2 rounded-full bg-teal/20 blur-3xl" />
      <div className="absolute -right-24 bottom-0 size-80 rounded-full bg-teal/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">
              Join PsychRx.
              <br />
              <span className="text-teal-400">We fill your schedule.</span>
            </h2>
            <p className="mt-4 max-w-lg text-white/70">
              Focus on patient care while we handle matching, scheduling, billing,
              and credentialing.
            </p>
          </div>

          <ul className="space-y-4">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal/20">
                  <Check className="size-4 text-teal-400" />
                </span>
                <span className="text-white/90">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <Link
            href="/providers/apply"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-teal text-white hover:bg-teal-700"
            )}
          >
            Apply to Join
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
