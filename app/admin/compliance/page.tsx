import { fetchAuditLog, fetchComplianceRows } from "@/lib/admin/data";
import { ComplianceClient } from "@/components/admin/compliance-client";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  const [rows, auditLog] = await Promise.all([
    fetchComplianceRows(),
    fetchAuditLog(),
  ]);
  return <ComplianceClient rows={rows} auditLog={auditLog} />;
}
