import { describe, it, expect, vi, beforeEach } from 'vitest';

const search = vi.fn();
vi.mock('@/lib/epg/epg-store', () => ({
  EpgStore: vi.fn(() => ({ search: (...a: unknown[]) => search(...a) })),
}));

import { GET } from './route';

const req = (qs: string) => new Request(`http://x/api/search${qs}`);

beforeEach(() => {
  search.mockReset();
  search.mockResolvedValue({ rows: [], total: 0 });
});

describe('GET /api/search', () => {
  it('q vuota o mancante → 400, nessuna query', async () => {
    expect((await GET(req(''))).status).toBe(400);
    expect((await GET(req('?q='))).status).toBe(400);
    expect((await GET(req('?q=%20%20'))).status).toBe(400); // solo spazi
    expect(search).not.toHaveBeenCalled();
  });

  it('q > 100 caratteri → 400', async () => {
    const long = 'a'.repeat(101);
    expect((await GET(req(`?q=${long}`))).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it('q valida → 200, delega a EpgStore.search e mappa { results, total }', async () => {
    search.mockResolvedValue({
      rows: [
        {
          channel_id: 'rai-1',
          channel_name: 'Rai 1',
          start_at: new Date('2026-06-25T19:30:00Z'),
          stop_at: null,
          title: 'Totò',
          descr: 'Film',
          categories: ['film'],
        },
      ],
      total: 1,
    });
    const res = await GET(req('?q=tot%C3%B2'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.results[0]).toEqual({
      channelId: 'rai-1',
      channelName: 'Rai 1',
      startAt: '2026-06-25T19:30:00.000Z',
      stopAt: null,
      title: 'Totò',
      description: 'Film',
      categories: ['film'],
    });
    expect(search).toHaveBeenCalledWith('totò', 20, 0);
  });

  it('limit oltre 50 → clampato a 50', async () => {
    await GET(req('?q=film&limit=999'));
    expect(search.mock.calls[0][1]).toBe(50);
  });

  it('limit/offset non numerici → default (20, 0)', async () => {
    await GET(req('?q=film&limit=abc&offset=xyz'));
    expect(search.mock.calls[0][1]).toBe(20);
    expect(search.mock.calls[0][2]).toBe(0);
  });

  it('offset negativo → 0', async () => {
    await GET(req('?q=film&offset=-5'));
    expect(search.mock.calls[0][2]).toBe(0);
  });

  it('SQL injection nella q → delega come stringa, non crasha', async () => {
    const res = await GET(req(`?q=${encodeURIComponent("'; DROP TABLE programmes;--")}`));
    expect(res.status).toBe(200);
    expect(search.mock.calls[0][0]).toBe("'; DROP TABLE programmes;--");
  });

  it('header rate limit presente, no-store', async () => {
    const res = await GET(req('?q=film'));
    expect(res.headers.get('x-ratelimit-limit')).toBe('30');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
