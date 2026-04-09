'use client';

import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type,
  ...props
}: Props) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
        variant === 'secondary' && 'bg-bg-quaternary text-text-primary hover:bg-bg-secondary',
        variant === 'ghost' && 'bg-transparent text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
        variant === 'danger' && 'bg-red text-white hover:opacity-90',
        className
      )}
      {...props}
    />
  );
}
