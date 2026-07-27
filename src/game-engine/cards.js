// ============================================================
// CARTE EPOCA — le 70 carte non-Gilda (Marroni/Grigie/Blu/Gialle/
// Rosse/Verdi) di Epoca I, II, III, espanse in 138 copie fisiche
// (vedi EXACT_THRESHOLDS più sotto).
//
// LIVELLO DI CONFIDENZA:
// - NOMI, COLORI, EPOCA: ALTA — trascritti 1:1 dalla scheda "Elenco
//   delle Carte" allegata.
// - NUMERO DI COPIE E SOGLIE DI GIOCATORI PER OGNI CARTA (EXACT_THRESHOLDS
//   più sotto): ALTA — confermate dall'utente carta per carta contro il
//   mazzo fisico (25/07). Il totale (49+49+50=148 con le Gilde) torna
//   esattamente con quanto dichiarato nel regolamento: forte conferma
//   indipendente di correttezza.
// - VALORI PV DELLE CARTE BLU DI EPOCA III (Pantheon 7, Municipio 6,
//   Palazzo 8, Senato 6, Giardini 5): ALTA — numeri grandi leggibili
//   direttamente nella foto della scheda.
// - EFFETTI DELLE GIALLE DI EPOCA II/III (Vigneto, Bazar, Faro, Porto,
//   Camera di Commercio) e "produce 2 unità"/"produce a scelta" delle
//   Marroni/Grigie di Epoca II: ALTA — testo esplicito nella scheda
//   "Descrizione degli Effetti".
// - COSTI IN RISORSE ESATTI di ogni singola carta e delle Gilde: ALTA —
//   verificati il 27/07 contro la 7 Wonders Wiki (fandom.com/List_of_Cards,
//   che codifica costi/effetti come icone nel markup HTML, non testo
//   libero — fonte affidabile). Corrette diverse imprecisioni rispetto
//   alla versione precedente (PV di Teatro/Pozzo, costi di una decina di
//   carte, ed effetti di Faro/Porto/Camera di Commercio che contavano il
//   colore sbagliato).
// - CATENE (chainFrom): MEDIA — vedi nota dedicata in fondo al file.
// ============================================================

const RAW = ['clay', 'stone', 'ore', 'wood']
const RARE = ['glass', 'loom', 'papyrus']

function brownFixed(id, name, resource, minPlayers, cost = {}) {
  return { id, name, age: 1, color: 'brown', minPlayers, cost, effect: { kind: 'produce_fixed', value: resource } }
}
function brownChoice(id, name, resources, minPlayers) {
  return { id, name, age: 1, color: 'brown', minPlayers, cost: { coins: 1 }, effect: { kind: 'produce_choice', value: resources } }
}
function greyFixed(id, name, resource, minPlayers) {
  return { id, name, age: 1, color: 'grey', minPlayers, cost: {}, effect: { kind: 'produce_fixed', value: resource } }
}
// Le carte Grigie di Epoca II hanno lo stesso nome di quelle di Epoca I
// (stesso edificio, seconda copia nel mazzo successivo) — helper separato
// per chiarezza sull'id univoco.
function greyFixed2Age(id, name, resource, minPlayers) {
  return { id, name, age: 2, color: 'grey', minPlayers, cost: {}, effect: { kind: 'produce_fixed', value: resource } }
}

