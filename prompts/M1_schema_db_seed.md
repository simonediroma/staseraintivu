# M1 — Schema DB + Seed Canali

## Contesto

Dipende da: M0 completato. `src/lib/db.ts` (singleton Pool) già presente.

## Obiettivo

Creare le migration SQL, eseguirle su Neon, e seedare i 25 canali DTT principali con i loro LCN, nomi canonici e sort_order.

## Acceptance criteria

- [ ] Le 4 tabelle esistono su Neon: `canonical_channels`, `channel_aliases`, `unresolved_channels`, `programmes`
- [ ] I 3 indici esistono: `idx_programmes_start`, `idx_programmes_channel`, `idx_programmes_search`
- [ ] Seed: almeno 25 canali in `canonical_channels` (Rai 1–3, Mediaset, La7, NOVE, Real Time, ecc.)
- [ ] `search_vec` è una colonna GENERATED — non appare negli INSERT
- [ ] `npx tsx scripts/migrate.ts` esegue le migration idempotentemente (IF NOT EXISTS)
- [ ] Build: `npm run build` passa

## Files che verranno creati

- `scripts/migrate.ts` — esegue le migration SQL e il seed
- `src/db/schema.sql` — schema SQL completo (documentazione, non eseguito direttamente)
- `src/db/seed-channels.ts` — array dei 25 canali canonici con LCN e sort_order

## Doubt-Driven Review — esegui prima di scrivere codice

Per ogni decisione non banale:
1. **CLAIM** — scrivi la decisione come affermazione esplicita
2. **DOUBT** — elenca 2-3 modi in cui potrebbe essere sbagliata
3. **RECONCILE** — verifica o aggiusta. Se non regge, fermati.
Massimo 3 cicli. Se il dubbio non si risolve: fermati e chiedi.

Decisioni che richiedono questo step:
- **CLAIM**: `id` dei canali è un TEXT slug (es. `"rai-1"`), non un UUID. **DOUBT**: i slug potrebbero cambiare (rebranding canale) e invalidare FK. **RECONCILE**: per canali DTT i slug sono stabili (Rai 1 = rai-1 da decenni). Se cambia, è una migration esplicita — accettabile.
- **CLAIM**: `search_vec` è `GENERATED ALWAYS AS ... STORED`. **DOUBT**: colonne GENERATED occupano spazio disco e rallentano INSERT. **RECONCILE**: per un sito con ingest 1x/giorno e letture frequenti, STORED è la scelta corretta — nessun overhead a runtime.

## Implementazione — TDD

Scrivi il test che fallisce → implementa → refactora.
Focus test: esegui `migrate.ts` due volte → la seconda non deve fallire (idempotenza `IF NOT EXISTS`).

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

## Gate pre-PR

**Security checklist:**
- [ ] `DATABASE_URL` letto da env, mai hardcoded
- [ ] Nessun dato sensibile nel seed (solo nomi canali pubblici)
- [ ] Migration usa `IF NOT EXISTS` — sicura su Neon già popolato

**Code review a 5 assi:**
- [ ] Correttezza: schema corrisponde esattamente a `docs/architecture.md`?
- [ ] Sicurezza: nessuna SQL injection nel migration script (query parametrizzate)?
- [ ] Leggibilità: seed leggibile — ogni canale ha id, lcn, name, sort_order chiari?
- [ ] Performance: indici corretti per i pattern di query previsti?
- [ ] Chirurgico: zero logica applicativa nel migration script?

## Note per Claude Code

- Il seed va eseguito con `INSERT ... ON CONFLICT (id) DO NOTHING` — idempotente.
- Ordine LCN DTT italiano: Rai 1 (1), Rai 2 (2), Rai 3 (3), Rete 4 (4), Canale 5 (5), Italia 1 (6), La7 (7), TV8 (8), NOVE (9), Real Time (31), ecc.
- `sort_order` = LCN. La UI ordina per `sort_order` ASC.
- Non inserire `search_vec` nelle INSERT — è una colonna GENERATED, Postgres la rifiuta.
