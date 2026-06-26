import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { parseXmltv, type ProgrammeRecord } from './parse-xmltv.js';
import { EpgStore } from './db.js';
import { ChannelStore } from './channel-store.js';
import type { ChannelResolver } from './channel-alias.js';

const BATCH_SIZE = 500;

async function openSource(src: string): Promise<Readable> {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok || !res.body) {
      throw new Error(`Download EPG fallito: ${res.status} ${res.statusText}`);
    }
    return Readable.fromWeb(res.body as any);
  }
  return createReadStream(src);
}

export interface IngestOptions {
  /** quale grabber ha prodotto il file, es. "raiplay.it". Usato per gli alias. */
  source: string;
  /** offset minuti di fallback se il feed omette il fuso (Europe/Rome estate = 120) */
  defaultOffsetMinutes?: number;
  preferLang?: string;
}

export interface IngestStats {
  channels: number;
  programmes: number;
  resolved: number;     // programmi salvati (canale risolto)
  skipped: number;      // programmi scartati (canale irrisolto)
  unresolved: string[]; // sourceId dei canali finiti in coda
}

export async function ingest(
  source: string,
  epg: EpgStore,
  channelStore: ChannelStore,
  opts: IngestOptions
): Promise<IngestStats> {
  // 1. prepara canali canonici + risolutore dallo stato del DB
  await channelStore.init();
  await channelStore.seedIfEmpty();
  await epg.init();
  const resolver: ChannelResolver = await channelStore.buildResolver();

  const stream = await openSource(source);

  // cache di risoluzione per questo file: sourceId -> canonicalId | null(irrisolto)
  const resolution = new Map<string, string | null>();
  const localNames = new Map<string, string>(); // sourceId -> display name
  const unresolvedSet = new Set<string>();

  let buffer: ProgrammeRecord[] = [];
  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await epg.upsertProgrammes(batch);
  };

  // risolve un sourceId (memoizzato), accodando gli irrisolti
  const resolveChannel = async (sourceId: string): Promise<string | null> => {
    if (resolution.has(sourceId)) return resolution.get(sourceId)!;
    const displayName = localNames.get(sourceId) ?? sourceId;
    const res = resolver.resolve(opts.source, sourceId, displayName);
    if (res.status === 'resolved') {
      resolution.set(sourceId, res.canonicalId);
      return res.canonicalId;
    }
    resolution.set(sourceId, null);
    unresolvedSet.add(sourceId);
    await channelStore.queueUnresolved(opts.source, sourceId, displayName, res.suggestions);
    return null;
  };

  let resolved = 0;
  let skipped = 0;

  const stats = await parseXmltv(stream, {
    preferLang: opts.preferLang ?? 'it',
    defaultOffsetMinutes: opts.defaultOffsetMinutes ?? 0,
    onChannel: async (c) => {
      // i <channel> arrivano prima dei <programme>: registriamo il nome e
      // pre-risolviamo, cosi' la coda irrisolti ha il display name buono.
      localNames.set(c.id, c.displayName);
      await resolveChannel(c.id);
    },
    onProgramme: async (p) => {
      const canonicalId = await resolveChannel(p.channelId);
      if (!canonicalId) {
        skipped++;
        return; // canale irrisolto -> niente programmi finche' non lo si approva
      }
      resolved++;
      buffer.push({ ...p, channelId: canonicalId });
      if (buffer.length >= BATCH_SIZE) await flush();
    },
  });

  await flush();
  return {
    channels: stats.channels,
    programmes: stats.programmes,
    resolved,
    skipped,
    unresolved: [...unresolvedSet],
  };
}

// CLI:  tsx src/ingest.ts <file-o-url> <source> [offsetMinuti]
//   tsx src/ingest.ts ./sample/guide.xml raiplay.it 120
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , source, sourceName, offset] = process.argv;
  if (!source || !sourceName) {
    console.error('Uso: tsx src/ingest.ts <file-o-url> <source> [offsetMinuti]');
    process.exit(1);
  }
  const epg = new EpgStore();
  const channels = new ChannelStore();
  ingest(source, epg, channels, {
    source: sourceName,
    defaultOffsetMinutes: offset ? Number(offset) : 0,
  })
    .then((s) => {
      console.log(
        `Ingest: ${s.resolved} programmi salvati, ${s.skipped} scartati (canale irrisolto).`
      );
      if (s.unresolved.length) {
        console.log(`Da rivedere in unresolved_channels: ${s.unresolved.join(', ')}`);
      }
      return Promise.all([epg.close(), channels.close()]);
    })
    .catch((err) => {
      console.error('Ingest fallito:', err);
      process.exit(1);
    });
}
