import { describe, it, expect, vi, beforeEach } from 'vitest';

const listActiveChannels = vi.fn();
vi.mock('@/lib/epg/channel-store', () => ({
  ChannelStore: vi.fn(() => ({
    listActiveChannels: (...a: unknown[]) => listActiveChannels(...a),
  })),
}));

import { GET } from './route';

beforeEach(() => {
  listActiveChannels.mockReset();
  listActiveChannels.mockResolvedValue([
    { id: 'rai-1', name: 'Rai 1', lcn: 1, logoUrl: null },
  ]);
});

describe('GET /api/channels', () => {
  it('restituisce i canali attivi con Cache-Control fresh', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe(
      's-maxage=3600, stale-while-revalidate=86400'
    );
    const body = await res.json();
    expect(body.channels[0]).toEqual({ id: 'rai-1', name: 'Rai 1', lcn: 1, logoUrl: null });
  });
});
