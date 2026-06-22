import { PortalShell } from "@/components/patient-portal/portal-shell";
import { PatientPortalAuthGate } from "@/components/patient-portal/patient-portal-auth-gate";

export default function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell>
      <PatientPortalAuthGate>{children}</PatientPortalAuthGate>
    </PortalShell>
  );
}
