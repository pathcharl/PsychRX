"use client";

import { Download, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProviderMilestone, ProviderPaymentRow } from "@/lib/portal/types";
import { formatCurrency, formatDate } from "@/lib/portal/utils";

interface EarningsClientProps {
  currentPeriod: {
    sessions: number;
    gross: number;
    psychrxFee: number;
    providerAmount: number;
  };
  paymentHistory: ProviderPaymentRow[];
  milestones: ProviderMilestone[];
  ytdTotal: number;
  allTimeTotal: number;
  allTimeSessions: number;
}

export function EarningsClient({
  currentPeriod,
  paymentHistory,
  milestones,
  ytdTotal,
  allTimeTotal,
  allTimeSessions,
}: EarningsClientProps) {
  function downloadCsv() {
    const headers = [
      "Period Start",
      "Period End",
      "Sessions",
      "Gross",
      "Your Amount",
      "Status",
      "Date Paid",
    ];
    const rows = paymentHistory.map((p) => [
      p.payment_period_start,
      p.payment_period_end,
      p.session_count,
      p.gross_collected,
      p.provider_amount,
      p.transfer_status,
      p.transferred_at ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `psychrx-1099-${new Date().getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy">
            Earnings
          </h1>
          <p className="mt-1 text-navy/70">Payment history and milestones</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={downloadCsv}>
          <Download className="size-4" /> Download CSV for 1099
        </Button>
      </div>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Current Period
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-navy/60">Sessions</p>
            <p className="font-heading text-2xl font-bold text-navy">
              {currentPeriod.sessions}
            </p>
          </div>
          <div>
            <p className="text-sm text-navy/60">Gross billed</p>
            <p className="font-heading text-2xl font-bold text-navy">
              {formatCurrency(currentPeriod.gross)}
            </p>
          </div>
          <div>
            <p className="text-sm text-navy/60">PsychRx fee (25%)</p>
            <p className="font-heading text-2xl font-bold text-navy/70">
              {formatCurrency(currentPeriod.psychrxFee)}
            </p>
          </div>
          <div>
            <p className="text-sm text-navy/60">Your amount (75%)</p>
            <p className="font-heading text-2xl font-bold text-teal">
              {formatCurrency(currentPeriod.providerAmount)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-navy/10">
          <CardContent className="p-6">
            <p className="text-sm text-navy/60">YTD Total</p>
            <p className="font-heading text-3xl font-bold text-navy">
              {formatCurrency(ytdTotal)}
            </p>
            <p className="mt-2 text-xs text-navy/50">
              1099 YTD amount — consult your tax advisor
            </p>
          </CardContent>
        </Card>
        <Card className="border-navy/10">
          <CardContent className="p-6">
            <p className="text-sm text-navy/60">All-Time Total</p>
            <p className="font-heading text-3xl font-bold text-navy">
              {formatCurrency(allTimeTotal)}
            </p>
            <p className="mt-1 text-sm text-navy/60">
              {allTimeSessions} sessions completed
            </p>
          </CardContent>
        </Card>
      </div>

      {milestones.length > 0 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
              <Trophy className="size-5 text-amber-500" /> Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-amber-200 bg-amber-50/50 p-4"
                >
                  <p className="font-medium text-navy">
                    {m.milestone_title ?? m.milestone_id}
                  </p>
                  <p className="text-sm text-navy/60">
                    {formatDate(m.awarded_at)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Your Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-navy/60">
                    No payments yet.
                  </TableCell>
                </TableRow>
              ) : (
                paymentHistory.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {formatDate(p.payment_period_start)} –{" "}
                      {formatDate(p.payment_period_end)}
                    </TableCell>
                    <TableCell>{p.session_count}</TableCell>
                    <TableCell>{formatCurrency(p.gross_collected)}</TableCell>
                    <TableCell className="font-medium text-teal">
                      {formatCurrency(p.provider_amount)}
                    </TableCell>
                    <TableCell className="capitalize">{p.transfer_status}</TableCell>
                    <TableCell>
                      {p.transferred_at ? formatDate(p.transferred_at) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
