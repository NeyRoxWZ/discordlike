import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { computeChannelPermissions, computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { messageId: string };
}

async function getCurrentUser() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    select: { id: true }
  });
  return user;
}

async function canManageChannelMessage(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } });
  if (!channel?.serverId) return false;

  const [server, member, everyoneRole, overwrites] = await Promise.all([
    prisma.server.findUnique({ where: { id: channel.serverId }, select: { ownerId: true } }),
    prisma.member.findFirst({
      where: { userId, serverId: channel.serverId },
      select: { roles: { select: { role: { select: { id: true, permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId: channel.serverId, isEveryone: true }, select: { id: true, permissions: true } }),
    prisma.permissionOverwrite.findMany({ where: { channelId }, select: { type: true, targetId: true, allow: true, deny: true } })
  ]);

  if (!server || !member || !everyoneRole) return false;
  if (server.ownerId === userId) return true;

  const basePerms = computeMemberPermissions(
    { roles: member.roles.map((r) => ({ role: { permissions: r.role.permissions } })) },
    { permissions: everyoneRole.permissions }
  );
  const roleIds = member.roles.map((r) => r.role.id).filter((id) => id !== everyoneRole.id);
  const channelPerms = computeChannelPermissions(
    basePerms,
    overwrites.map((o) => ({ type: o.type, targetId: o.targetId, allow: o.allow, deny: o.deny })),
    roleIds,
    userId,
    everyoneRole.id
  );

  return hasPermission(channelPerms, Permissions.MANAGE_MESSAGES);
}

export async function POST(_: Request, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const message = await prisma.message.findUnique({
    where: { id: ctx.params.messageId },
    select: { id: true, channelId: true, pinned: true }
  });
  if (!message || !message.channelId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = await canManageChannelMessage(me.id, message.channelId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { pinned: !message.pinned }
  });

  return NextResponse.json({ pinned: updated.pinned });
}
