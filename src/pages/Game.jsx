import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import {
  WONDER_IDS,
  WONDERS,
  buildAgeDeck,
  dealHandForSeat,
  leftNeighborSeat,
  rightNeighborSeat,
  passRecipientSeat,
  prepareAction,
  applyPreparedAction,
  resolveMilitaryConflict,
  scoreGame,
  getCardData
} from '../game-engine'
import Loader from '../components/Loader'
import { page, cardWide, title, primaryButton, secondaryButton, pillButton, errorText, linkText } from '../styles/theme'

const COLOR_LABEL = { brown: '🟤', grey: '⚪', blue: '🔵', yellow: '🟡', red: '🔴', green: '🟢', purple: '🟣' }
const RESOURCE_ICON = { clay: '🧱', stone: '🪨', ore: '⛏️', wood: '🪵', glass: '🔷', loom: '🧵', papyrus: '📜' }

function costLabel(cost = {}) {
  const parts = []
  if (cost.coins) parts.push(`${cost.coins}🪙`)
  for (const [r, n] of Object.entries(cost)) {
    if (r === 'coins') continue
    parts.push(`${n}${RESOURCE_ICON[r] || r}`)
  }
  return parts.length ? parts.join(' ') : 'Gratis'
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
  const resolvingRef = useRef(false)
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
  const incomingHand = useMemo(() => myHandRows.find((h) => h.outgoing_hand_for === myUserId && h.user_id !== myUserId), [myHandRows, myUserId])

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
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    const deck1 = buildAgeDeck(1, ids.length)
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
    supabase
      .from('player_hands')
      .update({ hand, pending_action: null, outgoing_hand: null, outgoing_hand_for: null, dealt_age: game.age })
      .eq('id', myHand.id)
      .then(() => {
        dealingRef.current = false
      })
  }, [game, myHand, mySeat])

  // ============================================================
  // SCELTA DELLA CARTA (fase di commit) — calcola SUBITO il costo
  // guardando lo stato attuale dei vicini, cosi' l'applicazione
  // successiva non dipende piu' da loro (vedi prepareAction).
  // ============================================================
  async function chooseAction(cardId, action) {
    setError(null)
    try {
      const prepared = prepareAction(action, cardId, myPlayer, leftNeighbor, rightNeighbor)
      const remainingHand = (myHand.hand || []).filter((id) => id !== cardId)
      const isLastTurnOfAge = game.turn_number >= 6

      const update = { pending_action: prepared }
      if (!isLastTurnOfAge) {
        const recipientSeat = passRecipientSeat(game.age, mySeat, numPlayers)
        const recipient = seatToPlayer[recipientSeat]
        update.outgoing_hand = remainingHand
        update.outgoing_hand_for = recipient.user_id
      } else {
        update.outgoing_hand = null
        update.outgoing_hand_for = null
      }
      await supabase.from('player_hands').update(update).eq('id', myHand.id)
      await supabase.from('players').update({ ready_this_turn: true }).eq('id', myPlayer.id)
      setSelectedCardId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  // ============================================================
  // APPLICAZIONE DEL TURNO — quando TUTTI hanno scelto (ready_this_turn),
  // ognuno applica SOLO la propria azione e recupera la propria nuova
  // mano dallo slot "outgoing" che il vicino le ha indirizzato.
  // ============================================================
  useEffect(() => {
    if (!game || game.status !== 'playing' || !myPlayer || !myHand) return
    if (numPlayers === 0 || players.some((p) => !p.wonder_id)) return
    if (myPlayer.turn_applied >= game.turn_number) return
    if (!players.every((p) => p.ready_this_turn)) return
    if (resolvingRef.current) return
    resolvingRef.current = true

    async function resolve() {
      const prepared = myHand.pending_action
      if (!prepared) {
        resolvingRef.current = false
        return
      }
      const updatedPublic = applyPreparedAction(prepared, myPlayer)

      const isLastTurnOfAge = game.turn_number >= 6
      let newHand = []
      if (!isLastTurnOfAge) {
        newHand = incomingHand?.outgoing_hand || []
      }

      await supabase
        .from('players')
        .update({
          coins: updatedPublic.coins,
          built_cards: updatedPublic.built_cards,
          wonder_stages_built: updatedPublic.wonder_stages_built,
          ready_this_turn: false,
          turn_applied: game.turn_number
        })
        .eq('id', myPlayer.id)

      await supabase
        .from('player_hands')
        .update({
          hand: newHand,
          pending_action: null,
          outgoing_hand: null,
          outgoing_hand_for: null,
          dealt_age: isLastTurnOfAge ? myHand.dealt_age : game.age
        })
        .eq('id', myHand.id)

      resolvingRef.current = false
    }
    resolve()
  }, [game, myPlayer, myHand, incomingHand, players, numPlayers])

  // ============================================================
  // AVANZAMENTO TURNO/EPOCA — quando TUTTI hanno applicato la propria
  // azione per il turno corrente, un client qualsiasi prova a far
  // avanzare lo stato condiviso (con guardia ottimistica: se un altro
  // client arriva prima, il .eq() sotto non trova righe e non succede
  // nulla di male).
  // ============================================================
  useEffect(() => {
    if (!game || game.status !== 'playing' || numPlayers === 0) return
    if (players.some((p) => !p.wonder_id)) return
    if (!players.every((p) => p.turn_applied >= game.turn_number)) return
    if (advancingRef.current) return
    advancingRef.current = true

    async function advance() {
      if (game.turn_number < 6) {
        await supabase
          .from('games')
          .update({ turn_number: game.turn_number + 1 })
          .eq('id', gameId)
          .eq('turn_number', game.turn_number)
        advancingRef.current = false
        return
      }

      // Fine Epoca: risoluzione conflitti militari, poi Epoca successiva o fine partita.
      const results = resolveMilitaryConflict(orderedPlayers, game.age)
      const myTokens = results[myPlayer.id] || []
      const newTokens = [...(myPlayer.military_tokens || []), ...myTokens]

      if (game.age < 3) {
        const nextAge = game.age + 1
        const deck = buildAgeDeck(nextAge, numPlayers)
        await supabase
          .from('players')
          .update({ military_tokens: newTokens, turn_applied: 0, ready_this_turn: false })
          .eq('id', myPlayer.id)
        await supabase
          .from('games')
          .update({ age: nextAge, turn_number: 1, age_decks: { ...game.age_decks, [nextAge]: deck } })
          .eq('id', gameId)
          .eq('age', game.age)
      } else {
        // Ultima Epoca: calcola il punteggio finale di tutti (dati pubblici) e salva il proprio.
        const playersWithMilitary = orderedPlayers.map((p) => (p.id === myPlayer.id ? { ...p, military_tokens: newTokens } : p))
        const scores = scoreGame(playersWithMilitary)
        const myScore = scores.find((s) => s.playerId === myPlayer.id)
        await supabase
          .from('players')
          .update({ military_tokens: newTokens, final_score: myScore, turn_applied: 0, ready_this_turn: false })
          .eq('id', myPlayer.id)
        await supabase
          .from('games')
          .update({ status: 'finished', finished_at: new Date().toISOString() })
          .eq('id', gameId)
          .eq('status', 'playing')
      }
      advancingRef.current = false
    }
    advance()
  }, [game, players, orderedPlayers, myPlayer, numPlayers, gameId])

  if (!game || !myPlayer) return <Loader message="Carico la partita..." />

  // ============================================================
  // UI — Sala d'attesa
  // ============================================================
  if (game.status === 'waiting') {
    const canStart = numPlayers >= 3 && numPlayers <= 7 && players.every((p) => p.wonder_id)
    return (
      <div style={page}>
        <div style={{ ...cardWide, width: 640 }}>
          <h1 style={title}>Stanza {game.room_code}</h1>
          <p style={{ textAlign: 'center', color: '#5a5142', marginTop: -12 }}>
            {numPlayers} giocator{numPlayers === 1 ? 'e' : 'i'} (min. 3, max. 7)
          </p>

          <div style={{ margin: '1rem 0' }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <span>{p.nickname}</span>
                <span>{p.wonder_id ? `${WONDERS[p.wonder_id].name} (${p.wonder_side})` : '— sceglie...'}</span>
              </div>
            ))}
          </div>

          {!myPlayer.wonder_id && (
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Scegli la tua Meraviglia:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WONDER_IDS.filter((id) => !chosenWonderIds.has(id)).map((id) => (
                  <div key={id} style={{ border: '1px solid #e4ddcc', borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{WONDERS[id].name}</div>
                    <button style={pillButton} onClick={() => chooseWonder(id, 'A')}>
                      Lato A
                    </button>{' '}
                    <button style={pillButton} onClick={() => chooseWonder(id, 'B')}>
                      Lato B
                    </button>
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
        <div style={{ ...cardWide, width: 640 }}>
          <h1 style={title}>🏆 Partita conclusa</h1>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th align="left">Giocatore</th>
                <th>Mil.</th>
                <th>Tesoro</th>
                <th>Merav.</th>
                <th>Blu</th>
                <th>Gialle</th>
                <th>Verdi</th>
                <th>Viola</th>
                <th>Totale</th>
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

  return (
    <div style={page}>
      <div style={{ ...cardWide, width: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ ...title, margin: 0 }}>
            Epoca {game.age} · Turno {game.turn_number}/6
          </h1>
          <button onClick={() => navigate('/')} style={linkText}>
            ← Lobby
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 16px' }}>
          {orderedPlayers.map((p) => (
            <div
              key={p.id}
              style={{
                border: p.id === myPlayer.id ? '2px solid #8a6a48' : '1px solid #e4ddcc',
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {p.nickname} {p.ready_this_turn ? '✅' : '⏳'}
              </div>
              <div>
                {WONDERS[p.wonder_id]?.name} ({p.wonder_side}) · 🪙{p.coins} · 🏛️{p.wonder_stages_built}
              </div>
              <div>{(p.built_cards || []).length} edifici</div>
            </div>
          ))}
        </div>

        {iAmReady ? (
          <p style={{ textAlign: 'center', color: '#5a5142' }}>Hai scelto la tua carta — aspetto gli altri giocatori...</p>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>La tua mano:</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {hand.map((cardId) => {
                const card = getCardData(cardId)
                if (!card) return null
                const selected = selectedCardId === cardId
                return (
                  <div
                    key={cardId}
                    onClick={() => setSelectedCardId(cardId)}
                    style={{
                      border: selected ? '2px solid #8a6a48' : '1px solid #e4ddcc',
                      borderRadius: 10,
                      padding: 10,
                      width: 150,
                      cursor: 'pointer',
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {COLOR_LABEL[card.color]} {card.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#5a5142' }}>{costLabel(card.cost)}</div>
                    {selected && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button style={pillButton} onClick={() => chooseAction(cardId, 'build')}>
                          🏗️ Costruisci
                        </button>
                        <button style={pillButton} onClick={() => chooseAction(cardId, 'wonder')}>
                          🏛️ Stadio Meraviglia
                        </button>
                        <button style={pillButton} onClick={() => chooseAction(cardId, 'discard')}>
                          💰 Vendi (+3)
                        </button>
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
