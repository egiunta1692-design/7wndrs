-- ============================================================
-- MIGRAZIONE: traccia l'uso del potere "costruisci gratis dalla mano"
-- di Babilonia lato B (1 volta per Epoca).
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima del 27/07. Se lo crei da zero ora, non serve: schema.sql
-- include già questa colonna.
-- ============================================================

alter table players
  add column if not exists free_build_used_age int;
