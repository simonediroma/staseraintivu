# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [x] M1 — Schema DB + Seed Canali (eseguito su Neon via GitHub Actions "DB Migrate", workflow verde)
- [x] M2 — EPG Core Lib (4 moduli portati as-is in src/lib/epg/, build + test verdi)
- [x] M3 — EPG Store + Channel Store (channel-store.ts + epg-store.ts su singleton db.ts, build + 17 test verdi)
- [x] M4 — Ingest Worker + GitHub Actions (src/lib/epg/ingest.ts + scripts/ingest.ts + .github/workflows/ingest.yml, build + 20 test verdi)
- [ ] M5 — API Route Handlers (palinsesto)
- [ ] M6 — API Search + Admin
- [ ] UI-1 — Layout + Home
- [ ] UI-2 — Pagine Giorno + Canale
- [ ] UI-3 — Ricerca + Admin Panel

## Prossima sessione — inizia da qui

**M1–M4 CHIUSI.** Ingest worker pronto: `src/lib/epg/ingest.ts` (`ingest(source, EpgStore,
ChannelStore, opts)` → stream gunzip/SAX, risolve canali con `buildResolver()`, batch UNNEST,
irrisolti → `queueUnresolved`; ritorna `IngestStats`), entry point `scripts/ingest.ts`
(env → ingest → POST /api/revalidate graceful), workflow `.github/workflows/ingest.yml`
(cron `0 2 * * *` + workflow_dispatch). Build + 20 test verdi.

**AZIONE OPERATIVA per l'utente:** aggiungere su GitHub i secret per il workflow EPG Ingest:
`XMLTV_URL` (es. `https://iptv-org.github.io/epg/guides/it/epg.xml.gz`), `REVALIDATE_TOKEN`,
`NEXT_PUBLIC_SITE_URL` (`DATABASE_URL` già presente da M1). Poi lanciare "EPG Ingest" →
"Run workflow" per il primo popolamento di `programmes`. NB: l'endpoint `/api/revalidate`
non esiste ancora (è M5): il revalidate fallirà gracefully con un warning, è atteso.

**Inizia da M5:** esegui `prompts/M5_*` (API Route Handlers palinsesto: `/api/tonight`,
`/api/schedule`, `/api/channels`, `/api/revalidate`). Usa `EpgStore.tonight()` già pronto.
Vedi shape response e Cache-Control in `docs/architecture.md`.

Nota ambiente: tutto remoto (Vercel + GitHub Actions), NESSUN ambiente locale. Per girare
script che toccano Neon usa un workflow GitHub Actions, non `.env.local`. I test NON
toccano il DB: mockano `@/lib/db` (vedi `vitest.config.ts`, alias `@/*`). La fixture XMLTV
per il test ingest è in `src/lib/epg/__fixtures__/guide.xml`.

## Ultima sessione

Data: 2026-06-26
Branch: claude/m4-next-steps-ownnfu (M4).

Fatto (sessione M4):
- Creato `src/lib/epg/ingest.ts`: riscritto da `prototypes/oraintivu_1/ingest.ts` SENZA
  importarlo, adattato alla nuova API store (rimossi `init`/`seedIfEmpty`/`close` che non
  esistono più — schema+seed sono di M1, il pool è singleton condiviso). Streaming
  gunzip→SAX (no DOM in memoria), batch UNNEST da 500, fetch con `AbortSignal.timeout(60s)`.
  Gestisce entrambi i branch resolved/unresolved (fuzzy → `queueUnresolved`, mai auto-match).
- Creato `scripts/ingest.ts` (orchestrazione: env → `ingest()` → `POST /api/revalidate`
  con Bearer `REVALIDATE_TOKEN`, fallisce gracefully con warning se il sito non risponde;
  `pool.end()` a fine run). Nessuna logica di parsing/DB nel CLI.
- Creato `.github/workflows/ingest.yml` (cron `0 2 * * *` + workflow_dispatch, stile uguale
  a migrate.yml, secret da GitHub Actions).
- TDD: scritto prima `src/lib/epg/ingest.test.ts` (RED), poi il modulo (GREEN). 3 test
  che mockano `@/lib/db` e guidano l'ingest con fixture `__fixtures__/guide.xml`: canali
  noti risolti + ≥1 upsert / idempotenza batch / canale non canonico → `unresolved_channels`.
- `npm test` 20 verdi, `npm run build` verde. Nota: `node_modules` non era presente nel
  container effimero → `npm ci` prima di test/build.

Fatto (sessione M3):
- Creati `src/lib/epg/channel-store.ts` e `src/lib/epg/epg-store.ts`: riscritti dai prototipi
  `prototypes/oraintivu/{channel-store,db}.ts` ma su singleton `@/lib/db` (zero `new Pool()`).
