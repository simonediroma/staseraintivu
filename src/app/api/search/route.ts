import { NextResponse } from 'next/server';
import { EpgStore } from '@/lib/epg/epg-store';
import { serializeSearchResult } from '@/lib/api';

const MAX_Q = 100;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/** Limite "informativo" di rate (nessun enforcement in v1, solo header + tracciamento). */
const RATE_LIMIT = 30;

/** Intero non negativo da query string, con fallback se mancante/non numerico. */
function intParam(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (raw === null || !Number.isInteger(n) || n < 0) return fallback;
  return n;
}

/**
 * Validazione e normalizzazione dei parametri di ricerca al boundary.
 * `null` = input non valido (→ 400). Tutto il resto del codice si fida del tipo.
 */
function parseParams(
  searchParams: URLSearchParams
): { q: string; limit: number; offset: number } | null {
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length === 0 || q.length > MAX_Q) return null;
  const limit = Math.min(intParam(searchParams.get('limit'), DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = intParam(searchParams.get('offset'), 0);
  return { q, limit, offset };
}

/** Ricerca full-text pubblica. Input utente grezzo gestito da websearch_to_tsquery. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = parseParams(searchParams);
  if (!params) {
    console.warn('[search] input rifiutato (q mancante o troppo lunga)');
    return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  }
  const { rows, total } = await new EpgStore().search(params.q, params.limit, params.offset);
  return NextResponse.json(
    { results: rows.map(serializeSearchResult), total },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-RateLimit-Limit': String(RATE_LIMIT),
      },
    }
  );
}
