"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/public/page-shell";
import { StepProgress } from "@/components/public/step-progress";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 6;

const PROVIDER_TYPES = [
  { value: "pmhnp", label: "Psychiatric Nurse Practitioner (PMHNP)" },
  { value: "psychiatrist", label: "Psychiatrist (MD/DO)" },
  { value: "therapist", label: "Therapist (LCSW/LMFT/LPC)" },
  { value: "psychologist", label: "Psychologist (PhD/PsyD)" },
  { value: "md_supervisor", label: "MD Supervisor" },
];

const INSURANCE_PANELS = [
  "Aetna",
  "Cigna",
  "United",
  "BCBS FL",
  "Humana",
  "Medicare",
  "Medicaid",
];

const SPECIALTY_OPTIONS = [
  "Anxiety",
  "Depression",
  "ADHD",
  "PTSD",
  "Bipolar disorder",
  "OCD",
  "Trauma",
  "Substance use",
  "Eating disorders",
  "Postpartum",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening"];

interface ApplicationData {
  firstName: string;
  lastName: string;
  credentials: string;
  npi: string;
  email: string;
  phone: string;
  providerType: string;
  licenseNumber: string;
  licenseState: string;
  malpracticeCarrier: string;
  malpracticePolicy: string;
  insurancePanels: string[];
  specialties: string[];
  conditions: string;
  availability: Record<string, string[]>;
}

const initialData: ApplicationData = {
  firstName: "",
  lastName: "",
  credentials: "",
  npi: "",
  email: "",
  phone: "",
  providerType: "",
  licenseNumber: "",
  licenseState: "FL",
  malpracticeCarrier: "",
  malpracticePolicy: "",
  insurancePanels: [],
  specialties: [],
  conditions: "",
  availability: {},
};

export default function ProviderApplyPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ApplicationData>(initialData);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateField<K extends keyof ApplicationData>(
    key: K,
    value: ApplicationData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function togglePanel(panel: string) {
    setData((prev) => ({
      ...prev,
      insurancePanels: prev.insurancePanels.includes(panel)
        ? prev.insurancePanels.filter((p) => p !== panel)
        : [...prev.insurancePanels, panel],
    }));
  }

  function toggleSpecialty(specialty: string) {
    setData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  }

  function toggleAvailability(day: string, block: string) {
    setData((prev) => {
      const current = prev.availability[day] ?? [];
      const updated = current.includes(block)
        ? current.filter((b) => b !== block)
        : [...current, block];
      return {
        ...prev,
        availability: { ...prev.availability, [day]: updated },
      };
    });
  }

  function validateStep(): boolean {
    switch (step) {
      case 1:
        if (
          !data.firstName ||
          !data.lastName ||
          !data.npi ||
          !data.email ||
          !data.providerType
        ) {
          toast.error("Please complete all required fields.");
          return false;
        }
        return true;
      case 2:
        if (!data.licenseNumber) {
          toast.error("License number is required.");
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/providers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: data.firstName,
          last_name: data.lastName,
          npi: data.npi,
          email: data.email,
          phone: data.phone,
          provider_type: data.providerType,
          license_number: data.licenseNumber,
          license_state: data.licenseState,
          credentials: data.credentials,
          specialties: data.specialties,
          languages: ["English"],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Application failed");
      }

      setSubmitted(true);
      toast.success("Application submitted!");
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
            Application received
          </h1>
          <p className="mt-4 text-psych-text/70">
            Thank you for applying. Check your email for next steps including your
            contract to sign via DocuSeal.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-navy">
            Provider Application
          </h1>
          <p className="mt-2 text-psych-text/70">
            Join the PsychRx network in {TOTAL_STEPS} steps
          </p>
        </div>

        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} className="mb-8" />

        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-navy">
              {step === 1 && "Basic information"}
              {step === 2 && "License & malpractice"}
              {step === 3 && "Insurance panels"}
              {step === 4 && "Specialties & conditions"}
              {step === 5 && "Weekly availability"}
              {step === 6 && "Review & submit"}
            </CardTitle>
            {step === 2 && (
              <CardDescription>
                Florida license and active malpractice coverage required
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First name *</Label>
                    <Input
                      value={data.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name *</Label>
                    <Input
                      value={data.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Credentials</Label>
                  <Input
                    value={data.credentials}
                    onChange={(e) => updateField("credentials", e.target.value)}
                    placeholder="PMHNP, LCSW, PhD, etc."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>NPI *</Label>
                    <Input
                      value={data.npi}
                      onChange={(e) => updateField("npi", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={data.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={data.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provider type *</Label>
                  <Select
                    value={data.providerType}
                    onValueChange={(v) => updateField("providerType", v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select provider type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>License number *</Label>
                    <Input
                      value={data.licenseNumber}
                      onChange={(e) =>
                        updateField("licenseNumber", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>License state</Label>
                    <Input
                      value={data.licenseState}
                      onChange={(e) =>
                        updateField("licenseState", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Malpractice carrier</Label>
                  <Input
                    value={data.malpracticeCarrier}
                    onChange={(e) =>
                      updateField("malpracticeCarrier", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy number</Label>
                  <Input
                    value={data.malpracticePolicy}
                    onChange={(e) =>
                      updateField("malpracticePolicy", e.target.value)
                    }
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {INSURANCE_PANELS.map((panel) => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => togglePanel(panel)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      data.insurancePanels.includes(panel)
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-navy/10 hover:border-teal/30"
                    )}
                  >
                    {panel}
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <>
                <div>
                  <Label className="mb-2 block">Specialties</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <button
                        key={specialty}
                        type="button"
                        onClick={() => toggleSpecialty(specialty)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          data.specialties.includes(specialty)
                            ? "border-teal bg-teal/10 text-teal"
                            : "border-navy/10 hover:border-teal/30"
                        )}
                      >
                        {specialty}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conditions treated</Label>
                  <Textarea
                    value={data.conditions}
                    onChange={(e) => updateField("conditions", e.target.value)}
                    placeholder="Describe additional conditions and populations you treat..."
                    rows={4}
                  />
                </div>
              </>
            )}

            {step === 5 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr>
                      <th className="pb-2 text-left font-medium text-psych-text/60" />
                      {TIME_BLOCKS.map((block) => (
                        <th
                          key={block}
                          className="pb-2 text-center font-medium text-psych-text/60"
                        >
                          {block}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day}>
                        <td className="py-2 pr-4 font-medium text-navy">{day}</td>
                        {TIME_BLOCKS.map((block) => {
                          const selected =
                            data.availability[day]?.includes(block) ?? false;
                          return (
                            <td key={block} className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleAvailability(day, block)}
                                className={cn(
                                  "size-8 rounded-md border transition-colors",
                                  selected
                                    ? "border-teal bg-teal text-white"
                                    : "border-navy/10 hover:border-teal/30"
                                )}
                                aria-label={`${day} ${block}`}
                              >
                                {selected && <Check className="mx-auto size-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4 text-sm">
                <div className="rounded-lg bg-psych-bg p-4">
                  <p className="font-medium text-navy">
                    {data.firstName} {data.lastName}
                    {data.credentials ? `, ${data.credentials}` : ""}
                  </p>
                  <p className="text-psych-text/60">
                    {PROVIDER_TYPES.find((t) => t.value === data.providerType)
                      ?.label ?? data.providerType}
                  </p>
                  <p className="mt-1 text-psych-text/60">NPI: {data.npi}</p>
                  <p className="text-psych-text/60">{data.email}</p>
                </div>
                <div>
                  <p className="font-medium text-navy">License</p>
                  <p className="text-psych-text/60">
                    {data.licenseNumber} ({data.licenseState})
                  </p>
                </div>
                {data.insurancePanels.length > 0 && (
                  <div>
                    <p className="font-medium text-navy">Insurance panels</p>
                    <p className="text-psych-text/60">
                      {data.insurancePanels.join(", ")}
                    </p>
                  </div>
                )}
                {data.specialties.length > 0 && (
                  <div>
                    <p className="font-medium text-navy">Specialties</p>
                    <p className="text-psych-text/60">
                      {data.specialties.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="border-navy/20"
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              className="bg-teal text-white hover:bg-teal-700"
              onClick={nextStep}
            >
              Continue
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              className="bg-teal text-white hover:bg-teal-700"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
