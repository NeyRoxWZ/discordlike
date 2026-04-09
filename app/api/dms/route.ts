import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
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

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await prisma.dMConversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      isGroupDM: true,
      groupName: true,
      groupIconUrl: true,
      updatedAt: true,
      participants: {
        select: {
          userId: true,
          lastRead: true,
          user: { select: { id: true, username: true, discriminator: true, avatarUrl: true } }
        }
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true } }
    }
  });

  const shaped = conversations.map((c) => {
    const me = c.participants.find((p) => p.userId === userId);
    const lastRead = me?.lastRead ?? null;
    const lastMessageAt = c.messages[0]?.createdAt ?? null;
    const unread = Boolean(lastMessageAt && (!lastRead || lastMessageAt.getTime() > lastRead.getTime()));
    return { ...c, unread };
  });

  return NextResponse.json({ conversations: shaped });
}

const createSchema = z.object({
  targetUserId: z.string().min(1)
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  if (parsed.data.targetUserId === userId) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: parsed.data.targetUserId },
        { blockerId: parsed.data.targetUserId, blockedId: userId }
      ]
    },
    select: { id: true }
  });
  if (blocked) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existingCandidates = await prisma.dMConversation.findMany({
    where: {
      isGroupDM: false,
      participants: { some: { userId } }
    },
    select: { id: true, participants: { select: { userId: true } } }
  });

  const existing = existingCandidates.find((c) => {
    const ids = c.participants.map((p) => p.userId);
    return ids.length === 2 && ids.includes(userId) && ids.includes(parsed.data.targetUserId);
  });

  if (existing) return NextResponse.json({ conversationId: existing.id });

  const created = await prisma.dMConversation.create({
    data: {
      isGroupDM: false,
      participants: {
        create: [{ userId }, { userId: parsed.data.targetUserId }]
      }
    },
    select: { id: true }
  });

  return NextResponse.json({ conversationId: created.id }, { status: 201 });
}
