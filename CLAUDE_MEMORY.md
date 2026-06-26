# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [x] M1 — Schema DB + Seed Canali (eseguito su Neon via GitHub Actions "DB Migrate", workflow verde)
- [x] M2 — EPG Core Lib (4 moduli portati as-is in src/lib/epg/, build + test verdi)
- [ ] M3 — EPG Store + Channel Store
- [ ] M4 — Ingest Worker + GitHub Actions
- [ ] M5 — API Route Handlers (palinsesto)
- [ ] M6 — API Search + Admin
- [ ] UI-1 — Layout + Home
- [ ] UI-2 — Pagine Giorno + Canale
- [ ] UI-3 — Ricerca + Admin Panel

## Prossima sessione — inizia da qui

**M1 e M2 CHIUSI.** Schema + 25 canali su Neon (workflow "DB Migrate" verde). I 4 moduli
EPG core sono in `src/lib/epg/` (datetime, parse-xmltv, prime-time, channel-alias) —
portati as-is, INVARIATI per policy (vedi CLAUDE.md). Build + test verdi (10 test).

**Inizia da M3:** esegui `prompts/M3_epg_store_channel_store.md` (riscrivi `channel-store.ts`
e `epg-store.ts` per usare il singleton `src/lib/db.ts`; riferimento i prototipi
`prototypes/oraintivu/channel-store.ts` e gli `ingest.ts`, ma NON importarli — vanno
riscritti). Poi M4 (ingest worker).

Nota ambiente: tutto remoto (Vercel + GitHub Actions), NESSUN ambiente locale. Per girare
script che toccano Neon usa il workflow GitHub Actions "DB Migrate", non `.env.local`.

## Ultima sessione

Data: 2026-06-26
Branch: claude/m2-epg-core-lib (M1 era su claude/next-steps-54ywii → PR #5 MERGIATA su main).

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
