'use client';

import { useEffect } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Options<TPayload> {
  channelName: string;
  event: string;
  onPayload: (payload: TPayload) => void;
}

export function useSupabaseBroadcast<TPayload>({ channelName, event, onPayload }: Options<TPayload>) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event }, ({ payload }) => onPayload(payload as TPayload))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, event, onPayload]);
}
