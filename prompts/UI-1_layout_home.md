# UI-1 — Layout + Home (Stasera in TV)

## Contesto

Dipende da: M5 completato (`/api/tonight` e `/api/channels` funzionanti).

## Obiettivo

Implementare il root layout con dark mode, il componente griglia canali e la home page che mostra il palinsesto di prima serata per tutti i canali ordinati per LCN.

## Acceptance criteria

- [ ] Root layout con `<html>` che applica `class="dark"` in base al tema
- [ ] Toggle dark mode funzionante (persiste in `localStorage`)
- [ ] Header con logo "staseraintivu", navigazione (Stasera / Guida TV / Cerca), toggle dark mode
- [ ] Home ISR: `revalidate = 3600`
- [ ] Griglia canali ordinata per `sort_order` (= LCN)
- [ ] Ogni riga mostra: logo canale, numero LCN, orario inizio/fine, titolo (bold), categoria (chip colorata), descrizione troncata 2 righe
- [ ] Chip categoria colorata per genere: film (blu), serie (viola), news (rosso), sport (verde), intrattenimento (arancio), altro (grigio)
- [ ] Skeleton loading durante idratazione client
- [ ] Layout responsive: mobile (1 colonna) e desktop (griglia piena)
- [ ] Build: `npm run build` passa e Lighthouse ≥ 90 su mobile

## Files che verranno creati

- `src/app/layout.tsx` — root layout con dark mode provider
- `src/app/page.tsx` — home Server Component (fetch `/api/tonight` o query DB diretta, ISR)
- `src/components/ChannelGrid.tsx` — griglia canali
- `src/components/ChannelRow.tsx` — riga singola canale
- `src/components/ProgrammeCard.tsx` — card dati programma
- `src/components/CategoryChip.tsx` — chip genere colorata
- `src/components/DarkModeToggle.tsx` — toggle tema

## Implementazione — incrementale

Ciclo: implementa (≤100 righe) → build → commit → slice successiva.
Ordine: layout.tsx → DarkModeToggle → CategoryChip → ProgrammeCard → ChannelRow → ChannelGrid → page.tsx.

## Gate pre-PR

**Code review a 5 assi (frontend):**
- [ ] Correttezza: la home mostra i programmi della prima serata di oggi, non dati mock?
- [ ] Accessibilità: le immagini logo hanno `alt` con nome canale, i link hanno testo descrittivo?
- [ ] Leggibilità: ogni componente ha una sola responsabilità, ≤ 80 righe?
- [ ] Performance: `<Image>` di Next.js per i loghi (non `<img>`), lazy loading automatico?
- [ ] Chirurgico: zero chiamate API nei componenti — tutto il fetch in Server Components o page.tsx?

## Note per Claude Code

- La home può fare query DB diretta (Server Component) oppure chiamare `/api/tonight` — entrambi sono validi. Il fetch diretto è più efficiente su Vercel (no round-trip HTTP interno).
- Dark mode: usa `class` strategy di Tailwind. Il toggle scrive `document.documentElement.classList.toggle('dark')` e persiste in `localStorage`.
- `next.config.ts` deve avere `images.remotePatterns` per i loghi (già configurato in M0 — verificare).
- Tailwind dark mode classes: `dark:bg-gray-900 dark:text-white` ecc.
- Skeleton loading: usa `animate-pulse` di Tailwind per i placeholder durante l'idratazione.
