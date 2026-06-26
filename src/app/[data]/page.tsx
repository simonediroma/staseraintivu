import { notFound } from 'next/navigation';
import { EpgStore } from '@/lib/epg/epg-store';
import { isValidDate, romeToday, serializeProgramme } from '@/lib/api';
import { zonedWallTimeToUtc } from '@/lib/epg/prime-time';
import ChannelGrid from '@/components/ChannelGrid';
import DayNav from '@/components/DayNav';
import type { Programme } from '@/components/ProgrammeCard';

const ROME_TZ = 'Europe/Rome';

// Giorni correnti/futuri: ISR 1h. Giorni passati: statici al build → nessuna revalidazione.
export const revalidate = 3600;
// Giorni non compresi in generateStaticParams vengono generati on-demand con ISR.
export const dynamicParams = true;

function dayWindow(localDate: string): { from: Date; to: Date } {
  const [y, m, d] = localDate.split('-').map(Number);
  const from = zonedWallTimeToUtc(y, m, d, 0, 0, ROME_TZ);
  const to = zonedWallTimeToUtc(y, m, d + 1, 0, 0, ROME_TZ);
  return { from, to };
}

export async function generateStaticParams() {
  const today = romeToday();
  const [y, mo, d] = today.split('-').map(Number);
  return [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const dt = new Date(Date.UTC(y, mo - 1, d + offset));
    return { data: dt.toISOString().slice(0, 10) };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  if (!isValidDate(data)) return {};
  return { title: `Palinsesto ${data} — stasera in TV` };
}

export default async function DayPage({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;

  if (!isValidDate(data)) notFound();

  const today = romeToday();
  const { from, to } = dayWindow(data);

  let programmes: Programme[] = [];
  try {
    const store = new EpgStore();
    const rows = await store.schedule(from, to);
    programmes = rows
      .sort((a: { lcn: number | null }, b: { lcn: number | null }) => (a.lcn ?? 999) - (b.lcn ?? 999))
      .map((r: Parameters<typeof serializeProgramme>[0]) => ({
        ...serializeProgramme(r),
        lcn: r.lcn ?? 0,
      }));
  } catch {
    // DB non raggiungibile — mostra griglia vuota
  }

  const label = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: ROME_TZ,
  }).format(new Date(`${data}T12:00:00Z`));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{label}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Palinsesto completo · canali DTT</p>
        </div>
        <DayNav date={data} today={today} />
      </div>
      <ChannelGrid programmes={programmes} />
    </>
  );
}
