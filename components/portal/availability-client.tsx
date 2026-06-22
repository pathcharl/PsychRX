"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import type { AvailabilityDay } from "@/lib/portal/types";
import { DAY_NAMES } from "@/lib/portal/utils";

interface AvailabilityClientProps {
  providerId: string;
  initialDays: AvailabilityDay[];
  initialBlockedDates: { blocked_date: string; reason: string | null }[];
  acceptsNewPatients: boolean;
}

export function AvailabilityClient({
  providerId,
  initialDays,
  initialBlockedDates,
  acceptsNewPatients: initialAccepts,
}: AvailabilityClientProps) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [acceptsNewPatients, setAcceptsNewPatients] = useState(initialAccepts);
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [vacationInput, setVacationInput] = useState("");
  const [blockedDates, setBlockedDates] = useState(initialBlockedDates);
  const [saving, setSaving] = useState(false);

  function updateDay(dow: number, patch: Partial<AvailabilityDay>) {
    setDays((prev) =>
      prev.map((d) => (d.day_of_week === dow ? { ...d, ...patch } : d))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          days,
          accepts_new_patients: acceptsNewPatients,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      toast.success(`Availability saved. ${data.slots_generated ?? 0} slots generated.`);
      router.refresh();
    } catch {
      toast.error("Could not save availability.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlockDate() {
    if (!blockDate) {
      toast.error("Select a date to block.");
      return;
    }
    try {
      const dateStr = blockDate.toISOString().split("T")[0];
      const res = await fetch("/api/portal/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          blocked_date: dateStr,
          reason: blockReason,
        }),
      });
      if (!res.ok) throw new Error("Block failed");
      setBlockedDates((prev) => [
        ...prev,
        { blocked_date: dateStr, reason: blockReason },
      ]);
      setBlockDate(undefined);
      setBlockReason("");
      toast.success("Date blocked.");
    } catch {
      toast.error("Could not block date.");
    }
  }

  async function handleVacation() {
    if (!vacationInput.trim()) {
      toast.error('Enter vacation in format: "VACATION Dec 20 to Jan 3"');
      return;
    }
    try {
      const res = await fetch("/api/portal/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          vacation_command: vacationInput.trim(),
        }),
      });
      if (!res.ok) throw new Error("Vacation failed");
      toast.success("Vacation request submitted.");
      setVacationInput("");
    } catch {
      toast.error("Could not submit vacation request.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Availability
        </h1>
        <p className="mt-1 text-navy/70">
          Set your weekly schedule — slots generate for the next 60 days
        </p>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg text-navy">
            Weekly Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="new-patients" className="text-sm text-navy/70">
              Accept new patients
            </Label>
            <Switch
              id="new-patients"
              checked={acceptsNewPatients}
              onCheckedChange={setAcceptsNewPatients}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {days.map((day) => (
            <div
              key={day.day_of_week}
              className="rounded-lg border border-navy/10 p-4"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex w-24 items-center gap-2">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) =>
                      updateDay(day.day_of_week, { enabled })
                    }
                  />
                  <span className="font-medium text-navy">
                    {DAY_NAMES[day.day_of_week]}
                  </span>
                </div>
                {day.enabled && (
                  <>
                    <div>
                      <Label className="text-xs text-navy/60">Start</Label>
                      <Input
                        type="time"
                        value={day.start_time}
                        onChange={(e) =>
                          updateDay(day.day_of_week, {
                            start_time: e.target.value,
                          })
                        }
                        className="w-32"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-navy/60">End</Label>
                      <Input
                        type="time"
                        value={day.end_time}
                        onChange={(e) =>
                          updateDay(day.day_of_week, {
                            end_time: e.target.value,
                          })
                        }
                        className="w-32"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-navy/60">Duration (min)</Label>
                      <Input
                        type="number"
                        value={day.slot_duration_minutes}
                        onChange={(e) =>
                          updateDay(day.day_of_week, {
                            slot_duration_minutes: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-navy/60">Buffer (min)</Label>
                      <Input
                        type="number"
                        value={day.buffer_minutes}
                        onChange={(e) =>
                          updateDay(day.day_of_week, {
                            buffer_minutes: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-navy/60">Max sessions</Label>
                      <Input
                        type="number"
                        value={day.max_sessions}
                        onChange={(e) =>
                          updateDay(day.day_of_week, {
                            max_sessions: Number(e.target.value),
                          })
                        }
                        className="w-20"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <Button
            className="gap-2 bg-teal hover:bg-teal-700"
            disabled={saving}
            onClick={handleSave}
          >
            <Save className="size-4" />
            {saving ? "Saving..." : "Save & Generate Slots"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Block Specific Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={blockDate}
              onSelect={setBlockDate}
              disabled={(date) => date < new Date()}
            />
            <div>
              <Label>Reason</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Personal, conference, etc."
                className="mt-1"
              />
            </div>
            <Button variant="outline" onClick={handleBlockDate}>
              Block Date
            </Button>
            {blockedDates.length > 0 && (
              <ul className="space-y-1 text-sm text-navy/70">
                {blockedDates.map((b) => (
                  <li key={b.blocked_date}>
                    {b.blocked_date}
                    {b.reason ? ` — ${b.reason}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
              <CalendarIcon className="size-5" /> Vacation Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-navy/60">
              Format: VACATION Dec 20 to Jan 3
            </p>
            <Input
              value={vacationInput}
              onChange={(e) => setVacationInput(e.target.value)}
              placeholder="VACATION Dec 20 to Jan 3"
            />
            <Button
              className="bg-teal hover:bg-teal-700"
              onClick={handleVacation}
            >
              Submit Vacation Request
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
