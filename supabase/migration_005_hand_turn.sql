-- ============================================================
-- MIGRAZIONE: aggiunge un numero di turno esplicito al passaggio mano
-- (outgoing_hand/outgoing_hand_for), la stessa protezione già in uso
-- per i pagamenti (payments_out.turn) — chi legge la mano in arrivo
-- verifica che il turno combaci con quello che sta risolvendo,
-- scartando come "vecchio" qualunque dato non stampigliato per il
-- turno corrente. Corregge un bug osservato in partita: carte che
-- sembravano non ruotare correttamente tra i giocatori.
--
-- Esegui questo file nel SQL Editor di Supabase se il database esiste
-- già da prima. Se lo crei da zero ora, non serve: schema.sql include
-- già questa colonna.
-- ============================================================

alter table player_hands
  add column if not exists outgoing_hand_turn int;
