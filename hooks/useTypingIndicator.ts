'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/useUserStore';

type ThreadRef = { type: 'channel'; id: string } | { type: 'dm'; id: string };

type TypingPayload = {
  userId: string;
  userName: string;
  threadType: ThreadRef['type'];
  threadId: string;
};

function channelName(thread: ThreadRef) {
  return thread.type === 'channel' ? `channel:${thread.id}` : `dm:${thread.id}`;
}

export function useTypingIndicator(thread: ThreadRef | null) {
  const me = useUserStore((s) => s.user);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [typing, setTyping] = useState<Map<string, string>>(() => new Map());
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const lastSentAtRef = useRef(0);

  const name = me ? `${me.username}#${me.discriminator}` : null;
  const myId = me?.id ?? null;

  useEffect(() => {
    if (!thread) return;
    const ch = supabase
      .channel(channelName(thread))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as TypingPayload;
        if (!myId || p.userId === myId) return;
        if (p.threadId !== thread.id || p.threadType !== thread.type) return;

        setTyping((prev) => {
          const next = new Map(prev);
          next.set(p.userId, p.userName);
          return next;
        });

        const existing = timeoutsRef.current.get(p.userId);
        if (existing) window.clearTimeout(existing);
        const t = window.setTimeout(() => {
          setTyping((prev) => {
            const next = new Map(prev);
            next.delete(p.userId);
            return next;
          });
          timeoutsRef.current.delete(p.userId);
        }, 2500);
        timeoutsRef.current.set(p.userId, t);
      })
      .subscribe();

    return () => {
      for (const t of timeoutsRef.current.values()) window.clearTimeout(t);
      timeoutsRef.current.clear();
      setTyping(new Map());
      void supabase.removeChannel(ch);
    };
  }, [myId, supabase, thread]);

  const notifyTyping = useCallback(async () => {
    if (!thread || !myId || !name) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < 300) return;
    lastSentAtRef.current = now;

    await supabase.channel(channelName(thread)).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: myId, userName: name, threadType: thread.type, threadId: thread.id } satisfies TypingPayload
    });
  }, [myId, name, supabase, thread]);

  const names = useMemo(() => Array.from(typing.values()).slice(0, 3), [typing]);

  return { typingNames: names, notifyTyping };
}

