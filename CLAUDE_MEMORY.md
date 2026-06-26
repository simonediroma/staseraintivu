# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [x] M1 — Schema DB + Seed Canali (eseguito su Neon via GitHub Actions "DB Migrate", workflow verde)
- [x] M2 — EPG Core Lib (4 moduli portati as-is in src/lib/epg/, build + test verdi)
- [x] M3 — EPG Store + Channel Store (channel-store.ts + epg-store.ts su singleton db.ts, build + 17 test verdi)
- [x] M4 — Ingest Worker + GitHub Actions (src/lib/epg/ingest.ts + scripts/ingest.ts + .github/workflows/ingest.yml, build + 20 test verdi)
- [x] M5 — API Route Handlers palinsesto (tonight/schedule/channels/revalidate + lib/api.ts, build + 41 test verdi)
- [x] M6 — API Search + Admin (search + admin/unresolved + admin/approve, build + 70 test verdi)
- [x] UI-1 — Layout + Home
- [x] UI-2 — Pagine Giorno + Canale (build + 70 test verdi)
- [x] UI-3 — Ricerca + Admin Panel (build + 70 test verdi)

## Prossima sessione — inizia da qui

**UI-3 CHIUSA. Tutte le macros completate.** Verifica deploy su Vercel (branch merge su main),
controlla che il workflow EPG Ingest sia stato eseguito con i secret GitHub corretti,
e testa manualmente le pagine: `/` (home stasera), `/[data]` (palinsesto giorno),
`/canale/[slug]` (timeline canale), `/cerca` (ricerca), `/admin` (pannello admin).

**UI-2 CHIUSA. Inizia da UI-3:** esegui `prompts/UI-3_ricerca_admin.md`.
Sono pronte: `/[data]` (palinsesto giorno, ISR 1h, generateStaticParams ieri+oggi+5 avanti,
`DayNav` con limiti navigazione, 404 su data malformata) e `/canale/[slug]`
(timeline oggi per canale, highlight "in corso" server-side, 404 su slug/canale inesistente).
Nuovi componenti: `DayNav.tsx` (Client Component, Link), `Timeline.tsx` (Server Component,
`<time>` semantico). Branch UI-2: `claude/prossimo-task-u2-hjzn7h`, build + 70 test verdi.

**M1–M6 CHIUSI. TUTTE LE API BACKEND PRONTE.** Oltre al palinsesto (M5) ora ci sono:
`/api/search?q=&limit=&offset=` (full-text tsvector, `EpgStore.search()` con
`websearch_to_tsquery('italian',$1)` parametrizzato + `ts_rank`, shape `{results,total}`,
`no-store`, header `X-RateLimit-Limit:30`), `/api/admin/unresolved` (GET, lista coda
serializzata camelCase) e `/api/admin/approve` (POST, body `{source,sourceId,canonicalId}`,
transazione via `ChannelStore.approveAlias`), entrambe protette da `X-Admin-Key`
(`adminKeyValid` in `src/lib/api.ts`, `crypto.timingSafeEqual`). Helper M6 in `src/lib/api.ts`:
`serializeSearchResult`, `serializeUnresolved`, `adminKeyValid`. Build + 70 test verdi.

**AZIONE OPERATIVA per l'utente (ancora valida se non già fatta):** aggiungere su GitHub i
secret per il workflow EPG Ingest: `XMLTV_URL`
(es. `https://iptv-org.github.io/epg/guides/it/epg.xml.gz`), `REVALIDATE_TOKEN`,
`NEXT_PUBLIC_SITE_URL` (`DATABASE_URL` già presente da M1). Poi lanciare "EPG Ingest" →
"Run workflow" per il primo popolamento di `programmes`. `ADMIN_KEY` serve ora anche per
testare le API admin.

**UI-1 CHIUSA. Inizia da UI-2:** esegui `prompts/UI-2_pagine_giorno_canale.md`.
La home è pronta (ISR 1h, query diretta EpgStore.tonight(), griglia ordinata per LCN,
dark mode, componenti: ChannelGrid/ChannelRow/ProgrammeCard/CategoryChip/DarkModeToggle).
Branch UI-1: `claude/prossimo-task-u1-etgxc8`, build + 70 test verdi.

Nota ambiente: tutto remoto (Vercel + GitHub Actions), NESSUN ambiente locale. Per girare
script che toccano Neon usa un workflow GitHub Actions, non `.env.local`. I test NON
toccano il DB: mockano `@/lib/db` (vedi `vitest.config.ts`, alias `@/*`). La fixture XMLTV
per il test ingest è in `src/lib/epg/__fixtures__/guide.xml`.

## Ultima sessione

Data: 2026-06-26
Branch: claude/prossimo-task-u3-jfacvg (UI-3).