const BASE_CARDS = [
  // ============================== EPOCA I ==============================
  // --- Marroni (Materie Prime) ---
  brownFixed('cantiere-abbattimento', "Cantiere d'Abbattimento", 'wood', 3),
  brownFixed('cava-pietra', 'Cava di Pietra', 'stone', 3),
  brownFixed('bacino-argilla', "Bacino d'Argilla", 'clay', 3),
  brownFixed('filone-minerario', 'Filone Minerario', 'ore', 3),
  brownChoice('vivaio', 'Vivaio', ['wood', 'clay'], 6),
  brownChoice('scavi', 'Scavi', ['stone', 'clay'], 4),
  brownChoice('fossa-argilla', "Fossa d'Argilla", ['clay', 'ore'], 3),
  brownChoice('deposito-legname', 'Deposito di Legname', ['stone', 'wood'], 3),
  brownChoice('giacimento', 'Giacimento', ['wood', 'ore'], 5),
  brownChoice('miniera', 'Miniera', ['stone', 'ore'], 6),

  // --- Grigie (Manufatti) ---
  greyFixed('vetreria-1', 'Vetreria', 'glass', 3),
  greyFixed('stamperia-1', 'Stamperia', 'papyrus', 3),
  greyFixed('filanda-1', 'Filanda', 'loom', 3),

  // --- Blu (Edifici Civili) ---
  { id: 'pozzo', name: 'Pozzo', age: 1, color: 'blue', minPlayers: 3, cost: {}, effect: { kind: 'vp', value: 3 }, chainTo: ['statua'] },
  { id: 'bagni', name: 'Bagni', age: 1, color: 'blue', minPlayers: 3, cost: { stone: 1 }, effect: { kind: 'vp', value: 3 }, chainTo: ['acquedotto'] },
  { id: 'altare', name: 'Altare', age: 1, color: 'blue', minPlayers: 3, cost: {}, effect: { kind: 'vp', value: 3 }, chainTo: ['tempio'] },
  { id: 'teatro', name: 'Teatro', age: 1, color: 'blue', minPlayers: 3, cost: {}, effect: { kind: 'vp', value: 3 }, chainTo: ['giardini'] },

  // --- Gialle (Edifici Commerciali) ---
  { id: 'taverna', name: 'Taverna', age: 1, color: 'yellow', minPlayers: 4, cost: {}, effect: { kind: 'coins_on_build', value: 5 } },
  {
    id: 'mercato',
    name: 'Mercato',
    age: 1,
    color: 'yellow',
    minPlayers: 3,
    cost: {},
    effect: { kind: 'trade_discount', value: { resources: RARE, neighbors: ['left', 'right'] } },
    chainTo: ['caravanserraglio']
  },
  {
    id: 'stazione-ovest',
    name: 'Stazione Commerciale Ovest',
    age: 1,
    color: 'yellow',
    minPlayers: 3,
    cost: {},
    effect: { kind: 'trade_discount', value: { resources: RAW, neighbors: ['left'] } }
  },
  {
    id: 'stazione-est',
    name: 'Stazione Commerciale Est',
    age: 1,
    color: 'yellow',
    minPlayers: 3,
    cost: {},
    effect: { kind: 'trade_discount', value: { resources: RAW, neighbors: ['right'] } }
  },

  // --- Rosse (Edifici Militari) ---
  { id: 'palizzata', name: 'Palizzata', age: 1, color: 'red', minPlayers: 3, cost: { wood: 1 }, effect: { kind: 'shields', value: 1 } },
  { id: 'caserma', name: 'Caserma', age: 1, color: 'red', minPlayers: 3, cost: { ore: 1 }, effect: { kind: 'shields', value: 1 } },
  { id: 'torre-guardia', name: 'Torre di Guardia', age: 1, color: 'red', minPlayers: 3, cost: { clay: 1 }, effect: { kind: 'shields', value: 1 } },

  // --- Verdi (Edifici Scientifici) ---
  { id: 'farmacia', name: 'Farmacia', age: 1, color: 'green', minPlayers: 3, cost: { loom: 1 }, effect: { kind: 'science', value: 'compass' }, chainTo: ['ambulatorio'] },
  { id: 'opificio', name: 'Opificio', age: 1, color: 'green', minPlayers: 3, cost: { glass: 1 }, effect: { kind: 'science', value: 'gear' }, chainTo: ['laboratorio'] },
  { id: 'scrittorio', name: 'Scrittorio', age: 1, color: 'green', minPlayers: 3, cost: { papyrus: 1 }, effect: { kind: 'science', value: 'tablet' }, chainTo: ['tribunale', 'biblioteca'] },

  // ============================== EPOCA II ==============================
  // --- Marroni (produzione raddoppiata) ---
  { id: 'segheria', name: 'Segheria', age: 2, color: 'brown', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'produce_fixed', value: 'wood', amount: 2 } },
  { id: 'tagliapietre', name: 'Tagliapietre', age: 2, color: 'brown', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'produce_fixed', value: 'stone', amount: 2 } },
  { id: 'mattonificio', name: 'Mattonificio', age: 2, color: 'brown', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'produce_fixed', value: 'clay', amount: 2 } },
  { id: 'fonderia', name: 'Fonderia', age: 2, color: 'brown', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'produce_fixed', value: 'ore', amount: 2 } },

  // --- Grigie ---
  greyFixed2Age('vetreria-2', 'Vetreria', 'glass', 3),
  greyFixed2Age('stamperia-2', 'Stamperia', 'papyrus', 3),
  { id: 'filanda-2', name: 'Filanda', age: 2, color: 'grey', minPlayers: 3, cost: {}, effect: { kind: 'produce_fixed', value: 'loom' } },

  // --- Blu ---
  { id: 'statua', name: 'Statua', age: 2, color: 'blue', minPlayers: 3, cost: { ore: 2, wood: 1 }, effect: { kind: 'vp', value: 4 }, chainFrom: ['pozzo'] },
  { id: 'acquedotto', name: 'Acquedotto', age: 2, color: 'blue', minPlayers: 3, cost: { stone: 3 }, effect: { kind: 'vp', value: 5 }, chainFrom: ['bagni'] },
  { id: 'tempio', name: 'Tempio', age: 2, color: 'blue', minPlayers: 3, cost: { wood: 1, clay: 1, glass: 1 }, effect: { kind: 'vp', value: 4 }, chainFrom: ['altare'] },
  { id: 'tribunale', name: 'Tribunale', age: 2, color: 'blue', minPlayers: 3, cost: { clay: 2, loom: 1 }, effect: { kind: 'vp', value: 4 }, chainFrom: ['scrittorio'] },

  // --- Gialle ---
  {
    id: 'caravanserraglio',
    name: 'Caravanserraglio',
    age: 2,
    color: 'yellow',
    minPlayers: 3,
    cost: { wood: 2 },
    effect: { kind: 'produce_choice', value: RAW },
    chainFrom: ['mercato']
  },
  { id: 'foro', name: 'Foro', age: 2, color: 'yellow', minPlayers: 3, cost: { clay: 2 }, effect: { kind: 'produce_choice', value: RARE }, chainFrom: ['stazione-ovest', 'stazione-est'] },
  {
    id: 'vigneto',
    name: 'Vigneto',
    age: 2,
    color: 'yellow',
    minPlayers: 3,
    cost: {},
    effect: { kind: 'coins_per_color', value: { color: 'brown', coinsEach: 1, scope: 'self_and_neighbors' } }
  },
  {
    id: 'bazar',
    name: 'Bazar',
    age: 2,
    color: 'yellow',
    minPlayers: 4,
    cost: {},
    effect: { kind: 'coins_per_color', value: { color: 'grey', coinsEach: 2, scope: 'self_and_neighbors' } }
  },

  // --- Rosse ---
  { id: 'scuderie', name: 'Scuderie', age: 2, color: 'red', minPlayers: 3, cost: { ore: 1, wood: 1, clay: 1 }, effect: { kind: 'shields', value: 2 }, chainFrom: ['caserma'] },
  { id: 'poligono-tiro', name: 'Poligono di Tiro', age: 2, color: 'red', minPlayers: 3, cost: { wood: 2, ore: 1 }, effect: { kind: 'shields', value: 2 } },
  { id: 'mura', name: 'Mura', age: 2, color: 'red', minPlayers: 3, cost: { stone: 3 }, effect: { kind: 'shields', value: 2 } },
  { id: 'zona-addestramento', name: "Zona d'Addestramento", age: 2, color: 'red', minPlayers: 3, cost: { ore: 2, wood: 1 }, effect: { kind: 'shields', value: 2 }, chainFrom: ['torre-guardia'] },

  // --- Verdi ---
  { id: 'ambulatorio', name: 'Ambulatorio', age: 2, color: 'green', minPlayers: 3, cost: { ore: 2, glass: 1 }, effect: { kind: 'science', value: 'compass' }, chainFrom: ['farmacia'], chainTo: ['loggia'] },
  { id: 'laboratorio', name: 'Laboratorio', age: 2, color: 'green', minPlayers: 3, cost: { clay: 2, papyrus: 1 }, effect: { kind: 'science', value: 'gear' }, chainFrom: ['opificio'], chainTo: ['osservatorio'] },
  { id: 'biblioteca', name: 'Biblioteca', age: 2, color: 'green', minPlayers: 3, cost: { stone: 2, loom: 1 }, effect: { kind: 'science', value: 'tablet' }, chainFrom: ['scrittorio'], chainTo: ['universita'] },
  { id: 'scuola', name: 'Scuola', age: 2, color: 'green', minPlayers: 3, cost: { wood: 1, papyrus: 1 }, effect: { kind: 'science', value: 'tablet' }, chainTo: ['accademia'] },

  // ============================== EPOCA III ==============================
  // --- Blu ---
  { id: 'pantheon', name: 'Pantheon', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 2, ore: 1, glass: 1, loom: 1, papyrus: 1 }, effect: { kind: 'vp', value: 7 }, chainFrom: ['altare'] },
  { id: 'giardini', name: 'Giardini', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 2, wood: 1 }, effect: { kind: 'vp', value: 5 }, chainFrom: ['teatro'] },
  { id: 'municipio', name: 'Municipio', age: 3, color: 'blue', minPlayers: 3, cost: { stone: 3, glass: 1 }, effect: { kind: 'vp', value: 6 } },
  { id: 'palazzo', name: 'Palazzo', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 1, stone: 1, ore: 1, wood: 1, glass: 1, loom: 1, papyrus: 1 }, effect: { kind: 'vp', value: 8 } },
  { id: 'senato', name: 'Senato', age: 3, color: 'blue', minPlayers: 3, cost: { wood: 2, stone: 1, ore: 1 }, effect: { kind: 'vp', value: 6 }, chainFrom: ['biblioteca', 'tribunale'] },

  // --- Gialle ---
  {
    id: 'faro',
    name: 'Faro',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { stone: 1, glass: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'yellow', coinsEach: 1, vpEach: 1, includeSelf: true } }
  },
  {
    id: 'porto',
    name: 'Porto',
    age: 3,
    color: 'yellow',
    minPlayers: 4,
    cost: { wood: 1, ore: 1, loom: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'brown', coinsEach: 1, vpEach: 1 } }
  },
  {
    id: 'camera-commercio',
    name: 'Camera di Commercio',
    age: 3,
    color: 'yellow',
    minPlayers: 4,
    cost: { clay: 2, papyrus: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'grey', coinsEach: 2, vpEach: 2 } }
  },
  {
    id: 'arena',
    name: 'Arena',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { clay: 2, ore: 1 },
    effect: { kind: 'coins_and_vp_per_wonder_stage', value: { coinsEach: 3, vpEach: 1 } }
  },
  {
    id: 'palestra-gladiatoria',
    name: 'Palestra Gladiatoria',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { stone: 1, ore: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'red', coinsEach: 3, vpEach: 1 } }
  },

  // --- Rosse (tutte 3 scudi) ---
  { id: 'castra', name: 'Castra', age: 3, color: 'red', minPlayers: 4, cost: { clay: 2, wood: 1, papyrus: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['mura'] },
  { id: 'fortificazioni', name: 'Fortificazioni', age: 3, color: 'red', minPlayers: 3, cost: { ore: 3, clay: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['zona-addestramento'] },
  { id: 'circo', name: 'Circo', age: 3, color: 'red', minPlayers: 4, cost: { clay: 3, ore: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['zona-addestramento'] },
  { id: 'arsenale', name: 'Arsenale', age: 3, color: 'red', minPlayers: 3, cost: { wood: 2, ore: 1, loom: 1 }, effect: { kind: 'shields', value: 3 } },
  { id: 'opificio-assedio', name: "Opificio d'Assedio", age: 3, color: 'red', minPlayers: 3, cost: { clay: 3, wood: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['poligono-tiro'] },

  // --- Verdi (tutte 1 simbolo a scelta) ---
  { id: 'loggia', name: 'Loggia', age: 3, color: 'green', minPlayers: 3, cost: { clay: 2, loom: 1, papyrus: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['ambulatorio'] },
  { id: 'osservatorio', name: 'Osservatorio', age: 3, color: 'green', minPlayers: 3, cost: { ore: 2, glass: 1, loom: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['laboratorio'] },
  { id: 'studio', name: 'Studio', age: 3, color: 'green', minPlayers: 3, cost: { wood: 1, papyrus: 1, loom: 1 }, effect: { kind: 'science_choice' } },
  { id: 'accademia', name: 'Accademia', age: 3, color: 'green', minPlayers: 3, cost: { stone: 3, glass: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['scuola'] },
  { id: 'universita', name: 'Università', age: 3, color: 'green', minPlayers: 3, cost: { wood: 2, glass: 1, papyrus: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['biblioteca'] }
]

// ============================================================
// SOGLIE ESATTE DI GIOCATORI PER OGNI COPIA FISICA — confermate
// dall'utente contro il mazzo fisico (25/07). Ogni carta del gioco
// reale ha 1, 2 o 3 copie fisiche, ciascuna utilizzabile solo a
// partire da un certo numero minimo di giocatori — è così che il
// mazzo scala restando sempre esattamente 7 carte a giocatore.
// Il totale torna esattamente con quanto dichiarato nel regolamento
// (49 carte Epoca I + 49 Epoca II + 50 Epoca III = 148), quindi questi
// dati sono considerati ALTA CONFIDENZA.
// Chiave: id della carta base definita sopra. Valore: elenco di TUTTE
// le soglie a cui esiste una copia (la prima sostituisce il
// minPlayers originale, le successive generano copie aggiuntive).
// ============================================================
const EXACT_THRESHOLDS = {
  // --- Epoca I ---
  'cantiere-abbattimento': [3, 4],
  'cava-pietra': [3, 5],
  'bacino-argilla': [3, 5],
  'filone-minerario': [3, 4],
  vivaio: [6],
  scavi: [4],
  'fossa-argilla': [3],
  'deposito-legname': [3],
  giacimento: [5],
  miniera: [6],
  'vetreria-1': [3, 6],
  'stamperia-1': [3, 6],
  'filanda-1': [3, 6],
  pozzo: [4, 7],
  bagni: [3, 7],
  altare: [3, 5],
  teatro: [3, 6],
  taverna: [4, 5, 7],
  mercato: [3, 6],
  'stazione-ovest': [3, 7],
  'stazione-est': [3, 7],
  palizzata: [3, 7],
  caserma: [3, 5],
  'torre-guardia': [3, 4],
  farmacia: [3, 5],
  opificio: [3, 7],
  scrittorio: [3, 4],
  // --- Epoca II ---
  segheria: [3, 4],
  tagliapietre: [3, 4],
  mattonificio: [3, 4],
  fonderia: [3, 4],
  'vetreria-2': [3, 5],
  'stamperia-2': [3, 5],
  'filanda-2': [3, 5],
  statua: [3, 7],
  acquedotto: [3, 7],
  tempio: [3, 6],
  tribunale: [3, 5],
  caravanserraglio: [3, 5, 6],
  foro: [3, 6, 7],
  vigneto: [3, 6],
  bazar: [4, 7],
  scuderie: [3, 5],
  'poligono-tiro': [3, 6],
  mura: [3, 7],
  'zona-addestramento': [4, 6, 7],
  ambulatorio: [3, 4],
  laboratorio: [3, 5],
  biblioteca: [3, 6],
  scuola: [3, 7],
  // --- Epoca III ---
  pantheon: [3, 6],
  giardini: [3, 4],
  municipio: [3, 6],
  palazzo: [3, 7],
  senato: [3, 5],
  faro: [3, 6],
  porto: [3, 4],
  'camera-commercio': [4, 6],
  arena: [3, 5],
  'palestra-gladiatoria': [5, 7],
  castra: [4, 7],
  fortificazioni: [3, 7],
  circo: [4, 6],
  arsenale: [3, 5],
  'opificio-assedio': [3, 5],
  loggia: [3, 6],
  osservatorio: [3, 7],
  studio: [3, 7],
  accademia: [3, 5],
  universita: [3, 4]
}

// Espande ogni carta base nelle sue copie reali secondo EXACT_THRESHOLDS
// (o la lascia con il suo minPlayers originale se non è in tabella —
// non dovrebbe succedere per le 70 carte non-Gilda, è solo un fallback
// di sicurezza).
function expandThresholds(baseCards) {
  const out = []
  for (const card of baseCards) {
    const thresholds = EXACT_THRESHOLDS[card.id] || [card.minPlayers]
    thresholds.forEach((minPlayers, i) => {
      if (i === 0) {
        out.push({ ...card, minPlayers })
      } else {
        // Copie successive alla prima: id univoco, nessuna concatenazione
        // propria (nel gioco fisico la concatenazione è una proprietà
        // dell'edificio, non della singola copia — averla su una sola
        // copia della carta è già sufficiente perché l'effetto valga).
        out.push({ ...card, id: `${card.id}-x${minPlayers}`, minPlayers, chainFrom: undefined, chainTo: undefined })
      }
    })
  }
  return out
}

export const CARDS = expandThresholds(BASE_CARDS)

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]))

// ============================================================
// NOTA SULLE CATENE: la scheda "Elenco delle Concatenazioni" allegata
// mostra graficamente quale carta sblocca quale, con frecce e un
// simbolo di concatenazione condiviso — non tutte le coppie erano
// leggibili con certezza dal testo estratto dell'immagine. Quelle sopra
// (chainFrom/chainTo) sono la mia migliore ricostruzione incrociando la
// scheda con la lista classica delle concatenazioni del gioco. Se in
// partita una carta che ti aspetti di costruire gratis non lo permette,
// segnalamelo: è una correzione isolata (aggiungere/togliere un id da
// chainFrom) in questo file.
// ============================================================
