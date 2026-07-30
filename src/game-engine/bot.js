// ============================================================
// LOGICA BOT — strategia "rush Meraviglia": completa gli stadi il
// prima possibile, e quando non può, gioca in modo da rendersi lo
// stadio successivo raggiungibile prima.
//
// Funzione pura (stesso spirito del resto del motore): riceve stato,
// restituisce la decisione, non tocca mai il database — chi la chiama
// (Game.jsx) si occupa di eseguirla con le stesse identiche funzioni
// (prepareAction ecc.) già usate per i giocatori umani.
// ============================================================

import { canBuildCard, canBuildWonderStage, getCardData } from './rules.js'

// Quanto una carta è "utile da tenere" per l'economia futura: più alto
// è, meno il bot vuole sacrificarla (per uno stadio Meraviglia o per
// scartarla) — e viceversa, più alto è più il bot preferisce costruirla
// quando non può ancora permettersi lo stadio successivo.
function economicValue(cardId) {
  const card = getCardData(cardId)
  if (!card) return 0
  if (card.color === 'brown' || card.color === 'grey') return 3 // produzione risorse grezze/rare
  if (card.color === 'yellow') return 2 // sconti commercio, monete
  if (card.color === 'green') return 1 // scienza (utile ma non per il rush diretto)
  return 0 // blu (solo PV), rosso (militare), viola (gilde) — poco utili per rushare gli stadi
}

// Sceglie quale carta della mano sacrificare (per uno stadio Meraviglia
// o per uno scarto): quella economicamente meno utile.
function pickSacrificeCard(hand) {
  return [...hand].sort((a, b) => economicValue(a) - economicValue(b))[0]
}

// Decide l'azione del bot per il turno corrente. Restituisce sempre
// { cardId, action, preference: null } — mai bundle (i poteri speciali
// combinati restano solo per i giocatori umani in questa prima
// versione, per tenere la logica semplice).
export function decideBotAction(hand, player, leftNeighbor, rightNeighbor, gameContext) {
  if (!hand || hand.length === 0) return null

  // Priorità 1: posso costruire subito il prossimo stadio Meraviglia?
  // Qualunque carta va bene come "carburante" — sacrifico quella che mi
  // serve meno.
  const wonderCheck = canBuildWonderStage(player, leftNeighbor, rightNeighbor)
  if (wonderCheck.possible) {
    return { cardId: pickSacrificeCard(hand), action: 'wonder', preference: null }
  }

  // Priorità 2: tra le carte costruibili ora, preferisco quelle che mi
  // aiutano di più a raggiungere prima il prossimo stadio (produzione
  // risorse, sconti commercio) — scelgo la più "utile" tra quelle
  // davvero costruibili.
  let bestCardId = null
  let bestScore = -1
  for (const cardId of hand) {
    const check = canBuildCard(cardId, player, leftNeighbor, rightNeighbor, null, gameContext)
    if (!check.possible) continue
    const score = economicValue(cardId)
    if (score > bestScore) {
      bestScore = score
      bestCardId = cardId
    }
  }
  if (bestCardId) {
    return { cardId: bestCardId, action: 'build', preference: null }
  }

  // Altrimenti: scarta la carta meno utile, per accumulare monete in
  // vista del prossimo acquisto dai vicini.
  return { cardId: pickSacrificeCard(hand), action: 'discard', preference: null }
}

// Sceglie una Meraviglia (lato incluso) a caso tra quelle ancora
// disponibili, per l'assegnazione automatica di un bot in sala d'attesa.
export function pickRandomWonder(availableWonderIds) {
  if (availableWonderIds.length === 0) return null
  const wonderId = availableWonderIds[Math.floor(Math.random() * availableWonderIds.length)]
  const side = Math.random() < 0.5 ? 'A' : 'B'
  return { wonderId, side }
}
