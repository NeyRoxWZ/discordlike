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

function parseUsernameOrTag(input: string) {
  const trimmed = input.trim();
  const parts = trimmed.split('#');
  if (parts.length === 2) {
    return { username: parts[0] ?? '', discriminator: parts[1] ?? '' };
  }
  return { username: trimmed, discriminator: null as string | null };
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [friends, incoming, outgoing, blocked] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        friend: { select: { id: true, username: true, discriminator: true, avatarUrl: true, status: true } }
      }
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        sender: { select: { id: true, username: true, discriminator: true, avatarUrl: true, status: true } }
      }
    }),
    prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        receiver: { select: { id: true, username: true, discriminator: true, avatarUrl: true, status: true } }
      }
    }),
    prisma.blockedUser.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        blocked: { select: { id: true, username: true, discriminator: true, avatarUrl: true, status: true } }
      }
    })
  ]);

  return NextResponse.json({
    friends: friends.map((f) => f.friend),
    incoming,
    outgoing,
    blocked: blocked.map((b) => b.blocked)
  });
}

const sendRequestSchema = z.object({
  usernameOrTag: z.string().min(1).max(80)
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = sendRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { username, discriminator } = parseUsernameOrTag(parsed.data.usernameOrTag);
  if (!username) return NextResponse.json({ error: 'Invalid username' }, { status: 400 });

  const receiver = await prisma.user.findFirst({
    where: discriminator ? { username, discriminator } : { username },
    select: { id: true }
  });
  if (!receiver) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (receiver.id === userId) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });

  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: receiver.id },
        { blockerId: receiver.id, blockedId: userId }
      ]
    },
    select: { id: true }
  });
  if (blocked) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existingFriend = await prisma.friendship.findFirst({
    where: { userId, friendId: receiver.id },
    select: { id: true }
  });
  if (existingFriend) return NextResponse.json({ ok: true });

  await prisma.friendRequest.upsert({
    where: { senderId_receiverId: { senderId: userId, receiverId: receiver.id } },
    update: { status: 'PENDING' },
    create: { senderId: userId, receiverId: receiver.id, status: 'PENDING' }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), requestId: z.string().min(1) }),
  z.object({ action: z.literal('decline'), requestId: z.string().min(1) }),
  z.object({ action: z.literal('remove'), friendId: z.string().min(1) }),
  z.object({ action: z.literal('block'), userId: z.string().min(1) }),
  z.object({ action: z.literal('unblock'), userId: z.string().min(1) })
]);

export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  if (parsed.data.action === 'accept' || parsed.data.action === 'decline') {
    const reqRow = await prisma.friendRequest.findFirst({
      where: { id: parsed.data.requestId, receiverId: userId, status: 'PENDING' },
      select: { id: true, senderId: true }
    });
    if (!reqRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (parsed.data.action === 'decline') {
      await prisma.friendRequest.update({ where: { id: reqRow.id }, data: { status: 'DECLINED' } });
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: reqRow.id }, data: { status: 'ACCEPTED' } }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId, friendId: reqRow.senderId } },
        update: {},
        create: { userId, friendId: reqRow.senderId }
      }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId: reqRow.senderId, friendId: userId } },
        update: {},
        create: { userId: reqRow.senderId, friendId: userId }
      })
    ]);

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'remove') {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: parsed.data.friendId },
          { userId: parsed.data.friendId, friendId: userId }
        ]
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'block') {
    if (parsed.data.userId === userId) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    await prisma.$transaction([
      prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: parsed.data.userId } },
        update: {},
        create: { blockerId: userId, blockedId: parsed.data.userId }
      }),
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId: parsed.data.userId },
            { userId: parsed.data.userId, friendId: userId }
          ]
        }
      }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: parsed.data.userId },
            { senderId: parsed.data.userId, receiverId: userId }
          ]
        }
      })
    ]);
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'unblock') {
    await prisma.blockedUser.deleteMany({ where: { blockerId: userId, blockedId: parsed.data.userId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

