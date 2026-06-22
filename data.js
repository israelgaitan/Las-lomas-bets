/* ============================================================
   LAS LOMAS BETS — data.js
   Estado central de la app y configuración por defecto.
   ============================================================ */

const STORAGE_KEY = "lasLomasBets_v1";

// Stroke index genérico por defecto (dificultad 1=más difícil .. 18=más fácil)
const DEFAULT_STROKE_INDEX = [5, 1, 13, 9, 3, 15, 7, 17, 11, 6, 2, 14, 10, 4, 16, 8, 18, 12];

// Par genérico por defecto de cada hoyo (plantilla editable, par 72 total)
const DEFAULT_PAR = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];

// Par REAL de Las Lomas Club de Golf (Zapopan), confirmado con la tarjeta
// de resultados del usuario (TheGrint, salida Blancas, par total 71).
const LAS_LOMAS_PAR = [4, 3, 4, 5, 4, 3, 4, 4, 4, 4, 5, 3, 4, 4, 4, 4, 3, 5];

// Hándicap/ventaja por hoyo REAL de Las Lomas (fila "Ventajas Caballeros"
// de la tarjeta oficial del club). 1 = hoyo más difícil, 18 = más fácil.
const LAS_LOMAS_STROKE_INDEX = [11, 13, 15, 5, 7, 17, 1, 9, 3, 4, 8, 14, 16, 10, 2, 6, 12, 18];

// Par y ventaja REALES de Atlas Country Club (tarjeta oficial del club).
// Par total 72.
const ATLAS_PAR = [5, 4, 4, 3, 4, 4, 3, 5, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4];
const ATLAS_STROKE_INDEX = [17, 9, 1, 15, 3, 13, 11, 7, 5, 12, 4, 6, 10, 14, 18, 2, 16, 8];

// Par y ventaja REALES de Las Cañadas CC (tarjeta oficial del club, escrita
// a mano por el usuario y verificada). Par total 72.
const CANADAS_PAR = [4, 4, 3, 4, 5, 5, 4, 4, 3, 5, 4, 3, 4, 4, 4, 5, 3, 4];
const CANADAS_STROKE_INDEX = [15, 1, 11, 3, 13, 5, 9, 7, 17, 4, 2, 14, 12, 10, 6, 8, 18, 16];

// Par y ventaja REALES de Guadalajara Country Club (tarjeta oficial del
// club, escrita a mano por el usuario y verificada). Par total 72.
const GDLCC_PAR = [5, 4, 4, 3, 4, 4, 4, 3, 5, 4, 4, 5, 4, 4, 3, 4, 3, 5];
const GDLCC_STROKE_INDEX = [17, 15, 1, 11, 3, 5, 9, 7, 13, 18, 4, 8, 2, 6, 12, 14, 10, 16];

// Par y ventaja REALES de Santa Anita Club (tarjeta oficial del club,
// escrita a mano por el usuario y verificada). Par total 72.
const SANTA_ANITA_PAR = [5, 4, 4, 4, 3, 4, 5, 4, 3, 4, 3, 4, 5, 4, 3, 4, 5, 4];
const SANTA_ANITA_STROKE_INDEX = [5, 3, 11, 9, 15, 7, 13, 1, 17, 4, 18, 10, 2, 8, 14, 6, 12, 16];

// Par y ventaja REALES de El Cielo (tarjeta oficial del club, escrita a
// mano por el usuario y verificada). Par total 72.
const EL_CIELO_PAR = [4, 4, 5, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4, 3, 4, 5];
const EL_CIELO_STROKE_INDEX = [1, 11, 13, 17, 5, 15, 9, 7, 3, 14, 12, 8, 16, 2, 4, 18, 6, 10];

// Canchas precargadas. El stroke index sigue siendo una PLANTILLA genérica:
// el usuario debe ajustarlo con la tarjeta oficial del club (la fila de
// "Hcp" o "Handicap" por hoyo) la primera vez que juegue ahí, desde Config.
function defaultCourses() {
  return [
    {
      id: "lomas",
      name: "Las Lomas",
      par: [...LAS_LOMAS_PAR],
      strokeIndex: [...LAS_LOMAS_STROKE_INDEX],
    },
    {
      id: "atlas",
      name: "Atlas CC",
      par: [...ATLAS_PAR],
      strokeIndex: [...ATLAS_STROKE_INDEX],
    },
    {
      id: "canadas",
      name: "Las Cañadas CC",
      par: [...CANADAS_PAR],
      strokeIndex: [...CANADAS_STROKE_INDEX],
    },
    {
      id: "gdlcc",
      name: "Guadalajara CC",
      par: [...GDLCC_PAR],
      strokeIndex: [...GDLCC_STROKE_INDEX],
    },
    {
      id: "santaanita",
      name: "Santa Anita Club",
      par: [...SANTA_ANITA_PAR],
      strokeIndex: [...SANTA_ANITA_STROKE_INDEX],
    },
    {
      id: "elcielo",
      name: "El Cielo",
      par: [...EL_CIELO_PAR],
      strokeIndex: [...EL_CIELO_STROKE_INDEX],
    },
  ];
}

