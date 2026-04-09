'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

interface Props {
  nextPath?: string;
}

export function LoginForm({ nextPath }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const redirectTo = useMemo(() => {
    if (!nextPath || !nextPath.startsWith('/')) return '/channels/@me';
    return nextPath;
  }, [nextPath]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-primary">Connexion</h1>
        <p className="text-sm text-text-secondary">Bienvenue sur Distollec</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="email">
            Email
          </label>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          {form.formState.errors.email?.message ? (
            <p className="text-xs text-red">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="password">
            Mot de passe
          </label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password?.message ? (
            <p className="text-xs text-red">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !formError && 'hidden')}>
          {formError}
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Se connecter
        </Button>
      </form>

      <p className="text-sm text-text-secondary">
        Pas de compte ?{' '}
        <Link
          className="text-text-link hover:underline"
          href={`/register${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`}
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

