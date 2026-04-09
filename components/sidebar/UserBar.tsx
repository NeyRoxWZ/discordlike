'use client';

import { Gear, Microphone, SpeakerHigh } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useUserStore } from '@/store/useUserStore';

function statusColor(status: string) {
  if (status === 'ONLINE') return 'bg-green';
  if (status === 'IDLE') return 'bg-yellow';
  if (status === 'DO_NOT_DISTURB') return 'bg-red';
  return 'bg-gray';
}

export function UserBar() {
  const router = useRouter();
  const openSettings = useUIStore((s) => s.openSettings);
  const user = useUserStore((s) => s.user);

  async function onLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-[52px] items-center justify-between gap-2 border-t border-separator bg-bg-secondary px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative h-8 w-8 shrink-0 rounded-full bg-bg-tertiary">
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-secondary">
            <span className={cn('block h-full w-full rounded-full', statusColor(user?.status ?? 'OFFLINE'))} />
          </span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">
            {user ? `${user.username}#${user.discriminator}` : '...'}
          </div>
          <div className="truncate text-xs text-text-muted">{user?.customStatus ?? ''}</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button aria-label="Micro" variant="ghost" size="sm" className="h-8 px-2">
          <Microphone size={18} />
        </Button>
        <Button aria-label="Son" variant="ghost" size="sm" className="h-8 px-2">
          <SpeakerHigh size={18} />
        </Button>
        <Button
          aria-label="Paramètres"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => openSettings('account')}
        >
          <Gear size={18} />
        </Button>
        <Button aria-label="Déconnexion" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void onLogout()}>
          ×
        </Button>
      </div>
    </div>
  );
}

