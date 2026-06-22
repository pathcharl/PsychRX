import { DashboardClient } from "@/components/portal/dashboard-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchDashboardData } from "@/lib/portal/data";

export default async function PortalDashboardPage() {
  const { provider } = await requirePortalProvider();
  const data = await fetchDashboardData(provider);

  return <DashboardClient data={data} />;
}
