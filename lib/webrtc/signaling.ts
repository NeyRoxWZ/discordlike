import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SignalMessage =
  | { type: 'offer'; fromUserId: string; toUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; fromUserId: string; toUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; fromUserId: string; toUserId: string; candidate: RTCIceCandidateInit }
  | { type: 'join'; fromUserId: string; userName: string }
  | { type: 'mute'; fromUserId: string; isMuted: boolean }
  | { type: 'leave'; fromUserId: string };

export function openSignalingChannel(
  channelId: string,
  onMessage: (msg: SignalMessage) => void
) {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`voice-channel-${channelId}`)
    .on('broadcast', { event: 'signal' }, ({ payload }) => {
      onMessage(payload as SignalMessage);
    })
    .subscribe();

  async function send(message: SignalMessage) {
    await channel.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  async function close() {
    await supabase.removeChannel(channel);
  }

  return { channel, send, close };
}
