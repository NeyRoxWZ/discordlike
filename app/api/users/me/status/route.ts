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

const schema = z.object({
  status: z.enum(['ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'INVISIBLE', 'OFFLINE']).optional(),
  customStatus: z.string().max(190).nullable().optional(),
  statusEmoji: z.string().max(64).nullable().optional()
});

export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      status: parsed.data.status,
      customStatus: parsed.data.customStatus,
      statusEmoji: parsed.data.statusEmoji
    },
    select: { id: true, status: true, customStatus: true, statusEmoji: true }
  });

  return NextResponse.json({ user: updated });
}

