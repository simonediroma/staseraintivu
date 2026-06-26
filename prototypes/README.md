# prototypes/ — codice di riferimento (NON parte dell'app)

Questa cartella contiene i prototipi EPG portati dalle codebase precedenti
(`oraintivu`, `oraintivu_1`). Servono **solo come riferimento** per il porting
nelle macro M2–M4 verso `src/lib/epg/`.

Regole:
- **Non importare** nulla da qui in `src/`.
- **Escluso dal build**: `prototypes/` è in `exclude` nel `tsconfig.json`, quindi
  `next build` non type-checka questi file (sono incoerenti tra loro e non
  compilano da soli). Non rimuovere quell'esclusione.
- Quando un modulo viene portato in `src/lib/epg/`, la versione di riferimento
  qui resta a scopo storico finché la macro relativa non è completata.
