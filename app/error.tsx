'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') ?? 'dark');
  }, []);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg-primary">
        <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-10">
          <div className="w-full rounded-lg bg-bg-secondary p-6">
            <div className="text-lg font-semibold text-text-primary">Erreur</div>
            <div className="mt-2 text-sm text-text-secondary">{error.message || 'Erreur inconnue'}</div>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={reset}>Réessayer</Button>
              <Button variant="secondary" onClick={() => (window.location.href = '/login')}>
                Aller à la connexion
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

