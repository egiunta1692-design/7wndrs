// ============================================================
// SETUP E UTILITÀ DI TURNO — modulo JS puro.
//
// IMPORTANTE (vedi supabase/schema.sql): per evitare scritture
// cross-utente, il mazzo di ogni Epoca viene mescolato UNA VOLTA e
// salvato per intero (pubblico) in games.age_decks; ogni client si
// calcola la PROPRIA porzione in base al proprio seat_index — nessuno
// scrive la mano di un altro giocatore.
// ============================================================

import { CARDS } from './cards.js'
import { GUILDS } from './guilds.js'

export const HAND_SIZE = 7

export function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Mazzo mescolato e filtrato per un'Epoca, pronto per essere tagliato
// a fette da HAND_SIZE per ogni seat_index. Per l'Epoca III, aggiunge
// il pool di Gilde (numero giocatori + 2, scelte a caso tra le 10).
export function buildAgeDeck(age, numPlayers) {
  const base = CARDS.filter((c) => c.age === age && c.minPlayers <= numPlayers).map((c) => c.id)
  let deck = shuffle(base)
  if (age === 3) {
    const guildIds = GUILDS.filter((g) => g.minPlayers <= numPlayers).map((g) => g.id)
    const chosenGuilds = shuffle(guildIds).slice(0, numPlayers + 2)
    deck = shuffle([...deck, ...chosenGuilds])
  }
  return deck
}

// La porzione di mazzo che spetta al seggio `seatIndex` a inizio Epoca.
export function dealHandForSeat(deck, seatIndex) {
  return deck.slice(seatIndex * HAND_SIZE, seatIndex * HAND_SIZE + HAND_SIZE)
}

export function leftNeighborSeat(seat, numPlayers) {
  return (seat - 1 + numPlayers) % numPlayers
}
export function rightNeighborSeat(seat, numPlayers) {
  return (seat + 1) % numPlayers
}

// Epoca I e III: le carte passano al vicino di sinistra (chi le riceve
// è quindi il vicino di sinistra). Epoca II: al vicino di destra.
// Restituisce il seat_index di chi RICEVE le carte che non hai scelto.
export function passRecipientSeat(age, seat, numPlayers) {
  return age === 2 ? rightNeighborSeat(seat, numPlayers) : leftNeighborSeat(seat, numPlayers)
}

export function createEmptyPublicPlayerState() {
  return {
    coins: 3,
    built_cards: [],
    wonder_stages_built: 0,
    military_tokens: [],
    ready_this_turn: false
  }
}

export * from './rules.js'
export * from './military.js'
export * from './scoring.js'
export * from './bot.js'
export { CARDS, CARDS_BY_ID } from './cards.js'
export { GUILDS, GUILDS_BY_ID } from './guilds.js'
export { WONDERS, WONDER_IDS, RAW_RESOURCES, RARE_RESOURCES } from './wonders.js'
