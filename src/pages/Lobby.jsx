import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { joinGame } from '../lib/joinGame'
import Loader from '../components/Loader'
import { page, cardWide, title, inputStyle, primaryButton, secondaryButton, errorText, linkText } from '../styles/theme'

const AGE_ROMAN = { 1: 'Ⅰ', 2: 'Ⅱ', 3: 'Ⅲ' }

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function Lobby({ profile, onSignOut }) {
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [myGames, setMyGames] = useState(null)
  const [showFinished, setShowFinished] = useState(false)
  const [showActive, setShowActive] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function loadMyGames() {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: gamesError } = await supabase
        .from('players')
        .select('game_id, games(id, room_code, status, age, turn_number, created_at)')
        .eq('user_id', user.id)
        .order('created_at', { referencedTable: 'games', ascending: false })

      if (cancelled) return
      if (gamesError) {
        setMyGames([])
        return
      }
      setMyGames((data ?? []).map((row) => row.games).filter(Boolean))
    }
    loadMyGames()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Non sei autenticato')

      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({ room_code: randomRoomCode(), status: 'waiting', created_by: user.id })
        .select()
        .single()
      if (gameError) throw gameError

      await joinGame({ gameId: game.id, profile })
      navigate(`/game/${game.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return setError('Inserisci il codice stanza')
    setLoading(true)
    setError(null)
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select()
        .eq('room_code', joinCode.trim().toUpperCase())
        .single()
      if (gameError) throw new Error('Stanza non trovata')

      await joinGame({ gameId: game.id, profile })
      navigate(`/game/${game.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (myGames === null) return <Loader message="Carico le tue stanze..." />

  const sectionLabel = { fontWeight: 700, fontSize: '0.85rem', color: '#2c2417', margin: '0 0 8px' }
  const activeGames = myGames.filter((g) => g.status !== 'finished')
  const finishedGames = myGames.filter((g) => g.status === 'finished')

  const gameRow = (g) => (
    <div
      key={g.id}
      onClick={() => navigate(`/game/${g.id}`)}
      style={{
        border: '1px solid #e4ddcc',
        borderRadius: 14,
        padding: '10px 14px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff'
      }}
    >
      <span>
        <strong>{g.room_code}</strong>
      </span>
      <span style={{ fontSize: '0.8rem', color: '#5a5142' }}>
        {g.status === 'waiting' ? '⏳ in attesa' : g.status === 'finished' ? '🏆 conclusa' : `▶️ Epoca ${AGE_ROMAN[g.age]} · turno ${g.turn_number}`}
      </span>
    </div>
  )

  return (
    <div style={page}>
      <div style={{ ...cardWide, width: '92vw', maxWidth: 1200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
          <h1 style={{ ...title, margin: 0, textAlign: 'left' }}>7 Wonders online</h1>
          <button onClick={onSignOut} style={linkText}>
            Esci ({profile.nickname})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={sectionLabel}>Nuova stanza</p>
            <p style={{ color: '#5a5142', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Da 3 a 7 giocatori. Ognuno sceglie la propria Meraviglia dentro la stanza, prima di avviare la partita.
            </p>
            <button onClick={handleCreate} disabled={loading} style={primaryButton}>
              ➕ Crea una nuova stanza
            </button>

            <hr style={{ border: 'none', borderTop: '1px solid #e4ddcc', margin: '1.25rem 0' }} />

            <p style={sectionLabel}>Entra in una stanza esistente</p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Codice stanza"
              style={inputStyle}
            />
            <button onClick={handleJoin} disabled={loading} style={secondaryButton}>
              🚪 Entra in una stanza
            </button>

            {error && <p style={errorText}>{error}</p>}
          </div>

          <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #e4ddcc', paddingLeft: 24 }}>
            {activeGames.length === 0 && finishedGames.length === 0 && (
              <p style={{ color: '#5a5142', fontSize: '0.85rem' }}>Non hai ancora nessuna partita — creane una o entra in una stanza.</p>
            )}

            {activeGames.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p onClick={() => setShowActive(!showActive)} style={{ ...sectionLabel, cursor: 'pointer' }}>
                  {showActive ? '▾' : '▸'} Le tue partite ({activeGames.length})
                </p>
                {showActive && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{activeGames.map(gameRow)}</div>}
              </div>
            )}

            {finishedGames.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p onClick={() => setShowFinished(!showFinished)} style={{ ...sectionLabel, cursor: 'pointer', color: '#5a5142' }}>
                  {showFinished ? '▾' : '▸'} Partite concluse ({finishedGames.length})
                </p>
                {showFinished && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{finishedGames.map(gameRow)}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
