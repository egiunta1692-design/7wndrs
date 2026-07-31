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
  computePurchasablePool,
  computeTradeDiscounts,
  hasFreeChain,
  canBuildCard,
  canBuildWonderStage,
  scoreGame,
  getCardData,
  computeColorCountingBonus,
  decideBotAction,
  pickRandomWonder
} from '../game-engine'
import Loader from '../components/Loader'
import Icon, { ImgIcon } from '../components/Icon'
import { page, cardWide, title, primaryButton, secondaryButton, pillButton, errorText, linkText } from '../styles/theme'

const COLOR_LABEL = { brown: '🟤', grey: '⚪', blue: '🔵', yellow: '🟡', red: '🔴', green: '🟢', purple: '🟣' }
const RESOURCE_ICON = { clay: '🧱', stone: '🪨', ore: '⛏️', wood: '🪵', glass: '🔷', loom: '🧵', papyrus: '📜' }
const RESOURCE_NAME = { clay: 'Argilla', stone: 'Pietra', ore: 'Minerale', wood: 'Legno', glass: 'Vetro', loom: 'Tessuto', papyrus: 'Papiro' }
const AGE_ROMAN = { 1: 'Ⅰ', 2: 'Ⅱ', 3: 'Ⅲ' }
const WONDER_SIDE_ICON = { A: '🏙️', B: '🌆' }
const WONDER_SIDE_NAME = { A: 'Giorno', B: 'Notte' }
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
// Descrive in forma compatta il riepilogo pubblico dell'ultimo turno
// risolto di un giocatore (vedi last_turn_log, scritto in Game.jsx al
// momento della risoluzione) — utile sia per verificare a colpo
// d'occhio che acquisti/incassi tornino, sia come informazione per gli
// altri giocatori su cosa è appena successo.
function joinWithSpace(items) {
  return items.reduce((acc, it, i) => (i === 0 ? [it] : [...acc, ' ', it]), [])
}

function lastTurnSummary(log) {
  if (!log) return null
  const actionIcon = { build: '🏗️', wonder: '🏛️', discard: '💰' }
  const parts = []
  for (const a of log.actions) {
    const bits = [actionIcon[a.action] || '']
    if (a.action === 'wonder') {
      // La carta usata "come carburante" per lo stadio non si rivela mai
      // (da regolamento resta coperta) — si mostra solo quale stadio è
      // stato costruito.
      bits.push(`Meraviglia ${STAGE_EMOJI[(a.stageIndex ?? 0) + 1] || (a.stageIndex ?? 0) + 1}`)
    } else if (a.action === 'build') {
      const card = a.cardId ? getCardData(a.cardId) : null
      if (card?.name) bits.push(card.name)
    }
    if (a.purchases?.length) {
      const left = a.purchases.filter((p) => p.neighbor === 'left')
      const right = a.purchases.filter((p) => p.neighbor === 'right')
      if (left.length)
        bits.push(
          <span key="l">
            ◄
            {left.map((p, i) => (
              <span key={i}>{resIconNode(p.resource)}</span>
            ))}
          </span>
        )
      if (right.length)
        bits.push(
          <span key="r">
            {right.map((p, i) => (
              <span key={i}>{resIconNode(p.resource)}</span>
            ))}
            ►
          </span>
        )
    }
    if (a.coinCost)
      bits.push(
        <span key="cost">
          -{a.coinCost}
          <ImgIcon name="coin" size={11} />
        </span>
      )
    if (a.bonusCoins)
      bits.push(
        <span key="bonus">
          +{a.bonusCoins}
          <ImgIcon name="coin" size={11} />
        </span>
      )
    parts.push(
      <span key={parts.length} style={{ marginRight: 10 }}>
        {joinWithSpace(bits)}
      </span>
    )
  }
  return (
    <span>
      {parts}
      {log.paymentsReceived > 0 && (
        <span style={{ marginRight: 10 }}>
          +{log.paymentsReceived}
          <ImgIcon name="coin" size={11} />
        </span>
      )}
      <span style={{ color: '#a89b86' }}>
        ({log.coinsBefore}
        <ImgIcon name="coin" size={11} /> → {log.coinsAfter}
        <ImgIcon name="coin" size={11} />)
      </span>
    </span>
  )
}

function tradeDiscountSummary(player) {
  const d = computeTradeDiscounts(player)
  const leftArr = [...d.left]
  const rightArr = [...d.right]
  if (leftArr.length === 0 && rightArr.length === 0) return null
  const iconsRow = (arr) => arr.map((r) => <span key={r}>{resIconNode(r)}</span>)
  // Ogni risorsa va mostrata UNA sola volta, con la freccia giusta: ◄
  // se scontata solo da sinistra, ► solo da destra, entrambe se scontata
  // da tutti e due i vicini (anche in caso di sovrapposizione parziale,
  // non solo quando le due liste coincidono esattamente).
  const both = leftArr.filter((r) => rightArr.includes(r))
  const leftOnly = leftArr.filter((r) => !rightArr.includes(r))
  const rightOnly = rightArr.filter((r) => !leftArr.includes(r))
  const parts = []
  if (leftOnly.length > 0) parts.push(<span key="l">◄{iconsRow(leftOnly)}</span>)
  if (both.length > 0)
    parts.push(
      <span key="b">
        ◄{iconsRow(both)}►
      </span>
    )
  if (rightOnly.length > 0) parts.push(<span key="r">{iconsRow(rightOnly)}►</span>)
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? ' ' : ''}
          {p}
        </span>
      ))}
    </>
  )
}

// Capisce se, per costruire questa carta, serve DAVVERO commerciare con
// qualcuno (cioè restano risorse non coperte dalla produzione propria)
// e, in tal caso, quali dei due vicini possono effettivamente fornirne
// almeno una — così il selettore "compra da" in Game.jsx può: sparire
// del tutto se il commercio non serve, mostrarsi bloccato sull'unico
// vicino possibile se la scelta è obbligata, oppure offrire davvero
// "indifferente" solo quando la scelta è genuina fra i due.
function tradeOptionsFor(cost, player, leftNeighbor, rightNeighbor) {
  const { fixed } = computeProduction(player)
  const remaining = []
  for (const [resource, amount] of Object.entries(cost || {})) {
    if (resource === 'coins') continue
    const owned = fixed[resource] || 0
    if (amount > owned) remaining.push(resource)
  }
  if (remaining.length === 0) return { needed: false, canLeft: false, canRight: false }

  function poolHasAny(neighbor) {
    if (!neighbor) return false
    const pool = computePurchasablePool(neighbor)
    return remaining.some((r) => (pool.fixed[r] || 0) > 0 || pool.choiceGenerators.some((gen) => gen.includes(r)))
  }
  return { needed: true, canLeft: poolHasAny(leftNeighbor), canRight: poolHasAny(rightNeighbor) }
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
  if (cost.coins)
    parts.push(
      <span key="coins">
        {cost.coins}
        <ImgIcon name="coin" size={12} title="monete" />
      </span>
    )
  for (const [r, n] of Object.entries(cost)) {
    if (r === 'coins') continue
    if (r === 'stone' || r === 'wood') {
      parts.push(
        <span key={r}>
          {n}
          <ImgIcon name={r} size={12} title={r} />
        </span>
      )
    } else {
      parts.push(`${n}${RESOURCE_ICON[r] || r}`)
    }
  }
  if (parts.length === 0) return 'Gratis'
  return parts.reduce((acc, p, i) => (i === 0 ? [p] : [...acc, ' ', p]), [])
}

// Variante SOLO TESTO di costLabel (emoji anche per pietra/legno/monete,
// mai icone SVG) — da usare SOLO dove serve per forza una stringa
// semplice (attributi title, tooltip nativi del browser), che non
// possono contenere elementi React.
function costLabelText(cost = {}) {
  const parts = []
  if (cost.coins) parts.push(`${cost.coins}🪙`)
  for (const [r, n] of Object.entries(cost)) {
    if (r === 'coins') continue
    const icon = r === 'stone' ? '🪨' : r === 'wood' ? '🪵' : RESOURCE_ICON[r] || r
    parts.push(`${n}${icon}`)
  }
  return parts.length ? parts.join(' ') : 'Gratis'
}

// Risorsa come nodo React: icona SVG per pietra/legno (fornite
// dall'utente), emoji per le altre (nessun problema di compatibilità).
function resIconNode(r, key) {
  if (r === 'stone' || r === 'wood') return <ImgIcon key={key} name={r} size={12} title={r} />
  return RESOURCE_ICON[r] || r
}
function colorIconNode(color, key) {
  return <Icon key={key} name={`color_${color}`} size={12} />
}

