import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import {
  WONDER_IDS,
  WONDERS,
  buildAgeDeck,
  HAND_SIZE,
  dealHandForSeat,
  leftNeighborSeat,
  rightNeighborSeat,
  passRecipientSeat,
  prepareAction,
  prepareLastTurnBundle,
  prepareFreeBuildBundle,
  prepareDiscardBuildBundle,
  applyPreparedActionOrBundle,
  hasWonderStageAbility,
  resolveMilitaryConflict,
  computeMilitaryStrength,
  computeProduction,
  computeTradeDiscounts,
  scoreGame,
  getCardData
} from '../game-engine'
import Loader from '../components/Loader'
import { page, cardWide, title, primaryButton, secondaryButton, pillButton, errorText, linkText } from '../styles/theme'

const COLOR_LABEL = { brown: '🟤', grey: '⚪', blue: '🔵', yellow: '🟡', red: '🔴', green: '🟢', purple: '🟣' }
const RESOURCE_ICON = { clay: '🧱', stone: '🪨', ore: '⛏️', wood: '🪵', glass: '🔷', loom: '🧵', papyrus: '📜' }
const RESOURCE_NAME = { clay: 'Argilla', stone: 'Pietra', ore: 'Minerale', wood: 'Legno', glass: 'Vetro', loom: 'Tessuto', papyrus: 'Papiro' }
const AGE_ROMAN = { 1: 'Ⅰ', 2: 'Ⅱ', 3: 'Ⅲ' }
const STAGE_EMOJI = { 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣' }
const SCIENCE_ICON = { compass: '🧭', gear: '⚙️', tablet: '📝' }
const COLOR_NAME = { brown: 'Marrone', grey: 'Grigia', blue: 'Blu', yellow: 'Gialla', red: 'Rossa', green: 'Verde', purple: 'Viola' }

function wonderStartResourceLabel(wonderId) {
  const r = WONDERS[wonderId]?.startResource
  if (!r) return ''
  return `${RESOURCE_ICON[r]} ${RESOURCE_NAME[r]}`
}

// Simbolo specifico per ogni "famiglia" di concatenazione (invece del
// generico 🔗/🔓), per riconoscere a colpo d'occhio quale catena
// collega quali carte — come le icone sulle carte fisiche.
const CHAIN_SYMBOL = {
  pozzo: '🗿',
  statua: '🗿',
  bagni: '💧',
  acquedotto: '💧',
  altare: '🛕',
  tempio: '🛕',
  pantheon: '🛕',
  teatro: '🎭',
  giardini: '🎭',
  mercato: '🐪',
  caravanserraglio: '🐪',
  'stazione-ovest': '🏺',
  'stazione-est': '🏺',
  foro: '🏺',
  farmacia: '💊',
  ambulatorio: '💊',
  loggia: '💊',
  opificio: '🛠️',
  laboratorio: '🛠️',
  osservatorio: '🛠️',
  tribunale: '⚖️',
  senato: '⚖️',
  biblioteca: '📖',
  universita: '📖',
  scuola: '🎓',
  accademia: '🎓',
  caserma: '🐎',
  scuderie: '🐎',
  'torre-guardia': '🎯',
  'zona-addestramento': '🎯',
  fortificazioni: '🎯',
  circo: '🎯',
  mura: '🏰',
  castra: '🏰',
  'poligono-tiro': '🏹',
  'opificio-assedio': '🏹'
}

// Etichetta dei simboli di concatenazione di una carta: "gratis se hai
// già costruito X" (chainFrom) e, informativamente, "sblocca gratis Y"
// (chainTo) — quest'ultimo non è usato dal motore per le regole (che
// legge solo chainFrom sulla carta di destinazione) ma aiuta a vedere
// subito cosa conviene costruire prima. Ogni "famiglia" di catena ha
// il proprio simbolo (vedi CHAIN_SYMBOL); se una carta non è mappata
// (dato incompleto) si usa un fallback generico.
function chainLabel(card) {
  const parts = []
  if (card.chainFrom?.length) {
    const symbol = CHAIN_SYMBOL[card.id] || '🔗'
    const names = card.chainFrom.map((id) => getCardData(id)?.name || id).join(' o ')
    parts.push(`${symbol} Gratis se hai: ${names}`)
  }
  if (card.chainTo?.length) {
    const labels = card.chainTo.map((id) => `${CHAIN_SYMBOL[id] || '🔓'} ${getCardData(id)?.name || id}`).join(', ')
    parts.push(`Sblocca gratis: ${labels}`)
  }
  return parts
}

// Riassume gli sconti commercio attivi di un giocatore (carte Gialle
// tipo Mercato/Stazioni + stadi Meraviglia) in forma compatta per la
// vista collassata: ◄ = dal vicino sinistro, ► = dal destro, ↔ = da
// entrambi se le risorse scontate coincidono.
function tradeDiscountSummary(player) {
  const d = computeTradeDiscounts(player)
  const leftIcons = [...d.left].map((r) => RESOURCE_ICON[r]).join('')
  const rightIcons = [...d.right].map((r) => RESOURCE_ICON[r]).join('')
  if (!leftIcons && !rightIcons) return null
  if (leftIcons && rightIcons && leftIcons === rightIcons) return `↔️${leftIcons}`
  const parts = []
  if (leftIcons) parts.push(`◄${leftIcons}`)
  if (rightIcons) parts.push(`►${rightIcons}`)
  return parts.join(' ')
}

// Conta i simboli scientifici fissi accumulati (carte Verdi + stadi
// Meraviglia) e quanti "a scelta libera" restano da assegnare (Gilda
// degli Scienziati esclusa: quella si applica solo nel punteggio
// finale, qui interessa la produzione/collezione in corso).
function computeScienceSymbols(player) {
  const fixed = { compass: 0, gear: 0, tablet: 0 }
  let choices = 0
  for (const cardId of player.built_cards || []) {
    const card = getCardData(cardId)
    if (card?.color !== 'green' || !card.effect) continue
    if (card.effect.kind === 'science') fixed[card.effect.value]++
    if (card.effect.kind === 'science_choice') choices++
  }
  const side = WONDERS[player.wonder_id]?.sides[player.wonder_side]
  if (side) {
    for (let i = 0; i < (player.wonder_stages_built || 0); i++) {
      if (side.stages[i]?.effectKind === 'science') choices += side.stages[i].effectValue
    }
  }
  return { fixed, choices }
}

function formatElapsed(ms) {
  if (ms == null || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function costLabel(cost = {}) {
  const parts = []
  if (cost.coins) parts.push(`${cost.coins}🪙`)
  for (const [r, n] of Object.entries(cost)) {
    if (r === 'coins') continue
    parts.push(`${n}${RESOURCE_ICON[r] || r}`)
  }
  return parts.length ? parts.join(' ') : 'Gratis'
}

// Descrizione leggibile dell'effetto di una carta Epoca (usata sia
// nelle carte in mano che nei "chip" delle città costruite).
function cardEffectLabel(card) {
  const e = card.effect
  if (!e) return ''
  switch (e.kind) {
    case 'produce_fixed':
      return `+${e.amount || 1}${RESOURCE_ICON[e.value] || e.value}`
    case 'produce_choice':
      return `+1 a scelta: ${e.value.map((r) => RESOURCE_ICON[r]).join(' ')}`
    case 'vp':
      return `+${e.value}🏆`
    case 'coins_on_build':
      return `+${e.value}🪙`
    case 'shields':
      return `+${e.value}⚔️`
    case 'science':
      return `Simbolo scientifico: ${SCIENCE_ICON[e.value] || e.value}`
    case 'trade_discount': {
      const who = e.value.neighbors.map((n) => (n === 'left' ? 'sinistro' : 'destro')).join('/')
      return `Sconto commercio (1 invece di 2) dal vicino ${who}: ${e.value.resources.map((r) => RESOURCE_ICON[r]).join(' ')}`
    }
    case 'coins_per_color': {
      const { color, coinsEach, scope } = e.value
      return `+${coinsEach}🪙 per ogni carta ${COLOR_LABEL[color]} ${COLOR_NAME[color]} ${scope === 'self_and_neighbors' ? '(tua città + vicini)' : '(tua città)'}`
    }
    case 'per_color_coins_and_vp': {
      const { color, coinsEach, vpEach } = e.value
      return `+${coinsEach}🪙 alla costruzione e +${vpEach}🏆 a fine partita, per ogni carta ${COLOR_LABEL[color]} ${COLOR_NAME[color]} in città`
    }
    case 'coins_and_vp_per_wonder_stage':
      return `+${e.value.coinsEach}🪙 e +${e.value.vpEach}🏆 per ogni stadio della tua Meraviglia`
    case 'science_choice':
      return `1 simbolo scientifico a scelta 🧭⚙️📝`
    default:
      return ''
  }
}

// Descrizione leggibile dell'effetto di una Gilda (carta Viola).
function guildEffectLabel(card) {
  switch (card.scoringKind) {
    case 'per_color_in_neighbors':
      return `+${card.scoringValue.vpEach}🏆 per ogni carta ${COLOR_LABEL[card.scoringValue.color]} ${COLOR_NAME[card.scoringValue.color]} nelle città dei vicini`
    case 'per_wonder_stage_self_and_neighbors':
      return `+${card.scoringValue.vpEach}🏆 per ogni stadio Meraviglia (tuo + vicini)`
    case 'all_wonder_stages_flat':
      return `+${card.scoringValue.vp}🏆 se hai completato tutti gli stadi della tua Meraviglia`
    case 'per_brown_grey_purple_self':
      return `+${card.scoringValue.vpEach}🏆 per ogni carta Marrone/Grigia/Viola nella tua città`
    case 'science_choice':
      return `1 simbolo scientifico a scelta 🧭⚙️📝`
    default:
      return ''
  }
}

function effectLabel(card) {
  return card.color === 'purple' ? guildEffectLabel(card) : cardEffectLabel(card)
}

// Descrizione leggibile dell'effetto di uno stadio di Meraviglia.
function wonderStageLabel(stage) {
  switch (stage.effectKind) {
    case 'vp':
      return `+${stage.effectValue}🏆`
    case 'coins':
      return `+${stage.effectValue}🪙`
    case 'vp_and_coins':
      return `+${stage.effectValue.vp}🏆 +${stage.effectValue.coins}🪙`
    case 'produce_choice':
      return `+1 a scelta: ${stage.effectValue.map((r) => RESOURCE_ICON[r]).join(' ')}`
    case 'military':
      return `+${stage.effectValue}⚔️`
    case 'science':
      return `${stage.effectValue} simbolo/i scientifico/i a scelta 🧭⚙️📝`
    case 'trade_discount':
      return `Sconto commercio: ${stage.effectValue.resources.map((r) => RESOURCE_ICON[r]).join(' ')}`
    case 'build_from_hand_free':
      return `Costruisci gratis dalla mano (1 volta/Epoca)`
    case 'build_from_discard':
      return `Costruisci gratis dagli scarti`
    case 'play_last_card':
      return `Puoi giocare l'ultima carta di ogni Epoca`
    case 'copy_guild':
      return `Copia una Gilda di un vicino a fine partita`
    default:
      return ''
  }
}

export default function Game({ profile }) {
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [myUserId, setMyUserId] = useState(null)
  const [myHandRows, setMyHandRows] = useState([]) // righe player_hands visibili (la mia + quella indirizzata a me)
  const [error, setError] = useState(null)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [buyPreference, setBuyPreference] = useState(null)
  const [bundlePrimaryChoice, setBundlePrimaryChoice] = useState(null) // { cardId, action } — Olympia lato A o Babilonia lato B
  const [discardPicker, setDiscardPicker] = useState(null) // { cardId, action } della carta principale, in attesa di scelta dagli scarti (Halikarnassós)
  const [showBoard, setShowBoard] = useState(false)
  const [expandedPlayerId, setExpandedPlayerId] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())

  // Timer live: si aggiorna ogni secondo mentre la partita è in corso
  // (stesso principio del cronometro di Harmonies), calcolato dalla
  // colonna games.started_at — nessuna scrittura, solo lettura locale.
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  const resolvingRef = useRef(null)
  const advancingRef = useRef(false)
  const dealingRef = useRef(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

  // --- Caricamento iniziale + sottoscrizioni realtime ---
  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const [{ data: g }, { data: p }, { data: h }] = await Promise.all([
        supabase.from('games').select().eq('id', gameId).single(),
        supabase.from('players').select().eq('game_id', gameId),
        supabase.from('player_hands').select().eq('game_id', gameId)
      ])
      if (cancelled) return
      setGame(g)
      setPlayers(p ?? [])
      setMyHandRows(h ?? [])
    }
    loadAll()

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        if (payload.eventType === 'DELETE') return
        setGame(payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, () => {
        supabase
          .from('players')
          .select()
          .eq('game_id', gameId)
          .then(({ data }) => !cancelled && setPlayers(data ?? []))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameId}` }, () => {
        supabase
          .from('player_hands')
          .select()
          .eq('game_id', gameId)
          .then(({ data }) => !cancelled && setMyHandRows(data ?? []))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [gameId])

  const myPlayer = useMemo(() => players.find((p) => p.user_id === myUserId), [players, myUserId])
  const myHand = useMemo(() => myHandRows.find((h) => h.user_id === myUserId), [myHandRows, myUserId])

  const numPlayers = players.length
  const turnOrder = game?.turn_order || []
  const mySeat = myPlayer ? turnOrder.indexOf(myPlayer.id) : -1

  const seatToPlayer = useMemo(() => {
    const map = {}
    turnOrder.forEach((playerId, seat) => {
      const pl = players.find((p) => p.id === playerId)
      if (pl) map[seat] = pl
    })
    return map
  }, [turnOrder, players])

  const orderedPlayers = useMemo(() => turnOrder.map((id) => players.find((p) => p.id === id)).filter(Boolean), [turnOrder, players])

  // Punteggio "live": stesso motore usato per il punteggio finale
  // (scoreGame), calcolato però in ogni momento sullo stato attuale.
  // È una stima di "quanto varrebbe la mia città se la partita finisse
  // ora" — i Militari restano a 0 finché l'Epoca non si conclude,
  // esattamente come da regolamento (il conflitto si risolve a fine
  // Epoca, non a ogni turno).
  const liveScoresById = useMemo(() => {
    if (orderedPlayers.length === 0 || orderedPlayers.some((p) => !p.wonder_id)) return {}
    return Object.fromEntries(scoreGame(orderedPlayers).map((s) => [s.playerId, s]))
  }, [orderedPlayers])

  const leftNeighbor = mySeat >= 0 ? seatToPlayer[leftNeighborSeat(mySeat, numPlayers)] : null
  const rightNeighbor = mySeat >= 0 ? seatToPlayer[rightNeighborSeat(mySeat, numPlayers)] : null

  // ============================================================
  // WAITING ROOM: scelta Meraviglia + avvio partita
  // ============================================================
  const chosenWonderIds = new Set(players.filter((p) => p.wonder_id).map((p) => p.wonder_id))

  async function chooseWonder(wonderId, side) {
    await supabase.from('players').update({ wonder_id: wonderId, wonder_side: side }).eq('id', myPlayer.id)
  }

  async function startGame() {
    const ids = players.map((p) => p.id)
    const n = ids.length

    // Controllo di sicurezza CRITICO: verifica che ogni Epoca abbia
    // abbastanza carte per distribuire una mano completa a tutti, PRIMA
    // di avviare la partita. Senza questo controllo, un mazzo troppo
    // corto per il numero di giocatori scelto produce mani vuote a
    // metà partita (bug osservato e diagnosticato — vedi cards.js: i
    // dati minPlayers non garantiscono ancora esattamente 7 carte a
    // giocatore per N alti). Meglio bloccare qui, con un messaggio
    // chiaro, che corrompere silenziosamente una partita in corso.
    const shortages = [1, 2, 3]
      .map((age) => ({ age, size: buildAgeDeck(age, n).length, needed: HAND_SIZE * n }))
      .filter((d) => d.size < d.needed)
    if (shortages.length > 0) {
      const detail = shortages.map((d) => `Epoca ${AGE_ROMAN[d.age]}: ${d.size}/${d.needed} carte`).join(', ')
      setError(
        `Con ${n} giocatori il mazzo attuale non ha abbastanza carte in tutte le Epoche (${detail}). ` +
          `È un problema noto di dati (mancano copie duplicate di alcune carte per le partite più numerose) — per ora prova con meno giocatori.`
      )
      return
    }

    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    const deck1 = buildAgeDeck(1, n)
    await supabase
      .from('games')
      .update({
        status: 'playing',
        turn_order: shuffled,
        age: 1,
        turn_number: 1,
        age_decks: { 1: deck1 },
        started_at: new Date().toISOString()
      })
      .eq('id', gameId)
  }

  // ============================================================
  // DISTRIBUZIONE MANO — quando inizia una nuova Epoca, ognuno si
  // calcola la propria fetta del mazzo pubblico già mescolato.
  // ============================================================
  useEffect(() => {
    if (!game || game.status !== 'playing' || !myHand || mySeat < 0) return
    if (dealingRef.current) return
    const deck = game.age_decks?.[String(game.age)]
    if (!deck) return
    if (myHand.dealt_age === game.age) return
    dealingRef.current = true
    const hand = dealHandForSeat(deck, mySeat)
    console.log('[dealHand] tentativo distribuzione — game', gameId, 'seat', mySeat, 'epoca', game.age, 'dimensione mazzo', deck.length, 'carte ottenute', hand.length, hand)
    if (hand.length !== HAND_SIZE) {
      // Non dovrebbe mai succedere (il mazzo è garantito abbastanza grande
      // per il numero di giocatori — vedi controllo in startGame). Se
      // capita comunque, NON salviamo una mano rotta: meglio segnalarlo
      // forte e riprovare al prossimo render che rischiare una mano vuota
      // permanente.
      console.error('[dealHand] MANO ANOMALA, non salvo — segnalare questo log:', {
        gameId,
        mySeat,
        numPlayers,
        age: game.age,
        deckLength: deck.length,
        handLength: hand.length,
        turnOrder: game.turn_order,
        myPlayerId: myPlayer?.id
      })
      dealingRef.current = false
      return
    }
    const dealtRow = { ...myHand, hand, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, dealt_age: game.age }
    supabase
      .from('player_hands')
      .update({ hand, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, dealt_age: game.age })
      .eq('id', myHand.id)
      .then(({ error }) => {
        if (error) {
          console.error('[dealHand] errore distribuzione mano:', error)
        } else {
          console.log('[dealHand] distribuzione confermata su database, seat', mySeat, 'carte:', hand)
          setMyHandRows((prev) => prev.map((h) => (h.id === myHand.id ? dealtRow : h)))
        }
        dealingRef.current = false
      })
  }, [game, myHand, mySeat])

  // ============================================================
  // SCELTA DELLA CARTA (fase di commit) — calcola SUBITO il costo
  // guardando lo stato attuale dei vicini, cosi' l'applicazione
  // successiva non dipende piu' da loro (vedi prepareAction).
  // ============================================================
  async function chooseAction(cardId, action, preference = null, bundleWith = null, bundleType = 'last_card') {
    setError(null)
    try {
      let prepared
      if (bundleWith && bundleType === 'free_build') {
        prepared = prepareFreeBuildBundle(action, cardId, bundleWith.cardId, myPlayer, leftNeighbor, rightNeighbor, preference)
      } else if (bundleWith && bundleType === 'discard_build') {
        prepared = prepareDiscardBuildBundle(action, cardId, bundleWith.cardId, myPlayer, leftNeighbor, rightNeighbor, preference)
      } else if (bundleWith) {
        prepared = prepareLastTurnBundle(action, cardId, bundleWith.action, bundleWith.cardId, myPlayer, leftNeighbor, rightNeighbor, preference)
      } else {
        prepared = prepareAction(action, cardId, myPlayer, leftNeighbor, rightNeighbor, preference)
      }
      const playedCardIds = bundleWith ? [cardId, bundleWith.cardId] : [cardId]
      const remainingHand = (myHand.hand || []).filter((id) => !playedCardIds.includes(id))
      const isLastTurnOfAge = game.turn_number >= 6
      const allPurchases = bundleWith ? [...(prepared.primary.purchases || []), ...(prepared.bonus.purchases || [])] : prepared.purchases || []

      // Traduce il piano d'acquisto (chi/quanto) in importi dovuti ai
      // vicini reali, indirizzati alla loro user_id: ognuno di loro se
      // li accrediterà da solo durante la risoluzione del proprio turno
      // (vedi sotto) — nessun client scrive mai il saldo di un altro.
      const paymentsOut = {}
      for (const purchase of allPurchases) {
        const neighbor = purchase.neighbor === 'left' ? leftNeighbor : rightNeighbor
        if (!neighbor) continue
        const key = neighbor.user_id
        if (!paymentsOut[key]) paymentsOut[key] = { amount: 0, turn: game.turn_number }
        paymentsOut[key].amount += purchase.unitCost
      }

      const update = { pending_action: prepared, payments_out: paymentsOut }
      if (!isLastTurnOfAge) {
        const recipientSeat = passRecipientSeat(game.age, mySeat, numPlayers)
        const recipient = seatToPlayer[recipientSeat]
        if (!recipient) {
          // Non dovrebbe MAI succedere (turn_order è fisso per tutta la
          // partita) — se capita, meglio un errore rumoroso e visibile
          // che un invio silenzioso a nessuno (causa nota di "mano vuota").
          console.error('[chooseAction] destinatario mancante!', {
            mySeat,
            recipientSeat,
            numPlayers,
            turnOrder,
            seatToPlayer: Object.fromEntries(Object.entries(seatToPlayer).map(([k, v]) => [k, v?.id]))
          })
          throw new Error('Errore interno: destinatario della mano non trovato. Riprova, e se persiste segnalalo.')
        }
        console.log('[chooseAction] turno', game.turn_number, 'invio mano residua a', recipient.nickname, 'seat', recipientSeat, 'user_id', recipient.user_id, 'carte:', remainingHand)
        update.outgoing_hand = remainingHand
        update.outgoing_hand_for = recipient.user_id
      } else {
        update.outgoing_hand = null
        update.outgoing_hand_for = null
      }
      await supabase.from('player_hands').update(update).eq('id', myHand.id)
      await supabase.from('players').update({ ready_this_turn: true }).eq('id', myPlayer.id)
      setSelectedCardId(null)
      setBuyPreference(null)
      setLastTurnPrimaryChoice(null)
    } catch (err) {
      setError(err.message)
    }
  }

  // ============================================================
  // APPLICAZIONE DEL TURNO — quando TUTTI hanno scelto (ready_this_turn),
  // ognuno applica SOLO la propria azione e recupera la propria nuova
  // mano dallo slot "outgoing" che il vicino le ha indirizzato.
  //
  // IMPORTANTE: qui NON ci si fida dello stato React (myHand, myPlayer)
  // per decidere COSA applicare o SE è già stato applicato, perché può
  // essere in ritardo rispetto alle scritture più recenti su Supabase
  // (l'eco realtime arriva con un piccolo ritardo). Usare stato in
  // ritardo qui causava due bug osservati in partita: monete negative
  // (la stessa azione applicata due volte) e mano vuota (letta prima
  // che il vicino avesse davvero scritto la propria "outgoing_hand").
  // Per questo si rilegge sempre tutto fresco da Supabase subito prima
  // di scrivere, e la scrittura decisiva (players.update) è protetta
  // da una guardia atomica (.lt('turn_applied', ...)) che garantisce
  // che, anche se questo blocco venisse eseguito due volte per errore,
  // la seconda scrittura non trovi righe da aggiornare.
  // ============================================================
  useEffect(() => {
    if (!game || game.status !== 'playing' || !myPlayer || !myHand) return
    if (numPlayers === 0 || players.some((p) => !p.wonder_id)) return
    if (myPlayer.turn_applied >= game.turn_number) return
    if (!players.every((p) => p.ready_this_turn)) return
    const turnKey = `${game.age}-${game.turn_number}`
    if (resolvingRef.current === turnKey) return
    resolvingRef.current = turnKey

    async function resolve() {
      try {
        const { data: freshHand, error: freshHandError } = await supabase.from('player_hands').select().eq('id', myHand.id).single()
        if (freshHandError) console.error('[resolveTurn] errore rilettura mano propria:', freshHandError)
        const prepared = freshHand?.pending_action
        if (!prepared) {
          resolvingRef.current = null
          return
        }

        // IMPORTANTE: si rilegge fresco anche il proprio giocatore invece
        // di usare "myPlayer" (stato React, che riflette l'ultimo evento
        // realtime ricevuto e può essere leggermente indietro rispetto al
        // vero saldo nel database in questo preciso istante). Calcolare il
        // nuovo saldo da un valore non aggiornato è la causa più probabile
        // di eventuali monete negative residue.
        const { data: freshPlayer, error: freshPlayerError } = await supabase.from('players').select().eq('id', myPlayer.id).single()
        if (freshPlayerError) console.error('[resolveTurn] errore rilettura giocatore proprio:', freshPlayerError)
        const baselinePlayer = freshPlayer || myPlayer

        const updatedPublic = applyPreparedActionOrBundle(prepared, baselinePlayer)
        const isLastTurnOfAge = game.turn_number >= 6

        // Incassa eventuali pagamenti che i vicini ci devono per risorse
        // comprate DA NOI questo turno (vedi chooseAction: chi acquista
        // indirizza l'importo qui, leggibile grazie alla policy RLS
        // dedicata). Si accredita solo se il pagamento è per QUESTO
        // turno — evita di incassare due volte lo stesso importo se il
        // vicino non ha ancora sovrascritto payments_out con una nuova
        // scelta (persiste finché non fa un nuovo acquisto).
        const { data: creditRows, error: creditError } = await supabase
          .from('player_hands')
          .select('user_id, payments_out')
          .eq('game_id', gameId)
        if (creditError) console.error('[resolveTurn] errore lettura pagamenti dovuti:', creditError)
        let owedToMe = 0
        for (const row of creditRows || []) {
          const entry = row.payments_out?.[myUserId]
          if (entry && entry.turn === game.turn_number) owedToMe += entry.amount
        }
        updatedPublic.coins += owedToMe

        if (updatedPublic.coins < 0) {
          // Non dovrebbe mai succedere (canBuildCard/canBuildWonderStage
          // controllano già il costo totale prima di permettere l'azione):
          // se capita comunque, lo segnaliamo forte in console con tutti i
          // dati per capire la causa esatta, e clampiamo a 0 per non
          // mostrare un saldo impossibile in partita.
          console.error('[resolveTurn] SALDO NEGATIVO CALCOLATO — segnalare questo log:', {
            playerId: myPlayer.id,
            baselineCoins: baselinePlayer.coins,
            prepared,
            computedCoins: updatedPublic.coins
          })
          updatedPublic.coins = 0
        }

        // Scrittura atomica: procede solo se turn_applied non è già
        // arrivato a questo turno (protegge da doppia applicazione).
        const { data: claimed, error: claimError } = await supabase
          .from('players')
          .update({
            coins: updatedPublic.coins,
            built_cards: updatedPublic.built_cards,
            wonder_stages_built: updatedPublic.wonder_stages_built,
            ready_this_turn: false,
            turn_applied: game.turn_number,
            ...(prepared?.kind === 'free_build' ? { free_build_used_age: game.age } : {})
          })
          .eq('id', myPlayer.id)
          .lt('turn_applied', game.turn_number)
          .select()
        if (claimError) console.error('[resolveTurn] errore applicazione azione:', claimError)

        if (claimed && claimed.length > 0) {
          // Aggiorna la pila degli scarti condivisa (games.discard_pile):
          // aggiunge le carte scartate con l'azione 'discard' questo
          // turno, e rimuove quella eventualmente pescata dal potere di
          // Halikarnassós ("costruisci gratis dagli scarti"). Scrittura
          // "best effort" in lettura-modifica-scrittura sulla riga
          // condivisa: in rarissimi casi di scarti simultanei di più
          // giocatori nello stesso istante una voce potrebbe non
          // comparire, accettabile per questa funzione accessoria (non
          // altera mai lo stato di gioco di nessun giocatore).
          const discardedIds = []
          if (prepared.action === 'discard') discardedIds.push(prepared.cardId)
          if (prepared.primary?.action === 'discard') discardedIds.push(prepared.primary.cardId)
          if (prepared.bonus?.action === 'discard') discardedIds.push(prepared.bonus.cardId)
          const pickedFromDiscard = prepared.kind === 'discard_build' ? prepared.discardCardId : null
          if (discardedIds.length > 0 || pickedFromDiscard) {
            const { data: freshGame } = await supabase.from('games').select('discard_pile').eq('id', gameId).single()
            let pile = freshGame?.discard_pile || []
            if (pickedFromDiscard) pile = pile.filter((id) => id !== pickedFromDiscard)
            pile = [...pile, ...discardedIds]
            await supabase.from('games').update({ discard_pile: pile }).eq('id', gameId)
          }

          // Aggiornamento OTTIMISTICO immediato: questo client conosce già
          // con certezza il risultato appena scritto, non ha senso che
          // aspetti l'eco realtime per aggiornare la propria interfaccia
          // (quell'attesa, anche solo di una frazione di secondo, è quella
          // che produce il lampeggio "mano vuota per un istante" osservato
          // dopo la costruzione di uno stadio Meraviglia — e la stessa
          // finestra, se allargata da un ritardo di rete, potrebbe essere
          // la causa della mano che resta vuota più a lungo).
          setPlayers((prev) => prev.map((pl) => (pl.id === myPlayer.id ? { ...pl, ...claimed[0] } : pl)))

          let newHand = []
          if (!isLastTurnOfAge) {
            // Rilettura fresca e mirata: cerca la riga che IL VICINO ha
            // indirizzato a noi, invece di fidarsi della cache realtime.
            // Un paio di brevi tentativi extra in caso il vicino stia
            // ancora completando la propria scrittura in quello stesso
            // istante (difesa in più oltre alla logica di "tutti pronti").
            for (let attempt = 0; attempt < 5; attempt++) {
              const { data: incoming, error: incomingError } = await supabase
                .from('player_hands')
                .select('outgoing_hand')
                .eq('game_id', gameId)
                .eq('outgoing_hand_for', myUserId)
                .neq('user_id', myUserId)
                .maybeSingle()
              if (incomingError) console.error('[resolveTurn] errore lettura mano in arrivo:', incomingError)
              console.log('[resolveTurn] turno', game.turn_number, 'tentativo', attempt, 'mano in arrivo trovata:', incoming)
              if (incoming?.outgoing_hand?.length || attempt === 4) {
                newHand = incoming?.outgoing_hand || []
                if (newHand.length === 0) {
                  console.warn('[resolveTurn] MANO VUOTA dopo tutti i tentativi — segnalare questo log:', {
                    myUserId,
                    gameId,
                    turn: game.turn_number,
                    ultimoIncoming: incoming
                  })
                }
                break
              }
              await new Promise((res) => setTimeout(res, 300))
            }
          }
          const newHandRow = {
            ...freshHand,
            hand: newHand,
            pending_action: null,
            dealt_age: isLastTurnOfAge ? freshHand.dealt_age : game.age
          }
          // ORDINE IMPORTANTE: prima si scrive e si aspetta conferma dal
          // database, SOLO DOPO si rispecchia in locale — mai il
          // contrario, altrimenti se questa scrittura fallisse (errore di
          // rete, RLS, ecc.) il client mostrerebbe uno stato che nel
          // database non esiste mai stato.
          //
          // IMPORTANTE: qui NON si toccano più outgoing_hand/outgoing_hand_for
          // (a differenza delle versioni precedenti). Pulirli qui causava una
          // race condition reale e osservata in partita: se QUESTO giocatore
          // risolveva il proprio turno e li azzerava PRIMA che il vicino
          // destinatario fosse riuscito a leggerli, quel vicino trovava la
          // mano vuota per sempre (anche con più tentativi, perché il dato
          // non c'era più fin dal primo). È sicuro lasciarli: al turno
          // successivo il mittente li sovrascrive comunque con dati freschi
          // prima che servano di nuovo, e a fine Epoca vengono azzerati
          // esplicitamente sia in chooseAction (ultimo turno) sia qui sotto
          // nella distribuzione della mano nuova.
          const { error: handUpdateError } = await supabase
            .from('player_hands')
            .update({
              hand: newHand,
              pending_action: null,
              dealt_age: newHandRow.dealt_age
            })
            .eq('id', myHand.id)
          if (handUpdateError) {
            console.error('[resolveTurn] errore scrittura nuova mano:', handUpdateError)
          } else {
            setMyHandRows((prev) => prev.map((h) => (h.id === myHand.id ? newHandRow : h)))
          }
        }
      } catch (err) {
        console.error('[resolveTurn] eccezione imprevista:', err)
      } finally {
        resolvingRef.current = null
      }
    }
    resolve()
  }, [game, myPlayer, myHand, players, numPlayers, gameId, myUserId])

  // ============================================================
  // AVANZAMENTO TURNO/EPOCA — quando TUTTI hanno applicato la propria
  // azione per il turno corrente, un client qualsiasi prova a far
  // avanzare lo stato condiviso (con guardia ottimistica: se un altro
  // client arriva prima, il .eq() sotto non trova righe e non succede
  // nulla di male). Rilegge sempre i giocatori freschi da Supabase
  // prima di calcolare i conflitti militari, per lo stesso motivo
  // spiegato sopra (evitare di usare stato React in ritardo).
  // ============================================================
  useEffect(() => {
    if (!game || game.status !== 'playing' || numPlayers === 0) return
    if (players.some((p) => !p.wonder_id)) return
    if (!players.every((p) => p.turn_applied >= game.turn_number)) return
    if (advancingRef.current) return
    advancingRef.current = true

    async function advance() {
      try {
        if (game.turn_number < 6) {
          await supabase
            .from('games')
            .update({ turn_number: game.turn_number + 1 })
            .eq('id', gameId)
            .eq('turn_number', game.turn_number)
          return
        }

        // Fine Epoca: rilettura fresca di tutti i giocatori (non fidarsi
        // dello stato React) prima di calcolare i conflitti militari.
        const { data: freshRaw, error: freshError } = await supabase.from('players').select().eq('game_id', gameId)
        if (freshError) console.error('[advanceAge] errore rilettura giocatori:', freshError)
        const freshPlayers = (game.turn_order || []).map((id) => freshRaw?.find((p) => p.id === id)).filter(Boolean)
        const freshMe = freshRaw?.find((p) => p.id === myPlayer.id) || myPlayer

        // Idempotenza: se per qualche motivo questo blocco venisse
        // eseguito due volte per la stessa Epoca (es. lo stato locale
        // "game.age" non si è ancora aggiornato dopo che UN client ha già
        // fatto avanzare l'Epoca), non aggiungere due volte i gettoni.
        const alreadyResolvedThisAge = (freshMe.military_tokens || []).some((t) => t.age === game.age)
        let newTokens = freshMe.military_tokens || []
        if (!alreadyResolvedThisAge && freshPlayers.length === numPlayers) {
          const results = resolveMilitaryConflict(freshPlayers, game.age)
          const myTokens = results[myPlayer.id] || []
          newTokens = [...newTokens, ...myTokens]
        }

        if (game.age < 3) {
          const nextAge = game.age + 1
          const deck = buildAgeDeck(nextAge, numPlayers)
          if (!alreadyResolvedThisAge) {
            const { error } = await supabase
              .from('players')
              .update({ military_tokens: newTokens, turn_applied: 0, ready_this_turn: false })
              .eq('id', myPlayer.id)
            if (error) console.error('[advanceAge] errore scrittura gettoni militari:', error)
          }
          const { error } = await supabase
            .from('games')
            .update({ age: nextAge, turn_number: 1, age_decks: { ...game.age_decks, [nextAge]: deck } })
            .eq('id', gameId)
            .eq('age', game.age)
          if (error) console.error('[advanceAge] errore avanzamento epoca:', error)
        } else {
          if (!alreadyResolvedThisAge) {
            const playersWithMilitary = freshPlayers.map((p) => (p.id === myPlayer.id ? { ...p, military_tokens: newTokens } : p))
            const scores = scoreGame(playersWithMilitary)
            const myScore = scores.find((s) => s.playerId === myPlayer.id)
            const { error } = await supabase
              .from('players')
              .update({ military_tokens: newTokens, final_score: myScore, turn_applied: 0, ready_this_turn: false })
              .eq('id', myPlayer.id)
            if (error) console.error('[advanceAge] errore scrittura punteggio finale:', error)
          }
          const { error } = await supabase
            .from('games')
            .update({ status: 'finished', finished_at: new Date().toISOString() })
            .eq('id', gameId)
            .eq('status', 'playing')
          if (error) console.error('[advanceAge] errore chiusura partita:', error)
        }
      } catch (err) {
        console.error('[advanceAge] eccezione imprevista:', err)
      } finally {
        advancingRef.current = false
      }
    }
    advance()
  }, [game, players, myPlayer, numPlayers, gameId])

  if (!game || !myPlayer) return <Loader message="Carico la partita..." />

  // Estratto in funzione perché serve sia durante il turno di gioco sia
  // nella revisione della plancia a partita conclusa (vedi schermata finale).
  function renderPlayerPanels() {
    return orderedPlayers.map((p) => {
      const wonder = WONDERS[p.wonder_id]
      const side = wonder?.sides[p.wonder_side]
      const cardsByColor = {}
      for (const cardId of p.built_cards || []) {
        const card = getCardData(cardId)
        if (!card) continue
        ;(cardsByColor[card.color] ||= []).push(card)
      }
      const militaryTotal = (p.military_tokens || []).reduce((sum, t) => sum + (t.value ?? 0), 0)
      const militaryStrength = computeMilitaryStrength(p)
      const production = computeProduction(p)
      const science = computeScienceSymbols(p)
      const trade = tradeDiscountSummary(p)
      const live = liveScoresById[p.id]
      const isExpanded = expandedPlayerId ? expandedPlayerId === p.id : p.id === myPlayer.id
      return (
        <div
          key={p.id}
          style={{
            border: p.id === myPlayer.id ? '2px solid #8a6a48' : '1px solid #e4ddcc',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: '0.8rem',
            background: '#fff'
          }}
        >
          <div
            onClick={() => setExpandedPlayerId(isExpanded ? 'none' : p.id)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, cursor: 'pointer' }}
          >
            <strong>
              {isExpanded ? '▾' : '▸'} {p.nickname} {game.status === 'playing' ? (p.ready_this_turn ? '✅' : '⏳') : ''}
            </strong>
          </div>

          {live && (
            <div
              title="Punteggio live: quanto varrebbe la tua città se la partita finisse ora. 'Militari' sono i Punti Vittoria dei conflitti già risolti a fine Epoca; ⚔️ è la potenza accumulata nell'Epoca in corso, che conta solo alla fine."
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: '0.72rem',
                color: '#5a5142',
                background: '#f5f0e6',
                border: '1px solid #e4ddcc',
                borderRadius: 6,
                padding: '3px 8px',
                marginTop: 6
              }}
            >
              <span>🛡️ Militari {live.military} (⚔️{militaryStrength})</span>
              <span>💰 Tesoro {live.treasury} (🪙{p.coins})</span>
              <span>🏛️ Meraviglia {live.wonder}</span>
              <span>🔵 Blu {live.blue}</span>
              <span>🟡 Gialle {live.yellow}</span>
              <span>🟢 Verdi {live.green}</span>
              <span>🟣 Viola {live.purple}</span>
              <span style={{ fontWeight: 700, color: '#3d3527', marginLeft: 'auto' }}>{live.total} 🏆</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: '#5a5142', marginTop: 6 }}>
            <div title="Numero di carte per colore — utile per le Gilde che contano le carte dei vicini">
              <span style={{ color: '#a89b86' }}>🎨 Carte: </span>
              {['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple'].map((color) => (
                <span key={color} style={{ marginRight: 6 }}>
                  {COLOR_LABEL[color]}
                  {(cardsByColor[color] || []).length}
                </span>
              ))}
            </div>

            <div title="Risorse fisse prodotte a ogni turno">
              <span style={{ color: '#a89b86' }}>📦 Produzione: </span>
              {Object.entries(production.fixed).filter(([, n]) => n > 0).length === 0 ? (
                <span>—</span>
              ) : (
                Object.entries(production.fixed)
                  .filter(([, n]) => n > 0)
                  .map(([r, n]) => (
                    <span key={r} style={{ marginRight: 6 }}>
                      +{n}
                      {RESOURCE_ICON[r]}
                    </span>
                  ))
              )}
            </div>

            {production.choiceGenerators.length > 0 && (
              <div title="Risorse producibili a scelta (1 unità a turno per ciascun generatore)">
                <span style={{ color: '#a89b86' }}>🔀 A scelta: </span>
                {production.choiceGenerators.map((gen, i) => (
                  <span key={i} style={{ marginRight: 6 }}>
                    +1 {gen.map((r) => RESOURCE_ICON[r]).join('/')}
                  </span>
                ))}
              </div>
            )}

            {trade && (
              <div title="Sconti commercio attivi: ◄ vicino sinistro, ► destro, ↔ entrambi">
                <span style={{ color: '#a89b86' }}>💱 Commercio: </span>
                {trade}
              </div>
            )}

            {(science.fixed.compass > 0 || science.fixed.gear > 0 || science.fixed.tablet > 0 || science.choices > 0) && (
              <div title="Simboli scientifici accumulati finora (i punti si calcolano solo a fine partita)">
                <span style={{ color: '#a89b86' }}>🔬 Scienza: </span>
                <span style={{ marginRight: 6 }}>
                  {SCIENCE_ICON.compass}×{science.fixed.compass}
                </span>
                <span style={{ marginRight: 6 }}>
                  {SCIENCE_ICON.gear}×{science.fixed.gear}
                </span>
                <span style={{ marginRight: 6 }}>
                  {SCIENCE_ICON.tablet}×{science.fixed.tablet}
                </span>
                {science.choices > 0 && <span>+{science.choices} a scelta</span>}
              </div>
            )}
          </div>

          {isExpanded && (
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* ---- Area Meraviglia: plancia + stadi ---- */}
              <div
                style={{
                  width: 220,
                  flexShrink: 0,
                  background: '#faf6ec',
                  border: '1px solid #e4ddcc',
                  borderRadius: 8,
                  padding: 6
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  🏛️ {wonder?.name} ({p.wonder_side})
                </div>
                <div style={{ fontSize: '0.72rem', color: '#5a5142', marginBottom: 4 }}>{wonderStartResourceLabel(p.wonder_id)} di partenza</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {side?.stages.map((s, i) => {
                    const built = i < p.wonder_stages_built
                    return (
                      <div
                        key={i}
                        style={{
                          background: built ? '#e9dfc8' : '#fff',
                          border: built ? '1px solid #8a6a48' : '1px solid #e4ddcc',
                          borderRadius: 6,
                          padding: '2px 6px',
                          opacity: built ? 1 : 0.65,
                          fontWeight: built ? 700 : 400,
                          fontSize: '0.72rem'
                        }}
                      >
                        {built ? '🏛️' : '▫️'} {STAGE_EMOJI[i + 1] || i + 1}: {costLabel(s.cost)} → {wonderStageLabel(s)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ---- Area Città: edifici costruiti, una riga per colore ---- */}
              <div style={{ flex: 1, minWidth: 260 }}>
                {Object.keys(cardsByColor).length === 0 ? (
                  <div style={{ color: '#a89b86' }}>Nessun edificio costruito ancora</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple']
                      .filter((color) => cardsByColor[color])
                      .map((color) => (
                        <div key={color} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                            {cardsByColor[color].map((card) => (
                              <div
                                key={card.id}
                                style={{
                                  position: 'relative',
                                  background: '#f5f0e6',
                                  border: '1px solid #e4ddcc',
                                  borderRadius: 6,
                                  padding: '3px 16px 12px 6px',
                                  minWidth: 130,
                                  maxWidth: 170
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: '0.7rem' }}>
                                  {COLOR_LABEL[color]} {card.name}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: '#3d3527' }}>{effectLabel(card)}</div>
                                {chainLabel(card).map((line, i) => (
                                  <div key={i} style={{ fontSize: '0.62rem', color: '#8a6a48' }}>
                                    {line}
                                  </div>
                                ))}
                                {card.age && (
                                  <span
                                    title={`Epoca ${AGE_ROMAN[card.age]}`}
                                    style={{ position: 'absolute', right: 5, bottom: 2, fontSize: '0.6rem', fontWeight: 700, color: '#a89b86' }}
                                  >
                                    {AGE_ROMAN[card.age]}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    })
  }

  // ============================================================
  // UI — Sala d'attesa
  // ============================================================
  if (game.status === 'waiting') {
    const canStart = numPlayers >= 3 && numPlayers <= 7 && players.every((p) => p.wonder_id)
    return (
      <div style={page}>
        <div style={{ ...cardWide, width: 720 }}>
          <h1 style={title}>Stanza {game.room_code}</h1>
          <p style={{ textAlign: 'center', color: '#5a5142', marginTop: -12 }}>
            {numPlayers} giocator{numPlayers === 1 ? 'e' : 'i'} (min. 3, max. 7)
          </p>

          <div style={{ margin: '1rem 0' }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <span>{p.nickname}</span>
                <span>{p.wonder_id ? `${WONDERS[p.wonder_id].name} (${p.wonder_side}) · ${wonderStartResourceLabel(p.wonder_id)}` : '— sceglie...'}</span>
              </div>
            ))}
          </div>

          {!myPlayer.wonder_id && (
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Scegli la tua Meraviglia:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {WONDER_IDS.filter((id) => !chosenWonderIds.has(id)).map((id) => (
                  <div key={id} style={{ border: '1px solid #e4ddcc', borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {WONDERS[id].name} <span style={{ fontWeight: 400, color: '#5a5142' }}>({wonderStartResourceLabel(id)} di partenza)</span>
                    </div>
                    {['A', 'B'].map((side) => (
                      <div key={side} style={{ marginBottom: 4 }}>
                        <button
                          style={pillButton}
                          onClick={() => chooseWonder(id, side)}
                          title={WONDERS[id].sides[side].stages.map((s, i) => `Stadio ${STAGE_EMOJI[i + 1] || i + 1}: ${costLabel(s.cost)} → ${wonderStageLabel(s)}`).join(' | ')}
                        >
                          Lato {side}
                        </button>
                        <span style={{ fontSize: '0.7rem', color: '#5a5142', marginLeft: 6 }}>
                          {WONDERS[id].sides[side].stages.map((s, i) => `${STAGE_EMOJI[i + 1] || i + 1}: ${costLabel(s.cost)}→${wonderStageLabel(s)}`).join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canStart && (
            <button style={{ ...primaryButton, marginTop: 16 }} onClick={startGame}>
              ▶️ Avvia partita
            </button>
          )}
          {error && <p style={errorText}>{error}</p>}
        </div>
      </div>
    )
  }

  // ============================================================
  // UI — Fine partita
  // ============================================================
  if (game.status === 'finished') {
    const scores = orderedPlayers.map((p) => p.final_score).filter(Boolean).sort((a, b) => b.total - a.total)
    return (
      <div style={page}>
        <div style={{ ...cardWide, width: showBoard ? 980 : 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h1 style={{ ...title, margin: 0 }}>🏆 Partita conclusa</h1>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              {game.finished_at && game.started_at && (
                <span style={{ fontSize: '0.85rem', color: '#5a5142' }} title="Durata totale della partita">
                  ⏱️ {formatElapsed(new Date(game.finished_at).getTime() - new Date(game.started_at).getTime())}
                </span>
              )}
              <button style={linkText} onClick={() => setShowBoard(!showBoard)}>
                {showBoard ? '🏆 Torna al punteggio' : '👁️ Rivedi le plance'}
              </button>
            </div>
          </div>

          {showBoard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>{renderPlayerPanels()}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: 16 }}>
              <thead>
                <tr>
                  <th align="left">Giocatore</th>
                  <th>🛡️ Mil.</th>
                  <th>💰 Tesoro</th>
                  <th>🏛️ Merav.</th>
                  <th>🔵 Blu</th>
                  <th>🟡 Gialle</th>
                  <th>🟢 Verdi</th>
                  <th>🟣 Viola</th>
                  <th>🏆 Totale</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => {
                  const p = players.find((pl) => pl.id === s.playerId)
                  return (
                    <tr key={s.playerId} style={{ borderTop: '1px solid #eee' }}>
                      <td>{p?.nickname}</td>
                      <td align="center">{s.military}</td>
                      <td align="center">{s.treasury}</td>
                      <td align="center">{s.wonder}</td>
                      <td align="center">{s.blue}</td>
                      <td align="center">{s.yellow}</td>
                      <td align="center">{s.green}</td>
                      <td align="center">{s.purple}</td>
                      <td align="center" style={{ fontWeight: 700 }}>
                        {s.total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <button style={{ ...secondaryButton, marginTop: 16 }} onClick={() => navigate('/')}>
            ← Torna alla lobby
          </button>
        </div>
      </div>
    )
  }

  // ============================================================
  // UI — Turno di gioco
  // ============================================================
  const hand = myHand?.hand || []
  const iAmReady = myPlayer.ready_this_turn
  const myWonderSide = WONDERS[myPlayer.wonder_id]?.sides[myPlayer.wonder_side]
  const myNextStage = myWonderSide?.stages[myPlayer.wonder_stages_built || 0]
  const nextWonderStageLabel = myNextStage ? `${costLabel(myNextStage.cost)} → ${wonderStageLabel(myNextStage)}` : null
  const isLastTurnOfAge = game.turn_number >= 6
  const iCanPlayLastCard = isLastTurnOfAge && hasWonderStageAbility(myPlayer, 'play_last_card') && hand.length === 2
  const iCanFreeBuild =
    !isLastTurnOfAge && hasWonderStageAbility(myPlayer, 'build_from_hand_free') && myPlayer.free_build_used_age !== game.age && hand.length >= 2
  const bundleMode = iCanPlayLastCard ? 'last_card' : iCanFreeBuild ? 'free_build' : null
  const nextStageGivesDiscardBuild = myNextStage?.effectKind === 'build_from_discard'
  // In modalità bundle, dopo la prima scelta si mostra solo la carta
  // (o le carte) rimanenti per la seconda scelta.
  const visibleHand = bundleMode && bundlePrimaryChoice ? hand.filter((id) => id !== bundlePrimaryChoice.cardId) : hand


  return (
    <div style={page}>
      <div style={{ ...cardWide, width: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ ...title, margin: 0 }}>
            Epoca {AGE_ROMAN[game.age]} · Turno {game.turn_number}/6
          </h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: '0.85rem', color: '#5a5142' }} title="Tempo trascorso dall'avvio della partita">
              ⏱️ {formatElapsed(nowTick - new Date(game.started_at).getTime())}
            </span>
            <button onClick={() => navigate('/')} style={linkText}>
              ← Lobby
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '10px 0 16px' }}>
          {renderPlayerPanels()}
        </div>

        {iAmReady ? (
          <p style={{ textAlign: 'center', color: '#5a5142' }}>Hai scelto la tua carta — aspetto gli altri giocatori...</p>
        ) : discardPicker ? (
          <>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>🏛️ Halikarnassós: scegli una carta dagli scarti da costruire gratis</p>
            <p style={{ fontSize: '0.78rem', color: '#8a6a48', marginTop: -6 }}>
              (oppure salta: costruisci comunque lo stadio Meraviglia senza usare il potere)
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(game.discard_pile || [])
                .filter((id) => !(myPlayer.built_cards || []).includes(id))
                .map((discardCardId) => {
                  const card = getCardData(discardCardId)
                  if (!card) return null
                  return (
                    <div
                      key={discardCardId}
                      onClick={() =>
                        chooseAction(discardPicker.cardId, discardPicker.action, buyPreference, { cardId: discardCardId }, 'discard_build').then(() =>
                          setDiscardPicker(null)
                        )
                      }
                      style={{ border: '1px solid #e4ddcc', borderRadius: 10, padding: 10, width: 190, cursor: 'pointer', background: '#fff' }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {COLOR_LABEL[card.color]} {card.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3d3527', marginTop: 2 }}>{effectLabel(card)}</div>
                    </div>
                  )
                })}
              {(game.discard_pile || []).filter((id) => !(myPlayer.built_cards || []).includes(id)).length === 0 && (
                <p style={{ color: '#a89b86' }}>La pila degli scarti è vuota per ora.</p>
              )}
            </div>
            <button
              style={{ ...secondaryButton, marginTop: 10 }}
              onClick={() => {
                const p = discardPicker
                setDiscardPicker(null)
                chooseAction(p.cardId, p.action, buyPreference)
              }}
            >
              Salta, costruisci solo lo stadio
            </button>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>La tua mano:</p>
            {bundleMode && (
              <p style={{ fontSize: '0.78rem', color: '#8a6a48', marginTop: -6 }}>
                {bundleMode === 'last_card' ? (
                  <>🏛️ Grazie a Olympia puoi giocare anche l'ultima carta invece di scartarla.</>
                ) : (
                  <>🏛️ Grazie a Babilonia puoi costruire gratis una carta extra questo turno (1 volta/Epoca).</>
                )}{' '}
                {bundlePrimaryChoice
                  ? bundleMode === 'last_card'
                    ? 'Scegli ora cosa fare con la seconda carta.'
                    : "Scegli ora quale carta costruire gratis (o non usare il potere: risolvi normalmente l'altra)."
                  : "Scegli prima cosa fare con una carta, poi ti chiederò anche per l'altra."}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {visibleHand.map((cardId) => {
                const card = getCardData(cardId)
                if (!card) return null
                const selected = selectedCardId === cardId
                return (
                  <div
                    key={cardId}
                    onClick={() => {
                      setSelectedCardId(cardId)
                      setBuyPreference(null)
                    }}
                    style={{
                      position: 'relative',
                      border: selected ? '2px solid #8a6a48' : '1px solid #e4ddcc',
                      borderRadius: 10,
                      padding: '10px 10px 18px 10px',
                      width: 190,
                      cursor: 'pointer',
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {COLOR_LABEL[card.color]} {card.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#5a5142' }}>Costo: {costLabel(card.cost)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#3d3527', marginTop: 2 }}>{effectLabel(card)}</div>
                    {chainLabel(card).map((line, i) => (
                      <div key={i} style={{ fontSize: '0.7rem', color: '#8a6a48', marginTop: 2 }}>
                        {line}
                      </div>
                    ))}
                    {card.age && (
                      <span
                        title={`Epoca ${AGE_ROMAN[card.age]}`}
                        style={{
                          position: 'absolute',
                          right: 6,
                          bottom: 4,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#a89b86'
                        }}
                      >
                        {AGE_ROMAN[card.age]}
                      </span>
                    )}
                    {selected && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Object.keys(card.cost || {}).some((k) => k !== 'coins') && (
                          <div style={{ fontSize: '0.68rem', color: '#5a5142' }}>
                            Se possibile compra da:{' '}
                            <select value={buyPreference || ''} onChange={(e) => setBuyPreference(e.target.value || null)} style={{ fontSize: '0.68rem' }}>
                              <option value="">indifferente</option>
                              <option value="left">vicino sinistro</option>
                              <option value="right">vicino destro</option>
                            </select>
                          </div>
                        )}
                        {bundleMode === 'free_build' && bundlePrimaryChoice ? (
                          <button style={pillButton} onClick={() => chooseAction(cardId, 'build', null, bundlePrimaryChoice, 'free_build')}>
                            🏛️ Costruisci GRATIS con Babilonia
                          </button>
                        ) : (
                          <>
                            <button
                              style={pillButton}
                              onClick={() =>
                                bundleMode && !bundlePrimaryChoice
                                  ? setBundlePrimaryChoice({ cardId, action: 'build' })
                                  : chooseAction(cardId, 'build', buyPreference, bundlePrimaryChoice, bundleMode)
                              }
                            >
                              🏗️ Costruisci edificio
                            </button>
                            <button
                              style={pillButton}
                              onClick={() => {
                                if (nextStageGivesDiscardBuild) {
                                  setDiscardPicker({ cardId, action: 'wonder' })
                                } else if (bundleMode && !bundlePrimaryChoice) {
                                  setBundlePrimaryChoice({ cardId, action: 'wonder' })
                                } else {
                                  chooseAction(cardId, 'wonder', buyPreference, bundlePrimaryChoice, bundleMode)
                                }
                              }}
                              title={nextWonderStageLabel}
                            >
                              🏛️ Stadio Meraviglia{nextWonderStageLabel ? ` (${nextWonderStageLabel})` : ''}
                            </button>
                            <button
                              style={pillButton}
                              onClick={() =>
                                bundleMode && !bundlePrimaryChoice
                                  ? setBundlePrimaryChoice({ cardId, action: 'discard' })
                                  : chooseAction(cardId, 'discard', null, bundlePrimaryChoice, bundleMode)
                              }
                            >
                              💰 Vendi (+3🪙)
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {error && <p style={errorText}>{error}</p>}
      </div>
    </div>
  )
}
