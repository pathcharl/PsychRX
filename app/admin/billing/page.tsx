import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchBillingCenter } from "@/lib/admin/data";
import { formatCurrency } from "@/lib/portal/utils";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const billing = await fetchBillingCenter();

  const cards = [
    { label: "Claims Pending", value: String(billing.claimsPending) },
    {
      label: "Paid This Month",
      value: formatCurrency(billing.claimsPaidThisMonth),
    },
    { label: "Denial Rate", value: `${billing.denialRate}%` },
    { label: "Avg Days to Payment", value: String(billing.avgDaysToPayment) },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">Billing</h1>
        <p className="mt-1 text-navy/70">Claims pipeline and payment timing</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-navy/10">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-sm font-medium text-navy/60">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-3xl font-bold text-navy">
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
