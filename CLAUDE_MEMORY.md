# CLAUDE_MEMORY — staseraintivu

> File aggiornato a fine di ogni sessione. Gitignored.

## Stato Progetto

**Avanzamento macros:**
- [ ] M0 — Scaffold Next.js 15
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

Esegui `prompts/M0_scaffold.md`. Repo vuoto, parti da `npx create-next-app@latest`.

## Ultima sessione

Data: —
Branch: —
PR corrente: —

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