// Descrizione leggibile dell'effetto di una carta Epoca (usata sia
// nelle carte in mano che nei "chip" delle città costruite).
function cardEffectLabel(card, neighbors = {}) {
  const e = card.effect
  if (!e) return ''
  switch (e.kind) {
    case 'produce_fixed':
      return (
        <>
          +{e.amount || 1}
          {resIconNode(e.value)}
        </>
      )
    case 'produce_choice':
      return (
        <>
          +1 a scelta:{' '}
          {e.value.map((r, i) => (
            <span key={r}>
              {i > 0 ? '/' : ''}
              {resIconNode(r)}
            </span>
          ))}
        </>
      )
    case 'vp':
      return `+${e.value}🏆`
    case 'coins_on_build':
      return (
        <>
          +{e.value}
          <ImgIcon name="coin" size={12} title="monete" />
        </>
      )
    case 'shields':
      return `+${e.value}⚔️`
    case 'science':
      return `Simbolo scientifico: ${SCIENCE_ICON[e.value] || e.value}`
    case 'trade_discount': {
      const hasLeft = e.value.neighbors.includes('left')
      const hasRight = e.value.neighbors.includes('right')
      const who = e.value.neighbors
        .map((n) => (n === 'left' ? `sinistro${neighbors.left ? ` (${neighbors.left})` : ''}` : `destro${neighbors.right ? ` (${neighbors.right})` : ''}`))
        .join('/')
      return (
        <>
          1<ImgIcon name="coin" size={12} title="monete" /> per acquistare dal vicino {who}: {hasLeft && '◄'}
          {e.value.resources.map((r, i) => (
            <span key={r}>
              {i > 0 ? ' ' : ''}
              {resIconNode(r)}
            </span>
          ))}
          {hasRight && '►'}
        </>
      )
    }
    case 'coins_per_color': {
      const { color, coinsEach, scope } = e.value
      return (
        <>
          +{coinsEach}
          <ImgIcon name="coin" size={12} title="monete" /> per ogni carta {colorIconNode(color)} {COLOR_NAME[color]}{' '}
          {scope === 'self_and_neighbors' ? '(tua città + vicini)' : '(tua città)'}
        </>
      )
    }
    case 'per_color_coins_and_vp': {
      const { color, coinsEach, vpEach } = e.value
      return (
        <>
          +{coinsEach}
          <ImgIcon name="coin" size={12} title="monete" /> alla costruzione e +{vpEach}🏆 a fine partita, per ogni carta {colorIconNode(color)}{' '}
          {COLOR_NAME[color]} in città
        </>
      )
    }
    case 'coins_and_vp_per_wonder_stage':
      return (
        <>
          +{e.value.coinsEach}
          <ImgIcon name="coin" size={12} title="monete" /> e +{e.value.vpEach}🏆 per ogni stadio della tua Meraviglia
        </>
      )
    case 'science_choice':
      return `+1 a scelta: 🧭/⚙️/📝`
    default:
      return ''
  }
}

// Descrizione leggibile dell'effetto di una Gilda (carta Viola).
function guildEffectLabel(card) {
  switch (card.scoringKind) {
    case 'per_color_in_neighbors':
      return (
        <>
          +{card.scoringValue.vpEach}🏆 per ogni carta {colorIconNode(card.scoringValue.color)} {COLOR_NAME[card.scoringValue.color]} nelle città dei vicini
        </>
      )
    case 'per_wonder_stage_self_and_neighbors':
      return `+${card.scoringValue.vpEach}🏆 per ogni stadio Meraviglia (tuo + vicini)`
    case 'all_wonder_stages_flat':
      return `+${card.scoringValue.vp}🏆 se hai completato tutti gli stadi della tua Meraviglia`
    case 'per_brown_grey_purple_self':
      return `+${card.scoringValue.vpEach}🏆 per ogni carta Marrone/Grigia/Viola nella tua città`
    case 'science_choice':
      return `+1 a scelta: 🧭/⚙️/📝`
    default:
      return ''
  }
}

function effectLabel(card, neighbors = {}) {
  return card.color === 'purple' ? guildEffectLabel(card) : cardEffectLabel(card, neighbors)
}

// Descrizione leggibile dell'effetto di uno stadio di Meraviglia.
function wonderStageLabel(stage, neighbors = {}) {
  const extras = []
  if (stage.extraVp) extras.push(`+${stage.extraVp}🏆`)
  if (stage.extraMilitary) extras.push(`+${stage.extraMilitary}⚔️`)
  const suffix = extras.length ? <> ({extras.join(' ')})</> : null
  let base
  switch (stage.effectKind) {
    case 'vp':
      base = `+${stage.effectValue}🏆`
      break
    case 'coins':
      base = (
        <>
          +{stage.effectValue}
          <ImgIcon name="coin" size={12} title="monete" />
        </>
      )
      break
    case 'vp_and_coins':
      base = (
        <>
          +{stage.effectValue.vp}🏆 +{stage.effectValue.coins}
          <ImgIcon name="coin" size={12} title="monete" />
        </>
      )
      break
    case 'produce_choice':
      base = (
        <>
          +1 a scelta:{' '}
          {stage.effectValue.map((r, i) => (
            <span key={r}>
              {i > 0 ? '/' : ''}
              {resIconNode(r)}
            </span>
          ))}
        </>
      )
      break
    case 'military':
      base = `+${stage.effectValue}⚔️`
      break
    case 'science':
      base =
        `+${stage.effectValue} a scelta: 🧭/⚙️/📝`
      break
    case 'trade_discount': {
      const hasLeftW = stage.effectValue.neighbors.includes('left')
      const hasRightW = stage.effectValue.neighbors.includes('right')
      base = (
        <>
          1<ImgIcon name="coin" size={12} title="monete" /> per acquistare: {hasLeftW && `◄${neighbors.left ? `(${neighbors.left})` : ''}`}
          {stage.effectValue.resources.map((r, i) => (
            <span key={r}>
              {i > 0 ? ' ' : ''}
              {resIconNode(r)}
            </span>
          ))}
          {hasRightW && `${neighbors.right ? `(${neighbors.right})` : ''}►`}
        </>
      )
      break
    }
    case 'build_from_hand_free':
      base = `Costruisci gratis dalla mano (1 volta/Epoca)`
      break
    case 'build_from_discard':
      base = `Costruisci gratis dagli scarti`
      break
    case 'play_last_card':
      base = `Puoi giocare l'ultima carta di ogni Epoca`
      break
    case 'build_first_color_free':
      base = `Costruisci gratis la prima carta di ogni colore`
      break
    case 'build_first_age_free':
      base = `Costruisci gratis la prima carta di ogni Epoca`
      break
    case 'build_last_age_free':
      base = `Costruisci gratis l'ultima carta di ogni Epoca`
      break
    case 'copy_guild':
      base = `Copia una Gilda di un vicino a fine partita`
      break
    default:
      base = ''
  }
  return suffix ? (
    <>
      {base}
      {suffix}
    </>
  ) : (
    base
  )
}

