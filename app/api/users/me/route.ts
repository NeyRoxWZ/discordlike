import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function generateDiscriminator() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function normalizeUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export async function GET() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const email = session?.user?.email;
  if (!session?.user?.id || !email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUser = session.user;
  const rawUsername =
    (typeof supabaseUser.user_metadata?.username === 'string' && supabaseUser.user_metadata.username) ||
    email.split('@')[0] ||
    'user';

  const baseUsername = normalizeUsername(rawUsername) || 'user';

  const existing = await prisma.user.findUnique({ where: { supabaseId: supabaseUser.id } });
  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const usernameCandidates = [baseUsername, `${baseUsername}_${generateDiscriminator()}`];

  let created = null as Awaited<ReturnType<typeof prisma.user.create>> | null;
  for (const username of usernameCandidates) {
    try {
      created = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          username,
          discriminator: generateDiscriminator(),
          email
        }
      });
      break;
    } catch {
      created = null;
    }
  }

  if (!created) {
    for (let i = 0; i < 10; i++) {
      try {
        created = await prisma.user.create({
          data: {
            supabaseId: supabaseUser.id,
            username: `${baseUsername}_${generateDiscriminator()}`,
            discriminator: generateDiscriminator(),
            email
          }
        });
        break;
      } catch {
        created = null;
      }
    }
  }

  if (!created) {
    return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
  }

  return NextResponse.json({ user: created });
}

const patchSchema = z.object({
  displayName: z.string().max(64).nullable().optional(),
  pronouns: z.string().max(32).nullable().optional(),
  bio: z.string().max(190).nullable().optional(),
  profileColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/)
    .nullable()
    .optional(),
  profileEffect: z
    .enum(['confetti', 'snow', 'fire', 'stars', 'aurora', 'matrix', 'bubbles', 'none'])
    .nullable()
    .optional()
});

export async function PATCH(req: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const supabaseId = session?.user?.id;
  if (!supabaseId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { supabaseId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      displayName: parsed.data.displayName,
      pronouns: parsed.data.pronouns,
      bio: parsed.data.bio,
      profileColor: parsed.data.profileColor,
      profileEffect: parsed.data.profileEffect === 'none' ? null : parsed.data.profileEffect
    },
    select: {
      id: true,
      username: true,
      discriminator: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      bannerUrl: true,
      profileColor: true,
      profileEffect: true,
      bio: true,
      pronouns: true,
      status: true,
      customStatus: true,
      statusEmoji: true
    }
  });

  return NextResponse.json({ user: updated });
}
