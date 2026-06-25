# M2 — EPG Core Lib (porting moduli invariati)

## Contesto

Dipende da: M0 completato. `src/lib/epg/` non esiste ancora.
Codice sorgente disponibile in `../oraintivu/` e `../oraintivu_1/` (path relativi alla parent dir del repo).

## Obiettivo

Portare i 4 moduli EPG core as-is nella posizione corretta del progetto. Questi file non vanno modificati — la logica è già testata. Verificare solo che i tipi TypeScript compilino nel nuovo contesto.

## Acceptance criteria

- [ ] `src/lib/epg/datetime.ts` — presente e compila senza errori
- [ ] `src/lib/epg/parse-xmltv.ts` — presente e compila senza errori
- [ ] `src/lib/epg/channel-alias.ts` — presente e compila senza errori
- [ ] `src/lib/epg/prime-time.ts` — presente e compila senza errori
- [ ] `npm run build` passa
- [ ] Test: `tonightWindow(new Date(), 'Europe/Rome')` ritorna un oggetto `{ from, to }` con date valide

## Files che verranno creati

- `src/lib/epg/datetime.ts` — da `oraintivu_1/datetime.ts`
- `src/lib/epg/parse-xmltv.ts` — da `oraintivu_1/parse-xmltv.ts`
- `src/lib/epg/channel-alias.ts` — da `oraintivu/channel-alias.ts`
- `src/lib/epg/prime-time.ts` — da `oraintivu_1/prime-time.ts`

## Implementazione

**Non TDD — porting as-is.** L'unica modifica ammessa: aggiustare import path se i moduli si referenziano tra loro con path relativi che non matchano la nuova struttura.

Prima di qualsiasi modifica: `git blame` + capire perché esiste ogni riga. (Chesterton's Fence)

Ciclo: porta il file → `npm run build` → risolvi eventuali errori di tipo → commit → prossimo file.

## Gate pre-PR

**Code review a 5 assi:**
- [ ] Correttezza: i file sono identici agli originali (diff puro)? Nessuna modifica di logica?
- [ ] Sicurezza: nessun secret o path assoluto hardcoded?
- [ ] Leggibilità: nessuna modifica stilistica non richiesta?
- [ ] Performance: nessuna dipendenza aggiunta?
- [ ] Chirurgico: se c'è qualsiasi modifica oltre agli import path, giustificarla nel commit message?

## Note per Claude Code

- **Non modificare la logica** — questi file sono invariati per policy (vedi CLAUDE.md).
- Se trovi un bug reale, aprilo come nota nel commit message. Non fixarlo in questa macro.
- `parse-xmltv.ts` usa `sax` — assicurarsi che `sax` e `@types/sax` siano in `package.json`.
- `channel-alias.ts` implementa Levenshtein — se ha dipendenze esterne, portarle.
