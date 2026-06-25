# M4 — Ingest Worker + GitHub Actions

## Contesto

Dipende da: M3 completato (ChannelStore e EpgStore funzionanti).

## Obiettivo

Implementare lo script CLI `scripts/ingest.ts` e il workflow GitHub Actions `.github/workflows/ingest.yml`. Lo script scarica il feed XMLTV compresso da iptv-org, lo decomprime in streaming, risolve i canali, salva i programmi nel DB, e invoca `POST /api/revalidate` per invalidare l'ISR di Vercel.

## Acceptance criteria

- [ ] `npx tsx scripts/ingest.ts` completa senza errori contro il DB Neon (con `.env.local` configurato)
- [ ] Test: eseguire con `guide.xml` locale (fixture in `../oraintivu_1/guide.xml`) produce upsert nel DB
- [ ] Canali risolti → entry in `programmes` + `channel_aliases`
- [ ] Canali non risolti → entry in `unresolved_channels` con `suggestions` JSONB
- [ ] Secondo run con stessi dati: nessun duplicato (idempotenza)
- [ ] Log finale: `X canali risolti, Y programmi salvati, Z irrisolti`
- [ ] `.github/workflows/ingest.yml` presente con cron `0 2 * * *` e `workflow_dispatch`
- [ ] Build: `npm run build` passa

## Files che verranno creati

- `scripts/ingest.ts` — CLI entry point
- `src/lib/epg/ingest.ts` — logica ingest (usa ChannelStore + EpgStore)
- `.github/workflows/ingest.yml` — workflow GitHub Actions

## Implementazione — TDD

Scrivi il test che fallisce → implementa → refactora.
Test da scrivere prima:
1. `ingest(xmltvStream)` con `guide.xml` locale → almeno 1 programma upsertato
2. Doppio run con stesso `guide.xml` → row count identico (idempotenza)
3. Canale inesistente nel feed → appare in `unresolved_channels`

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

## Gate pre-PR

**Security checklist:**
- [ ] `DATABASE_URL` e `REVALIDATE_TOKEN` da env, mai hardcoded
- [ ] Il fetch del feed XMLTV ha un timeout ragionevole (es. 60s) — no hang indefinito
- [ ] Il `POST /api/revalidate` fallisce gracefully (log warning, non crash) se il sito non è ancora deployato

**Code review a 5 assi:**
- [ ] Correttezza: lo stream gunzip → SAX parser non carica tutto in memoria (streaming)?
- [ ] Sicurezza: nessun secret nei log?
- [ ] Leggibilità: `scripts/ingest.ts` è < 50 righe — solo orchestrazione, logica in `src/lib/epg/ingest.ts`?
- [ ] Performance: batch upsert, non INSERT per ogni programma in loop?
- [ ] Chirurgico: nessuna logica UI o API nel worker?

## Note per Claude Code

- `src/lib/epg/ingest.ts` corrisponde a `oraintivu_1/ingest.ts` — stessa logica, no Redis, no invalidazione ISR (quella è in `scripts/ingest.ts` dopo il completamento).
- Il feed XMLTV è gzippato: `fetch(url)` → `response.body.pipe(zlib.createGunzip())` → SAX parser.
- `parseXmltvDate()` da `datetime.ts` per tutti i timestamp — non usare `new Date()` direttamente.
- Workflow GitHub Actions: i secret (`DATABASE_URL`, `REVALIDATE_TOKEN`, `NEXT_PUBLIC_SITE_URL`) vanno su GitHub → Settings → Secrets → Actions. Il template è in `docs/architecture.md`.
