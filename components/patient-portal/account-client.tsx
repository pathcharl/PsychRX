"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

  async function handleSave(
    section: string,
    payload: Record<string, unknown>
  ) {
    setSaving(true);
    try {
      const res = await fetch("/api/patient-portal/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      toast.success(`${section} updated.`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save changes."
      );
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
                onClick={() => handleSave("Email", { email })}
                disabled={saving}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-navy/50">
              Used for appointment confirmations and portal notices
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
                onClick={() => handleSave("Phone", { phone })}
                disabled={saving}
              >
                Save
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
          onClick={() =>
            handleSave("Address", { address, city, state, zip })
          }
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
          onClick={() =>
            handleSave("Emergency contact", {
              emergency_contact_name: emergencyName,
              emergency_contact_phone: emergencyPhone,
              emergency_contact_relationship: emergencyRelationship,
            })
          }
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
          onClick={() =>
            handleSave("Pharmacy", { preferred_pharmacy: pharmacy })
          }
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
          onClick={() =>
            handleSave("Preferences", {
              session_modality_preference: modality,
              sms_opted_out: !smsEnabled,
            })
          }
          disabled={saving}
        >
          Save preferences
        </Button>
      </section>
    </div>
  );
}
