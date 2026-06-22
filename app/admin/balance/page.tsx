import { fetchBalancePage } from "@/lib/admin/data";
import { BalanceClient } from "@/components/admin/balance-client";

export const dynamic = "force-dynamic";

export default async function AdminBalancePage() {
  const data = await fetchBalancePage();
  return <BalanceClient data={data} />;
}