function defaultPlayer(id, name) {
  return { id, name, hcp: 0 };
}

function emptyHoleScores() {
  // 18 posiciones, null = no jugado aún
  return new Array(18).fill(null);
}

function emptySandyFlags() {
  // 18 posiciones, true = el jugador hizo el evento en ese hoyo
  return new Array(18).fill(false);
}

function emptyBanderasFlags() {
  // 18 posiciones: { banderas: 0 (sin marcar), threePutt: false }
  return new Array(18).fill(null).map(() => ({ banderas: 0, threePutt: false }));
}

function emptyLobaHoyo() {
  // por hoyo: { loba: playerId|null, companero: playerId|null, multiplicador: number }
  // multiplicador solo se usa en el hoyo 18 (1 = normal, el jugador que va
  // perdiendo en el acumulado puede subirlo libremente)
  return new Array(18).fill(null).map(() => ({ loba: null, companero: null, multiplicador: 1 }));
}

function newState() {
  const courses = defaultCourses();
  return {
    courses,
    round: {
      courseId: courses[0].id,
      currentHole: 1,
    },
    unit: 1000, // valor de la unidad de apuesta, en la moneda que sea
    players: [
      defaultPlayer(1, "Jugador 1"),
      defaultPlayer(2, "Jugador 2"),
      defaultPlayer(3, "Jugador 3"),
      defaultPlayer(4, "Jugador 4"),
      defaultPlayer(5, "Jugador 5"),
    ],
    // golpes brutos por jugador por hoyo: { [playerId]: [18 valores] }
    scores: {
      1: emptyHoleScores(),
      2: emptyHoleScores(),
      3: emptyHoleScores(),
      4: emptyHoleScores(),
      5: emptyHoleScores(),
    },
    // sandy marcado manualmente: { [playerId]: [18 booleanos] }
    sandies: {
      1: emptySandyFlags(),
      2: emptySandyFlags(),
      3: emptySandyFlags(),
      4: emptySandyFlags(),
      5: emptySandyFlags(),
    },
    // oyes marcado manualmente (solo aplica en hoyos par 3): { [playerId]: [18 booleanos] }
    oyes: {
      1: emptySandyFlags(),
      2: emptySandyFlags(),
      3: emptySandyFlags(),
      4: emptySandyFlags(),
      5: emptySandyFlags(),
    },
    // banderas/3-putt marcado manualmente por jugador y hoyo:
    // { [playerId]: [18 valores { banderas: number, threePutt: boolean }] }
    // banderas > 0 y threePutt son mutuamente excluyentes en la práctica,
    // pero se guardan por separado para no perder datos si se marcan ambos.
    banderas: {
      1: emptyBanderasFlags(),
      2: emptyBanderasFlags(),
      3: emptyBanderasFlags(),
      4: emptyBanderasFlags(),
      5: emptyBanderasFlags(),
    },
    // loba: por hoyo, quién es loba y a quién elige de compañero
    loba: emptyLobaHoyo(),
    bets: {
      individuales: {
        enabled: true,
        // ids de jugadores que participan en individuales hoy (para generar
        // automáticamente todos los enfrentamientos entre ellos)
        participantes: [1, 2, 3, 4, 5],
        // pares 1v1: lista de {a, b, montoIda, montoVuelta}
        matches: [],
      },
      foursome: {
        enabled: true,
        // 3 cruces fijos: 1+2 vs 3+4 / 1+2 vs 3+5 / 1+2 vs 4+5
        // montoIda: $ por hoyo (igual para bola alta y baja) en hoyos 1-9
        // montoVuelta: $ por hoyo (igual para bola alta y baja) en hoyos 10-18
        crosses: [
          { id: "A", base: [1, 2], rival: [3, 4], montoIda: 0, montoVuelta: 0 },
          { id: "B", base: [1, 2], rival: [3, 5], montoIda: 0, montoVuelta: 0 },
          { id: "C", base: [1, 2], rival: [4, 5], montoIda: 0, montoVuelta: 0 },
        ],
      },
      skins: {
        enabled: true,
        montoPorHoyo: 0,
      },
      loba: {
        enabled: true,
        // monto base por jugador (como el "$100" del ejemplo)
        monto: 0,
      },
      stableford: {
        enabled: true,
        // 3 premios separados: ida (1-9), vuelta (10-18), total (18 hoyos)
        montoIda: 0,
        montoVuelta: 0,
        montoTotal: 0,
      },
      banderas: {
        enabled: true,
        // ids de jugadores que participan en banderas/3-putt hoy
        participantes: [1, 2, 3, 4, 5],
        // monto base: banderas cobra monto×N banderas a cada uno de los
        // demás PARTICIPANTES; 3-putt paga monto×1 a cada uno de ellos
        monto: 0,
      },
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newState();
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch (e) {
    console.error("Error cargando estado:", e);
    return newState();
  }
}

// Compatibilidad con guardados de versiones anteriores (antes de multi-cancha/loba)
function migrateState(state) {
  // "Unidades" se eliminó como modalidad independiente: los eventos
  // especiales (birdie/águila/etc.) ahora se integran dentro de cada
  // apuesta (individuales, foursome, skins, loba) con su propio monto.
  if (state.bets && state.bets.unidades) delete state.bets.unidades;

  if (!state.courses) {
    const courses = defaultCourses();
    const oldRound = state.round || {};
    courses[0].par = oldRound.par || [...DEFAULT_PAR];
    courses[0].strokeIndex = oldRound.strokeIndex || [...DEFAULT_STROKE_INDEX];
    state.courses = courses;
    state.round = {
      courseId: courses[0].id,
      currentHole: oldRound.currentHole || 1,
    };
  } else {
    // Actualizar canchas precargadas (lomas/atlas/canadas) que sigan con la
    // plantilla genérica vieja, sin tocar nada que el usuario haya editado
    // a mano. Si el par/strokeIndex guardado coincide EXACTO con la
    // plantilla genérica de cuando se creó, asumimos que nunca se editó.
    const realData = { lomas: { par: LAS_LOMAS_PAR, strokeIndex: LAS_LOMAS_STROKE_INDEX },
                        atlas: { par: ATLAS_PAR, strokeIndex: ATLAS_STROKE_INDEX },
                        canadas: { par: CANADAS_PAR, strokeIndex: CANADAS_STROKE_INDEX } };
    const arraysIguales = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

    state.courses.forEach((c) => {
      const real = realData[c.id];
      if (!real) return; // canchas custom del usuario no tienen dato real precargado
      const parEsGenerico = arraysIguales(c.par, DEFAULT_PAR);
      const siEsGenerico = arraysIguales(c.strokeIndex, DEFAULT_STROKE_INDEX);
      if (parEsGenerico) c.par = [...real.par];
      if (siEsGenerico) c.strokeIndex = [...real.strokeIndex];
    });

    // Agregar canchas precargadas NUEVAS que el usuario todavía no tenga
    // en su lista (ej: se agregó Guadalajara CC después de que ya jugaba
    // con la app). No se toca ninguna cancha existente, solo se añaden
    // las que falten por id.
    const idsExistentes = new Set(state.courses.map((c) => c.id));
    defaultCourses().forEach((dc) => {
      if (!idsExistentes.has(dc.id)) state.courses.push(dc);
    });
  }
  if (!state.loba) state.loba = emptyLobaHoyo();
  state.loba.forEach((h) => {
    if (h.multiplicador === undefined) h.multiplicador = 1;
  });
  if (!state.bets.loba) state.bets.loba = { enabled: true, monto: 0 };
  if (!state.bets.stableford) {
    state.bets.stableford = { enabled: true, montoIda: 0, montoVuelta: 0, montoTotal: 0 };
  }
  if (!state.bets.banderas) {
    state.bets.banderas = { enabled: true, monto: 0 };
  }
  if (!state.banderas) {
    state.banderas = {};
    state.players.forEach((p) => (state.banderas[p.id] = emptyBanderasFlags()));
  }
  if (!state.oyes) {
    state.oyes = {};
    state.players.forEach((p) => (state.oyes[p.id] = emptySandyFlags()));
  }
  if (!state.bets.individuales.participantes) {
    state.bets.individuales.participantes = state.players.map((p) => p.id);
  }
  if (!state.bets.banderas.participantes) {
    state.bets.banderas.participantes = state.players.map((p) => p.id);
  }
  // migrar partidos viejos que tenían un solo campo "monto" en vez de ida/vuelta
  state.bets.individuales.matches.forEach((m) => {
    if (m.montoIda === undefined) {
      m.montoIda = m.monto || 0;
      m.montoVuelta = m.monto || 0;
      delete m.monto;
    }
  });
  // migrar cruces de foursome viejos (montoAlta/montoBaja) al nuevo esquema
  // por vuelta (montoIda/montoVuelta, mismo valor para alta y baja)
  state.bets.foursome.crosses.forEach((c) => {
    if (c.montoIda === undefined) {
      const base = c.montoBaja || c.montoAlta || 0;
      c.montoIda = base;
      c.montoVuelta = base;
      delete c.montoAlta;
      delete c.montoBaja;
    }
  });
  return state;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error guardando estado:", e);
  }
}

function getActiveCourse(state) {
  return state.courses.find((c) => c.id === state.round.courseId) || state.courses[0];
}

