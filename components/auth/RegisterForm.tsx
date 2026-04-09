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
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8),
  birthDate: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

interface Props {
  nextPath?: string;
}

export function RegisterForm({ nextPath }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '', birthDate: '' }
  });

  const redirectTarget = useMemo(() => {
    if (!nextPath || !nextPath.startsWith('/')) return '/channels/@me';
    return nextPath;
  }, [nextPath]);

  const appOrigin = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_APP_URL;
    if (env && env.startsWith('http')) return env.replace(/\/$/, '');
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, []);

  const redirectTo = useMemo(() => {
    if (!appOrigin) return undefined;
    return `${appOrigin}/api/auth/callback?next=${encodeURIComponent(redirectTarget)}`;
  }, [appOrigin, redirectTarget]);

  async function signInDiscord() {
    setFormError(null);
    setOauthBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: redirectTo ? { redirectTo } : undefined
      });
      if (error) setFormError(error.message);
    } finally {
      setOauthBusy(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          username: values.username,
          birthDate: values.birthDate
        }
      }
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    setSubmitted(true);

    if (data.session) {
      router.push(redirectTarget);
      router.refresh();
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Vérifie ton email</h1>
        <p className="text-sm text-text-secondary">
          Un lien de confirmation vient d&apos;être envoyé. Une fois confirmé, connecte-toi.
        </p>
        <Button onClick={() => router.push(`/login?next=${encodeURIComponent(redirectTarget)}`)}>Aller à la connexion</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-primary">Créer un compte</h1>
        <p className="text-sm text-text-secondary">Rejoins Distollec</p>
      </div>

      <Button variant="secondary" disabled={oauthBusy} onClick={() => void signInDiscord()}>
        Continuer avec Discord
      </Button>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="username">
            Nom d&apos;utilisateur
          </label>
          <Input id="username" autoComplete="username" {...form.register('username')} />
          {form.formState.errors.username?.message ? (
            <p className="text-xs text-red">{form.formState.errors.username.message}</p>
          ) : null}
        </div>

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
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          {form.formState.errors.password?.message ? (
            <p className="text-xs text-red">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="birthDate">
            Date de naissance
          </label>
          <Input id="birthDate" type="date" {...form.register('birthDate')} />
          {form.formState.errors.birthDate?.message ? (
            <p className="text-xs text-red">{form.formState.errors.birthDate.message}</p>
          ) : null}
        </div>

        <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !formError && 'hidden')}>
          {formError}
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          Créer un compte
        </Button>
      </form>

      <p className="text-sm text-text-secondary">
        Déjà un compte ?{' '}
        <Link className="text-text-link hover:underline" href={`/login?next=${encodeURIComponent(redirectTarget)}`}>
          Se connecter
        </Link>
      </p>
    </div>
  );
}
