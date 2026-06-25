# PRD — staseraintivu.it
**Versione:** 1.0  
**Data:** 2026-06-25  
**Autore:** Simone Razzano

---

## 1. Obiettivo

Costruire una versione migliorata di "stasera in tv": un sito web che mostra il palinsesto della TV italiana, veloce, pulito e senza pubblicità invasiva. Il progetto parte da un pipeline EPG già parzialmente scritto (cartelle `oraintivu` e `oraintivu_1`) che va estratto, adattato e integrato in un'applicazione web completa pensata per alto traffico.

**Non è** un clone di programmitv.net. L'obiettivo è UI/UX molto superiore, performance eccellenti e architettura che regge carichi elevati senza infrastruttura complessa.

---

## 2. Stack tecnologico

| Layer | Tecnologia | Motivazione |
|---|---|---|
| Framework web | **Next.js 15** (App Router) | ISR nativo, RSC, API Route Handlers, deploy Vercel |
| Linguaggio | **TypeScript** (strict) | Type safety end-to-end |
| Database | **PostgreSQL — Neon** (free tier) | Serverless-friendly, connection pooling built-in, 0.5GB gratis |
| Cache | **Next.js ISR** (`revalidate`) | Sufficiente per v1 — il palinsesto cambia 1x/giorno. Redis è fuori scope v1. |
| Styling | **Tailwind CSS v4** | Utility-first, dark mode built-in |
| Ingest cron | **GitHub Actions** (schedule) | Gratis (2000 min/mese), zero infra da gestire |
| Search | **PostgreSQL full-text search** (tsvector) | Zero infra aggiuntiva per ricerca titoli |
| Hosting | **Vercel Hobby** → Pro quando serve | Edge CDN, ISR, deploy automatico da GitHub |

### Costi stimati

| Scenario | Costo/mese |
|---|---|
| Sviluppo + traffico basso | **$0** (Vercel Hobby + Neon free + GitHub Actions free) |
| Traffico medio (>100k visite/mese) | **~$20** (Vercel Pro) |
| Traffico alto (>1M visite/mese) | **~$40** (Vercel Pro + Neon Launch $19) |

---

## 3. Architettura

```
┌─────────────────────────────────────────────────────┐
│                  UTENTE FINALE                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│     Next.js 15 App (Vercel Edge — ISR cached)        │
│                                                      │
│  /                   → griglia "stasera" (ISR 1h)   │
│  /[data]             → palinsesto giorno specifico   │
│  /canale/[slug]      → programmi di un canale        │
│  /cerca              → ricerca full-text             │
│  /admin              → gestione canali irrisolti     │
│                                                      │
│  Route Handlers (API):                               │
│  GET /api/tonight                                    │
│  GET /api/schedule?date=&channel=                    │
│  GET /api/search?q=                                  │
│  GET /api/channels                                   │
│  GET /api/admin/unresolved                           │
│  POST /api/admin/approve                             │
└──────────────────────┬──────────────────────────────┘
                       │ query dirette (ISR = già cachate a livello pagina)
          ┌────────────▼────────────┐
          │   PostgreSQL — Neon      │
          │   canonical_channels     │
          │   channel_aliases        │
          │   unresolved_channels    │
          │   programmes             │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────────────────┐
          │   GitHub Actions (cron 03:00 Rome)   │
          │   - scarica feed XMLTV da iptv-org   │
          │   - gunzip in streaming              │
          │   - risolve canali                   │
          │   - upsert programmi nel DB          │
          │   - POST /api/revalidate (ISR)       │
          └──────────────────────────────────────┘
```

### 3.1 Caching strategy

