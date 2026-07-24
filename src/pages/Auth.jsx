import { useEffect, useState } from 'react'
import {
  supabase,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  getMyProfile,
  createMyProfile,
  resendConfirmationEmail,
  requestPasswordReset,
  updateMyPassword
} from '../lib/supabaseClient'
import Loader from '../components/Loader'
import {
  page,
  card,
  title,
  toggleWrap,
  toggleBtn,
  inputStyle,
  primaryButton,
  secondaryButton,
  linkText,
  checkboxLabel,
  errorText,
  infoText,
  footerText
} from '../styles/theme'

// Avvolge tutta l'app: finché non c'è una sessione autenticata E un
// profilo (nickname) associato, mostra il modulo di accesso invece dei
// figli. Passa "profile" e "signOut" ai figli tramite render prop, così
// il resto dell'app ha sempre a disposizione il nickname dell'utente
// senza doverlo ripescare ogni volta.
export default function Auth({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (!newSession) {
        setProfile(null)
        setProfileLoading(true) // pronto per il prossimo login
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setProfileLoading(true)
    getMyProfile().then((p) => {
      setProfile(p)
      setProfileLoading(false)
    })
  }, [session])

  async function handleAuthSubmit() {
    if (!email.trim() || !password) return setError('Inserisci email e password')
    if (mode === 'register' && password !== passwordConfirm) return setError('Le due password non coincidono')
    setSubmitting(true)
    setError(null)
    setInfo(null)
    setNeedsConfirmation(false)
    try {
      if (mode === 'register') {
        const data = await signUpWithEmail(email.trim(), password)
        if (!data.session) {
          // Conferma email richiesta dal progetto Supabase: nessuna
          // sessione finché non si clicca il link ricevuto via email.
          setInfo('Ti abbiamo mandato un\'email di conferma: apri il link per completare la registrazione, poi torna qui e accedi.')
          setMode('login')
        }
      } else {
        await signInWithEmail(email.trim(), password)
      }
    } catch (err) {
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        setError('Devi prima confermare la tua email: controlla la posta (anche lo spam) e apri il link che ti abbiamo mandato.')
        setNeedsConfirmation(true)
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendConfirmation() {
    if (!email.trim()) return setError('Inserisci prima la tua email')
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await resendConfirmationEmail(email.trim())
      setInfo('Email di conferma reinviata: controlla la posta (anche lo spam).')
      setNeedsConfirmation(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestPasswordReset() {
    if (!email.trim()) return setError('Inserisci la tua email')
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await requestPasswordReset(email.trim())
      setInfo("Ti abbiamo mandato un'email con il link per reimpostare la password.")
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetNewPassword() {
    if (!newPassword) return setError('Inserisci la nuova password')
    if (newPassword !== newPasswordConfirm) return setError('Le due password non coincidono')
    if (newPassword.length < 6) return setError('La password deve avere almeno 6 caratteri')
    setSubmitting(true)
    setError(null)
    try {
      await updateMyPassword(newPassword)
      setRecoveryMode(false)
      setNewPassword('')
      setNewPasswordConfirm('')
      setInfo('Password aggiornata!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateProfile() {
    if (!nickname.trim()) return setError('Scegli un nickname')
    setSubmitting(true)
    setError(null)
    try {
      const created = await createMyProfile(nickname)
      setProfile(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader message="Verifico l'accesso..." />

  // Recupero password: priorità su tutto il resto, compare appena
  // Supabase apre la sessione temporanea di recupero (dopo aver
  // cliccato il link ricevuto via email).
  if (recoveryMode) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={title}>Nuova password</h1>
          <input
            type={showNewPassword ? 'text' : 'password'}
            placeholder="Nuova password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type={showNewPassword ? 'text' : 'password'}
            placeholder="Conferma nuova password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            style={inputStyle}
          />
          <label style={checkboxLabel}>
            <input type="checkbox" checked={showNewPassword} onChange={(e) => setShowNewPassword(e.target.checked)} />
            Mostra password
          </label>
          {error && <p style={errorText}>{error}</p>}
          {info && <p style={infoText}>{info}</p>}
          <button onClick={handleSetNewPassword} disabled={submitting} style={primaryButton}>
            {submitting ? '...' : 'Imposta nuova password'}
          </button>
        </div>
      </div>
    )
  }

  // Nessuna sessione — login, registrazione, o richiesta di recupero password.
  if (!session) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={title}>{mode === 'register' ? 'Registrati' : mode === 'forgot' ? 'Recupera password' : 'Accedi'}</h1>

          {mode !== 'forgot' && (
            <div style={toggleWrap}>
              <button
                style={toggleBtn(mode === 'login')}
                onClick={() => { setMode('login'); setError(null); setInfo(null) }}
              >
                Accedi
              </button>
              <button
                style={toggleBtn(mode === 'register')}
                onClick={() => { setMode('register'); setError(null); setInfo(null) }}
              >
                Registrati
              </button>
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          {mode === 'forgot' ? (
            <>
              {error && <p style={errorText}>{error}</p>}
              {info && <p style={infoText}>{info}</p>}
              <button onClick={handleRequestPasswordReset} disabled={submitting} style={primaryButton}>
                {submitting ? '...' : 'Invia email di recupero'}
              </button>
              <button onClick={() => { setMode('login'); setError(null); setInfo(null) }} style={secondaryButton}>
                ← Torna al login
              </button>
            </>
          ) : (
            <>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />

              {mode === 'register' && (
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Conferma password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  style={inputStyle}
                />
              )}

              <label style={checkboxLabel}>
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                Mostra password
              </label>

              {mode === 'login' && (
                <p style={{ margin: '0 0 0.75rem' }}>
                  <button onClick={() => { setMode('forgot'); setError(null); setInfo(null) }} style={linkText}>
                    Password dimenticata?
                  </button>
                </p>
              )}

              {error && <p style={errorText}>{error}</p>}
              {info && <p style={infoText}>{info}</p>}
              {needsConfirmation && (
                <button onClick={handleResendConfirmation} disabled={submitting} style={secondaryButton}>
                  Reinvia email di conferma
                </button>
              )}
              <button onClick={handleAuthSubmit} disabled={submitting} style={primaryButton}>
                {submitting ? '...' : mode === 'login' ? 'Accedi' : 'Registrati'}
              </button>

              <p style={footerText}>
                {mode === 'login' ? (
                  <>
                    Non hai un account?{' '}
                    <button onClick={() => { setMode('register'); setError(null); setInfo(null) }} style={linkText}>
                      Registrati ora
                    </button>
                  </>
                ) : (
                  <>
                    Hai già un account?{' '}
                    <button onClick={() => { setMode('login'); setError(null); setInfo(null) }} style={linkText}>
                      Accedi
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // Sessione presente, profilo ancora in verifica — loader, MAI il
  // modulo "scegli nickname" per errore durante questo controllo.
  if (profileLoading) return <Loader message="Carico il tuo profilo..." />

  // Sessione presente ma nessun profilo — scelta nickname (una tantum,
  // resta legato all'account per sempre).
  if (!profile) {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={title}>Scegli il tuo nickname</h1>
          <p style={{ color: '#5a5142', fontSize: '0.9rem', margin: '0 0 1rem', textAlign: 'center' }}>
            Sarà il tuo identificativo in tutte le partite — unico per tutta l'app, non potrai cambiarlo qui in
            seguito.
          </p>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" style={inputStyle} />
          {error && <p style={errorText}>{error}</p>}
          <button onClick={handleCreateProfile} disabled={submitting} style={primaryButton}>
            {submitting ? '...' : 'Conferma'}
          </button>
        </div>
      </div>
    )
  }

  // Tutto pronto — resto dell'app.
  return children({ profile, signOut })
}
