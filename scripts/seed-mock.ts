/**
 * Seed di dati MOCK nella tabella `programmes` — solo per sviluppo/test.
 *
 * Genera una manciata di programmi di prima serata per ogni canale canonico,
 * per oggi e i prossimi giorni, con orari "da parete" Europe/Rome convertiti
 * in istanti UTC corretti (gestione DST via zonedWallTimeToUtc).
 *
 * NON è l'ingest reale (quello è M4, da feed XMLTV). Serve solo ad avere
 * contenuto nel DB per testare API e UI prima che l'ingest sia pronto.
 *
 * Idempotente: ON CONFLICT (channel_id, start_at) DO UPDATE. Rilanciarlo
 * aggiorna i record esistenti senza duplicare.
 *
 * Uso (con DATABASE_URL in env): npx tsx scripts/seed-mock.ts
 */
import pool from '../src/lib/db';
import { SEED_CHANNELS } from '../src/db/seed-channels';
import { zonedWallTimeToUtc } from '../src/lib/epg/prime-time';

const TZ = 'Europe/Rome';
const DAYS = 3; // oggi + 2 giorni

// Slot della giornata: orario "da parete" Rome + durata indicativa (minuti).
const SLOTS = [
  { hour: 18, minute: 30, label: 'access' },
  { hour: 21, minute: 15, label: 'prime' },
  { hour: 23, minute: 30, label: 'late' },
] as const;

type SlotLabel = (typeof SLOTS)[number]['label'];

// Pool di titoli mock per fascia. Scelti in modo deterministico per canale/giorno.
const TITLES: Record<SlotLabel, { title: string; categories: string[]; descr: string }[]> = {
  access: [
    { title: 'Notiziario della Sera', categories: ['news'], descr: 'Le principali notizie della giornata.' },
    { title: 'Access Prime Time', categories: ['intrattenimento'], descr: 'Quiz e intrattenimento prima della serata.' },
    { title: 'Meteo e Attualità', categories: ['news'], descr: 'Previsioni e approfondimenti.' },
  ],
  prime: [
    { title: 'Il Grande Film', categories: ['film'], descr: 'Prima serata cinema.' },
    { title: 'Serie TV — Nuova Stagione', categories: ['serie'], descr: 'Episodio inedito in prima visione.' },
    { title: 'Show del Sabato', categories: ['intrattenimento'], descr: 'Musica, ospiti e spettacolo.' },
    { title: 'Documentario Speciale', categories: ['documentario'], descr: 'Approfondimento in prima serata.' },
    { title: 'Calcio: Grande Partita', categories: ['sport'], descr: 'Telecronaca live.' },
  ],
  late: [
    { title: 'Seconda Serata', categories: ['intrattenimento'], descr: 'Approfondimento notturno.' },
    { title: 'Cinema di Notte', categories: ['film'], descr: 'Film in seconda serata.' },
    { title: 'Talk Notturno', categories: ['talk'], descr: 'Dibattito e ospiti.' },
  ],
};

/** Data locale "YYYY-MM-DD" in un fuso, a N giorni da oggi. */
function localDatePlus(days: number, timeZone: string): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  // en-CA → formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

interface MockProgramme {
  channelId: string;
  start: Date;
  stop: Date;
  title: string;
  descr: string;
  categories: string[];
}

function buildMockProgrammes(): MockProgramme[] {
  const out: MockProgramme[] = [];

  for (let d = 0; d < DAYS; d++) {
    const [y, mo, day] = localDatePlus(d, TZ).split('-').map(Number);

    SEED_CHANNELS.forEach((ch, chIdx) => {
      SLOTS.forEach((slot, slotIdx) => {
        const titlePool = TITLES[slot.label];
        const pick = titlePool[(chIdx + d + slotIdx) % titlePool.length];

        const start = zonedWallTimeToUtc(y, mo, day, slot.hour, slot.minute, TZ);
        // fine = inizio slot successivo, o +90 min per l'ultimo
        const next = SLOTS[slotIdx + 1];
        const stop = next
          ? zonedWallTimeToUtc(y, mo, day, next.hour, next.minute, TZ)
          : new Date(start.getTime() + 90 * 60_000);

        out.push({
          channelId: ch.id,
          start,
          stop,
          title: pick.title,
          descr: pick.descr,
          categories: pick.categories,
        });
      });
    });
  }

  return out;
}

async function seed(): Promise<void> {
  const programmes = buildMockProgrammes();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of programmes) {
      await client.query(
        `INSERT INTO programmes
           (channel_id, start_at, stop_at, title, descr, categories)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (channel_id, start_at) DO UPDATE SET
           stop_at    = EXCLUDED.stop_at,
           title      = EXCLUDED.title,
           descr      = EXCLUDED.descr,
           categories = EXCLUDED.categories`,
        [p.channelId, p.start, p.stop, p.title, p.descr, p.categories]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log(
    `Seed mock completato: ${programmes.length} programmi su ${SEED_CHANNELS.length} canali, ${DAYS} giorni (idempotente).`
  );
}

seed()
  .then(() => pool.end())
  .catch((e) => {
    console.error('Seed mock fallito:', e);
    pool.end();
    process.exit(1);
  });
