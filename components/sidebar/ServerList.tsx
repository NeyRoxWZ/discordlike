'use client';

import { House, Plus } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/store/useServerStore';
import { useUserStore } from '@/store/useUserStore';
import type { ServerSummary, User } from '@/types';

async function fetchMe(): Promise<User> {
  const res = await fetch('/api/users/me', { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('user' in json)) throw new Error('Unauthorized');
  const { user } = json as { user: User };
  return user;
}

async function fetchServers(): Promise<ServerSummary[]> {
  const res = await fetch('/api/servers', { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('servers' in json)) return [];
  const { servers } = json as { servers: ServerSummary[] };
  return servers;
}

export function ServerList() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useUserStore((s) => s.setUser);
  const setStatus = useUserStore((s) => s.setStatus);
  const setServers = useServerStore((s) => s.setServers);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const serversQuery = useQuery({ queryKey: ['servers'], queryFn: fetchServers, enabled: meQuery.isSuccess });

  useEffect(() => {
    if (!meQuery.data) return;
    setUser(meQuery.data);
    setStatus(meQuery.data.status);
  }, [meQuery.data, setStatus, setUser]);

  useEffect(() => {
    if (serversQuery.data) setServers(serversQuery.data);
  }, [serversQuery.data, setServers]);

  async function onCreateServer() {
    const name = window.prompt('Nom du serveur');
    if (!name) return;
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!res.ok) return;

    await queryClient.invalidateQueries({ queryKey: ['servers'] });
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[72px] flex-col items-center gap-2 bg-bg-tertiary py-3">
      <Link
        href="/channels/@me"
        aria-label="Accueil DMs"
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-text-primary transition-all hover:rounded-2xl hover:bg-accent hover:text-white',
          pathname?.startsWith('/channels/@me') && 'rounded-2xl bg-accent text-white'
        )}
      >
        <House size={24} weight={pathname?.startsWith('/channels/@me') ? 'fill' : 'regular'} />
      </Link>

      <div className="h-px w-8 bg-separator" />

      <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-3">
        {serversQuery.data?.map((server) => (
          <Link
            key={server.id}
            href={`/servers/${server.id}`}
            aria-label={server.name}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-text-primary transition-all hover:rounded-2xl hover:bg-accent hover:text-white"
          >
            <span className="text-sm font-semibold">
              {server.iconUrl ? server.name.slice(0, 1).toUpperCase() : server.name.slice(0, 2).toUpperCase()}
            </span>
          </Link>
        ))}
      </div>

      <Button
        aria-label="Créer un serveur"
        variant="secondary"
        size="sm"
        className="h-12 w-12 rounded-full p-0 hover:rounded-2xl"
        onClick={onCreateServer}
      >
        <Plus size={22} />
      </Button>
    </aside>
  );
}
