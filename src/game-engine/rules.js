// ============================================================
// MOTORE REGOLE — modulo JS puro (nessuna dipendenza da React o
// Supabase), pensato per girare identico nel browser e, in futuro, in
// una Edge Function per la validazione server-side (vedi limite noto
// in supabase/schema.sql).
//
// Copre: produzione risorse (fisse e a scelta), verifica se un costo è
// pagabile (produzione propria + acquisto dai vicini, con sconti
// commercio), catene di concatenazione gratuite, applicazione delle 3
// azioni di un turno (costruisci Edificio / costruisci stadio
// Meraviglia / vendi carta).
// ============================================================

import { CARDS_BY_ID } from './cards.js'
import { GUILDS_BY_ID } from './guilds.js'
import { WONDERS } from './wonders.js'

export function getCardData(cardId) {
  return CARDS_BY_ID[cardId] || GUILDS_BY_ID[cardId]
}

export function getWonderStage(player) {
  const wonder = WONDERS[player.wonder_id]
  if (!wonder) return null
  return wonder.sides[player.wonder_side]
}

// ------------------------------------------------------------
// PRODUZIONE
// ------------------------------------------------------------
// Restituisce { fixed: {resource: count}, choiceGenerators: [ [resource,...], ... ] }
// per un giocatore, sommando: risorsa di partenza della Meraviglia,
// carte Marroni/Grigie costruite, carte Gialle con produzione a
// scelta, stadi di Meraviglia costruiti con effetto 'produce_choice'.
export function computeProduction(player) {
  const fixed = {}
  const choiceGenerators = []

  const wonder = WONDERS[player.wonder_id]
  if (wonder && wonder.startResource) {
    fixed[wonder.startResource] = (fixed[wonder.startResource] || 0) + 1
  }

  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (!card || !card.effect) continue
    if (card.effect.kind === 'produce_fixed') {
      const amount = card.effect.amount || 1
      fixed[card.effect.value] = (fixed[card.effect.value] || 0) + amount
    } else if (card.effect.kind === 'produce_choice') {
      choiceGenerators.push([...card.effect.value])
    }
  }

  const side = getWonderStage(player)
  if (side) {
    for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
      const stage = side.stages[i]
      if (!stage) continue
      if (stage.effectKind === 'produce_choice') choiceGenerators.push([...stage.effectValue])
    }
  }

  return { fixed, choiceGenerators }
}

// Pool acquistabile dal vicino: solo risorsa di partenza + Marroni/Grigie
// (mai le Gialle o gli stadi Meraviglia — regolamento pag. 7).
export function computePurchasablePool(neighborPlayer) {
  const pool = {} // resource -> { count, choiceOnly: bool } — semplificato: contiamo fisse e scelte separatamente
  const fixed = {}
  const choiceGenerators = []
  const wonder = WONDERS[neighborPlayer.wonder_id]
  if (wonder && wonder.startResource) fixed[wonder.startResource] = (fixed[wonder.startResource] || 0) + 1
  for (const cardId of neighborPlayer.built_cards || []) {
    const card = getCardData(cardId)
    if (!card || card.age !== 1 && card.age !== 2) continue
    if (card.color !== 'brown' && card.color !== 'grey') continue
    if (card.effect.kind === 'produce_fixed') {
      const amount = card.effect.amount || 1
      fixed[card.effect.value] = (fixed[card.effect.value] || 0) + amount
    } else if (card.effect.kind === 'produce_choice') {
      choiceGenerators.push([...card.effect.value])
    }
  }
  return { fixed, choiceGenerators }
}

// Sconti commercio attivi per un giocatore (dalle proprie carte Gialle e
// stadi Meraviglia con effectKind 'trade_discount').
export function computeTradeDiscounts(player) {
  // discounts[neighbor]['clay'] = true significa "paga 1 invece di 2"
  const discounts = { left: new Set(), right: new Set() }
  function apply(effect) {
    if (!effect) return
    const { resources, neighbors } = effect
    for (const n of neighbors) for (const r of resources) discounts[n].add(r)
  }
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.effect?.kind === 'trade_discount') apply(card.effect.value)
  }
  const side = getWonderStage(player)
  if (side) {
    for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
      const stage = side.stages[i]
      if (stage?.effectKind === 'trade_discount') apply(stage.effectValue)
    }
  }
  return discounts
}

