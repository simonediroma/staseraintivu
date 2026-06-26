import { describe, it, expect, vi, beforeEach } from 'vitest';

const approveAlias = vi.fn();
const channelExists = vi.fn();
vi.mock('@/lib/epg/channel-store', () => ({
  ChannelStore: vi.fn(() => ({
    approveAlias: (...a: unknown[]) => approveAlias(...a),
    channelExists: (...a: unknown[]) => channelExists(...a),
  })),
}));

import { POST } from './route';

const post = (body: unknown, key?: string) =>
  new Request('http://x/api/admin/approve', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'x-admin-key': key } : {}),
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  approveAlias.mockReset();
  channelExists.mockReset();
  approveAlias.mockResolvedValue(undefined);
  channelExists.mockResolvedValue(true);
  process.env.ADMIN_KEY = 'admin-secret';
});

const valid = { source: 'iptv-org', sourceId: 'xyz.it', canonicalId: 'rai-4' };

describe('POST /api/admin/approve', () => {
  it('senza X-Admin-Key → 401, nessuna mutazione', async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(401);
    expect(approveAlias).not.toHaveBeenCalled();
  });

  it('body incompleto o campi vuoti → 400', async () => {
    expect((await POST(post({ source: 'x', sourceId: 'y' }, 'admin-secret'))).status).toBe(400);
    expect((await POST(post({ ...valid, canonicalId: '' }, 'admin-secret'))).status).toBe(400);
    expect((await POST(post({ ...valid, source: '  ' }, 'admin-secret'))).status).toBe(400);
    expect(approveAlias).not.toHaveBeenCalled();
  });

  it('canonicalId inesistente → 400 con messaggio chiaro, nessuna mutazione', async () => {
    channelExists.mockResolvedValue(false);
    const res = await POST(post(valid, 'admin-secret'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/canonical/i);
    expect(approveAlias).not.toHaveBeenCalled();
  });

  it('body valido + canale esistente → 200, delega ad approveAlias', async () => {
    const res = await POST(post(valid, 'admin-secret'));
    expect(res.status).toBe(200);
    expect(approveAlias).toHaveBeenCalledWith('iptv-org', 'xyz.it', 'rai-4');
  });

  it('JSON malformato → 400', async () => {
    const res = await POST(
      new Request('http://x/api/admin/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': 'admin-secret' },
        body: '{not json',
      })
    );
    expect(res.status).toBe(400);
    expect(approveAlias).not.toHaveBeenCalled();
  });
});
