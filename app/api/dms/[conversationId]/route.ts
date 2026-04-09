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

export async function GET(_: Request, ctx: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversation = await prisma.dMConversation.findFirst({
    where: { id: ctx.params.conversationId, participants: { some: { userId } } },
    select: {
      id: true,
      isGroupDM: true,
      groupName: true,
      groupIconUrl: true,
      participants: {
        select: {
          user: { select: { id: true, username: true, discriminator: true, avatarUrl: true } }
        }
      }
    }
  });

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ conversation });
}

