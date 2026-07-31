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
// preference: 'left' | 'right' | null — se entrambi i vicini possono
// vendere la stessa risorsa allo stesso prezzo, il regolamento lascia
// la scelta al giocatore (pag. 7: "si è liberi di acquistare da
// entrambi... a prescindere"); questo parametro permette di indicare
// quale preferire nei casi ambigui. Se null, decide l'algoritmo (non
// interattivo, usato per i controlli di fattibilità dove non importa).
// Restituisce { payable, coinCost, purchases } dove purchases è la
// lista di { neighbor: 'left'|'right', resource, unitCost } — serve a
// sapere ESATTAMENTE quanto pagare a ciascun vicino (vedi Game.jsx,
// che poi accredita il vicino venditore).
export function resolveResourceCost(cost, player, leftNeighbor, rightNeighbor, preference = null) {
  const { fixed, choiceGenerators } = computeProduction(player)
  const discounts = computeTradeDiscounts(player)
  const leftPool = leftNeighbor ? computePurchasablePool(leftNeighbor) : { fixed: {}, choiceGenerators: [] }
  const rightPool = rightNeighbor ? computePurchasablePool(rightNeighbor) : { fixed: {}, choiceGenerators: [] }

  // Espande il costo in una lista di unità da coprire, dopo aver
  // sottratto quanto coperto dalla produzione FISSA propria (i propri
  // generatori a scelta sono gestiti più sotto nel backtracking, non
  // qui, perché vanno provati in ordine assieme alle altre opzioni).
  const remaining = []
  for (const [resource, amount] of Object.entries(cost)) {
    const owned = fixed[resource] || 0
    const toCover = Math.max(0, amount - owned)
    for (let i = 0; i < toCover; i++) remaining.push(resource)
  }
  if (remaining.length === 0) return { payable: true, coinCost: 0, purchases: [] }

  let bestCoinCost = null
  let bestPurchases = null

  function coinCostFor(neighborKey, resource) {
    const discounted = discounts[neighborKey].has(resource)
    return discounted ? 1 : 2
  }

  // Backtracking: per ogni unità rimanente prova, in ordine di
  // preferenza, generatore proprio a scelta libero, poi il vicino
  // preferito (se indicato e più economico o pari), poi l'altro.
  //
  // IMPORTANTE: i generatori a scelta di un vicino (es. una carta che dà
  // "Legno O Minerale a scelta") vanno trattati come "usa e getta" per
  // SINGOLO generatore, non come disponibilità separata per ciascuna
  // risorsa che potrebbero dare — altrimenti se servisse sia Legno che
  // Minerale nello stesso acquisto, il motore comprerebbe erroneamente
  // entrambi dalla STESSA unica carta del vicino (bug reale trovato e
  // corretto qui: prima venivano "espansi" sommando +1 a ogni risorsa
  // del generatore, permettendo di usarlo due volte). leftLeftFixed/
  // rightLeftFixed tracciano le quantità fisse residue (queste sì
  // sommabili liberamente, non derivano da un singolo generatore
  // condiviso); leftUsedGens/rightUsedGens tracciano quali generatori a
  // scelta del vicino sono già stati "consumati" in questo ramo.
  function backtrack(index, usedGenerators, leftLeftFixed, rightLeftFixed, leftUsedGens, rightUsedGens, coinsSoFar, purchasesSoFar) {
    if (bestCoinCost !== null && coinsSoFar >= bestCoinCost) return // pruning
    if (index === remaining.length) {
      if (bestCoinCost === null || coinsSoFar < bestCoinCost) {
        bestCoinCost = coinsSoFar
        bestPurchases = [...purchasesSoFar]
      }
      return
    }
    const resource = remaining[index]

    // 1) generatore proprio a scelta, gratis
    for (let g = 0; g < choiceGenerators.length; g++) {
      if (usedGenerators.has(g)) continue
      if (choiceGenerators[g].includes(resource)) {
        usedGenerators.add(g)
        backtrack(index + 1, usedGenerators, leftLeftFixed, rightLeftFixed, leftUsedGens, rightUsedGens, coinsSoFar, purchasesSoFar)
        usedGenerators.delete(g)
      }
    }

    // 2) acquisto da uno dei due vicini — se una preferenza è indicata
    // ed entrambi possono vendere, la esploriamo per prima cosicché a
    // parità di costo totale vinca lei (vedi confronto "<" sopra: la
    // prima soluzione trovata a costo minimo è quella che resta).
    const leftCost = coinCostFor('left', resource)
    const rightCost = coinCostFor('right', resource)

    function tryNeighbor(key, pool, leftFixedState, usedGensState, cost, action) {
      // Prima la produzione FISSA del vicino (sommabile liberamente).
      if ((leftFixedState[resource] || 0) > 0) {
        leftFixedState[resource]--
        purchasesSoFar.push({ neighbor: key, resource, unitCost: cost })
        action()
        purchasesSoFar.pop()
        leftFixedState[resource]++
        return
      }
      // Altrimenti un generatore a scelta del vicino NON ANCORA usato
      // che comprenda questa risorsa — un generatore alla volta, mai
      // due risorse diverse dallo stesso.
      for (let g = 0; g < pool.choiceGenerators.length; g++) {
        if (usedGensState.has(g)) continue
        if (!pool.choiceGenerators[g].includes(resource)) continue
        usedGensState.add(g)
        purchasesSoFar.push({ neighbor: key, resource, unitCost: cost })
        action()
        purchasesSoFar.pop()
        usedGensState.delete(g)
      }
    }
    const tryLeft = () =>
      tryNeighbor('left', leftPool, leftLeftFixed, leftUsedGens, leftCost, () =>
        backtrack(index + 1, usedGenerators, leftLeftFixed, rightLeftFixed, leftUsedGens, rightUsedGens, coinsSoFar + leftCost, purchasesSoFar)
      )
    const tryRight = () =>
      tryNeighbor('right', rightPool, rightLeftFixed, rightUsedGens, rightCost, () =>
        backtrack(index + 1, usedGenerators, leftLeftFixed, rightLeftFixed, leftUsedGens, rightUsedGens, coinsSoFar + rightCost, purchasesSoFar)
      )
    if (preference === 'right') {
      tryRight()
      tryLeft()
    } else if (preference === 'left') {
      tryLeft()
      tryRight()
    } else {
      // Indifferente: a parità di costo tra i due vicini, l'ordine in cui
      // si esplora per primo decide chi viene scelto (per via del "<" più
      // sotto, la prima soluzione a costo minimo trovata è quella che
      // resta) — senza questa randomizzazione "indifferente" finiva per
      // significare sempre "preferisci sinistra", non una vera scelta
      // equilibrata. Si tira una moneta per ogni unità ambigua.
      if (Math.random() < 0.5) {
        tryLeft()
        tryRight()
      } else {
        tryRight()
        tryLeft()
      }
    }
  }

  backtrack(0, new Set(), { ...leftPool.fixed }, { ...rightPool.fixed }, new Set(), new Set(), 0, [])

  if (bestCoinCost === null) return { payable: false }
  return { payable: true, coinCost: bestCoinCost, purchases: bestPurchases }
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

// Le 3 abilità di Olympia che rendono GRATIS una costruzione a certe
// condizioni (non concatenazione, non un'azione "bonus" a parte come
// build_from_hand_free/build_from_discard — sono un modificatore
// permanente del costo normale, una volta costruito lo stadio che le
// dà). Serve il contesto della partita (Epoca/turno) perché "prima
// carta dell'Epoca" e "ultima carta dell'Epoca" dipendono da quello.
export function hasWonderFreeBuild(card, player, gameContext) {
  if (!gameContext) return false
  const built = (player.built_cards || []).map((id) => getCardData(id)).filter(Boolean)
  if (hasWonderStageAbility(player, 'build_first_color_free')) {
    if (!built.some((c) => c.color === card.color)) return true
  }
  if (hasWonderStageAbility(player, 'build_first_age_free')) {
    if (!built.some((c) => c.age === gameContext.age)) return true
  }
  if (hasWonderStageAbility(player, 'build_last_age_free') && gameContext.turnNumber === 6) {
    return true
  }
  return false
}

// ------------------------------------------------------------
// PUÒ COSTRUIRE L'EDIFICIO? (azione A)
// ------------------------------------------------------------
export function canBuildCard(cardId, player, leftNeighbor, rightNeighbor, preference = null, gameContext = null) {
  const card = getCardData(cardId)
  if (!card) return { possible: false, reason: 'Carta sconosciuta' }
  if ((player.built_cards || []).includes(cardId)) return { possible: false, reason: 'Edificio già costruito' }
  if (hasFreeChain(card, player)) return { possible: true, coinCost: 0, free: true, purchases: [] }
  if (hasWonderFreeBuild(card, player, gameContext)) return { possible: true, coinCost: 0, free: true, purchases: [] }

  const coinsCost = card.cost?.coins || 0
  if (coinsCost > 0 && coinsCost > player.coins) return { possible: false, reason: 'Monete insufficienti' }

  const resourceCost = { ...(card.cost || {}) }
  delete resourceCost.coins
  if (Object.keys(resourceCost).length === 0) {
    return { possible: true, coinCost: coinsCost, free: false, purchases: [] }
  }
  const resolved = resolveResourceCost(resourceCost, player, leftNeighbor, rightNeighbor, preference)
  if (!resolved.payable) return { possible: false, reason: 'Risorse non disponibili (nemmeno dai vicini)' }
  const totalCoinCost = coinsCost + resolved.coinCost
  // IMPORTANTE: il controllo sopra (coinsCost > player.coins) verifica solo
  // il costo "in monete" indicato sulla carta — non basta, perché
  // resolved.coinCost (l'acquisto di risorse mancanti dai vicini, 1 o 2
  // monete a unità) si somma e può da solo superare le monete disponibili.
  // Senza questo controllo finale il saldo può andare sotto zero.
  if (totalCoinCost > player.coins) return { possible: false, reason: 'Monete insufficienti per comprare le risorse mancanti dai vicini' }
  return { possible: true, coinCost: totalCoinCost, free: false, purchases: resolved.purchases }
}

// ------------------------------------------------------------
// PUÒ COSTRUIRE IL PROSSIMO STADIO DELLA MERAVIGLIA? (azione B)
// ------------------------------------------------------------
export function canBuildWonderStage(player, leftNeighbor, rightNeighbor, preference = null) {
  const side = getWonderStage(player)
  if (!side) return { possible: false, reason: 'Meraviglia non scelta' }
  const nextIndex = player.wonder_stages_built || 0
  const stage = side.stages[nextIndex]
  if (!stage) return { possible: false, reason: 'Tutti gli stadi già costruiti' }

  const coinsCost = stage.cost?.coins || 0
  if (coinsCost > 0 && coinsCost > player.coins) return { possible: false, reason: 'Monete insufficienti' }
  const resourceCost = { ...(stage.cost || {}) }
  delete resourceCost.coins
  if (Object.keys(resourceCost).length === 0) return { possible: true, coinCost: coinsCost, stageIndex: nextIndex, purchases: [] }

  const resolved = resolveResourceCost(resourceCost, player, leftNeighbor, rightNeighbor, preference)
  if (!resolved.payable) return { possible: false, reason: 'Risorse non disponibili (nemmeno dai vicini)' }
  const totalCoinCost = coinsCost + resolved.coinCost
  if (totalCoinCost > player.coins) return { possible: false, reason: 'Monete insufficienti per comprare le risorse mancanti dai vicini' }
  return { possible: true, coinCost: totalCoinCost, stageIndex: nextIndex, purchases: resolved.purchases }
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
// Conta le carte di un colore già costruite (usato per le monete
// immediate/PV di Vigneto, Bazar, Faro, Porto, Camera di Commercio,
// Palestra Gladiatoria).
function colorCountBuilt(player, color) {
  return (player.built_cards || []).filter((id) => getCardData(id)?.color === color).length
}

// Monete guadagnate IMMEDIATAMENTE alla costruzione — SOLO la parte "a
// valore fisso" (coins_on_build, es. Taverna), che non dipende da nessun
// conteggio quindi è sicura da calcolare subito al momento della scelta.
// Le varianti "per ogni carta di un colore" (Vigneto/Bazar/Faro/ecc.) e
// "per ogni stadio Meraviglia" (Arena) sono state spostate in
// computeColorCountingBonus, calcolata DOPO che il turno si risolve —
// vedi lì per il perché.
function computeImmediateBuildCoins(card) {
  const e = card?.effect
  if (!e) return 0
  if (e.kind === 'coins_on_build') return e.value
  return 0
}

// Monete guadagnate alla costruzione di carte come Vigneto/Bazar (contano
// le carte di un colore nella propria città E in quella dei vicini),
// Faro/Porto/Camera di Commercio/Palestra Gladiatoria (solo la propria
// città) e Arena (per ogni stadio Meraviglia). Per regolamento, le carte
// si giocano tutte simultaneamente ogni turno: il conteggio deve quindi
// includere ANCHE le carte che i vicini stanno costruendo nello STESSO
// turno, non solo quelle già presenti da prima — motivo per cui questa
// funzione va chiamata DOPO che il turno di questo giocatore (e quindi
// idealmente anche quello dei vicini) è stato risolto, con lo stato più
// aggiornato possibile di ciascuno, invece che al momento della scelta.
//
// updatedPlayer: lo stato di QUESTO giocatore già DOPO l'azione di
// questo turno (built_cards/wonder_stages_built già aggiornati).
// leftNeighbor/rightNeighbor: stato attuale dei vicini.
// leftBuiltThisTurn/rightBuiltThisTurn: id delle carte che i vicini
// stanno costruendo in QUESTO STESSO turno (dalla loro pending_action),
// da sommare al loro conteggio anche se non ancora scritte nel database.
export function computeColorCountingBonus(card, updatedPlayer, leftNeighbor, rightNeighbor, leftBuiltThisTurn = [], rightBuiltThisTurn = []) {
  const e = card?.effect
  if (!e) return 0
  function neighborColorCount(neighbor, color, builtThisTurn) {
    if (!neighbor) return 0
    let count = colorCountBuilt(neighbor, color)
    for (const id of builtThisTurn) {
      if (getCardData(id)?.color === color) count += 1
    }
    return count
  }
  if (e.kind === 'coins_per_color') {
    const { color, coinsEach, scope } = e.value
    let count = colorCountBuilt(updatedPlayer, color) // include già la carta appena costruita da questo giocatore
    if (scope === 'self_and_neighbors') {
      count += neighborColorCount(leftNeighbor, color, leftBuiltThisTurn)
      count += neighborColorCount(rightNeighbor, color, rightBuiltThisTurn)
    }
    return coinsEach * count
  }
  if (e.kind === 'per_color_coins_and_vp') {
    const { color, coinsEach } = e.value
    const count = colorCountBuilt(updatedPlayer, color) // include già la carta stessa se dello stesso colore (includeSelf)
    return coinsEach * count
  }
  if (e.kind === 'coins_and_vp_per_wonder_stage') {
    return e.value.coinsEach * (updatedPlayer.wonder_stages_built || 0)
  }
  return 0
}

export function prepareAction(action, cardId, player, leftNeighbor, rightNeighbor, preference = null, gameContext = null) {
  if (action === 'discard') {
    return { action: 'discard', cardId, coinCost: 0, bonusCoins: 3, purchases: [] }
  }
  if (action === 'build') {
    const check = canBuildCard(cardId, player, leftNeighbor, rightNeighbor, preference, gameContext)
    if (!check.possible) throw new Error(check.reason)
    const card = getCardData(cardId)
    const bonusCoins = computeImmediateBuildCoins(card)
    return { action: 'build', cardId, coinCost: check.coinCost || 0, bonusCoins, purchases: check.purchases || [] }
  }
  if (action === 'wonder') {
    const check = canBuildWonderStage(player, leftNeighbor, rightNeighbor, preference)
    if (!check.possible) throw new Error(check.reason)
    const side = getWonderStage(player)
    const stage = side.stages[check.stageIndex]
    let bonusCoins = 0
    if (stage.effectKind === 'coins') bonusCoins = stage.effectValue
    if (stage.effectKind === 'vp_and_coins') bonusCoins = stage.effectValue.coins
    return { action: 'wonder', cardId, coinCost: check.coinCost || 0, bonusCoins, stageIndex: check.stageIndex, purchases: check.purchases || [] }
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

// Applica un pending_action che può essere singolo (come sopra) OPPURE
// un "bundle" di due azioni (vedi prepareLastTurnBundle) — usata sempre
// al posto di applyPreparedAction nella risoluzione del turno, così
// gestisce entrambi i casi in modo trasparente.
export function applyPreparedActionOrBundle(prepared, player) {
  if (prepared?.bundle) {
    const afterPrimary = applyPreparedAction(prepared.primary, player)
    return applyPreparedAction(prepared.bonus, afterPrimary)
  }
  return applyPreparedAction(prepared, player)
}

// true se il giocatore ha già costruito uno stadio Meraviglia con
// questo effectKind (es. 'play_last_card', 'build_from_hand_free').
export function hasWonderStageAbility(player, effectKind) {
  const side = getWonderStage(player)
  if (!side) return false
  return side.stages.some((s, i) => i < (player.wonder_stages_built || 0) && s.effectKind === effectKind)
}

// Prepara IN UN COLPO SOLO la carta "principale" del turno 6 più quella
// "bonus" resa giocabile da Babilonia lato B ("puoi giocare l'ultima carta
// di ogni Epoca invece di scartarla"). Il regolamento la considera "un
// nuovo turno": qui infatti si valuta il bonus sullo stato ottenuto
// DOPO aver applicato la carta principale (la produzione si "ricarica").
export function prepareLastTurnBundle(primaryAction, primaryCardId, bonusAction, bonusCardId, player, leftNeighbor, rightNeighbor, preference, gameContext = null) {
  const primary = prepareAction(primaryAction, primaryCardId, player, leftNeighbor, rightNeighbor, preference, gameContext)
  const afterPrimary = applyPreparedAction(primary, player)
  const bonus = prepareAction(bonusAction, bonusCardId, afterPrimary, leftNeighbor, rightNeighbor, preference, gameContext)
  return { bundle: true, kind: 'last_card', primary, bonus }
}

// Costruisce una carta ignorando completamente il suo costo (potere
// "costruisci gratis dalla mano") — al momento nessuna Meraviglia lo usa nei
// dati attuali, ma la meccanica resta pronta se dovesse servire — resta comunque
// vietato costruire due copie dello stesso edificio, e gli eventuali
// effetti "monete subito" della carta si applicano normalmente.
export function prepareFreeBuild(cardId, player, leftNeighbor, rightNeighbor) {
  const card = getCardData(cardId)
  if (!card) throw new Error('Carta sconosciuta')
  if ((player.built_cards || []).includes(cardId)) throw new Error('Edificio già costruito')
  const bonusCoins = computeImmediateBuildCoins(card)
  return { action: 'build', cardId, coinCost: 0, bonusCoins, purchases: [] }
}

// Come prepareLastTurnBundle, ma per il potere di Babilonia: la carta
// "bonus" è sempre gratuita (nessun controllo di costo/risorse), a
// differenza di Olympia dove la carta bonus segue le regole normali.
export function prepareFreeBuildBundle(primaryAction, primaryCardId, freeBuildCardId, player, leftNeighbor, rightNeighbor, preference, gameContext = null) {
  const primary = prepareAction(primaryAction, primaryCardId, player, leftNeighbor, rightNeighbor, preference, gameContext)
  const afterPrimary = applyPreparedAction(primary, player)
  const bonus = prepareFreeBuild(freeBuildCardId, afterPrimary, leftNeighbor, rightNeighbor)
  return { bundle: true, kind: 'free_build', primary, bonus }
}

// Come prepareLastTurnBundle, ma per il potere di Halikarnassós: la
// carta "bonus" non viene dalla mano ma dalla pila degli scarti
// condivisa, ed è sempre gratuita (nessun controllo di costo/risorse).
export function prepareDiscardBuildBundle(primaryAction, primaryCardId, discardCardId, player, leftNeighbor, rightNeighbor, preference, gameContext = null) {
  const primary = prepareAction(primaryAction, primaryCardId, player, leftNeighbor, rightNeighbor, preference, gameContext)
  const afterPrimary = applyPreparedAction(primary, player)
  const bonus = prepareFreeBuild(discardCardId, afterPrimary, leftNeighbor, rightNeighbor)
  return { bundle: true, kind: 'discard_build', primary, bonus, discardCardId }
}
