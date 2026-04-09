import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { computeChannelPermissions, computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
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

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const server = await prisma.server.findFirst({
    where: { id: ctx.params.serverId, members: { some: { userId } } },
    select: { id: true, name: true, iconUrl: true }
  });

  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [channels, categories, member, everyoneRole] = await Promise.all([
    prisma.channel.findMany({
      where: { serverId: server.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, type: true, categoryId: true }
    }),
    prisma.channelCategory.findMany({
      where: { serverId: server.id },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, position: true }
    }),
    prisma.member.findFirst({
      where: { serverId: server.id, userId },
      select: { roles: { select: { role: { select: { id: true, permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId: server.id, isEveryone: true }, select: { id: true, permissions: true } })
  ]);

  if (!member || !everyoneRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overwrites = await prisma.permissionOverwrite.findMany({
    where: { channelId: { in: channels.map((c) => c.id) } },
    select: { channelId: true, type: true, targetId: true, allow: true, deny: true }
  });

  const overwritesByChannel = new Map<
    string,
    Array<{ type: 'ROLE' | 'MEMBER'; targetId: string; allow: bigint; deny: bigint }>
  >();
  for (const o of overwrites) {
    const arr = overwritesByChannel.get(o.channelId) ?? [];
    arr.push({ type: o.type, targetId: o.targetId, allow: o.allow, deny: o.deny });
    overwritesByChannel.set(o.channelId, arr);
  }

  const basePerms = computeMemberPermissions(
    { roles: member.roles.map((r) => ({ role: { permissions: r.role.permissions } })) },
    { permissions: everyoneRole.permissions }
  );
  const roleIds = member.roles.map((r) => r.role.id).filter((id) => id !== everyoneRole.id);

  const visibleChannels = channels.filter((c) => {
    const perms = computeChannelPermissions(basePerms, overwritesByChannel.get(c.id) ?? [], roleIds, userId, everyoneRole.id);
    return hasPermission(perms, Permissions.VIEW_CHANNEL);
  });

  return NextResponse.json({ server, channels: visibleChannels, categories });
}
