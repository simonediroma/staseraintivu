# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Versionato (serve a persistere tra sessioni Claude Code web, dove il container è effimero).

## Stato Progetto

**Avanzamento macros:**
- [x] M0 — Scaffold Next.js 15
- [ ] M1 — Schema DB + Seed Canali
- [ ] M2 — EPG Core Lib (porta da oraintivu)
- [ ] M3 — EPG Store + Channel Store
- [ ] M4 — Ingest Worker + GitHub Actions
- [ ] M5 — API Route Handlers (palinsesto)
- [ ] M6 — API Search + Admin
- [ ] UI-1 — Layout + Home
- [ ] UI-2 — Pagine Giorno + Canale
- [ ] UI-3 — Ricerca + Admin Panel

## Prossima sessione — inizia da qui

Esegui `prompts/M1_schema_db_seed.md`: schema DB (4 tabelle) + seed ~25 canali canonici.
Infra PRONTA: Neon creato, env vars configurate su Vercel, deploy verde.
Unico prerequisito per eseguire M1 in locale: crea `.env.local` con il `DATABASE_URL`
(connection string **pooled** di Neon) — vedi sezione variabili sotto. Lo script
`scripts/migrate.ts` gira in locale, quindi gli serve il DATABASE_URL nel `.env.local`
(la copia su Vercel non è accessibile dall'esecuzione locale).
M2-M4 sbloccate: i prototipi EPG sono in `prototypes/` (vedi sotto).

## Ultima sessione

Data: 2026-06-26
Branch: claude/next-steps-foq304
PR corrente: PR #2 (fix deploy Vercel) → **MERGIATA** su main (`c73f7a1`).

Fatto:
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
