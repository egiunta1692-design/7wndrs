// ============================================================
// PLANCE MERAVIGLIA — 7 Meraviglie x 2 lati (A/B) x 2-4 stadi.
//
// LIVELLO DI CONFIDENZA: ALTA — dati forniti direttamente dall'utente
// contro le carte fisiche, riverificati riga per riga in due passaggi
// (28/07 e 30/07). Corretto un ultimo refuso trovato nel secondo
// controllo: risorsa di partenza di Olympia era rimasta "Legno" invece
// di "Argilla".
//
// Note su Rodi lato B e Babilonia lato B: hanno solo 2 stadi (non 3),
// confermato esplicitamente dall'utente — non tutte le plance ne hanno
// necessariamente 3.
// ============================================================

export const RESOURCES = ['clay', 'stone', 'ore', 'wood', 'glass', 'loom', 'papyrus']
export const RAW_RESOURCES = ['clay', 'stone', 'ore', 'wood']
export const RARE_RESOURCES = ['glass', 'loom', 'papyrus']

// effectKind possibili per uno stadio di Meraviglia:
// 'vp'                    -> effectValue = numero di PV a fine partita
// 'coins'                  -> effectValue = monete immediate alla costruzione
// 'vp_and_coins'            -> effectValue = { vp, coins }
// 'produce_choice'          -> effectValue = elenco risorse tra cui scegliere 1/turno (RAW_RESOURCES o RARE_RESOURCES)
// 'military'                -> effectValue = numero di scudi
// 'science'                 -> effectValue = numero di simboli scientifici a scelta libera (di solito 1)
// 'build_from_hand_free'    -> una volta per Epoca, costruisci un edificio dalla mano gratis
// 'build_from_discard'      -> a fine turno, scegli 1 carta dagli scarti e costruiscila gratis
// 'play_last_card'          -> puoi giocare l'ultima carta di ogni Epoca invece di scartarla
// 'build_first_color_free'  -> puoi costruire gratis la prima carta di ogni colore che non hai già
// 'build_first_age_free'    -> puoi costruire gratis la prima carta di ogni Epoca
// 'build_last_age_free'     -> puoi costruire gratis l'ultima carta di ogni Epoca
// 'copy_guild'              -> a fine partita copia una gilda di un vicino
// 'trade_discount'          -> effectValue = { resources: RAW_RESOURCES|RARE_RESOURCES, neighbors: ['left','right'] }
//
// Campi aggiuntivi facoltativi su uno stadio (si sommano indipendentemente
// dall'effectKind principale, per gli stadi che danno "abilità + PV" o
// "abilità + potenza militare" insieme):
// 'extraVp'       -> PV aggiuntivi a fine partita
// 'extraMilitary' -> scudi aggiuntivi
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
          { cost: { clay: 2 }, effectKind: 'produce_choice', effectValue: RAW_RESOURCES },
          { cost: { ore: 3 }, effectKind: 'produce_choice', effectValue: RARE_RESOURCES },
          { cost: { wood: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      }
    }
  },
  babylon: {
    name: 'Babilonia',
    startResource: 'wood',
    sides: {
      A: {
        stages: [
          { cost: { clay: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 2, loom: 1 }, effectKind: 'science', effectValue: 1 },
          { cost: { clay: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Solo 2 stadi (confermato dall'utente). "Gioca l'ultima carta" è
        // qui, NON su Olympia come nella revisione precedente.
        stages: [
          { cost: { stone: 2 }, effectKind: 'play_last_card' },
          { cost: { clay: 3, glass: 1 }, effectKind: 'science', effectValue: 1 }
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
          { cost: { clay: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { wood: 2 }, effectKind: 'coins', effectValue: 9 },
          { cost: { ore: 2, glass: 1 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { stone: 2 }, effectKind: 'vp_and_coins', effectValue: { vp: 2, coins: 4 } },
          { cost: { wood: 2 }, effectKind: 'vp_and_coins', effectValue: { vp: 3, coins: 4 } },
          { cost: { ore: 2, loom: 1 }, effectKind: 'vp_and_coins', effectValue: { vp: 5, coins: 4 } }
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
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { stone: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // 4 stadi (confermato).
        stages: [
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { stone: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { stone: 4, papyrus: 1 }, effectKind: 'vp', effectValue: 7 }
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
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { glass: 1, papyrus: 1 }, effectKind: 'build_from_discard' },
          { cost: { stone: 3 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Tutti e 3 gli stadi danno "costruisci gratis dagli scarti",
        // i primi due con un bonus PV aggiuntivo.
        stages: [
          { cost: { clay: 2 }, effectKind: 'build_from_discard', extraVp: 2 },
          { cost: { glass: 1, papyrus: 1 }, effectKind: 'build_from_discard', extraVp: 1 },
          { cost: { wood: 3 }, effectKind: 'build_from_discard' }
        ]
      }
    }
  },
  olympia: {
    name: 'Olympia',
    startResource: 'clay',
    sides: {
      A: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { wood: 2 }, effectKind: 'build_first_color_free' },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        stages: [
          { cost: { ore: 2 }, effectKind: 'build_first_age_free', extraVp: 2 },
          { cost: { clay: 3 }, effectKind: 'build_last_age_free', extraVp: 3 },
          { cost: { glass: 1, loom: 1, papyrus: 1 }, effectKind: 'vp', effectValue: 5 }
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
        // Solo 2 stadi (confermato). Ognuno da' PV + monete + 1 potenza
        // militare aggiuntiva insieme.
        stages: [
          { cost: { stone: 3 }, effectKind: 'vp_and_coins', effectValue: { vp: 3, coins: 3 }, extraMilitary: 1 },
          { cost: { ore: 4 }, effectKind: 'vp_and_coins', effectValue: { vp: 4, coins: 4 }, extraMilitary: 1 }
        ]
      }
    }
  }
}

export const WONDER_IDS = Object.keys(WONDERS)
