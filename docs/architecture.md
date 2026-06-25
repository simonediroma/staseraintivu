# staseraintivu — Architettura e Riferimenti Tecnici

## Progetto

**staseraintivu** — palinsesto TV italiana moderno, veloce e senza pubblicità invasiva.

**Obiettivo:** Mostrare cosa c'è stasera in TV su tutti i canali DTT principali con UI pulita, dark mode e ricerca full-text. Ottimizzato per alto traffico senza infrastruttura complessa.

---

## Stack Tecnico

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js 15 App Router + TypeScript strict |
| Styling | Tailwind CSS v4 (dark mode built-in) |
| Database | PostgreSQL — Neon (serverless, free tier 0.5GB) |
| Cache | Next.js ISR (`revalidate`) + Vercel CDN |
| Search | PostgreSQL full-text search (`tsvector GENERATED`) |
| Ingest cron | GitHub Actions (schedule 02:00 UTC) |
| Deploy | Vercel Hobby → Pro quando serve |
| Runtime | Node.js 22 + `tsx` per script TypeScript |

---

## Architettura

Monorepo Next.js. Nessun backend separato — tutto in App Router.
L'ingest gira fuori da Vercel (GitHub Actions) per evitare il timeout 60s del piano Hobby.

```
UTENTE → Vercel Edge (ISR cached) → Next.js App Router
                                        ├── Server Components (query DB dirette, ISR)
                                        ├── Route Handlers (API JSON, cache CDN)
                                        └── Client Components (search debounce, admin)
                                                     ↓
                                             PostgreSQL (Neon)
                                                     ↑
                    GitHub Actions (cron 03:00 Rome) → ingest XMLTV → upsert DB → POST /api/revalidate
```

### Struttura Repository

```
staseraintivu/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← home (stasera)
│   │   ├── [data]/page.tsx            ← palinsesto giorno
│   │   ├── canale/[slug]/page.tsx     ← timeline canale
│   │   ├── cerca/page.tsx             ← ricerca full-text
│   │   ├── admin/page.tsx             ← pannello admin
│   │   └── api/
│   │       ├── tonight/route.ts
│   │       ├── schedule/route.ts
│   │       ├── channels/route.ts
│   │       ├── search/route.ts
│   │       ├── revalidate/route.ts
│   │       └── admin/
│   │           ├── unresolved/route.ts
│   │           └── approve/route.ts
│   ├── components/
│   │   ├── ChannelGrid.tsx
│   │   ├── ChannelRow.tsx
│   │   ├── ProgrammeCard.tsx
│   │   ├── CategoryChip.tsx
│   │   ├── DayNav.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Timeline.tsx
│   │   ├── DarkModeToggle.tsx
│   │   └── AdminTable.tsx
│   └── lib/
│       ├── epg/
│       │   ├── datetime.ts            ← INVARIATO (da oraintivu_1)
│       │   ├── parse-xmltv.ts         ← INVARIATO (da oraintivu_1)
│       │   ├── channel-alias.ts       ← INVARIATO (da oraintivu)
│       │   ├── prime-time.ts          ← INVARIATO (da oraintivu_1)
│       │   ├── channel-store.ts       ← riscritto (usa lib/db.ts)
│       │   ├── epg-store.ts           ← riscritto (usa lib/db.ts)
│       │   └── ingest.ts              ← riscritto (no Redis)
│       ├── db.ts                      ← singleton pg.Pool
│       └── utils.ts
├── scripts/
│   └── ingest.ts                      ← CLI entry point
├── .github/workflows/ingest.yml
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Schema DB (PostgreSQL / Neon)

```sql
CREATE TABLE canonical_channels (
  id          TEXT PRIMARY KEY,           -- slug: "rai-1"
  lcn         INTEGER UNIQUE,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE channel_aliases (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES canonical_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (source, source_id)
);

CREATE TABLE unresolved_channels (
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  suggestions  JSONB NOT NULL DEFAULT '[]',
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);

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

CREATE INDEX idx_programmes_start   ON programmes (start_at);
CREATE INDEX idx_programmes_channel ON programmes (channel_id, start_at);
CREATE INDEX idx_programmes_search  ON programmes USING GIN (search_vec);
```

---

## Variabili d'Ambiente

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `DATABASE_URL` | Connection string Neon | `postgresql://...neon.tech/neondb?sslmode=require` |
| `XMLTV_URL` | URL feed XMLTV compresso | `https://iptv-org.github.io/epg/guides/it/epg.xml.gz` |
| `XMLTV_SOURCE` | Nome sorgente per alias resolver | `iptv-org` |
| `XMLTV_OFFSET_MINUTES` | Offset fuso fallback (Italy DST) | `120` |
| `REVALIDATE_TOKEN` | Token ISR on-demand | `openssl rand -hex 32` |
| `ADMIN_KEY` | Chiave pannello admin | stringa lunga custom |
| `NEXT_PUBLIC_SITE_URL` | URL sito (per revalidate post-ingest) | `https://staseraintivu.it` |

---

## API Endpoints

| Endpoint | Metodo | Cache | Note |
|----------|--------|-------|------|
| `/api/tonight` | GET | `s-maxage=3600, swr=86400` | Prima serata tutti i canali |
| `/api/schedule?date=&channel=` | GET | `s-maxage=3600` oggi / `86400,immutable` passato | Palinsesto giorno |
| `/api/channels` | GET | `s-maxage=86400` | Lista canali attivi |
| `/api/search?q=&limit=&offset=` | GET | no-cache | Full-text tsvector |
| `/api/revalidate` | POST | — | Protetto da `REVALIDATE_TOKEN` (header Bearer) |
| `/api/admin/unresolved` | GET | — | Protetto da `X-Admin-Key` |
| `/api/admin/approve` | POST | — | Protetto da `X-Admin-Key` |

### Shape /api/tonight (response)

```json
{
  "date": "2026-06-25",
  "window": { "from": "2026-06-25T18:30:00Z", "to": "2026-06-26T00:00:00Z" },
  "programmes": [{
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
  }]
}
```

### Shape /api/search (response)

```json
{
  "results": [{
    "channelId": "rai-1",
    "channelName": "Rai 1",
    "startAt": "...",
    "stopAt": "...",
    "title": "...",
    "description": "...",
    "categories": ["film"]
  }],
  "total": 12
}
```

---

## Caching Strategy

- **ISR**: `revalidate = 3600` su tutte le pagine. Post-ingest: on-demand via `POST /api/revalidate`.
- **Route Handlers**: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`. Giorni passati: `immutable`.
- **No Redis in v1**: ISR + Vercel CDN è sufficiente. Redis si aggiunge solo se le query DB diventano collo di bottiglia misurato.

---

## GitHub Actions — Ingest Cron

```yaml
name: EPG Ingest
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC = 03:00/04:00 Europe/Rome
  workflow_dispatch:
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

---

## Comandi

```bash
npm run dev                    # sviluppo locale
npm test                       # test (jest / vitest)
npm run build                  # build produzione
npx tsx scripts/ingest.ts      # ingest manuale (con .env.local)
```

---

## Requisiti Non Funzionali

| Requisito | Target |
|-----------|--------|
| LCP | < 1.2s su 4G |
| TTFB | < 200ms (ISR + edge cache) |
| Core Web Vitals | Tutti "Good" su PageSpeed |
| Freshness dati | Max 24h (ingest notturno) |
| SEO | schema.org/Event per ogni programma |
