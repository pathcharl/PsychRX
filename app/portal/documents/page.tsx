import { DocumentsClient } from "@/components/portal/documents-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchDocuments } from "@/lib/portal/data";

export default async function PortalDocumentsPage() {
  const { provider } = await requirePortalProvider();
  const { documents, agreement, icaSigned, baaSigned } = await fetchDocuments(
    provider.id
  );

  return (
    <DocumentsClient
      providerId={provider.id}
      documents={documents}
      agreement={agreement}
      icaSigned={icaSigned}
      baaSigned={baaSigned}
      caqhLastAttested={provider.caqh_last_attested}
      licenseState={provider.license_state}
      malpracticeCarrier={provider.malpractice_carrier}
      malpracticeExpiry={provider.malpractice_expiry}
    />
  );
}
