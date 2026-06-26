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
