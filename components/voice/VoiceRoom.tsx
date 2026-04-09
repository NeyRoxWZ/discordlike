'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';

interface Props {
  channelId: string;
}

export function VoiceRoom({ channelId }: Props) {
  const {
    remoteParticipants,
    isMuted,
    isDeafened,
    localIsSpeaking,
    isConnected,
    isConnecting,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    setLocalAudioEnabled,
    setRemoteVolume,
    toggleRemoteMute
  } = useVoiceChannel();

  const [joinError, setJoinError] = useState<string | null>(null);
  const [pushToTalk, setPushToTalk] = useState(false);

  useEffect(() => {
    return () => {
      void leaveChannel();
    };
  }, [leaveChannel]);

  useEffect(() => {
    if (!isConnected || !pushToTalk) return;
    setLocalAudioEnabled(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      setLocalAudioEnabled(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setLocalAudioEnabled(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      setLocalAudioEnabled(false);
    };
  }, [isConnected, pushToTalk, setLocalAudioEnabled]);

  const participants = useMemo(() => Array.from(remoteParticipants.entries()), [remoteParticipants]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <Button
            variant="primary"
            size="sm"
            disabled={isConnecting}
            onClick={async () => {
              setJoinError(null);
              try {
                await joinChannel(channelId);
              } catch (e) {
                setJoinError(e instanceof Error ? e.message : 'Impossible de rejoindre');
              }
            }}
          >
            {isConnecting ? 'Connexion...' : 'Rejoindre'}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (pushToTalk) setPushToTalk(false);
                toggleMute();
              }}
            >
              {isMuted ? 'Réactiver micro' : 'Couper micro'}
            </Button>
            <Button variant="secondary" size="sm" onClick={toggleDeafen}>
              {isDeafened ? 'Réactiver son' : 'Sourdine'}
            </Button>
            <Button
              variant={pushToTalk ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                const next = !pushToTalk;
                setPushToTalk(next);
                if (!next) return;
                setLocalAudioEnabled(false);
              }}
            >
              Push-to-talk
            </Button>
            <Button variant="danger" size="sm" onClick={leaveChannel}>
              Quitter
            </Button>
          </>
        )}
      </div>

      <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !joinError && 'hidden')}>
        {joinError}
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Participants ({participants.length + (isConnected ? 1 : 0)})
        </div>
        <div className="flex flex-col gap-1">
          {isConnected ? (
            <div className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-text-primary">
              <span className="truncate">Vous</span>
              <span className="text-xs text-text-muted">
                {pushToTalk ? 'PTT' : isMuted ? 'Muted' : localIsSpeaking ? 'Parle' : 'Live'}
              </span>
            </div>
          ) : null}
          {participants.map(([id, p]) => (
            <div key={id} className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-text-primary">
              <span className="truncate">{p.userName}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{p.isMuted ? 'Muted' : p.isSpeaking ? 'Parle' : 'Live'}</span>
                <input
                  aria-label="Volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={p.volume}
                  onChange={(e) => setRemoteVolume(id, Number(e.target.value))}
                />
                <button
                  className="rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                  onClick={() => toggleRemoteMute(id)}
                >
                  {p.isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden">
        {participants.map(([id, p]) => (
          <audio
            key={id}
            ref={(el) => {
              if (!el) return;
              el.srcObject = p.stream;
              el.muted = isDeafened || p.isMuted;
              el.volume = p.volume;
              el.autoplay = true;
              void el.play().catch(() => {});
            }}
          />
        ))}
      </div>
    </div>
  );
}
