'use client';

import { PencilSimple, PushPin, Smiley, Trash } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import { RemoteImage } from '@/components/ui/RemoteImage';
import { cn } from '@/lib/utils';
import type { MessageDTO } from '@/hooks/useMessages';

interface Props {
  message: MessageDTO;
}

export function MessageItem({ message }: Props) {
  const author = message.author;
  const createdAt = new Date(message.createdAt);
  const timeLabel = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(message.content ?? '');
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const content = useMemo(() => optimistic ?? message.content ?? '', [message.content, optimistic]);

  async function onDelete() {
    await fetch(`/api/messages/${message.id}`, { method: 'DELETE' });
  }

  async function onPin() {
    await fetch(`/api/messages/${message.id}/pin`, { method: 'POST' });
  }

  async function onReact() {
    await fetch(`/api/messages/${message.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '🙂' })
    });
  }

  async function onSave() {
    const text = value.trim();
    if (!text) return;
    setOptimistic(text);
    setIsEditing(false);
    await fetch(`/api/messages/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text })
    });
    setOptimistic(null);
  }

  return (
    <div className="group flex gap-3 rounded-md px-3 py-2 hover:bg-bg-quaternary">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-xs font-semibold text-text-primary',
          !author && 'opacity-60'
        )}
      >
        {author ? author.username.slice(0, 2).toUpperCase() : '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-text-primary">
            {author ? `${author.username}#${author.discriminator}` : 'Utilisateur'}
          </span>
          <span className="text-xs text-text-muted">{timeLabel}</span>
        </div>
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSave();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setValue(message.content ?? '');
                }
              }}
              className="w-full resize-none rounded-md bg-bg-tertiary p-2 text-sm text-text-primary outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button className="rounded-md bg-accent px-3 py-1 text-xs text-white hover:bg-accent-hover" onClick={() => void onSave()}>
                Enregistrer
              </button>
              <button
                className="rounded-md bg-bg-tertiary px-3 py-1 text-xs text-text-secondary hover:bg-bg-secondary"
                onClick={() => {
                  setIsEditing(false);
                  setValue(message.content ?? '');
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm text-text-primary">{content}</div>
        )}

        {message.attachments?.length ? (
          <div className="mt-2 flex flex-col gap-2">
            {message.attachments.map((a) => {
              const isImage = Boolean(a.contentType?.startsWith('image/'));
              return isImage ? (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
                  <RemoteImage
                    src={a.url}
                    alt={a.filename}
                    className="max-h-[320px] w-auto max-w-full rounded-md border border-separator bg-bg-tertiary"
                  />
                </a>
              ) : (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md border border-separator bg-bg-tertiary px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
                >
                  <span className="min-w-0 truncate">{a.filename}</span>
                  <span className="ml-3 shrink-0 text-xs text-text-muted">Télécharger</span>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
      {!isEditing ? (
        <div className="ml-2 hidden items-center gap-1 self-start pt-1 group-hover:flex">
          <button
            aria-label="Réagir"
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            onClick={() => void onReact()}
          >
            <Smiley size={16} />
          </button>
          <button
            aria-label="Épingler"
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            onClick={() => void onPin()}
          >
            <PushPin size={16} />
          </button>
          <button
            aria-label="Modifier"
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            onClick={() => setIsEditing(true)}
          >
            <PencilSimple size={16} />
          </button>
          <button
            aria-label="Supprimer"
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            onClick={() => void onDelete()}
          >
            <Trash size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
