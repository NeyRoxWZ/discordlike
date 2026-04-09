'use client';

import { X } from '@phosphor-icons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { permissionCatalog } from '@/lib/permissionCatalog';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';

type Tab = 'overview' | 'roles' | 'channels' | 'invites' | 'members';

function safeTab(t: string): Tab {
  if (t === 'roles') return 'roles';
  if (t === 'channels') return 'channels';
  if (t === 'invites') return 'invites';
  if (t === 'members') return 'members';
  return 'overview';
}

type RoleRow = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  isEveryone: boolean;
};

type ChannelRow = {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'STAGE' | 'FORUM';
  topic: string | null;
  position: number;
  isNsfw: boolean;
  slowMode: number;
  categoryId?: string | null;
};

type InviteRow = {
  code: string;
  channelId: string | null;
  uses: number;
  maxUses: number;
  maxAge: number;
  expiresAt: string | null;
  createdAt: string;
};

type MemberRow = {
  id: string;
  nickname: string | null;
  timedOutUntil: string | null;
  user: { id: string; username: string; discriminator: string; avatarUrl: string | null; status: string };
  roles: Array<{ role: { id: string; name: string; position: number; isEveryone: boolean } }>;
};

type ServerRow = {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  vanityUrl: string | null;
};

async function fetchRoles(serverId: string): Promise<RoleRow[]> {
  const res = await fetch(`/api/servers/${serverId}/roles`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('roles' in json)) return [];
  const { roles } = json as { roles: Array<Omit<RoleRow, 'permissions'> & { permissions: bigint }> };
  return roles.map((r) => ({ ...r, permissions: String(r.permissions) }));
}

async function fetchServerSettings(serverId: string): Promise<ServerRow | null> {
  const res = await fetch(`/api/servers/${serverId}/settings`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('server' in json)) return null;
  return (json as { server: ServerRow }).server;
}

async function fetchMembers(serverId: string): Promise<MemberRow[]> {
  const res = await fetch(`/api/servers/${serverId}/members`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('members' in json)) return [];
  return (json as { members: MemberRow[] }).members;
}

async function fetchChannels(serverId: string): Promise<ChannelRow[]> {
  const res = await fetch(`/api/servers/${serverId}/channels`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('channels' in json)) return [];
  return (json as { channels: ChannelRow[] }).channels;
}

async function fetchInvites(serverId: string): Promise<InviteRow[]> {
  const res = await fetch(`/api/servers/${serverId}/invites`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('invites' in json)) return [];
  return (json as { invites: InviteRow[] }).invites;
}

type CategoryRow = { id: string; name: string; position: number };

async function fetchCategories(serverId: string): Promise<CategoryRow[]> {
  const res = await fetch(`/api/servers/${serverId}/categories`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('categories' in json)) return [];
  return (json as { categories: CategoryRow[] }).categories;
}

const createRoleSchema = z.object({
  name: z.string().min(1).max(64)
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(64)
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['TEXT', 'VOICE', 'ANNOUNCEMENT', 'STAGE', 'FORUM']),
  categoryId: z.string().nullable().optional()
});

