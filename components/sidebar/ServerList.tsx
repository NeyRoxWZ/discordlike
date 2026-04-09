'use client';

import { House, Plus, X } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/store/useServerStore';
import { useUserStore } from '@/store/useUserStore';
import type { ServerSummary, User } from '@/types';

async function fetchMe(): Promise<User> {
  const res = await fetch('/api/users/me', { cache: 'no-store' });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok || !json || typeof json !== 'object' || !('user' in json)) {
    const msg =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : res.status === 401
          ? 'Unauthorized'
          : 'Failed';
    throw new Error(msg);
  }
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
  const [createOpen, setCreateOpen] = useState(false);
  const [serverNameDraft, setServerNameDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const serversQuery = useQuery({ queryKey: ['servers'], queryFn: fetchServers, enabled: meQuery.isSuccess });

  const meError = useMemo(() => {
    if (!meQuery.isError) return null;
    return meQuery.error instanceof Error ? meQuery.error.message : 'Erreur';
  }, [meQuery.error, meQuery.isError]);

  useEffect(() => {
    if (!meQuery.data) return;
    setUser(meQuery.data);
    setStatus(meQuery.data.status);
  }, [meQuery.data, setStatus, setUser]);

  useEffect(() => {
    if (serversQuery.data) setServers(serversQuery.data);
  }, [serversQuery.data, setServers]);

  async function onCreateServer() {
    setCreateError(null);
    setServerNameDraft('');
    setCreateOpen(true);
  }

  async function submitCreateServer() {
    const name = serverNameDraft.trim();
    if (name.length < 2) {
      setCreateError('Nom trop court');
      return;
    }
    setCreateError(null);
    setCreating(true);
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!res.ok) {
      const json: unknown = await res.json().catch(() => null);
      const msg =
        json && typeof json === 'object' && 'error' in json ? String((json as { error: unknown }).error) : 'Erreur serveur';
      setCreateError(msg);
      setCreating(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['servers'] });
    setCreating(false);
    setCreateOpen(false);
    router.refresh();
  }

  return (
    <>
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/85" onClick={() => (creating ? null : setCreateOpen(false))} />
          <div className="relative m-auto w-full max-w-md rounded-lg bg-bg-secondary p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-text-primary">Créer un serveur</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                aria-label="Fermer"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Input
                value={serverNameDraft}
                onChange={(e) => setServerNameDraft(e.target.value)}
                placeholder="Nom du serveur"
                autoFocus
              />
              <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !createError && 'hidden')}>
                {createError}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" disabled={creating} onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button disabled={creating} onClick={() => void submitCreateServer()}>
                  Créer
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
          {meError ? (
            <div className="w-full rounded-md bg-bg-secondary p-2 text-xs text-red">
              {meError === 'Database error' ? 'DB' : meError}
            </div>
          ) : null}
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
    </>
  );
}
