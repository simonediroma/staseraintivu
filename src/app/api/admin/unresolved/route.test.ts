import { describe, it, expect, vi, beforeEach } from 'vitest';

const listUnresolved = vi.fn();
vi.mock('@/lib/epg/channel-store', () => ({
  ChannelStore: vi.fn(() => ({ listUnresolved: (...a: unknown[]) => listUnresolved(...a) })),
}));

import { GET } from './route';

const req = (key?: string) =>
  new Request('http://x/api/admin/unresolved', {
    headers: key ? { 'x-admin-key': key } : {},
  });

beforeEach(() => {
  listUnresolved.mockReset();
  listUnresolved.mockResolvedValue([]);
  process.env.ADMIN_KEY = 'admin-secret';
});

describe('GET /api/admin/unresolved', () => {
  it('senza X-Admin-Key → 401, nessuna query', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listUnresolved).not.toHaveBeenCalled();
  });

  it('chiave errata → 401', async () => {
    const res = await GET(req('wrong'));
    expect(res.status).toBe(401);
    expect(listUnresolved).not.toHaveBeenCalled();
  });

  it('chiave corretta → 200, lista serializzata in camelCase', async () => {
    listUnresolved.mockResolvedValue([
      {
        source: 'iptv-org',
        source_id: 'xyz.it',
        display_name: 'Tele XYZ',
        suggestions: [{ canonicalId: 'rai-4', name: 'Rai 4', score: 0.6 }],
        first_seen: new Date('2026-06-25T02:00:00Z'),
        last_seen: new Date('2026-06-26T02:00:00Z'),
      },
    ]);
    const res = await GET(req('admin-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unresolved[0]).toEqual({
      source: 'iptv-org',
      sourceId: 'xyz.it',
      displayName: 'Tele XYZ',
      suggestions: [{ canonicalId: 'rai-4', name: 'Rai 4', score: 0.6 }],
      firstSeen: '2026-06-25T02:00:00.000Z',
      lastSeen: '2026-06-26T02:00:00.000Z',
    });
  });
});
