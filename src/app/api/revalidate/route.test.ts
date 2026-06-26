import { describe, it, expect, vi, beforeEach } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import { POST } from './route';

const post = (auth?: string) =>
  new Request('http://x/api/revalidate', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  revalidatePath.mockReset();
  process.env.REVALIDATE_TOKEN = 'secret-token';
});

describe('POST /api/revalidate', () => {
  it('senza header → 401, nessun revalidate', async () => {
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('token errato → 401', async () => {
    const res = await POST(post('Bearer wrong-token'));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('token con lunghezza diversa → 401 (no throw timingSafeEqual)', async () => {
    const res = await POST(post('Bearer short'));
    expect(res.status).toBe(401);
  });

  it('token corretto → 200 + revalidatePath', async () => {
    const res = await POST(post('Bearer secret-token'));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});
