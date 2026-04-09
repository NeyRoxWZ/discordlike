import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rateLimitOrThrow } from '@/lib/rateLimit';
import { computeMemberPermissions, hasPermission, Permissions } from '@/lib/permissions';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Params {
  params: { serverId: string };
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

async function requireManageGuild(serverId: string, userId: string) {
  const [server, member, everyoneRole] = await Promise.all([
    prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } }),
    prisma.member.findFirst({
      where: { serverId, userId },
      select: { roles: { select: { role: { select: { permissions: true } } } } }
    }),
    prisma.role.findFirst({ where: { serverId, isEveryone: true }, select: { permissions: true } })
  ]);

  if (!server || !member || !everyoneRole) return false;
  if (server.ownerId === userId) return true;
  const perms = computeMemberPermissions(member, everyoneRole);
  return hasPermission(perms, Permissions.MANAGE_GUILD);
}

export async function POST(req: Request, ctx: Params) {
  const limited = rateLimitOrThrow(req, { keyPrefix: `server-banner:${ctx.params.serverId}`, limit: 6, windowMs: 60_000 });
  if (limited) return limited;

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await requireManageGuild(ctx.params.serverId, userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 413 });

  const ext = file.type.includes('png') ? 'png' : file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : 'png';
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  try {
    await admin.storage.createBucket('server-banners', { public: true });
  } catch {}

  const path = `${ctx.params.serverId}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const upload = await admin.storage.from('server-banners').upload(path, buf, { upsert: true, contentType: file.type || 'image/png' });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data } = admin.storage.from('server-banners').getPublicUrl(path);
  const updated = await prisma.server.update({
    where: { id: ctx.params.serverId },
    data: { bannerUrl: data.publicUrl },
    select: { bannerUrl: true }
  });

  return NextResponse.json({ bannerUrl: updated.bannerUrl });
}

