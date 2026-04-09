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

async function requireManageChannels(serverId: string, userId: string) {
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
  return hasPermission(perms, Permissions.MANAGE_CHANNELS);
}

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMember = await prisma.member.findFirst({
    where: { serverId: ctx.params.serverId, userId },
    select: { id: true }
  });
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const channels = await prisma.channel.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      topic: true,
      position: true,
      isNsfw: true,
      slowMode: true,
      categoryId: true
    }
  });

  return NextResponse.json({ channels });
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['TEXT', 'VOICE', 'ANNOUNCEMENT', 'STAGE', 'FORUM']).optional(),
  categoryId: z.string().min(1).nullable().optional()
});

export async function POST(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageChannels(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const maxPos = await prisma.channel.findFirst({
    where: { serverId: ctx.params.serverId },
    orderBy: { position: 'desc' },
    select: { position: true }
  });

  const created = await prisma.channel.create({
    data: {
      serverId: ctx.params.serverId,
      name: parsed.data.name,
      type: parsed.data.type ?? 'TEXT',
      position: (maxPos?.position ?? 0) + 1,
      categoryId: parsed.data.categoryId ?? null
    },
    select: { id: true }
  });

  return NextResponse.json({ channelId: created.id }, { status: 201 });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    channelId: z.string().min(1),
    name: z.string().min(1).max(64).optional(),
    topic: z.string().max(190).nullable().optional(),
    isNsfw: z.boolean().optional(),
    slowMode: z.number().int().min(0).max(21600).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    position: z.number().int().min(0).max(100000).optional()
  }),
  z.object({
    action: z.literal('delete'),
    channelId: z.string().min(1)
  }),
  z.object({
    action: z.literal('reorder'),
    order: z.array(z.object({ id: z.string().min(1), position: z.number().int().min(0).max(100000) })).min(1).max(1000)
  })
]);

export async function PATCH(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageChannels(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  if (parsed.data.action === 'reorder') {
    await prisma.$transaction(
      parsed.data.order.map((o) => prisma.channel.update({ where: { id: o.id }, data: { position: o.position } }))
    );
    return NextResponse.json({ ok: true });
  }

  const channel = await prisma.channel.findFirst({
    where: { id: parsed.data.channelId, serverId: ctx.params.serverId },
    select: { id: true }
  });
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.action === 'delete') {
    await prisma.channel.delete({ where: { id: channel.id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      name: parsed.data.name,
      topic: parsed.data.topic ?? undefined,
      isNsfw: parsed.data.isNsfw,
      slowMode: parsed.data.slowMode,
      categoryId: parsed.data.categoryId ?? undefined,
      position: parsed.data.position
    }
  });

  return NextResponse.json({ ok: true });
}