Il palinsesto cambia una volta al giorno (l'ingest gira di notte). Redis è fuori scope v1.

- **ISR (Next.js)**: `revalidate = 3600` sulle pagine. Dopo l'ingest, on-demand revalidation via endpoint `POST /api/revalidate` (protetto da token segreto) chiamato dalla GitHub Action.
- **API Route Handlers**: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` — Vercel CDN fa da cache anche per le API.
- **Pagine statiche**: giorni passati hanno `revalidate = false` (mai cambiano).

---

## 4. Modello dati (PostgreSQL)

Riuso ed estensione dello schema già scritto in `oraintivu`.

```sql
-- Canali canonici (seed: 25 canali DTT principali)
CREATE TABLE canonical_channels (
  id          TEXT PRIMARY KEY,           -- slug stabile es. "rai-1"
  lcn         INTEGER UNIQUE,             -- numero LCN DTT
  name        TEXT NOT NULL,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0  -- ordine griglia UI
);

-- Alias per la risoluzione multi-sorgente
CREATE TABLE channel_aliases (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (source, source_id)
);

-- Coda canali irrisolti per approvazione manuale
CREATE TABLE unresolved_channels (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  suggestions  JSONB NOT NULL DEFAULT '[]',
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);

-- Programmi EPG
CREATE TABLE programmes (
  channel_id   TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  start_at     TIMESTAMPTZ NOT NULL,
  stop_at      TIMESTAMPTZ,
  title        TEXT NOT NULL,
  sub_title    TEXT,
  descr        TEXT,
  categories   TEXT[] NOT NULL DEFAULT '{}',
  icon_url     TEXT,
  episode_num  TEXT,
  search_vec   TSVECTOR GENERATED ALWAYS AS (
                 to_tsvector('italian', coalesce(title,'') || ' ' || coalesce(descr,''))
               ) STORED,
  PRIMARY KEY (channel_id, start_at)
);

-- Indici
CREATE INDEX idx_programmes_start   ON programmes (start_at);
CREATE INDEX idx_programmes_channel ON programmes (channel_id, start_at);
CREATE INDEX idx_programmes_search  ON programmes USING GIN (search_vec);
```

---

## 5. Package EPG core (`src/lib/epg/`)

Estrai e adatta il codice esistente. Non toccare la logica — è già testata e corretta.

### 5.1 Moduli da estrarre (verbatim o con minimi adattamenti)

| File originale | Destinazione | Note |
|---|---|---|
| `oraintivu_1/datetime.ts` | `src/lib/epg/datetime.ts` | Porta as-is |
| `oraintivu_1/parse-xmltv.ts` | `src/lib/epg/parse-xmltv.ts` | Porta as-is |
| `oraintivu/channel-alias.ts` | `src/lib/epg/channel-alias.ts` | Porta as-is |
| `oraintivu_1/prime-time.ts` | `src/lib/epg/prime-time.ts` | Porta as-is |

### 5.2 Moduli da riscrivere

**`src/lib/epg/channel-store.ts`** — stessa logica di `oraintivu/channel-store.ts` ma usa il client DB del progetto (no `new Pool()` diretta, usa `src/lib/db.ts`).

**`src/lib/epg/epg-store.ts`** — stessa logica di `oraintivu/db.ts` ma con il client DB condiviso.

**`src/lib/epg/ingest.ts`** — stessa logica di `oraintivu_1/ingest.ts`. Nessuna dipendenza Redis — l'invalidazione ISR avviene a livello di script (`scripts/ingest.ts`) via HTTP dopo il completamento.

### 5.3 Feed XMLTV

Usare il feed pubblico di **iptv-org**:
```
https://epg.github.io/epg.xml.gz   ← feed aggregato (compresso)
```
Oppure i feed per paese:
```
https://iptv-org.github.io/epg/guides/it/epg.xml.gz
```

L'ingest worker scarica, decomprime (gunzip) e processa il file XMLTV in streaming. Il source name da usare per la risoluzione alias è `"iptv-org"`.

---

## 6. API Endpoints (`src/app/api/`)

### `GET /api/tonight`
Restituisce il programma di prima serata per tutti i canali attivi, ordinati per `sort_order`.

**Response:**
```json
{
  "date": "2026-06-25",
  "window": { "from": "2026-06-25T18:30:00Z", "to": "2026-06-26T00:00:00Z" },
  "programmes": [
    {
      "channelId": "rai-1",
      "channelName": "Rai 1",
      "channelLogo": "https://...",
      "lcn": 1,
      "startAt": "2026-06-25T19:30:00Z",
      "stopAt": "2026-06-25T21:15:00Z",
      "title": "TG1",
      "subTitle": null,
      "description": "...",
      "categories": ["news"]
    }
  ]
}
```
Cache: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.

---

### `GET /api/schedule?date=YYYY-MM-DD&channel=slug`
Restituisce tutti i programmi di un giorno per uno o tutti i canali.  
Parametri: `date` (default oggi), `channel` (opzionale, filtra su un canale).

Cache: `s-maxage=3600` per il giorno corrente; `s-maxage=86400, immutable` per giorni passati.

---

### `GET /api/channels`
Lista canali attivi con logo e LCN. Cache `s-maxage=86400`.

---

### `GET /api/search?q=testo&limit=20&offset=0`
Ricerca full-text via `tsvector`. Restituisce programmi corrispondenti con canale e orario.  
No cache (query arbitraria).

---

### `POST /api/revalidate`
Endpoint chiamato dalla GitHub Action dopo l'ingest. Esegue `revalidatePath('/')` e `revalidatePath('/[data]', 'layout')`.  
**Protetto da `REVALIDATE_TOKEN`** (header `Authorization: Bearer <token>`).

---

### `GET /api/admin/unresolved`
Lista canali in `unresolved_channels` con suggerimenti Levenshtein.  
**Protetto da autenticazione** (header `X-Admin-Key` oppure sessione admin).

---

### `POST /api/admin/approve`
```json
{ "source": "iptv-org", "sourceId": "Rai1.it", "canonicalId": "rai-1" }
```
Approva un canale irrisolto: crea l'alias e lo rimuove dalla coda.  
**Protetto da autenticazione.**

---

## 7. Pagine UI (`src/app/`)

### 7.1 `/` — Home (Stasera in TV)

Griglia principale. Mostra per ogni canale il programma di prima serata (20:30).

**Layout:**
- Header con logo, navigazione (Stasera / Guida TV / Cerca), toggle dark mode
- Griglia canali: righe ordinate per LCN. Ogni riga ha:
  - Logo canale + numero LCN
  - Orario inizio/fine
  - Titolo (bold)
  - Categoria (chip colorata per genere: film, serie, news, sport, intrattenimento)
  - Descrizione troncata a 2 righe
- Footer minimale

**Comportamento:**
- ISR con revalidate 1 ora
- Skeleton loading per idratazione client

---

### 7.2 `/[data]` — Palinsesto giorno (es. `/2026-06-25`)

Stessa griglia ma per la data selezionata. Navigazione avanti/indietro per giorno.  
Range disponibile: 7 giorni (ieri + oggi + 5 avanti, dipende dal feed).

---

### 7.3 `/canale/[slug]` — Timeline canale

Per un canale specifico, mostra tutti i programmi del giorno come timeline verticale.  
Highlight visivo del programma in corso in questo momento.

---

### 7.4 `/cerca` — Ricerca

Barra di ricerca fullscreen con risultati in tempo reale (debounce 300ms).  
Ogni risultato mostra: canale, data/ora, titolo, descrizione breve.

---

### 7.5 `/admin` — Pannello admin

Pagina protetta (basic auth o chiave). Lista dei canali in coda `unresolved_channels`:

| Source | Source ID | Display name | Suggerimenti |
|---|---|---|---|
| iptv-org | Rai1.it | Rai 1 HD | rai-1 (0.95), rai-2 (0.60) |

Per ogni riga: bottone "Approva" (pre-seleziona il suggerimento migliore), dropdown per scegliere il canonical, bottone "Ignora".

---

## 8. Ingest worker (`scripts/ingest.ts` + GitHub Actions)

### Script CLI (`scripts/ingest.ts`)

**Flusso:**
1. Scarica il feed XMLTV `.gz` da iptv-org
2. Decomprime in streaming (gunzip pipe → SAX parser)
3. Chiama `ingest()` da `src/lib/epg/ingest.ts`
4. Logga stats (canali risolti, programmi salvati, irrisolti)
5. `POST /api/revalidate` con `REVALIDATE_TOKEN` → invalida ISR su Vercel

**Configurazione (env var):**
- `DATABASE_URL` — connessione Neon
- `XMLTV_URL` — URL del feed
- `XMLTV_SOURCE` — nome sorgente alias (es. `"iptv-org"`)
- `XMLTV_OFFSET_MINUTES` — offset fuso di fallback (120 per Italy DST)
- `REVALIDATE_TOKEN` — token segreto per l'endpoint ISR
- `NEXT_PUBLIC_SITE_URL` — URL del sito (per chiamare `/api/revalidate`)

### GitHub Actions (`.github/workflows/ingest.yml`)

```yaml
name: EPG Ingest
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC = 03:00/04:00 Europe/Rome
  workflow_dispatch:        # esecuzione manuale

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npx tsx scripts/ingest.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          XMLTV_URL: ${{ secrets.XMLTV_URL }}
          XMLTV_SOURCE: iptv-org
          XMLTV_OFFSET_MINUTES: 120
          REVALIDATE_TOKEN: ${{ secrets.REVALIDATE_TOKEN }}
          NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}
