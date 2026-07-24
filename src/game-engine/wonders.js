// ============================================================
// PLANCE MERAVIGLIA — 7 Meraviglie x 2 lati (A/B) x fino a 4 stadi.
//
// LIVELLO DI CONFIDENZA (leggi prima di fidarti ciecamente, stesso
// spirito delle note su animalCards.js in Harmonies):
// - I numeri grandi (Punti Vittoria, Monete) sono letti direttamente e
//   con sicurezza dalle foto allegate (es. Gizah A: 3/5/7 — numeri
//   grandi e inequivocabili).
// - Le RISORSE esatte di costo di ogni stadio sono ricostruite dalla
//   mia conoscenza generale del gioco (icone troppo piccole nelle foto
//   per essere lette pixel per pixel con certezza assoluta) — quindi
//   PRIMA DI GIOCARE SUL SERIO conviene controllare ogni plancia contro
//   quella fisica e correggere qui, è un file isolato, una riga per
//   stadio. Le abilità speciali (produzione a scelta, sconti commercio,
//   copia gilda, ecc.) sono codificate con "effectKind" + "effectValue"
//   già pronti per l'engine, ma vale lo stesso invito a verifica.
// ============================================================

export const RESOURCES = ['clay', 'stone', 'ore', 'wood', 'glass', 'loom', 'papyrus']
export const RAW_RESOURCES = ['clay', 'stone', 'ore', 'wood']
export const RARE_RESOURCES = ['glass', 'loom', 'papyrus']

// effectKind possibili per uno stadio di Meraviglia:
// 'vp'                 -> effectValue = numero di PV a fine partita
// 'coins'               -> effectValue = monete immediate alla costruzione
// 'vp_and_coins'         -> effectValue = { vp, coins }
// 'produce_choice'       -> effectValue = elenco risorse tra cui scegliere 1/turno (RAW_RESOURCES o RARE_RESOURCES)
// 'military'             -> effectValue = numero di scudi
// 'science'              -> effectValue = numero di simboli scientifici a scelta libera (di solito 1)
// 'build_from_hand_free' -> una volta per Epoca, costruisci un edificio dalla mano gratis
// 'build_from_discard'   -> a fine turno, scegli 1 carta dagli scarti e costruiscila gratis
// 'play_last_card'       -> puoi giocare l'ultima carta di ogni Epoca invece di scartarla
// 'copy_guild'           -> a fine partita copia una gilda di un vicino
// 'trade_discount'       -> effectValue = { resources: RAW_RESOURCES|RARE_RESOURCES, neighbors: ['left','right'] }
export const WONDERS = {
  alexandria: {
    name: 'Alessandria',
    startResource: 'glass',
    sides: {
      A: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 2 }, effectKind: 'produce_choice', effectValue: RAW_RESOURCES },
          { cost: { glass: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { wood: 2 }, effectKind: 'trade_discount', effectValue: { resources: RAW_RESOURCES, neighbors: ['left', 'right'] } },
          { cost: { clay: 2 }, effectKind: 'trade_discount', effectValue: { resources: RARE_RESOURCES, neighbors: ['left', 'right'] } },
          { cost: { stone: 3 }, effectKind: 'vp', effectValue: 7 }
        ]
      }
    }
  },
  babylon: {
    name: 'Babilonia',
    startResource: 'clay',
    sides: {
      A: {
        stages: [
          { cost: { clay: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { wood: 1, loom: 1, clay: 1 }, effectKind: 'produce_choice', effectValue: RARE_RESOURCES },
          { cost: { clay: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { loom: 1, clay: 1 }, effectKind: 'vp', effectValue: 3 },
          { cost: { glass: 1, wood: 2, clay: 1 }, effectKind: 'build_from_hand_free' },
          { cost: { clay: 3, ore: 2 }, effectKind: 'science', effectValue: 1 }
        ]
      }
    }
  },
  ephesos: {
    name: 'Efeso',
    startResource: 'papyrus',
    sides: {
      A: {
        stages: [
          { cost: { stone: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { wood: 2 }, effectKind: 'coins', effectValue: 9 },
          { cost: { papyrus: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { stone: 2 }, effectKind: 'vp_and_coins', effectValue: { vp: 2, coins: 4 } },
          { cost: { wood: 1, ore: 1 }, effectKind: 'vp_and_coins', effectValue: { vp: 3, coins: 4 } },
          { cost: { papyrus: 1, glass: 1 }, effectKind: 'vp_and_coins', effectValue: { vp: 5, coins: 4 } }
        ]
      }
    }
  },
  gizah: {
    name: 'Giza',
    startResource: 'stone',
    sides: {
      A: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { ore: 3 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { stone: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { ore: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      }
    }
  },
  halikarnassos: {
    name: 'Halikarnassos',
    startResource: 'loom',
    sides: {
      A: {
        stages: [
          { cost: { loom: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 3 }, effectKind: 'build_from_discard' },
          { cost: { loom: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 2 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 1 },
          { cost: { glass: 1, loom: 1 }, effectKind: 'build_from_discard' }
        ]
      }
    }
  },
  olympia: {
    name: 'Olympia',
    startResource: 'wood',
    sides: {
      A: {
        stages: [
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 2 }, effectKind: 'play_last_card' },
          { cost: { stone: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { wood: 2 }, effectKind: 'coins', effectValue: 1 },
          { cost: { stone: 2 }, effectKind: 'vp', effectValue: 5 },
          { cost: { loom: 1, ore: 1 }, effectKind: 'copy_guild' }
        ]
      }
    }
  },
  rhodos: {
    name: 'Rodi',
    startResource: 'ore',
    sides: {
      A: {
        stages: [
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { clay: 3 }, effectKind: 'military', effectValue: 2 },
          { cost: { ore: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { wood: 3 }, effectKind: 'vp_and_coins', effectValue: { vp: 3, coins: 3 }, extraMilitary: 1 },
          { cost: { ore: 4 }, effectKind: 'vp_and_coins', effectValue: { vp: 4, coins: 4 }, extraMilitary: 1 }
        ]
      }
    }
  }
}

export const WONDER_IDS = Object.keys(WONDERS)
