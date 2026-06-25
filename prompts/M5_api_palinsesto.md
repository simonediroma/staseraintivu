# M5 — API Route Handlers (palinsesto)

## Contesto

Dipende da: M3 completato. EpgStore e ChannelStore funzionanti con dati nel DB.

## Obiettivo

Implementare le API Route Handlers pubbliche del palinsesto e l'endpoint di revalidazione ISR. Le pagine UI useranno questi endpoint o interrogheranno direttamente il DB tramite Server Components — entrambi i pattern sono accettabili per le pagine ISR.

## Acceptance criteria

- [ ] `GET /api/tonight` restituisce JSON con `{ date, window, programmes[] }` (shape in `docs/architecture.md`)
- [ ] `GET /api/schedule?date=2026-06-25` restituisce programmi del giorno ordinati per `(channel_id, start_at)`
- [ ] `GET /api/schedule?date=2026-06-25&channel=rai-1` filtra sul canale
- [ ] `GET /api/channels` restituisce lista canali attivi con `id, name, lcn, logo_url`
- [ ] `POST /api/revalidate` con header `Authorization: Bearer <REVALIDATE_TOKEN>` → 200 + revalidatePath
- [ ] `POST /api/revalidate` senza token → 401
- [ ] Tutti gli endpoint GET hanno `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`
- [ ] `/api/schedule` per date passate ha `Cache-Control: s-maxage=86400, immutable`
- [ ] `GET /api/schedule?date=invalid` → 400
- [ ] Build: `npm run build` passa

## Files che verranno creati

- `src/app/api/tonight/route.ts`
- `src/app/api/schedule/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/revalidate/route.ts`

## API Contract

- Definisci i tipi TypeScript input/output prima di scrivere i handler (shape in `docs/architecture.md`)
- Valida l'input esterno nel route handler — una sola volta. EpgStore si fida dei tipi dopo la validazione
- Esponi solo i campi definiti in `docs/architecture.md`. Ogni campo esposto diventa un contratto per il frontend (Hyrum's Law) — non aggiungere campi speculativi

## Implementazione — TDD

Scrivi il test che fallisce → implementa → refactora.
Non aggiungere test dopo il codice.

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

## Gate pre-PR

**Security checklist:**
- [ ] `REVALIDATE_TOKEN` confrontato con `crypto.timingSafeEqual` (no `===`)
- [ ] `REVALIDATE_TOKEN` mai loggato o esposto nel response body
- [ ] Input `date` e `channel` validati prima di qualsiasi query DB

**Code review a 5 assi:**
- [ ] Correttezza: la shape della response corrisponde a `docs/architecture.md`?
- [ ] Sicurezza: `REVALIDATE_TOKEN` verificato con confronto constant-time (`timingSafeEqual`)?
- [ ] Leggibilità: ogni route handler ≤ 30 righe?
- [ ] Performance: nessuna query N+1 (un solo `JOIN` per i dati del canale)?
- [ ] Chirurgico: nessuna logica business nei route handlers — tutto delegato a EpgStore?

## Note per Claude Code

- In Next.js 15 App Router, `export async function GET(request: Request)` è il pattern corretto per i Route Handlers.
- `tonightWindow(localDate, 'Europe/Rome')` da `prime-time.ts` calcola la finestra `from/to` — usala, non ricalcolarla.
- Per il confronto del token: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` — previene timing attacks.
- Le date in input `?date=YYYY-MM-DD` vanno validate con una regex prima di passarle al DB. Input malformato → 400.
