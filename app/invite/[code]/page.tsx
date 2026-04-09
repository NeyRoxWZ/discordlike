import Link from 'next/link';

import { AcceptInviteButton } from '@/components/invite/AcceptInviteButton';
import { prisma } from '@/lib/prisma';
import { getSupabaseServerComponentClient } from '@/lib/supabase/server';

interface Props {
  params: { code: string };
}

export default async function InvitePage({ params }: Props) {
  const invite = await prisma.invite.findUnique({
    where: { code: params.code },
    select: { code: true, serverId: true, expiresAt: true, uses: true, maxUses: true, server: { select: { name: true, iconUrl: true } } }
  });

  if (!invite) {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-16">
        <div className="mx-auto w-full max-w-md rounded-lg bg-bg-secondary p-6">
          <div className="text-lg font-semibold text-text-primary">Invitation invalide</div>
          <div className="mt-2 text-sm text-text-secondary">Ce lien d’invitation n’existe pas.</div>
          <div className="mt-6">
            <Link className="text-text-link hover:underline" href="/channels/@me">
              Retour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const expired = Boolean(invite.expiresAt && invite.expiresAt.getTime() < Date.now());
  const maxed = invite.maxUses > 0 && invite.uses >= invite.maxUses;

  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const isAuthed = Boolean(session?.user?.id);
  const next = `/invite/${invite.code}`;

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-lg bg-bg-secondary p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary text-sm font-semibold text-text-primary">
            {invite.server.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-text-primary">{invite.server.name}</div>
            <div className="text-sm text-text-secondary">Invitation Distollec</div>
          </div>
        </div>

        {expired || maxed ? (
          <div className="mt-6 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-red">
            Cette invitation est expirée.
          </div>
        ) : null}

        <div className="mt-6">
          {!isAuthed ? (
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Se connecter pour accepter
            </Link>
          ) : (
            <AcceptInviteButton code={invite.code} disabled={expired || maxed} />
          )}
        </div>
      </div>
    </div>
  );
}

