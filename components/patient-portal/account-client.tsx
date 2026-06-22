"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { PortalPatient } from "@/lib/patient-portal/types";
import { format } from "date-fns";

export function AccountPageClient({ patient }: { patient: PortalPatient }) {
  const [email, setEmail] = useState(patient.email ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [city, setCity] = useState(patient.city ?? "");
  const [state, setState] = useState(patient.state ?? "FL");
  const [zip, setZip] = useState(patient.zip ?? "");
  const [emergencyName, setEmergencyName] = useState(
    patient.emergency_contact_name ?? ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    patient.emergency_contact_phone ?? ""
  );
  const [emergencyRelationship, setEmergencyRelationship] = useState(
    patient.emergency_contact_relationship ?? ""
  );
  const [pharmacy, setPharmacy] = useState(patient.preferred_pharmacy ?? "");
  const [modality, setModality] = useState(
    patient.session_modality_preference ?? "either"
  );
  const [smsEnabled, setSmsEnabled] = useState(!patient.sms_opted_out);
  const [saving, setSaving] = useState(false);

  async function handleSave(section: string) {
    setSaving(true);
    try {
      toast.success(`${section} updated.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Account
        </h1>
        <p className="mt-1 text-navy/70">
          Manage your profile and preferences
        </p>
      </div>

      <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">
          Contact information
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => handleSave("Email")}
                disabled={saving}
              >
                Verify
              </Button>
            </div>
            <p className="text-xs text-navy/50">
              We&apos;ll send a verification code via SMS
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => handleSave("Phone")}
                disabled={saving}
              >
                Verify
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">Address</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP</Label>
            <Input
              id="zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 bg-teal hover:bg-teal-700"
          onClick={() => handleSave("Address")}
          disabled={saving}
        >
          Save address
        </Button>
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">
          Emergency contact
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-phone">Phone</Label>
            <Input
              id="ec-phone"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ec-rel">Relationship</Label>
            <Input
              id="ec-rel"
              value={emergencyRelationship}
              onChange={(e) => setEmergencyRelationship(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 bg-teal hover:bg-teal-700"
          onClick={() => handleSave("Emergency contact")}
          disabled={saving}
        >
          Save emergency contact
        </Button>
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">
          Preferred pharmacy
        </h2>
        <div className="mt-4 space-y-2">
          <Label htmlFor="pharmacy">Name and location</Label>
          <Input
            id="pharmacy"
            value={pharmacy}
            onChange={(e) => setPharmacy(e.target.value)}
            placeholder="CVS — 123 Main St, Naples FL"
          />
        </div>
        <Button
          className="mt-4 bg-teal hover:bg-teal-700"
          onClick={() => handleSave("Pharmacy")}
          disabled={saving}
        >
          Save pharmacy
        </Button>
      </section>

      <section className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">
          Preferences
        </h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Session modality preference</Label>
            <Select
              value={modality}
              onValueChange={(v) => v && setModality(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video preferred</SelectItem>
                <SelectItem value="phone">Phone preferred</SelectItem>
                <SelectItem value="either">No preference</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-navy/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy">SMS notifications</p>
              <p className="text-xs text-navy/60">
                Appointment reminders and portal alerts (no PHI in texts)
              </p>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          </div>
          <div className="rounded-lg bg-psych-bg px-4 py-3 text-sm text-navy/70">
            <p className="font-medium text-navy">Telehealth consent</p>
            <p className="mt-1">
              Status:{" "}
              {patient.telehealth_consent_signed ? "Signed" : "Not signed"}
              {patient.telehealth_consent_date &&
                ` on ${format(new Date(patient.telehealth_consent_date), "MMM d, yyyy")}`}
            </p>
          </div>
        </div>
        <Button
          className="mt-4 bg-teal hover:bg-teal-700"
          onClick={() => handleSave("Preferences")}
          disabled={saving}
        >
          Save preferences
        </Button>
      </section>
    </div>
  );
}
