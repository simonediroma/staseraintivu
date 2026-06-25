# M0 — Scaffold Next.js 15

## Contesto

Punto di partenza. Repo vuoto (solo CLAUDE.md, CLAUDE_MEMORY.md, docs/, PRD.md).

## Obiettivo

Creare la struttura completa del progetto Next.js 15: cartelle, package.json, tsconfig, next.config.ts, tailwind.config.ts, .gitignore, .env.local template. Al termine deve buildare senza errori.

## Acceptance criteria

- [ ] `npm run build` completato senza errori
- [ ] `npm run dev` avvia il dev server su localhost:3000
- [ ] Struttura cartelle corrisponde a `docs/architecture.md`
- [ ] `.gitignore` include `.env.local`, `node_modules/`, `.next/`
- [ ] Nessun file `.env` committato
- [ ] `tailwind.config.ts` con dark mode `class`
- [ ] `tsconfig.json` con `strict: true` e path alias `@/*` → `src/*`

## Files che verranno creati

- `package.json` — deps: `next`, `react`, `react-dom`, `pg`, `sax`; devDeps: `typescript`, `tailwindcss`, `@types/*`, `vitest`
- `tsconfig.json`
- `next.config.ts` — `images.remotePatterns` per loghi esterni
- `tailwind.config.ts` — dark mode `class`
- `.gitignore`
- `.env.local.example` — template variabili (valori vuoti)
- `src/app/layout.tsx` — root layout placeholder
- `src/app/page.tsx` — home placeholder
- `src/lib/db.ts` — singleton `pg.Pool` (vedi docs/lessons.md)
- `src/lib/utils.ts` — placeholder vuoto

## Gate pre-PR

**Code review a 5 assi:**
- [ ] Correttezza: struttura corrisponde a `docs/architecture.md`?
- [ ] Sicurezza: `.env.local` in `.gitignore`, nessun secret hardcoded?
- [ ] Leggibilità: struttura cartelle auto-esplicativa?
- [ ] Performance: nessuna dipendenza inutile nel `package.json`?
- [ ] Chirurgico: solo scaffold, zero business logic?

## Note per Claude Code

- Usa `npx create-next-app@latest` con flag `--typescript --tailwind --app --src-dir --import-alias "@/*"` oppure configura manualmente — il risultato finale deve matchare la struttura in `docs/architecture.md`.
- `pg.Pool` va nel singleton `src/lib/db.ts` con `max: 5`. Non creare Pool in altri file.
- `next.config.ts` deve avere `images.remotePatterns` configurato per URL esterni (loghi canali da iptv-org).
- `.env.local.example` con tutte le variabili da `docs/architecture.md` (valori placeholder, non valori reali).
