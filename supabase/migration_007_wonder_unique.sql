-- ============================================================
-- MIGRAZIONE: impedisce a livello di database che due giocatori della
-- stessa partita scelgano la stessa Meraviglia+lato (race condition
-- possibile se due client scrivono quasi simultaneamente in sala
-- d'attesa).
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima. Se lo crei da zero ora, non serve: schema.sql include
-- già questo indice.
-- ============================================================

create unique index if not exists players_unique_wonder_pick on players (game_id, wonder_id, wonder_side) where wonder_id is not null;
