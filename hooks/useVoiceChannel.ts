'use client';

/**
 * useVoiceChannel — WebRTC P2P via Supabase Realtime Signaling
 *
 * Architecture : mesh P2P (chaque pair se connecte à chaque autre pair)
 * Optimal pour : 2 à ~6 utilisateurs simultanés dans un salon
 * Au-delà de 6 : prévoir un SFU (ex: LiveKit self-hosted ou Mediasoup)
 * Signaling : Supabase Realtime Broadcast (gratuit, sans VPS)
 * STUN : serveurs Google (gratuits, sans inscription)
 */

import { useCallback, useRef, useState } from 'react';

import { openSignalingChannel, type SignalMessage } from '@/lib/webrtc/signaling';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type RemoteParticipant = {
  stream: MediaStream;
  userName: string;
  isMuted: boolean;
  isSpeaking: boolean;
  volume: number;
};

export function useVoiceChannel() {
  const supabase = getSupabaseBrowserClient();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(
    () => new Map()
  );
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const connsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof openSignalingChannel> | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const myUserNameRef = useRef<string>('user');
  const channelIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<{ analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>(null);
  const peerAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastSpeakingRef = useRef<Map<string, boolean>>(new Map());
  const lastLocalSpeakingRef = useRef(false);

  const startAnalyserLoop = useCallback(() => {
    if (rafRef.current) return;
    const tick = () => {
      const local = analyserRef.current;
      if (local) {
        local.analyser.getByteTimeDomainData(local.data);
        let sum = 0;
        for (let i = 0; i < local.data.length; i++) {
          const v = (local.data[i] ?? 128) - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / local.data.length) / 128;
        const speaking = rms > 0.08;
        if (speaking !== lastLocalSpeakingRef.current) {
          lastLocalSpeakingRef.current = speaking;
          setLocalIsSpeaking(speaking);
        }
      }

      for (const [peerId, a] of peerAnalysersRef.current.entries()) {
        a.analyser.getByteTimeDomainData(a.data);
        let sum = 0;
        for (let i = 0; i < a.data.length; i++) {
          const v = (a.data[i] ?? 128) - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / a.data.length) / 128;
        const speaking = rms > 0.08;
        const prev = lastSpeakingRef.current.get(peerId) ?? false;
        if (speaking !== prev) {
          lastSpeakingRef.current.set(peerId, speaking);
          setRemoteParticipants((prevMap) => {
            const next = new Map(prevMap);
            const existing = next.get(peerId);
            if (existing) next.set(peerId, { ...existing, isSpeaking: speaking });
            return next;
          });
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const stopAnalyserLoop = useCallback(() => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastSpeakingRef.current.clear();
    lastLocalSpeakingRef.current = false;
    setLocalIsSpeaking(false);
  }, []);

  const setupPeerConnection = useCallback(
    (peerUserId: string) => {
      if (connsRef.current.get(peerUserId)) return connsRef.current.get(peerUserId)!;
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current && myUserIdRef.current) {
          void channelRef.current.send({
            type: 'ice',
            fromUserId: myUserIdRef.current,
            toUserId: peerUserId,
            candidate: e.candidate.toJSON()
          });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;
        if (audioCtxRef.current && !peerAnalysersRef.current.get(peerUserId)) {
          const src = audioCtxRef.current.createMediaStreamSource(stream);
          const analyser = audioCtxRef.current.createAnalyser();
          analyser.fftSize = 2048;
          const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
          src.connect(analyser);
          peerAnalysersRef.current.set(peerUserId, { analyser, data });
        }
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerUserId);
          next.set(peerUserId, {
            stream,
            userName: existing?.userName ?? peerUserId,
            isMuted: existing?.isMuted ?? false,
            isSpeaking: existing?.isSpeaking ?? false,
            volume: existing?.volume ?? 1
          });
          return next;
        });
      };
      const localStream = localStreamRef.current;
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      }
      connsRef.current.set(peerUserId, pc);
      return pc;
    },
    []
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (!myUserIdRef.current) return;
      if (msg.type === 'join') {
        if (msg.fromUserId === myUserIdRef.current) return;
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          if (!next.get(msg.fromUserId)) {
            next.set(msg.fromUserId, {
              stream: new MediaStream(),
              userName: msg.userName,
              isMuted: false,
              isSpeaking: false,
              volume: 1
            });
          } else {
            const existing = next.get(msg.fromUserId)!;
            next.set(msg.fromUserId, { ...existing, userName: msg.userName });
          }
          return next;
        });
        const pc = setupPeerConnection(msg.fromUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (channelRef.current) {
          await channelRef.current.send({
            type: 'offer',
            fromUserId: myUserIdRef.current,
            toUserId: msg.fromUserId,
            sdp: offer
          });
        }
      } else if (msg.type === 'offer') {
        if (msg.toUserId !== myUserIdRef.current) return;
        const pc = setupPeerConnection(msg.fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (channelRef.current) {
          await channelRef.current.send({
            type: 'answer',
            fromUserId: myUserIdRef.current,
            toUserId: msg.fromUserId,
            sdp: answer
          });
        }
      } else if (msg.type === 'answer') {
        if (msg.toUserId !== myUserIdRef.current) return;
        const pc = connsRef.current.get(msg.fromUserId);
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === 'ice') {
        if (msg.toUserId !== myUserIdRef.current) return;
        const pc = connsRef.current.get(msg.fromUserId);
        if (!pc) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {}
      } else if (msg.type === 'leave') {
        const pc = connsRef.current.get(msg.fromUserId);
        if (pc) {
          pc.close();
          connsRef.current.delete(msg.fromUserId);
        }
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          next.delete(msg.fromUserId);
          return next;
        });
        peerAnalysersRef.current.delete(msg.fromUserId);
        lastSpeakingRef.current.delete(msg.fromUserId);
      } else if (msg.type === 'mute') {
        if (msg.fromUserId === myUserIdRef.current) return;
        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(msg.fromUserId);
          if (!existing) return next;
          next.set(msg.fromUserId, { ...existing, isMuted: msg.isMuted });
          return next;
        });
      }
    },
    [setupPeerConnection]
  );

  const joinChannel = useCallback(
    async (channelId: string) => {
      if (channelRef.current) return;
      setIsConnecting(true);

      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          throw new Error('Unauthorized');
        }
        myUserIdRef.current = data.user.id;
        myUserNameRef.current =
          (typeof data.user.user_metadata?.username === 'string' && data.user.user_metadata.username) ||
          data.user.email?.split('@')[0] ||
          data.user.id.slice(0, 6);

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          throw new Error('Microphone refusé ou indisponible');
        }
        localStreamRef.current = stream;
        const [audioTrack] = stream.getAudioTracks();
        localAudioTrackRef.current = audioTrack ?? null;

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const audioCtx = audioCtxRef.current;
        if (audioCtx && localStreamRef.current) {
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume().catch(() => {});
          }
          const src = audioCtx.createMediaStreamSource(localStreamRef.current);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
          src.connect(analyser);
          analyserRef.current = { analyser, data };
          startAnalyserLoop();
        }

        channelIdRef.current = channelId;
        channelRef.current = openSignalingChannel(channelId, handleSignal);
        await channelRef.current.ready;
        await channelRef.current.send({
          type: 'join',
          fromUserId: myUserIdRef.current,
          userName: myUserNameRef.current
        });
        await channelRef.current.send({ type: 'mute', fromUserId: myUserIdRef.current, isMuted });
        setIsConnected(true);
      } catch (e) {
        const stream = localStreamRef.current;
        if (stream) {
          for (const track of stream.getTracks()) track.stop();
        }
        localStreamRef.current = null;
        localAudioTrackRef.current = null;
        analyserRef.current = null;
        stopAnalyserLoop();
        if (channelRef.current) {
          await channelRef.current.close().catch(() => {});
        }
        channelRef.current = null;
        channelIdRef.current = null;
        setIsConnected(false);
        throw e;
      } finally {
        setIsConnecting(false);
      }
    },
    [handleSignal, isMuted, startAnalyserLoop, stopAnalyserLoop, supabase.auth]
  );

  const leaveChannel = useCallback(async () => {
    if (!channelRef.current || !myUserIdRef.current) return;
    await channelRef.current.send({ type: 'leave', fromUserId: myUserIdRef.current }).catch(() => {});
    for (const pc of connsRef.current.values()) {
      pc.close();
    }
    connsRef.current.clear();
    setRemoteParticipants(new Map());
    peerAnalysersRef.current.clear();
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    localStreamRef.current = null;
    localAudioTrackRef.current = null;
    analyserRef.current = null;
    stopAnalyserLoop();
    await channelRef.current.close();
    channelRef.current = null;
    channelIdRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, [stopAnalyserLoop]);

  const setLocalAudioEnabled = useCallback((enabled: boolean) => {
    const t = localAudioTrackRef.current;
    if (!t) return;
    t.enabled = enabled;
    setIsMuted(!enabled);
    if (channelRef.current && myUserIdRef.current) {
      void channelRef.current.send({ type: 'mute', fromUserId: myUserIdRef.current, isMuted: !enabled });
    }
  }, []);

  const toggleMute = useCallback(() => {
    const t = localAudioTrackRef.current;
    if (!t) return;
    t.enabled = !t.enabled;
    setIsMuted(!t.enabled);
    if (channelRef.current && myUserIdRef.current) {
      void channelRef.current.send({ type: 'mute', fromUserId: myUserIdRef.current, isMuted: !t.enabled });
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((v) => !v);
  }, []);

  const setRemoteVolume = useCallback((userId: string, volume: number) => {
    const v = Math.min(Math.max(volume, 0), 1);
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId);
      if (!existing) return next;
      next.set(userId, { ...existing, volume: v });
      return next;
    });
  }, []);

  const toggleRemoteMute = useCallback((userId: string) => {
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId);
      if (!existing) return next;
      next.set(userId, { ...existing, isMuted: !existing.isMuted });
      return next;
    });
  }, []);

  return {
    localAudioTrack: localAudioTrackRef.current,
    remoteParticipants,
    isMuted,
    isDeafened,
    localIsSpeaking,
    isConnected,
    isConnecting,
    joinChannel,
    leaveChannel,
    setLocalAudioEnabled,
    toggleMute,
    toggleDeafen,
    setRemoteVolume,
    toggleRemoteMute
  };
}