```

Tutti i secret (`DATABASE_URL`, `REVALIDATE_TOKEN`, `NEXT_PUBLIC_SITE_URL`) vanno aggiunti in **GitHub → Settings → Secrets → Actions**.

---

## 9. Configurazione ambiente (`.env`)

```env
# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Ingest
XMLTV_URL=https://iptv-org.github.io/epg/guides/it/epg.xml.gz
XMLTV_SOURCE=iptv-org
XMLTV_OFFSET_MINUTES=120

# ISR on-demand revalidation
REVALIDATE_TOKEN=genera-con-openssl-rand-hex-32

# Admin panel
ADMIN_KEY=secret-da-cambiare

# Sito
NEXT_PUBLIC_SITE_URL=https://staseraintivu.it
```

> **Redis non richiesto in v1.** Se in futuro le query DB diventano un collo di bottiglia, aggiungere Upstash Redis (free tier: 10k cmd/giorno) e un wrapper `src/lib/cache.ts`.

---

## 10. Struttura del progetto

```
staseraintivu/
├── src/
│   ├── app/
│   │   ├── layout.tsx               ← root layout con dark mode provider
│   │   ├── page.tsx                 ← home (stasera)
│   │   ├── [data]/
│   │   │   └── page.tsx             ← palinsesto giorno
│   │   ├── canale/
│   │   │   └── [slug]/
│   │   │       └── page.tsx         ← timeline canale
│   │   ├── cerca/
│   │   │   └── page.tsx             ← ricerca
│   │   ├── admin/
│   │   │   └── page.tsx             ← admin canali irrisolti
│   │   └── api/
│   │       ├── tonight/route.ts
│   │       ├── schedule/route.ts
│   │       ├── channels/route.ts
│   │       ├── search/route.ts
│   │       └── admin/
│   │           ├── unresolved/route.ts
│   │           └── approve/route.ts
│   ├── components/
│   │   ├── ChannelGrid.tsx          ← griglia canali
│   │   ├── ChannelRow.tsx           ← riga singola canale
│   │   ├── ProgrammeCard.tsx        ← card programma
│   │   ├── CategoryChip.tsx         ← chip genere colorata
│   │   ├── DayNav.tsx               ← navigazione avanti/indietro giorno
│   │   ├── SearchBar.tsx            ← barra ricerca con debounce
│   │   ├── Timeline.tsx             ← timeline programmi canale
│   │   ├── DarkModeToggle.tsx       ← toggle tema
│   │   └── AdminTable.tsx           ← tabella canali irrisolti
│   └── lib/
│       ├── epg/
│       │   ├── datetime.ts          ← da oraintivu_1/datetime.ts
│       │   ├── parse-xmltv.ts       ← da oraintivu_1/parse-xmltv.ts
│       │   ├── channel-alias.ts     ← da oraintivu/channel-alias.ts
│       │   ├── prime-time.ts        ← da oraintivu_1/prime-time.ts
│       │   ├── channel-store.ts     ← riscritto (usa lib/db.ts)
│       │   ├── epg-store.ts         ← riscritto (usa lib/db.ts)
│       │   └── ingest.ts            ← riscritto (+ invalidazione cache)
│       ├── db.ts                    ← singleton pool Postgres (Neon)
│       └── utils.ts                 ← helpers condivisi (date, format)
├── scripts/
│   └── ingest.ts                    ← CLI entry point cron job
├── public/
│   └── logos/                       ← logo canali (fallback locale)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 11. Requisiti non funzionali

