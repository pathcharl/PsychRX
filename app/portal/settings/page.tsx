import { SettingsClient } from "@/components/portal/settings-client";
import { requirePortalProvider } from "@/lib/portal/auth";

export default async function PortalSettingsPage() {
  const { provider } = await requirePortalProvider();
  return <SettingsClient provider={provider} />;
}
