# HANDOFF — staseraintivu

Documento di consegna per Claude Code. Tutto ciò che serve per iniziare.

---

## Cosa stiamo costruendo

Palinsesto TV italiana moderno. L'utente apre il sito e vede cosa c'è stasera in TV su tutti i canali DTT principali, con UI pulita, dark mode e ricerca full-text. Nessuna pubblicità invasiva.

## Codice esistente da riutilizzare

Il repo contiene già due cartelle con codice prototipale funzionante:

| Cartella | Cosa contiene |
|---|---|
| `../oraintivu/` (parent dir) | `channel-alias.ts`, `channel-store.ts`, `db.ts` (singleton Pool) |
| `../oraintivu_1/` (parent dir) | `datetime.ts`, `parse-xmltv.ts`, `prime-time.ts`, `ingest.ts`, `guide.xml` (fixture EPG) |

Le macro M2–M4 ti dicono esattamente cosa portare as-is e cosa riscrivere.

## Ordine di esecuzione

```
M0 → M1 → M2 → M3 → M4 → M5 → M6 → UI-1 → UI-2 → UI-3
```

Non saltare macros. Ogni macro ha `Acceptance criteria` binari — verificali tutti prima di passare alla successiva.

## Setup iniziale (prima di M0)

1. Crea un account **Neon** su neon.tech — piano gratuito. Ottieni `DATABASE_URL`.
2. Crea un repo GitHub (pubblico o privato).
3. Genera i token: `openssl rand -hex 32` per `REVALIDATE_TOKEN`.
4. Scegli `ADMIN_KEY` (stringa lunga custom).
5. Crea `.env.local` con le variabili (template in `CLAUDE_MEMORY.md`).

## Deploy (dopo UI-1)

1. Connetti il repo a **Vercel** (vercel.com → Import Project).
2. Aggiungi le env vars nel pannello Vercel (stesse di `.env.local`).
3. Il primo deploy mostrerà la home con dati vuoti — normale, l'ingest non è ancora girato.
4. Esegui l'ingest manuale una volta: `npx tsx scripts/ingest.ts` (con `.env.local` configurato).
5. Aggiungi i secret GitHub (Settings → Secrets → Actions) per il cron notturno.

## Assunzioni fatte nel PRD

- **Neon** come DB Postgres (non Supabase, non Railway). Se cambi provider, verifica il connection string format.
- **No Redis in v1.** ISR + Vercel CDN è sufficiente. Redis si aggiunge solo se le query DB diventano collo di bottiglia misurato.
- **GitHub Actions** per l'ingest, non Vercel Cron. Motivo: piano Hobby Vercel ha timeout 60s — troppo corto per file XMLTV grandi.
- **`tsx`** per eseguire lo script ingest TypeScript direttamente, senza compilazione.
- **Feed iptv-org** come sorgente XMLTV. Se il feed cambia URL o formato, aggiorna `XMLTV_URL` in env e `XMLTV_SOURCE` negli alias.
- **Autenticazione admin via header `X-Admin-Key`**, non OAuth. Adeguato per progetto personale/esperimento.

## Nessun plugin richiesto

I comportamenti Osmani (Doubt-Driven, TDD, incremental implementation, security checklist, code review 5 assi, Chesterton's Fence, Prove-It Pattern, API Contract, Hyrum's Law) sono embedded direttamente in `CLAUDE.md` e nei file `prompts/`. Claude Code non necessita di plugin aggiuntivi.

## File di riferimento rapido

| Cosa cerchi | Dove guardare |
|---|---|
| Stack e schema DB | `docs/architecture.md` |
| Pattern e errori da evitare | `docs/lessons.md` |
| Stato avanzamento | `CLAUDE_MEMORY.md` |
| Prompt della prossima macro | `prompts/M<N>_*.md` |
| PRD completo | `PRD.md` |
