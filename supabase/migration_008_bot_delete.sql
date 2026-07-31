-- ============================================================
-- MIGRAZIONE: aggiunge la policy mancante per poter RIMUOVERE un bot
-- (esisteva solo insert/update, non delete, quindi la rimozione di un
-- bot dalla sala d'attesa avrebbe fallito silenziosamente).
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima. Se lo crei da zero ora, non serve: schema.sql include
-- già questa policy.
-- ============================================================

create policy "players: chiunque nella partita rimuove un bot" on players
  for delete using (
    is_bot = true and exists (
      select 1 from players p2 where p2.game_id = players.game_id and p2.user_id = auth.uid()
    )
  );
