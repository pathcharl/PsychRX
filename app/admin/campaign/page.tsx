import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCampaignMetrics } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminCampaignPage() {
  const campaign = await fetchCampaignMetrics();
  const faxPct =
    campaign.dailyFaxLimit > 0
      ? Math.round((campaign.faxesSentToday / campaign.dailyFaxLimit) * 100)
      : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">Campaign</h1>
        <p className="mt-1 text-navy/70">
          Outreach volume and allocation between referral sources and recruits
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Fax Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy/60">Sent Today</span>
              <span className="font-medium text-navy">
                {campaign.faxesSentToday} / {campaign.dailyFaxLimit}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-navy/10">
              <div
                className="h-full bg-teal transition-all"
                style={{ width: `${Math.min(100, faxPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Contacts This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy/60">Referral Sources</span>
              <Badge variant="outline">
                {campaign.referralSourcesContacted}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy/60">Provider Recruits</span>
              <Badge variant="outline">
                {campaign.providerRecruitsContacted}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg text-navy">
            Allocation Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            <div
              className="bg-teal"
              style={{ width: `${campaign.allocationReferralPct}%` }}
            />
            <div
              className="bg-navy"
              style={{ width: `${campaign.allocationRecruitPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-navy/60">
            <span>Referral {campaign.allocationReferralPct}%</span>
            <span>Recruit {campaign.allocationRecruitPct}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
