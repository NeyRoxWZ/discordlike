'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
  code: string;
  disabled?: boolean;
}

export function AcceptInviteButton({ code, disabled }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAccept() {
    if (disabled || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${code}`, { method: 'POST' });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('serverId' in json)) {
        setError('Impossible de rejoindre');
        return;
      }
      const { serverId } = json as { serverId: string };
      router.push(`/servers/${serverId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button onClick={onAccept} disabled={disabled || loading}>
        {loading ? 'Connexion...' : "Accepter l'invitation"}
      </Button>
      <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !error && 'hidden')}>{error}</div>
    </div>
  );
}

