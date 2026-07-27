# 7 Wonders Online — setup da zero

Stessa base di Harmonies Online (Vite + React + Supabase), adattata alle regole di 7 Wonders.
Se hai già seguito la guida di Harmonies, i passi 1-4 e 6-7 sono identici: qui trovi comunque
la guida completa.

## 0. Cosa ti serve installato

- **Node.js** (versione 18 o superiore): `node -v` nel terminale, o scaricalo da https://nodejs.org (LTS).
- **VS Code** (o un editor a tua scelta).

## 1. Apri il progetto

`File` → `Open Folder...` → cartella `7wonders-online`. Terminale integrato: **Ctrl+`**.

## 2. Installa le dipendenze

```
npm install
```

## 3. Crea un progetto Supabase

Come per Harmonies: https://supabase.com → **New project** → nome/password/regione a piacere,
piano gratuito.

## 4. Recupera le chiavi API

`Project Settings` → `API` (o `Data API`): copia **Project URL** e **anon public key**.
Duplica `.env.example` in `.env` e incollali:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

## 5. Crea le tabelle

`SQL Editor` → **New query** → incolla **tutto** il contenuto di `supabase/schema.sql` → **Run**.
Dovresti vedere `profiles`, `games`, `players`, `player_hands` in `Table Editor`.

**Se il tuo database esiste già da prima** (progetto Supabase creato prima del 25/07): esegui
anche `supabase/migration_002_payments.sql` — aggiunge il supporto al pagamento reale ai vicini
quando gli compri risorse (colonna nuova + una policy). Se stai creando il database da zero
adesso, non serve: `schema.sql` include già tutto.

## 6. Attiva la conferma email

`Authentication` → `Providers` → `Email` → assicurati che **Confirm email** sia attivo.
Poi `Authentication → URL Configuration`: imposta **Site URL** e **Redirect URLs** sul dominio
reale della tua app (es. quello di Vercel).

## 7. Avvia il progetto

```
npm run dev
```

Apri il link (`http://localhost:5173/`), registrati, scegli un nickname. Da Lobby crea una
stanza, apri una seconda scheda/browser in incognito con un secondo account e unisciti con il
codice stanza — servono **almeno 3 giocatori** per avviare una partita.

---

## Architettura riusata 1:1 da Harmonies

- **Auth.jsx**, **supabaseClient.js**: invariati — login/registrazione email+password,
  conferma email, recupero password, nickname account-wide.
