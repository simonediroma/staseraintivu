/**
 * Helper condivisi dai Route Handlers del palinsesto: validazione input,
 * serializzazione delle righe DB nella shape pubblica (vedi docs/architecture.md)
 * e header di cache. Tenuti qui per non duplicare logica tra i route.
 */

export const ROME_TZ = 'Europe/Rome';

/** Cache standard endpoint freschi: 1h edge + 24h stale-while-revalidate. */
export const CACHE_FRESH = 's-maxage=3600, stale-while-revalidate=86400';
/** Giorni passati: immutabili (non cambiano più). */
export const CACHE_IMMUTABLE = 's-maxage=86400, immutable';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9-]+$/;

/** True se `s` è una data "YYYY-MM-DD" reale (non solo ben formata). */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** True se `s` è uno slug canale ammesso (minuscole, cifre, trattini). */
export function isSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

/** Data odierna locale (Europe/Rome) come "YYYY-MM-DD". */
export function romeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ROME_TZ }).format(new Date());
}

/** Riga grezza dal JOIN programmes × canonical_channels. */
export interface ProgrammeRow {
  channel_id: string;
  channel_name: string;
  lcn: number | null;
  channel_logo: string | null;
  start_at: Date | string;
  stop_at: Date | string | null;
  title: string;
  sub_title: string | null;
  descr: string | null;
  categories: string[];
}

/** Mappa una riga DB nella shape pubblica documentata (camelCase, ISO 8601). */
export function serializeProgramme(r: ProgrammeRow) {
  return {
    channelId: r.channel_id,
    channelName: r.channel_name,
    channelLogo: r.channel_logo,
    lcn: r.lcn,
    startAt: new Date(r.start_at).toISOString(),
    stopAt: r.stop_at ? new Date(r.stop_at).toISOString() : null,
    title: r.title,
    subTitle: r.sub_title,
    description: r.descr,
    categories: r.categories,
  };
}
