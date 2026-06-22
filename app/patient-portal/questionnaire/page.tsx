"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being fidgety/restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

export default function QuestionnairePage() {
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function setResponse(index: number, value: string) {
    setResponses((prev) => ({ ...prev, [index]: value }));
  }

  async function handleSubmit() {
    const answered = Object.keys(responses).length;
    if (answered < PHQ9_QUESTIONS.length) {
      toast.error("Please answer all questions.");
      return;
    }
    setSubmitting(true);
    try {
      toast.success("Questionnaire submitted. Thank you!");
    } finally {
      setSubmitting(false);
    }
  }

  const options = [
    { value: "0", label: "Not at all" },
    { value: "1", label: "Several days" },
    { value: "2", label: "More than half the days" },
    { value: "3", label: "Nearly every day" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Brief questionnaire
        </h1>
        <p className="mt-1 text-navy/70">
          Over the last 2 weeks, how often have you been bothered by the
          following?
        </p>
      </div>

      <div className="space-y-6">
        {PHQ9_QUESTIONS.map((question, index) => (
          <div
            key={index}
            className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-navy">
              {index + 1}. {question}
            </p>
            <div className="mt-3 space-y-2">
              <Label className="sr-only">Response for question {index + 1}</Label>
              <Select
                value={responses[index] ?? ""}
                onValueChange={(v) => v && setResponse(index, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-teal hover:bg-teal-700"
        >
          {submitting ? "Submitting…" : "Submit questionnaire"}
        </Button>
        <Link
          href="/patient-portal/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
