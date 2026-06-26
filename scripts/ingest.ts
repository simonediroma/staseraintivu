/**
 * Ingest worker per staseraintivu.
 *
 * Scarica il feed XMLTV (XMLTV_URL), risolve i canali, fa upsert dei programmi
 * e invalida l'ISR di Vercel via POST /api/revalidate. Idempotente.
 *
 * Uso (con env / .env.local):
 *   npx tsx scripts/ingest.ts            # usa XMLTV_URL
 *   npx tsx scripts/ingest.ts <file>     # sorgente locale (override, per test)
 */
import pool from '../src/lib/db';
import { ingest } from '../src/lib/epg/ingest';
import { EpgStore } from '../src/lib/epg/epg-store';
import { ChannelStore } from '../src/lib/epg/channel-store';

const source = process.argv[2] ?? process.env.XMLTV_URL;
const sourceName = process.env.XMLTV_SOURCE ?? 'iptv-org';
const offset = Number(process.env.XMLTV_OFFSET_MINUTES ?? 0);

/** Invalida l'ISR di Vercel. Fallisce gracefully se il sito non è deployato. */
async function revalidate(): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.REVALIDATE_TOKEN;
  if (!base || !token) {
    console.warn('Revalidate saltato: NEXT_PUBLIC_SITE_URL o REVALIDATE_TOKEN mancanti.');
    return;
  }
  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) console.warn(`Revalidate non riuscito: ${res.status} ${res.statusText}`);
    else console.log('Revalidate ISR ok.');
  } catch (e) {
    console.warn('Revalidate fallito (sito non raggiungibile?):', (e as Error).message);
  }
}

async function main(): Promise<void> {
  if (!source) throw new Error('XMLTV_URL non impostata (e nessun file passato come argomento).');

  const stats = await ingest(source, new EpgStore(), new ChannelStore(), {
    source: sourceName,
    defaultOffsetMinutes: offset,
  });

  const resolvedChannels = stats.channels - stats.unresolved.length;
  console.log(
    `${resolvedChannels} canali risolti, ${stats.resolved} programmi salvati, ` +
      `${stats.unresolved.length} irrisolti.`
  );
  if (stats.unresolved.length) {
    console.log(`Da rivedere in unresolved_channels: ${stats.unresolved.join(', ')}`);
  }

  await revalidate();
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error('Ingest fallito:', e);
    pool.end();
    process.exit(1);
  });
