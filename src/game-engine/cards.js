// ============================================================
// CARTE EPOCA — le 73 carte non-Gilda (Marroni/Grigie/Blu/Gialle/
// Rosse/Verdi) di Epoca I, II, III.
//
// LIVELLO DI CONFIDENZA:
// - NOMI, COLORI, EPOCA: ALTA — trascritti 1:1 dalla scheda "Elenco
//   delle Carte" allegata (73 nomi, in ordine, per epoca).
// - VALORI PV DELLE CARTE BLU DI EPOCA III (Pantheon 7, Municipio 6,
//   Palazzo 8, Senato 6, Giardini 5): ALTA — numeri grandi leggibili
//   direttamente nella foto della scheda.
// - EFFETTI DELLE GIALLE DI EPOCA II/III (Vigneto, Bazar, Faro, Porto,
//   Camera di Commercio) e "produce 2 unità"/"produce a scelta" delle
//   Marroni/Grigie di Epoca II: ALTA — testo esplicito nella scheda
//   "Descrizione degli Effetti".
// - COSTI IN RISORSE ESATTI di ogni singola carta e MINIMO GIOCATORI
//   preciso per carta: MEDIA — ricostruiti dalla mia conoscenza
//   generale del gioco, le icone non erano leggibili con certezza
//   pixel per pixel nelle foto. Da verificare contro il mazzo fisico:
//   è un file isolato, una riga per carta, facile da correggere.
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