- **joinGame.js**: stesso principio ("chi era già seduto rientra sempre, un nuovo giocatore
  solo se la partita è ancora `waiting`"), adattato per creare anche la riga `player_hands`.
- **Lobby.jsx**: stessa struttura (crea/entra con codice stanza, elenco partite attive/concluse),
  senza le opzioni specifiche di Harmonies (qui non servono: la scelta di Meraviglia avviene
  dentro la stanza).
- **theme.js**, **Loader.jsx**, **ErrorBoundary.jsx**, `App.jsx`, `vercel.json`, struttura
  cartelle (`game-engine/` = JS puro, nessuna dipendenza da React/Supabase).

## Cosa cambia rispetto a Harmonies (e perché)

7 Wonders ha **informazione nascosta reale** (la mano di carte) e **scelte simultanee** di
tutti i giocatori a ogni turno — Harmonies aveva stato tutto pubblico e un solo giocatore
attivo alla volta. Questo ha richiesto un design diverso, spiegato nei commenti di
`supabase/schema.sql` e `src/pages/Game.jsx`:

- Una tabella separata **`player_hands`** (RLS: leggibile solo dal proprietario) tiene la mano
  e la carta scelta ma non ancora rivelata.
- Il "passaggio mano" tra vicini avviene **senza che nessun client scriva la riga di un altro
  giocatore**: chi sceglie la carta calcola subito le carte che gli restano e le "indirizza" al
  vicino (`outgoing_hand_for`); una policy RLS permette anche al destinatario di leggere quello
  slot, ma è sempre lui a copiarsele nella propria mano.
- L'avanzamento di turno/Epoca (stato condiviso in `games`) usa un **lock ottimistico**:
  `update ... where turn_number = N` — se un altro client è arrivato prima, l'update non tocca
  righe e non succede nulla di male.

**Limite noto, già presente anche in Harmonies**: le regole sono validate lato client, non da
un server. Un client scorretto potrebbe in teoria costruire senza pagare. Per una versione
davvero anti-cheat servirebbe una Edge Function con service role — fuori scope per questa v1.

## Cosa funziona adesso

- Login, lobby, creazione/ingresso stanza, scelta libera di Meraviglia (7 nomi × lato A/B, come
  richiesto) dentro la sala d'attesa, avvio partita da 3 a 7 giocatori.
- Mazzi Epoca I/II/III mescolati e filtrati per numero di giocatori (incluso il pool di Gilde
  Epoca III, players+2 come da regolamento).
- Turno completo: scelta simultanea di una carta, 3 azioni (costruisci Edificio / costruisci
  stadio Meraviglia / vendi per 3 monete), produzione risorse (fisse e a scelta), acquisto
  risorse dai vicini con risoluzione automatica del costo minimo (incluse le concatenazioni
  gratuite e gli sconti commercio), passaggio mano, sesto turno speciale (mano da 2 carte).
- Risoluzione conflitti militari a fine Epoca, punteggio finale completo nell'ordine ufficiale
  (Militari → Tesoro → Meraviglia → Blu → Gialle → Verdi con simboli a scelta ottimizzati →
  Viola/Gilde), classifica finale.

## Cosa manca / è semplificato (prossimi step)

- **Interfaccia**: essenziale (liste e pulsanti), non ancora "a carte" visivamente come le foto
  allegate — buona base per iterare insieme.
- **Effetti speciali non ancora interattivi**: "costruisci gratis dagli scarti" (Halikarnassós),
  "copia una Gilda di un vicino" (Olympia lato B), "gioca l'ultima carta invece di scartarla"
  (Olympia lato A) sono codificati nei dati ma non hanno ancora un'interfaccia per essere
  scelti/attivati in partita.
- **Validazione server-side**: vedi limite noto sopra.
- **Variante 2 giocatori (Città Libera)**: esclusa da questa v1 su tua indicazione.

## Livello di confidenza dei dati di gioco (leggi prima di una partita "sul serio")

Come per le carte Animale di Harmonies, alcuni dati sono ricostruiti dalla mia conoscenza
generale del gioco più che letti pixel per pixel dalle foto (le icone di costo sono troppo
piccole per essere lette con certezza assoluta):

- **Alta confidenza**: nomi/colori/Epoca delle 70 carte + 10 Gilde (trascritti dalla scheda
  "Elenco delle Carte"), i valori PV grandi e leggibili nelle foto (es. Pantheon 7, Palazzo 8),
  gli effetti delle carte Gialle di Epoca II/III (testo esplicito nella scheda "Descrizione
  degli Effetti"), tutta la meccanica di turno/produzione/acquisto/catene (dal regolamento),
  **il numero di copie/soglie di giocatori di ogni carta** (`EXACT_THRESHOLDS` in `cards.js` —
  confermate dall'utente carta per carta contro il mazzo fisico), e **i costi in risorse di
  ogni carta e Gilda** (verificati il 27/07 contro la 7 Wonders Wiki — corrette diverse
  imprecisioni, tra cui gli effetti di Faro/Porto/Camera di Commercio che contavano il colore
  sbagliato). Il totale carte (148 incluse le Gilde) torna esattamente con il regolamento.
- **Media confidenza — da verificare contro il mazzo fisico**: la mappa completa delle
  concatenazioni gratuite (`chainFrom` in `cards.js`), i costi esatti degli stadi delle 7
  plance Meraviglia (`wonders.js`).

Sono tutte correzioni isolate, una riga per carta/stadio, in `src/game-engine/cards.js`,
`guilds.js` e `wonders.js` — segnalami cosa non torna e li sistemiamo insieme.
