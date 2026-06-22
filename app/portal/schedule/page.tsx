import { ScheduleClient } from "@/components/portal/schedule-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchScheduleAppointments } from "@/lib/portal/data";

export default async function PortalSchedulePage() {
  const { provider } = await requirePortalProvider();
  const appointments = await fetchScheduleAppointments(provider.id);

  return (
    <ScheduleClient
      appointments={appointments as Array<Record<string, unknown>>}
      telehealthLink={provider.telehealth_link}
    />
  );
}
