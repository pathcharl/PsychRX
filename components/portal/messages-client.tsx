"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/portal/utils";

interface MessageRow {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
  read_at: string | null;
  conversation_id?: string;
}

interface ProviderMessagesClientProps {
  messages: MessageRow[];
  providerId: string;
}

export function ProviderMessagesClient({
  messages: initialMessages,
  providerId,
}: ProviderMessagesClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!content.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, content }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: data.message?.id ?? crypto.randomUUID(),
          content,
          sender_type: "provider",
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ]);
      setContent("");
      toast.success("Message sent.");
      router.refresh();
    } catch {
      toast.error("Could not send message.");
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
        <p className="mt-1 text-navy/70">Secure patient communications</p>
      </div>

      <div className="min-h-[300px] space-y-3 rounded-xl border border-navy/10 bg-white p-4">
        {messages.length === 0 ? (
          <p className="text-center text-navy/60">No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.sender_type === "provider"
                  ? "ml-auto bg-teal/10 text-navy"
                  : "bg-navy/5 text-navy"
              }`}
            >
              <p>{msg.content}</p>
              <p className="mt-1 text-xs text-navy/50">
                {formatDate(msg.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          rows={3}
        />
        <Button
          className="gap-2 bg-teal hover:bg-teal-700"
          disabled={sending}
          onClick={handleSend}
        >
          <Send className="size-4" />
          {sending ? "Sending..." : "Send Message"}
        </Button>
      </div>
    </div>
  );
}
