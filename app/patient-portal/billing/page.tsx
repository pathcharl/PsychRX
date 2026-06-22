import { BillingPageClient } from "@/components/patient-portal/billing-client";
import { requirePortalPatient } from "@/lib/patient-portal/auth";
import {
  fetchOutstandingBalance,
  fetchSuperbills,
} from "@/lib/patient-portal/data";

export default async function PatientPortalBillingPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  const { patient } = ctx;
  const [superbills, outstandingBalance] = await Promise.all([
    fetchSuperbills(patient.id),
    fetchOutstandingBalance(patient.id),
  ]);

  return (
    <BillingPageClient
      patient={patient}
      superbills={superbills}
      outstandingBalance={outstandingBalance ?? patient.outstanding_balance}
      defaultTab={searchParams.tab ?? "overview"}
    />
  );
}
