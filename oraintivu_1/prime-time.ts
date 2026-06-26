import type { ProgrammeRecord } from './parse-xmltv.js';

/**
 * Offset (in minuti) di un fuso a un dato istante, gestendo l'ora legale.
 * Usa Intl, niente dipendenze esterne.
 */
export function getOffsetMinutes(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const part = dtf.formatToParts(at).find((p) => p.type === 'timeZoneName');
  const txt = part?.value ?? 'GMT+0'; // es. "GMT+2", "GMT+5:30", "GMT"
  const m = txt.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Istante UTC corrispondente a un orario "da parete" in un fuso.
 * Risolve correttamente i salti di ora legale con una doppia iterazione.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute);
  let offset = getOffsetMinutes(new Date(guessMs), timeZone);
  let utc = new Date(guessMs - offset * 60_000);
  // ricontrolla: vicino al cambio DST l'offset potrebbe differire
  const offset2 = getOffsetMinutes(utc, timeZone);
  if (offset2 !== offset) {
    utc = new Date(guessMs - offset2 * 60_000);
  }
  return utc;
}

export interface PrimeTimeWindow {
  from: Date; // istante UTC di inizio finestra
  to: Date;   // istante UTC di fine finestra
}

/**
 * Finestra "stasera" per una data locale (Europe/Rome di default).
 * Prima serata classica ≈ 20:30 → 02:00 del giorno dopo.
 * `localDate` nel formato "YYYY-MM-DD" (giorno locale, non UTC).
 */
export function tonightWindow(
  localDate: string,
  timeZone = 'Europe/Rome',
  startHour = 20,
  startMinute = 30,
  endHour = 2 // del giorno successivo
): PrimeTimeWindow {
  const [y, mo, d] = localDate.split('-').map(Number);
  const from = zonedWallTimeToUtc(y, mo, d, startHour, startMinute, timeZone);
  // fine: stesso giorno + 1
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nmo = next.getUTCMonth() + 1;
  const nd = next.getUTCDate();
  const to = zonedWallTimeToUtc(ny, nmo, nd, endHour, 0, timeZone);
  return { from, to };
}

export interface PrimeTimeEntry {
  channelId: string;
  programme: ProgrammeRecord;
}

/**
 * Per ogni canale, sceglie il programma di PRIMA SERATA: il primo che inizia
 * a partire da `from` (≈20:30). È la riga che mostri nella griglia "stasera".
 * Lavora su una lista già parsata → testabile senza DB.
 */
export function pickPrimeTime(
  programmes: ProgrammeRecord[],
  window: PrimeTimeWindow
): PrimeTimeEntry[] {
  const byChannel = new Map<string, ProgrammeRecord>();

  for (const p of programmes) {
    if (p.start < window.from || p.start >= window.to) continue;
    const cur = byChannel.get(p.channelId);
    if (!cur || p.start < cur.start) {
      byChannel.set(p.channelId, p);
    }
  }

  return [...byChannel.entries()]
    .map(([channelId, programme]) => ({ channelId, programme }))
    .sort((a, b) => a.programme.start.getTime() - b.programme.start.getTime());
}
