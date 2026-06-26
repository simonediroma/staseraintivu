import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';

// Mock del singleton pool: l'ingest non tocca un DB reale nei test.
const query = vi.fn();
vi.mock('@/lib/db', () => ({ default: { query: (...args: unknown[]) => query(...args) } }));

import { ingest } from './ingest';
import { ChannelStore } from './channel-store';
import { EpgStore } from './epg-store';

const FIXTURE = fileURLToPath(new URL('./__fixtures__/guide.xml', import.meta.url));

// Stato DB simulato. La4 (TeleSconosciuta) NON è canonico → finirà irrisolto.
const CANON_ROWS = [
  { id: 'rai-1', lcn: 1, name: 'Rai 1', logo_url: null },
  { id: 'canale-5', lcn: 5, name: 'Canale 5', logo_url: null },
  { id: 'la7', lcn: 7, name: 'La7', logo_url: null },
];

// Cattura per categoria di query. La SELECT di buildResolver è distinta
// dalle INSERT su programmes / unresolved_channels.
function installMock() {
  query.mockReset();
  query.mockImplementation((sql: string) => {
    if (/canonical_channels/i.test(sql)) return Promise.resolve({ rows: CANON_ROWS });
    if (/channel_aliases/i.test(sql)) return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
}

const programmeCalls = () =>
  query.mock.calls.filter(([sql]) => /INSERT INTO programmes/i.test(sql as string));
const unresolvedCalls = () =>
  query.mock.calls.filter(([sql]) => /INSERT INTO unresolved_channels/i.test(sql as string));

beforeEach(installMock);

const OPTS = { source: 'iptv-org', defaultOffsetMinutes: 120 };

describe('ingest', () => {
  it('risolve i canali noti e upserta almeno un programma', async () => {
    const stats = await ingest(FIXTURE, new EpgStore(), new ChannelStore(), OPTS);

    // 5 programmi su canali risolti (Rai1×3, Canale5×1, La7×1), 1 scartato (irrisolto).
    expect(stats.resolved).toBe(5);
    expect(stats.skipped).toBe(1);
    expect(stats.unresolved).toContain('TeleSconosciuta.it');

    const inserts = programmeCalls();
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    // i canali nel batch sono i CANONICAL id, non gli xmltv id.
    const channelArrays = inserts.map(([, params]) => (params as unknown[][])[0]);
    const allChannels = channelArrays.flat();
    expect(allChannels).toContain('rai-1');
    expect(allChannels).not.toContain('Rai1.it');
  });

  it('idempotente: due run con lo stesso feed emettono gli stessi batch', async () => {
    const run = async () => {
      installMock();
      await ingest(FIXTURE, new EpgStore(), new ChannelStore(), OPTS);
      return programmeCalls().map(([sql, params]) => [sql, params]);
    };
    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    // l'upsert è idempotente lato DB (ON CONFLICT DO UPDATE).
    expect(first[0][0]).toMatch(/ON CONFLICT \(channel_id, start_at\) DO UPDATE/i);
  });

  it('canale non canonico → entra in unresolved_channels con suggestions', async () => {
    await ingest(FIXTURE, new EpgStore(), new ChannelStore(), OPTS);
    const calls = unresolvedCalls();
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [sql, params] = calls[0];
    expect(sql).toMatch(/ON CONFLICT \(source, source_id\) DO UPDATE/i);
    expect(params[0]).toBe('iptv-org'); // source
    expect(params[1]).toBe('TeleSconosciuta.it'); // source_id
    expect(typeof params[3]).toBe('string'); // suggestions JSON.stringify
  });
});
