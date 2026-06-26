# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [x] M1 — Schema DB + Seed Canali (eseguito su Neon via GitHub Actions "DB Migrate", workflow verde)
- [x] M2 — EPG Core Lib (4 moduli portati as-is in src/lib/epg/, build + test verdi)
- [x] M3 — EPG Store + Channel Store (channel-store.ts + epg-store.ts su singleton db.ts, build + 17 test verdi)
- [ ] M4 — Ingest Worker + GitHub Actions
- [ ] M5 — API Route Handlers (palinsesto)
- [ ] M6 — API Search + Admin
- [ ] UI-1 — Layout + Home
- [ ] UI-2 — Pagine Giorno + Canale
- [ ] UI-3 — Ricerca + Admin Panel

## Prossima sessione — inizia da qui

**M1, M2 e M3 CHIUSI.** Store DB pronti in `src/lib/epg/`: `channel-store.ts`
(`ChannelStore`: buildResolver / queueUnresolved / approveAlias / listUnresolved) e
`epg-store.ts` (`EpgStore`: upsertProgrammes batch UNNEST idempotente / tonight). Usano il
singleton `@/lib/db`, nessun `new Pool()`. Build + 17 test verdi.

**Inizia da M4:** esegui `prompts/M4_ingest_worker.md` (ingest worker + GitHub Actions cron).
Riscrivi la logica ingest dal prototipo `prototypes/oraintivu/ingest.ts` (e `oraintivu_1/ingest.ts`)
SENZA importarlo: usa `parseXmltv` (parse-xmltv), `ChannelStore.buildResolver()` per risolvere i
canali (gestisci sempre entrambi i branch resolved/unresolved → `queueUnresolved` sui fuzzy),
`EpgStore.upsertProgrammes()` per scrivere. Entry point `scripts/ingest.ts`, poi
`.github/workflows/ingest.yml` (cron 02:00 UTC, vedi docs/architecture.md).

Nota ambiente: tutto remoto (Vercel + GitHub Actions), NESSUN ambiente locale. Per girare
script che toccano Neon usa un workflow GitHub Actions, non `.env.local`. I test store NON
toccano il DB: mockano `@/lib/db` (vedi `vitest.config.ts`, alias `@/*`).

## Ultima sessione

Data: 2026-06-26
Branch: claude/next-steps-1fsc2l (M3).

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
