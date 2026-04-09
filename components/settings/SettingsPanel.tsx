'use client';

import { X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/useUIStore';
import { useUserStore } from '@/store/useUserStore';

type Tab = 'account' | 'profile' | 'appearance';

function safeTab(t: string): Tab {
  if (t === 'profile') return 'profile';
  if (t === 'appearance') return 'appearance';
  return 'account';
}

export function SettingsPanel() {
  const open = useUIStore((s) => s.settingsOpen);
  const tabRaw = useUIStore((s) => s.settingsTab);
  const close = useUIStore((s) => s.closeSettings);
  const setTheme = useUIStore((s) => s.setTheme);
  const theme = useUIStore((s) => s.theme);

  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const status = useUserStore((s) => s.status);
  const setStatus = useUserStore((s) => s.setStatus);
  const customStatus = useUserStore((s) => s.customStatus);
  const setCustomStatus = useUserStore((s) => s.setCustomStatus);

  const tab = useMemo(() => safeTab(tabRaw), [tabRaw]);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [bio, setBio] = useState('');
  const [profileColor, setProfileColor] = useState('#5865F2');
  const [profileEffect, setProfileEffect] = useState('none');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setDisplayName(user.displayName ?? '');
    setPronouns(user.pronouns ?? '');
    setBio(user.bio ?? '');
    setProfileColor(user.profileColor ?? '#5865F2');
    setProfileEffect(user.profileEffect ?? 'none');
    setStatus(user.status);
    setCustomStatus(user.customStatus ?? null);
    setStatusEmoji(user.statusEmoji ?? '');
  }, [open, setCustomStatus, setStatus, user]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [open, theme]);

  if (!open) return null;

  async function saveProfile() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || null,
          pronouns: pronouns || null,
          bio: bio || null,
          profileColor: profileColor || null,
          profileEffect: profileEffect === 'none' ? null : profileEffect
        })
      });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('user' in json)) {
        setError('Sauvegarde impossible');
        return;
      }
      const { user: updated } = json as { user: typeof user };
      setUser({ ...user, ...updated });
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/users/me/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          customStatus: customStatus ?? null,
          statusEmoji: statusEmoji || null
        })
      });
      const json: unknown = await res.json();
      if (!res.ok || !json || typeof json !== 'object' || !('user' in json)) {
        setError('Sauvegarde impossible');
        return;
      }
      const { user: updated } = json as { user: { status: typeof status; customStatus: string | null; statusEmoji: string | null } };
      setStatus(updated.status);
      setCustomStatus(updated.customStatus);
      setUser({ ...user, status: updated.status, customStatus: updated.customStatus, statusEmoji: updated.statusEmoji });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/85" onClick={close} />
      <div className="relative ml-auto flex h-full w-full max-w-3xl">
        <div className="flex w-[220px] shrink-0 flex-col bg-bg-secondary p-3">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Paramètres</div>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'account' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ settingsTab: 'account' })}
          >
            Mon compte
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'profile' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ settingsTab: 'profile' })}
          >
            Profil
          </button>
          <button
            className={cn(
              'rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-bg-quaternary hover:text-text-primary',
              tab === 'appearance' && 'bg-bg-quaternary text-text-primary'
            )}
            onClick={() => useUIStore.setState({ settingsTab: 'appearance' })}
          >
            Apparence
          </button>
          <div className="mt-auto">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={close}>
              Fermer
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
          <div className="flex h-12 items-center justify-between border-b border-separator px-4">
            <div className="text-sm font-semibold text-text-primary">
              {tab === 'account' ? 'Mon compte' : tab === 'profile' ? 'Profil' : 'Apparence'}
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Fermer" onClick={close}>
              <X size={18} />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className={cn('rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red', !error && 'hidden')}>{error}</div>

            {tab === 'account' ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg bg-bg-secondary p-4">
                  <div className="text-sm font-semibold text-text-primary">Statut</div>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as typeof status)}
                        className="h-10 w-full rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary outline-none"
                      >
                        <option value="ONLINE">En ligne</option>
                        <option value="IDLE">Absent</option>
                        <option value="DO_NOT_DISTURB">Ne pas déranger</option>
                        <option value="INVISIBLE">Invisible</option>
                        <option value="OFFLINE">Hors ligne</option>
                      </select>
                      <Input
                        value={statusEmoji}
                        onChange={(e) => setStatusEmoji(e.target.value)}
                        placeholder="Emoji"
                        className="w-[120px]"
                      />
                    </div>
                    <Input
                      value={customStatus ?? ''}
                      onChange={(e) => setCustomStatus(e.target.value || null)}
                      placeholder="Statut personnalisé"
                    />
                    <Button onClick={() => void saveStatus()} disabled={saving}>
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'profile' ? (
              <div className="rounded-lg bg-bg-secondary p-4">
                <div className="text-sm font-semibold text-text-primary">Profil</div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex flex-col gap-2 rounded-md bg-bg-tertiary p-3">
                    <div className="text-sm font-semibold text-text-primary">Bannière</div>
                    <input
                      aria-label="Choisir une bannière"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        setError(null);
                        const data = new FormData();
                        data.append('file', file);
                        const res = await fetch('/api/users/me/banner', { method: 'POST', body: data });
                        const json: unknown = await res.json();
                        if (!res.ok || !json || typeof json !== 'object' || !('bannerUrl' in json)) {
                          setError('Upload bannière impossible');
                          return;
                        }
                        const { bannerUrl } = json as { bannerUrl: string };
                        setUser({ ...user, bannerUrl });
                      }}
                      className="text-sm"
                    />
                    {user?.bannerUrl ? (
                      <div className="overflow-hidden rounded-md border border-separator">
                        <RemoteImage src={user.bannerUrl} alt="Bannière" className="h-[120px] w-full object-cover" />
                      </div>
                    ) : null}
                  </div>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nom affiché" />
                  <Input value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="Pronoms" />
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-[90px] w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary outline-none"
                    placeholder="Bio (max 190)"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={profileColor}
                      onChange={(e) => setProfileColor(e.target.value)}
                      placeholder="#5865F2"
                      className="w-[160px]"
                    />
                    <select
                      value={profileEffect}
                      onChange={(e) => setProfileEffect(e.target.value)}
                      className="h-10 w-full rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary outline-none"
                    >
                      <option value="none">Aucun effet</option>
                      <option value="confetti">Confetti</option>
                      <option value="snow">Snow</option>
                      <option value="fire">Fire</option>
                      <option value="stars">Stars</option>
                      <option value="aurora">Aurora</option>
                      <option value="matrix">Matrix</option>
                      <option value="bubbles">Bubbles</option>
                    </select>
                  </div>
                  <Button onClick={() => void saveProfile()} disabled={saving}>
                    Sauvegarder
                  </Button>
                </div>
              </div>
            ) : null}

            {tab === 'appearance' ? (
              <div className="rounded-lg bg-bg-secondary p-4">
                <div className="text-sm font-semibold text-text-primary">Thème</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant={theme === 'dark' ? 'secondary' : 'ghost'} onClick={() => setTheme('dark')}>
                    Sombre
                  </Button>
                  <Button variant={theme === 'light' ? 'secondary' : 'ghost'} onClick={() => setTheme('light')}>
                    Clair
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
