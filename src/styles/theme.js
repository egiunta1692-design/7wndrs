// Stile condiviso tra Auth.jsx e Lobby.jsx — stesso marrone chiaro dello
// sfondo globale (vedi index.css), stessi pulsanti a pillola ovunque.

export const ACCENT = 'linear-gradient(135deg, #8a6a48 0%, #5c3d24 100%)'

// Nessuno sfondo qui: lasciamo trasparire il gradiente del <body> in
// index.css, così lo sfondo è SEMPRE identico in tutto il sito senza
// doverlo duplicare.
export const page = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'sans-serif',
  padding: 20
}

export const card = {
  width: 360,
  maxWidth: '100%',
  background: '#fdfbf3',
  borderRadius: 24,
  padding: '2rem 1.75rem',
  boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
}

export const cardWide = { ...card, width: 440 }

export const title = { textAlign: 'center', fontSize: '1.7rem', fontWeight: 800, color: '#2c2417', margin: '0 0 1.5rem' }

export const toggleWrap = {
  display: 'flex',
  background: '#fff',
  borderRadius: 999,
  border: '1px solid #e4ddcc',
  padding: 4,
  marginBottom: '1.25rem'
}

export function toggleBtn(active) {
  return {
    flex: 1,
    border: 'none',
    borderRadius: 999,
    padding: '0.6rem 0',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    background: active ? ACCENT : 'transparent',
    color: active ? '#fff' : '#2c2417',
    transition: 'background 0.15s'
  }
}

export const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  border: '1px solid #e4ddcc',
  borderRadius: 999,
  padding: '0.8rem 1.1rem',
  fontSize: '0.95rem',
  color: '#2c2417',
  marginBottom: '0.75rem',
  outline: 'none'
}

export const primaryButton = {
  display: 'block',
  width: '100%',
  border: 'none',
  borderRadius: 999,
  padding: '0.85rem 0',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#fff',
  background: ACCENT,
  cursor: 'pointer',
  marginTop: '0.25rem'
}

export const secondaryButton = {
  display: 'block',
  width: '100%',
  border: '1px solid #e4ddcc',
  borderRadius: 999,
  padding: '0.8rem 0',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#2c2417',
  background: '#fff',
  cursor: 'pointer',
  marginTop: '0.5rem'
}

// Stesso stile a pillola di secondaryButton, ma inline e compatto — per
// i pulsanti dentro la partita (Avvia, Conferma turno, Annulla, ecc.),
// dove serve restare stretti sul contenuto e non spostare il resto
// dell'interfaccia. Larghezza NON forzata: si adatta al testo, come i
// bottoni nativi che sostituisce.
export const pillButton = {
  display: 'inline-block',
  border: '1px solid #e4ddcc',
  borderRadius: 999,
  padding: '0.4rem 0.9rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#2c2417',
  background: '#fff',
  cursor: 'pointer'
}

export const linkText = {
  background: 'none',
  border: 'none',
  color: '#6b5842',
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 0,
  fontSize: '0.85rem'
}

export const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 6, margin: '0.4rem 0 1rem', fontSize: '0.85rem', color: '#5a5142' }
export const errorText = { color: '#b3261e', fontSize: '0.85rem', margin: '0 0 0.75rem' }
export const infoText = { color: '#2e6b3e', fontSize: '0.85rem', margin: '0 0 0.75rem' }
export const footerText = { textAlign: 'center', fontSize: '0.85rem', color: '#5a5142', margin: '1rem 0 0' }
