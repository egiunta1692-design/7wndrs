import { Component } from 'react'

// Le Error Boundary richiedono un componente a classe: non esiste ancora
// un equivalente a Hook in React. Cattura qualsiasi errore non gestito
// durante il render dei componenti figli.
//
// Comportamento: questi errori sono quasi sempre solo lato interfaccia
// (i dati sul server restano corretti, vedi le note nel resto del
// progetto sulla race condition tra salvataggio e realtime) — quindi
// proviamo un ricaricamento automatico della pagina, che di norma
// risolve da solo. Per evitare un loop infinito nel caso capiti un
// problema vero e persistente, il refresh automatico scatta solo se
// non ne è già stato fatto uno negli ultimi 10 secondi: altrimenti
// mostriamo il messaggio manuale con il pulsante.
const RELOAD_COOLDOWN_MS = 10000
const RELOAD_TIMESTAMP_KEY = '7wonders_error_reload_at'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, autoReloading: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Errore non gestito nell\'interfaccia:', error, info)

    const lastReload = Number(sessionStorage.getItem(RELOAD_TIMESTAMP_KEY) || 0)
    const now = Date.now()

    if (now - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now))
      this.setState({ autoReloading: true })
      window.location.reload()
    }
  }

  render() {
    if (this.state.error) {
      if (this.state.autoReloading) {
        return (
          <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', color: '#666' }}>
            <p>Si è verificato un piccolo intoppo nell'interfaccia — ricarico automaticamente...</p>
          </div>
        )
      }

      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 500, margin: '4rem auto' }}>
          <h1>Qualcosa è andato storto nell'interfaccia</h1>
          <p>
            La partita sul server non è stata toccata da questo errore (i tuoi ultimi dati sono già
            salvati). Il ricaricamento automatico non ha risolto da solo — è capitato di nuovo troppo
            in fretta, quindi probabilmente è qualcosa che vale la pena segnalare. Puoi comunque
            ricaricare di nuovo la pagina in sicurezza.
          </p>
          <pre
            style={{
              background: '#f1efe8',
              padding: 8,
              borderRadius: 6,
              fontSize: 12,
              overflow: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()}>🔄 Ricarica la pagina</button>
        </div>
      )
    }
    return this.props.children
  }
}
