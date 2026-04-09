import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { serverId: string; channelId: string };
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

  const member = await prisma.member.findFirst({
    where: { serverId: ctx.params.serverId, userId },
    select: { id: true }
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overwrites = await prisma.permissionOverwrite.findMany({
    where: { channelId: ctx.params.channelId },
    orderBy: { id: 'asc' },
    select: { id: true, type: true, targetId: true, allow: true, deny: true }
  });

  return NextResponse.json({
    overwrites: overwrites.map((o) => ({ ...o, allow: o.allow.toString(), deny: o.deny.toString() }))
  });
}

const upsertSchema = z.object({
  type: z.enum(['ROLE', 'MEMBER']),
  targetId: z.string().min(1),
  allow: z.string().optional(),
  deny: z.string().optional()
});

export async function POST(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageChannels(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const allow = parsed.data.allow ? BigInt(parsed.data.allow) : 0n;
  const deny = parsed.data.deny ? BigInt(parsed.data.deny) : 0n;

  const row = await prisma.permissionOverwrite.upsert({
    where: { channelId_targetId_type: { channelId: ctx.params.channelId, targetId: parsed.data.targetId, type: parsed.data.type } },
    update: { allow, deny },
    create: { channelId: ctx.params.channelId, type: parsed.data.type, targetId: parsed.data.targetId, allow, deny },
    select: { id: true }
  });

  return NextResponse.json({ overwriteId: row.id }, { status: 201 });
}

const deleteSchema = z.object({
  id: z.string().min(1)
});

export async function DELETE(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageChannels(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  await prisma.permissionOverwrite.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}

