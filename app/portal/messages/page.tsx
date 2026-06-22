import { ProviderMessagesClient } from "@/components/portal/messages-client";
import { requirePortalProvider } from "@/lib/portal/auth";
import { fetchProviderMessages } from "@/lib/portal/data";

export default async function PortalMessagesPage() {
  const { provider } = await requirePortalProvider();
  const { messages } = await fetchProviderMessages(provider.id);

  return (
    <ProviderMessagesClient
      messages={messages as Array<{
        id: string;
        content: string;
        sender_type: string;
        created_at: string;
        read_at: string | null;
        conversation_id?: string;
      }>}
      providerId={provider.id}
    />
  );
}
