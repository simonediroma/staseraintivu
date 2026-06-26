import { EpgStore } from '@/lib/epg/epg-store';
import { romeToday } from '@/lib/api';
import { tonightWindow } from '@/lib/epg/prime-time';
import ChannelGrid from '@/components/ChannelGrid';
import type { Programme } from '@/components/ProgrammeCard';

export const revalidate = 3600;

export default async function Home() {
  const today = romeToday();
  const { from, to } = tonightWindow(today);

  let programmes: Programme[] = [];
  try {
    const store = new EpgStore();
    const rows = await store.tonight(from, to);
    programmes = rows
      .sort((a: { lcn: number | null }, b: { lcn: number | null }) => (a.lcn ?? 999) - (b.lcn ?? 999))
      .map((r: {
        channel_id: string;
        channel_name: string;
        channel_logo: string | null;
        lcn: number | null;
        start_at: Date | string;
        stop_at: Date | string | null;
        title: string;
        sub_title: string | null;
        descr: string | null;
        categories: string[];
      }) => ({
        channelId: r.channel_id,
        channelName: r.channel_name,
        channelLogo: r.channel_logo,
        lcn: r.lcn ?? 0,
        startAt: new Date(r.start_at).toISOString(),
        stopAt: r.stop_at ? new Date(r.stop_at).toISOString() : null,
        title: r.title,
        subTitle: r.sub_title,
        description: r.descr,
        categories: r.categories,
      }));
  } catch {
    // DB non raggiungibile in dev senza env — mostra griglia vuota
  }

  const label = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome',
  }).format(new Date());

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold capitalize">{label}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Prima serata · canali DTT</p>
      </div>
      <ChannelGrid programmes={programmes} />
    </>
  );
}
