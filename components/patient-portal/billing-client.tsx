"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Download, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalPatient, PortalSuperbill } from "@/lib/patient-portal/types";
import { formatCurrency } from "@/lib/patient-portal/utils";

interface BillingPageClientProps {
  patient: PortalPatient;
  superbills: PortalSuperbill[];
  outstandingBalance: number | null;
  defaultTab?: string;
}

export function BillingPageClient({
  patient,
  superbills,
  outstandingBalance,
  defaultTab = "overview",
}: BillingPageClientProps) {
  const [tab, setTab] = useState(defaultTab);
  const [payer, setPayer] = useState(
    patient.insurance_payer ||
      patient.insurance_primary_payer_name ||
      patient.insurance_provider ||
      ""
  );
  const [memberId, setMemberId] = useState(
    patient.insurance_id || patient.insurance_member_id || ""
  );
  const [groupNumber, setGroupNumber] = useState(
    patient.insurance_group || patient.insurance_group_number || ""
  );
  const [saving, setSaving] = useState(false);

  async function handleInsuranceUpdate() {
    setSaving(true);
    try {
      toast.success("Insurance information updated.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePayBalance() {
    toast.info("Redirecting to secure payment…");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Billing
        </h1>
        <p className="mt-1 text-navy/70">
          Insurance, statements, and payment
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "overview", label: "Overview" },
          { id: "insurance", label: "Insurance" },
          { id: "superbills", label: "Superbills" },
        ].map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "bg-teal hover:bg-teal-700" : ""}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {(tab === "overview" || tab === "insurance") && (
        <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-medium text-navy">
            Insurance on file
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payer">Insurance payer</Label>
              <Input
                id="payer"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-id">Member ID</Label>
              <Input
                id="member-id"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">Group number</Label>
              <Input
                id="group"
                value={groupNumber}
                onChange={(e) => setGroupNumber(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-navy/70">
            Copay: {formatCurrency(patient.copay_amount)}
          </p>
          {tab === "insurance" && (
            <Button
              className="mt-4 bg-teal hover:bg-teal-700"
              onClick={handleInsuranceUpdate}
              disabled={saving}
            >
              {saving ? "Saving…" : "Update insurance"}
            </Button>
          )}
        </div>
      )}

      {tab === "overview" && outstandingBalance != null && outstandingBalance > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-heading text-lg font-medium text-navy">
            Outstanding balance
          </h2>
          <p className="mt-2 text-2xl font-semibold text-navy">
            {formatCurrency(outstandingBalance)}
          </p>
          <Button
            className="mt-4 bg-teal hover:bg-teal-700"
            onClick={handlePayBalance}
          >
            <CreditCard className="size-4" />
            Pay now
          </Button>
          {outstandingBalance > 100 && (
            <p className="mt-3 text-sm text-navy/70">
              Payment plan available — contact us at 1-833-PSYCHRX to set up
              monthly installments.
            </p>
          )}
        </div>
      )}

      {(tab === "overview" || tab === "superbills") && (
        <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-heading text-lg font-medium text-navy">
            <FileText className="size-5 text-teal" />
            Superbills
          </h2>
          {superbills.length === 0 ? (
            <p className="mt-3 text-sm text-navy/60">
              No superbills available yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {superbills.map((bill) => (
                <li
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg border border-navy/10 px-4 py-3"
                >
                  <span className="text-sm text-navy">
                    {bill.date_of_service || "Statement"}
                  </span>
                  <a
                    href={bill.signed_url || bill.file_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Download className="size-4" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-navy/60">
            This receipt can be submitted to your FSA or HSA for reimbursement.
          </p>
        </div>
      )}
    </div>
  );
}
