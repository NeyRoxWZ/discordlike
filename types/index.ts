export type UserStatus = 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'INVISIBLE' | 'OFFLINE';

export interface User {
  id: string;
  supabaseId: string;
  username: string;
  discriminator: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  profileColor?: string | null;
  profileEffect?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  status: UserStatus;
  customStatus: string | null;
  statusEmoji: string | null;
}

export interface ServerSummary {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface VoiceParticipant {
  id: string;
  name: string;
  isSpeaking: boolean;
}
