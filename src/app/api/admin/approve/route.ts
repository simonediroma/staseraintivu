import { NextResponse } from 'next/server';
import { ChannelStore } from '@/lib/epg/channel-store';
import { adminKeyValid } from '@/lib/api';

/** Stringa non vuota dopo trim. */
function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Approva un canale irrisolto: crea l'alias e lo toglie dalla coda (transazione
 * nello store). Protetta da X-Admin-Key. Body: { source, sourceId, canonicalId }.
 */
export async function POST(request: Request) {
  if (!adminKeyValid(request.headers.get('x-admin-key'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { source, sourceId, canonicalId } = (body ?? {}) as Record<string, unknown>;
  if (!nonEmpty(source) || !nonEmpty(sourceId) || !nonEmpty(canonicalId)) {
    return NextResponse.json(
      { error: 'source, sourceId e canonicalId sono obbligatori' },
      { status: 400 }
    );
  }

  const store = new ChannelStore();
  if (!(await store.channelExists(canonicalId))) {
    return NextResponse.json(
      { error: `canonicalId '${canonicalId}' inesistente` },
      { status: 400 }
    );
  }

  await store.approveAlias(source, sourceId, canonicalId);
  return NextResponse.json({ approved: true });
}
