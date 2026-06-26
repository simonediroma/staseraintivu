import { NextResponse } from 'next/server';
import { EpgStore } from '@/lib/epg/epg-store';
import { tonightWindow } from '@/lib/epg/prime-time';
import { romeToday, serializeProgramme, CACHE_FRESH, ROME_TZ } from '@/lib/api';

/** Prima serata di stasera su tutti i canali. */
export async function GET() {
  const date = romeToday();
  const { from, to } = tonightWindow(date, ROME_TZ);
  const rows = await new EpgStore().tonight(from, to);
  return NextResponse.json(
    {
      date,
      window: { from: from.toISOString(), to: to.toISOString() },
      programmes: rows.map(serializeProgramme),
    },
    { headers: { 'Cache-Control': CACHE_FRESH } }
  );
}