| Requisito | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 1.2s su connessione 4G |
| TTFB (Time to First Byte) | < 200ms (ISR + edge cache) |
| Core Web Vitals | Tutti "Good" su PageSpeed |
| Availability | 99.9% (gestita da Vercel) |
| Dati freschi | Max 24h di ritardo (ingest notturno) |
| SEO | Structured data (schema.org/Event) per ogni programma |

---

## 12. Fuori scope (v1)

- Autenticazione utenti / canali preferiti persistenti (salvati server-side)
- Streaming o link a piattaforme
- Notifiche push
- Feed RSS
- App mobile nativa

---

## 13. Note implementative per Claude Code

### Priorità di implementazione (ordine consigliato)

1. **Setup progetto** — `npx create-next-app@latest` con TypeScript, Tailwind, App Router
2. **`src/lib/db.ts`** — singleton Pool Postgres con connection pooling
3. **`src/lib/epg/`** — porta i moduli core (datetime, parse-xmltv, channel-alias, prime-time) e riscrivi channel-store, epg-store, ingest
4. **`scripts/ingest.ts`** — CLI, testa con `guide.xml` locale (già in `oraintivu_1/guide.xml`)
5. **Schema DB** — esegui le migration, seed dei canali canonici
6. **API routes** — `/api/tonight`, `/api/schedule`, `/api/channels`, `/api/search`, `/api/revalidate`
7. **Pagine UI** — home, [data], canale/[slug], cerca
8. **Admin** — API routes + pagina admin
9. **Dark mode** — integra con Tailwind `dark:` classes
10. **GitHub Actions** — `.github/workflows/ingest.yml` con cron + workflow_dispatch

### Nota sul codice esistente

I file in `oraintivu/` e `oraintivu_1/` sono prototipali. La logica è corretta, ma ogni modulo crea il proprio `pg.Pool`. In produzione usa **un singleton** in `src/lib/db.ts` e passa il client ai moduli EPG. Non duplicare le connessioni.

### Nota sulla risoluzione canali

Il `ChannelResolver` usa fuzzy matching Levenshtein. **Non applicare mai il fuzzy automaticamente** — lo fa già il codice (status `'unresolved'` vs `'resolved'`). Gli irrisolti finiscono in `unresolved_channels` e vengono approvati dall'admin.

### Feed XMLTV di test

Il file `oraintivu_1/guide.xml` può essere usato come fixture locale per lo sviluppo. Contiene dati EPG reali e può essere passato direttamente a `ingest()`.
