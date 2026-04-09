'use client';

import type { MessageDTO } from '@/hooks/useMessages';
import { MessageItem } from '@/components/channels/MessageItem';

interface Props {
  messages: MessageDTO[];
}

export function MessageList({ messages }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2">
      {messages.map((m) => (
        <MessageItem key={m.id} message={m} />
      ))}
    </div>
  );
}
