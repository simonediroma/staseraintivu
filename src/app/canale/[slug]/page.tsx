import { notFound } from 'next/navigation';
import { EpgStore } from '@/lib/epg/epg-store';
import { ChannelStore } from '@/lib/epg/channel-store';
import { isSlug, romeToday, serializeProgramme } from '@/lib/api';
import { zonedWallTimeToUtc } from '@/lib/epg/prime-time';
import Timeline, { type TimelineEntry } from '@/components/Timeline';

export const revalidate = 3600;

const ROME_TZ = 'Europe/Rome';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug} — programmi di oggi` };
}

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!isSlug(slug)) notFound();

  const channelStore = new ChannelStore();
  const exists = await channelStore.channelExists(slug).catch(() => false);
  if (!exists) notFound();

  const today = romeToday();
  const [y, m, d] = today.split('-').map(Number);
  const from = zonedWallTimeToUtc(y, m, d, 0, 0, ROME_TZ);
  const to = zonedWallTimeToUtc(y, m, d + 1, 0, 0, ROME_TZ);

  const now = new Date();

  let entries: TimelineEntry[] = [];
  let channelName = slug;
  try {
    const store = new EpgStore();
    const rows = await store.schedule(from, to, slug);
    if (rows.length > 0) channelName = rows[0].channel_name as string;
    entries = rows.map((r: Parameters<typeof serializeProgramme>[0]) => {
      const p = serializeProgramme(r);
      const startAt = new Date(p.startAt);
      const stopAt = p.stopAt ? new Date(p.stopAt) : null;
      return {
        channelId: p.channelId,
        startAt: p.startAt,
        stopAt: p.stopAt,
        title: p.title,
        subTitle: p.subTitle,
        description: p.description,
        categories: p.categories,
        isNow: startAt <= now && (stopAt === null || stopAt > now),
      };
    });
  } catch {
    // DB non raggiungibile — mostra lista vuota
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{channelName}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Programmi di oggi ·{' '}
          {new Intl.DateTimeFormat('it-IT', {
            day: 'numeric', month: 'long', timeZone: ROME_TZ,
          }).format(new Date())}
        </p>
      </div>
      <Timeline entries={entries} />
    </>
  );
}
