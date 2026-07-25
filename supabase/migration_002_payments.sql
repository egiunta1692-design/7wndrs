-- ============================================================
-- MIGRAZIONE: pagamento reale ai vicini per l'acquisto di risorse.
--
-- Esegui QUESTO file nel SQL Editor di Supabase se hai GIA' creato il
-- database con una versione precedente di schema.sql (quel file usa
-- "create table if not exists", quindi da solo non aggiunge colonne
-- nuove a una tabella già esistente — serve questa migrazione).
--
-- Se invece stai creando il database da zero in questo momento, non ti
-- serve: schema.sql aggiornato include già tutto.
-- ============================================================

alter table player_hands
  add column if not exists payments_out jsonb not null default '{}'::jsonb;

drop policy if exists "player_hands: lettura proprietario o destinatario" on player_hands;
drop policy if exists "player_hands: lettura proprietario, destinatario o creditore" on player_hands;

create policy "player_hands: lettura proprietario, destinatario o creditore" on player_hands
  for select using (auth.uid() = user_id or auth.uid() = outgoing_hand_for or payments_out ? (auth.uid()::text));
