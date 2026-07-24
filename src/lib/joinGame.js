import { supabase } from './supabaseClient'

// Entra in una partita con il profilo dell'utente autenticato. Stesso
// principio di Harmonies: chi era già seduto rientra sempre; un NUOVO
// giocatore può entrare solo mentre la partita è 'waiting'.
export async function joinGame({ gameId, profile }) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non sei autenticato')

  const { data: existing } = await supabase
    .from('players')
    .select()
    .eq('game_id', gameId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return existing

  const { data: game, error: gameError } = await supabase.from('games').select('status').eq('id', gameId).single()
  if (gameError) throw gameError
  if (game.status !== 'waiting') {
    throw new Error('Questa partita è già iniziata: non puoi più entrare come nuovo giocatore.')
  }

  const { data: inserted, error } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      user_id: user.id,
      nickname: profile.nickname
    })
    .select()
    .single()
  if (error) throw error

  const { error: handError } = await supabase.from('player_hands').insert({
    game_id: gameId,
    player_id: inserted.id,
    user_id: user.id,
    hand: []
  })
  if (handError) throw handError

  return inserted
}
