import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requirePortalPatient } from "@/lib/patient-portal/auth";
import { resolveMessagingProviderId } from "@/lib/patient-portal/data";
import { supabaseAdmin } from "@/lib/supabase";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PatientScheduleClient } from "@/components/patient-portal/schedule-client";

function NoProviderState() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Card className="border-navy/10">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-teal/10">
            <CalendarDays className="size-7 text-teal" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-navy">
              No provider assigned yet
            </h1>
            <p className="mt-2 text-navy/70">
              You don&apos;t have a care-team provider linked to your account
              yet. Book your first appointment to get matched with a provider.
            </p>
          </div>
          <Link
            href="/schedule"
            className={buttonVariants({ className: "bg-teal hover:bg-teal-700" })}
          >
            Book your first appointment
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function PatientPortalSchedulePage() {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  const providerId = await resolveMessagingProviderId(ctx.patient);
  if (!providerId) return <NoProviderState />;

  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, credentials")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) return <NoProviderState />;

  const name =
    `${(provider.first_name as string) ?? ""} ${(provider.last_name as string) ?? ""}`.trim() ||
    "your provider";

  return (
    <PatientScheduleClient
      provider={{
        id: provider.id as string,
        name,
        credentials: (provider.credentials as string) ?? null,
      }}
      patientName={ctx.patient.first_name || "there"}
      copay={ctx.patient.copay_amount}
    />
  );
}
