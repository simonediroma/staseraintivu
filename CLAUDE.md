# staseraintivu — Claude Code Configuration

---

## ⚡ ISTRUZIONI OPERATIVE — LEGGERE SEMPRE

1. **Inizio sessione:** leggi `@CLAUDE_MEMORY.md`. Quella è la tua partenza.
2. **Fine sessione:** aggiorna `CLAUDE_MEMORY.md` (versionato — committalo e pushalo, è la memoria che persiste tra sessioni Claude Code web):
   - Marca i task completati con `[x]`
   - Aggiorna `Ultima sessione` con la data odierna
   - Scrivi `Prossima sessione — inizia da qui` in modo actionable
   - Aggiorna `PR corrente` e `Branch` se cambiati
3. **Branch:** ogni sessione ha il suo branch. Mai push su `main`.
4. **PR:** una PR per macro. Indipendente e reviewable.
5. **File invariati:** non toccare mai `src/lib/epg/datetime.ts`, `src/lib/epg/parse-xmltv.ts`, `src/lib/epg/channel-alias.ts`, `src/lib/epg/prime-time.ts` — portati as-is da codebase testata.

---

## Regole di Sviluppo

### 1. Pensa prima di scrivere

Non assumere. Enuncia le assunzioni prima di implementare. Se esistono interpretazioni
multiple, presentale. Se qualcosa non è chiaro, fermati e chiedi.

### 2. Semplicità

Il minimo codice che risolve il problema. Niente di speculativo.
Nessuna feature oltre quanto richiesto. Nessuna astrazione per codice usato una sola volta.
Se scrivi 200 righe e ne basterebbero 50, riscrivi.

*Test: "Un senior engineer direbbe che è sovra-complicato?" Se sì, semplifica.*

### 3. Cambiamenti chirurgici

Tocca solo quello che devi. Non migliorare codice adiacente non rotto.
Mantieni lo stile esistente. Rimuovi import/variabili che le TUE modifiche hanno reso inutilizzati.

*Test: ogni riga modificata deve ricondursi direttamente alla richiesta.*

Prima di rimuovere o riscrivere codice esistente: capire PERCHÉ esiste.
`git blame` + context. Se non capisci, non toccare. (Chesterton's Fence)

### 4. Goal-driven

Trasforma ogni task in obiettivi verificabili prima di iniziare:
- "Aggiungi validazione" → "Scrivi test per input non validi, poi falli passare"
- "Correggi il bug" → "Scrivi un test che lo riproduce, poi fallo passare"

### 5. Cerca prima di implementare

Prima di scrivere qualsiasi funzione: cerca con Grep se esiste già.
Se esiste: riusa. Se è simile: menzionalo e proponi se estendere o creare.

---

### 6. Doubt-Driven Review — per decisioni ad alto rischio

**Attiva quando:** task tocca > 3 file, decisione irreversibile (schema DB, contratto API),
o la macro è ALTO (schema DB, auth admin, input utente).

Per ogni decisione non banale in queste condizioni:
1. **CLAIM** — scrivi la decisione come affermazione esplicita
2. **DOUBT** — elenca 2-3 modi in cui potrebbe essere sbagliata o avere side effect
3. **RECONCILE** — verifica o aggiusta. Se non regge, fermati e chiedi.

Non procedere se il CLAIM non regge al DOUBT.
Massimo 3 cicli. Se il dubbio non si risolve: fermati e chiedi.
Il loop infinito è un segnale che manca informazione esterna.

### 7. TDD — per logica con branch multipli

RED → GREEN → REFACTOR. Mai scrivere test dopo il codice di produzione.
Scrivi il test che fallisce → implementa il minimo → refactora.
Applica su: business logic EPG, store queries, ingest logic.

Bug fix: scrivi prima il test che riproduce il bug (deve fallire), poi il fix.
Test scritto dopo il fix non è TDD.

### 8. Gate pre-PR (ogni PR, senza eccezioni)

**Security** — se la macro tocca auth admin, input utente, env vars:
- [ ] Nessun secret committato o loggato
- [ ] Input validato prima di ogni operazione DB
- [ ] ADMIN_KEY e REVALIDATE_TOKEN verificati server-side, mai esposti al client
- [ ] OWASP Top 10 verificato per questa macro

**Code review a 5 assi:**
- [ ] Correttezza: il codice fa quello che dice?
- [ ] Sicurezza: nessuna vulnerabilità introdotta?
- [ ] Leggibilità: comprensibile in 5 minuti?
- [ ] Performance: nessuna regressione evidente?
- [ ] Chirurgico: ogni riga riconduce alla richiesta?

### 9. Implementazione incrementale — dentro ogni macro

Ciclo: implementa (≤100 righe) → test → build → commit → slice successiva.
- Mai >100 righe senza eseguire i test
- Il build deve passare dopo ogni commit
- Scope fisso: annota ma non toccare il codice fuori macro
- Commit atomici: una cosa per commit

---

## Riferimenti Tecnici

Prima di ogni scelta architetturale: @docs/architecture.md
Contiene: stack, pattern, infrastruttura, schema DB, flussi principali, deploy.

Prima di implementare qualcosa di non banale: @docs/lessons.md
Contiene: pattern consolidati, errori da evitare, decisioni già prese.

I prompt di implementazione sono in `prompts/`. Eseguili in ordine. Non saltare macros.

---

# 📍 Stato Corrente e Memoria di Sessione

@CLAUDE_MEMORY.md
