# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [~] M1 — Schema DB + Seed Canali (codice fatto + build/test verdi; manca SOLO eseguire `npx tsx scripts/migrate.ts` su Neon in locale)
- [ ] M2 — EPG Core Lib (porta da oraintivu)
- [ ] M3 — EPG Store + Channel Store
- [ ] M4 — Ingest Worker + GitHub Actions
- [ ] M5 — API Route Handlers (palinsesto)
- [ ] M6 — API Search + Admin
- [ ] UI-1 — Layout + Home
- [ ] UI-2 — Pagine Giorno + Canale
- [ ] UI-3 — Ricerca + Admin Panel

## Prossima sessione — inizia da qui

**Prima cosa (chiude M1):** crea `.env.local` con `DATABASE_URL` pooled di Neon (vedi
sezione variabili sotto) ed esegui `npx tsx scripts/migrate.ts` in locale. Verifica su
Neon che esistano le 4 tabelle, i 3 indici e i 25 canali in `canonical_channels`. Rieseguilo
una seconda volta per confermare l'idempotenza (non deve fallire). Poi marca M1 come `[x]`.

Il codice di M1 è già scritto e pushato (`src/db/schema.sql`, `src/db/seed-channels.ts`,
`scripts/migrate.ts`, test in `src/db/seed-channels.test.ts`). Build e test verdi.
L'esecuzione su Neon NON è stata fatta dal container web (effimero, niente accesso a Neon).

**Poi:** esegui `prompts/M2_epg_core_lib.md` (porta i moduli EPG core da `prototypes/` a
`src/lib/epg/`). M2-M4 sbloccate: i prototipi EPG sono in `prototypes/` (vedi sotto).

## Ultima sessione

Data: 2026-06-26
Branch: claude/next-steps-54ywii
PR corrente: nessuna ancora aperta per questo branch (M1 codice pushato sul branch).

Fatto (sessione M1):
- Creati `src/db/schema.sql` (4 tabelle + 3 indici, tutto `IF NOT EXISTS`),
  `src/db/seed-channels.ts` (25 canali DTT, sort_order = lcn — dati dal prototipo),
  `scripts/migrate.ts` (schema + seed `ON CONFLICT DO NOTHING`, in transazione, idempotente).
- Test `src/db/seed-channels.test.ts` (8 test, verdi): integrità seed + idempotenza schema.
- `npm run build` verde (type-check incluso). `npx tsx scripts/migrate.ts` carica e parsa
  correttamente (fallisce solo alla connessione DB, atteso senza DATABASE_URL).
- RESTA da fare: eseguire la migration su Neon in locale (vedi "Prossima sessione").

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
