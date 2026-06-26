/**
 * Seed dei principali canali del DTT italiano (prima serata).
 *
 * L'LCN (Logical Channel Number) è la chiave naturale del digitale terrestre:
 * stabile e univoca. `sort_order` = LCN, così la UI ordina per LCN ASC.
 *
 * Dati portati dal prototipo `prototypes/oraintivu/channel-alias.ts`
 * (CANONICAL_SEED), che è riferimento as-is da codebase testata.
 */

export interface SeedChannel {
  id: string; // slug stabile, es. "rai-1"
  lcn: number; // numero LCN del digitale terrestre
  name: string; // nome di visualizzazione
  sortOrder: number; // = lcn, ordinamento UI
}

/** Crea una voce di seed con sort_order derivato dall'LCN. */
function ch(id: string, lcn: number, name: string): SeedChannel {
  return { id, lcn, name, sortOrder: lcn };
}

export const SEED_CHANNELS: SeedChannel[] = [
  ch('rai-1', 1, 'Rai 1'),
  ch('rai-2', 2, 'Rai 2'),
  ch('rai-3', 3, 'Rai 3'),
  ch('rete-4', 4, 'Rete 4'),
  ch('canale-5', 5, 'Canale 5'),
  ch('italia-1', 6, 'Italia 1'),
  ch('la7', 7, 'La7'),
  ch('tv8', 8, 'TV8'),
  ch('nove', 9, 'Nove'),
  ch('mediaset-20', 20, '20 Mediaset'),
  ch('rai-4', 21, 'Rai 4'),
  ch('iris', 22, 'Iris'),
  ch('rai-5', 23, 'Rai 5'),
  ch('rai-movie', 24, 'Rai Movie'),
  ch('rai-premium', 25, 'Rai Premium'),
  ch('cielo', 26, 'Cielo'),
  ch('twentyseven', 27, 'TwentySeven'),
  ch('tv2000', 28, 'TV2000'),
  ch('la7d', 29, 'La7d'),
  ch('la5', 30, 'La5'),
  ch('real-time', 31, 'Real Time'),
  ch('cine34', 34, 'Cine34'),
  ch('focus', 35, 'Focus'),
  ch('rai-gulp', 42, 'Rai Gulp'),
  ch('rai-yoyo', 43, 'Rai Yoyo'),
];
