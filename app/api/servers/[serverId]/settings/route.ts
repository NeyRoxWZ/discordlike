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

async function requireManageGuild(serverId: string, userId: string) {
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
  return hasPermission(perms, Permissions.MANAGE_GUILD);
}

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMember = await prisma.member.findFirst({
    where: { serverId: ctx.params.serverId, userId },
    select: { id: true }
  });
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const server = await prisma.server.findUnique({
    where: { id: ctx.params.serverId },
    select: { id: true, name: true, description: true, iconUrl: true, bannerUrl: true, vanityUrl: true, ownerId: true }
  });

  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ server });
}

const schema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(190).nullable().optional(),
  vanityUrl: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9-]+$/)
    .nullable()
    .optional(),
  iconUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional()
});

export async function PATCH(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageGuild(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const updated = await prisma.server.update({
    where: { id: ctx.params.serverId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      vanityUrl: parsed.data.vanityUrl,
      iconUrl: parsed.data.iconUrl,
      bannerUrl: parsed.data.bannerUrl
    },
    select: { id: true, name: true, description: true, iconUrl: true, bannerUrl: true, vanityUrl: true }
  });

  return NextResponse.json({ server: updated });
}

