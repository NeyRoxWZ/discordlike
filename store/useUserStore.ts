import { create } from 'zustand';

import type { User, UserStatus } from '@/types';

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  status: UserStatus;
  setStatus: (status: UserStatus) => void;
  customStatus: string | null;
  setCustomStatus: (s: string | null) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  status: 'OFFLINE',
  setStatus: (status) => set({ status }),
  customStatus: null,
  setCustomStatus: (customStatus) => set({ customStatus })
}));
