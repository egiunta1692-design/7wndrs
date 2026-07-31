-- ============================================================
-- MIGRAZIONE: sistema "creatore della stanza".
--
-- - Aggiunge games.created_by (chi ha creato la stanza).
-- - Il creatore: non può abbandonare la stanza, ma può eliminarla
--   interamente; è l'unico che può aggiungere/rimuovere/pilotare i bot.
-- - Gli altri giocatori: possono abbandonare la stanza, ma non
--   eliminarla né gestire i bot.
-- - Tutto questo vale SOLO prima che la partita inizi (status='waiting').
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima del 31/07. Se lo crei da zero ora, non serve: schema.sql
-- include già tutto questo.
-- ============================================================

alter table games add column if not exists created_by uuid;

-- Sostituisce le vecchie policy bot "chiunque nella partita" con quelle
-- nuove "solo il creatore" — vanno eliminate esplicitamente per nome
-- prima di ricrearle, altrimenti resterebbero entrambe attive insieme
-- (permissive, quindi la vecchia continuerebbe a permettere a chiunque).
drop policy if exists "players: chiunque nella partita crea un bot" on players;
drop policy if exists "players: chiunque nella partita aggiorna un bot" on players;
drop policy if exists "players: chiunque nella partita rimuove un bot" on players;
drop policy if exists "player_hands: chiunque nella partita gestisce la mano di un bot" on player_hands;

create policy "games: il creatore elimina la stanza prima dell'avvio" on games
  for delete using (created_by = auth.uid() and status = 'waiting');

create policy "players: un non-creatore abbandona la stanza prima dell'avvio" on players
  for delete using (
    auth.uid() = user_id and exists (
      select 1 from games g where g.id = players.game_id and g.status = 'waiting' and g.created_by <> auth.uid()
    )
  );

create policy "players: solo il creatore crea un bot" on players
  for insert with check (
    is_bot = true and exists (
      select 1 from games g where g.id = players.game_id and g.created_by = auth.uid()
    )
  );
create policy "players: solo il creatore aggiorna un bot" on players
  for update using (
    is_bot = true and exists (
      select 1 from games g where g.id = players.game_id and g.created_by = auth.uid()
    )
  );
create policy "players: solo il creatore rimuove un bot" on players
  for delete using (
    is_bot = true and exists (
      select 1 from games g where g.id = players.game_id and g.created_by = auth.uid()
    )
  );

create policy "player_hands: solo il creatore gestisce la mano di un bot" on player_hands
  for all using (
    exists (
      select 1 from players bot_p
      join games g on g.id = bot_p.game_id
      where bot_p.id = player_hands.player_id and bot_p.is_bot = true and g.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from players bot_p
      join games g on g.id = bot_p.game_id
      where bot_p.id = player_hands.player_id and bot_p.is_bot = true and g.created_by = auth.uid()
    )
  );

-- NOTA: le partite create PRIMA di questa migrazione hanno created_by
-- NULL — nessuno risulterà "creatore" per quelle stanze già esistenti
-- (i controlli lato client in Game.jsx gestiscono created_by mancante
-- mostrando comunque l'interfaccia normale, senza pulsanti creatore-only
-- né limitazioni di abbandono, per non bloccare partite già in corso).
