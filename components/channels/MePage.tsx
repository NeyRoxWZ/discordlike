'use client';

import { ChatCircleDots, Prohibit, UserPlus, Users } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import type { UserStatus } from '@/types';

type FriendUser = {
  id: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  status: UserStatus;
};

type FriendIncoming = {
  id: string;
  createdAt: string;
  sender: FriendUser;
};

type FriendOutgoing = {
  id: string;
  createdAt: string;
  receiver: FriendUser;
};

async function fetchFriends() {
  const res = await fetch('/api/friends', { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok) throw new Error('Failed');
  return json as { friends: FriendUser[]; incoming: FriendIncoming[]; outgoing: FriendOutgoing[]; blocked: FriendUser[] };
}

function statusColor(status: UserStatus) {
  if (status === 'ONLINE') return 'bg-green';
  if (status === 'IDLE') return 'bg-yellow';
  if (status === 'DO_NOT_DISTURB') return 'bg-red';
  return 'bg-gray';
}

const addFriendSchema = z.object({
  usernameOrTag: z.string().min(2).max(80)
});

type AddFriendValues = z.infer<typeof addFriendSchema>;

export function MePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useUserStore((s) => s.user);
  const [tab, setTab] = useState<'friends' | 'pending' | 'blocked'>('friends');
  const [actionError, setActionError] = useState<string | null>(null);

  const friendsQuery = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });

  const form = useForm<AddFriendValues>({
    resolver: zodResolver(addFriendSchema),
    defaultValues: { usernameOrTag: '' }
  });

  const { incoming, outgoing, friends, blocked, pendingRows } = useMemo(() => {
    const incomingRows = friendsQuery.data?.incoming ?? [];
    const outgoingRows = friendsQuery.data?.outgoing ?? [];
    const friendsRows = friendsQuery.data?.friends ?? [];
    const blockedRows = friendsQuery.data?.blocked ?? [];

    const pending = [
      ...incomingRows.map((r) => ({ kind: 'incoming' as const, row: r })),
      ...outgoingRows.map((r) => ({ kind: 'outgoing' as const, row: r }))
    ];

    return {
      incoming: incomingRows,
      outgoing: outgoingRows,
      friends: friendsRows,
      blocked: blockedRows,
      pendingRows: pending
    };
  }, [friendsQuery.data]);

  async function onLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function onCreateDM(targetUserId: string) {
    setActionError(null);
    const res = await fetch('/api/dms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId })
    });
    const json: unknown = await res.json();
    if (!res.ok || !json || typeof json !== 'object' || !('conversationId' in json)) {
      setActionError('Impossible de créer le DM');
      return;
    }
    const { conversationId } = json as { conversationId: string };
    router.push(`/channels/@me/${conversationId}`);
  }

  async function onFriendAction(payload: unknown) {
    setActionError(null);
    const res = await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      setActionError('Action impossible');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['friends'] });
  }

  async function onAddFriend(values: AddFriendValues) {
    setActionError(null);
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      setActionError(typeof json === 'object' && json && 'error' in json ? String((json as { error: unknown }).error) : 'Erreur');
      return;
    }
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ['friends'] });
    setTab('pending');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 items-center justify-between border-b border-separator px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Users size={18} />
          Amis
        </div>
        <div />
      </div>

      <div className="flex items-center gap-2 border-b border-separator px-4 py-3">
        <Button
          variant={tab === 'friends' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9"
          onClick={() => setTab('friends')}
        >
          Tous
        </Button>
        <Button
          variant={tab === 'pending' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9"
          onClick={() => setTab('pending')}
        >
          En attente
        </Button>
        <Button
          variant={tab === 'blocked' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9"
          onClick={() => setTab('blocked')}
        >
          Bloqués
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="rounded-lg bg-bg-secondary p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-text-secondary">Connecté en tant que</div>
              <div className="text-base font-semibold text-text-primary">
                {user ? `${user.username}#${user.discriminator}` : '...'}
              </div>
            </div>
            <Button variant="danger" onClick={onLogout} className="shrink-0">
              Déconnexion
            </Button>
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold text-text-primary">Avatar</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                aria-label="Choisir un avatar"
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const data = new FormData();
                  data.append('file', file);
                  await fetch('/api/users/me/avatar', { method: 'POST', body: data });
                }}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-bg-secondary p-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} />
            <div className="text-sm font-semibold text-text-primary">Ajouter un ami</div>
          </div>
          <form onSubmit={form.handleSubmit(onAddFriend)} className="mt-3 flex flex-col gap-2">
            <Input placeholder="username#0000" {...form.register('usernameOrTag')} />
            {form.formState.errors.usernameOrTag?.message ? (
              <div className="text-xs text-red">{form.formState.errors.usernameOrTag.message}</div>
            ) : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Envoyer la demande
            </Button>
          </form>
          <div className={cn('mt-3 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !actionError && 'hidden')}>
            {actionError}
          </div>
        </div>

        {tab === 'friends' ? (
          <div className="rounded-lg bg-bg-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">Amis ({friends.length})</div>
            <div className="mt-3 flex flex-col gap-2">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full', statusColor(f.status))} />
                    <div className="min-w-0 truncate text-sm text-text-primary">
                      {f.username}#{f.discriminator}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label="Envoyer un message"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => void onCreateDM(f.id)}
                    >
                      <ChatCircleDots size={18} />
                    </Button>
                    <Button
                      aria-label="Bloquer"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => void onFriendAction({ action: 'block', userId: f.id })}
                    >
                      <Prohibit size={18} />
                    </Button>
                  </div>
                </div>
              ))}
              {!friends.length ? <div className="text-sm text-text-muted">Aucun ami</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'pending' ? (
          <div className="rounded-lg bg-bg-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">En attente ({pendingRows.length})</div>
            <div className="mt-3 flex flex-col gap-2">
              {pendingRows.map((r) => {
                const u = r.kind === 'incoming' ? r.row.sender : r.row.receiver;
                return (
                  <div key={r.row.id} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-full', statusColor(u.status))} />
                      <div className="min-w-0 truncate text-sm text-text-primary">
                        {u.username}#{u.discriminator}
                      </div>
                      <div className="text-xs text-text-muted">{r.kind === 'incoming' ? 'Reçue' : 'Envoyée'}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.kind === 'incoming' ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => void onFriendAction({ action: 'accept', requestId: r.row.id })}>
                            Accepter
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void onFriendAction({ action: 'decline', requestId: r.row.id })}>
                            Refuser
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => void onFriendAction({ action: 'decline', requestId: r.row.id })}>
                          Annuler
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!pendingRows.length ? <div className="text-sm text-text-muted">Aucune demande</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'blocked' ? (
          <div className="rounded-lg bg-bg-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">Bloqués ({blocked.length})</div>
            <div className="mt-3 flex flex-col gap-2">
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full', statusColor(b.status))} />
                    <div className="min-w-0 truncate text-sm text-text-primary">
                      {b.username}#{b.discriminator}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void onFriendAction({ action: 'unblock', userId: b.id })}>
                    Débloquer
                  </Button>
                </div>
              ))}
              {!blocked.length ? <div className="text-sm text-text-muted">Aucun utilisateur bloqué</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
