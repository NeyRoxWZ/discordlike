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
  const channel = supabase.channel(`voice-channel-${channelId}`).on('broadcast', { event: 'signal' }, ({ payload }) => {
    onMessage(payload as SignalMessage);
  });

  let done = false;
  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (done) return;
      if (status === 'SUBSCRIBED') {
        done = true;
        resolve();
      } else if (status === 'CHANNEL_ERROR') {
        done = true;
        reject(new Error('Realtime indisponible'));
      } else if (status === 'TIMED_OUT') {
        done = true;
        reject(new Error('Realtime timeout'));
      }
    });
  });

  async function send(message: SignalMessage) {
    await ready;
    const res = await channel.send({ type: 'broadcast', event: 'signal', payload: message });
    if (res !== 'ok') throw new Error('Signal send failed');
  }

  async function close() {
    await supabase.removeChannel(channel);
  }

  return { channel, ready, send, close };
}
