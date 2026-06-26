import { NextResponse } from 'next/server';
import { EpgStore } from '@/lib/epg/epg-store';
import { zonedWallTimeToUtc } from '@/lib/epg/prime-time';
import {
  isValidDate,
  isSlug,
  romeToday,
  serializeProgramme,
  CACHE_FRESH,
  CACHE_IMMUTABLE,
  ROME_TZ,
} from '@/lib/api';

/** Palinsesto di un giorno (Europe/Rome), opzionalmente filtrato per canale. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? '';
  const channel = searchParams.get('channel');
  if (!isValidDate(date) || (channel !== null && !isSlug(channel))) {
    return NextResponse.json({ error: 'invalid parameters' }, { status: 400 });
  }
  const [y, mo, d] = date.split('-').map(Number);
  const from = zonedWallTimeToUtc(y, mo, d, 0, 0, ROME_TZ);
  const to = zonedWallTimeToUtc(y, mo, d + 1, 0, 0, ROME_TZ);
  const rows = await new EpgStore().schedule(from, to, channel ?? undefined);
  const cache = date < romeToday() ? CACHE_IMMUTABLE : CACHE_FRESH;
  return NextResponse.json(
    { date, programmes: rows.map(serializeProgramme) },
    { headers: { 'Cache-Control': cache } }
  );
}
