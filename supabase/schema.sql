-- ============================================================
-- Schema 7 Wonders Online — versione consolidata v1
-- Da eseguire UNA VOLTA sola nel SQL Editor di Supabase.
--
-- DIFFERENZA CHIAVE rispetto a Harmonies: qui esiste INFORMAZIONE
-- NASCOSTA reale (mano di carte). Harmonies aveva stato tutto
-- pubblico e un solo giocatore attivo alla volta; 7 Wonders ha scelte
-- SIMULTANEE e private. Questo obbliga a un design diverso.
--
-- PRINCIPIO DI PROGETTAZIONE (importante, leggere prima di modificare):
-- ogni client scrive SEMPRE E SOLO la propria riga (auth.uid() =
-- user_id), sia in "players" che in "player_hands". Non esiste nessuna
-- funzione che scrive lo stato di un altro giocatore. Il "passaggio
-- mano" tra vicini e' risolto cosi': quando scegli la tua carta, il tuo
-- client calcola SUBITO le carte che ti restano e le scrive nella TUA
-- riga con outgoing_hand_for = user_id del vicino a cui spettano. Il
-- vicino le legge (grazie a una policy che permette anche a lui di
-- leggere quella riga) e le copia nella PROPRIA mano — cioe' e' sempre
-- il destinatario a scriversi la propria mano, mai il mittente.
-- Questo evita completamente il bisogno di una Edge Function per il
-- "cuore" del turno. Resta un limite (vedi fondo file) sul fatto che
-- con RLS scritta cosi' un client potrebbe in teoria scrivere dati non
-- validi nella propria riga (es. costruire senza pagare) — la
-- validazione delle regole resta lato client, come in Harmonies.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- PROFILES — identico a Harmonies.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_unique on profiles (lower(trim(nickname)));

