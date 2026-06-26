import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { parseXmltv, type ProgrammeRecord } from './parse-xmltv.js';
import type { EpgStore } from './epg-store.js';
import type { ChannelStore } from './channel-store.js';
import type { ChannelResolver } from './channel-alias.js';

const BATCH_SIZE = 500;
const FETCH_TIMEOUT_MS = 60_000;

/** Apre la sorgente EPG: URL remoto (con timeout) o file locale. */
async function openSource(src: string): Promise<Readable> {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok || !res.body) {
      throw new Error(`Download EPG fallito: ${res.status} ${res.statusText}`);
    }
    return Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  }
  return createReadStream(src);
}

export interface IngestOptions {
  /** nome della sorgente per gli alias, es. "iptv-org". */
  source: string;
  /** offset minuti di fallback se il feed omette il fuso (Europe/Rome estate = 120). */
  defaultOffsetMinutes?: number;
  preferLang?: string;
}

export interface IngestStats {
  channels: number;      // <channel> visti nel feed
  programmes: number;    // <programme> visti nel feed
  resolved: number;      // programmi salvati (canale risolto)
  skipped: number;       // programmi scartati (canale irrisolto)
  unresolved: string[];  // sourceId dei canali finiti in coda di revisione
}

/**
 * Legge un feed XMLTV in streaming, risolve i canali verso il canonical id e
 * fa upsert dei programmi in batch. I canali non risolti finiscono in coda
 * (`unresolved_channels`) con i suggerimenti fuzzy: nessun match automatico.
 *
 * Idempotente: rieseguire con lo stesso feed non crea duplicati
 * (chiave (channel_id, start_at) + ON CONFLICT DO UPDATE).
 */
export async function ingest(
  source: string,
  epg: EpgStore,
  channelStore: ChannelStore,
  opts: IngestOptions
): Promise<IngestStats> {
  const resolver: ChannelResolver = await channelStore.buildResolver();
  const stream = await openSource(source);

  // memoizza la risoluzione per questo file: sourceId → canonicalId | null(irrisolto)
  const resolution = new Map<string, string | null>();
  const localNames = new Map<string, string>(); // sourceId → display name
  const unresolvedSet = new Set<string>();

  let buffer: ProgrammeRecord[] = [];
  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await epg.upsertProgrammes(batch);
  };

  // risolve un sourceId (memoizzato), accodando gli irrisolti alla coda di revisione
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
      // i <channel> precedono i <programme>: registriamo il nome e pre-risolviamo,
      // così la coda irrisolti ha il display name corretto.
      localNames.set(c.id, c.displayName);
      await resolveChannel(c.id);
    },
    onProgramme: async (p) => {
      const canonicalId = await resolveChannel(p.channelId);
      if (!canonicalId) {
        skipped++;
        return; // canale irrisolto → niente programmi finché non viene approvato
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
