# staseraintivu — Lessons & Pattern Consolidati

## Pattern da seguire sempre

### Singleton DB

`src/lib/db.ts` esporta un unico `pg.Pool`. Tutti i moduli importano da lì.
**Non creare mai `new Pool()` in altri file.** Il prototipo in `oraintivu/` lo fa — è il difetto principale da correggere.

```ts
// src/lib/db.ts
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export default pool;
```

### Moduli EPG core — non toccare

`datetime.ts`, `parse-xmltv.ts`, `channel-alias.ts`, `prime-time.ts` sono portati as-is da codebase già testata. Se trovi un bug, segnalalo ma non modificarli nel contesto di una macro diversa.

### Channel resolution — mai fuzzy automatico

Il `ChannelResolver` ha tre livelli: alias → nome normalizzato → fuzzy.
Il fuzzy restituisce **suggerimenti** (status `'unresolved'`), mai applica automaticamente.
Codice che chiama `resolver.resolve()` deve sempre gestire entrambi i branch.

### Ingest idempotente

`upsertProgrammes` usa `ON CONFLICT (channel_id, start_at) DO UPDATE`. Rieseguire l'ingest non crea duplicati. Stesso per canali e alias.

### API Cache-Control in Next.js 15 App Router

```ts
export async function GET() {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' }
  });
}
```

### ISR on-demand

```ts
// in /api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
revalidatePath('/');
revalidatePath('/[data]', 'page');
```

---

## Errori da evitare

### Pool connection leak

Non dimenticare `client.release()` dopo `pool.connect()`. Usare sempre try/finally:

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Timezone bug

I timestamp XMLTV vanno parsati con `parseXmltvDate()` da `datetime.ts`.
Non usare `new Date(rawString)` direttamente — i feed italiani spesso omettono il fuso.
La finestra "stasera" va calcolata con `tonightWindow()` da `prime-time.ts`, non a mano.

### next.config.ts — images

I loghi canali vengono da URL esterni. Configurare `images.remotePatterns` in `next.config.ts` prima di usare `<Image>` con URL esterni, altrimenti Next.js blocca il caricamento.

### GENERATED COLUMN search_vec

Non inserire `search_vec` nell'array di colonne delle INSERT/UPDATE — Postgres lo gestisce automaticamente e genera un errore se ci provi.

---

## Principi di implementazione (pattern Osmani)

### Chesterton's Fence — prima di riscrivere

Prima di rimuovere o modificare codice che "sembra inutile": verifica con `git blame`.
Spesso esiste per edge case non ovvi (timezone, encoding, retry su flakiness).
Se non capisci il perché, non toccare — aggiungi un commento e segnala nella PR.

### Doubt-Driven — step EXTRACT e limite STOP

I 5 step completi (CLAUDE.md mostra i 3 essenziali per brevità):
1. **CLAIM** — scrivi la decisione come affermazione esplicita
2. **EXTRACT** — isola l'artifact che stai valutando dal tuo chain-of-thought. Non mescolare "cosa sto decidendo" con "perché" — previene l'auto-convincimento.
3. **DOUBT** — elenca 2-3 modi in cui il CLAIM potrebbe essere sbagliato
4. **RECONCILE** — verifica con dati reali (doc ufficiale, test, misura)
5. **STOP** — se dopo 3 cicli il dubbio non si risolve: manca informazione esterna. Chiedi all'utente o cerca nella documentazione ufficiale.

### Rule of 500 — refactoring di scala

Se un refactoring tocca > 500 righe, non farlo a mano.
Scrivi un codemod (sed, ast-grep, ts-morph) o uno script Python.
Modifiche manuali su quella scala sono error-prone e difficili da revieware.

### API — validate-at-boundaries e Hyrum's Law

**Validate-at-boundaries:** valida input esterno (request body, query params, webhook) una sola volta nel route handler. Dopo la validazione, il codice interno (store, service) si fida dei tipi TypeScript. Non ripetere la validazione inside-out — crea rumore e doppia manutenzione.

**Hyrum's Law:** ogni campo che esponi in una response diventa un contratto implicito. Il frontend dipenderà da qualsiasi comportamento osservabile, documentato o no. Esponi solo ciò che intendi mantenere. Aggiungi campi nuovi come opzionali — non rimuovere o rinominare campi esistenti senza versioning esplicito.

---

## Decisioni già prese (non riaprire)

- **No Redis in v1.** ISR + Vercel CDN è sufficiente. Redis si aggiunge solo se le query DB diventano collo di bottiglia misurato.
- **Neon** come DB, non Supabase. Motivo: meno overhead, interfaccia più semplice per Postgres puro.
- **GitHub Actions** per il cron ingest, non Vercel Cron Jobs. Motivo: piano Hobby Vercel ha timeout 60s — troppo corto per ingest di file XMLTV grandi.
- **`tsx`** per eseguire lo script ingest TypeScript direttamente, senza compilazione.
- **`tsvector` GENERATED** per la ricerca, non un servizio esterno. Sufficiente per v1.
- **Autenticazione admin con header `X-Admin-Key`**, non OAuth. Sito personale/esperimento, non vale la complessità di un flow OAuth.
