import { MessagesPageClient } from "@/components/patient-portal/messages-client";
import { requirePortalPatient } from "@/lib/patient-portal/auth";
import { fetchAllMessages, resolveMessagingProviderId } from "@/lib/patient-portal/data";

export default async function PatientPortalMessagesPage() {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  const messages = await fetchAllMessages(ctx.patient.id);
  const providerId = await resolveMessagingProviderId(ctx.patient);

  return (
    <MessagesPageClient
      initialMessages={messages}
      patientId={ctx.patient.id}
      providerId={providerId}
    />
  );
}
