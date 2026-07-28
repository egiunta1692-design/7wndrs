// ============================================================
// Libreria icone SVG — sostituisce le emoji che su alcune versioni di
// Windows (in particolare Windows 10 non aggiornato) non vengono
// renderizzate correttamente perché introdotte in versioni recenti di
// Unicode (es. 🪙🪨🪵 del 2020, 🟡🟢🟣🟤 del 2019) e il font di sistema
// non le contiene ancora. Un SVG si vede identico ovunque, senza
// dipendere dal font emoji installato.
//
// Stile coerente: tratto 1.6, viewBox 24x24, colore ereditato da
// "currentColor" (si adatta al testo circostante) salvo le icone
// "colore carta" che hanno un riempimento fisso.
// ============================================================

import woodIconUrl from '../assets/icons/wood.svg'
import coinIconUrl from '../assets/icons/coin.svg'
import stoneIconUrl from '../assets/icons/stone.svg'

const IMAGE_ICONS = { wood: woodIconUrl, coin: coinIconUrl, stone: stoneIconUrl }

// Icona da file immagine (stone/wood/coin — illustrazioni a colori
// fissi fornite dall'utente, non ereditano currentColor).
export function ImgIcon({ name, size = 16, style, title }) {
  const src = IMAGE_ICONS[name]
  if (!src) return null
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title || ''}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style }}
    />
  )
}

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

// Prima tranche: risorse, colori carta, simboli scientifici, punteggio/gioco.
export const ICON_PATHS = {
  // ---- Risorse ----
  clay: (
    <>
      <path {...STROKE_PROPS} d="M4 10.5h16v6.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path {...STROKE_PROPS} d="M4 14h16" />
    </>
  ),
  stone: <path {...STROKE_PROPS} d="M5 15 4 10l4-4 8-1 4 4-1 7-5 3H8z" />,
  ore: (
    <>
      <path {...STROKE_PROPS} d="M12 3 19 9 16 20H8L5 9Z" />
      <path {...STROKE_PROPS} d="M12 3v17M5 9h14" />
    </>
  ),
  wood: (
    <>
      <circle cx="12" cy="12" r="8" {...STROKE_PROPS} />
      <circle cx="12" cy="12" r="3.8" {...STROKE_PROPS} />
    </>
  ),
  glass: <path {...STROKE_PROPS} d="M10 3h4M11 3v6l-5 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-5-9V3" />,
  loom: (
    <>
      <rect x="6.5" y="4" width="11" height="16" rx="2" {...STROKE_PROPS} />
      <path {...STROKE_PROPS} d="M6.5 8.3h11M6.5 12h11M6.5 15.7h11" />
    </>
  ),
  papyrus: (
    <>
      <rect x="5" y="7" width="14" height="10" rx="5" {...STROKE_PROPS} />
      <path {...STROKE_PROPS} d="M8.3 7v10M15.7 7v10" />
    </>
  ),

  // ---- Colori carta (badge pieno, colore fisso non ereditato) ----
  color_brown: <circle cx="12" cy="12" r="9" fill="#8a6a48" />,
  color_grey: <circle cx="12" cy="12" r="9" fill="#a9a9a9" />,
  color_blue: <circle cx="12" cy="12" r="9" fill="#3b6ea5" />,
  color_yellow: <circle cx="12" cy="12" r="9" fill="#dba627" />,
  color_red: <circle cx="12" cy="12" r="9" fill="#c0392b" />,
  color_green: <circle cx="12" cy="12" r="9" fill="#4a8f52" />,
  color_purple: <circle cx="12" cy="12" r="9" fill="#7d5ba6" />,

  // ---- Simboli scientifici ----
  compass: (
    <>
      <path {...STROKE_PROPS} d="M12 4 18 20M12 4 6 20M9.3 13h5.4" />
      <circle cx="12" cy="4" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="4.2" {...STROKE_PROPS} />
      <path
        {...STROKE_PROPS}
        d="M12 3v2.6M12 18.4V21M21 12h-2.6M5.6 12H3M18.1 5.9l-1.8 1.8M7.7 16.4l-1.8 1.8M18.1 18.1l-1.8-1.8M7.7 7.6 5.9 5.9"
      />
    </>
  ),
  tablet: (
    <>
      <rect x="5.5" y="4" width="13" height="16" rx="1.5" {...STROKE_PROPS} />
      <path {...STROKE_PROPS} d="M8.3 8.3h7.4M8.3 12h7.4M8.3 15.7h4.8" />
    </>
  ),

  // ---- Punteggio / risorse di gioco ----
  trophy: (
    <>
      <path {...STROKE_PROPS} d="M7.5 4h9v4a4.5 4.5 0 0 1-9 0z" />
      <path {...STROKE_PROPS} d="M7.5 5H4.8a2.8 2.8 0 0 0 2.9 4.6M16.5 5h2.7a2.8 2.8 0 0 1-2.9 4.6" />
      <path {...STROKE_PROPS} d="M12 12.5v3M9.5 19.5h5M10.3 15.5h3.4v4h-3.4z" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" {...STROKE_PROPS} />
      <circle cx="12" cy="12" r="4.6" {...STROKE_PROPS} />
    </>
  ),
  shield: <path {...STROKE_PROPS} d="M12 3.2 19 6v6c0 5-3 7.8-7 8.8-4-1-7-3.8-7-8.8V6Z" />,
  swords: <path {...STROKE_PROPS} d="M4 20 18 6M20.5 3.5l-3 .8.8-3zM20.5 20.5 6 6M3.5 3.5l3 .8-.8-3z" />,
  wonder: <path {...STROKE_PROPS} d="M4 20.5h16M5 20V9.3M9 20V9.3M12 20V9.3M15 20V9.3M19 20V9.3M2.8 9.3 12 4l9.2 5.3" />
}

// name: chiave in ICON_PATHS. size: lato in px (icona quadrata).
// style/className: passati al <svg> per allineamento col testo attorno.
export default function Icon({ name, size = 16, style, className, title }) {
  const content = ICON_PATHS[name]
  if (!content) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  )
}
