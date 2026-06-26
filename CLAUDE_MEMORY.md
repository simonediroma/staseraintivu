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

Esegui `prompts/M1_schema_db_seed.md`: schema DB (4 tabelle) + seed canali canonici.
Prima serve `DATABASE_URL` (Neon) in `.env.local` — vedi sezione variabili sotto.
M2-M4 ora sbloccate: i prototipi EPG sono in `prototypes/` (vedi sotto).

## Ultima sessione

Data: 2026-06-26
Branch: claude/next-steps-foq304
PR corrente: claude/next-steps-foq304 → main (fix deploy Vercel)

Fatto: fix del deploy Vercel rotto. Il commit `a09ebcd` su main aveva aggiunto i
prototipi `oraintivu/` e `oraintivu_1/` nella root: `next build` li type-checkava e
falliva. Spostati in `prototypes/` ed esclusi dal build (`tsconfig.json` exclude).
Build verde in locale.
Da sapere: i prototipi EPG core ora ESISTONO nel repo sotto `prototypes/oraintivu*`
— sbloccano M2-M4 (porting verso `src/lib/epg/`). NON importarli in `src/`, sono
solo riferimento (vedi `prototypes/README.md`).

## Variabili d'ambiente da configurare

Prima di M1, crea `.env.local` con:
```
DATABASE_URL=postgresql://...  ← ottieni da dashboard Neon
REVALIDATE_TOKEN=              ← genera con: openssl rand -hex 32
ADMIN_KEY=                     ← scegli una stringa lunga
NEXT_PUBLIC_SITE_URL=http://localhost:3000
XMLTV_URL=https://iptv-org.github.io/epg/guides/it/epg.xml.gz
XMLTV_SOURCE=iptv-org
XMLTV_OFFSET_MINUTES=120
```

## Note sessioni precedenti

—
