'use client';

import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface Props extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent',
        className
      )}
      {...props}
    />
  );
}
