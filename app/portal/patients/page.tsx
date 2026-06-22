import { PatientsList } from "@/components/portal/patients-list";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchPatients } from "@/lib/portal/data";

export default async function PortalPatientsPage() {
  const { provider } = await requirePortalProvider();
  const patients = await fetchPatients(provider.id);

  return <PatientsList initialPatients={patients} />;
}
