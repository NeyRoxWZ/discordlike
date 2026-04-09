import { create } from 'zustand';

interface UIStore {
  theme: 'dark' | 'light';
  memberSidebarOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  serverSettingsOpen: boolean;
  serverSettingsTab: string;
  serverSettingsServerId: string | null;
  activeModal: string | null;
  modalProps: Record<string, unknown>;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleMemberSidebar: () => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openServerSettings: (serverId: string, tab?: string) => void;
  closeServerSettings: () => void;
  openModal: (modal: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  memberSidebarOpen: true,
  settingsOpen: false,
  settingsTab: 'account',
  serverSettingsOpen: false,
  serverSettingsTab: 'overview',
  serverSettingsServerId: null,
  activeModal: null,
  modalProps: {},
  setTheme: (theme) => set({ theme }),
  toggleMemberSidebar: () => set((s) => ({ memberSidebarOpen: !s.memberSidebarOpen })),
  openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab ?? 'account' }),
  closeSettings: () => set({ settingsOpen: false }),
  openServerSettings: (serverId, tab) =>
    set({ serverSettingsOpen: true, serverSettingsServerId: serverId, serverSettingsTab: tab ?? 'overview' }),
  closeServerSettings: () => set({ serverSettingsOpen: false, serverSettingsServerId: null }),
  openModal: (modal, props) => set({ activeModal: modal, modalProps: props ?? {} }),
  closeModal: () => set({ activeModal: null, modalProps: {} })
}));
