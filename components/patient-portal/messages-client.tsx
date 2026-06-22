"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { PortalMessage } from "@/lib/patient-portal/types";
import { formatMessageTime } from "@/lib/patient-portal/utils";
import { cn } from "@/lib/utils";

const MESSAGE_TYPES = [
  { value: "general", label: "General Message" },
  { value: "refill", label: "Refill Request" },
  { value: "side_effect", label: "Side Effect Report" },
  { value: "urgent", label: "Urgent Concern" },
] as const;

type MessageType = (typeof MESSAGE_TYPES)[number]["value"];

function MessagesContent({
  initialMessages,
  patientId,
  providerId,
}: {
  initialMessages: PortalMessage[];
  patientId: string;
  providerId: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [messageType, setMessageType] = useState<MessageType>("general");
  const [content, setContent] = useState("");
  const [medication, setMedication] = useState("");
  const [daysRemaining, setDaysRemaining] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState("5");
  const [duration, setDuration] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!content.trim() && messageType === "general") {
      toast.error("Please enter a message.");
      return;
    }
    if (messageType === "refill" && !medication.trim()) {
      toast.error("Please enter the medication name.");
      return;
    }
    if (messageType === "side_effect" && !symptom.trim()) {
      toast.error("Please describe the symptom.");
      return;
    }
    if (!providerId) {
      toast.error(
        "No care provider is linked to your account yet. Ask the office to assign a provider, or complete scheduling first."
      );
      return;
    }

    setSending(true);
    try {
      const body =
        messageType === "refill"
          ? `Refill request: ${medication}. Days remaining: ${daysRemaining}. Pharmacy: ${pharmacy}. ${content}`
          : messageType === "side_effect"
            ? `Side effect report — ${medication}: ${symptom}. Severity ${severity}/10. Duration: ${duration}. ${content}`
            : content;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          provider_id: providerId,
          sender_type: "patient",
          content: body,
          urgent_concern: messageType === "urgent",
          severity:
            messageType === "side_effect" ? Number(severity) : undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error ?? "Failed to send message");
      }

      const saved = result.message as PortalMessage | undefined;
      const newMessage: PortalMessage = saved
        ? {
            id: saved.id,
            content: saved.content,
            sender_type: "patient",
            created_at: saved.created_at,
            message_type: (saved.message_type as string) ?? messageType,
            read_at: saved.read_at ?? null,
          }
        : {
            id: crypto.randomUUID(),
            content: body,
            sender_type: "patient",
            created_at: new Date().toISOString(),
            message_type: messageType,
            read_at: null,
          };

      setMessages((prev) => [...prev, newMessage]);
      setContent("");
      toast.success("Message sent securely to your care team.");

      if (messageType === "side_effect" && Number(severity) >= 8) {
        toast.info("Your provider has been alerted due to high severity.");
      }

      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Messages
        </h1>
        <p className="mt-1 text-navy/70">
          Secure clinical messaging with your care team
        </p>
      </div>

      <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-medium text-navy">Message type</p>
        <div className="flex flex-wrap gap-2">
          {MESSAGE_TYPES.map((type) => (
            <Button
              key={type.value}
              type="button"
              variant={messageType === type.value ? "default" : "outline"}
              size="sm"
              onClick={() => setMessageType(type.value)}
              className={
                messageType === type.value ? "bg-teal hover:bg-teal-700" : ""
              }
            >
              {type.label}
            </Button>
          ))}
        </div>

        {messageType === "urgent" && (
          <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              For emergencies call 911 or 988. Providers respond within 1
              business day. This is not a crisis service.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {messageType === "refill" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="medication">Medication name</Label>
                <Input
                  id="medication"
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="days">Days remaining</Label>
                  <Input
                    id="days"
                    value={daysRemaining}
                    onChange={(e) => setDaysRemaining(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pharmacy">Pharmacy name + location</Label>
                  <Input
                    id="pharmacy"
                    value={pharmacy}
                    onChange={(e) => setPharmacy(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {messageType === "side_effect" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="se-med">Medication</Label>
                <Input
                  id="se-med"
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptom">Symptom description</Label>
                <Textarea
                  id="symptom"
                  value={symptom}
                  onChange={(e) => setSymptom(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Severity (1–10)</Label>
                  <Select
                    value={severity}
                    onValueChange={(v) => v && setSeverity(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3 days"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">
              {messageType === "general" ? "Message" : "Additional notes"}
            </Label>
            <Textarea
              id="message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Write your message…"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-teal hover:bg-teal-700"
          >
            <Send className="size-4" />
            {sending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-medium text-navy">Thread</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-navy/60">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  msg.sender_type === "provider"
                    ? "mr-auto bg-teal text-white"
                    : "ml-auto bg-navy text-white"
                )}
              >
                <p>{msg.content}</p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    msg.sender_type === "provider"
                      ? "text-white/70"
                      : "text-white/60"
                  )}
                >
                  {formatMessageTime(msg.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-navy/60">
        This is secure clinical messaging. For emergencies call 988 or 911.
      </p>
    </div>
  );
}

export function MessagesPageClient({
  initialMessages,
  patientId,
  providerId,
}: {
  initialMessages: PortalMessage[];
  patientId: string;
  providerId: string | null;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-navy/60">Loading…</div>}>
      <MessagesContent
        initialMessages={initialMessages}
        patientId={patientId}
        providerId={providerId}
      />
    </Suspense>
  );
}

export function MessagePreview({
  message,
}: {
  message: PortalMessage;
}) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="line-clamp-2 text-sm text-navy/80">{message.content}</p>
      <p className="mt-2 text-xs text-navy/50">
        {formatMessageTime(message.created_at)}
      </p>
    </div>
  );
}
