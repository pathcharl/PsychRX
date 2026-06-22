import { requireAdmin } from "@/lib/admin/auth";
import { SettingsClient } from "@/components/admin/settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireAdmin();
  return <SettingsClient adminEmail={user.email ?? "admin"} />;
}