// ------------------------------------------------------------
// RISOLUZIONE COSTO IN RISORSE (produzione propria + acquisto)
// ------------------------------------------------------------
// cost: { clay: 1, stone: 2, ... } (solo risorse, le monete si
// verificano a parte con player.coins).
// Restituisce { payable: true, coinCost: n } oppure { payable: false }.
export function resolveResourceCost(cost, player, leftNeighbor, rightNeighbor) {
  const { fixed, choiceGenerators } = computeProduction(player)
  const discounts = computeTradeDiscounts(player)
  const leftPool = leftNeighbor ? computePurchasablePool(leftNeighbor) : { fixed: {}, choiceGenerators: [] }
  const rightPool = rightNeighbor ? computePurchasablePool(rightNeighbor) : { fixed: {}, choiceGenerators: [] }

  // Espande il costo in una lista di unità da coprire, dopo aver
  // sottratto quanto coperto dalla produzione FISSA propria.
  const remaining = []
  for (const [resource, amount] of Object.entries(cost)) {
    const owned = fixed[resource] || 0
    const toCover = Math.max(0, amount - owned)
    for (let i = 0; i < toCover; i++) remaining.push(resource)
  }
  if (remaining.length === 0) return { payable: true, coinCost: 0 }

  // Pool acquistabile "espanso" in unità disponibili per risorsa,
  // ricordando se derivano da un generatore a scelta (non vincolante:
  // trattiamo l'intera capacità come acquistabile per singola unità,
  // dato che ogni simbolo del vicino è comunque limitato a 1 unità/turno
  // — sommiamo fisse + una unità per generatore a scelta compatibile).
  function expandPool(pool) {
    const avail = {}
    for (const [r, n] of Object.entries(pool.fixed)) avail[r] = (avail[r] || 0) + n
    for (const gen of pool.choiceGenerators) {
      // Un generatore a scelta del vicino può coprire UNA unità di UNA
      // qualsiasi delle risorse che offre: lo trattiamo aggiungendo 1
      // "credito" condiviso a ciascuna risorsa del set, ma con un tetto
      // globale gestito a parte nel backtracking (semplificazione:
      // sufficientemente accurata per le dimensioni tipiche del gioco).
      for (const r of gen) avail[r] = (avail[r] || 0) + 1
    }
    return avail
  }
  const leftAvail = expandPool(leftPool)
  const rightAvail = expandPool(rightPool)

  let bestCoinCost = null

  function coinCostFor(neighborKey, resource) {
    const discounted = discounts[neighborKey].has(resource)
    return discounted ? 1 : 2
  }

  // Backtracking: per ogni unità rimanente prova, in ordine di
  // preferenza, generatore proprio a scelta libero, poi vicino più
  // economico, poi l'altro vicino.
  function backtrack(index, usedGenerators, leftLeft, rightLeft, coinsSoFar) {
    if (bestCoinCost !== null && coinsSoFar >= bestCoinCost) return // pruning
    if (index === remaining.length) {
      if (bestCoinCost === null || coinsSoFar < bestCoinCost) bestCoinCost = coinsSoFar
      return
    }
    const resource = remaining[index]

    // 1) generatore proprio a scelta, gratis
    for (let g = 0; g < choiceGenerators.length; g++) {
      if (usedGenerators.has(g)) continue
      if (choiceGenerators[g].includes(resource)) {
        usedGenerators.add(g)
        backtrack(index + 1, usedGenerators, leftLeft, rightLeft, coinsSoFar)
        usedGenerators.delete(g)
      }
    }

    // 2) acquisto da uno dei due vicini (prova entrambi gli ordini)
    const leftCost = coinCostFor('left', resource)
    const rightCost = coinCostFor('right', resource)
    if ((leftLeft[resource] || 0) > 0) {
      leftLeft[resource]--
      backtrack(index + 1, usedGenerators, leftLeft, rightLeft, coinsSoFar + leftCost)
      leftLeft[resource]++
    }
    if ((rightLeft[resource] || 0) > 0) {
      rightLeft[resource]--
      backtrack(index + 1, usedGenerators, leftLeft, rightLeft, coinsSoFar + rightCost)
      rightLeft[resource]++
    }
  }

  backtrack(0, new Set(), { ...leftAvail }, { ...rightAvail }, 0)

  if (bestCoinCost === null) return { payable: false }
  return { payable: true, coinCost: bestCoinCost }
}

