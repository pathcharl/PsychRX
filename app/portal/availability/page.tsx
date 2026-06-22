import { AvailabilityClient } from "@/components/portal/availability-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchAvailability } from "@/lib/portal/data";

export default async function PortalAvailabilityPage() {
  const { provider } = await requirePortalProvider();
  const { days, blockedDates, acceptsNewPatients } = await fetchAvailability(
    provider.id
  );

  return (
    <AvailabilityClient
      providerId={provider.id}
      initialDays={days}
      initialBlockedDates={blockedDates}
      acceptsNewPatients={acceptsNewPatients ?? provider.accepts_new_patients}
    />
  );
}
