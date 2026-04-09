import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    await admin.storage.createBucket('banners', { public: true });
  } catch {}

  const path = `${me.id}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const upload = await admin.storage.from('banners').upload(path, buf, {
    upsert: true,
    contentType: file.type || 'image/png'
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data: publicUrl } = admin.storage.from('banners').getPublicUrl(path);
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { bannerUrl: publicUrl.publicUrl },
    select: { id: true, bannerUrl: true }
  });

  return NextResponse.json({ bannerUrl: updated.bannerUrl });
}

