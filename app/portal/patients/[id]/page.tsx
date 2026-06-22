import { notFound } from "next/navigation";
import { PatientDetailClient } from "@/components/portal/patient-detail-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchPatientDetail } from "@/lib/portal/data";

export default async function PortalPatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { provider } = await requirePortalProvider();
  const detail = await fetchPatientDetail(provider.id, params.id);

  if (!detail) notFound();

  return (
    <PatientDetailClient
      patient={detail.patient as Record<string, unknown>}
      providerId={provider.id}
      sessionCount={detail.sessionCount}
      upcoming={detail.upcoming as Array<Record<string, unknown>>}
      sessionHistory={detail.sessionHistory}
      phq9Trend={detail.phq9Trend}
      messages={detail.messages}
      lastPhq9={detail.lastPhq9 as number | null}
    />
  );
}
