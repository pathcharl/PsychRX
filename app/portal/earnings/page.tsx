import { EarningsClient } from "@/components/portal/earnings-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchEarningsData } from "@/lib/portal/data";

export default async function PortalEarningsPage() {
  const { provider } = await requirePortalProvider();
  const data = await fetchEarningsData(provider.id);

  return (
    <EarningsClient
      currentPeriod={data.currentPeriod}
      paymentHistory={data.paymentHistory}
      milestones={data.milestones}
      ytdTotal={data.ytdTotal}
      allTimeTotal={data.allTimeTotal}
      allTimeSessions={data.allTimeSessions}
    />
  );
}
