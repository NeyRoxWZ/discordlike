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

  const categories = await prisma.channelCategory.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, position: true }
  });

  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().min(1).max(64)
});

export async function POST(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageChannels(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const maxPos = await prisma.channelCategory.findFirst({
    where: { serverId: ctx.params.serverId },
    orderBy: { position: 'desc' },
    select: { position: true }
  });

  const created = await prisma.channelCategory.create({
    data: { serverId: ctx.params.serverId, name: parsed.data.name, position: (maxPos?.position ?? 0) + 1 },
    select: { id: true }
  });

  return NextResponse.json({ categoryId: created.id }, { status: 201 });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), categoryId: z.string().min(1), name: z.string().min(1).max(64) }),
  z.object({ action: z.literal('delete'), categoryId: z.string().min(1) }),
  z.object({
    action: z.literal('reorder'),
    order: z.array(z.object({ id: z.string().min(1), position: z.number().int().min(0).max(100000) })).min(1).max(500)
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

  if (parsed.data.action === 'rename') {
    await prisma.channelCategory.update({
      where: { id: parsed.data.categoryId },
      data: { name: parsed.data.name }
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'delete') {
    const categoryId = parsed.data.categoryId;
    await prisma.$transaction(async (tx) => {
      await tx.channel.updateMany({ where: { categoryId }, data: { categoryId: null } });
      await tx.channelCategory.delete({ where: { id: categoryId } });
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(
    parsed.data.order.map((o) =>
      prisma.channelCategory.update({ where: { id: o.id }, data: { position: o.position } })
    )
  );
  return NextResponse.json({ ok: true });
}
