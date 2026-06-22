import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: 1,
    title: "Tell us what you need",
    description: "Choose therapy, medication management, or testing.",
  },
  {
    number: 2,
    title: "Verify insurance",
    description: "We confirm your coverage and copay in seconds.",
  },
  {
    number: 3,
    title: "We match you instantly",
    description: "Get paired with a licensed provider who fits your needs.",
  },
  {
    number: 4,
    title: "Meet this week",
    description: "Book a video or phone session — often within days.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-psych-text/70">
            From first click to first session in four simple steps.
          </p>
        </div>

        <div className="relative mx-auto mt-16 max-w-3xl">
          <div className="absolute left-6 top-0 hidden h-full w-px bg-teal/30 sm:block" />

          <div className="space-y-10">
            {STEPS.map((step) => (
              <div key={step.number} className="relative flex gap-6 sm:gap-8">
                <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-teal font-heading text-lg font-bold text-white shadow-md shadow-teal/25">
                  {step.number}
                </div>
                <div className="pt-2">
                  <h3 className="font-heading text-xl font-semibold text-navy">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-psych-text/70">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/schedule"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-teal text-white hover:bg-teal-700"
            )}
          >
            Get Started
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
