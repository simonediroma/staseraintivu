import { describe, it, expect, vi, beforeEach } from 'vitest';

const schedule = vi.fn();
vi.mock('@/lib/epg/epg-store', () => ({
  EpgStore: vi.fn(() => ({ schedule: (...a: unknown[]) => schedule(...a) })),
}));

import { GET } from './route';

const req = (qs: string) => new Request(`http://x/api/schedule${qs}`);

beforeEach(() => {
  schedule.mockReset();
  schedule.mockResolvedValue([]);
});

describe('GET /api/schedule', () => {
  it('date mancante o malformata → 400, nessuna query', async () => {
    expect((await GET(req(''))).status).toBe(400);
    expect((await GET(req('?date=invalid'))).status).toBe(400);
    expect((await GET(req('?date=2026-13-01'))).status).toBe(400);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('channel malformato → 400', async () => {
    const res = await GET(req('?date=2026-06-25&channel=Rai%201'));
    expect(res.status).toBe(400);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('date valida → 200, delega a EpgStore.schedule e mappa la shape', async () => {
    schedule.mockResolvedValue([
      {
        channel_id: 'rai-1',
        channel_name: 'Rai 1',
        lcn: 1,
        channel_logo: null,
        start_at: new Date('2026-06-25T12:00:00Z'),
        stop_at: null,
        title: 'Film',
        sub_title: null,
        descr: null,
        categories: ['film'],
      },
    ]);
    const res = await GET(req('?date=2026-06-25'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe('2026-06-25');
    expect(body.programmes[0]).toMatchObject({ channelId: 'rai-1', title: 'Film' });
  });

  it('passa il filtro channel allo store', async () => {
    await GET(req('?date=2026-06-25&channel=rai-1'));
    const args = schedule.mock.calls[0];
    expect(args[2]).toBe('rai-1');
  });

  it('data passata → Cache-Control immutable', async () => {
    const res = await GET(req('?date=2020-01-01'));
    expect(res.headers.get('cache-control')).toBe('s-maxage=86400, immutable');
  });
});