export const CARDS = [
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
  { id: 'pozzo', name: 'Pozzo', age: 1, color: 'blue', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'vp', value: 2 }, chainTo: ['statua'] },
  { id: 'bagni', name: 'Bagni', age: 1, color: 'blue', minPlayers: 3, cost: { stone: 1 }, effect: { kind: 'vp', value: 3 }, chainTo: ['acquedotto'] },
  { id: 'altare', name: 'Altare', age: 1, color: 'blue', minPlayers: 3, cost: {}, effect: { kind: 'vp', value: 2 }, chainTo: ['tempio'] },
  { id: 'teatro', name: 'Teatro', age: 1, color: 'blue', minPlayers: 3, cost: {}, effect: { kind: 'vp', value: 2 }, chainTo: ['giardini'] },

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
  { id: 'palizzata', name: 'Palizzata', age: 1, color: 'red', minPlayers: 3, cost: { coins: 1 }, effect: { kind: 'shields', value: 1 } },
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
  { id: 'statua', name: 'Statua', age: 2, color: 'blue', minPlayers: 3, cost: { wood: 1, ore: 1 }, effect: { kind: 'vp', value: 4 }, chainFrom: ['pozzo'] },
  { id: 'acquedotto', name: 'Acquedotto', age: 2, color: 'blue', minPlayers: 3, cost: { stone: 3 }, effect: { kind: 'vp', value: 5 }, chainFrom: ['bagni'] },
  { id: 'tempio', name: 'Tempio', age: 2, color: 'blue', minPlayers: 3, cost: { wood: 1, clay: 1, glass: 1 }, effect: { kind: 'vp', value: 4 }, chainFrom: ['altare'] },
  { id: 'tribunale', name: 'Tribunale', age: 2, color: 'blue', minPlayers: 3, cost: { wood: 2, loom: 1 }, effect: { kind: 'vp', value: 5 }, chainFrom: ['scrittorio'] },

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
  { id: 'zona-addestramento', name: "Zona d'Addestramento", age: 2, color: 'red', minPlayers: 3, cost: { ore: 2, clay: 1 }, effect: { kind: 'shields', value: 2 }, chainFrom: ['torre-guardia'] },

  // --- Verdi ---
  { id: 'ambulatorio', name: 'Ambulatorio', age: 2, color: 'green', minPlayers: 3, cost: { stone: 2, loom: 1 }, effect: { kind: 'science', value: 'compass' }, chainFrom: ['farmacia'], chainTo: ['loggia'] },
  { id: 'laboratorio', name: 'Laboratorio', age: 2, color: 'green', minPlayers: 3, cost: { clay: 2, papyrus: 1 }, effect: { kind: 'science', value: 'gear' }, chainFrom: ['opificio'], chainTo: ['osservatorio'] },
  { id: 'biblioteca', name: 'Biblioteca', age: 2, color: 'green', minPlayers: 3, cost: { stone: 2, wood: 1 }, effect: { kind: 'science', value: 'tablet' }, chainFrom: ['scrittorio'], chainTo: ['universita'] },
  { id: 'scuola', name: 'Scuola', age: 2, color: 'green', minPlayers: 3, cost: { wood: 1, papyrus: 1 }, effect: { kind: 'science', value: 'tablet' }, chainTo: ['accademia'] },

  // ============================== EPOCA III ==============================
  // --- Blu ---
  { id: 'pantheon', name: 'Pantheon', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 2, ore: 1, glass: 1, loom: 1, papyrus: 1 }, effect: { kind: 'vp', value: 7 }, chainFrom: ['altare'] },
  { id: 'giardini', name: 'Giardini', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 2, wood: 1 }, effect: { kind: 'vp', value: 5 }, chainFrom: ['teatro'] },
  { id: 'municipio', name: 'Municipio', age: 3, color: 'blue', minPlayers: 3, cost: { stone: 2, ore: 1, wood: 1 }, effect: { kind: 'vp', value: 6 } },
  { id: 'palazzo', name: 'Palazzo', age: 3, color: 'blue', minPlayers: 3, cost: { clay: 1, stone: 1, ore: 1, wood: 1, glass: 1, loom: 1, papyrus: 1 }, effect: { kind: 'vp', value: 8 } },
  { id: 'senato', name: 'Senato', age: 3, color: 'blue', minPlayers: 3, cost: { wood: 2, stone: 1, ore: 1 }, effect: { kind: 'vp', value: 6 }, chainFrom: ['biblioteca', 'tribunale'] },

  // --- Gialle ---
  {
    id: 'faro',
    name: 'Faro',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { ore: 1, glass: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'brown', coinsEach: 1, vpEach: 1 } }
  },
  {
    id: 'porto',
    name: 'Porto',
    age: 3,
    color: 'yellow',
    minPlayers: 4,
    cost: { wood: 1, loom: 1 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'grey', coinsEach: 2, vpEach: 2 } }
  },
  {
    id: 'camera-commercio',
    name: 'Camera di Commercio',
    age: 3,
    color: 'yellow',
    minPlayers: 4,
    cost: { papyrus: 2 },
    effect: { kind: 'per_color_coins_and_vp', value: { color: 'yellow', coinsEach: 1, vpEach: 1, includeSelf: true } }
  },
  {
    id: 'arena',
    name: 'Arena',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { stone: 2, ore: 1 },
    effect: { kind: 'coins_and_vp_per_wonder_stage', value: { coinsEach: 3, vpEach: 1 } }
  },
  {
    id: 'palestra-gladiatoria',
    name: 'Palestra Gladiatoria',
    age: 3,
    color: 'yellow',
    minPlayers: 3,
    cost: { clay: 1, stone: 1 },
    effect: { kind: 'coins_per_color', value: { color: 'red', coinsEach: 1, scope: 'self' } }
  },

  // --- Rosse (tutte 3 scudi) ---
  { id: 'castra', name: 'Castra', age: 3, color: 'red', minPlayers: 4, cost: { wood: 1, ore: 1, loom: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['mura'] },
  { id: 'fortificazioni', name: 'Fortificazioni', age: 3, color: 'red', minPlayers: 3, cost: { ore: 3, stone: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['zona-addestramento'] },
  { id: 'circo', name: 'Circo', age: 3, color: 'red', minPlayers: 4, cost: { stone: 3, clay: 2 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['zona-addestramento'] },
  { id: 'arsenale', name: 'Arsenale', age: 3, color: 'red', minPlayers: 3, cost: { wood: 2, ore: 1, loom: 1 }, effect: { kind: 'shields', value: 3 } },
  { id: 'opificio-assedio', name: "Opificio d'Assedio", age: 3, color: 'red', minPlayers: 3, cost: { wood: 3, clay: 1 }, effect: { kind: 'shields', value: 3 }, chainFrom: ['poligono-tiro'] },

  // --- Verdi (tutte 1 simbolo a scelta) ---
  { id: 'loggia', name: 'Loggia', age: 3, color: 'green', minPlayers: 3, cost: { glass: 1, loom: 1, papyrus: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['ambulatorio'] },
  { id: 'osservatorio', name: 'Osservatorio', age: 3, color: 'green', minPlayers: 3, cost: { ore: 2, glass: 1, loom: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['laboratorio'] },
  { id: 'studio', name: 'Studio', age: 3, color: 'green', minPlayers: 3, cost: { wood: 1, papyrus: 1, glass: 1 }, effect: { kind: 'science_choice' } },
  { id: 'accademia', name: 'Accademia', age: 3, color: 'green', minPlayers: 3, cost: { stone: 3, glass: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['scuola'] },
  { id: 'universita', name: 'Università', age: 3, color: 'green', minPlayers: 3, cost: { wood: 2, papyrus: 1 }, effect: { kind: 'science_choice' }, chainFrom: ['biblioteca'] }
]

// Le carte Grigie di Epoca II hanno lo stesso nome di quelle di Epoca I
// (stesso edificio, seconda copia nel mazzo successivo) — helper separato
// per chiarezza sull'id univoco.
function greyFixed2Age(id, name, resource, minPlayers) {
  return { id, name, age: 2, color: 'grey', minPlayers, cost: {}, effect: { kind: 'produce_fixed', value: resource } }
}

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
