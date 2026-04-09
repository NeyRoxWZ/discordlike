import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import { prisma } from '@/lib/prisma';
import { computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { serverId: string };
}

async function getCurrentUserId() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const supabaseId = session?.user?.id;
  if (!supabaseId) return null;

  const user = await prisma.user.findUnique({ where: { supabaseId }, select: { id: true } });
  return user?.id ?? null;
}

async function requireMemberPermissions(serverId: string, userId: string) {
  const [member, everyoneRole, server] = await Promise.all([
    prisma.member.findFirst({
      where: { serverId, userId },
      select: { id: true, roles: { select: { role: { select: { permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId, isEveryone: true }, select: { permissions: true } }),
    prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } })
  ]);

  if (!member || !everyoneRole || !server) return null;
  const perms = computeMemberPermissions(member, everyoneRole);
  const isOwner = server.ownerId === userId;
  return { perms, isOwner };
}

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireMemberPermissions(ctx.params.serverId, userId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!access.isOwner && !hasPermission(access.perms, Permissions.MANAGE_GUILD)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: { createdAt: 'desc' },
    select: { code: true, channelId: true, uses: true, maxUses: true, maxAge: true, expiresAt: true, createdAt: true }
  });

  return NextResponse.json({ invites });
}

const createSchema = z.object({
  channelId: z.string().min(1).optional(),
  maxUses: z.number().int().min(0).max(1000).optional(),
  maxAge: z.number().int().min(0).max(60 * 60 * 24 * 30).optional(),
  temporary: z.boolean().optional()
});

export async function POST(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireMemberPermissions(ctx.params.serverId, userId);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (
    !access.isOwner &&
    !hasPermission(access.perms, Permissions.CREATE_INSTANT_INVITE) &&
    !hasPermission(access.perms, Permissions.MANAGE_GUILD)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const maxUses = parsed.data.maxUses ?? 0;
  const maxAge = parsed.data.maxAge ?? 0;
  const expiresAt = maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : null;

  for (let i = 0; i < 5; i++) {
    const code = nanoid(8);
    try {
      const created = await prisma.invite.create({
        data: {
          code,
          serverId: ctx.params.serverId,
          channelId: parsed.data.channelId ?? null,
          inviterId: userId,
          maxUses,
          maxAge,
          temporary: parsed.data.temporary ?? false,
          expiresAt
        },
        select: { code: true }
      });

      const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const url = origin ? `${origin.replace(/\/$/, '')}/invite/${created.code}` : `/invite/${created.code}`;

      return NextResponse.json({ invite: { code: created.code, url } }, { status: 201 });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'Invite creation failed' }, { status: 500 });
}

