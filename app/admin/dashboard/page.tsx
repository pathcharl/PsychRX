import { fetchAdminDashboard } from "@/lib/admin/data";
import { AdminDashboardClient } from "@/components/admin/dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await fetchAdminDashboard();
  return <AdminDashboardClient data={data} />;
}
