import { fetchAdminProviders } from "@/lib/admin/data";
import { ProvidersClient } from "@/components/admin/providers-client";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const rows = await fetchAdminProviders();
  return <ProvidersClient rows={rows} />;
}