- Rimossi dagli store DDL/seed/`close()`: schema+seed sono di M1 (scripts/migrate.ts), il pool
  è condiviso (chiuderlo romperebbe gli altri moduli). Scelta chirurgica.
- `ChannelStore`: buildResolver (carica canonical_channels + channel_aliases → ChannelResolver),
  queueUnresolved, approveAlias (transazione), listUnresolved. La risoluzione a 3 livelli resta
  in `channel-alias.ts` (INVARIATO) — gli store non la reimplementano.
- `EpgStore`: upsertProgrammes (UNNEST batch + ON CONFLICT (channel_id,start_at) DO UPDATE,
  idempotente; `search_vec` GENERATED esclusa), tonight (DISTINCT ON).
- TDD: scritti prima i test (RED), poi i moduli (GREEN). 7 nuovi test (4 channel + 3 epg) che
  mockano `@/lib/db` — nessuna connessione reale. Aggiunto `vitest.config.ts` per l'alias `@/*`
  (vitest non legge i paths di tsconfig). `npm test` 17 verdi, `npm run build` verde.

Fatto (sessione M2):
- Portati as-is in `src/lib/epg/`: `datetime.ts`, `parse-xmltv.ts`, `prime-time.ts`
  (da `prototypes/oraintivu_1/`), `channel-alias.ts` (da `prototypes/oraintivu/`).
  Diff puro: identici agli originali, nessuna modifica di logica.
- Gli import interni usano estensione `.js` (`./datetime.js`, `./parse-xmltv.js`): si
  risolvono correttamente con `moduleResolution: bundler`, build verde senza modifiche.
- `sax` + `@types/sax` già in package.json (richiesti da parse-xmltv).
- Aggiunto smoke test `src/lib/epg/prime-time.test.ts` (tonightWindow → {from,to} validi).
  NB: la firma reale è `tonightWindow(localDate: string, tz)`, non `Date` come nel prompt.
- `npm run build` verde, `npm test` verde (10 test totali).

Fatto (sessione M1):
- Creati `src/db/schema.sql` (4 tabelle + 3 indici, tutto `IF NOT EXISTS`),
  `src/db/seed-channels.ts` (25 canali DTT, sort_order = lcn — dati dal prototipo),
  `scripts/migrate.ts` (schema + seed `ON CONFLICT DO NOTHING`, in transazione, idempotente).
- Aggiunto workflow `.github/workflows/migrate.yml` (workflow_dispatch) per eseguire la
  migration in cloud — l'utente ha aggiunto il secret `DATABASE_URL` su GitHub. Run verde.
- Test `src/db/seed-channels.test.ts` (8 test, verdi): integrità seed + idempotenza schema.
- PR #5 mergiata su main.

Fatto (sessioni precedenti):
- Fix del deploy Vercel rotto. Il commit `a09ebcd` su main aveva aggiunto i prototipi
  `oraintivu/` e `oraintivu_1/` nella root: `next build` li type-checkava e falliva.
  Spostati in `prototypes/` ed esclusi dal build (`tsconfig.json` exclude). Build verde.
  → PR #2 mergiata su main.
- Infra completata dall'utente: **database Neon creato**, **env vars configurate su
  Vercel** (DATABASE_URL, REVALIDATE_TOKEN, ADMIN_KEY, XMLTV_*, NEXT_PUBLIC_SITE_URL).

Da sapere:
- I prototipi EPG core ESISTONO nel repo sotto `prototypes/oraintivu*` — sbloccano M2-M4
  (porting verso `src/lib/epg/`). NON importarli in `src/`, sono solo riferimento
  (vedi `prototypes/README.md`).
- Restano da scrivere per M1: `scripts/migrate.ts`, `src/db/schema.sql`,
  `src/db/seed-channels.ts` (cartelle `scripts/` e `src/db/` non ancora esistenti).
- `tsx` NON è ancora in devDependencies: M1 usa `npx tsx scripts/migrate.ts` (vedi prompt).

## Variabili d'ambiente

Già configurate su **Vercel** (Production/Preview/Development). Per girare M1/ingest **in
locale** ricrea `.env.local` (è gitignored, non sopravvive tra sessioni effimere):
```
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require  ← pooled, da Neon
REVALIDATE_TOKEN=              ← stesso valore messo su Vercel (o rigenera: openssl rand -hex 32)
ADMIN_KEY=                     ← stesso valore messo su Vercel
NEXT_PUBLIC_SITE_URL=http://localhost:3000
XMLTV_URL=https://iptv-org.github.io/epg/guides/it/epg.xml.gz
XMLTV_SOURCE=iptv-org
XMLTV_OFFSET_MINUTES=120
```

## Note sessioni precedenti

—
