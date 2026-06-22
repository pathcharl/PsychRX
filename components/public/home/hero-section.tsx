import Link from "next/link";
import { ArrowRight, Calendar, Phone, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const INSURANCE_PILLS = ["Aetna", "Cigna", "United", "BCBS FL", "Humana"];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-psych-bg">
      <div className="absolute -right-32 -top-32 size-96 rounded-full bg-teal/5 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
        <div className="space-y-8">
          <Badge
            variant="outline"
            className="gap-2 border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800"
          >
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Available this week · Southwest Florida
          </Badge>

          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl lg:text-6xl">
            Mental health care{" "}
            <span className="text-teal">matched to you.</span>
          </h1>

          <p className="max-w-lg text-lg text-psych-text/70">
            Board-certified therapists and psychiatric providers. Major insurance
            accepted. Sessions available this week.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/schedule"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-teal text-white hover:bg-teal-700"
              )}
            >
              Book Your Appointment
              <ArrowRight className="ml-1 size-4" />
            </Link>
            <a
              href="tel:18337792479"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-navy")}
            >
              <Phone className="mr-1 size-4" />
              1-833-PSYCHRX
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {INSURANCE_PILLS.map((name) => (
              <span
                key={name}
                className="rounded-full border border-navy/10 bg-white px-3 py-1 text-xs font-medium text-psych-text/70"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-teal/20 to-navy/10 blur-2xl" />
          <Card className="relative border-navy/10 shadow-xl">
            <CardHeader className="border-b bg-navy pb-4 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  Patient Portal
                </CardTitle>
                <Badge className="bg-teal/20 text-teal-100">Preview</Badge>
              </div>
              <CardDescription className="text-white/60">
                Your upcoming appointment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal">
                  <Video className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-navy">Sarah M., PMHNP</p>
                  <p className="text-sm text-psych-text/60">
                    Medication Management · Video Session
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-psych-bg p-4">
                <Calendar className="size-5 text-teal" />
                <div>
                  <p className="font-medium text-navy">Thursday, June 19</p>
                  <p className="text-sm text-psych-text/60">2:00 PM EST</p>
                </div>
              </div>

              <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                Join Session
              </Button>

              <p className="text-center text-xs text-psych-text/50">
                Button activates 15 minutes before your session
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
