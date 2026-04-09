import { create } from 'zustand';

import type { ServerSummary } from '@/types';

interface ServerStore {
  servers: ServerSummary[];
  activeServerId: string | null;
  activeChannelId: string | null;
  setServers: (servers: ServerSummary[]) => void;
  setActiveServer: (id: string | null) => void;
  setActiveChannel: (id: string | null) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  activeServerId: null,
  activeChannelId: null,
  setServers: (servers) => set({ servers }),
  setActiveServer: (id) => set({ activeServerId: id }),
  setActiveChannel: (id) => set({ activeChannelId: id })
}));
