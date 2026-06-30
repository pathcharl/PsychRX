"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AuditResult, ScribeAppointment } from "@/lib/portal/types";
import { formatTime } from "@/lib/portal/utils";

const STEPS = [
  "Select Session",
  "Confirm Details",
  "Session Summary",
  "Generate Note",
  "Review Note",
  "Audit",
  "Attest & Submit",
];

interface ScribeWizardProps {
  appointments: ScribeAppointment[];
  providerId: string;
}

export function ScribeWizard({ appointments, providerId }: ScribeWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<ScribeAppointment | null>(null);
  const [sessionType, setSessionType] = useState("follow_up");
  const [modality, setModality] = useState("video");
  const [phoneReason, setPhoneReason] = useState("");
  const [summary, setSummary] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [cptSuggestion, setCptSuggestion] = useState<{
    code: string;
    reasoning: string;
  } | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startDictation = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setSummary((prev) => prev + transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Dictation stopped.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  async function generateNote() {
    if (!summary.trim() || !selected) {
      toast.error("Please enter a session summary.");
      return;
    }
    setStreaming(true);
    setGeneratedNote("");
    setStep(3);

    try {
      const res = await fetch("/api/portal/scribe/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          session_type: sessionType,
          modality,
          appointment_id: selected.id,
          patient_name: selected.patient_name,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Generation failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setGeneratedNote(full);
      }

      const metaRes = await fetch("/api/portal/scribe/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: full, session_type: sessionType, modality }),
      });
      const meta = await metaRes.json();
      setCptSuggestion(meta.cpt ?? null);
      setAuditResults(meta.audit ?? []);
      setStep(4);
    } catch {
      toast.error("Failed to generate note. Please try again.");
      setStep(2);
    } finally {
      setStreaming(false);
    }
  }

  async function submitEncounter() {
    if (!selected || !generatedNote) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/scribe/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: selected.id,
          provider_id: providerId,
          patient_id: selected.patient_id,
          ai_note_generated: generatedNote,
          cpt_code: cptSuggestion?.code ?? "99214",
          session_modality: modality,
          phone_session_reason: modality === "phone" ? phoneReason : null,
          session_type: sessionType,
          audit_results: auditResults,
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      toast.success("Note submitted. Claim queued for submission.");
      router.push("/portal/dashboard");
      router.refresh();
    } catch {
      toast.error("Failed to submit encounter.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Submit Note
        </h1>
        <p className="mt-1 text-navy/70">AI-assisted clinical documentation</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
              i === step
                ? "bg-teal text-white"
                : i < step
                  ? "bg-teal/20 text-teal"
                  : "bg-navy/5 text-navy/50"
            )}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Select a session to document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.length === 0 ? (
              <p className="text-navy/60">
                No sessions are ready to document yet. Sessions appear here once
                their scheduled time has passed.
              </p>
            ) : (
              appointments.map((appt) => (
                <button
                  key={appt.id}
                  type="button"
                  onClick={() => {
                    setSelected(appt);
                    setSessionType(appt.appointment_type ?? "follow_up");
                    setModality(appt.session_modality);
                    setStep(1);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-navy/10 p-4 text-left transition-colors hover:border-teal hover:bg-teal/5"
                >
                  <div>
                    <p className="font-medium text-navy">{appt.patient_name}</p>
                    <p className="text-sm text-navy/60">
                      {formatTime(appt.start_time)} · {appt.session_modality}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-navy/40" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && selected && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Confirm session details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Session type</Label>
              <Select value={sessionType} onValueChange={(v) => v && setSessionType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_patient">New patient</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="eval">Evaluation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modality</Label>
              <Select value={modality} onValueChange={(v) => v && setModality(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modality === "phone" && (
              <div>
                <Label>Phone session reason</Label>
                <Select value={phoneReason} onValueChange={(v) => v && setPhoneReason(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provider_preference">
                      Provider preference
                    </SelectItem>
                    <SelectItem value="technology_failure">
                      Technology failure
                    </SelectItem>
                    <SelectItem value="patient_request">
                      Patient request
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Session summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={6}
              placeholder="Type 2-3 sentences about the session. AI will generate the complete clinical note."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={listening ? stopDictation : startDictation}
              >
                {listening ? (
                  <>
                    <MicOff className="size-4" /> Stop dictation
                  </>
                ) : (
                  <>
                    <Mic className="size-4" /> Dictate
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={generateNote}
              >
                Generate Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(step === 3 || step === 4) && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
              {streaming && <Loader2 className="size-5 animate-spin text-teal" />}
              Clinical Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-lg bg-navy/5 p-4 text-sm text-navy">
              {generatedNote || (streaming ? "Generating..." : "")}
            </div>
            {cptSuggestion && !streaming && (
              <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
                <p className="font-medium text-navy">
                  Suggested CPT: {cptSuggestion.code}
                </p>
                <p className="mt-1 text-sm text-navy/70">
                  {cptSuggestion.reasoning}
                </p>
              </div>
            )}
            {!streaming && generatedNote && step === 4 && (
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={() => setStep(5)}
              >
                Continue to Audit
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Audit Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditResults.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-3",
                  item.status === "pass" && "bg-emerald-50",
                  item.status === "fail" && "bg-red-50",
                  item.status === "warn" && "bg-amber-50"
                )}
              >
                {item.status === "pass" && (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                )}
                {item.status === "fail" && (
                  <AlertCircle className="size-5 shrink-0 text-red-600" />
                )}
                {item.status === "warn" && (
                  <AlertCircle className="size-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="font-medium text-navy">{item.label}</p>
                  {item.detail && (
                    <p className="text-sm text-navy/70">{item.detail}</p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button
                className="bg-teal hover:bg-teal-700"
                onClick={() => setStep(6)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Attest & Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-navy/70">
              I attest that this note accurately reflects the clinical encounter
              and that all information is true and complete to the best of my
              knowledge.
            </p>
            <Button
              className="w-full bg-teal hover:bg-teal-700 sm:w-auto"
              disabled={submitting}
              onClick={submitEncounter}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Attest and Submit"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Web Speech API types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
