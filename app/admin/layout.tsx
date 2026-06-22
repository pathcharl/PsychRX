import { requireAdmin } from "@/lib/admin/auth";
import { fetchFillRate } from "@/lib/admin/data";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const fillRate = await fetchFillRate();

  return <AdminShell fillRate={fillRate}>{children}</AdminShell>;
}
