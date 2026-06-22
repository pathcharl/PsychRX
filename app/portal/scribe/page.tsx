import { ScribeWizard } from "@/components/portal/scribe-wizard";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchScribeAppointments } from "@/lib/portal/data";

export default async function PortalScribePage() {
  const { provider } = await requirePortalProvider();
  const appointments = await fetchScribeAppointments(provider.id);

  return (
    <ScribeWizard appointments={appointments} providerId={provider.id} />
  );
}
