import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { serverId: string; memberId: string };
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

function maxRolePosition(roles: Array<{ role: { position: number; isEveryone: boolean } }>) {
  return roles
    .filter((r) => !r.role.isEveryone)
    .reduce((max, r) => Math.max(max, r.role.position), 0);
}

async function getRequesterContext(serverId: string, userId: string) {
  const [server, member, everyoneRole] = await Promise.all([
    prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } }),
    prisma.member.findFirst({
      where: { serverId, userId },
      select: { id: true, roles: { select: { role: { select: { id: true, permissions: true, position: true, isEveryone: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId, isEveryone: true }, select: { id: true, permissions: true } })
  ]);

  if (!server || !member || !everyoneRole) return null;
  const isOwner = server.ownerId === userId;
  const perms = computeMemberPermissions(
    { roles: member.roles.map((r) => ({ role: { permissions: r.role.permissions } })) },
    { permissions: everyoneRole.permissions }
  );
  const topPos = maxRolePosition(member.roles);
  return { server, member, perms, isOwner, topPos, everyoneRoleId: everyoneRole.id };
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('nickname'), nickname: z.string().max(32).nullable() }),
  z.object({ action: z.literal('timeout'), minutes: z.number().int().min(0).max(60 * 24 * 28) }),
  z.object({ action: z.literal('kick') }),
  z.object({ action: z.literal('ban'), reason: z.string().max(190).nullable().optional() }),
  z.object({ action: z.literal('setRoles'), roleIds: z.array(z.string().min(1)).max(100) })
]);

export async function PATCH(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requester = await getRequesterContext(ctx.params.serverId, userId);
  if (!requester) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const target = await prisma.member.findFirst({
    where: { id: ctx.params.memberId, serverId: ctx.params.serverId },
    select: {
      id: true,
      userId: true,
      nickname: true,
      roles: { select: { role: { select: { id: true, position: true, isEveryone: true } } } }
    }
  });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.userId === requester.server.ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const targetTopPos = maxRolePosition(target.roles);
  if (!requester.isOwner && requester.topPos <= targetTopPos) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (parsed.data.action === 'nickname') {
    const canChangeSelf = requester.member.id === target.id && hasPermission(requester.perms, Permissions.CHANGE_NICKNAME);
    const canChangeOther = requester.member.id !== target.id && hasPermission(requester.perms, Permissions.MANAGE_NICKNAMES);
    if (!requester.isOwner && !canChangeSelf && !canChangeOther) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.member.update({ where: { id: target.id }, data: { nickname: parsed.data.nickname } });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'timeout') {
    if (!requester.isOwner && !hasPermission(requester.perms, Permissions.MODERATE_MEMBERS)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const until = parsed.data.minutes > 0 ? new Date(Date.now() + parsed.data.minutes * 60 * 1000) : null;
    await prisma.member.update({ where: { id: target.id }, data: { timedOutUntil: until } });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'kick') {
    if (!requester.isOwner && !hasPermission(requester.perms, Permissions.KICK_MEMBERS)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.member.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'ban') {
    if (!requester.isOwner && !hasPermission(requester.perms, Permissions.BAN_MEMBERS)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const reason = parsed.data.reason ?? null;
    await prisma.$transaction(async (tx) => {
      await tx.ban.upsert({
        where: { serverId_userId: { serverId: ctx.params.serverId, userId: target.userId } },
        update: { reason, bannedAt: new Date() },
        create: { serverId: ctx.params.serverId, userId: target.userId, reason }
      });
      await tx.member.delete({ where: { id: target.id } });
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'setRoles') {
    if (!requester.isOwner && !hasPermission(requester.perms, Permissions.MANAGE_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
      where: { serverId: ctx.params.serverId, id: { in: parsed.data.roleIds } },
      select: { id: true, position: true, isEveryone: true }
    });

    if (!requester.isOwner) {
      const invalid = roles.some((r) => !r.isEveryone && r.position >= requester.topPos);
      if (invalid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roleIds = Array.from(new Set(roles.map((r) => r.id)));
    if (!roleIds.includes(requester.everyoneRoleId)) roleIds.push(requester.everyoneRoleId);

    await prisma.$transaction(async (tx) => {
      await tx.memberRole.deleteMany({ where: { memberId: target.id } });
      await tx.memberRole.createMany({ data: roleIds.map((roleId) => ({ memberId: target.id, roleId })) });
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
