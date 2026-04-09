'use client';

import { cn } from '@/lib/utils';

interface Props {
  names: string[];
  className?: string;
}

export function TypingIndicator({ names, className }: Props) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} est en train d’écrire…`
      : names.length === 2
        ? `${names[0]} et ${names[1]} écrivent…`
        : `${names[0]} et ${names.length - 1} autres écrivent…`;

  return <div className={cn('px-4 py-2 text-xs text-text-muted', className)}>{label}</div>;
}

