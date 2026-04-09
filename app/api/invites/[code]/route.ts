import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { code: string };
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
  const invite = await prisma.invite.findUnique({
    where: { code: ctx.params.code },
    select: {
      code: true,
      serverId: true,
      channelId: true,
      uses: true,
      maxUses: true,
      expiresAt: true,
      server: { select: { id: true, name: true, iconUrl: true } }
    }
  });

  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Expired' }, { status: 410 });
  }
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
    return NextResponse.json({ error: 'Max uses reached' }, { status: 410 });
  }

  const membersCount = await prisma.member.count({ where: { serverId: invite.serverId } });
  return NextResponse.json({
    invite: {
      code: invite.code,
      server: invite.server,
      membersCount
    }
  });
}

export async function POST(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invite = await prisma.invite.findUnique({
    where: { code: ctx.params.code },
    select: { code: true, serverId: true, uses: true, maxUses: true, expiresAt: true }
  });

  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Expired' }, { status: 410 });
  }
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
    return NextResponse.json({ error: 'Max uses reached' }, { status: 410 });
  }

  const existing = await prisma.member.findFirst({
    where: { serverId: invite.serverId, userId },
    select: { id: true }
  });
  if (existing) return NextResponse.json({ serverId: invite.serverId });

  const everyoneRole = await prisma.role.findFirst({
    where: { serverId: invite.serverId, isEveryone: true },
    select: { id: true }
  });
  if (!everyoneRole) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  await prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: { serverId: invite.serverId, userId },
      select: { id: true }
    });
    await tx.memberRole.create({ data: { memberId: member.id, roleId: everyoneRole.id } });
    await tx.invite.update({ where: { code: invite.code }, data: { uses: { increment: 1 } } });
  });

  return NextResponse.json({ serverId: invite.serverId }, { status: 201 });
}

