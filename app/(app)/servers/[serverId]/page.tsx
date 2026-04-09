import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getSupabaseServerComponentClient } from '@/lib/supabase/server';

interface Props {
  params: { serverId: string };
}

export default async function ServerRootPage({ params }: Props) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const supabaseId = session?.user?.id;
  if (!supabaseId) redirect('/login');

  const user = await prisma.user.findUnique({ where: { supabaseId }, select: { id: true } });
  if (!user) redirect('/channels/@me');

  const server = await prisma.server.findFirst({
    where: { id: params.serverId, members: { some: { userId: user.id } } },
    select: { id: true }
  });
  if (!server) redirect('/channels/@me');

  const channel = await prisma.channel.findFirst({
    where: { serverId: server.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  });

  if (!channel) redirect('/channels/@me');
  redirect(`/servers/${server.id}/${channel.id}`);
}
