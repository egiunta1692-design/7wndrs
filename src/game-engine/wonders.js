// ============================================================
// PLANCE MERAVIGLIA — 7 Meraviglie x 2 lati (A/B) x fino a 4 stadi.
//
// LIVELLO DI CONFIDENZA (aggiornato 24/07 dopo revisione con screenshot
// ufficiali ad alta risoluzione — molto più leggibili delle foto fisiche):
//
// - ALTA CONFIDENZA, verificato con zoom pixel-per-pixel sugli screenshot:
//   Alexandria (A e B), Babylon (A e B), Ephesos (A e B), Gizah (A e B,
//   incluso il fatto che il lato B ha 4 stadi e non 3). Le risorse di
//   partenza di tutte e 7 le Meraviglie sono confermate su entrambi i lati.
// - Gizah B, stadi 2 e 3: il tipo di risorsa (Pietra vs Minerale) resta
//   con margine di incertezza — le icone dei due stadi sono molto simili
//   nello screenshot e non sono riuscito a distinguerle con certezza
//   assoluta prima di un problema tecnico di visualizzazione.
// - MEDIA CONFIDENZA, NON ancora riverificato con gli screenshot ad alta
//   risoluzione (dati della ricostruzione originale da conoscenza generale
//   del gioco, invariati): Halikarnassós (A/B), Olympia (A/B), Rhodos (A/B).
//   Un problema tecnico di visualizzazione ha interrotto la sessione di
//   verifica prima di arrivare a queste tre — riprendibile in una nuova
//   conversazione (bastano gli stessi screenshot, o anche solo quelli
//   mancanti: Halikarnassós, Olympia, Rhodos, giorno e notte).
// - Le abilità speciali (produzione a scelta, sconti commercio, copia
//   gilda, costruisci gratis dagli scarti/dalla mano) sono codificate nei
//   dati sotto ma non hanno ancora un'interfaccia interattiva in Game.jsx.
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
        // Verificato su immagini alta risoluzione (day/night wiki) 24/07: confermato identico ai dati precedenti.
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 2 }, effectKind: 'produce_choice', effectValue: RAW_RESOURCES },
          { cost: { glass: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Corretto 24/07: non è uno sconto commercio, è produzione a scelta (visto chiaramente sull'immagine ad alta risoluzione).
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
    startResource: 'clay',
    sides: {
      A: {
        // Corretto 24/07: stadio 2 costa Minerale (non risorse miste) e da' scelta libera di un simbolo scientifico.
        stages: [
          { cost: { clay: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { ore: 3 }, effectKind: 'science', effectValue: 1 },
          { cost: { clay: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Corretto 24/07: costi rivisti dopo lettura ravvicinata.
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { clay: 2, glass: 1 }, effectKind: 'build_from_hand_free' },
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
        // Corretto 24/07: stadio1 Argilla (non Pietra), stadio3 Minerale (non Papiro).
        stages: [
          { cost: { clay: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { wood: 2 }, effectKind: 'coins', effectValue: 9 },
          { cost: { ore: 2 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Corretto 24/07: costi rivisti (Minerale/Legno/Vetro+Tessuto), effetti PV+monete confermati.
        stages: [
          { cost: { ore: 2 }, effectKind: 'vp_and_coins', effectValue: { vp: 2, coins: 4 } },
          { cost: { wood: 2 }, effectKind: 'vp_and_coins', effectValue: { vp: 3, coins: 4 } },
          { cost: { glass: 2, loom: 1 }, effectKind: 'vp_and_coins', effectValue: { vp: 5, coins: 4 } }
        ]
      }
    }
  },
  gizah: {
    name: 'Giza',
    startResource: 'stone',
    sides: {
      A: {
        // Verificato su immagini alta risoluzione 24/07: 2 Legno->3PV, 3 Argilla->5PV, 4 Minerale->7PV.
        stages: [
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
          { cost: { clay: 3 }, effectKind: 'vp', effectValue: 5 },
          { cost: { ore: 4 }, effectKind: 'vp', effectValue: 7 }
        ]
      },
      B: {
        // Confermato 24/07: 4 stadi (non 3). Stadio2/3 Pietra/Argilla da riverificare
        // (icone molto simili tra loro nello screenshot, vedi nota in cima al file).
        stages: [
          { cost: { wood: 2 }, effectKind: 'vp', effectValue: 3 },
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
