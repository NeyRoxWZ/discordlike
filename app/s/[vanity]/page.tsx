import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';

interface Props {
  params: { vanity: string };
}

export default async function VanityPage({ params }: Props) {
  const server = await prisma.server.findUnique({
    where: { vanityUrl: params.vanity },
    select: { id: true }
  });
  if (!server) redirect('/channels/@me');
  redirect(`/servers/${server.id}`);
}