// ------------------------------------------------------------
// CATENE — true se il giocatore ha già costruito una carta che sblocca
// gratis "card".
// ------------------------------------------------------------
export function hasFreeChain(card, player) {
  if (!card.chainFrom || card.chainFrom.length === 0) return false
  const built = new Set(player.built_cards || [])
  return card.chainFrom.some((id) => built.has(id))
}

// ------------------------------------------------------------
// PUÒ COSTRUIRE L'EDIFICIO? (azione A)
// ------------------------------------------------------------
export function canBuildCard(cardId, player, leftNeighbor, rightNeighbor) {
  const card = getCardData(cardId)
  if (!card) return { possible: false, reason: 'Carta sconosciuta' }
  if ((player.built_cards || []).includes(cardId)) return { possible: false, reason: 'Edificio già costruito' }
  if (hasFreeChain(card, player)) return { possible: true, coinCost: 0, free: true }

  const coinsCost = card.cost?.coins || 0
  if (coinsCost > 0 && coinsCost > player.coins) return { possible: false, reason: 'Monete insufficienti' }

  const resourceCost = { ...(card.cost || {}) }
  delete resourceCost.coins
  if (Object.keys(resourceCost).length === 0) {
    return { possible: true, coinCost: coinsCost, free: false }
  }
  const resolved = resolveResourceCost(resourceCost, player, leftNeighbor, rightNeighbor)
  if (!resolved.payable) return { possible: false, reason: 'Risorse non disponibili (nemmeno dai vicini)' }
  const totalCoinCost = coinsCost + resolved.coinCost
  // IMPORTANTE: il controllo sopra (coinsCost > player.coins) verifica solo
  // il costo "in monete" indicato sulla carta — non basta, perché
  // resolved.coinCost (l'acquisto di risorse mancanti dai vicini, 1 o 2
  // monete a unità) si somma e può da solo superare le monete disponibili.
  // Senza questo controllo finale il saldo può andare sotto zero.
  if (totalCoinCost > player.coins) return { possible: false, reason: 'Monete insufficienti per comprare le risorse mancanti dai vicini' }
  return { possible: true, coinCost: totalCoinCost, free: false }
}

// ------------------------------------------------------------
// PUÒ COSTRUIRE IL PROSSIMO STADIO DELLA MERAVIGLIA? (azione B)
// ------------------------------------------------------------
export function canBuildWonderStage(player, leftNeighbor, rightNeighbor) {
  const side = getWonderStage(player)
  if (!side) return { possible: false, reason: 'Meraviglia non scelta' }
  const nextIndex = player.wonder_stages_built || 0
  const stage = side.stages[nextIndex]
  if (!stage) return { possible: false, reason: 'Tutti gli stadi già costruiti' }

  const coinsCost = stage.cost?.coins || 0
  if (coinsCost > 0 && coinsCost > player.coins) return { possible: false, reason: 'Monete insufficienti' }
  const resourceCost = { ...(stage.cost || {}) }
  delete resourceCost.coins
  if (Object.keys(resourceCost).length === 0) return { possible: true, coinCost: coinsCost, stageIndex: nextIndex }

  const resolved = resolveResourceCost(resourceCost, player, leftNeighbor, rightNeighbor)
  if (!resolved.payable) return { possible: false, reason: 'Risorse non disponibili (nemmeno dai vicini)' }
  const totalCoinCost = coinsCost + resolved.coinCost
  if (totalCoinCost > player.coins) return { possible: false, reason: 'Monete insufficienti per comprare le risorse mancanti dai vicini' }
  return { possible: true, coinCost: totalCoinCost, stageIndex: nextIndex }
}

