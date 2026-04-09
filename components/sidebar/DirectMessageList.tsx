'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

type Conversation = {
  id: string;
  isGroupDM: boolean;
  groupName: string | null;
  groupIconUrl: string | null;
  unread?: boolean;
  participants: Array<{ user: { id: string; username: string; discriminator: string; avatarUrl: string | null } }>;
};

async function fetchDMs(): Promise<Conversation[]> {
  const res = await fetch('/api/dms', { cache: 'no-store' });
  const json: unknown = await res.json();
  if (!res.ok || !json || typeof json !== 'object' || !('conversations' in json)) return [];
  return (json as { conversations: Conversation[] }).conversations;
}

export function DirectMessageList() {
  const pathname = usePathname();
  const me = useUserStore((s) => s.user);
  const dmQuery = useQuery({ queryKey: ['dms'], queryFn: fetchDMs, enabled: Boolean(me) });

  return (
    <div className="flex flex-col gap-1">
      {(dmQuery.data ?? []).map((c) => {
        const display =
          c.isGroupDM && c.groupName
            ? c.groupName
            : c.participants
                .map((p) => p.user)
                .filter((u) => u.id !== me?.id)
                .map((u) => `${u.username}#${u.discriminator}`)
                .join(', ') || 'DM';
        const active = pathname?.includes(`/channels/@me/${c.id}`);
        return (
          <Link
            key={c.id}
            href={`/channels/@me/${c.id}`}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              active && 'bg-bg-quaternary text-text-primary'
            )}
          >
            <div className="h-8 w-8 rounded-full bg-bg-tertiary" />
            <span className="min-w-0 truncate">{display}</span>
            {c.unread && !active ? <span className="ml-auto h-2 w-2 rounded-full bg-accent" /> : null}
          </Link>
        );
      })}
      {!dmQuery.isLoading && !(dmQuery.data ?? []).length ? (
        <div className="px-2 py-2 text-xs text-text-muted">Aucun DM</div>
      ) : null}
    </div>
  );
}
