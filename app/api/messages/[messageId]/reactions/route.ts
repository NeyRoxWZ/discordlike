import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { messageId: string };
}

async function getCurrentUser() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    select: { id: true }
  });
  return user;
}

const bodySchema = z.object({
  emoji: z.string().min(1).max(64),
  isCustom: z.boolean().optional()
});

export async function POST(req: Request, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const message = await prisma.message.findUnique({
    where: { id: ctx.params.messageId },
    select: { id: true }
  });
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId: message.id, userId: me.id, emoji: parsed.data.emoji } },
    update: {},
    create: { messageId: message.id, userId: me.id, emoji: parsed.data.emoji, isCustom: parsed.data.isCustom ?? false }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  await prisma.messageReaction.deleteMany({
    where: { messageId: ctx.params.messageId, userId: me.id, emoji: parsed.data.emoji }
  });

  return NextResponse.json({ ok: true });
}
