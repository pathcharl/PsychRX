import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchNextPaymentInfo, fetchSidebarBadges } from "@/lib/portal/data";

export default async function ProviderPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { provider } = await requirePortalProvider();
  const [badges, nextPayment] = await Promise.all([
    fetchSidebarBadges(provider.id),
    fetchNextPaymentInfo(provider.id),
  ]);

  const providerName = `${provider.first_name} ${provider.last_name}`;

  return (
    <PortalShell
      providerName={providerName}
      credentials={provider.credentials}
      badges={badges}
      nextPayment={nextPayment}
    >
      {children}
    </PortalShell>
  );
}