// Variante SOLO TESTO di wonderStageLabel (emoji anche per pietra/legno/
// monete, mai icone SVG) — da usare SOLO dove serve per forza una
// stringa semplice (attributi title), che non può contenere JSX.
function iconTextFor(r) {
  return r === 'stone' ? '🪨' : r === 'wood' ? '🪵' : RESOURCE_ICON[r] || r
}
function wonderStageLabelText(stage, neighbors = {}) {
  const extras = []
  if (stage.extraVp) extras.push(`+${stage.extraVp}🏆`)
  if (stage.extraMilitary) extras.push(`+${stage.extraMilitary}⚔️`)
  const suffix = extras.length ? ` (${extras.join(' ')})` : ''
  let base
  switch (stage.effectKind) {
    case 'vp':
      base = `+${stage.effectValue}🏆`
      break
    case 'coins':
      base = `+${stage.effectValue}🪙`
      break
    case 'vp_and_coins':
      base = `+${stage.effectValue.vp}🏆 +${stage.effectValue.coins}🪙`
      break
    case 'produce_choice':
      base = `+1 a scelta: ${stage.effectValue.map(iconTextFor).join(' ')}`
      break
    case 'military':
      base = `+${stage.effectValue}⚔️`
      break
    case 'science':
      base = `+${stage.effectValue} a scelta: 🧭/⚙️/📝`
      break
    case 'trade_discount': {
      const hasLeftW = stage.effectValue.neighbors.includes('left')
      const hasRightW = stage.effectValue.neighbors.includes('right')
      const icons = stage.effectValue.resources.map(iconTextFor).join(' ')
      const left = hasLeftW ? `◄${neighbors.left ? `(${neighbors.left})` : ''}` : ''
      const right = hasRightW ? `${neighbors.right ? `(${neighbors.right})` : ''}►` : ''
      base = `1🪙 per acquistare: ${left}${icons}${right}`
      break
    }
    case 'build_from_hand_free':
      base = `Costruisci gratis dalla mano (1 volta/Epoca)`
      break
    case 'build_from_discard':
      base = `Costruisci gratis dagli scarti`
      break
    case 'play_last_card':
      base = `Puoi giocare l'ultima carta di ogni Epoca`
      break
    case 'build_first_color_free':
      base = `Costruisci gratis la prima carta di ogni colore`
      break
    case 'build_first_age_free':
      base = `Costruisci gratis la prima carta di ogni Epoca`
      break
    case 'build_last_age_free':
      base = `Costruisci gratis l'ultima carta di ogni Epoca`
      break
    case 'copy_guild':
      base = `Copia una Gilda di un vicino a fine partita`
      break
    default:
      base = ''
  }
  return base + suffix
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
  const [bundlePrimaryChoice, setBundlePrimaryChoice] = useState(null) // { cardId, action } — Babilonia lato B "gioca l'ultima carta" (nessuna Meraviglia usa più "costruisci gratis dalla mano" nei dati attuali)
  const [discardPicker, setDiscardPicker] = useState(null) // { cardId, action } della carta principale, in attesa di scelta dagli scarti (Halikarnassós)
  const [showBoard, setShowBoard] = useState(false)
  const [expandedPlayerIds, setExpandedPlayerIds] = useState(null) // null = default (solo il tuo pannello espanso); altrimenti Set esplicito dei pannelli aperti
  const [nowTick, setNowTick] = useState(Date.now())
  const [confirmingDeleteRoom, setConfirmingDeleteRoom] = useState(false)
  const [confirmingLeaveRoom, setConfirmingLeaveRoom] = useState(false)

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
  const isCreator = !!(myUserId && game?.created_by && game.created_by === myUserId)
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
  const myNeighborNicknames = { left: leftNeighbor?.nickname, right: rightNeighbor?.nickname }

  // ============================================================
  // WAITING ROOM: scelta Meraviglia + avvio partita
  // ============================================================
  const chosenWonderIds = new Set(players.filter((p) => p.wonder_id).map((p) => p.wonder_id))

  async function chooseWonder(wonderId, side) {
    setError(null)
    const { error } = await supabase.from('players').update({ wonder_id: wonderId, wonder_side: side }).eq('id', myPlayer.id)
    if (error) {
      // Codice 23505 = vincolo unico violato (players_unique_wonder_pick):
      // qualcun altro ha scelto la stessa Meraviglia+lato un istante
      // prima. Messaggio chiaro invece dell'errore tecnico grezzo — la
      // lista si aggiorna comunque da sola appena arriva l'evento realtime.
      setError(error.code === '23505' ? 'Qualcun altro ha appena scelto questa Meraviglia — riprova con un\'altra.' : error.message)
    }
  }

  async function cancelWonder() {
    await supabase.from('players').update({ wonder_id: null, wonder_side: null }).eq('id', myPlayer.id)
  }

  async function flipWonderSide() {
    setError(null)
    const newSide = myPlayer.wonder_side === 'A' ? 'B' : 'A'
    const { error } = await supabase.from('players').update({ wonder_side: newSide }).eq('id', myPlayer.id)
    if (error) {
      setError(error.code === '23505' ? "Il lato opposto è appena stato preso da qualcun altro con questa stessa Meraviglia — riprova." : error.message)
    }
  }

  // Crea un giocatore "robot": nessuna sessione propria (user_id
  // generato lato client, mai autenticato davvero — vedi RLS in
  // schema.sql che permette a QUALUNQUE umano già nella partita di
  // gestirlo), Meraviglia scelta subito a caso tra quelle libere.
  async function addBot() {
    setError(null)
    try {
      const botUserId = crypto.randomUUID()
      const botNumber = players.filter((p) => p.is_bot).length + 1
      const { data: inserted, error: insertError } = await supabase
        .from('players')
        .insert({ game_id: gameId, user_id: botUserId, nickname: `🤖 Bot ${botNumber}`, is_bot: true })
        .select()
        .single()
      if (insertError) throw insertError
      const { error: handError } = await supabase.from('player_hands').insert({ game_id: gameId, player_id: inserted.id, user_id: botUserId, hand: [] })
      if (handError) throw handError
      const available = WONDER_IDS.filter((id) => !chosenWonderIds.has(id))
      const pick = pickRandomWonder(available)
      if (pick) {
        await supabase.from('players').update({ wonder_id: pick.wonderId, wonder_side: pick.side }).eq('id', inserted.id)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // Rimuove un bot: basta cancellare la riga players (is_bot=true, la
  // policy dedicata permette a chiunque nella partita di farlo) — la
  // riga player_hands sparisce da sola grazie a "on delete cascade", e
  // la sua Meraviglia torna automaticamente disponibile per chiunque
  // (chosenWonderIds si ricalcola dai players rimasti).
  async function removeBot(botId) {
    setError(null)
    const { error } = await supabase.from('players').delete().eq('id', botId).eq('is_bot', true)
    if (error) setError(error.message)
  }

  // Solo il creatore può eliminare l'intera stanza (e solo prima
  // dell'avvio, protetto anche lato database) — cancellazione a cascata,
  // elimina automaticamente tutti i giocatori e le loro mani.
  async function deleteRoom() {
    setError(null)
    const { error } = await supabase.from('games').delete().eq('id', gameId)
    if (error) setError(error.message)
    else navigate('/')
  }

  // Un giocatore che NON è il creatore può abbandonare la stanza (e solo
  // prima dell'avvio, protetto anche lato database) — il creatore non
  // può usare questa funzione, la policy la rifiuterebbe comunque.
  async function leaveRoom() {
    setError(null)
    const { error } = await supabase.from('players').delete().eq('id', myPlayer.id)
    if (error) setError(error.message)
    else navigate('/')
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
    const dealtRow = { ...myHand, hand, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, outgoing_hand_turn: null, dealt_age: game.age }
    supabase
      .from('player_hands')
      .update({ hand, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, outgoing_hand_turn: null, dealt_age: game.age })
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

  // Come sopra, ma per i bot: nessun browser proprio esegue questa
  // distribuzione per loro, quindi la fa per conto loro qualunque umano
  // connesso — stesso principio del pilota automatico delle mosse.
  const dealingBotsRef = useRef(false)
  useEffect(() => {
    if (!game || game.status !== 'playing') return
    if (!isCreator) return
    const deck = game.age_decks?.[String(game.age)]
    if (!deck) return
    if (dealingBotsRef.current) return
    const bots = players.filter((p) => p.is_bot)
    const botsToDeal = bots
      .map((bot) => ({ bot, hand: myHandRows.find((h) => h.player_id === bot.id) }))
      .filter(({ hand }) => hand && hand.dealt_age !== game.age)
    if (botsToDeal.length === 0) return
    dealingBotsRef.current = true
    ;(async () => {
      for (const { bot, hand } of botsToDeal) {
        const botSeat = turnOrder.indexOf(bot.id)
        if (botSeat < 0) continue
        const dealt = dealHandForSeat(deck, botSeat)
        if (dealt.length !== HAND_SIZE) {
          console.error('[dealHand] MANO BOT ANOMALA, non salvo:', { botId: bot.id, botSeat, dealt })
          continue
        }
        const { error } = await supabase
          .from('player_hands')
          .update({ hand: dealt, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, outgoing_hand_turn: null, dealt_age: game.age })
          .eq('id', hand.id)
        if (error) console.error('[dealHand] errore distribuzione mano bot:', bot.nickname, error)
      }
      dealingBotsRef.current = false
    })()
  }, [game, players, myHandRows, turnOrder, isCreator])

  // ============================================================
  // SCELTA DELLA CARTA (fase di commit) — calcola SUBITO il costo
  // guardando lo stato attuale dei vicini, cosi' l'applicazione
  // successiva non dipende piu' da loro (vedi prepareAction).
  // ============================================================
  // Versione parametrizzata di "scegli la carta": accetta QUALUNQUE
  // giocatore bersaglio (io stesso, o un bot che sto guidando) invece di
  // usare sempre myPlayer/myHand/mySeat — così la logica (rilettura
  // fresca, calcolo vicini, invio mano con numero di turno) resta UNA
  // sola, riusata sia dai click umani sia dal pilota automatico dei bot.
  async function chooseActionFor(targetPlayer, targetHand, targetSeat, cardId, action, preference = null, bundleWith = null, bundleType = 'last_card') {
    const targetLeftNeighbor = seatToPlayer[leftNeighborSeat(targetSeat, numPlayers)] || null
    const targetRightNeighbor = seatToPlayer[rightNeighborSeat(targetSeat, numPlayers)] || null

    // Rilegge freschi dal database il bersaglio e i suoi vicini
    // (produzione, carte costruite, monete) invece di fidarsi dello
    // stato React — importante soprattutto per i bot, il cui stato
    // locale potrebbe non riflettere una risoluzione appena avvenuta.
    const idsToRefresh = [targetPlayer.id, targetLeftNeighbor?.id, targetRightNeighbor?.id].filter(Boolean)
    const { data: freshRows, error: freshRowsError } = await supabase.from('players').select().in('id', idsToRefresh)
    if (freshRowsError) console.error('[chooseAction] errore rilettura giocatori freschi:', freshRowsError)
    const freshTargetPlayer = freshRows?.find((p) => p.id === targetPlayer.id) || targetPlayer
    const freshLeftNeighbor = targetLeftNeighbor ? freshRows?.find((p) => p.id === targetLeftNeighbor.id) || targetLeftNeighbor : null
    const freshRightNeighbor = targetRightNeighbor ? freshRows?.find((p) => p.id === targetRightNeighbor.id) || targetRightNeighbor : null

    const gameContext = { age: game.age, turnNumber: game.turn_number }
    let prepared
    if (bundleWith && bundleType === 'free_build') {
      prepared = prepareFreeBuildBundle(action, cardId, bundleWith.cardId, freshTargetPlayer, freshLeftNeighbor, freshRightNeighbor, preference, gameContext)
    } else if (bundleWith && bundleType === 'discard_build') {
      prepared = prepareDiscardBuildBundle(action, cardId, bundleWith.cardId, freshTargetPlayer, freshLeftNeighbor, freshRightNeighbor, preference, gameContext)
    } else if (bundleWith) {
      prepared = prepareLastTurnBundle(action, cardId, bundleWith.action, bundleWith.cardId, freshTargetPlayer, freshLeftNeighbor, freshRightNeighbor, preference, gameContext)
    } else {
      prepared = prepareAction(action, cardId, freshTargetPlayer, freshLeftNeighbor, freshRightNeighbor, preference, gameContext)
    }
    // Rilegge la mano fresca dal database invece di fidarsi dello stato
    // React — stessa cautela già usata altrove in questo file.
    const { data: freshOwnHand } = await supabase.from('player_hands').select('hand').eq('id', targetHand.id).single()
    const currentHand = freshOwnHand?.hand ?? targetHand.hand ?? []
    const playedCardIds = bundleWith ? [cardId, bundleWith.cardId] : [cardId]
    const remainingHand = currentHand.filter((id) => !playedCardIds.includes(id))
    const isLastTurnOfAge = game.turn_number >= 6
    const allPurchases = bundleWith ? [...(prepared.primary.purchases || []), ...(prepared.bonus.purchases || [])] : prepared.purchases || []

    // Al turno 6, se non si ha il potere di Olympia ("gioca l'ultima
    // carta di ogni Epoca", gestito con un bundle a parte che consuma
    // ENTRAMBE le carte), la carta NON scelta va scartata per regolamento
    // — e finisce nella pila condivisa come qualunque altro scarto,
    // pescabile da Halikarnassós. La si registra qui, nell'azione
    // preparata, per poterla aggiungere alla pila alla risoluzione.
    if (isLastTurnOfAge && !bundleWith && remainingHand.length > 0) {
      prepared.turn6Leftover = remainingHand[0]
    }

    // Traduce il piano d'acquisto (chi/quanto) in importi dovuti ai
    // vicini reali, indirizzati alla loro user_id: ognuno di loro se
    // li accrediterà da solo durante la risoluzione del proprio turno
    // (vedi sotto) — nessun client scrive mai il saldo di un altro.
    const paymentsOut = {}
    for (const purchase of allPurchases) {
      const neighbor = purchase.neighbor === 'left' ? freshLeftNeighbor : freshRightNeighbor
      if (!neighbor) continue
      const key = neighbor.user_id
      if (!paymentsOut[key]) paymentsOut[key] = { amount: 0, turn: game.turn_number }
      paymentsOut[key].amount += purchase.unitCost
    }

    const update = { pending_action: prepared, payments_out: paymentsOut }
    if (!isLastTurnOfAge) {
      const recipientSeat = passRecipientSeat(game.age, targetSeat, numPlayers)
      const recipient = seatToPlayer[recipientSeat]
      if (!recipient) {
        // Non dovrebbe MAI succedere (turn_order è fisso per tutta la
        // partita) — se capita, meglio un errore rumoroso e visibile
        // che un invio silenzioso a nessuno (causa nota di "mano vuota").
        console.error('[chooseAction] destinatario mancante!', {
          targetSeat,
          recipientSeat,
          numPlayers,
          turnOrder,
          seatToPlayer: Object.fromEntries(Object.entries(seatToPlayer).map(([k, v]) => [k, v?.id]))
        })
        throw new Error('Errore interno: destinatario della mano non trovato. Riprova, e se persiste segnalalo.')
      }
      console.log(
        '[chooseAction] turno',
        game.turn_number,
        'per',
        targetPlayer.nickname,
        'invio mano residua a',
        recipient.nickname,
        'seat',
        recipientSeat,
        'user_id',
        recipient.user_id,
        'carte:',
        remainingHand,
        '(mano attuale letta fresca:',
        currentHand,
        ')'
      )
      update.outgoing_hand = remainingHand
      update.outgoing_hand_for = recipient.user_id
      update.outgoing_hand_turn = game.turn_number
    } else {
      update.outgoing_hand = null
      update.outgoing_hand_for = null
      update.outgoing_hand_turn = null
    }
    await supabase.from('player_hands').update(update).eq('id', targetHand.id)
    await supabase.from('players').update({ ready_this_turn: true }).eq('id', targetPlayer.id)
  }

  // ============================================================
  // SCELTA DELLA CARTA (fase di commit) — calcola SUBITO il costo
  // guardando lo stato attuale dei vicini, cosi' l'applicazione
  // successiva non dipende piu' da loro (vedi prepareAction).
  // ============================================================
  const choosingRef = useRef(false)
  async function chooseAction(cardId, action, preference = null, bundleWith = null, bundleType = 'last_card') {
    if (choosingRef.current) return // anti doppio-click: una scelta alla volta
    choosingRef.current = true
    setError(null)
    try {
      await chooseActionFor(myPlayer, myHand, mySeat, cardId, action, preference, bundleWith, bundleType)
      setSelectedCardId(null)
      setBuyPreference(null)
      setBundlePrimaryChoice(null)
    } catch (err) {
      setError(err.message)
    } finally {
      choosingRef.current = false
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
  // Versione parametrizzata della risoluzione turno: accetta QUALUNQUE
  // giocatore bersaglio (io stesso, o un bot che sto guidando). Stessa
  // identica logica di sempre (riletture fresche, guardia atomica su
  // turn_applied, numero di turno sul passaggio mano) — vedi i tanti
  // commenti storici qui sotto per il perché di ogni singola cautela.
  async function resolvePlayerTurn(targetPlayer, targetHand) {
    try {
      const { data: freshHand, error: freshHandError } = await supabase.from('player_hands').select().eq('id', targetHand.id).single()
      if (freshHandError) console.error('[resolveTurn] errore rilettura mano propria:', freshHandError)
      const prepared = freshHand?.pending_action
      if (!prepared) {
        return
      }

      // IMPORTANTE: si rilegge fresco anche il giocatore invece di usare
      // lo stato React (che riflette l'ultimo evento realtime ricevuto e
      // può essere leggermente indietro rispetto al vero saldo nel
      // database in questo preciso istante). Calcolare il nuovo saldo da
      // un valore non aggiornato è la causa più probabile di eventuali
      // monete negative residue.
      const { data: freshPlayer, error: freshPlayerError } = await supabase.from('players').select().eq('id', targetPlayer.id).single()
      if (freshPlayerError) console.error('[resolveTurn] errore rilettura giocatore proprio:', freshPlayerError)
      const baselinePlayer = freshPlayer || targetPlayer

      const updatedPublic = applyPreparedActionOrBundle(prepared, baselinePlayer)
      const isLastTurnOfAge = game.turn_number >= 6

      // Vigneto/Bazar/Faro/Porto/Camera di Commercio/Palestra
      // Gladiatoria/Arena: il conteggio va fatto ORA, dopo l'azione di
      // questo turno, e deve includere ANCHE le carte che i vicini
      // stanno costruendo in QUESTO STESSO turno — per regolamento le
      // carte si giocano tutte simultaneamente, non in sequenza. Si
      // inietta il risultato nel bonusCoins della azione stessa (invece
      // di sommarlo solo al saldo) così il riepilogo "Turno precedente"
      // e il controllo di coerenza restano corretti a valle.
      const builtThisTurnByMe = []
      if (prepared.bundle) {
        if (prepared.primary?.action === 'build') builtThisTurnByMe.push(prepared.primary)
        if (prepared.bonus?.action === 'build') builtThisTurnByMe.push(prepared.bonus)
      } else if (prepared.action === 'build') {
        builtThisTurnByMe.push(prepared)
      }
      if (builtThisTurnByMe.length > 0) {
        const targetSeat = turnOrder.indexOf(targetPlayer.id)
        const targetLeftNeighbor = seatToPlayer[leftNeighborSeat(targetSeat, numPlayers)] || null
        const targetRightNeighbor = seatToPlayer[rightNeighborSeat(targetSeat, numPlayers)] || null
        const neighborIds = [targetLeftNeighbor?.id, targetRightNeighbor?.id].filter(Boolean)
        const [{ data: freshNeighbors }, { data: neighborHands }] = await Promise.all([
          neighborIds.length ? supabase.from('players').select().in('id', neighborIds) : Promise.resolve({ data: [] }),
          neighborIds.length ? supabase.from('player_hands').select('player_id, pending_action').in('player_id', neighborIds) : Promise.resolve({ data: [] })
        ])
        const freshLeft = targetLeftNeighbor ? freshNeighbors?.find((p) => p.id === targetLeftNeighbor.id) || targetLeftNeighbor : null
        const freshRight = targetRightNeighbor ? freshNeighbors?.find((p) => p.id === targetRightNeighbor.id) || targetRightNeighbor : null
        function builtThisTurnBy(neighborId) {
          const pa = neighborHands?.find((h) => h.player_id === neighborId)?.pending_action
          if (!pa) return []
          if (pa.bundle) return [pa.primary, pa.bonus].filter((a) => a?.action === 'build').map((a) => a.cardId)
          return pa.action === 'build' ? [pa.cardId] : []
        }
        const leftBuiltThisTurn = targetLeftNeighbor ? builtThisTurnBy(targetLeftNeighbor.id) : []
        const rightBuiltThisTurn = targetRightNeighbor ? builtThisTurnBy(targetRightNeighbor.id) : []
        for (const actionEntry of builtThisTurnByMe) {
          const card = getCardData(actionEntry.cardId)
          const extraBonus = computeColorCountingBonus(card, updatedPublic, freshLeft, freshRight, leftBuiltThisTurn, rightBuiltThisTurn)
          if (extraBonus) {
            actionEntry.bonusCoins = (actionEntry.bonusCoins || 0) + extraBonus
            updatedPublic.coins += extraBonus
          }
        }
      }

      // Incassa eventuali pagamenti che i vicini devono per risorse
      // comprate DA QUESTO GIOCATORE questo turno (vedi chooseActionFor:
      // chi acquista indirizza l'importo qui, leggibile grazie alla
      // policy RLS dedicata). Si accredita solo se il pagamento è per
      // QUESTO turno — evita di incassare due volte lo stesso importo se
      // il vicino non ha ancora sovrascritto payments_out con una nuova
      // scelta (persiste finché non fa un nuovo acquisto).
      const { data: creditRows, error: creditError } = await supabase.from('player_hands').select('user_id, payments_out').eq('game_id', gameId)
      if (creditError) console.error('[resolveTurn] errore lettura pagamenti dovuti:', creditError)
      let owedToMe = 0
      for (const row of creditRows || []) {
        const entry = row.payments_out?.[targetPlayer.user_id]
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
          playerId: targetPlayer.id,
          baselineCoins: baselinePlayer.coins,
          prepared,
          computedCoins: updatedPublic.coins
        })
        updatedPublic.coins = 0
      }

      // Riepilogo PUBBLICO di questo turno (chi ha giocato cosa, cosa ha
      // comprato da chi e a che prezzo, quanto ha incassato dai vicini,
      // saldo prima/dopo) — salvato sulla riga pubblica del giocatore,
      // serve sia a verificare che il commercio funzioni correttamente
      // sia come informazione trasparente per tutti in tavola.
      const actions = prepared.bundle
        ? [
            {
              action: prepared.primary.action,
              cardId: prepared.primary.cardId,
              coinCost: prepared.primary.coinCost,
              bonusCoins: prepared.primary.bonusCoins,
              purchases: prepared.primary.purchases || [],
              stageIndex: prepared.primary.stageIndex
            },
            {
              action: prepared.bonus.action,
              cardId: prepared.bonus.cardId,
              coinCost: prepared.bonus.coinCost,
              bonusCoins: prepared.bonus.bonusCoins,
              purchases: prepared.bonus.purchases || [],
              stageIndex: prepared.bonus.stageIndex,
              bonusVia: prepared.kind
            }
          ]
        : [
            {
              action: prepared.action,
              cardId: prepared.cardId,
              coinCost: prepared.coinCost,
              bonusCoins: prepared.bonusCoins,
              purchases: prepared.purchases || [],
              stageIndex: prepared.stageIndex
            }
          ]
      const lastTurnLog = {
        turn: game.turn_number,
        age: game.age,
        actions,
        paymentsReceived: owedToMe,
        coinsBefore: baselinePlayer.coins,
        coinsAfter: updatedPublic.coins
      }

      // Controllo di coerenza: il saldo dopo deve tornare esattamente da
      // saldo prima meno i costi totali più i bonus e gli incassi. Se
      // non torna, è un bug vero — lo segnaliamo forte con tutti i
      // numeri invece di scoprirlo solo "a occhio" dall'interfaccia.
      const totalCoinCost = actions.reduce((s, a) => s + (a.coinCost || 0), 0)
      const totalBonusCoins = actions.reduce((s, a) => s + (a.bonusCoins || 0), 0)
      const expectedCoinsAfter = baselinePlayer.coins - totalCoinCost + totalBonusCoins + owedToMe
      if (expectedCoinsAfter !== updatedPublic.coins && !(updatedPublic.coins === 0 && expectedCoinsAfter < 0)) {
        console.error('[resolveTurn] INCONGRUENZA SALDO — segnalare questo log:', {
          playerId: targetPlayer.id,
          coinsBefore: baselinePlayer.coins,
          totalCoinCost,
          totalBonusCoins,
          owedToMe,
          expectedCoinsAfter,
          actualCoinsAfter: updatedPublic.coins,
          actions,
          prepared
        })
      }

      // IMPORTANTE — ORDINE CRITICO: la mano in arrivo si cerca e si
      // ASSICURA QUI, PRIMA di scrivere turn_applied. Il motivo: non
      // appena turn_applied di questo giocatore raggiunge il turno
      // corrente, DIVENTA VISIBILE a tutti gli altri client, che a quel
      // punto potrebbero considerare "tutti pronti" e far avanzare il
      // turno globale — sbloccando il MITTENTE a scegliere una nuova
      // azione e sovrascrivere la propria outgoing_hand con dati del
      // turno successivo. Se la ricerca della mano in arrivo avvenisse
      // DOPO aver scritto turn_applied (come in una versione precedente),
      // c'era una finestra reale in cui il mittente — specialmente un
      // bot, istantaneo, senza il ritardo naturale di un click umano —
      // poteva sovrascrivere il dato prima che questo giocatore riuscisse
      // a leggerlo: bug osservato e confermato in partita (mano vuota
      // permanente). Facendo la ricerca PRIMA, nessun altro client può
      // mai essere sbloccato ad avanzare finché questo giocatore non ha
      // già messo al sicuro la propria mano.
      let newHand = []
      if (!isLastTurnOfAge) {
        // Rilettura fresca e mirata: cerca la riga che IL VICINO ha
        // indirizzato a noi PER QUESTO TURNO ESATTO (outgoing_hand_turn
        // deve combaciare) — non basta più solo "indirizzata a noi",
        // altrimenti un dato non ancora sovrascritto da un turno
        // precedente potrebbe essere riletto per errore (causa di un
        // bug osservato: carte che sembravano non ruotare). Tentativi
        // extra in caso il vicino stia ancora completando la propria
        // scrittura in quello stesso istante — finestra di 5 secondi
        // (10 tentativi da 500ms) perché con i bot lo stesso browser
        // gestisce più flussi contemporanei e può avere più latenza del
        // solito.
        for (let attempt = 0; attempt < 10; attempt++) {
          const { data: incoming, error: incomingError } = await supabase
            .from('player_hands')
            .select('outgoing_hand, outgoing_hand_turn, user_id')
            .eq('game_id', gameId)
            .eq('outgoing_hand_for', targetPlayer.user_id)
            .eq('outgoing_hand_turn', game.turn_number)
            .neq('user_id', targetPlayer.user_id)
            .maybeSingle()
          if (incomingError) console.error('[resolveTurn] errore lettura mano in arrivo:', incomingError)
          console.log('[resolveTurn] turno', game.turn_number, 'per', targetPlayer.nickname, 'tentativo', attempt, 'mano in arrivo trovata:', incoming)
          if (incoming?.outgoing_hand?.length || attempt === 9) {
            newHand = incoming?.outgoing_hand || []
            if (newHand.length === 0) {
              console.warn('[resolveTurn] MANO VUOTA dopo tutti i tentativi — segnalare questo log:', {
                targetUserId: targetPlayer.user_id,
                gameId,
                turn: game.turn_number,
                ultimoIncoming: incoming
              })
            }
            break
          }
          await new Promise((res) => setTimeout(res, 500))
        }
      }

      // Scrittura atomica: procede solo se turn_applied non è già
      // arrivato a questo turno (protegge da doppia applicazione). Vedi
      // commento sopra sul perché questa scrittura avviene SOLO DOPO
      // aver già assicurato la mano in arrivo.
      const { data: claimed, error: claimError } = await supabase
        .from('players')
        .update({
          coins: updatedPublic.coins,
          built_cards: updatedPublic.built_cards,
          wonder_stages_built: updatedPublic.wonder_stages_built,
          ready_this_turn: false,
          turn_applied: game.turn_number,
          last_turn_log: lastTurnLog,
          ...(prepared?.kind === 'free_build' ? { free_build_used_age: game.age } : {})
        })
        .eq('id', targetPlayer.id)
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
        if (prepared.turn6Leftover) discardedIds.push(prepared.turn6Leftover)
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
        setPlayers((prev) => prev.map((pl) => (pl.id === targetPlayer.id ? { ...pl, ...claimed[0] } : pl)))

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
          .eq('id', targetHand.id)
        if (handUpdateError) {
          console.error('[resolveTurn] errore scrittura nuova mano:', handUpdateError)
        } else {
          setMyHandRows((prev) => prev.map((h) => (h.id === targetHand.id ? newHandRow : h)))
        }
      }
    } catch (err) {
      console.error('[resolveTurn] eccezione imprevista:', err)
    }
  }

  useEffect(() => {
    if (!game || game.status !== 'playing' || !myPlayer || !myHand) return
    if (numPlayers === 0 || players.some((p) => !p.wonder_id)) return
    if (myPlayer.turn_applied >= game.turn_number) return
    if (!players.every((p) => p.ready_this_turn)) return
    const turnKey = `${game.age}-${game.turn_number}`
    if (resolvingRef.current === turnKey) return
    resolvingRef.current = turnKey
    resolvePlayerTurn(myPlayer, myHand).finally(() => {
      resolvingRef.current = null
    })
  }, [game, myPlayer, myHand, players, numPlayers, gameId, myUserId])

  // Come sopra, ma per i bot: risolve il turno di ogni bot che ha già
  // scelto un'azione (ready_this_turn) e non l'ha ancora applicata,
  // guidato da qualunque umano connesso — stesso principio del pilota
  // automatico delle scelte.
  const resolvingBotsRef = useRef(new Set())
  useEffect(() => {
    if (!game || game.status !== 'playing') return
    // Solo il creatore della stanza pilota i bot — se ogni umano connesso
    // potesse farlo in parallelo, con più browser aperti si rischiavano
    // disincronizzazioni (due client che agiscono sullo stesso bot quasi
    // simultaneamente). La policy lato database rifiuterebbe comunque un
    // non-creatore, ma è più pulito non tentare nemmeno la scrittura.
    if (!isCreator) return
    if (!players.every((p) => p.ready_this_turn)) return
    const bots = players.filter((p) => p.is_bot && p.turn_applied < game.turn_number)
    if (bots.length === 0) return
    ;(async () => {
      for (const bot of bots) {
        const key = `${bot.id}-${game.age}-${game.turn_number}`
        if (resolvingBotsRef.current.has(key)) continue
        resolvingBotsRef.current.add(key)
        const botHand = myHandRows.find((h) => h.player_id === bot.id)
        if (!botHand) {
          resolvingBotsRef.current.delete(key)
          continue
        }
        // IMPORTANTE: non si toglie la chiave dopo resolvePlayerTurn
        // (stessa cautela della scelta, vedi commento lì) — anche se qui
        // il blocco atomico su turn_applied dentro resolvePlayerTurn
        // impedirebbe comunque una doppia scrittura, toglierla subito
        // sprecherebbe comunque un'intera ricerca (fino a 5 secondi) per
        // niente se l'eco realtime non è ancora arrivata.
        await resolvePlayerTurn(bot, botHand)
      }
    })()
  }, [game, players, myHandRows, gameId, isCreator])



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

        // Aggiorna OGNI giocatore (non solo quello loggato) — necessario
        // perché i bot non hanno un proprio browser che esegua questo
        // stesso effetto per conto loro; qualunque umano connesso lo fa
        // per tutti. La guardia atomica ".eq('turn_applied', 6)" evita
        // che due umani connessi contemporaneamente applichino
        // l'avanzamento due volte sulla stessa riga (idempotenza già
        // presente per il calcolo dei gettoni, qui rinforzata anche
        // lato scrittura).
        //
        // ORDINE IMPORTANTE: prima si calcolano i gettoni militari
        // AGGIORNATI di TUTTI (compreso il conflitto appena concluso),
        // POI — solo se è l'ultima Epoca — si calcola il punteggio
        // finale usando quello stato già aggiornato. Calcolare i
        // punteggi PRIMA di aggiungere i gettoni dell'Epoca III
        // escluderebbe quella potenza militare dal punteggio finale di
        // tutti — bug reale, corretto qui.
        if (freshPlayers.length === numPlayers) {
          const results = resolveMilitaryConflict(freshPlayers, game.age)
          const playersWithNewTokens = freshPlayers.map((p) => {
            const alreadyResolvedThisAge = (p.military_tokens || []).some((t) => t.age === game.age)
            const newTokens = alreadyResolvedThisAge ? p.military_tokens || [] : [...(p.military_tokens || []), ...(results[p.id] || [])]
            return { ...p, military_tokens: newTokens, _alreadyResolvedThisAge: alreadyResolvedThisAge }
          })
          const scores = game.age >= 3 ? scoreGame(playersWithNewTokens) : null
          for (const p of playersWithNewTokens) {
            if (p._alreadyResolvedThisAge) continue
            const update = { military_tokens: p.military_tokens, turn_applied: 0, ready_this_turn: false }
            if (scores) update.final_score = scores.find((s) => s.playerId === p.id)
            const { error } = await supabase.from('players').update(update).eq('id', p.id).eq('turn_applied', game.turn_number)
            if (error) console.error('[advanceAge] errore aggiornamento fine Epoca per', p.nickname, error)
          }
        }

        if (game.age < 3) {
          const nextAge = game.age + 1
          const deck = buildAgeDeck(nextAge, numPlayers)
          const { error } = await supabase
            .from('games')
            .update({ age: nextAge, turn_number: 1, age_decks: { ...game.age_decks, [nextAge]: deck } })
            .eq('id', gameId)
            .eq('age', game.age)
          if (error) console.error('[advanceAge] errore avanzamento epoca:', error)
        } else {
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

  // ============================================================
  // PILOTA AUTOMATICO DEI BOT — SOLO il creatore della stanza fa
  // muovere i bot della partita (mai gli altri umani connessi), con le
  // stesse identiche funzioni già usate per le proprie mosse
  // (chooseActionFor). Farlo pilotare da chiunque fosse connesso
  // rischiava disincronizzazioni con più browser aperti — la policy
  // lato database rifiuterebbe comunque un non-creatore, ma è più
  // pulito non tentare nemmeno la scrittura da chi non è autorizzato.
  //
  // ATTENZIONE: a differenza della RISOLUZIONE (protetta lato database
  // dalla guardia atomica su turn_applied), la SCELTA non ha un blocco
  // equivalente lato scrittura — chooseActionFor scrive
  // incondizionatamente. Se questo effetto si riattivasse due volte per
  // lo stesso bot prima che "ready_this_turn" si rifletta nello stato
  // locale (es. per un cambiamento di "players" non correlato a questo
  // bot), partirebbero due chiamate concorrenti. Il ref sotto blocca
  // questo caso lato client, per bot+turno.
  // ============================================================
  const choosingBotsRef = useRef(new Set())
  useEffect(() => {
    if (!game || game.status !== 'playing') return
    if (!isCreator) return
    const bots = players.filter((p) => p.is_bot)
    if (bots.length === 0) return

    let cancelled = false
    async function driveBots() {
      for (const bot of bots) {
        if (cancelled) return
        if (bot.ready_this_turn) continue
        // IMPORTANTE: non basta "non pronto" — un bot che ha appena
        // risolto il PROPRIO turno corrente (mentre altri giocatori non
        // l'hanno ancora fatto) ha già una mano nuova e ready_this_turn
        // torna false, ma il numero di turno GLOBALE (game.turn_number)
        // resta fermo finché non risolvono tutti. Un bot, reagendo
        // all'istante (a differenza di un umano, che ha naturalmente un
        // ritardo fisico), potrebbe scegliere subito un'azione con quella
        // mano nuova ma etichettata ancora col turno vecchio — bug
        // osservato in partita: la scelta sovrascriveva quella corretta
        // già inviata con dati del turno sbagliato. Un bot può scegliere
        // SOLO se ha davvero raggiunto (non superato) il turno corrente.
        if (bot.turn_applied !== game.turn_number - 1) continue
        const key = `${bot.id}-${game.age}-${game.turn_number}`
        if (choosingBotsRef.current.has(key)) continue
        const botHand = myHandRows.find((h) => h.player_id === bot.id)
        if (!botHand || botHand.dealt_age !== game.age || !botHand.hand?.length) continue
        const botSeat = turnOrder.indexOf(bot.id)
        if (botSeat < 0) continue
        const botLeftNeighbor = seatToPlayer[leftNeighborSeat(botSeat, numPlayers)]
        const botRightNeighbor = seatToPlayer[rightNeighborSeat(botSeat, numPlayers)]
        const gameContext = { age: game.age, turnNumber: game.turn_number }
        const decision = decideBotAction(botHand.hand, bot, botLeftNeighbor, botRightNeighbor, gameContext)
        if (!decision) continue
        choosingBotsRef.current.add(key)
        try {
          await chooseActionFor(bot, botHand, botSeat, decision.cardId, decision.action, decision.preference)
          // IMPORTANTE: non si toglie la chiave dopo un successo. Il
          // motivo del bug appena corretto: toglierla subito lasciava
          // una finestra reale tra "scrittura confermata" e "l'eco
          // realtime aggiorna ready_this_turn nello stato locale", in
          // cui un nuovo giro dell'effetto vedeva ancora bot.ready_this_turn
          // false E la chiave già libera — scegliendo di nuovo per lo
          // stesso turno (osservato in partita: lo stesso bot sceglieva
          // più volte, riducendo la mano ad ogni passaggio). La chiave è
          // già specifica per turno/Epoca, quindi non serve ripulirla:
          // diventa naturalmente inutile non appena il turno avanza.
        } catch (err) {
          console.error('[bot]', bot.nickname, 'errore azione:', err)
          // Qui SÌ si toglie: un errore reale non ha scritto nulla,
          // meglio permettere un nuovo tentativo al prossimo giro.
          choosingBotsRef.current.delete(key)
        }
      }
    }
    driveBots()
    return () => {
      cancelled = true
    }
  }, [game, players, myHandRows, turnOrder, seatToPlayer, numPlayers, isCreator])

  if (!game || !myPlayer) return <Loader message="Carico la partita..." />

  // Estratto in funzione perché serve sia durante il turno di gioco sia
  // nella revisione della plancia a partita conclusa (vedi schermata finale),
  // e per poter disporre "io" e gli avversari diversamente sullo schermo.
  function renderOnePlayer(p) {
      const wonder = WONDERS[p.wonder_id]
      const side = wonder?.sides[p.wonder_side]
      const pSeat = turnOrder.indexOf(p.id)
      const pNeighborNicknames = {
        left: seatToPlayer[leftNeighborSeat(pSeat, numPlayers)]?.nickname,
        right: seatToPlayer[rightNeighborSeat(pSeat, numPlayers)]?.nickname
      }
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
      const isExpanded = expandedPlayerIds ? expandedPlayerIds.has(p.id) : p.id === myPlayer.id
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <strong>
              {p.nickname} {game.status === 'playing' ? (p.ready_this_turn ? '✅' : '⏳') : ''}
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
              <span>
                🛡️{live.military}(⚔️{militaryStrength})
              </span>
              <span>
                💰{live.treasury}(<ImgIcon name="coin" size={12} title="monete" />
                {p.coins})
              </span>
              <span>🏛️{live.wonder}</span>
              <span>
                <Icon name="color_blue" size={12} /> {live.blue}
              </span>
              <span>
                <Icon name="color_yellow" size={12} /> {live.yellow}
              </span>
              <span>
                <Icon name="color_green" size={12} /> {live.green}
              </span>
              <span>
                <Icon name="color_purple" size={12} /> {live.purple}
              </span>
              <span style={{ fontWeight: 700, color: '#3d3527', marginLeft: 'auto' }}>{live.total}🏆</span>
            </div>
          )}

          {p.last_turn_log && (
            <div
              title="Riepilogo dell'ultimo turno risolto: azione, acquisti dai vicini (◄ sinistro, ► destro), monete incassate, saldo prima→dopo"
              style={{ fontSize: '0.7rem', color: '#5a5142', marginTop: 4 }}
            >
              <span style={{ color: '#a89b86' }}>↩ Turno precedente: </span>
              {lastTurnSummary(p.last_turn_log)}
            </div>
          )}

          {/* ---- Plancia Meraviglia: risorsa+nome, dettagli, città (se espanso), stadi ---- */}
          <div
            style={{
              background: p.wonder_side === 'B' ? 'rgb(147 136 196 / 32%)' : 'rgb(172 219 255 / 32%)',
              border: '1px solid #e4ddcc',
              borderRadius: 8,
              padding: 8,
              marginTop: 6
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontWeight: 700 }}>
              <span>{resIconNode(wonder?.startResource)}</span>
              <span>
                🏛️ {wonder?.name}{' '}
                <span title={WONDER_SIDE_NAME[p.wonder_side]}>{WONDER_SIDE_ICON[p.wonder_side]}</span>
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                fontSize: '0.72rem',
                color: '#5a5142',
                marginTop: 6,
                background: '#fff',
                border: '1px solid rgb(228, 221, 204)',
                borderRadius: 6,
                padding: 6
              }}
            >
              <div title="Risorse fisse prodotte a ogni turno">
                <span style={{ color: '#3d3527' }}>Produzione: </span>
                {Object.entries(production.fixed).filter(([, n]) => n > 0).length === 0 ? (
                  <span>—</span>
                ) : (
                  Object.entries(production.fixed)
                    .filter(([, n]) => n > 0)
                    .map(([r, n]) => (
                      <span key={r} style={{ marginRight: 6 }}>
                        +{n}
                        {resIconNode(r)}
                      </span>
                    ))
                )}
              </div>

              {production.choiceGenerators.length > 0 && (
                <div title="Risorse producibili a scelta (1 unità a turno per ciascun generatore)">
                  <span style={{ color: '#3d3527' }}>A scelta: </span>
                  {production.choiceGenerators.map((gen, i) => (
                    <span key={i} style={{ marginRight: 6 }}>
                      +1{' '}
                      {gen.map((r, j) => (
                        <span key={r}>
                          {j > 0 ? '/' : ''}
                          {resIconNode(r)}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              )}

              {trade && (
                <div
                  title={`Sconti commercio attivi: ◄ vicino sinistro${pNeighborNicknames.left ? ` (${pNeighborNicknames.left})` : ''}, ► destro${pNeighborNicknames.right ? ` (${pNeighborNicknames.right})` : ''}`}
                >
                  <span style={{ color: '#3d3527' }}>Commercio: </span>
                  {trade}
                </div>
              )}

              {(science.fixed.compass > 0 || science.fixed.gear > 0 || science.fixed.tablet > 0 || science.choices > 0) && (
                <div title="Simboli scientifici accumulati finora (i punti si calcolano solo a fine partita)">
                  <span style={{ color: '#3d3527' }}>Scienza: </span>
                  {science.fixed.compass > 0 && (
                    <span style={{ marginRight: 6 }}>
                      {SCIENCE_ICON.compass}×{science.fixed.compass}
                    </span>
                  )}
                  {science.fixed.gear > 0 && (
                    <span style={{ marginRight: 6 }}>
                      {SCIENCE_ICON.gear}×{science.fixed.gear}
                    </span>
                  )}
                  {science.fixed.tablet > 0 && (
                    <span style={{ marginRight: 6 }}>
                      {SCIENCE_ICON.tablet}×{science.fixed.tablet}
                    </span>
                  )}
                  {science.choices > 0 && <span>+{science.choices} a scelta</span>}
                </div>
              )}

              <div
                onClick={() =>
                  setExpandedPlayerIds((prev) => {
                    const next = new Set(prev ?? [myPlayer.id])
                    if (next.has(p.id)) next.delete(p.id)
                    else next.add(p.id)
                    return next
                  })
                }
                style={{ cursor: 'pointer' }}
                title="Numero di carte per colore — utile per le Gilde che contano le carte dei vicini. Clic per vedere le carte per esteso."
              >
                <span style={{ color: '#3d3527' }}>{isExpanded ? '👇' : '👉'} Carte: </span>
                {['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple']
                  .filter((color) => (cardsByColor[color] || []).length > 0)
                  .map((color) => (
                    <span key={color} style={{ marginRight: 6 }}>
                      <Icon name={`color_${color}`} size={12} />
                      {cardsByColor[color].length}
                    </span>
                  ))}
                {Object.keys(cardsByColor).length === 0 && <span>—</span>}
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 8 }}>
                {Object.keys(cardsByColor).length === 0 ? (
                  <div style={{ color: '#a89b86', fontSize: '0.72rem' }}>Nessun edificio costruito ancora</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['brown', 'grey', 'blue', 'yellow', 'red', 'green', 'purple']
                      .filter((color) => cardsByColor[color])
                      .map((color) => (
                        <div key={color} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {cardsByColor[color].map((card) => (
                            <div
                              key={card.id}
                              style={{
                                position: 'relative',
                                background: '#fff',
                                border: '1px solid #e4ddcc',
                                borderRadius: 6,
                                padding: '3px 16px 12px 6px',
                                minWidth: 130,
                                maxWidth: 150
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: '0.7rem' }}>
                                <Icon name={`color_${color}`} size={12} /> {card.name}
                              </div>
                              <div style={{ fontSize: '0.66rem', color: '#3d3527', marginTop: 4 }}>{effectLabel(card, pNeighborNicknames)}</div>
                              {chainLabel(card).map((line, i) => (
                                <div key={i} style={{ fontSize: '0.62rem', color: '#8a6a48' }}>
                                  {line}
                                </div>
                              ))}
                              <div style={{ fontSize: '0.62rem', color: '#5a5142', marginTop: 5 }}>Costo: {costLabel(card.cost)}</div>
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
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- Stadi Meraviglia: una colonna per stadio — riga 1 costo a
                 sinistra/numero a destra, riga 2 ricompensa centrata ---- */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              {side?.stages.map((s, i) => {
                const built = i < p.wonder_stages_built
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: built ? '#e9dfc8' : '#fff',
                      border: built ? '1px solid #8a6a48' : '1px solid #e4ddcc',
                      borderRadius: 6,
                      padding: '6px 6px',
                      opacity: built ? 1 : 0.65,
                      fontWeight: built ? 700 : 400,
                      fontSize: '0.68rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{costLabel(s.cost)}</span>
                      <span>
                        {built ? '🏛️ ' : ''}
                        {STAGE_EMOJI[i + 1] || i + 1}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>{wonderStageLabel(s, pNeighborNicknames)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
  }

  function renderPlayerPanels() {
    return orderedPlayers.map(renderOnePlayer)
  }

  // ============================================================
  // UI — Sala d'attesa
  // ============================================================
  if (game.status === 'waiting') {
    const canStart = numPlayers >= 3 && numPlayers <= 7 && players.every((p) => p.wonder_id)
    return (
      <div style={page}>
        <div style={{ ...cardWide, width: 820 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h1 style={{ ...title, margin: 0 }}>Stanza {game.room_code}</h1>
            <button onClick={() => navigate('/')} style={linkText}>
              ← Lobby
            </button>
          </div>
          <p style={{ textAlign: 'center', color: '#5a5142', marginTop: -12 }}>
            {numPlayers} giocator{numPlayers === 1 ? 'e' : 'i'} (min. 3, max. 7)
          </p>

          <div style={{ margin: '1rem 0' }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <span>
                  {p.nickname}
                  {game.created_by === p.user_id && <span title="Creatore della stanza"> 👑</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.wonder_id ? `${WONDERS[p.wonder_id].name} ${WONDER_SIDE_ICON[p.wonder_side]} · ${wonderStartResourceLabel(p.wonder_id)}` : '— sceglie...'}
                  {p.is_bot && isCreator && (
                    <button style={{ ...secondaryButton, padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => removeBot(p.id)}>
                      ✕ Rimuovi
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>

          {isCreator && numPlayers < 7 && WONDER_IDS.filter((id) => !chosenWonderIds.has(id)).length > 0 && (
            <button style={{ ...secondaryButton, marginTop: 4 }} onClick={addBot}>
              🤖 Aggiungi bot
            </button>
          )}

          {canStart && (
            <button style={{ ...primaryButton, marginTop: 10, marginLeft: 10 }} onClick={startGame}>
              ▶️ Avvia partita
            </button>
          )}

          <div style={{ marginTop: 10 }}>
            {isCreator ? (
              <button style={{ ...secondaryButton, color: '#a33' }} onClick={() => setConfirmingDeleteRoom(true)}>
                🗑️ Elimina stanza
              </button>
            ) : (
              <button style={{ ...secondaryButton, color: '#a33' }} onClick={() => setConfirmingLeaveRoom(true)}>
                🚪 Abbandona stanza
              </button>
            )}
          </div>
          {confirmingDeleteRoom && (
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
              Eliminare la stanza per tutti? Non si può annullare.{' '}
              <button style={{ ...secondaryButton, color: '#a33' }} onClick={deleteRoom}>
                Sì, elimina
              </button>{' '}
              <button style={secondaryButton} onClick={() => setConfirmingDeleteRoom(false)}>
                Annulla
              </button>
            </div>
          )}
          {confirmingLeaveRoom && (
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
              Abbandonare la stanza?{' '}
              <button style={{ ...secondaryButton, color: '#a33' }} onClick={leaveRoom}>
                Sì, abbandona
              </button>{' '}
              <button style={secondaryButton} onClick={() => setConfirmingLeaveRoom(false)}>
                Annulla
              </button>
            </div>
          )}
          {error && <p style={errorText}>{error}</p>}

          <div style={{ marginTop: 16 }}>
            {myPlayer.wonder_id && (
              <div
                style={{
                  border: '2px solid #8a6a48',
                  borderRadius: 10,
                  padding: '6px 10px',
                  marginBottom: 10,
                  background: myPlayer.wonder_side === 'B' ? 'rgb(147 136 196 / 32%)' : 'rgb(172 219 255 / 32%)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    La tua scelta: <strong>{WONDERS[myPlayer.wonder_id].name}</strong> {WONDER_SIDE_ICON[myPlayer.wonder_side]}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={secondaryButton} onClick={flipWonderSide}>
                      🔄 Gira ({WONDER_SIDE_ICON[myPlayer.wonder_side === 'A' ? 'B' : 'A']})
                    </button>
                    <button style={secondaryButton} onClick={cancelWonder}>
                      Annulla scelta
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                  {WONDERS[myPlayer.wonder_id].sides[myPlayer.wonder_side].stages.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        background: '#fff',
                        border: '1px solid #e4ddcc',
                        borderRadius: 6,
                        padding: '3px 4px',
                        fontSize: '0.68rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{costLabel(s.cost)}</span>
                        <span>{STAGE_EMOJI[i + 1] || i + 1}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>{wonderStageLabel(s)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Meraviglie disponibili:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {WONDER_IDS.filter((id) => !chosenWonderIds.has(id)).map((id) => (
                <div key={id} style={{ border: '1px solid #e4ddcc', borderRadius: 10, padding: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    🏛️ {WONDERS[id].name} <span style={{ fontWeight: 400, color: '#5a5142' }}>({wonderStartResourceLabel(id)} di partenza)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['A', 'B'].map((side) => (
                      <div
                        key={side}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: side === 'B' ? 'rgb(147 136 196 / 32%)' : 'rgb(172 219 255 / 32%)',
                          borderRadius: 8,
                          padding: 6
                        }}
                      >
                        <button style={pillButton} onClick={() => chooseWonder(id, side)}>
                          Lato {side} {WONDER_SIDE_ICON[side]}
                        </button>
                        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                          {WONDERS[id].sides[side].stages.map((s, i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                background: '#fff',
                                border: '1px solid #e4ddcc',
                                borderRadius: 6,
                                padding: '3px 2px',
                                fontSize: '0.68rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{costLabel(s.cost)}</span>
                                <span>{STAGE_EMOJI[i + 1] || i + 1}</span>
                              </div>
                              <div style={{ textAlign: 'center' }}>{wonderStageLabel(s)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {WONDER_IDS.filter((id) => !chosenWonderIds.has(id)).length === 0 && (
                <p style={{ color: '#a89b86', fontSize: '0.85rem' }}>Tutte le Meraviglie sono state scelte.</p>
              )}
            </div>
          </div>
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
                  <th>
                    <Icon name="color_blue" size={13} /> Blu
                  </th>
                  <th>
                    <Icon name="color_yellow" size={13} /> Gialle
                  </th>
                  <th>
                    <Icon name="color_green" size={13} /> Verdi
                  </th>
                  <th>
                    <Icon name="color_purple" size={13} /> Viola
                  </th>
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
  const nextWonderStageLabel = myNextStage ? `${costLabelText(myNextStage.cost)} → ${wonderStageLabelText(myNextStage, myNeighborNicknames)}` : null
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
      <div style={{ ...cardWide, width: '96vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ ...title, margin: 0 }}>
            Epoca {AGE_ROMAN[game.age]} · Turno {game.turn_number}/6
          </h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: '0.85rem', color: '#5a5142' }}>Stanza: {game.room_code}</span>
            <span style={{ fontSize: '0.85rem', color: '#5a5142' }} title="Tempo trascorso dall'avvio della partita">
              ⏱️ {formatElapsed(nowTick - new Date(game.started_at).getTime())}
            </span>
            <button onClick={() => navigate('/')} style={linkText}>
              ← Lobby
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, margin: '5px 0px 0px', alignItems: 'flex-start' }}>
          {/* Colonna sinistra: il tuo pannello + la tua mano, con scroll
              indipendente se il contenuto supera l'altezza disponibile. */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', paddingRight: 4 }}>
            <div
              style={{
                border: '2px solid #8a6a48',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: '0.8rem',
                background: 'linear-gradient(160deg, #7a5233 0%, #5c3d24 55%, #46301c 100%)'
              }}
            >
        {iAmReady ? (
          <p style={{ textAlign: 'center', color: '#fff' }}>Hai scelto la tua carta — aspetto gli altri giocatori...</p>
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
                        <Icon name={`color_${card.color}`} size={12} /> {card.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3d3527', marginTop: 2 }}>{effectLabel(card, myNeighborNicknames)}</div>
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
                const tradeOpts = tradeOptionsFor(card.cost, myPlayer, leftNeighbor, rightNeighbor)
                const tradeNeeded = tradeOpts.needed && !hasFreeChain(card, myPlayer) && (tradeOpts.canLeft || tradeOpts.canRight)
                const tradeForced = tradeNeeded && tradeOpts.canLeft !== tradeOpts.canRight
                const forcedSide = tradeForced ? (tradeOpts.canLeft ? 'left' : 'right') : null
                const effectivePreference = tradeForced ? forcedSide : buyPreference
                // Controllo conservativo: usa la STESSA funzione che
                // bloccherebbe comunque l'azione se cliccata, quindi zero
                // rischio di negare per errore una costruzione valida —
                // già considera produzione propria, commercio (con
                // sconti), concatenazioni gratuite. Nel dubbio (es.
                // errore imprevisto nel calcolo) resta cliccabile.
                let buildImpossible = false
                try {
                  buildImpossible = !canBuildCard(cardId, myPlayer, leftNeighbor, rightNeighbor, null, { age: game.age, turnNumber: game.turn_number }).possible
                } catch {
                  buildImpossible = false
                }
                let wonderImpossible = false
                try {
                  wonderImpossible = !canBuildWonderStage(myPlayer, leftNeighbor, rightNeighbor).possible
                } catch {
                  wonderImpossible = false
                }
                return (
                  <div
                    key={cardId}
                    onClick={() => {
                      if (selectedCardId !== cardId) setBuyPreference(null)
                      setSelectedCardId(cardId)
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
                      <Icon name={`color_${card.color}`} size={12} /> {card.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#3d3527', marginTop: 4 }}>{effectLabel(card, myNeighborNicknames)}</div>
                    {chainLabel(card).map((line, i) => (
                      <div key={i} style={{ fontSize: '0.7rem', color: '#8a6a48', marginTop: 2 }}>
                        {line}
                      </div>
                    ))}
                    <div style={{ fontSize: '0.75rem', color: '#5a5142', marginTop: 5 }}>Costo: {costLabel(card.cost)}</div>
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
                        {tradeNeeded && (
                          <div style={{ fontSize: '0.68rem', color: '#5a5142' }}>
                            {tradeForced ? (
                              <>
                                Comprerai da:{' '}
                                {forcedSide === 'left'
                                  ? `vicino sinistro${myNeighborNicknames.left ? ` (${myNeighborNicknames.left})` : ''}`
                                  : `vicino destro${myNeighborNicknames.right ? ` (${myNeighborNicknames.right})` : ''}`}{' '}
                                (unica opzione)
                              </>
                            ) : (
                              <>
                                Se possibile compra da:{' '}
                                <select
                                  value={buyPreference || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setBuyPreference(e.target.value || null)}
                                  style={{ fontSize: '0.68rem' }}
                                >
                                  <option value="">indifferente</option>
                                  <option value="left">vicino sinistro{myNeighborNicknames.left ? ` (${myNeighborNicknames.left})` : ''}</option>
                                  <option value="right">vicino destro{myNeighborNicknames.right ? ` (${myNeighborNicknames.right})` : ''}</option>
                                </select>
                              </>
                            )}
                          </div>
                        )}
                        {bundleMode === 'free_build' && bundlePrimaryChoice ? (
                          <button style={pillButton} onClick={() => chooseAction(cardId, 'build', null, bundlePrimaryChoice, 'free_build')}>
                            🏛️ Costruisci GRATIS con Babilonia
                          </button>
                        ) : (
                          <>
                            <button
                              style={{ ...pillButton, opacity: buildImpossible && !bundleMode ? 0.4 : 1, cursor: buildImpossible && !bundleMode ? 'not-allowed' : 'pointer' }}
                              disabled={buildImpossible && !bundleMode}
                              title={buildImpossible && !bundleMode ? 'Non costruibile: risorse insufficienti (nemmeno comprando dai vicini)' : undefined}
                              onClick={() =>
                                bundleMode && !bundlePrimaryChoice
                                  ? setBundlePrimaryChoice({ cardId, action: 'build' })
                                  : chooseAction(cardId, 'build', effectivePreference, bundlePrimaryChoice, bundleMode)
                              }
                            >
                              🏗️ Costruisci edificio
                            </button>
                            <button
                              style={{
                                ...pillButton,
                                opacity: wonderImpossible && !bundleMode && !nextStageGivesDiscardBuild ? 0.4 : 1,
                                cursor: wonderImpossible && !bundleMode && !nextStageGivesDiscardBuild ? 'not-allowed' : 'pointer'
                              }}
                              disabled={wonderImpossible && !bundleMode && !nextStageGivesDiscardBuild}
                              onClick={() => {
                                if (nextStageGivesDiscardBuild) {
                                  setDiscardPicker({ cardId, action: 'wonder' })
                                } else if (bundleMode && !bundlePrimaryChoice) {
                                  setBundlePrimaryChoice({ cardId, action: 'wonder' })
                                } else {
                                  chooseAction(cardId, 'wonder', effectivePreference, bundlePrimaryChoice, bundleMode)
                                }
                              }}
                              title={
                                wonderImpossible && !bundleMode && !nextStageGivesDiscardBuild
                                  ? 'Stadio non costruibile: risorse insufficienti (nemmeno comprando dai vicini)'
                                  : nextWonderStageLabel
                              }
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
                              💰 Vendi (+3
                              <ImgIcon name="coin" size={12} title="monete" />)
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
            </div>
            {renderOnePlayer(myPlayer)}
          </div>

          <div style={{ width: 16, flexShrink: 0 }} />

          {/* Colonna destra: avversari in ordine di seggio reale attorno al
              tavolo, dal tuo vicino sinistro (in cima) al tuo vicino destro
              (in fondo) — ogni coppia consecutiva è realmente vicina di
              posto, non solo nell'elenco. Scroll indipendente dalla
              colonna di sinistra. */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', paddingRight: 4 }}>
            {Array.from({ length: numPlayers - 1 }, (_, i) => seatToPlayer[(mySeat - i - 1 + numPlayers * 2) % numPlayers])
              .filter(Boolean)
              .map((p, i, arr) => (
                <div key={p.id}>
                  {i === 0 && <div style={{ fontSize: '0.68rem', color: '#8a6a48', fontWeight: 700 }}>◄ tuo vicino sinistro ({p.nickname})</div>}
                  {renderOnePlayer(p)}
                  {i === arr.length - 1 && (
                    <div style={{ fontSize: '0.68rem', color: '#8a6a48', fontWeight: 700, textAlign: 'right' }}>tuo vicino destro ({p.nickname}) ►</div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {error && <p style={errorText}>{error}</p>}
      </div>
    </div>
  )
}
