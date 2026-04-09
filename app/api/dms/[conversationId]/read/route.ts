import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { conversationId: string };
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

export async function POST(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const participant = await prisma.dMParticipant.findFirst({
    where: { userId, conversationId: ctx.params.conversationId },
    select: { id: true }
  });
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.dMParticipant.update({
    where: { id: participant.id },
    data: { lastRead: new Date() }
  });

  return NextResponse.json({ ok: true });
}