Fatto (sessione M6):
- Creati 3 Route Handlers: `src/app/api/search/route.ts`,
  `src/app/api/admin/unresolved/route.ts`, `src/app/api/admin/approve/route.ts`.
  Pattern M5: validazione al boundary nel route, delega allo store, serializzazione in `api.ts`.
- `/api/search`: `parseParams` valida `q` (non vuota, ≤100 char → altrimenti 400) e normalizza
  `limit` (default 20, max 50) / `offset` (≥0). Delega a `EpgStore.search`. Shape `{results,total}`
  (result fisso: channelId/channelName/startAt/stopAt/title/description/categories — no extra,
  Hyrum). `Cache-Control: no-store` + header `X-RateLimit-Limit: 30`; abusi (input rifiutato)
  loggati con `console.warn` (nessun enforcement in v1).
- `EpgStore.search(q,limit,offset)`: `websearch_to_tsquery('italian',$1)` PARAMETRIZZATO
  (input grezzo/`'; DROP TABLE…` → risultati vuoti, mai crash/injection), ordine `ts_rank DESC`.
  LIMIT/OFFSET in subquery su `programmes` PRIMA del JOIN `canonical_channels`. `total` da
  seconda query `count(*)`. Ritorna `{rows,total}`.
- `/api/admin/*`: auth `X-Admin-Key` via `adminKeyValid` (`crypto.timingSafeEqual`, guard su
  lunghezza, coerente con `tokenValid` di revalidate). Assente/errata → 401.
- `/api/admin/unresolved` (GET): `ChannelStore.listUnresolved()` → `serializeUnresolved` (camelCase
  ISO, nessun ID interno Postgres).
- `/api/admin/approve` (POST): valida JSON + 3 campi non vuoti (trim) → 400 se incompleto/malformato.
  Pre-check `ChannelStore.channelExists(canonicalId)` → 400 con messaggio chiaro se inesistente
  (belt-and-suspenders col FK). Poi `approveAlias` (transazione INSERT alias + DELETE coda).
- Helper aggiunti a `src/lib/api.ts`: `serializeSearchResult`, `serializeUnresolved`,
  `adminKeyValid` (+ tipi `SearchRow`/`UnresolvedRow`).
- TDD: scritti prima i test (RED confermato), poi implementazione (GREEN). 29 nuovi test
  (api helpers + store search/channelExists + 3 route, mock `@/lib/db`/store). `npm test` 70 verdi,
  `npm run build` verde (3 route ƒ dynamic registrate).

Fatto (sessione M5):
- Creati 4 Route Handlers App Router: `src/app/api/{tonight,schedule,channels,revalidate}/route.ts`.
  Ogni handler ≤30 righe, zero business logic: valida l'input e delega allo store.
- `/api/tonight`: `tonightWindow(romeToday(),'Europe/Rome')` → `EpgStore.tonight()` → shape
  `{date, window:{from,to}, programmes[]}` (vedi docs/architecture.md). Cache fresh.
- `/api/schedule?date=&channel=`: valida `date` (regex + data reale) e `channel` (slug);
  malformati → 400 PRIMA di qualsiasi query. Finestra giorno calendario Europe/Rome con
  `zonedWallTimeToUtc`. Date passate → `Cache-Control: s-maxage=86400, immutable`, altrimenti fresh.
  Aggiunto `EpgStore.schedule(from,to,channelId?)` (JOIN canale, ORDER BY channel_id,start_at).
- `/api/channels`: aggiunto `ChannelStore.listActiveChannels()` (is_active, ORDER BY sort_order,
  alias SQL `logo_url AS "logoUrl"`). Cache fresh.
- `/api/revalidate` (POST): Bearer token confrontato con `crypto.timingSafeEqual` (guard su
  lunghezza per non lanciare); assente/errato → 401, token mai loggato/esposto. Revalida
  `/`, `/[data]`, `/canale/[slug]`.
- Creato `src/lib/api.ts` (helper condivisi: `isValidDate`, `isSlug`, `romeToday`,
  `serializeProgramme` row→shape camelCase/ISO, costanti `CACHE_FRESH`/`CACHE_IMMUTABLE`).
- TDD: scritti prima i test (RED), poi implementazione (GREEN). 18 nuovi test (api.ts +
  store + 4 route, mock `@/lib/db`/store/`next/cache`). `npm test` 41 verdi.
- BUILD FIX necessario: le route hanno tirato per la prima volta gli store nel grafo
  webpack di Next, che NON risolve l'estensione `.js` sugli import interni (tsc/vitest sì).
  Unico import a runtime rotto: `channel-store.ts` → `./channel-alias.js` (ChannelResolver è
  una classe). Fix chirurgico: rimossa l'estensione `.js` su quella riga (channel-alias.ts
  resta INVARIATO; gli altri `.js` sono `import type`, elisi, innocui). `npm run build` verde.

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
