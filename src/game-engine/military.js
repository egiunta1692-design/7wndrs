// ============================================================
// CONFLITTI MILITARI — pag. 5 del regolamento. Calcolo puro, nessuna
// scrittura: chi chiama decide come persistere il risultato.
// ============================================================

import { getCardData, getWonderStage } from './rules.js'

export function computeMilitaryStrength(player) {
  let strength = 0
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.effect?.kind === 'shields') strength += card.effect.value
  }
  const side = getWonderStage(player)
  if (side) {
    for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
      const stage = side.stages[i]
      if (stage?.effectKind === 'military') strength += stage.effectValue
      if (stage?.extraMilitary) strength += stage.extraMilitary
    }
  }
  return strength
}

const AGE_TOKEN_VALUE = { 1: 1, 2: 3, 3: 5 }

// players: array ordinato per seat_index (posizione al tavolo).
// Restituisce { [playerId]: { result: 'win'|'lose'|'tie', vsLeft, vsRight } }
// e aggiorna (fuori da questa funzione) military_tokens dei giocatori.
export function resolveMilitaryConflict(players, age) {
  const n = players.length
  const strengths = players.map(computeMilitaryStrength)
  const results = {}
  for (let i = 0; i < n; i++) {
    const left = strengths[(i - 1 + n) % n]
    const right = strengths[(i + 1) % n]
    const tokens = []
    if (strengths[i] > left) tokens.push({ age, result: 'win', value: AGE_TOKEN_VALUE[age] })
    else if (strengths[i] < left) tokens.push({ age, result: 'lose', value: -1 })
    if (strengths[i] > right) tokens.push({ age, result: 'win', value: AGE_TOKEN_VALUE[age] })
    else if (strengths[i] < right) tokens.push({ age, result: 'lose', value: -1 })
    results[players[i].id] = tokens
  }
  return results
}
