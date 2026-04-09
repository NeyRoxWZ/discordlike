import { create } from 'zustand';

import type { VoiceParticipant } from '@/types';

interface VoiceStore {
  activeRoomId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  participants: VoiceParticipant[];
  join: (roomId: string) => void;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  activeRoomId: null,
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  participants: [],
  join: (roomId) => set({ activeRoomId: roomId }),
  leave: () =>
    set({
      activeRoomId: null,
      participants: [],
      isMuted: false,
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false
    }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleDeafen: () => set((s) => ({ isDeafened: !s.isDeafened }))
}));
