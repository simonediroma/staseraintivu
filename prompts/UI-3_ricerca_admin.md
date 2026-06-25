# UI-3 — Pagina Ricerca + Admin Panel

## Contesto

Dipende da: UI-1 completato, M6 completato (`/api/search` e `/api/admin/*` funzionanti).

## Obiettivo

Implementare la pagina di ricerca con input live e il pannello admin per la gestione dei canali irrisolti.

## Acceptance criteria

### Ricerca (`/cerca`)

- [ ] Input di ricerca con debounce 300ms
- [ ] Risultati mostrano: nome canale, data/ora, titolo, snippet descrizione
- [ ] Query vuota → nessuna chiamata API, messaggio placeholder
- [ ] Zero risultati → messaggio "Nessun risultato per X"
- [ ] Loading state durante la fetch
- [ ] URL aggiornato con `?q=...` per condivisibilità
- [ ] `AbortController` annulla fetch in corso quando l'utente digita una nuova query

### Admin (`/admin`)

- [ ] La pagina richiede `ADMIN_KEY` — se non disponibile lato client, il fetch all'API fallisce con 401 e mostra messaggio di errore
- [ ] Form di input per inserire la chiave (salvata in `sessionStorage`, non `localStorage`)
- [ ] Tabella canali irrisolti con colonne: Source, Source ID, Display Name, Suggerimenti (ordinati per score)
- [ ] Bottone "Approva" pre-seleziona il suggerimento con score più alto
- [ ] Dropdown per scegliere il canonical manualmente (lista di tutti i canali da `/api/channels`)
- [ ] Dopo approvazione, la riga scompare dalla tabella (optimistic update o refetch)
- [ ] Se `unresolved_channels` è vuota, mostra "Nessun canale da approvare 🎉"

## Files che verranno creati

- `src/app/cerca/page.tsx` — pagina ricerca (Client Component)
- `src/app/admin/page.tsx` — admin panel (Client Component)
- `src/components/SearchBar.tsx` — input con debounce e gestione risultati
- `src/components/AdminTable.tsx` — tabella canali irrisolti con azioni

## Implementazione — incrementale

Ciclo: implementa (≤100 righe) → build → commit → slice successiva.
Ordine: SearchBar → `/cerca/page.tsx` → AdminTable → `/admin/page.tsx`.

## Doubt-Driven Review (admin — input utente + auth)

Prima di scrivere il codice dell'admin:
1. **CLAIM**: `ADMIN_KEY` è passato come header lato client. **DOUBT**: è visibile nei DevTools del browser. **RECONCILE**: per un progetto personale/esperimento è accettabile. Documentare nel commit che non è adatto a un sito pubblico con dati sensibili. Se il rischio è inaccettabile, spostare l'admin su una route server-side con cookie.
2. **CLAIM**: la pagina `/admin` non ha protezione a livello di routing. **DOUBT**: chiunque raggiunga l'URL vede il form, anche se le API restituiscono 401. **RECONCILE**: accettabile — l'UI senza chiave non funziona. Il form di input per la chiave è già nella spec.
Massimo 3 cicli. Se il dubbio non si risolve: fermati e chiedi.

## Gate pre-PR

**Security checklist (client):**
- [ ] `ADMIN_KEY` salvato in `sessionStorage` (non `localStorage`, non URL)
- [ ] Nessun secret in variabili d'ambiente `NEXT_PUBLIC_*`
- [ ] Input ricerca non esegue `eval` o DOM manipulation

**Code review a 5 assi (frontend):**
- [ ] Correttezza: debounce annulla correttamente la fetch precedente (`useEffect` cleanup + `AbortController`)?
- [ ] Accessibilità: bottoni admin hanno label descrittive, non solo "Approva"?
- [ ] Leggibilità: `SearchBar` e `AdminTable` sono componenti separati?
- [ ] Performance: risultati di ricerca non re-renderano la lista intera per ogni carattere?
- [ ] Chirurgico: zero logica business nei componenti?

## Note per Claude Code

- `SearchBar` usa `useEffect` con `setTimeout` per il debounce (300ms) — cancella il timeout precedente nel cleanup. Non usare librerie esterne.
- Usa `AbortController` per annullare fetch in corso quando l'utente digita una nuova query.
- La pagina `/cerca` deve aggiornare `?q=...` nell'URL via `router.replace` (da `next/navigation`) — senza causare re-render inutili.
- L'admin panel mostra un form per inserire la chiave se non è in `sessionStorage`. Una volta inserita e validata (prima fetch 200), la salva in `sessionStorage`.
