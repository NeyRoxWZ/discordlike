'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseBroadcast } from '@/hooks/useSupabaseRealtime';

export interface MessageAuthor {
  id: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}

export interface MessageDTO {
  id: string;
  content: string | null;
  createdAt: string;
  author: MessageAuthor | null;
  attachments?: MessageAttachment[];
}

type ThreadRef = { type: 'channel'; id: string } | { type: 'dm'; id: string };

function buildChannelName(thread: ThreadRef) {
  return thread.type === 'channel' ? `channel:${thread.id}` : `dm:${thread.id}`;
}

async function fetchMessages(thread: ThreadRef): Promise<MessageDTO[]> {
  const qs =
    thread.type === 'channel'
      ? `channelId=${encodeURIComponent(thread.id)}`
      : `dmConversationId=${encodeURIComponent(thread.id)}`;
  const res = await fetch(`/api/messages?${qs}`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('messages' in json)) return [];
  const { messages } = json as {
    messages: Array<{
      id: string;
      content: string | null;
      createdAt: string;
      author: MessageAuthor | null;
      attachments?: MessageAttachment[];
    }>;
  };
  return messages;
}

export function useMessages(thread: ThreadRef | null) {
  const queryClient = useQueryClient();
  const channelName = useMemo(() => (thread ? buildChannelName(thread) : ''), [thread]);
  const cacheKey = useMemo(() => ['messages', thread?.type, thread?.id], [thread]);

  const query = useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchMessages(thread as ThreadRef),
    enabled: Boolean(thread)
  });

  const onNewMessage = useCallback(
    (message: MessageDTO) => {
      queryClient.setQueryData<MessageDTO[]>(cacheKey, (prev) => {
        const current = prev ?? [];
        if (current.some((m) => m.id === message.id)) return current;
        return [...current, message];
      });
    },
    [cacheKey, queryClient]
  );

  useSupabaseBroadcast<MessageDTO>({
    channelName,
    event: 'new_message',
    onPayload: onNewMessage
  });

  const sendMutation = useMutation({
    mutationFn: async (input: { content: string; attachments?: Omit<MessageAttachment, 'id'>[] }) => {
      if (!thread) throw new Error('Missing thread');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:
          thread.type === 'channel'
            ? JSON.stringify({ channelId: thread.id, content: input.content, attachments: input.attachments })
            : JSON.stringify({ dmConversationId: thread.id, content: input.content, attachments: input.attachments })
      });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('message' in json)) throw new Error('Send failed');
      const { message } = json as { message: MessageDTO };
      return message;
    },
    onSuccess: async (message) => {
      onNewMessage(message);
      const supabase = getSupabaseBrowserClient();
      await supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'new_message',
        payload: message
      });
    }
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    sendMessage: async (content: string, attachments?: Omit<MessageAttachment, 'id'>[]) =>
      sendMutation.mutateAsync({ content, attachments }),
    isSending: sendMutation.isPending
  };
}
