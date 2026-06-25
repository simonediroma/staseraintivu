# M6 — API Search + Admin

## Contesto

Dipende da: M5 completato. Tutti gli endpoint pubblici funzionanti.

## Obiettivo

Implementare la ricerca full-text e le API admin per la gestione dei canali irrisolti. Entrambi richiedono attenzione alla sicurezza: la ricerca è pubblica ma accetta input utente; l'admin è protetto da chiave.

## Acceptance criteria

- [ ] `GET /api/search?q=totò` restituisce programmi con titolo/descrizione corrispondente (tsvector)
- [ ] `GET /api/search?q=` (query vuota) → 400
- [ ] `GET /api/search?q=<più di 100 caratteri>` → 400
- [ ] `GET /api/admin/unresolved` senza `X-Admin-Key` → 401
- [ ] `GET /api/admin/unresolved` con chiave corretta → lista canali irrisolti con suggerimenti
- [ ] `POST /api/admin/approve` con body `{ source, sourceId, canonicalId }` → approva il canale (transazione)
- [ ] `POST /api/admin/approve` con `canonicalId` non esistente → 400 con messaggio chiaro
- [ ] Paginazione su `/api/search`: parametri `limit` (max 50) e `offset`
- [ ] Build: `npm run build` passa

## Files che verranno creati

- `src/app/api/search/route.ts`
- `src/app/api/admin/unresolved/route.ts`
- `src/app/api/admin/approve/route.ts`

## API Contract

- Input `q` e i campi body admin vanno validati nel route handler, non nell'EpgStore
- Result shape ricerca è fisso: `channelId, channelName, startAt, stopAt, title, description, categories` — no campi extra speculativi
- Gli endpoint `/api/admin/*` non devono esporre ID Postgres interni non usati dal frontend (Hyrum's Law: ogni campo esposto diventa un contratto)

## Doubt-Driven Review — esegui prima di scrivere codice

Per ogni decisione non banale:
1. **CLAIM** — scrivi la decisione come affermazione esplicita
2. **DOUBT** — elenca 2-3 modi in cui potrebbe essere sbagliata
3. **RECONCILE** — verifica o aggiusta. Se non regge, fermati.
Massimo 3 cicli. Se il dubbio non si risolve: fermati e chiedi.

Decisioni che richiedono questo step:
- **Query full-text con `to_tsquery` vs `plainto_tsquery`**: CLAIM: `websearch_to_tsquery('italian', $1)` è la scelta giusta — gestisce input utente grezzo senza crashare. DOUBT: potrebbe essere meno precisa di `to_tsquery` per query con operatori espliciti. RECONCILE: per input utente non tecnico, `websearch_to_tsquery` è superiore — accetta frasi naturali, non richiede sintassi speciale.
- **Confronto `ADMIN_KEY`**: CLAIM: confronto con `===` è sufficiente per una chiave lunga. DOUBT: timing attack teoricamente possibile anche su stringhe lunghe. RECONCILE: usa `crypto.timingSafeEqual` per coerenza con `/api/revalidate`.

## Implementazione — TDD

Scrivi il test che fallisce → implementa → refactora.
Focus test: ricerca con SQL injection attempt (`'; DROP TABLE programmes;--`) → deve ritornare risultati vuoti, non errore DB.

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

## Gate pre-PR

**Security checklist:**
- [ ] Input `q` non passato raw a `to_tsquery` — usa `websearch_to_tsquery` o query parametrizzata
- [ ] `ADMIN_KEY` verificato con `timingSafeEqual`
- [ ] Body di `/api/admin/approve` validato (tutti e 3 i campi presenti, nessuno vuoto)
- [ ] Rate limiting: aggiungi header `X-RateLimit-Limit: 30` e logga abusi (anche senza enforcement, traccia)

**Code review a 5 assi:**
- [ ] Correttezza: la ricerca restituisce risultati ordinati per rilevanza (`ts_rank`)?
- [ ] Sicurezza: nessuna SQL injection possibile?
- [ ] Leggibilità: la validazione input è in una funzione separata?
- [ ] Performance: `LIMIT` applicato prima del `JOIN` dove possibile?
- [ ] Chirurgico: nessun endpoint extra, nessun campo speculativo?

## Note per Claude Code

- `websearch_to_tsquery('italian', $1)` accetta input utente grezzo senza crashare — è la scelta corretta per `/api/search`.
- Il result shape della ricerca è fisso (vedi docs/architecture.md): `channelId, channelName, startAt, stopAt, title, description, categories`.
- L'endpoint admin non ha bisogno di sessioni — header `X-Admin-Key` è sufficiente per questo progetto.
- `/api/admin/approve` deve essere una transazione: INSERT in `channel_aliases` + DELETE da `unresolved_channels` in un unico `BEGIN/COMMIT`.
