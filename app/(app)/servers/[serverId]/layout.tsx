'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

import { useServerStore } from '@/store/useServerStore';

interface Props {
  children: React.ReactNode;
}

export default function ServerLayout({ children }: Props) {
  const params = useParams();
  const serverId = typeof params?.serverId === 'string' ? params.serverId : null;
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  useEffect(() => {
    setActiveServer(serverId);
    return () => setActiveServer(null);
  }, [serverId, setActiveServer]);

  return children;
}
