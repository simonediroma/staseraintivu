# Guida alla Gestione di staseraintivu

Questa guida copre tutto il ciclo operativo: setup iniziale, import dati EPG nel database, gestione dei canali non riconosciuti dal pannello admin, e manutenzione ordinaria.

---

## Indice

1. [Architettura operativa — il quadro generale](#1-architettura-operativa)
2. [Setup iniziale — secret GitHub e Vercel](#2-setup-iniziale)
3. [Schema DB e seed canali](#3-schema-db-e-seed-canali)
4. [Ingest EPG — come funziona lo scraper](#4-ingest-epg)
5. [Canali irrisolti — il pannello Admin](#5-pannello-admin)
6. [API — riferimento rapido](#6-api)
7. [Operazioni di manutenzione](#7-manutenzione)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Architettura operativa

```
Feed XMLTV (iptv-org, gzip)
        │
        ▼ ogni notte 03:00 ora di Roma
GitHub Actions (EPG Ingest)
        │
        ▼ upsert idempotente
PostgreSQL Neon
        │
        ▼ POST /api/revalidate (Bearer token)
Vercel ISR — cache invalidata
        │
        ▼
Utente → staseraintivu.it (pagine fresche)
```

**Punti chiave:**
- L'ingest gira su GitHub Actions (non su Vercel) per evitare il limite di 60s del piano Hobby.
- Ogni run è **idempotente**: rilanciarlo non crea duplicati (`ON CONFLICT DO UPDATE` su `(channel_id, start_at)`).
- La cache Vercel (ISR) viene invalidata automaticamente a fine ingest tramite `/api/revalidate`.

---

## 2. Setup iniziale

### Secret GitHub (necessari per i workflow)

Vai su **GitHub → repository → Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Descrizione | Come ottenerlo |
|--------|-------------|----------------|
| `DATABASE_URL` | Connection string Neon | Dashboard Neon → Connect → pooled connection string |
| `XMLTV_URL` | URL feed EPG compresso | `https://iptv-org.github.io/epg/guides/it/epg.xml.gz` |
| `REVALIDATE_TOKEN` | Token ISR on-demand | `openssl rand -hex 32` (stesso valore su Vercel) |
| `NEXT_PUBLIC_SITE_URL` | URL produzione | `https://staseraintivu.it` (o il tuo dominio Vercel) |

`XMLTV_SOURCE` e `XMLTV_OFFSET_MINUTES` sono hardcoded nel workflow (`iptv-org` e `120`) — non servono come secret.

### Variabili d'ambiente Vercel

Vai su **Vercel → Project → Settings → Environment Variables**.

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Stesso valore di Neon |
| `REVALIDATE_TOKEN` | Stesso token del secret GitHub |
| `ADMIN_KEY` | Chiave per il pannello admin (genera con `openssl rand -hex 32`) |
| `NEXT_PUBLIC_SITE_URL` | URL del sito |
| `XMLTV_URL` | Solo se usi route handler che la leggono (non usato in v1) |

**Nota:** `ADMIN_KEY` serve solo a Vercel (usato a runtime dal Next.js server). Non serve su GitHub Actions.

---

## 3. Schema DB e seed canali

### Prima installazione

Esegui il workflow **DB Migrate** una sola volta:

1. Vai su **GitHub → Actions → DB Migrate**
2. Clicca **Run workflow → Run workflow**
3. Aspetta il verde (< 30 secondi)

Questo crea le 4 tabelle (`canonical_channels`, `channel_aliases`, `unresolved_channels`, `programmes`) e inserisce i **25 canali DTT** principali (Rai 1–3, Mediaset, La7, ecc.).

### Canali inclusi nel seed

I canali canonical hanno uno slug stabile (es. `rai-1`, `canale-5`, `la7`) che è anche la chiave primaria in tutto il sistema. Il loro ordine in UI è determinato dall'LCN (Logical Channel Number, il numero sul telecomando).

### Aggiungere un canale canonical

Non c'è ancora una UI per questo. Via SQL diretto su Neon:

```sql
-- Aggiungi il canale (scegli un slug stabile in kebab-case)
INSERT INTO canonical_channels (id, lcn, name, sort_order, is_active)
VALUES ('real-time', 31, 'Real Time', 31, true);

-- (Opzionale) Aggiungi subito un alias se conosci il source_id del feed
INSERT INTO channel_aliases (source, source_id, canonical_id)
VALUES ('iptv-org', 'RealTime.it', 'real-time');
```

Dopo l'aggiunta, rilancia l'ingest (workflow manuale) per popolare i programmi del nuovo canale.

---

## 4. Ingest EPG

### Come funziona

Il workflow `EPG Ingest` esegue `scripts/ingest.ts`, che a sua volta chiama `src/lib/epg/ingest.ts`.

**Pipeline:**

```
1. Download feed XMLTV gzip (timeout 60s)
        │
        ▼ streaming gunzip → SAX parser (no DOM in memoria)
2. Parsing canali (<channel>) → pre-risoluzione e memoizzazione
        │
        ▼ per ogni <programme>
3. Risoluzione canale: alias → nome normalizzato → fuzzy
   ├── RISOLTO → buffer
   └── IRRISOLTO → coda unresolved_channels (con suggerimenti fuzzy)
        │
        ▼ ogni 500 programmi
4. Batch upsert su PostgreSQL (UNNEST, ON CONFLICT DO UPDATE)
        │
        ▼ a fine run
5. POST /api/revalidate → Vercel invalida la cache ISR
```

### Avvio manuale

1. **GitHub → Actions → EPG Ingest → Run workflow → Run workflow**
2. Il job impiega tipicamente 1–3 minuti.
3. Controlla i log: cerca `Ingest completato` con le statistiche (canali visti, programmi salvati, canali irrisolti).

### Output dei log

```
Ingest completato {
  channels: 180,      ← <channel> nel feed
  programmes: 4200,   ← <programme> nel feed
  resolved: 3800,     ← programmi salvati (canale risolto)
  skipped: 400,       ← programmi scartati (canale non riconosciuto)
  unresolved: ['UnknownChannel.it', ...]  ← da gestire in admin
}
```

### Frequenza

Il cron è impostato alle **02:00 UTC** (03:00/04:00 ora di Roma). Il feed EPG copre tipicamente 7 giorni in avanti — l'ingest notturno è sufficiente per mantenere i dati aggiornati.

### Idempotenza

Rieseguire l'ingest sullo stesso feed è sempre sicuro:
- I programmi già presenti vengono aggiornati (`DO UPDATE`) — non duplicati.
- I canali irrisolti già in coda aggiornano solo `last_seen`.

---

## 5. Pannello Admin

### Accesso

Vai su `https://staseraintivu.it/admin` (o il tuo URL). Inserisci l'`ADMIN_KEY` configurata su Vercel.

La chiave viene salvata in `sessionStorage` per la durata della sessione browser — non devi reinserirla ogni volta che ricarichi la pagina.

### Cosa mostra

Il pannello lista i **canali irrisolti**: canali presenti nel feed XMLTV che il sistema non ha saputo associare automaticamente a un canale canonical.

Per ogni canale irrisolto vedi:
- **Source / Source ID** — come il feed identifica il canale (es. `iptv-org` / `Rai1.it`)
- **Nome visualizzato** — il nome che il feed usa
- **Suggerimenti fuzzy** — i canali canonical più simili, con score di similarità
- **Prima / Ultima volta visto** — quando è comparso per la prima volta e quanto è recente

### Come approvare un canale

1. Il pannello mostra i suggerimenti fuzzy ordinati per score.
2. Clicca sul suggerimento corretto (es. `rai-1 — Rai 1`) per approvarlo.
3. Il sistema crea un alias `(source, source_id) → canonical_id` nel DB.
4. Il canale sparisce dalla coda.

**Cosa succede dopo l'approvazione:**
- Al prossimo ingest, il canale verrà risolto tramite il nuovo alias.
- I programmi del canale verranno salvati nel DB.
- Se vuoi i programmi subito (senza aspettare la notte), rilancia l'ingest manualmente.

### Approvazione via API (alternativa curl)

Se preferisci lavorare dalla riga di comando:

```bash
# Vedi i canali irrisolti
curl https://staseraintivu.it/api/admin/unresolved \
  -H "X-Admin-Key: TUA_ADMIN_KEY"

# Approva un canale
curl -X POST https://staseraintivu.it/api/admin/approve \
  -H "X-Admin-Key: TUA_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"iptv-org","sourceId":"Rai1.it","canonicalId":"rai-1"}'
```

Risposta attesa: `{"approved": true}`

### Errori comuni in admin

| Errore | Causa | Soluzione |
|--------|-------|-----------|
| `401 unauthorized` | ADMIN_KEY sbagliata o assente | Verifica la chiave inserita e quella su Vercel |
| `canonicalId 'xxx' inesistente` | Lo slug scelto non esiste in `canonical_channels` | Prima aggiungi il canale canonical via SQL, poi approva |
| `source, sourceId e canonicalId sono obbligatori` | Body malformato | Controlla che tutti e 3 i campi siano presenti e non vuoti |

---

## 6. API — riferimento rapido

Tutte le API pubbliche sono cachate su Vercel CDN. Quelle admin richiedono `X-Admin-Key`.

| Endpoint | Auth | Cache | Descrizione |
|----------|------|-------|-------------|
| `GET /api/tonight` | — | 1h + swr 24h | Prima serata tutti i canali |
| `GET /api/schedule?date=YYYY-MM-DD&channel=slug` | — | 1h (oggi) / immutable (passato) | Palinsesto giornaliero |
| `GET /api/channels` | — | 24h | Lista canali attivi |
| `GET /api/search?q=termine&limit=20&offset=0` | — | no-cache | Ricerca full-text |
| `POST /api/revalidate` | Bearer token | — | Invalida cache ISR |
| `GET /api/admin/unresolved` | X-Admin-Key | — | Coda canali irrisolti |
| `POST /api/admin/approve` | X-Admin-Key | — | Approva alias canale |

### Ricerca — limiti

- Query max 100 caratteri.
- `limit` default 20, max 50.
- `offset` default 0 (paginazione manuale).
- Header `X-RateLimit-Limit: 30` esposto (nessun enforcement in v1 — solo indicativo).

---

## 7. Manutenzione

### Forzare il refresh della cache

Dopo un intervento manuale sul DB (es. aggiunta canale, correzione dati):

```bash
curl -X POST https://staseraintivu.it/api/revalidate \
  -H "Authorization: Bearer TUO_REVALIDATE_TOKEN"
```

Risposta: `{"revalidated": true}`

### Controllare lo stato del DB (Neon)

Accedi alla dashboard Neon → SQL Editor:

```sql
-- Quanti programmi per canale stasera?
SELECT c.name, count(*) AS prg
FROM programmes p
JOIN canonical_channels c ON c.id = p.channel_id
WHERE p.start_at >= now() AND p.start_at < now() + interval '24 hours'
GROUP BY c.name ORDER BY c.name;

-- Canali irrisolti in coda
SELECT source, source_id, display_name, last_seen
FROM unresolved_channels
ORDER BY last_seen DESC;

-- Alias registrati
SELECT * FROM channel_aliases ORDER BY source, source_id;
```

### Aggiornare il feed XMLTV

Per cambiare sorgente EPG, aggiorna il secret `XMLTV_URL` su GitHub Actions. L'URL attuale usa il feed di iptv-org specifico per l'Italia. Se il feed cambia struttura, potrebbe essere necessario aggiornare `XMLTV_SOURCE` nel workflow (hardcoded come `iptv-org`).

### Disabilitare un canale dalla UI

```sql
UPDATE canonical_channels SET is_active = false WHERE id = 'nome-canale';
```

Il canale sparirà dalla home e dalla lista, ma i suoi programmi rimangono nel DB. Per riabilitarlo: `SET is_active = true`.

---

## 8. Troubleshooting

### Il workflow EPG Ingest fallisce

**Controlla i log** su GitHub → Actions → EPG Ingest → ultimo run → job `ingest`.

Cause comuni:

| Sintomo nei log | Causa probabile | Fix |
|-----------------|-----------------|-----|
| `DATABASE_URL non configurato` | Secret mancante | Aggiungi il secret su GitHub |
| `Download EPG fallito: 404` | URL feed non più valido | Aggiorna `XMLTV_URL` |
| `Download EPG fallito: timeout` | Feed lento o down | Riprova manualmente il giorno dopo |
| `password authentication failed` | DATABASE_URL scaduta o errata | Rigenera da Neon e aggiorna il secret |

### La home non si aggiorna dopo l'ingest

1. Controlla se l'ingest è andato a buon fine (log verdi su GitHub).
2. Controlla se il POST a `/api/revalidate` è andato a buon fine (log: `Revalidate risposto: 200`).
3. Se l'URL in `NEXT_PUBLIC_SITE_URL` è sbagliato, il revalidate non raggiunge Vercel.
4. Forza manualmente: `curl -X POST https://staseraintivu.it/api/revalidate -H "Authorization: Bearer TOKEN"`.

### Tutti i programmi di un canale risultano "skipped"

Il canale è in `unresolved_channels`. Vai sul pannello admin, approvalo, poi rilancia l'ingest.

### Il pannello admin mostra la lista vuota ma non dà 401

`unresolved_channels` è vuota — tutti i canali del feed sono già risolti. È lo stato desiderabile a regime.

### Vercel mostra pagina di errore 500

Controlla i log su **Vercel → Deployments → Functions** per il dettaglio dell'errore.
Causa più comune: `DATABASE_URL` non configurata o scaduta su Vercel (diversa da quella su GitHub Actions).
