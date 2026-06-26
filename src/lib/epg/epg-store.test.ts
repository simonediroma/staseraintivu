import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProgrammeRecord } from './parse-xmltv';

const query = vi.fn();
vi.mock('@/lib/db', () => ({ default: { query: (...args: unknown[]) => query(...args) } }));

import { EpgStore } from './epg-store';

const prog = (channelId: string, startIso: string): ProgrammeRecord => ({
  channelId,
  start: new Date(startIso),
  stop: new Date(new Date(startIso).getTime() + 3600_000),
  title: 'Tg',
  subTitle: null,
  desc: null,
  categories: ['news'],
  iconUrl: null,
  episodeNum: null,
});

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
});

describe('EpgStore.upsertProgrammes', () => {
  it('batch vuoto → nessuna query', async () => {
    await (new EpgStore()).upsertProgrammes([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('usa una sola query batch (UNNEST) con ON CONFLICT DO UPDATE', async () => {
    const batch = [prog('rai-1', '2026-06-26T19:30:00Z'), prog('rai-2', '2026-06-26T20:00:00Z')];
    await (new EpgStore()).upsertProgrammes(batch);
    expect(query).toHaveBeenCalledTimes(1); // batch, non N insert in loop
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UNNEST/i);
    expect(sql).toMatch(/ON CONFLICT \(channel_id, start_at\) DO UPDATE/i);
    expect(sql).not.toMatch(/search_vec/i); // GENERATED: mai nelle colonne di INSERT
    // i parametri sono array colonnari di lunghezza == batch
    expect(params[0]).toEqual(['rai-1', 'rai-2']);
    expect(params[1]).toEqual([
      '2026-06-26T19:30:00.000Z',
      '2026-06-26T20:00:00.000Z',
    ]);
  });

  it('idempotente: due esecuzioni con gli stessi dati emettono la stessa upsert', async () => {
    const batch = [prog('rai-1', '2026-06-26T19:30:00Z')];
    const store = new EpgStore();
    await store.upsertProgrammes(batch);
    await store.upsertProgrammes(batch);
    expect(query).toHaveBeenCalledTimes(2);
    // stessa SQL idempotente entrambe le volte (la PK + ON CONFLICT evita duplicati lato DB)
    expect(query.mock.calls[0][0]).toBe(query.mock.calls[1][0]);
    expect(query.mock.calls[0][0]).toMatch(/ON CONFLICT \(channel_id, start_at\) DO UPDATE/i);
  });
});

describe('EpgStore.schedule', () => {
  const from = new Date('2026-06-25T00:00:00Z');
  const to = new Date('2026-06-26T00:00:00Z');

  it('senza canale: JOIN canale + finestra giorno, ORDER BY (channel_id, start_at)', async () => {
    await (new EpgStore()).schedule(from, to);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/JOIN canonical_channels/i);
    expect(sql).toMatch(/ORDER BY p\.channel_id, p\.start_at/i);
    expect(params).toEqual([from.toISOString(), to.toISOString()]);
  });

  it('con canale: aggiunge il filtro channel_id come parametro', async () => {
    await (new EpgStore()).schedule(from, to, 'rai-1');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/p\.channel_id = \$3/);
    expect(params).toEqual([from.toISOString(), to.toISOString(), 'rai-1']);
  });
});

describe('EpgStore.search', () => {
  beforeEach(() => {
    // search emette due query: risultati poi COUNT(*).
    query.mockImplementation((sql: string) => {
      if (/count/i.test(sql)) return Promise.resolve({ rows: [{ total: '3' }] });
      return Promise.resolve({ rows: [] });
    });
  });

  it('usa websearch_to_tsquery parametrizzato (no injection) e ts_rank', async () => {
    await (new EpgStore()).search('totò', 20, 0);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/websearch_to_tsquery\('italian', \$1\)/i);
    expect(sql).toMatch(/ts_rank/i);
    expect(sql).not.toMatch(/to_tsquery\('italian', 'totò'\)/i); // mai interpolato
    expect(params[0]).toBe('totò');
  });

  it('LIMIT/OFFSET parametrizzati e applicati prima del JOIN (subquery)', async () => {
    await (new EpgStore()).search('film', 10, 20);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$2 OFFSET \$3/i);
    // il LIMIT è dentro la subquery su programmes, prima del JOIN canonical_channels
    expect(sql.indexOf('LIMIT')).toBeLessThan(sql.indexOf('JOIN canonical_channels'));
    expect(params).toEqual(['film', 10, 20]);
  });

  it('restituisce { rows, total } con total numerico', async () => {
    const out = await (new EpgStore()).search('film', 20, 0);
    expect(out.total).toBe(3);
    expect(Array.isArray(out.rows)).toBe(true);
  });

  it('input SQL-injection → query parametrizzata, nessun errore', async () => {
    const out = await (new EpgStore()).search("'; DROP TABLE programmes;--", 20, 0);
    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe("'; DROP TABLE programmes;--");
    expect(out.rows).toEqual([]);
  });
});
