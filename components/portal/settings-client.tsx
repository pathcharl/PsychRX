"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalProvider } from "@/lib/portal/types";

interface SettingsClientProps {
  provider: PortalProvider;
}

export function SettingsClient({ provider }: SettingsClientProps) {
  const [email, setEmail] = useState(provider.email ?? "");
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [telehealthLink, setTelehealthLink] = useState(
    provider.telehealth_link ?? ""
  );
  const [directPhone, setDirectPhone] = useState(provider.direct_phone ?? "");
  const [directFax, setDirectFax] = useState(provider.direct_fax ?? "");
  const [ptUrl, setPtUrl] = useState(provider.pt_profile_url ?? "");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function sendVerification(field: "email" | "phone") {
    try {
      const res = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider.id,
          action: "send_verification",
          field,
          value: field === "email" ? email : phone,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      if (field === "email") setEmailSent(true);
      else setPhoneSent(true);
      toast.success(`Verification code sent to your ${field}.`);
    } catch {
      toast.error("Could not send verification code.");
    }
  }

  async function verifyField(field: "email" | "phone") {
    try {
      const res = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider.id,
          action: "verify",
          field,
          code: field === "email" ? emailCode : phoneCode,
          value: field === "email" ? email : phone,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`${field === "email" ? "Email" : "Phone"} updated.`);
      if (field === "email") {
        setEmailSent(false);
        setEmailCode("");
      } else {
        setPhoneSent(false);
        setPhoneCode("");
      }
    } catch {
      toast.error("Invalid verification code.");
    }
  }

  async function connectBank() {
    setConnecting(true);
    try {
      const res = await fetch(
        `/api/stripe/connect?provider_id=${provider.id}`
      );
      const data = await res.json();
      if (!res.ok || !data.onboarding_url) throw new Error("Failed");
      window.location.href = data.onboarding_url;
    } catch {
      toast.error("Could not start bank account setup.");
      setConnecting(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: provider.id,
          telehealth_link: telehealthLink,
          direct_phone: directPhone,
          direct_fax: directFax,
          pt_profile_url: ptUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Profile settings saved.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Settings
        </h1>
        <p className="mt-1 text-navy/70">Account and profile preferences</p>
      </div>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          {!emailSent ? (
            <Button variant="outline" onClick={() => sendVerification("email")}>
              Send SMS Verification Code
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="Enter code"
              />
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={() => verifyField("email")}
              >
                Verify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">Phone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Phone number</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          {!phoneSent ? (
            <Button variant="outline" onClick={() => sendVerification("phone")}>
              Send SMS Verification Code
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                placeholder="Enter code"
              />
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={() => verifyField("phone")}
              >
                Verify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Bank Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          {provider.stripe_connect_ready ? (
            <p className="text-sm text-emerald-700">
              Bank account connected via Stripe.
            </p>
          ) : (
            <Button
              className="gap-2 bg-teal hover:bg-teal-700"
              disabled={connecting}
              onClick={connectBank}
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              Connect Bank Account
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Clinical Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Doxy.me / telehealth link</Label>
            <Input
              value={telehealthLink}
              onChange={(e) => setTelehealthLink(e.target.value)}
              placeholder="https://doxy.me/yourname"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Direct prescribing phone</Label>
            <Input
              type="tel"
              value={directPhone}
              onChange={(e) => setDirectPhone(e.target.value)}
              placeholder="For pharmacy/insurance callbacks"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Direct prescribing fax</Label>
            <Input
              value={directFax}
              onChange={(e) => setDirectFax(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Psychology Today profile URL</Label>
            <Input
              value={ptUrl}
              onChange={(e) => setPtUrl(e.target.value)}
              placeholder="https://www.psychologytoday.com/..."
              className="mt-1"
            />
          </div>
          <Button
            className="bg-teal hover:bg-teal-700"
            disabled={saving}
            onClick={saveProfile}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
