import { describe, it, expect, vi, beforeEach } from 'vitest';

const tonight = vi.fn();
vi.mock('@/lib/epg/epg-store', () => ({
  EpgStore: vi.fn(() => ({ tonight: (...a: unknown[]) => tonight(...a) })),
}));

import { GET } from './route';

const ROW = {
  channel_id: 'rai-1',
  channel_name: 'Rai 1',
  lcn: 1,
  channel_logo: null,
  start_at: new Date('2026-06-25T19:30:00Z'),
  stop_at: new Date('2026-06-25T21:15:00Z'),
  title: 'TG1',
  sub_title: null,
  descr: null,
  categories: ['news'],
};

beforeEach(() => {
  tonight.mockReset();
  tonight.mockResolvedValue([ROW]);
});

describe('GET /api/tonight', () => {
  it('restituisce { date, window, programmes[] } e Cache-Control fresh', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe(
      's-maxage=3600, stale-while-revalidate=86400'
    );
    const body = await res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof body.window.from).toBe('string');
    expect(typeof body.window.to).toBe('string');
    expect(body.programmes[0]).toMatchObject({ channelId: 'rai-1', title: 'TG1' });
  });
});
