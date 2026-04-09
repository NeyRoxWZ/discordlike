import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
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

export async function GET(req: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMember = await prisma.member.findFirst({
    where: { serverId: ctx.params.serverId, userId },
    select: { id: true }
  });
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Number(url.searchParams.get('page') ?? '1');
  const perPage = 50;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const skip = (safePage - 1) * perPage;

  const where = q
    ? {
        serverId: ctx.params.serverId,
        OR: [
          { nickname: { contains: q, mode: 'insensitive' as const } },
          { user: { username: { contains: q, mode: 'insensitive' as const } } },
          { user: { displayName: { contains: q, mode: 'insensitive' as const } } }
        ]
      }
    : { serverId: ctx.params.serverId };

  const members = await prisma.member.findMany({
    where,
    orderBy: [{ joinedAt: 'asc' }],
    skip,
    take: perPage,
    select: {
      id: true,
      nickname: true,
      joinedAt: true,
      timedOutUntil: true,
      user: {
        select: { id: true, username: true, discriminator: true, avatarUrl: true, status: true }
      },
      roles: {
        select: {
          role: { select: { id: true, name: true, color: true, hoist: true, position: true, isEveryone: true } }
        }
      }
    }
  });

  const roles = await prisma.role.findMany({
    where: { serverId: ctx.params.serverId },
    orderBy: [{ position: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, color: true, hoist: true, position: true, isEveryone: true }
  });

  return NextResponse.json({ members, roles, page: safePage, perPage });
}
