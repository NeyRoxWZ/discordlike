import { redirect } from 'next/navigation';

import { MePage } from '@/components/channels/MePage';

interface Props {
  params: { scope: string };
}

export default function ScopePage({ params }: Props) {
  if (params.scope !== '@me') redirect('/channels/@me');
  return <MePage />;
}
