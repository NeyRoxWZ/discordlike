import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { computeChannelPermissions, computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId');
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } });
  if (!channel?.serverId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [member, everyoneRole, overwrites] = await Promise.all([
    prisma.member.findFirst({
      where: { userId, serverId: channel.serverId },
      select: { roles: { select: { role: { select: { id: true, permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId: channel.serverId, isEveryone: true }, select: { id: true, permissions: true } }),
    prisma.permissionOverwrite.findMany({ where: { channelId }, select: { type: true, targetId: true, allow: true, deny: true } })
  ]);

  if (!member || !everyoneRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  if (!hasPermission(channelPerms, Permissions.VIEW_CHANNEL) || !hasPermission(channelPerms, Permissions.READ_MESSAGE_HISTORY)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pinned = await prisma.message.findMany({
    where: { channelId, pinned: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, username: true, discriminator: true, avatarUrl: true } },
      attachments: { select: { id: true, url: true, filename: true, size: true, contentType: true, width: true, height: true } }
    }
  });

  return NextResponse.json({ messages: pinned });
}
