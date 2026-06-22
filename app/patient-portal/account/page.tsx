import { AccountPageClient } from "@/components/patient-portal/account-client";
import { requirePortalPatient } from "@/lib/patient-portal/auth";

export default async function PatientPortalAccountPage() {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  return <AccountPageClient patient={ctx.patient} />;
}
