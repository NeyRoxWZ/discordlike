'use client';

import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { MessageAttachment } from '@/hooks/useMessages';

interface Props {
  placeholder: string;
  disabled?: boolean;
  onSend: (content: string) => Promise<unknown>;
  onTyping?: () => void;
  onSendWithAttachments?: (content: string, attachments: Omit<MessageAttachment, 'id'>[]) => Promise<unknown>;
}

type PendingAttachment = Omit<MessageAttachment, 'id'>;

export function MessageInput({ placeholder, disabled, onSend, onTyping, onSendWithAttachments }: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, window.innerHeight * 0.5);
    el.style.height = `${next}px`;
  }, [value]);

  async function send() {
    const content = value.trim();
    const hasAttachments = attachments.length > 0;
    if ((!content && !hasAttachments) || disabled || sending) return;
    setSending(true);
    try {
      if (hasAttachments && onSendWithAttachments) {
        await onSendWithAttachments(content, attachments);
      } else {
        await onSend(content);
      }
      setValue('');
      setAttachments([]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-separator p-3">
      <div className="flex items-end gap-2 rounded-lg bg-bg-quaternary px-3 py-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            const uploaded: PendingAttachment[] = [];
            for (const f of files.slice(0, 10)) {
              const data = new FormData();
              data.append('file', f);
              const res = await fetch('/api/upload', { method: 'POST', body: data });
              const json: unknown = await res.json();
              if (res.ok && json && typeof json === 'object' && 'file' in json) {
                const { file } = json as { file: PendingAttachment };
                uploaded.push(file);
              }
            }
            setAttachments((prev) => [...prev, ...uploaded].slice(0, 10));
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        <Button
          aria-label="Ajouter un fichier"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 rounded-md p-0"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || sending}
        >
          +
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onTyping?.();
          }}
          onKeyDown={(e) => {
            onTyping?.();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={disabled || sending}
          placeholder={placeholder}
          className={cn(
            'max-h-[50vh] min-h-[40px] w-full resize-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted',
            (disabled || sending) && 'opacity-60'
          )}
        />
        <Button
          aria-label="Envoyer"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 rounded-md p-0"
          onClick={() => void send()}
          disabled={disabled || sending || (!value.trim() && !attachments.length)}
        >
          <PaperPlaneTilt size={18} />
        </Button>
      </div>
      {attachments.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <button
              key={a.url}
              className="max-w-[260px] truncate rounded-md bg-bg-tertiary px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
            >
              {a.filename}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
