'use client';

import { Gear, Hash, SpeakerHigh, Users } from '@phosphor-icons/react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { DirectMessageList } from '@/components/sidebar/DirectMessageList';
import { UserBar } from '@/components/sidebar/UserBar';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';

interface Channel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'STAGE' | 'FORUM';
  categoryId: string | null;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

async function fetchServer(
  serverId: string
): Promise<{ server: { id: string; name: string }; channels: Channel[]; categories: Category[] }> {
  const res = await fetch(`/api/servers/${serverId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Not found');
  return res.json() as Promise<{ server: { id: string; name: string }; channels: Channel[]; categories: Category[] }>;
}

export function ChannelList() {
  const pathname = usePathname();
  const params = useParams();
  const serverId = typeof params?.serverId === 'string' ? params.serverId : null;
  const openServerSettings = useUIStore((s) => s.openServerSettings);

  const serverQuery = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => fetchServer(serverId ?? ''),
    enabled: Boolean(serverId)
  });

  if (!serverId) {
    return (
      <aside className="flex h-full w-[240px] flex-col bg-bg-secondary">
        <div className="flex h-12 items-center gap-2 border-b border-separator px-3">
          <Users size={18} />
          <span className="text-sm font-semibold text-text-primary">Amis</span>
        </div>
        <div className="flex flex-col gap-1 p-2">
          <Link
            href="/channels/@me"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              pathname?.startsWith('/channels/@me') && 'bg-bg-quaternary text-text-primary'
            )}
          >
            <Users size={18} weight={pathname?.startsWith('/channels/@me') ? 'fill' : 'regular'} />
            Amis & DMs
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Messages directs</div>
          <DirectMessageList />
        </div>
        <UserBar />
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[240px] flex-col bg-bg-secondary">
      <div className="flex h-12 items-center justify-between border-b border-separator px-3">
        <div className="truncate text-sm font-semibold text-text-primary">
          {serverQuery.data?.server.name ?? 'Serveur'}
        </div>
        <button
          aria-label="Paramètres du serveur"
          className="rounded-md p-1 text-text-secondary hover:bg-bg-quaternary hover:text-text-primary"
          onClick={() => (serverId ? openServerSettings(serverId, 'overview') : null)}
        >
          <Gear size={18} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {(serverQuery.data?.channels ?? [])
          .filter((c) => !c.categoryId)
          .map((channel) => {
            const isActive = pathname?.includes(`/servers/${serverId}/${channel.id}`);
            const Icon = channel.type === 'VOICE' ? SpeakerHigh : Hash;
            return (
              <Link
                key={channel.id}
                href={`/servers/${serverId}/${channel.id}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
                  isActive && 'bg-bg-quaternary text-text-primary'
                )}
              >
                <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                <span className="truncate">{channel.name}</span>
              </Link>
            );
          })}

        {(serverQuery.data?.categories ?? []).map((cat) => {
          const children = (serverQuery.data?.channels ?? []).filter((c) => c.categoryId === cat.id);
          if (!children.length) return null;
          return (
            <div key={cat.id} className="flex flex-col gap-1">
              <div className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{cat.name}</div>
              {children.map((channel) => {
                const isActive = pathname?.includes(`/servers/${serverId}/${channel.id}`);
                const Icon = channel.type === 'VOICE' ? SpeakerHigh : Hash;
                return (
                  <Link
                    key={channel.id}
                    href={`/servers/${serverId}/${channel.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
                      isActive && 'bg-bg-quaternary text-text-primary'
                    )}
                  >
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                    <span className="truncate">{channel.name}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <UserBar />
    </aside>
  );
}
