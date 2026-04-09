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

async function requireManageRoles(serverId: string, userId: string) {
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
  return hasPermission(perms, Permissions.MANAGE_ROLES);
}

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMember = await prisma.member.findFirst({
    where: { serverId: ctx.params.serverId, userId },
    select: { id: true }
  });
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const roles = await prisma.role.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: [{ position: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      color: true,
      hoist: true,
      icon: true,
      unicodeEmoji: true,
      position: true,
      permissions: true,
      mentionable: true,
      managed: true,
      isEveryone: true
    }
  });

  return NextResponse.json({
    roles: roles.map((r) => ({
      ...r,
      permissions: r.permissions.toString()
    }))
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.number().int().min(0).max(16777215).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  permissions: z.string().optional()
});

export async function POST(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageRoles(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const maxPos = await prisma.role.findFirst({
    where: { serverId: ctx.params.serverId },
    orderBy: { position: 'desc' },
    select: { position: true }
  });

  const perms = parsed.data.permissions ? BigInt(parsed.data.permissions) : 0n;

  const created = await prisma.role.create({
    data: {
      serverId: ctx.params.serverId,
      name: parsed.data.name,
      color: parsed.data.color ?? 0,
      hoist: parsed.data.hoist ?? false,
      mentionable: parsed.data.mentionable ?? false,
      permissions: perms,
      position: (maxPos?.position ?? 0) + 1
    },
    select: { id: true }
  });

  return NextResponse.json({ roleId: created.id }, { status: 201 });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    roleId: z.string().min(1),
    name: z.string().min(1).max(64).optional(),
    color: z.number().int().min(0).max(16777215).optional(),
    hoist: z.boolean().optional(),
    mentionable: z.boolean().optional(),
    permissions: z.string().optional()
  }),
  z.object({
    action: z.literal('delete'),
    roleId: z.string().min(1)
  })
]);

export async function PATCH(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageRoles(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, serverId: ctx.params.serverId },
    select: { id: true, isEveryone: true }
  });
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (role.isEveryone) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (parsed.data.action === 'delete') {
    await prisma.role.delete({ where: { id: role.id } });
    return NextResponse.json({ ok: true });
  }

  const nextPerms = parsed.data.permissions ? BigInt(parsed.data.permissions) : undefined;

  await prisma.role.update({
    where: { id: role.id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      hoist: parsed.data.hoist,
      mentionable: parsed.data.mentionable,
      permissions: nextPerms
    }
  });

  return NextResponse.json({ ok: true });
}
