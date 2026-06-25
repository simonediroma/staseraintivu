# UI-2 — Pagine Giorno + Timeline Canale

## Contesto

Dipende da: UI-1 completato (layout e componenti base presenti), M5 completato (`/api/schedule` funzionante).

## Obiettivo

Implementare la pagina del palinsesto per giorno specifico (`/[data]`) e la timeline programmi per singolo canale (`/canale/[slug]`).

## Acceptance criteria

### `/[data]` — Palinsesto giorno

- [ ] URL `/2026-06-25` mostra palinsesto del giorno specifico
- [ ] Navigazione avanti/indietro per giorno (componente `DayNav`)
- [ ] Giorni passati: `revalidate = false` (immutabili, cache permanente)
- [ ] Giorno corrente e futuri: `revalidate = 3600`
- [ ] Range navigabile: ieri + oggi + 5 giorni avanti
- [ ] URL con data malformata (`/abc`) → 404

### `/canale/[slug]` — Timeline canale

- [ ] URL `/canale/rai-1` mostra tutti i programmi del canale per oggi
- [ ] Programmi ordinati per `start_at` crescente
- [ ] Highlight visivo del programma in corso (confronto con `now()`)
- [ ] Slug inesistente → 404
- [ ] `revalidate = 3600`

## Files che verranno creati

- `src/app/[data]/page.tsx` — palinsesto giorno (Server Component, ISR)
- `src/app/canale/[slug]/page.tsx` — timeline canale (Server Component, ISR)
- `src/components/DayNav.tsx` — navigazione avanti/indietro giorno
- `src/components/Timeline.tsx` — lista programmi con highlight "in corso"

## Implementazione — incrementale

Ciclo: implementa (≤100 righe) → build → commit → slice successiva.
Ordine: DayNav → `[data]/page.tsx` → Timeline → `canale/[slug]/page.tsx`.

## Gate pre-PR

**Code review a 5 assi (frontend):**
- [ ] Correttezza: giorni passati hanno `revalidate = false`? Giorni futuri `revalidate = 3600`?
- [ ] Accessibilità: `DayNav` usa `<nav>` con `aria-label`, bottoni con label descrittive?
- [ ] Leggibilità: `Timeline` e `DayNav` sono componenti separati, non inline in page.tsx?
- [ ] Performance: `generateStaticParams` per i giorni prossimi (pre-rendering ISR)?
- [ ] Chirurgico: nessuna logica di date nei componenti — tutto calcolato in page.tsx o utils?

## Note per Claude Code

- `[data]` è un parametro dinamico Next.js. Validare che sia una data ISO valida prima di fare qualsiasi query. Data non valida → `notFound()` (importato da `next/navigation`).
- Per il highlight "in corso" in `Timeline`: confronta `programme.startAt <= now && programme.stopAt > now`. `now` va calcolato server-side nel Server Component — non lato client per evitare hydration mismatch.
- `DayNav` è un Client Component (ha `onClick`). Riceve la data corrente come prop e calcola le date adiacenti con `Date` nativa.
- `generateStaticParams` per `[data]`: genera i 7 giorni (ieri + oggi + 5 avanti) per il pre-rendering ISR al build time.