-- ============================================================
-- GAMES: stato PUBBLICO condiviso.
-- age_decks contiene i mazzi gia' mescolati e filtrati per numero di
-- giocatori: SONO pubblici (leggibili da tutti), esattamente come lo
-- era il "bag" dei dischi in Harmonies — un giocatore scorretto
-- potrebbe in teoria sbirciare l'ordine futuro. Stesso compromesso gia'
-- accettato nel progetto precedente, non introduce un problema nuovo.
-- ============================================================
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null default 'waiting',          -- waiting | playing | finished
  age int not null default 1,                       -- 1, 2 oppure 3
  turn_number int not null default 1,                -- 1..6 dentro l'Epoca corrente
  turn_order uuid[] not null default '{}',           -- player_id (non user_id) in ordine di seduta attorno al tavolo
  age_decks jsonb not null default '{}'::jsonb,      -- { "1": [cardId,...] } mazzo mescolato/filtrato dell'Epoca, popolato quando l'Epoca inizia
  discard_pile jsonb not null default '[]'::jsonb,
  military_log jsonb not null default '{}'::jsonb,   -- { "1": { playerId: 'win'|'lose'|'tie' } }
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLAYERS: stato PUBBLICO del giocatore (Meraviglia, Citta'
-- costruita, Tesoro, potenza militare) — nel gioco fisico tutto questo
-- e' comunque visibile a chiunque guardi il tavolo.
-- ============================================================
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null,
  nickname text not null,
  seat_index int,                                    -- posizione al tavolo (assegnata all'avvio, definisce i vicini)
  wonder_id text,                                     -- 'alexandria' | 'babylon' | 'ephesos' | 'gizah' | 'halikarnassos' | 'olympia' | 'rhodos'
  wonder_side text,                                   -- 'A' | 'B'
  coins int not null default 3,
  built_cards jsonb not null default '[]'::jsonb,     -- [cardId, ...]
  wonder_stages_built int not null default 0,         -- 0..3
  military_tokens jsonb not null default '[]'::jsonb, -- [{age:1, result:'win'|'lose'|'tie'}]
  ready_this_turn boolean not null default false,     -- gli altri vedono SOLO questo booleano, mai la carta scelta (fase "ho scelto" vs "sto ancora scegliendo")
  turn_applied int not null default 0,                -- ultimo numero di turno (assoluto entro l'Epoca) per cui questo giocatore ha GIA' applicato la propria azione — segnale robusto anti-race per capire quando TUTTI hanno finito, indipendente dai ritardi di realtime (vedi Game.jsx)
  final_score jsonb,
  free_build_used_age int,                            -- ultima Epoca in cui e' stato usato il potere "costruisci gratis dalla mano" (Babilonia lato B, 1 volta/Epoca) — null se mai usato
  last_turn_log jsonb,                                -- riepilogo PUBBLICO dell'ultima azione risolta (turno, azione, carta, acquisti da chi/quanto, monete incassate dai vicini, saldo prima/dopo) — serve sia a verificare che non ci siano malfunzionamenti sia come informazione utile ai giocatori
  is_bot boolean not null default false,              -- true per i giocatori robot: nessuna sessione autenticata propria, "guidati" dal browser di un giocatore umano connesso (vedi RLS sotto e Game.jsx)
  unique (game_id, user_id)
);

-- Impedisce a livello di database che due giocatori della stessa
-- partita scelgano la stessa Meraviglia+lato: se due client scrivono
-- quasi simultaneamente, solo il primo riesce, il secondo riceve un
-- errore di vincolo violato (gestito lato client in chooseWonder,
-- Game.jsx) — protezione robusta contro la race condition, non basata
-- solo su un controllo "ottimistico" lato applicazione.
create unique index if not exists players_unique_wonder_pick on players (game_id, wonder_id, wonder_side) where wonder_id is not null;

-- ============================================================
-- PLAYER_HANDS: stato PRIVATO (mano + azione del turno) piu' lo slot
-- "outgoing" leggibile anche dal vicino destinatario (vedi sopra).
-- ============================================================
create table if not exists player_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  user_id uuid not null,
  hand jsonb not null default '[]'::jsonb,            -- carte in mano ora
  pending_action jsonb,                                -- { cardId, action: 'build'|'wonder'|'discard' } scelta ma non ancora applicata
  outgoing_hand jsonb,                                 -- carte che restano dopo la scelta, destinate al vicino
  outgoing_hand_for uuid,                               -- user_id del vicino destinatario di outgoing_hand
  outgoing_hand_turn int,                                -- numero di turno a cui si riferisce outgoing_hand — chi legge deve verificare che combaci col turno che sta risolvendo, altrimenti scarta come dato vecchio (stessa protezione già usata per payments_out)
  dealt_age int,                                        -- per quale Epoca e' stata distribuita l'attuale "hand" — evita di ridistribuire piu' volte per la stessa Epoca
  payments_out jsonb not null default '{}'::jsonb,     -- { [venditoreUserId]: { amount, turn } } — quanto si deve a un vicino per risorse comprate questo turno (vedi RLS sotto: il venditore puo' leggere solo la propria voce)
  unique (game_id, user_id)
);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table player_hands;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table player_hands enable row level security;

create policy "profiles: lettura per autenticati" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles: insert solo proprio profilo" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update solo proprio profilo" on profiles
  for update using (auth.uid() = id);

create policy "games: lettura pubblica" on games
  for select using (true);
create policy "games: creazione da autenticati" on games
  for insert with check (auth.uid() is not null);
create policy "games: aggiornamento da autenticati" on games
  for update using (auth.uid() is not null);

create policy "players: lettura pubblica" on players
  for select using (true);
create policy "players: un utente crea solo la propria riga" on players
  for insert with check (auth.uid() = user_id);
create policy "players: un utente aggiorna solo la propria riga" on players
  for update using (auth.uid() = user_id);

-- BOT: nessuna sessione propria, quindi auth.uid() = user_id non puo' mai
-- valere per loro. Permesso creare/aggiornare una riga bot SOLO a chi e'
-- GIA' un giocatore (umano) nella STESSA partita — coerente con lo
-- spirito "client fidato" gia' in uso in tutto il progetto: qualunque
-- umano connesso puo' "guidare" i bot della propria stanza.
create policy "players: chiunque nella partita crea un bot" on players
  for insert with check (
    is_bot = true and exists (
      select 1 from players p2 where p2.game_id = players.game_id and p2.user_id = auth.uid()
    )
  );
create policy "players: chiunque nella partita aggiorna un bot" on players
  for update using (
    is_bot = true and exists (
      select 1 from players p2 where p2.game_id = players.game_id and p2.user_id = auth.uid()
    )
  );

-- player_hands: leggibile dal proprietario, oppure da chi e' il
-- destinatario indicato in outgoing_hand_for (il vicino che deve
-- ricevere le carte avanzate), OPPURE se payments_out contiene una
-- voce con la sua user_id come chiave (il vicino a cui e' dovuto un
-- pagamento per risorse vendute questo turno — vedi Game.jsx). Nota:
-- la policy e' comunque per RIGA intera, quindi chi legge per uno di
-- questi motivi vede anche hand/pending_action del proprietario — un
-- limite noto e accettato, coerente con lo spirito "client fidato" di
-- questo progetto (vedi nota di fondo pagina).
-- Scrivibile SEMPRE E SOLO dal proprietario.
create policy "player_hands: lettura proprietario, destinatario o creditore" on player_hands
  for select using (auth.uid() = user_id or auth.uid() = outgoing_hand_for or payments_out ? (auth.uid()::text));
create policy "player_hands: insert solo proprio" on player_hands
  for insert with check (auth.uid() = user_id);
create policy "player_hands: update solo proprio" on player_hands
  for update using (auth.uid() = user_id);

-- BOT: stesso principio delle policy su "players" — la mano di un bot è
-- creabile/leggibile/scrivibile da qualunque umano che sia GIA' un
-- giocatore nella stessa partita di quel bot.
create policy "player_hands: chiunque nella partita gestisce la mano di un bot" on player_hands
  for all using (
    exists (
      select 1 from players bot_p
      join players me_p on me_p.game_id = bot_p.game_id
      where bot_p.id = player_hands.player_id and bot_p.is_bot = true and me_p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from players bot_p
      join players me_p on me_p.game_id = bot_p.game_id
      where bot_p.id = player_hands.player_id and bot_p.is_bot = true and me_p.user_id = auth.uid()
    )
  );

-- ============================================================
-- GRANT: dal 30/05/2026 i nuovi progetti Supabase non espongono piu' le
-- tabelle alla Data API per default senza GRANT espliciti.
-- ============================================================
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.games to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert, update on public.player_hands to authenticated;

-- ============================================================
-- LIMITE NOTO (stesso spirito della nota in fondo allo schema di
-- Harmonies): questo schema si fida che il CLIENT applichi le regole
-- correttamente prima di scrivere (es. non costruire senza pagare, non
-- copiare una mano che non e' la propria). RLS qui protegge SOLO "chi
-- puo' scrivere quale riga", non "la mossa e' legale secondo il
-- regolamento". Per una versione competitiva/anti-cheat servirebbe una
-- Edge Function con service role che valida ogni mossa server-side —
-- fuori dallo scope di questa v1, esattamente come per Harmonies.
-- ============================================================
