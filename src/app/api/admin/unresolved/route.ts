import { NextResponse } from 'next/server';
import { ChannelStore } from '@/lib/epg/channel-store';
import { adminKeyValid, serializeUnresolved } from '@/lib/api';

/** Coda dei canali irrisolti con suggerimenti. Protetta da X-Admin-Key. */
export async function GET(request: Request) {
  if (!adminKeyValid(request.headers.get('x-admin-key'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await new ChannelStore().listUnresolved();
  return NextResponse.json({ unresolved: rows.map(serializeUnresolved) });
}
