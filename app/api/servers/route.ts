import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { Permissions } from '@/lib/permissions';
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

  const servers = await prisma.server.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, iconUrl: true }
  });

  return NextResponse.json({ servers });
}

const createSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(190).optional(),
  isPublic: z.boolean().optional()
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const basePermissions =
    Permissions.VIEW_CHANNEL |
    Permissions.SEND_MESSAGES |
    Permissions.READ_MESSAGE_HISTORY |
    Permissions.ADD_REACTIONS |
    Permissions.ATTACH_FILES |
    Permissions.EMBED_LINKS |
    Permissions.CONNECT |
    Permissions.SPEAK;

  const created = await prisma.$transaction(async (tx) => {
    const server = await tx.server.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        ownerId: userId,
        isPublic: parsed.data.isPublic ?? false
      },
      select: { id: true, name: true }
    });

    const everyoneRole = await tx.role.create({
      data: {
        serverId: server.id,
        name: '@everyone',
        isEveryone: true,
        permissions: basePermissions
      },
      select: { id: true }
    });

    const member = await tx.member.create({
      data: { serverId: server.id, userId },
      select: { id: true }
    });

    await tx.memberRole.create({
      data: { memberId: member.id, roleId: everyoneRole.id }
    });

    await tx.channel.create({
      data: { serverId: server.id, name: 'général', type: 'TEXT', position: 0 },
      select: { id: true }
    });

    return server;
  });

  return NextResponse.json({ server: created }, { status: 201 });
}
