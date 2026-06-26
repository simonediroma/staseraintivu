/**
 * Risoluzione dei canali verso un ID CANONICO.
 *
 * Problema: ogni sorgente EPG nomina lo stesso canale in modo diverso
 *   raiplay.it → "Rai1.it"      display "Rai 1"
 *   altro feed → "rai-1"        display "RAI 1 HD"
 *   un terzo   → "rai_uno"      display "Rai Uno"
 * Vogliamo che convergano tutti su un unico canonical_id ("rai-1").
 *
 * Strategia a livelli (dal più sicuro al meno sicuro):
 *   1. ALIAS esatto      (source + source_id già mappati a mano) → auto
 *   2. NOME normalizzato (match esatto dopo normalizzazione)     → auto
 *   3. FUZZY             (similarità di stringa) → SUGGERIMENTO, mai auto
 *
 * Il fuzzy NON viene mai applicato in automatico di default: "Rai 4" e
 * "Rai 5" distano una sola lettera. Gli irrisolti finiscono in una coda
 * di revisione con i candidati ordinati, pronti per l'approvazione umana.
 */

export interface CanonicalChannel {
  id: string;        // slug stabile, es. "rai-1"
  lcn: number;       // numero LCN del digitale terrestre (chiave naturale)
  name: string;      // nome di visualizzazione
  logoUrl?: string;
}

export interface ChannelAlias {
  source: string;    // es. "raiplay.it"
  sourceId: string;  // l'id usato da quella sorgente, es. "Rai1.it"
  canonicalId: string;
}

export type ResolveResult =
  | { status: 'resolved'; canonicalId: string; method: 'alias' | 'name' }
  | {
      status: 'unresolved';
      suggestions: { canonicalId: string; name: string; score: number }[];
    };

/**
 * Normalizza un nome canale per il confronto.
 * - minuscolo, accenti rimossi
 * - rimuove i marcatori di QUALITÀ (hd, fhd, uhd, 4k, sd) → stesso canale
 * - MANTIENE i timeshift (+1, +2) → sono canali distinti
 * - "uno/due/tre..." → cifre (Rai Uno == Rai 1)
 * - collassa tutto in alfanumerico
 */
const WORD_NUMBERS: Record<string, string> = {
  uno: '1', due: '2', tre: '3', quattro: '4', cinque: '5',
  sei: '6', sette: '7', otto: '8', nove: '9', dieci: '10',
};

export function normalizeChannelName(raw: string): string {
  let s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // preserva i timeshift prima di togliere la punteggiatura
  const timeshift = s.match(/\+\s*(\d)/);
  const shiftTag = timeshift ? `plus${timeshift[1]}` : '';

  s = s.replace(/\.(it|tv|va)\b/g, ' '); // suffissi tipo "Rai1.it"
  s = s.replace(/\b(fhd|uhd|hd|sd|4k)\b/g, ' '); // qualità
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();

  s = s
    .split(' ')
    .map((w) => WORD_NUMBERS[w] ?? w)
    .join('');

  return s + shiftTag;
}

