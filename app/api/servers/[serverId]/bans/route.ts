import { NextResponse } from 'next/server';
import { z } from 'zod';

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

async function requireBanPermission(serverId: string, userId: string) {
  const [server, member, everyoneRole] = await Promise.all([
    prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } }),
    prisma.member.findFirst({
      where: { serverId, userId },
      select: { roles: { select: { role: { select: { permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId, isEveryone: true }, select: { permissions: true } })
  ]);

  if (!server || !member || !everyoneRole) return false;
  if (server.ownerId === userId) return true;
  const perms = computeMemberPermissions(member, everyoneRole);
  return hasPermission(perms, Permissions.BAN_MEMBERS);
}

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireBanPermission(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const bans = await prisma.ban.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: { bannedAt: 'desc' },
    select: { userId: true, reason: true, bannedAt: true }
  });

  const users = await prisma.user.findMany({
    where: { id: { in: bans.map((b) => b.userId) } },
    select: { id: true, username: true, discriminator: true, avatarUrl: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    bans: bans.map((b) => ({ ...b, user: byId.get(b.userId) ?? null }))
  });
}

const deleteSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireBanPermission(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  await prisma.ban.deleteMany({ where: { serverId: ctx.params.serverId, userId: parsed.data.userId } });
  return NextResponse.json({ ok: true });
}

