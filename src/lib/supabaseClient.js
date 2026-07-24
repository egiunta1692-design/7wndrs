import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example in .env e riempilo.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// Autenticazione via email — sostituisce il precedente login anonimo.
// Ogni persona si registra una volta con email+password; auth.uid()
// resta stabile per sempre su quell'account, qualunque dispositivo o
// browser usi per rientrare (basta rifare login).
// ============================================================

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Manda l'email con il link per reimpostare la password dimenticata.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  })
  if (error) throw error
}

// Imposta una nuova password — va chiamata SOLO durante il flusso di
// recupero (dopo aver cliccato il link ricevuto via email), quando
// Supabase apre automaticamente una sessione temporanea di recupero.
export async function updateMyPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Reinvia l'email di conferma, per chi non l'ha ricevuta o l'ha persa.
export async function resendConfirmationEmail(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) throw error
}

// Il profilo (nickname) è separato dall'account email+password: subito
// dopo la registrazione l'utente è autenticato ma non ha ancora un
// profilo, finché non sceglie il nickname (vedi Auth.jsx).
export async function getMyProfile() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    // La sessione salvata nel browser non è più valida lato server (es.
    // utente cancellato dopo un reset del database) — la ripuliamo
    // esplicitamente, altrimenti l'app resterebbe convinta che "una
    // sessione c'è" ma senza profilo, mostrando per errore la scelta
    // del nickname invece di riportare al login.
    await supabase.auth.signOut()
    return null
  }

  const { data } = await supabase.from('profiles').select().eq('id', user.id).maybeSingle()
  return data
}

export async function createMyProfile(nickname) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non sei autenticato')

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, nickname: nickname.trim() })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Questo nickname è già in uso da un altro account. Scegline un altro.')
    throw error
  }
  return data
}
