"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsClient({ adminEmail }: { adminEmail: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  function runAction(key: string, message: string) {
    setBusy(key);
    setTimeout(() => {
      setBusy(null);
      toast.success(message);
    }, 600);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">Settings</h1>
        <p className="mt-1 text-navy/70">Owner actions and account</p>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg text-navy">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-navy/70">
            Signed in as <span className="font-medium text-navy">{adminEmail}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg text-navy">
            Owner Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            className="gap-2 bg-teal hover:bg-teal-700"
            disabled={busy === "report"}
            onClick={() =>
              runAction("report", "Weekly report SMS sent.")
            }
          >
            <MessageSquareText className="size-4" />
            {busy === "report" ? "Sending…" : "Send Weekly Report SMS Now"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={busy === "balance"}
            onClick={() =>
              runAction("balance", "Balance engine re-run triggered.")
            }
          >
            <RefreshCw className="size-4" />
            {busy === "balance" ? "Running…" : "Force Balance Check"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
