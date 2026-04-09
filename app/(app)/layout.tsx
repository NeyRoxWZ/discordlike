import { ServerList } from '@/components/sidebar/ServerList';
import { ChannelList } from '@/components/sidebar/ChannelList';
import { MemberSidebar } from '@/components/sidebar/MemberSidebar';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ServerSettingsPanel } from '@/components/settings/ServerSettingsPanel';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary">
      <ServerList />
      <ChannelList />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <MemberSidebar />
      <SettingsPanel />
      <ServerSettingsPanel />
    </div>
  );
}
