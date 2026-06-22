import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { providerTypeLabel, statusBadgeColor } from "@/lib/admin/utils";

export const dynamic = "force-dynamic";

export default async function AdminProviderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!provider) notFound();

  const fields: { label: string; value: string }[] = [
    { label: "Provider Type", value: providerTypeLabel(provider.provider_type) },
    { label: "NPI", value: provider.npi ?? "—" },
    { label: "License State", value: provider.license_state ?? "—" },
    { label: "Email", value: provider.email ?? "—" },
    { label: "Phone", value: provider.phone ?? "—" },
    {
      label: "Fill Rate",
      value: provider.fill_rate != null ? `${provider.fill_rate}%` : "—",
    },
    {
      label: "Contract",
      value: provider.contract_signed ? "Signed" : "Pending",
    },
    {
      label: "Stripe",
      value: provider.stripe_onboarding_complete ? "Ready" : "Pending",
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/providers"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}
      >
        <ArrowLeft className="size-4" /> Back to Providers
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold text-navy">
          {provider.first_name} {provider.last_name}
        </h1>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
            statusBadgeColor(provider.status)
          )}
        >
          {provider.status === "inactive" ? "suspended" : provider.status}
        </span>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg text-navy">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs uppercase text-navy/50">{f.label}</p>
              <p className="text-navy">{f.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
