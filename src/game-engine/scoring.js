// ============================================================
// PUNTEGGIO FINALE — pag. 8 del regolamento, stesso ordine di calcolo:
// 1. Conflitti Militari  2. Tesoro  3. Meraviglia  4. Carte Blu
// 5. Carte Gialle  6. Carte Verdi (scientifiche)  7. Carte Viola (Gilde)
// ============================================================

import { getCardData, getWonderStage } from './rules.js'

function colorCount(player, color) {
  return (player.built_cards || []).filter((id) => getCardData(id)?.color === color).length
}

function neighborsOf(players, index) {
  const n = players.length
  return { left: players[(index - 1 + n) % n], right: players[(index + 1) % n] }
}

// --- 1. Militari ---
function scoreMilitary(player) {
  return (player.military_tokens || []).reduce((sum, t) => sum + (t.value ?? (t.result === 'lose' ? -1 : 0)), 0)
}

// --- 2. Tesoro ---
function scoreTreasury(player) {
  return Math.floor((player.coins || 0) / 3)
}

// --- 3. Meraviglia ---
function scoreWonder(player) {
  const side = getWonderStage(player)
  if (!side) return 0
  let vp = 0
  for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
    const stage = side.stages[i]
    if (!stage) continue
    if (stage.effectKind === 'vp') vp += stage.effectValue
    if (stage.effectKind === 'vp_and_coins') vp += stage.effectValue.vp
  }
  return vp
}

// --- 4. Blu ---
function scoreBlue(player) {
  let vp = 0
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.color === 'blue' && card.effect?.kind === 'vp') vp += card.effect.value
  }
  return vp
}

// --- 5. Gialle ---
function scoreYellow(player) {
  let vp = 0
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.color !== 'yellow' || !card.effect) continue
    if (card.effect.kind === 'per_color_coins_and_vp') {
      const { color, vpEach, includeSelf } = card.effect.value
      let count = colorCount(player, color)
      if (includeSelf && color === 'yellow') count = colorCount(player, 'yellow') // già incluso, colorCount conta anche questa carta
      vp += vpEach * count
    }
    if (card.effect.kind === 'coins_and_vp_per_wonder_stage') {
      vp += card.effect.value.vpEach * (player.wonder_stages_built || 0)
    }
  }
  return vp
}

// --- 6. Verdi (scientifiche) ---
const SYMBOLS = ['compass', 'gear', 'tablet']

function scienceScoreFor(counts) {
  let vp = 0
  for (const s of SYMBOLS) vp += counts[s] * counts[s]
  vp += 7 * Math.min(counts.compass, counts.gear, counts.tablet)
  return vp
}

// Distribuisce k simboli "a scelta libera" (carte Verdi con
// effect.kind 'science_choice', stadi Meraviglia 'science', Gilda
// degli Scienziati) nel modo che massimizza il punteggio finale.
function scoreGreenWithChoices(fixedCounts, freeChoices) {
  let best = -Infinity
  for (let a = 0; a <= freeChoices; a++) {
    for (let b = 0; b <= freeChoices - a; b++) {
      const c = freeChoices - a - b
      const counts = { compass: fixedCounts.compass + a, gear: fixedCounts.gear + b, tablet: fixedCounts.tablet + c }
      best = Math.max(best, scienceScoreFor(counts))
    }
  }
  return best === -Infinity ? scienceScoreFor(fixedCounts) : best
}

function scoreGreen(player, guildFreeChoices) {
  const fixed = { compass: 0, gear: 0, tablet: 0 }
  let freeChoices = guildFreeChoices || 0
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.color !== 'green' || !card.effect) continue
    if (card.effect.kind === 'science') fixed[card.effect.value]++
    if (card.effect.kind === 'science_choice') freeChoices++
  }
  const side = getWonderStage(player)
  if (side) {
    for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
      const stage = side.stages[i]
      if (stage?.effectKind === 'science') freeChoices += stage.effectValue
    }
  }
  return scoreGreenWithChoices(fixed, freeChoices)
}

// --- 7. Viola (Gilde) ---
// Estratta in funzione indipendente perché serve sia per le Gilde
// che il giocatore ha costruito da sé, sia per valutare "quanto
// varrebbe copiare questa Gilda di un vicino" (stadio Meraviglia
// Olympia lato B, effectKind 'copy_guild').
function scoreOneGuildCard(card, player, left, right) {
  switch (card.scoringKind) {
    case 'per_color_in_neighbors': {
      const { color, vpEach } = card.scoringValue
      return vpEach * (colorCount(left, color) + colorCount(right, color))
    }
    case 'per_wonder_stage_self_and_neighbors': {
      const { vpEach } = card.scoringValue
      return vpEach * ((player.wonder_stages_built || 0) + (left.wonder_stages_built || 0) + (right.wonder_stages_built || 0))
    }
    case 'all_wonder_stages_flat': {
      const side = getWonderStage(player)
      const totalStages = side ? side.stages.length : 3
      return (player.wonder_stages_built || 0) >= totalStages ? card.scoringValue.vp : 0
    }
    case 'per_brown_grey_purple_self': {
      const { vpEach } = card.scoringValue
      return vpEach * (colorCount(player, 'brown') + colorCount(player, 'grey') + colorCount(player, 'purple'))
    }
    case 'science_choice':
      return 0 // gestito a parte come freeChoices extra, vedi scientistsGuildBonus
    default:
      return 0
  }
}

function scoreGuilds(player, players, index) {
  let vp = 0
  let scientistsGuildBonus = 0
  const { left, right } = neighborsOf(players, index)
  const ownGuildIds = new Set()
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.color !== 'purple' || !card.scoringKind) continue
    ownGuildIds.add(card.id)
    vp += scoreOneGuildCard(card, player, left, right)
    if (card.scoringKind === 'science_choice') scientistsGuildBonus += 1
  }

  // Stadio Meraviglia "copia una Gilda di un vicino" (Olympia lato B):
  // a fine partita, sceglie la Gilda dei vicini (che non ha già lui
  // stesso) che gli varrebbe di più, e la aggiunge al proprio punteggio.
  const side = getWonderStage(player)
  const hasCopyGuild = side?.stages.some((s, i) => i < (player.wonder_stages_built || 0) && s.effectKind === 'copy_guild')
  if (hasCopyGuild) {
    let bestExtra = 0
    for (const neighbor of [left, right]) {
      for (const cardId of neighbor.built_cards || []) {
        const card = getCardData(cardId)
        if (card?.color !== 'purple' || !card.scoringKind || ownGuildIds.has(card.id)) continue
        const value = scoreOneGuildCard(card, player, left, right)
        if (value > bestExtra) bestExtra = value
      }
    }
    vp += bestExtra
  }

  return { vp, scientistsGuildBonus }
}

// ------------------------------------------------------------
// Calcola il punteggio completo di TUTTI i giocatori (serve avere
// l'intera lista, ordinata per seat_index, per Gilde e Meraviglia dei
// vicini).
// ------------------------------------------------------------
export function scoreGame(players) {
  return players.map((player, index) => {
    const military = scoreMilitary(player)
    const treasury = scoreTreasury(player)
    const wonder = scoreWonder(player)
    const blue = scoreBlue(player)
    const yellow = scoreYellow(player)
    const { vp: purple, scientistsGuildBonus } = scoreGuilds(player, players, index)
    const green = scoreGreen(player, scientistsGuildBonus)
    const total = military + treasury + wonder + blue + yellow + green + purple
    return { playerId: player.id, military, treasury, wonder, blue, yellow, green, purple, total }
  })
}
