import { Brain, Pill, ClipboardList } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SERVICES = [
  {
    icon: Brain,
    title: "Therapy",
    credentials: "LCSW · LMFT · LPC",
    description:
      "Individual psychotherapy for anxiety, depression, trauma, and life transitions with licensed clinicians.",
  },
  {
    icon: Pill,
    title: "Medication Management",
    credentials: "PMHNP · Psychiatrist",
    description:
      "Psychiatric evaluation and ongoing medication management from board-certified prescribers.",
  },
  {
    icon: ClipboardList,
    title: "Psychological Testing",
    credentials: "PhD · PsyD",
    description:
      "Comprehensive assessments for ADHD, learning differences, and diagnostic clarification.",
  },
];

export function ServicesSection() {
  return (
    <section className="bg-psych-bg py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
            Care for every need
          </h2>
          <p className="mt-4 text-psych-text/70">
            Therapy, medication, and testing — all matched to your insurance and
            schedule.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <Card
              key={service.title}
              className="group border-navy/10 transition-all hover:-translate-y-1 hover:border-teal/30 hover:shadow-lg"
            >
              <CardHeader>
                <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                  <service.icon className="size-6" />
                </div>
                <CardTitle className="font-heading text-xl text-navy">
                  {service.title}
                </CardTitle>
                <p className="text-sm font-medium text-teal">
                  {service.credentials}
                </p>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {service.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
