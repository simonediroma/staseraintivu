# M3 — EPG Store + Channel Store

## Contesto

Dipende da: M1 completato (schema DB su Neon), M2 completato (EPG core lib presente).

## Obiettivo

Riscrivere `channel-store.ts` e `epg-store.ts` usando il singleton `src/lib/db.ts` invece di creare Pool propri. Stessa logica dei prototipi `oraintivu/channel-store.ts` e `oraintivu/db.ts` — solo il pattern di connessione cambia.

## Acceptance criteria

- [ ] `src/lib/epg/channel-store.ts` — nessun `new Pool()` al suo interno
- [ ] `src/lib/epg/epg-store.ts` — nessun `new Pool()` al suo interno
- [ ] `ChannelStore.resolve('Rai1.it', 'iptv-org')` restituisce `{ status: 'resolved', canonicalId: 'rai-1' }` contro il DB seedato in M1
- [ ] `EpgStore.upsertProgrammes([...])` — idempotente: eseguito due volte con stessi dati non duplica righe
- [ ] Test: `ChannelStore.resolve` con canale inesistente → `{ status: 'unresolved', suggestions: [...] }`
- [ ] Build: `npm run build` passa

## Files che verranno creati

- `src/lib/epg/channel-store.ts` — riscritto (usa `import pool from '@/lib/db'`)
- `src/lib/epg/epg-store.ts` — riscritto (usa `import pool from '@/lib/db'`)

## Implementazione — TDD

Scrivi il test che fallisce → implementa → refactora.
Test da scrivere prima:
1. `ChannelStore.resolve` con alias esistente → `resolved`
2. `ChannelStore.resolve` con alias inesistente → `unresolved` con suggestions
3. `EpgStore.upsertProgrammes` idempotenza

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

## Gate pre-PR

**Code review a 5 assi:**
- [ ] Correttezza: `resolve()` gestisce tutti i 3 livelli (alias → normalizzato → fuzzy)?
- [ ] Sicurezza: nessuna SQL injection — tutte le query parametrizzate?
- [ ] Leggibilità: le funzioni store hanno nomi che descrivono cosa fanno?
- [ ] Performance: `upsertProgrammes` usa batch INSERT, non loop di INSERT singoli?
- [ ] Chirurgico: zero logica UI o HTTP nei moduli store?

## Note per Claude Code

- Usa `pool.query()` per query semplici. Usa `pool.connect()` + try/finally + `client.release()` solo per le transazioni (vedi docs/lessons.md).
- Il fuzzy matching Levenshtein è in `channel-alias.ts` — riusa, non reimplementare.
- `upsertProgrammes` deve usare `ON CONFLICT (channel_id, start_at) DO UPDATE` — ingest idempotente.
- `EpgStore` corrisponde a `oraintivu/db.ts` — stessa API pubblica, solo il Pool cambia.
