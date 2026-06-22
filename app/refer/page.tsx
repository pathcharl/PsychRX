"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/public/page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REASONS = [
  "ADHD",
  "Anxiety",
  "Depression",
  "Postpartum",
  "PTSD",
  "Medication management",
  "Therapy",
  "Testing",
] as const;

const URGENCY_OPTIONS = [
  { value: "routine", label: "Routine", description: "Within 2–4 weeks" },
  { value: "soon", label: "Soon", description: "Within 1 week" },
  { value: "urgent", label: "Urgent", description: "Within 48 hours" },
] as const;

export default function ReferPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [referrerName, setReferrerName] = useState("");
  const [referrerNpi, setReferrerNpi] = useState("");
  const [referrerFax, setReferrerFax] = useState("");
  const [practiceName, setPracticeName] = useState("");

  const [patientName, setPatientName] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientInsurance, setPatientInsurance] = useState("");

  const [reasons, setReasons] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("routine");
  const [notes, setNotes] = useState("");

  function toggleReason(reason: string) {
    setReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  }

  async function handleSubmit() {
    if (!referrerName || !referrerNpi || !patientName || !patientPhone) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/referrals/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer_name: referrerName,
          referrer_npi: referrerNpi,
          referrer_fax: referrerFax,
          practice_name: practiceName,
          patient_name: patientName,
          patient_dob: patientDob,
          patient_phone: patientPhone,
          patient_insurance: patientInsurance,
          reasons,
          urgency,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit referral");
      }

      setSubmitted(true);
      toast.success("Referral submitted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-teal/10">
            <Check className="size-8 text-teal" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">
            Referral received
          </h1>
          <p className="mt-4 text-psych-text/70">
            We&apos;ll fax you confirmation within 24 hours of the patient being
            seen.
          </p>
          <Button
            className="mt-8 bg-teal text-white hover:bg-teal-700"
            onClick={() => setSubmitted(false)}
          >
            Submit another referral
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
            Refer a Patient
          </h1>
          <p className="mt-2 text-psych-text/70">
            Submit a referral and we&apos;ll contact your patient within 15 minutes.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">Your info</CardTitle>
              <CardDescription>Referring physician details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="referrer-name">Name *</Label>
                <Input
                  id="referrer-name"
                  value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referrer-npi">NPI *</Label>
                <Input
                  id="referrer-npi"
                  value={referrerNpi}
                  onChange={(e) => setReferrerNpi(e.target.value)}
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referrer-fax">Fax</Label>
                <Input
                  id="referrer-fax"
                  value={referrerFax}
                  onChange={(e) => setReferrerFax(e.target.value)}
                  placeholder="(239) 555-0100"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="practice-name">Practice name</Label>
                <Input
                  id="practice-name"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  placeholder="Southwest Medical Group"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">Patient info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="patient-name">Patient name *</Label>
                <Input
                  id="patient-name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-dob">Date of birth</Label>
                <Input
                  id="patient-dob"
                  type="date"
                  value={patientDob}
                  onChange={(e) => setPatientDob(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-phone">Phone *</Label>
                <Input
                  id="patient-phone"
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="patient-insurance">Insurance</Label>
                <Input
                  id="patient-insurance"
                  value={patientInsurance}
                  onChange={(e) => setPatientInsurance(e.target.value)}
                  placeholder="Aetna, Cigna, etc."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">Reason for referral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REASONS.map((reason) => {
                  const selected = reasons.includes(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleReason(reason)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        selected
                          ? "border-teal bg-teal/10 text-teal"
                          : "border-navy/10 hover:border-teal/30"
                      )}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">Urgency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {URGENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUrgency(option.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    urgency === option.value
                      ? "border-teal bg-teal/10"
                      : "border-navy/10 hover:border-teal/30"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 shrink-0 rounded-full border-2",
                      urgency === option.value
                        ? "border-teal bg-teal"
                        : "border-navy/30"
                    )}
                  />
                  <div>
                    <p className="font-medium text-navy">{option.label}</p>
                    <p className="text-sm text-psych-text/60">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional clinical information..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Button
            className="w-full bg-teal py-6 text-base text-white hover:bg-teal-700"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Referral"
            )}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
