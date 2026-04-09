'use client';

import { MagnifyingGlass, PushPin, SpeakerHigh, Users } from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MessageInput } from '@/components/channels/MessageInput';
import { MessageList } from '@/components/channels/MessageList';
import { TypingIndicator } from '@/components/channels/TypingIndicator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VoiceRoom } from '@/components/voice/VoiceRoom';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useServerStore } from '@/store/useServerStore';
import { useUIStore } from '@/store/useUIStore';

interface Channel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'STAGE' | 'FORUM';
}

async function fetchChannel(serverId: string, channelId: string): Promise<Channel | null> {
  const res = await fetch(`/api/servers/${serverId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { channels: Channel[] };
  return json.channels.find((c) => c.id === channelId) ?? null;
}

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = typeof params?.serverId === 'string' ? params.serverId : '';
  const channelId = typeof params?.channelId === 'string' ? params.channelId : '';

  const setActiveChannel = useServerStore((s) => s.setActiveChannel);
  const toggleMemberSidebar = useUIStore((s) => s.toggleMemberSidebar);

  const channelQuery = useQuery({
    queryKey: ['channel', serverId, channelId],
    queryFn: () => fetchChannel(serverId, channelId),
    enabled: Boolean(serverId && channelId)
  });

  useEffect(() => {
    setActiveChannel(channelId || null);
    return () => setActiveChannel(null);
  }, [channelId, setActiveChannel]);

  const { messages, sendMessage } = useMessages(channelId ? { type: 'channel', id: channelId } : null);
  const { typingNames, notifyTyping } = useTypingIndicator(channelId ? { type: 'channel', id: channelId } : null);
  const placeholder = channelQuery.data ? `Écrire dans #${channelQuery.data.name}` : 'Écrire un message';
  const isVoice = channelQuery.data?.type === 'VOICE';
  const [pinsOpen, setPinsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pinsQuery = useQuery({
    queryKey: ['pins', channelId],
    queryFn: async () => {
      const res = await fetch(`/api/messages/pins?channelId=${encodeURIComponent(channelId)}`, { cache: 'no-store' });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('messages' in json)) return [];
      return (json as { messages: typeof messages }).messages;
    },
    enabled: Boolean(channelId && pinsOpen && !isVoice)
  });

  const searchResultsQuery = useQuery({
    queryKey: ['search', serverId, searchQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/messages/search?serverId=${encodeURIComponent(serverId)}&q=${encodeURIComponent(searchQuery)}&limit=20`,
        { cache: 'no-store' }
      );
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('results' in json)) return [];
      return (json as { results: Array<{ id: string; content: string | null; author: string | null; channel: { id: string; name: string } | null }> })
        .results;
    },
    enabled: Boolean(searchOpen && serverId && searchQuery.trim().length >= 2)
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 items-center justify-between border-b border-separator px-4">
        <div className="flex min-w-0 items-center gap-2">
          {isVoice ? <SpeakerHigh size={18} /> : <span className="text-text-secondary">#</span>}
          <div className="min-w-0 truncate text-sm font-semibold text-text-primary">
            {channelQuery.data ? channelQuery.data.name : 'salon'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isVoice ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              aria-label="Épingles"
              onClick={() => setPinsOpen((v) => !v)}
            >
              <PushPin size={18} />
            </Button>
          ) : null}
          {!isVoice ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              aria-label="Recherche"
              onClick={() => {
                setSearchOpen((v) => !v);
                setPinsOpen(false);
              }}
            >
              <MagnifyingGlass size={18} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            aria-label="Membres"
            onClick={toggleMemberSidebar}
          >
            <Users size={18} />
          </Button>
        </div>
      </div>
      {isVoice ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="rounded-lg bg-bg-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">Salon vocal</div>
            <div className="mt-3">
              <VoiceRoom channelId={channelId} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {searchOpen ? (
            <div className="border-b border-separator bg-bg-secondary p-3">
              <div className="text-sm font-semibold text-text-primary">Recherche</div>
              <div className="mt-2 flex items-center gap-2">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher (min 2 chars)" />
                <Button variant="ghost" size="sm" className="h-10 px-3" onClick={() => setSearchQuery('')}>
                  Effacer
                </Button>
              </div>
              {searchQuery.trim().length >= 2 ? (
                <div className="mt-2 flex max-h-[260px] flex-col gap-1 overflow-y-auto">
                  {(searchResultsQuery.data ?? []).map((r) => (
                    <button
                      key={r.id}
                      className="rounded-md bg-bg-tertiary px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-quaternary"
                      onClick={() => {
                        if (r.channel?.id) router.push(`/servers/${serverId}/${r.channel.id}`);
                        setSearchOpen(false);
                      }}
                    >
                      <div className="text-xs text-text-muted">
                        {r.author ?? 'Utilisateur'} {r.channel ? `• #${r.channel.name}` : ''}
                      </div>
                      <div className="truncate">{r.content ?? ''}</div>
                    </button>
                  ))}
                  {!searchResultsQuery.isLoading && !(searchResultsQuery.data ?? []).length ? (
                    <div className="text-sm text-text-muted">Aucun résultat</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {pinsOpen ? (
            <div className="border-b border-separator bg-bg-secondary p-3">
              <div className="text-sm font-semibold text-text-primary">Messages épinglés</div>
              <div className="mt-2 flex max-h-[240px] flex-col gap-1 overflow-y-auto">
                {(pinsQuery.data ?? []).map((m) => (
                  <div key={m.id} className="rounded-md bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
                    <div className="text-xs text-text-muted">
                      {m.author ? `${m.author.username}#${m.author.discriminator}` : 'Utilisateur'}
                    </div>
                    <div className="truncate">{m.content ?? ''}</div>
                  </div>
                ))}
                {!pinsQuery.isLoading && !(pinsQuery.data ?? []).length ? (
                  <div className="text-sm text-text-muted">Aucun message épinglé</div>
                ) : null}
              </div>
            </div>
          ) : null}
          <MessageList messages={messages} />
          <TypingIndicator names={typingNames} />
          <MessageInput
            placeholder={placeholder}
            disabled={!channelId}
            onSend={sendMessage}
            onSendWithAttachments={sendMessage}
            onTyping={notifyTyping}
          />
        </>
      )}
    </div>
  );
}
