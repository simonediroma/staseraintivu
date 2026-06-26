import { NextResponse } from 'next/server';
import { ChannelStore } from '@/lib/epg/channel-store';
import { CACHE_FRESH } from '@/lib/api';

/** Lista dei canali attivi. */
export async function GET() {
  const channels = await new ChannelStore().listActiveChannels();
  return NextResponse.json(
    { channels },
    { headers: { 'Cache-Control': CACHE_FRESH } }
  );
}
