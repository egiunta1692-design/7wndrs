-- ============================================================
-- MIGRAZIONE: introduce i giocatori "robot" — nessuna sessione propria,
-- guidati dal browser di un qualunque giocatore umano connesso nella
-- stessa partita (vedi Game.jsx e Lobby.jsx).
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima. Se lo crei da zero ora, non serve: schema.sql include
-- già tutto questo.
-- ============================================================

alter table players
  add column if not exists is_bot boolean not null default false;

drop policy if exists "players: chiunque nella partita crea un bot" on players;
create policy "players: chiunque nella partita crea un bot" on players
  for insert with check (
    is_bot = true and exists (
      select 1 from players p2 where p2.game_id = players.game_id and p2.user_id = auth.uid()
    )
  );

drop policy if exists "players: chiunque nella partita aggiorna un bot" on players;
create policy "players: chiunque nella partita aggiorna un bot" on players
  for update using (
    is_bot = true and exists (
      select 1 from players p2 where p2.game_id = players.game_id and p2.user_id = auth.uid()
    )
  );

drop policy if exists "player_hands: chiunque nella partita gestisce la mano di un bot" on player_hands;
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
