// ============================================================
// GILDE — 10 carte Viola di Epoca III. Effetti trascritti quasi alla
// lettera dalla scheda "Descrizione degli Effetti" e dal riferimento
// EOG allegato (ALTA confidenza sugli effetti). Costi in risorse:
// MEDIA confidenza, come per cards.js — vedi nota lì.
//
// scoringKind usato da scoring.js per calcolare i PV a fine partita:
// - 'per_color_in_neighbors'  -> value: { color, vpEach }
// - 'per_wonder_stage_self_and_neighbors' -> value: { vpEach }
// - 'per_brown_grey_purple_self' -> value: { vpEach }
// - 'science_choice'          -> guadagna 1 simbolo scientifico a scelta (risolto automaticamente scegliendo il simbolo che massimizza il punteggio finale del giocatore)
// ============================================================

export const GUILDS = [
  {
    id: 'gilda-lavoratori',
    name: 'Gilda dei Lavoratori',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { ore: 2, clay: 1, stone: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'brown', vpEach: 1 }
  },
  {
    id: 'gilda-artigiani',
    name: 'Gilda degli Artigiani',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { wood: 2, ore: 1, loom: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'grey', vpEach: 2 }
  },
  {
    id: 'gilda-magistrati',
    name: 'Gilda dei Magistrati',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { wood: 3, stone: 1, loom: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'blue', vpEach: 1 }
  },
  {
    id: 'gilda-mercanti',
    name: 'Gilda dei Mercanti',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { loom: 1, papyrus: 1, glass: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'yellow', vpEach: 1 }
  },
  {
    id: 'gilda-filosofi',
    name: 'Gilda dei Filosofi',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { clay: 3, loom: 1, papyrus: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'green', vpEach: 1 }
  },
  {
    id: 'gilda-spie',
    name: 'Gilda delle Spie',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { clay: 3, glass: 1 },
    scoringKind: 'per_color_in_neighbors',
    scoringValue: { color: 'red', vpEach: 1 }
  },
  {
    id: 'gilda-costruttori',
    name: 'Gilda dei Costruttori',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { stone: 2, clay: 2, glass: 1 },
    scoringKind: 'per_wonder_stage_self_and_neighbors',
    scoringValue: { vpEach: 1 }
  },
  {
    id: 'gilda-arredatori',
    name: 'Gilda degli Arredatori',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { wood: 2, stone: 2, loom: 1, papyrus: 1 },
    scoringKind: 'all_wonder_stages_flat',
    scoringValue: { vp: 7 }
  },
  {
    id: 'gilda-scienziati',
    name: 'Gilda degli Scienziati',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { wood: 2, ore: 2, papyrus: 1 },
    scoringKind: 'science_choice',
    scoringValue: {}
  },
  {
    id: 'gilda-armatori',
    name: 'Gilda degli Armatori',
    age: 3,
    color: 'purple',
    minPlayers: 3,
    cost: { ore: 3, wood: 1, glass: 1 },
    scoringKind: 'per_brown_grey_purple_self',
    scoringValue: { vpEach: 1 }
  }
]

export const GUILDS_BY_ID = Object.fromEntries(GUILDS.map((g) => [g.id, g]))
