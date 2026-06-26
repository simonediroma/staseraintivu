import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del singleton pool: nessuna connessione reale al DB.
const query = vi.fn();
vi.mock('@/lib/db', () => ({ default: { query: (...args: unknown[]) => query(...args) } }));

import { ChannelStore } from './channel-store';

// Stato DB simulato: il seed reale di M1 (sottoinsieme sufficiente).
const CANON_ROWS = [
  { id: 'rai-1', lcn: 1, name: 'Rai 1', logo_url: null },
  { id: 'rai-2', lcn: 2, name: 'Rai 2', logo_url: null },
  { id: 'rai-4', lcn: 21, name: 'Rai 4', logo_url: null },
  { id: 'rai-5', lcn: 23, name: 'Rai 5', logo_url: null },
];
const ALIAS_ROWS = [
  { source: 'raiplay.it', sourceId: 'rai-1', canonicalId: 'rai-1' },
];

beforeEach(() => {
  query.mockReset();
  // buildResolver emette due SELECT: canonical_channels poi channel_aliases.
  query.mockImplementation((sql: string) => {
    if (/canonical_channels/.test(sql)) return Promise.resolve({ rows: CANON_ROWS });
    if (/channel_aliases/.test(sql)) return Promise.resolve({ rows: ALIAS_ROWS });
    return Promise.resolve({ rows: [] });
  });
});

describe('ChannelStore.buildResolver → resolve', () => {
  it('alias esatto in DB → resolved (method: alias)', async () => {
    const resolver = await (new ChannelStore()).buildResolver();
    const r = resolver.resolve('raiplay.it', 'rai-1', 'Rai 1');
    expect(r).toEqual({ status: 'resolved', canonicalId: 'rai-1', method: 'alias' });
  });

  it('nome normalizzato (nessun alias) → resolved (method: name)', async () => {
    const resolver = await (new ChannelStore()).buildResolver();
    // "Rai1.it" non è un alias noto ma normalizza a "rai1" == canonico rai-1.
    const r = resolver.resolve('iptv-org', 'Rai1.it', 'Rai 1');
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.canonicalId).toBe('rai-1');
  });

  it('canale inesistente → unresolved con suggestions', async () => {
    const resolver = await (new ChannelStore()).buildResolver();
    const r = resolver.resolve('iptv-org', 'Rai4.it', 'Rai 4');
    // "Rai 4" normalizza esatto su rai-4 → in realtà è resolved.
    expect(r.status).toBe('resolved');

    const r2 = resolver.resolve('iptv-org', 'xyz-unknown', 'Canale Sconosciuto 999');
    expect(r2.status).toBe('unresolved');
    if (r2.status === 'unresolved') expect(Array.isArray(r2.suggestions)).toBe(true);
  });
});

describe('ChannelStore.listActiveChannels', () => {
  it('seleziona solo i canali attivi, ordinati per sort_order, in camelCase', async () => {
    await (new ChannelStore()).listActiveChannels();
    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/FROM canonical_channels/i);
    expect(sql).toMatch(/is_active = true/i);
    expect(sql).toMatch(/ORDER BY sort_order/i);
    expect(sql).toMatch(/logo_url AS "logoUrl"/i);
  });
});

describe('ChannelStore.queueUnresolved', () => {
  it('fa UPSERT (ON CONFLICT) con suggestions serializzate in JSON', async () => {
    await (new ChannelStore()).queueUnresolved('iptv-org', 'xyz', 'Tele XYZ', [
      { canonicalId: 'rai-4', name: 'Rai 4', score: 0.6 },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO unresolved_channels/i);
    expect(sql).toMatch(/ON CONFLICT \(source, source_id\) DO UPDATE/i);
    expect(params[0]).toBe('iptv-org');
    expect(params[1]).toBe('xyz');
    expect(typeof params[3]).toBe('string'); // JSON.stringify
  });
});
