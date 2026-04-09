import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

import { prisma } from '@/lib/prisma';
import { rateLimitOrThrow } from '@/lib/rateLimit';
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

function safeExt(type: string) {
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('gif')) return 'gif';
  if (type.includes('webp')) return 'webp';
  if (type.includes('pdf')) return 'pdf';
  return 'bin';
}

export async function POST(req: Request) {
  const limited = rateLimitOrThrow(req, { keyPrefix: 'upload', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 413 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  try {
    await admin.storage.createBucket('attachments', { public: true });
  } catch {}

  const ext = safeExt(file.type);
  const key = nanoid(12);
  const path = `${me.id}/${key}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const upload = await admin.storage.from('attachments').upload(path, buf, {
    upsert: true,
    contentType: file.type || 'application/octet-stream'
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data } = admin.storage.from('attachments').getPublicUrl(path);

  return NextResponse.json({
    file: {
      url: data.publicUrl,
      filename: file.name,
      size: file.size,
      contentType: file.type || null
    }
  });
}
