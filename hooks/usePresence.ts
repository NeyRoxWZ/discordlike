'use client';

import { useEffect, useMemo, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useUserStore } from '@/store/useUserStore';
import type { UserStatus } from '@/types';

type PresencePayload = {
  userId: string;
  status: UserStatus;
};

type PresenceState = Record<string, PresencePayload[]>;

export function usePresence(serverId: string | null) {
  const me = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  const [state, setState] = useState<PresenceState>({});

  useEffect(() => {
    if (!serverId || !me) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`presence:${serverId}`, {
      config: {
        presence: { key: me.id }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setState(channel.presenceState() as PresenceState);
      })
      .on('presence', { event: 'join' }, () => {
        setState(channel.presenceState() as PresenceState);
      })
      .on('presence', { event: 'leave' }, () => {
        setState(channel.presenceState() as PresenceState);
      });

    channel.subscribe(async (subStatus) => {
      if (subStatus !== 'SUBSCRIBED') return;
      await channel.track({ userId: me.id, status } satisfies PresencePayload);
    });

    return () => {
      void supabase.removeChannel(channel);
      setState({});
    };
  }, [me, serverId, status]);

  const onlineUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const key of Object.keys(state)) {
      const entries = state[key] ?? [];
      for (const p of entries) {
        ids.add(p.userId);
      }
    }
    return ids;
  }, [state]);

  return { presenceState: state, onlineUserIds };
}

