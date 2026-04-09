import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { computeChannelPermissions, computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
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

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId');
  const dmConversationId = url.searchParams.get('dmConversationId');
  const before = url.searchParams.get('before');
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : null;
  if (!channelId && !dmConversationId) {
    return NextResponse.json({ error: 'channelId or dmConversationId required' }, { status: 400 });
  }

  if (channelId) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } });
    if (!channel?.serverId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [member, everyoneRole, overwrites] = await Promise.all([
      prisma.member.findFirst({
        where: { userId, serverId: channel.serverId },
        select: { id: true, roles: { select: { role: { select: { id: true, permissions: true, isEveryone: true } } } } }
      }),
      prisma.role.findFirst({ where: { serverId: channel.serverId, isEveryone: true }, select: { id: true, permissions: true } }),
      prisma.permissionOverwrite.findMany({
        where: { channelId },
        select: { type: true, targetId: true, allow: true, deny: true }
      })
    ]);

    if (!member || !everyoneRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const basePerms = computeMemberPermissions(
      { roles: member.roles.map((r) => ({ role: { permissions: r.role.permissions } })) },
      { permissions: everyoneRole.permissions }
    );

    const roleIds = member.roles.map((r) => r.role.id).filter((id) => id !== everyoneRole.id);
    const channelPerms = computeChannelPermissions(
      basePerms,
      overwrites.map((o) => ({ type: o.type, targetId: o.targetId, allow: o.allow, deny: o.deny })),
      roleIds,
      userId,
      everyoneRole.id
    );

    if (!hasPermission(channelPerms, Permissions.VIEW_CHANNEL) || !hasPermission(channelPerms, Permissions.READ_MESSAGE_HISTORY)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (dmConversationId) {
    const participant = await prisma.dMParticipant.findFirst({
      where: { userId, conversationId: dmConversationId },
      select: { id: true }
    });
    if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const take = limit && Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
  const useCursor = Boolean(before && before.length > 0);

  const messagesDesc = await prisma.message.findMany({
    where: channelId ? { channelId } : { dmConversationId: dmConversationId ?? undefined },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    ...(useCursor ? { cursor: { id: before! }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, username: true, discriminator: true, avatarUrl: true } },
      attachments: { select: { id: true, url: true, filename: true, size: true, contentType: true, width: true, height: true } },
      reactions: { select: { id: true, userId: true, emoji: true, isCustom: true } }
    }
  });

  const messages = [...messagesDesc].reverse();
  const nextCursor = messagesDesc.length === take ? messagesDesc[messagesDesc.length - 1]?.id ?? null : null;

  return NextResponse.json({ messages, nextCursor });
}

const createSchema = z
  .object({
    channelId: z.string().min(1).optional(),
    dmConversationId: z.string().min(1).optional(),
    content: z.string().max(4000).optional(),
    attachments: z
      .array(
        z.object({
          url: z.string().url(),
          filename: z.string().min(1).max(200),
          size: z.number().int().min(1).max(10 * 1024 * 1024),
          contentType: z.string().max(200).nullable().optional(),
          width: z.number().int().min(1).max(20000).nullable().optional(),
          height: z.number().int().min(1).max(20000).nullable().optional()
        })
      )
      .max(10)
      .optional()
  })
  .refine((v) => Boolean(v.channelId) !== Boolean(v.dmConversationId), {
    message: 'Provide either channelId or dmConversationId'
  })
  .refine((v) => Boolean(v.content?.trim()) || Boolean(v.attachments?.length), {
    message: 'Message must have content or attachments'
  });

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  if (parsed.data.channelId) {
    const channel = await prisma.channel.findUnique({
      where: { id: parsed.data.channelId },
      select: { id: true, serverId: true }
    });
    if (!channel?.serverId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [member, everyoneRole, overwrites] = await Promise.all([
      prisma.member.findFirst({
        where: { userId, serverId: channel.serverId },
        select: { id: true, roles: { select: { role: { select: { id: true, permissions: true } } } } }
      }),
      prisma.role.findFirst({ where: { serverId: channel.serverId, isEveryone: true }, select: { id: true, permissions: true } }),
      prisma.permissionOverwrite.findMany({
        where: { channelId: parsed.data.channelId },
        select: { type: true, targetId: true, allow: true, deny: true }
      })
    ]);

    if (!member || !everyoneRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const basePerms = computeMemberPermissions(
      { roles: member.roles.map((r) => ({ role: { permissions: r.role.permissions } })) },
      { permissions: everyoneRole.permissions }
    );
    const roleIds = member.roles.map((r) => r.role.id).filter((id) => id !== everyoneRole.id);
    const channelPerms = computeChannelPermissions(
      basePerms,
      overwrites.map((o) => ({ type: o.type, targetId: o.targetId, allow: o.allow, deny: o.deny })),
      roleIds,
      userId,
      everyoneRole.id
    );

    if (!hasPermission(channelPerms, Permissions.SEND_MESSAGES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (parsed.data.attachments?.length && !hasPermission(channelPerms, Permissions.ATTACH_FILES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (parsed.data.dmConversationId) {
    const participant = await prisma.dMParticipant.findFirst({
      where: { userId, conversationId: parsed.data.dmConversationId },
      select: { id: true }
    });
    if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const created = await prisma.message.create({
    data: {
      channelId: parsed.data.channelId ?? null,
      dmConversationId: parsed.data.dmConversationId ?? null,
      authorId: userId,
      content: parsed.data.content?.trim() ? parsed.data.content.trim() : null,
      type: 'DEFAULT'
    },
    include: {
      author: { select: { id: true, username: true, discriminator: true, avatarUrl: true } },
      attachments: { select: { id: true, url: true, filename: true, size: true, contentType: true, width: true, height: true } },
      reactions: { select: { id: true, userId: true, emoji: true, isCustom: true } }
    }
  });

  if (parsed.data.attachments?.length) {
    await prisma.attachment.createMany({
      data: parsed.data.attachments.map((a) => ({
        messageId: created.id,
        url: a.url,
        filename: a.filename,
        size: a.size,
        contentType: a.contentType ?? null,
        width: a.width ?? null,
        height: a.height ?? null
      }))
    });
  }

  const full = await prisma.message.findUnique({
    where: { id: created.id },
    include: {
      author: { select: { id: true, username: true, discriminator: true, avatarUrl: true } },
      attachments: { select: { id: true, url: true, filename: true, size: true, contentType: true, width: true, height: true } },
      reactions: { select: { id: true, userId: true, emoji: true, isCustom: true } }
    }
  });

  const supabaseAdmin = getSupabaseAdminClient();
  const realtimeChannelName = parsed.data.channelId
    ? `channel:${parsed.data.channelId}`
    : `dm:${parsed.data.dmConversationId}`;

  if (supabaseAdmin && realtimeChannelName) {
    await supabaseAdmin.channel(realtimeChannelName).send({
      type: 'broadcast',
      event: 'new_message',
      payload: full ?? created
    });
  }

  return NextResponse.json({ message: full ?? created }, { status: 201 });
}
