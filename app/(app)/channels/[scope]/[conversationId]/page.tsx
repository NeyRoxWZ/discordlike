'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MessageInput } from '@/components/channels/MessageInput';
import { MessageList } from '@/components/channels/MessageList';
import { TypingIndicator } from '@/components/channels/TypingIndicator';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useUserStore } from '@/store/useUserStore';

interface Props {
  params: { scope: string; conversationId: string };
}

type Conversation = {
  id: string;
  isGroupDM: boolean;
  groupName: string | null;
  groupIconUrl: string | null;
  participants: Array<{ user: { id: string; username: string; discriminator: string } }>;
};

async function fetchConversation(conversationId: string): Promise<Conversation | null> {
  const res = await fetch(`/api/dms/${conversationId}`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('conversation' in json)) return null;
  return (json as { conversation: Conversation }).conversation;
}

export default function ConversationPage({ params }: Props) {
  const router = useRouter();
  const me = useUserStore((s) => s.user);

  useEffect(() => {
    if (params.scope !== '@me') router.replace('/channels/@me');
  }, [params.scope, router]);

  useEffect(() => {
    if (params.scope !== '@me') return;
    void fetch(`/api/dms/${params.conversationId}/read`, { method: 'POST' });
  }, [params.conversationId, params.scope]);

  const convoQuery = useQuery({
    queryKey: ['dm', params.conversationId],
    queryFn: () => fetchConversation(params.conversationId),
    enabled: params.scope === '@me'
  });

  const title = useMemo(() => {
    const c = convoQuery.data;
    if (!c) return 'DM';
    if (c.isGroupDM && c.groupName) return c.groupName;
    const others = c.participants.map((p) => p.user).filter((u) => u.id !== me?.id);
    if (!others.length) return 'DM';
    return others.map((u) => `${u.username}#${u.discriminator}`).join(', ');
  }, [convoQuery.data, me?.id]);

  const { messages, sendMessage } = useMessages({ type: 'dm', id: params.conversationId });
  const { typingNames, notifyTyping } = useTypingIndicator({ type: 'dm', id: params.conversationId });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 items-center justify-between border-b border-separator px-4">
        <div className="truncate text-sm font-semibold text-text-primary">{title}</div>
        <div />
      </div>
      <MessageList messages={messages} />
      <TypingIndicator names={typingNames} />
      <MessageInput
        placeholder={`Envoyer un message à ${title}`}
        disabled={!params.conversationId}
        onSend={sendMessage}
        onSendWithAttachments={sendMessage}
        onTyping={notifyTyping}
      />
    </div>
  );
}