export function ServerSettingsPanel() {
  const open = useUIStore((s) => s.serverSettingsOpen);
  const tabRaw = useUIStore((s) => s.serverSettingsTab);
  const serverId = useUIStore((s) => s.serverSettingsServerId);
  const close = useUIStore((s) => s.closeServerSettings);
  const queryClient = useQueryClient();
  const tab = useMemo(() => safeTab(tabRaw), [tabRaw]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleNameDraft, setRoleNameDraft] = useState('');
  const [rolePermsDraft, setRolePermsDraft] = useState('0');
  const [roleHoistDraft, setRoleHoistDraft] = useState(false);
  const [roleMentionableDraft, setRoleMentionableDraft] = useState(false);
  const [serverNameDraft, setServerNameDraft] = useState('');
  const [serverDescriptionDraft, setServerDescriptionDraft] = useState('');
  const [serverVanityDraft, setServerVanityDraft] = useState('');

  const roleForm = useForm<z.infer<typeof createRoleSchema>>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: '' }
  });

  const channelForm = useForm<z.infer<typeof createChannelSchema>>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: { name: '', type: 'TEXT', categoryId: null }
  });

  const categoryForm = useForm<z.infer<typeof createCategorySchema>>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '' }
  });

  const rolesQuery = useQuery({
    queryKey: ['server-roles', serverId],
    queryFn: () => fetchRoles(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'roles')
  });

  useEffect(() => {
    if (tab !== 'roles') return;
    const roles = rolesQuery.data ?? [];
    const nextSelected = selectedRoleId ?? roles.find((r) => !r.isEveryone)?.id ?? roles[0]?.id ?? null;
    if (!nextSelected) return;
    if (nextSelected !== selectedRoleId) setSelectedRoleId(nextSelected);
    const r = roles.find((x) => x.id === nextSelected);
    if (!r) return;
    setRoleNameDraft(r.name);
    setRolePermsDraft(r.permissions);
    setRoleHoistDraft(r.hoist);
    setRoleMentionableDraft(r.mentionable);
  }, [rolesQuery.data, selectedRoleId, tab]);

  const channelsQuery = useQuery({
    queryKey: ['server-channels', serverId],
    queryFn: () => fetchChannels(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'channels')
  });

  const serverSettingsQuery = useQuery({
    queryKey: ['server-settings', serverId],
    queryFn: () => fetchServerSettings(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'overview')
  });

  useEffect(() => {
    if (tab !== 'overview') return;
    const s = serverSettingsQuery.data;
    if (!s) return;
    setServerNameDraft(s.name);
    setServerDescriptionDraft(s.description ?? '');
    setServerVanityDraft(s.vanityUrl ?? '');
  }, [serverSettingsQuery.data, tab]);

  const categoriesQuery = useQuery({
    queryKey: ['server-categories', serverId],
    queryFn: () => fetchCategories(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'channels')
  });

  const invitesQuery = useQuery({
    queryKey: ['server-invites', serverId],
    queryFn: () => fetchInvites(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'invites')
  });

  const membersQuery = useQuery({
    queryKey: ['server-members', serverId],
    queryFn: () => fetchMembers(serverId ?? ''),
    enabled: Boolean(open && serverId && tab === 'members')
  });

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      return;
    }
  }, [open]);

  if (!open || !serverId) return null;

  async function createRole(values: z.infer<typeof createRoleSchema>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        setError('Création du rôle impossible');
        return;
      }
      roleForm.reset();
      await queryClient.invalidateQueries({ queryKey: ['server-roles', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(roleId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', roleId })
      });
      if (!res.ok) {
        setError('Suppression impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-roles', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function updateRole() {
    if (!selectedRoleId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          roleId: selectedRoleId,
          name: roleNameDraft,
          hoist: roleHoistDraft,
          mentionable: roleMentionableDraft,
          permissions: rolePermsDraft
        })
      });
      if (!res.ok) {
        setError('Mise à jour impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-roles', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function createChannel(values: z.infer<typeof createChannelSchema>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        setError('Création du salon impossible');
        return;
      }
      channelForm.reset({ name: '', type: 'TEXT', categoryId: null });
      await queryClient.invalidateQueries({ queryKey: ['server-channels', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function deleteChannel(channelId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', channelId })
      });
      if (!res.ok) {
        setError('Suppression impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-channels', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(values: z.infer<typeof createCategorySchema>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        setError('Création catégorie impossible');
        return;
      }
      categoryForm.reset({ name: '' });
      await queryClient.invalidateQueries({ queryKey: ['server-categories', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('invite' in json)) {
        setError('Création invite impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-invites', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function saveServerSettings() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverNameDraft,
          description: serverDescriptionDraft ? serverDescriptionDraft : null,
          vanityUrl: serverVanityDraft ? serverVanityDraft : null
        })
      });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('server' in json)) {
        setError('Sauvegarde impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-settings', serverId] });
    } finally {
      setBusy(false);
    }
  }

  async function uploadServerFile(kind: 'icon' | 'banner', file: File) {
    setError(null);
    setBusy(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch(`/api/servers/${serverId}/${kind}`, { method: 'POST', body: data });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object') {
        setError('Upload impossible');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['server-settings', serverId] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/85" onClick={close} />
      <div className="relative ml-auto flex h-full w-full max-w-4xl">
        <div className="flex w-[240px] shrink-0 flex-col bg-bg-secondary p-3">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Serveur</div>

          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'overview' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ serverSettingsTab: 'overview' })}
          >
            Vue d’ensemble
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'roles' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ serverSettingsTab: 'roles' })}
          >
            Rôles
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'channels' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ serverSettingsTab: 'channels' })}
          >
            Salons
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'members' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ serverSettingsTab: 'members' })}
          >
            Membres
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'invites' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ serverSettingsTab: 'invites' })}
          >
            Invitations
          </button>

          <div className="mt-auto">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={close}>
              Fermer
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
          <div className="flex h-12 items-center justify-between border-b border-separator px-4">
            <div className="text-sm font-semibold text-text-primary">
              {tab === 'overview'
                ? 'Vue d’ensemble'
                : tab === 'roles'
                  ? 'Rôles'
                  : tab === 'channels'
                    ? 'Salons'
                    : tab === 'members'
                      ? 'Membres'
                      : 'Invitations'}
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Fermer" onClick={close}>
              <X size={18} />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !error && 'hidden')}>{error}</div>

            {tab === 'overview' ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-bg-secondary p-4">
                  <div className="text-sm font-semibold text-text-primary">Identité</div>
                  {serverSettingsQuery.isLoading ? (
                    <div className="mt-3 text-sm text-text-muted">Chargement…</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Icône</div>
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-md border border-separator bg-bg-tertiary">
                            {serverSettingsQuery.data?.iconUrl ? (
                              <RemoteImage
                                src={serverSettingsQuery.data.iconUrl}
                                alt="Icône serveur"
                                className="h-16 w-16 object-cover"
                              />
                            ) : null}
                          </div>
                          <input
                            aria-label="Choisir une icône"
                            type="file"
                            accept="image/png,image/jpeg"
                            disabled={busy}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await uploadServerFile('icon', file);
                              e.currentTarget.value = '';
                            }}
                            className="text-sm text-text-secondary"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Nom</div>
                        <Input value={serverNameDraft} onChange={(e) => setServerNameDraft(e.target.value)} placeholder="Nom du serveur" />
                      </div>

                      <div className="flex flex-col gap-2 lg:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Description</div>
                        <textarea
                          value={serverDescriptionDraft}
                          onChange={(e) => setServerDescriptionDraft(e.target.value)}
                          className="min-h-[90px] w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
                          placeholder="Description (max 190)"
                        />
                      </div>

                      <div className="flex flex-col gap-2 lg:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Vanity URL</div>
                        <Input
                          value={serverVanityDraft}
                          onChange={(e) =>
                            setServerVanityDraft(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, '')
                                .slice(0, 32)
                            )
                          }
                          placeholder="ex: distollec"
                        />
                        {serverVanityDraft ? (
                          <div className="text-xs text-text-muted">Lien: /s/{serverVanityDraft}</div>
                        ) : (
                          <div className="text-xs text-text-muted">Laisser vide pour désactiver</div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 lg:col-span-2">
                        <Button
                          variant="secondary"
                          disabled={busy || !serverSettingsQuery.data}
                          onClick={() => {
                            const s = serverSettingsQuery.data;
                            if (!s) return;
                            setServerNameDraft(s.name);
                            setServerDescriptionDraft(s.description ?? '');
                            setServerVanityDraft(s.vanityUrl ?? '');
                          }}
                        >
                          Restaurer
                        </Button>
                        <Button disabled={busy} onClick={() => void saveServerSettings()}>
                          Sauvegarder
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-bg-secondary p-4">
                  <div className="text-sm font-semibold text-text-primary">Bannière</div>
                  <div className="mt-3 flex flex-col gap-2">
                    <input
                      aria-label="Choisir une bannière"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={busy}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await uploadServerFile('banner', file);
                        e.currentTarget.value = '';
                      }}
                      className="text-sm text-text-secondary"
                    />
                    {serverSettingsQuery.data?.bannerUrl ? (
                      <div className="overflow-hidden rounded-md border border-separator">
                        <RemoteImage src={serverSettingsQuery.data.bannerUrl} alt="Bannière serveur" className="h-[140px] w-full object-cover" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'roles' ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg bg-bg-secondary p-4">
                  <div className="text-sm font-semibold text-text-primary">Créer un rôle</div>
                  <form onSubmit={roleForm.handleSubmit(createRole)} className="mt-3 flex items-center gap-2">
                    <Input placeholder="Nom du rôle" {...roleForm.register('name')} />
                    <Button type="submit" disabled={busy}>
                      Créer
                    </Button>
                  </form>
                  <div className="mt-4 flex flex-col gap-2">
                    {(rolesQuery.data ?? []).map((r) => (
                      <button
                        key={r.id}
                        className={cn(
                          'flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2 text-left hover:bg-bg-quaternary',
                          selectedRoleId === r.id && 'bg-bg-quaternary'
                        )}
                        onClick={() => setSelectedRoleId(r.id)}
                      >
                        <div className="min-w-0 truncate text-sm text-text-primary">{r.name}</div>
                        {!r.isEveryone ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void deleteRole(r.id);
                            }}
                          >
                            Supprimer
                          </Button>
                        ) : (
                          <div className="text-xs text-text-muted">@everyone</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-bg-secondary p-4">
                  <div className="text-sm font-semibold text-text-primary">Permissions</div>
                  <div className="mt-3 flex flex-col gap-2">
                    <Input value={roleNameDraft} onChange={(e) => setRoleNameDraft(e.target.value)} placeholder="Nom du rôle" />
                    <div className="flex items-center gap-2">
                      <button
                        className={cn(
                          'rounded-md px-3 py-2 text-sm',
                          roleHoistDraft ? 'bg-bg-quaternary text-text-primary' : 'bg-bg-tertiary text-text-secondary'
                        )}
                        onClick={() => setRoleHoistDraft((v) => !v)}
                      >
                        Afficher séparément
                      </button>
                      <button
                        className={cn(
                          'rounded-md px-3 py-2 text-sm',
                          roleMentionableDraft ? 'bg-bg-quaternary text-text-primary' : 'bg-bg-tertiary text-text-secondary'
                        )}
                        onClick={() => setRoleMentionableDraft((v) => !v)}
                      >
                        Mentionnable
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {permissionCatalog.map((p) => {
                        const perms = BigInt(rolePermsDraft || '0');
                        const enabled = (perms & p.bit) === p.bit;
                        return (
                          <button
                            key={p.key}
                            className={cn(
                              'flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2 text-sm hover:bg-bg-quaternary',
                              enabled && 'bg-bg-quaternary'
                            )}
                            onClick={() => {
                              const current = BigInt(rolePermsDraft || '0');
                              const next = enabled ? current & ~p.bit : current | p.bit;
                              setRolePermsDraft(next.toString());
                            }}
                          >
                            <span className="text-text-primary">{p.label}</span>
                            <span className="text-xs text-text-muted">{enabled ? 'ON' : 'OFF'}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Button onClick={() => void updateRole()} disabled={busy || !selectedRoleId}>
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'channels' ? (
              <div className="rounded-lg bg-bg-secondary p-4">
                <div className="text-sm font-semibold text-text-primary">Catégories</div>
                <form onSubmit={categoryForm.handleSubmit(createCategory)} className="mt-3 flex items-center gap-2">
                  <Input placeholder="Nom de la catégorie" {...categoryForm.register('name')} />
                  <Button type="submit" disabled={busy}>
                    Créer
                  </Button>
                </form>
                <div className="mt-3 flex flex-col gap-2">
                  {(categoriesQuery.data ?? []).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                      <div className="min-w-0 truncate text-sm text-text-primary">{c.name}</div>
                      <div className="text-xs text-text-muted">{c.position}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 text-sm font-semibold text-text-primary">Créer un salon</div>
                <form onSubmit={channelForm.handleSubmit(createChannel)} className="mt-3 flex items-center gap-2">
                  <Input placeholder="Nom du salon" {...channelForm.register('name')} />
                  <select
                    value={channelForm.watch('type')}
                    onChange={(e) => channelForm.setValue('type', e.target.value as ChannelRow['type'])}
                    className="h-10 rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary outline-none"
                  >
                    <option value="TEXT">Texte</option>
                    <option value="VOICE">Vocal</option>
                    <option value="ANNOUNCEMENT">Annonce</option>
                    <option value="FORUM">Forum</option>
                    <option value="STAGE">Stage</option>
                  </select>
                  <select
                    value={channelForm.watch('categoryId') ?? ''}
                    onChange={(e) => channelForm.setValue('categoryId', e.target.value ? e.target.value : null)}
                    className="h-10 rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary outline-none"
                  >
                    <option value="">Sans catégorie</option>
                    {(categoriesQuery.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" disabled={busy}>
                    Créer
                  </Button>
                </form>
                <div className="mt-4 flex flex-col gap-2">
                  {(channelsQuery.data ?? []).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                      <div className="min-w-0 truncate text-sm text-text-primary">
                        {c.type === 'VOICE' ? '🔊' : '#'} {c.name}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 px-2" disabled={busy} onClick={() => void deleteChannel(c.id)}>
                        Supprimer
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'members' ? (
              <div className="rounded-lg bg-bg-secondary p-4">
                <div className="text-sm font-semibold text-text-primary">Membres</div>
                <div className="mt-4 flex flex-col gap-2">
                  {(membersQuery.data ?? []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-bg-tertiary px-3 py-2">
                      <button className="min-w-0 text-left">
                        <div className="truncate text-sm text-text-primary">
                          {m.nickname ?? m.user.username}#{m.user.discriminator}
                        </div>
                        <div className="truncate text-xs text-text-muted">
                          {m.roles
                            .map((r) => r.role)
                            .filter((r) => !r.isEveryone)
                            .sort((a, b) => b.position - a.position)
                            .slice(0, 3)
                            .map((r) => r.name)
                            .join(', ')}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() =>
                            void fetch(`/api/servers/${serverId}/members/${m.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'timeout', minutes: 10 })
                            }).then(() => queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }))
                          }
                        >
                          Timeout 10m
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() =>
                            void fetch(`/api/servers/${serverId}/members/${m.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'timeout', minutes: 0 })
                            }).then(() => queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }))
                          }
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() =>
                            void fetch(`/api/servers/${serverId}/members/${m.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'kick' })
                            }).then(() => queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }))
                          }
                        >
                          Kick
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 px-2"
                          disabled={busy}
                          onClick={() =>
                            void fetch(`/api/servers/${serverId}/members/${m.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'ban', reason: null })
                            }).then(() => queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }))
                          }
                        >
                          Ban
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!membersQuery.isLoading && !(membersQuery.data ?? []).length ? (
                    <div className="text-sm text-text-muted">Aucun membre</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === 'invites' ? (
              <div className="rounded-lg bg-bg-secondary p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-text-primary">Invitations</div>
                  <Button size="sm" disabled={busy} onClick={() => void createInvite()}>
                    Créer
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {(invitesQuery.data ?? []).map((i) => (
                    <div key={i.code} className="flex items-center justify-between rounded-md bg-bg-tertiary px-3 py-2">
                      <div className="min-w-0 truncate text-sm text-text-primary">/invite/{i.code}</div>
                      <div className="text-xs text-text-muted">
                        {i.uses}/{i.maxUses || '∞'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