/** Distanza di Levenshtein (per i suggerimenti fuzzy). */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Similarità 0..1 basata su Levenshtein normalizzato. */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export class ChannelResolver {
  private aliasIndex = new Map<string, string>();       // "source\u0000sourceId" → canonicalId
  private nameIndex = new Map<string, string>();         // nomeNormalizzato → canonicalId
  private canonicals: CanonicalChannel[] = [];

  constructor(
    canonicals: CanonicalChannel[],
    aliases: ChannelAlias[] = [],
    private suggestionLimit = 3,
    private suggestionFloor = 0.55 // sotto questa soglia non propone nulla
  ) {
    this.canonicals = canonicals;
    for (const c of canonicals) {
      this.nameIndex.set(normalizeChannelName(c.name), c.id);
    }
    for (const a of aliases) this.addAlias(a);
  }

  addAlias(a: ChannelAlias): void {
    this.aliasIndex.set(`${a.source}\u0000${a.sourceId}`, a.canonicalId);
  }

  resolve(source: string, sourceId: string, displayName: string): ResolveResult {
    // 1. alias esatto
    const aliasHit = this.aliasIndex.get(`${source}\u0000${sourceId}`);
    if (aliasHit) return { status: 'resolved', canonicalId: aliasHit, method: 'alias' };

    // 2. nome normalizzato (prova sia il sourceId che il displayName)
    for (const candidate of [displayName, sourceId]) {
      const norm = normalizeChannelName(candidate);
      const nameHit = this.nameIndex.get(norm);
      if (nameHit) return { status: 'resolved', canonicalId: nameHit, method: 'name' };
    }

    // 3. fuzzy → solo suggerimenti
    const target = normalizeChannelName(displayName || sourceId);
    const suggestions = this.canonicals
      .map((c) => ({
        canonicalId: c.id,
        name: c.name,
        score: similarity(target, normalizeChannelName(c.name)),
      }))
      .filter((s) => s.score >= this.suggestionFloor)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.suggestionLimit);

    return { status: 'unresolved', suggestions };
  }
}

/**
 * Seed dei principali canali del DTT italiano (prima serata).
 * L'LCN è una chiave naturale ottima: stabile e univoca.
 */
export const CANONICAL_SEED: CanonicalChannel[] = [
  { id: 'rai-1', lcn: 1, name: 'Rai 1' },
  { id: 'rai-2', lcn: 2, name: 'Rai 2' },
  { id: 'rai-3', lcn: 3, name: 'Rai 3' },
  { id: 'rete-4', lcn: 4, name: 'Rete 4' },
  { id: 'canale-5', lcn: 5, name: 'Canale 5' },
  { id: 'italia-1', lcn: 6, name: 'Italia 1' },
  { id: 'la7', lcn: 7, name: 'La7' },
  { id: 'tv8', lcn: 8, name: 'TV8' },
  { id: 'nove', lcn: 9, name: 'Nove' },
  { id: 'mediaset-20', lcn: 20, name: '20 Mediaset' },
  { id: 'rai-4', lcn: 21, name: 'Rai 4' },
  { id: 'iris', lcn: 22, name: 'Iris' },
  { id: 'rai-5', lcn: 23, name: 'Rai 5' },
  { id: 'rai-movie', lcn: 24, name: 'Rai Movie' },
  { id: 'rai-premium', lcn: 25, name: 'Rai Premium' },
  { id: 'cielo', lcn: 26, name: 'Cielo' },
  { id: 'twentyseven', lcn: 27, name: 'TwentySeven' },
  { id: 'tv2000', lcn: 28, name: 'TV2000' },
  { id: 'la7d', lcn: 29, name: 'La7d' },
  { id: 'la5', lcn: 30, name: 'La5' },
  { id: 'real-time', lcn: 31, name: 'Real Time' },
  { id: 'cine34', lcn: 34, name: 'Cine34' },
  { id: 'focus', lcn: 35, name: 'Focus' },
  { id: 'rai-gulp', lcn: 42, name: 'Rai Gulp' },
  { id: 'rai-yoyo', lcn: 43, name: 'Rai Yoyo' },
];

/** Alias noti di partenza per i grabber iptv-org (xmltv_id → canonical). */
export const ALIAS_SEED: ChannelAlias[] = [
  { source: 'raiplay.it', sourceId: 'rai-1', canonicalId: 'rai-1' },
  { source: 'raiplay.it', sourceId: 'rai-2', canonicalId: 'rai-2' },
  { source: 'raiplay.it', sourceId: 'rai-3', canonicalId: 'rai-3' },
  { source: 'raiplay.it', sourceId: 'rai-movie', canonicalId: 'rai-movie' },
  { source: 'raiplay.it', sourceId: 'rai-premium', canonicalId: 'rai-premium' },
  { source: 'raiplay.it', sourceId: 'rai-gulp', canonicalId: 'rai-gulp' },
];
