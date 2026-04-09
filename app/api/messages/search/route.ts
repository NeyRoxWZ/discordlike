import { NextResponse } from 'next/server';
import { z } from 'zod';

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

const schema = z.object({
  serverId: z.string().min(1),
  q: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(50).optional()
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = schema.safeParse({
    serverId: url.searchParams.get('serverId'),
    q: url.searchParams.get('q'),
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const [member, everyoneRole, channels] = await Promise.all([
    prisma.member.findFirst({
      where: { serverId: parsed.data.serverId, userId },
      select: { roles: { select: { role: { select: { id: true, permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId: parsed.data.serverId, isEveryone: true }, select: { id: true, permissions: true } }),
    prisma.channel.findMany({ where: { serverId: parsed.data.serverId, type: 'TEXT' }, select: { id: true, name: true } })
  ]);

  if (!member || !everyoneRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overwrites = await prisma.permissionOverwrite.findMany({
    where: { channelId: { in: channels.map((c) => c.id) } },
    select: { channelId: true, type: true, targetId: true, allow: true, deny: true }
  });

  const overwritesByChannel = new Map<string, Array<{ type: 'ROLE' | 'MEMBER'; targetId: string; allow: bigint; deny: bigint }>>();
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

  const visibleChannelIds = channels
    .filter((c) => {
      const perms = computeChannelPermissions(basePerms, overwritesByChannel.get(c.id) ?? [], roleIds, userId, everyoneRole.id);
      return hasPermission(perms, Permissions.VIEW_CHANNEL) && hasPermission(perms, Permissions.READ_MESSAGE_HISTORY);
    })
    .map((c) => c.id);

  const results = await prisma.message.findMany({
    where: {
      channelId: { in: visibleChannelIds },
      content: { contains: parsed.data.q, mode: 'insensitive' }
    },
    orderBy: [{ createdAt: 'desc' }],
    take: parsed.data.limit ?? 20,
    select: {
      id: true,
      content: true,
      createdAt: true,
      channelId: true,
      author: { select: { username: true, discriminator: true } }
    }
  });

  const channelById = new Map(channels.map((c) => [c.id, c]));

  return NextResponse.json({
    results: results.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      content: r.content,
      channel: channelById.get(r.channelId ?? '') ?? null,
      author: r.author ? `${r.author.username}#${r.author.discriminator}` : null
    }))
  });
}

