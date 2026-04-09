'use client';

import { Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/store/useServerStore';
import { useUIStore } from '@/store/useUIStore';
import type { UserStatus } from '@/types';

interface Props {
  className?: string;
}

type Role = {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  isEveryone: boolean;
};

type MemberRow = {
  id: string;
  nickname: string | null;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatarUrl: string | null;
    status: UserStatus;
  };
  roles: Array<{ role: Role }>;
};

async function fetchMembers(serverId: string): Promise<{ members: MemberRow[]; roles: Role[] }> {
  const res = await fetch(`/api/servers/${serverId}/members`, { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object') return { members: [], roles: [] };
  const { members, roles } = json as { members: MemberRow[]; roles: Role[] };
  return { members, roles };
}

function statusColor(status: UserStatus) {
  if (status === 'ONLINE') return 'bg-green';
  if (status === 'IDLE') return 'bg-yellow';
  if (status === 'DO_NOT_DISTURB') return 'bg-red';
  return 'bg-gray';
}

export function MemberSidebar({ className }: Props) {
  const open = useUIStore((s) => s.memberSidebarOpen);
  const toggle = useUIStore((s) => s.toggleMemberSidebar);
  const serverId = useServerStore((s) => s.activeServerId);
  const membersQuery = useQuery({
    queryKey: ['members', serverId],
    queryFn: () => fetchMembers(serverId ?? ''),
    enabled: Boolean(serverId)
  });

  const { onlineUserIds } = usePresence(serverId);

  const grouped = useMemo(() => {
    const members = membersQuery.data?.members ?? [];
    const roles = membersQuery.data?.roles ?? [];

    const roleById = new Map(roles.map((r) => [r.id, r]));
    const hoistedRoles = roles.filter((r) => r.hoist && !r.isEveryone).sort((a, b) => b.position - a.position);

    const online = members.filter((m) => onlineUserIds.has(m.user.id));
    const offline = members.filter((m) => !onlineUserIds.has(m.user.id));

    const sections: Array<{ id: string; label: string; members: MemberRow[] }> = [];
    for (const role of hoistedRoles) {
      const withRole = online.filter((m) => m.roles.some((mr) => mr.role.id === role.id));
      if (withRole.length) sections.push({ id: role.id, label: role.name, members: withRole });
    }

    const onlineWithoutHoist = online.filter((m) => {
      const memberRoleIds = m.roles.map((mr) => mr.role.id);
      return !memberRoleIds.some((rid) => {
        const r = roleById.get(rid);
        return r ? r.hoist && !r.isEveryone : false;
      });
    });
    if (onlineWithoutHoist.length) sections.push({ id: 'online', label: 'En ligne', members: onlineWithoutHoist });

    return { sections, offline };
  }, [membersQuery.data?.members, membersQuery.data?.roles, onlineUserIds]);

  return (
    <aside className={cn('h-full w-[240px] border-l border-separator bg-bg-secondary', !open && 'hidden', className)}>
      <div className="flex h-12 items-center justify-between border-b border-separator px-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Users size={18} />
          Membres
        </div>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={toggle}>
          Masquer
        </Button>
      </div>
      {!serverId ? (
        <div className="p-3 text-sm text-text-muted">Aucun serveur</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {grouped.sections.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {s.label} — {s.members.length}
              </div>
              <div className="flex flex-col gap-1">
                {s.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-primary hover:bg-bg-quaternary"
                  >
                    <div className="relative h-8 w-8 rounded-full bg-bg-tertiary">
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary">
                        <span className={cn('block h-full w-full rounded-full', statusColor(m.user.status))} />
                      </span>
                    </div>
                    <div className="min-w-0 truncate">{m.nickname ?? m.user.username}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Hors ligne — {grouped.offline.length}
            </div>
            <div className="flex flex-col gap-1">
              {grouped.offline.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-muted hover:bg-bg-quaternary"
                >
                  <div className="relative h-8 w-8 rounded-full bg-bg-tertiary opacity-70">
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary">
                      <span className={cn('block h-full w-full rounded-full', statusColor('OFFLINE'))} />
                    </span>
                  </div>
                  <div className="min-w-0 truncate">{m.nickname ?? m.user.username}</div>
                </div>
              ))}
              {!grouped.offline.length && !grouped.sections.length && !membersQuery.isLoading ? (
                <div className="text-sm text-text-muted">Aucun membre</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