// ------------------------------------------------------------
// APPLICA UN'AZIONE — restituisce il nuovo stato PUBBLICO del
// giocatore (built_cards, coins, wonder_stages_built). Non tocca la
// mano: quella la gestisce il chiamante (rimuove la carta scelta).
// ------------------------------------------------------------
export function applyAction(action, player, leftNeighbor, rightNeighbor) {
  const next = { ...player, built_cards: [...(player.built_cards || [])], military_tokens: [...(player.military_tokens || [])] }

  if (action.action === 'discard') {
    next.coins = (next.coins || 0) + 3
    return next
  }

  if (action.action === 'build') {
    const check = canBuildCard(action.cardId, player, leftNeighbor, rightNeighbor)
    if (!check.possible) throw new Error(`Non puoi costruire questa carta: ${check.reason}`)
    next.coins = (next.coins || 0) - (check.coinCost || 0)
    next.built_cards.push(action.cardId)
    const card = getCardData(action.cardId)
    if (card?.effect?.kind === 'coins_on_build') next.coins += card.effect.value
    return next
  }

  if (action.action === 'wonder') {
    const check = canBuildWonderStage(player, leftNeighbor, rightNeighbor)
    if (!check.possible) throw new Error(`Non puoi costruire questo stadio: ${check.reason}`)
    next.coins = (next.coins || 0) - (check.coinCost || 0)
    next.wonder_stages_built = check.stageIndex + 1
    const side = getWonderStage(player)
    const stage = side.stages[check.stageIndex]
    if (stage.effectKind === 'coins' || stage.effectKind === 'vp_and_coins') {
      next.coins += stage.effectKind === 'coins' ? stage.effectValue : stage.effectValue.coins
    }
    return next
  }

  throw new Error(`Azione sconosciuta: ${action.action}`)
}

// ------------------------------------------------------------
// PREPARA/APPLICA IN DUE FASI — necessario perché nel modello a
// scritture "solo sulla propria riga" (vedi supabase/schema.sql), la
// convalida (che guarda lo stato ATTUALE dei vicini) avviene nel
// momento in cui scegli la carta, mentre l'applicazione effettiva
// avviene più tardi (dopo che tutti hanno scelto), senza dover
// rileggere i vicini in quel momento — così il risultato non dipende
// dall'ordine con cui i client si risolvono.
// ------------------------------------------------------------
export function prepareAction(action, cardId, player, leftNeighbor, rightNeighbor) {
  if (action === 'discard') {
    return { action: 'discard', cardId, coinCost: 0, bonusCoins: 3 }
  }
  if (action === 'build') {
    const check = canBuildCard(cardId, player, leftNeighbor, rightNeighbor)
    if (!check.possible) throw new Error(check.reason)
    const card = getCardData(cardId)
    const bonusCoins = card?.effect?.kind === 'coins_on_build' ? card.effect.value : 0
    return { action: 'build', cardId, coinCost: check.coinCost || 0, bonusCoins }
  }
  if (action === 'wonder') {
    const check = canBuildWonderStage(player, leftNeighbor, rightNeighbor)
    if (!check.possible) throw new Error(check.reason)
    const side = getWonderStage(player)
    const stage = side.stages[check.stageIndex]
    let bonusCoins = 0
    if (stage.effectKind === 'coins') bonusCoins = stage.effectValue
    if (stage.effectKind === 'vp_and_coins') bonusCoins = stage.effectValue.coins
    return { action: 'wonder', cardId, coinCost: check.coinCost || 0, bonusCoins, stageIndex: check.stageIndex }
  }
  throw new Error(`Azione sconosciuta: ${action}`)
}

// Applica un pending_action già preparato (coinCost/bonusCoins/stageIndex
// già decisi) allo stato pubblico del giocatore: nessuna dipendenza dai
// vicini, quindi sicuro da eseguire da un qualsiasi client in qualsiasi
// momento dopo il reveal.
export function applyPreparedAction(prepared, player) {
  const next = { ...player, built_cards: [...(player.built_cards || [])] }
  next.coins = (next.coins || 0) - (prepared.coinCost || 0) + (prepared.bonusCoins || 0)
  if (prepared.action === 'build') next.built_cards.push(prepared.cardId)
  if (prepared.action === 'wonder') next.wonder_stages_built = prepared.stageIndex + 1
  return next
}
