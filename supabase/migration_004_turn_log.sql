-- ============================================================
-- MIGRAZIONE: riepilogo pubblico dell'ultimo turno risolto per ogni
-- giocatore (cosa ha giocato, cosa ha comprato da chi e a che prezzo,
-- quanto ha incassato dai vicini, saldo prima/dopo) — utile sia per
-- verificare che il commercio funzioni correttamente sia come
-- informazione trasparente per gli altri giocatori.
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima. Se lo crei da zero ora, non serve: schema.sql include
-- già questa colonna.
-- ============================================================

alter table players
  add column if not exists last_turn_log jsonb;
