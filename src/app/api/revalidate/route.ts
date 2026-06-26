import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

/**
 * Confronto constant-time del token (previene timing attack).
 * `timingSafeEqual` lancia se i buffer hanno lunghezze diverse: lo evitiamo a monte.
 */
function tokenValid(provided: string | null): boolean {
  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Revalidazione ISR on-demand, invocata dall'ingest dopo l'upsert. */
export async function POST(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!tokenValid(token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidatePath('/');
  revalidatePath('/[data]', 'page');
  revalidatePath('/canale/[slug]', 'page');
  return NextResponse.json({ revalidated: true });
}
