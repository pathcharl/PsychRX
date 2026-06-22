import { fetchAdminPatients } from "@/lib/admin/data";
import { PatientsClient } from "@/components/admin/patients-client";

export const dynamic = "force-dynamic";

export default async function AdminPatientsPage() {
  const rows = await fetchAdminPatients();
  return <PatientsClient rows={rows} />;
}
