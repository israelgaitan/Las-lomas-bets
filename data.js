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
// club, confirmada con foto directa de la tarjeta el 2026-07-02: fila
// "Ventaja Caballeros" hoyos 1-9 y 10-18). Par total 72.
const GDLCC_PAR = [5, 4, 4, 3, 4, 4, 4, 3, 5, 4, 4, 5, 4, 4, 3, 4, 3, 5];
const GDLCC_STROKE_INDEX = [15, 13, 3, 17, 7, 1, 9, 11, 5, 12, 4, 8, 2, 6, 18, 14, 10, 16];
// valor viejo (incorrecto) de GDLCC_STROKE_INDEX antes de la corrección de
// arriba. Se usa solo en migrateState() para detectar y arreglar canchas
// ya guardadas en el dispositivo del usuario que traigan este error.
const GDLCC_STROKE_INDEX_VIEJO_INCORRECTO = [17, 15, 1, 11, 3, 5, 9, 7, 13, 18, 4, 8, 2, 6, 12, 14, 10, 16];

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
  // hándicap independiente por modalidad: cada jugador puede llevar un
  // hándicap distinto en individuales, foursome, skins, loba y stableford
  // (ej: acuerdos históricos / "biblia" que no siguen el hcp oficial actual).
  return {
    id,
    name,
    // si este jugador de la ronda de hoy fue llenado eligiéndolo de "Mis
    // amigos", aquí queda el id de ese amigo permanente (para poder sumar
    // el resultado de individuales de hoy a su historial). null = nombre
    // escrito a mano, no está ligado a ningún amigo guardado.
    friendId: null,
    hcp: {
      individuales: 0,
      foursome: 0,
      skins: 0,
      loba: 0,
      stableford: 0,
    },
  };
}

// Un "amigo" es un jugador guardado en la lista permanente (independiente
// de la ronda de hoy), para no tener que retipear nombres cada vez.
// biblia = número que el usuario ajusta a MANO después de cada ronda
// (+1 si le ganó, -1 si le tocó dar más ventaja, etc). Es solo una
// referencia visual: no se suma automático al hándicap del día, el
// usuario decide cómo usarlo al llenar el hcp de cada modalidad.
// individualesTotal = dinero acumulado en TODA la historia de individuales
// jugadas contra este amigo, desde el punto de vista de "mí" (positivo =
// este amigo me debe en total). Se actualiza solo al guardar una ronda al
// historial (ver archivarRonda en logic.js). individualesHistorial guarda
// el detalle ronda por ronda.
function defaultFriend(id, name) {
  return {
    id,
    name,
    biblia: 0,
    individualesTotal: 0,
    individualesHistorial: [],
    // igual que individualesTotal pero para Foursome (también es pareja
    // vs pareja, así que sí se puede atribuir "contra" un amigo). Skins,
    // Loba, Stableford y Banderas NO se guardan por amigo porque son bote
    // de grupo, no 1v1 ni pareja vs pareja.
    foursomeTotal: 0,
    foursomeHistorial: [],
  };
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
  // 18 posiciones: { banderas: 0 (sin marcar), threePutt: false, chupes: 0 }
  // chupes: putts cortos fallados (siempre negativo, como banderas pero
  // al revés — se paga a CADA uno de los demás que juegan banderas ese día)
  return new Array(18).fill(null).map(() => ({ banderas: 0, threePutt: false, chupes: 0 }));
}

function emptyLobaHoyo() {
  // por hoyo: { loba: playerId|null, companero: playerId|null, multiplicador: number }
  // multiplicador se usa en los hoyos 7, 8, 9, 16, 17 y 18 (1 = normal,
  // el jugador que va perdiendo en el acumulado de loba puede subirlo)
  return new Array(18).fill(null).map(() => ({ loba: null, companero: null, multiplicador: 1 }));
}

function newState() {
  const courses = defaultCourses();
  return {
    courses,
    round: {
      courseId: courses[0].id,
      currentHole: 1,
      // En qué hoyo arranca la ronda: 1 (normal) o 10 (salen por el tee 10).
      // Solo cambia en qué hoyo abre la app; el par/hándicap de cada hoyo
      // sigue siendo el de la cancha, y los montos ida/vuelta siguen
      // ligados a los hoyos 1-9 / 10-18 reales, no al orden de juego.
      hoyoInicial: 1,
    },
    unit: 1000, // valor de la unidad de apuesta, en la moneda que sea
    // lista permanente de amigos con los que juegas seguido (independiente
    // de quién esté activo en la ronda de hoy). Ver defaultFriend().
    friends: [],
    // cuál de los 5 jugadores de la ronda eres TÚ. Se usa para saber, al
    // guardar una ronda al historial, cuánto ganaste/perdiste contra cada
    // amigo en individuales y cuál fue tu saldo total del día.
    miPlayerId: 1,
    // historial de rondas ya cerradas/guardadas (ver archivarRonda en
    // logic.js): [{ id, fecha, courseName, balanceYo, desglose }]
    roundsHistory: [],
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
    // metida de afuera (chip-in) marcada manualmente, aplica en cualquier
    // hoyo (no solo par 3): { [playerId]: [18 booleanos] }
    metidas: {
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
    // oyes manual de foursome: por hoyo, qué equipo ganó el oyes en CADA
    // cruce (id de cruce "A"/"B"/"C" -> "base" | "rival" | null).
    // Solo aplica en hoyos par 3; reemplaza el conteo automático de oyes
    // individual para la modalidad foursome específicamente.
    foursomeOyes: new Array(18).fill(null).map(() => ({})),
    // igual que foursomeOyes pero para el modo independiente "Rotación de
    // parejas cada 6 hoyos" (claves "S1"/"S2"/"S3" -> "base" | "rival" | null)
    rotacionOyes: new Array(18).fill(null).map(() => ({})),
    // oyes manual de individuales: por hoyo, quién ganó el oyes en CADA
    // partido 1v1 (clave "menorId-mayorId" -> playerId del ganador | sin
    // entrada = sin marcar). Solo aplica en hoyos par 3. El ganador puede
    // variar según el rival: ej. 1 le gana el oyes a 2, pero 1 pierde el
    // oyes contra 3 (3 quedó más cerca de la bandera que 1).
    individualesOyes: new Array(18).fill(null).map(() => ({})),
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
        // si es false, el foursome se juega SOLO con bola alta y bola baja
        // (y el oyes manual, si aplica); no se suman unidades extra por
        // birdie/águila/hoyo en uno/sandy/metida de ningún jugador.
        unidadesActivas: true,
        // participantes: quiénes juegan foursome hoy. Con 5 -> foursome
        // cruzado (3 cruces contra las 3 combinaciones de los otros 3).
        // Con 4 -> foursome normal, un solo cruce 2 vs 2.
        participantes: [1, 2, 3, 4, 5],
        // basePlayers: los 2 jugadores que son "la base" hoy (se rifan antes
        // de jugar). Los cruces se regeneran automáticamente contra los
        // demás participantes.
        basePlayers: [1, 2],
        // montoIda: $ por hoyo (igual para bola alta y baja) en hoyos 1-9
        // montoVuelta: $ por hoyo (igual para bola alta y baja) en hoyos 10-18
        crosses: [
          { id: "A", base: [1, 2], rival: [3, 4], montoIda: 0, montoVuelta: 0 },
          { id: "B", base: [1, 2], rival: [3, 5], montoIda: 0, montoVuelta: 0 },
          { id: "C", base: [1, 2], rival: [4, 5], montoIda: 0, montoVuelta: 0 },
        ],
      },
      // "Rotación de parejas cada 6 hoyos": modo INDEPENDIENTE de foursome
      // cruzado. Necesita EXACTAMENTE 4 participantes. Cada 6 hoyos (en tu
      // orden real de juego) cambia la pareja, pasando por las 3
      // combinaciones posibles con esos 4 — así cada quien juega 6 hoyos
      // con cada uno de los otros 3. La ventaja se calcula igual que en
      // foursome (suma de hcp.foursome de la pareja vs la pareja rival).
      rotacion: {
        enabled: false,
        unidadesActivas: true,
        participantes: [1, 2, 3, 4],
        segmentos: [
          { id: "S1", hoyos: [0, 1, 2, 3, 4, 5], base: [1, 2], rival: [3, 4], monto: 0 },
          { id: "S2", hoyos: [6, 7, 8, 9, 10, 11], base: [1, 3], rival: [2, 4], monto: 0 },
          { id: "S3", hoyos: [12, 13, 14, 15, 16, 17], base: [1, 4], rival: [2, 3], monto: 0 },
        ],
      },
      skins: {
        enabled: true,
        montoPorHoyo: 0,
        // quiénes juegan skins hoy (por defecto los 5). Permite jugar
        // skins solo entre algunos, sin tener que sacar a nadie de la ronda.
        participantes: [1, 2, 3, 4, 5],
      },
      loba: {
        enabled: true,
        // monto base por jugador (como el "$100" del ejemplo)
        monto: 0,
        // Loba usa el hcp completo (100%), igual que las demás
        // modalidades — si un club quiere jugarlo recortado, que ajuste
        // el hándicap de Loba de cada jugador directamente en Config.
      },
      stableford: {
        enabled: true,
        // 3 premios separados: ida (1-9), vuelta (10-18), total (18 hoyos)
        montoIda: 0,
        montoVuelta: 0,
        montoTotal: 0,
        // quiénes juegan stableford hoy (por defecto los 5)
        participantes: [1, 2, 3, 4, 5],
      },
      // Banderas, 3-putt y Chupes ahora son 3 apuestas INDEPENDIENTES: cada
      // una con su propio monto y su propia lista de participantes (no
      // tienen que jugarlas los mismos ni al mismo precio). Los datos
      // marcados por hoyo (state.banderas[playerId][h]) siguen compartiendo
      // la misma estructura {banderas, threePutt, chupes}, solo el $ y
      // quién participa se separaron.
      banderas: {
        enabled: true,
        participantes: [1, 2, 3, 4, 5],
        // banderas cobra monto×N banderas a cada uno de los demás PARTICIPANTES
        monto: 0,
      },
      threePutt: {
        enabled: true,
        participantes: [1, 2, 3, 4, 5],
        // 3-putt paga monto×1 a cada uno de los demás participantes
        monto: 0,
      },
      chupes: {
        enabled: true,
        participantes: [1, 2, 3, 4, 5],
        // chupes SIEMPRE negativo: paga monto×N chupes a cada uno de los
        // demás participantes
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

  // hcp pasó de ser un solo número por jugador a un hándicap independiente
  // por modalidad (individuales/foursome/skins/loba/stableford). Migramos
  // usando el valor viejo como punto de partida para las 5 modalidades,
  // así nadie pierde su hándicap configurado de golpe.
  state.players.forEach((p) => {
    if (typeof p.hcp === "number") {
      const valorViejo = p.hcp;
      p.hcp = {
        individuales: valorViejo,
        foursome: valorViejo,
        skins: valorViejo,
        loba: valorViejo,
        stableford: valorViejo,
      };
    }
  });

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
                        canadas: { par: CANADAS_PAR, strokeIndex: CANADAS_STROKE_INDEX },
                        gdlcc: { par: GDLCC_PAR, strokeIndex: GDLCC_STROKE_INDEX } };
    const arraysIguales = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

    state.courses.forEach((c) => {
      const real = realData[c.id];
      if (!real) return; // canchas custom del usuario no tienen dato real precargado
      const parEsGenerico = arraysIguales(c.par, DEFAULT_PAR);
      const siEsGenerico = arraysIguales(c.strokeIndex, DEFAULT_STROKE_INDEX);
      if (parEsGenerico) c.par = [...real.par];
      if (siEsGenerico) c.strokeIndex = [...real.strokeIndex];
    });

    // Corrección puntual: Guadalajara CC se cargó originalmente con un
    // stroke index equivocado (columnas cruzadas al transcribir la
    // tarjeta). Si el dispositivo todavía trae ese valor viejo exacto (y
    // el usuario no lo editó a mano desde entonces), lo actualizamos al
    // correcto sin tocar nada más de su configuración.
    const gdlccCourse = state.courses.find((c) => c.id === "gdlcc");
    if (gdlccCourse && arraysIguales(gdlccCourse.strokeIndex, GDLCC_STROKE_INDEX_VIEJO_INCORRECTO)) {
      gdlccCourse.strokeIndex = [...GDLCC_STROKE_INDEX];
    }

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
  if (!state.bets.foursome.basePlayers) {
    // inferimos la base de los cruces ya existentes (todos comparten la
    // misma pareja "base" hasta ahora); si no hay cruces, usamos 1+2 por defecto
    const primerCruce = state.bets.foursome.crosses[0];
    state.bets.foursome.basePlayers = primerCruce ? [...primerCruce.base] : [1, 2];
  }
  if (state.bets.foursome.unidadesActivas === undefined) {
    // default true para no cambiarle el juego a nadie que ya lo tenía configurado
    state.bets.foursome.unidadesActivas = true;
  }
  // ya no se usa un % recortado de hándicap para Loba (se quitó la opción);
  // si algún estado guardado todavía lo trae, simplemente se ignora en el
  // cálculo (calcGolpesVentaja usa 100% si no se le pasa porcentaje).
  if (!state.bets.foursome.participantes) {
    state.bets.foursome.participantes = state.players.map((p) => p.id);
  }
  if (!state.bets.skins.participantes) {
    state.bets.skins.participantes = state.players.map((p) => p.id);
  }
  if (!state.bets.stableford.participantes) {
    state.bets.stableford.participantes = state.players.map((p) => p.id);
  }
  if (!state.round.hoyoInicial) {
    state.round.hoyoInicial = 1;
  }
  // "Rotación de parejas" era una opción DENTRO de foursome (rotarParejas);
  // ahora es su propio modo independiente (bets.rotacion). Si el estado
  // guardado todavía trae esa config vieja adentro de foursome, la
  // movemos para no perder lo que ya tenían armado, y la quitamos de
  // foursome (que vuelve a ser solo el cruzado de siempre).
  if (state.bets.foursome.rotarParejas !== undefined || state.bets.foursome.segmentos) {
    if (!state.bets.rotacion) {
      state.bets.rotacion = {
        enabled: !!state.bets.foursome.rotarParejas,
        unidadesActivas: state.bets.foursome.unidadesActivas,
        participantes: state.bets.foursome.participantes.length === 4 ? [...state.bets.foursome.participantes] : [1, 2, 3, 4],
        segmentos: state.bets.foursome.segmentos || [],
      };
    }
    delete state.bets.foursome.rotarParejas;
    delete state.bets.foursome.segmentos;
  }
  if (!state.bets.rotacion) {
    state.bets.rotacion = {
      enabled: false,
      unidadesActivas: true,
      participantes: [1, 2, 3, 4],
      segmentos: [],
    };
  }
  if (!state.bets.rotacion.segmentos || state.bets.rotacion.segmentos.length === 0 || state.bets.rotacion.segmentos.some((s) => !s.hoyos)) {
    // versiones viejas guardaban desde/hasta en vez de la lista de hoyos
    state.bets.rotacion.segmentos = generarSegmentosRotacion(
      state.bets.rotacion.participantes.slice(0, 4),
      state.bets.rotacion.segmentos,
      state.round.hoyoInicial
    );
  }
  if (!state.banderas) {
    state.banderas = {};
    state.players.forEach((p) => (state.banderas[p.id] = emptyBanderasFlags()));
  }
  // estados guardados antes de "chupes" no tienen ese campo en cada hoyo
  Object.keys(state.banderas).forEach((id) => {
    state.banderas[id].forEach((cfg) => {
      if (cfg.chupes === undefined) cfg.chupes = 0;
    });
  });
  if (!state.foursomeOyes) {
    state.foursomeOyes = new Array(18).fill(null).map(() => ({}));
  }
  if (!state.rotacionOyes) {
    state.rotacionOyes = new Array(18).fill(null).map(() => ({}));
  }
  if (!state.individualesOyes) {
    state.individualesOyes = new Array(18).fill(null).map(() => ({}));
  }
  if (!state.oyes) {
    state.oyes = {};
    state.players.forEach((p) => (state.oyes[p.id] = emptySandyFlags()));
  }
  if (!state.metidas) {
    state.metidas = {};
    state.players.forEach((p) => (state.metidas[p.id] = emptySandyFlags()));
  }
  if (!state.friends) {
    state.friends = [];
  }
  // amigos guardados antes de esta versión no tenían individualesTotal/historial
  state.friends.forEach((f) => {
    if (f.individualesTotal === undefined) f.individualesTotal = 0;
    if (!f.individualesHistorial) f.individualesHistorial = [];
    if (f.foursomeTotal === undefined) f.foursomeTotal = 0;
    if (!f.foursomeHistorial) f.foursomeHistorial = [];
  });
  if (state.miPlayerId === undefined) {
    state.miPlayerId = state.players[0] ? state.players[0].id : 1;
  }
  if (!state.roundsHistory) {
    state.roundsHistory = [];
  }
  // jugadores guardados antes de esta versión no tenían friendId
  state.players.forEach((p) => {
    if (p.friendId === undefined) p.friendId = null;
  });
  if (!state.bets.individuales.participantes) {
    state.bets.individuales.participantes = state.players.map((p) => p.id);
  }
  if (!state.bets.banderas.participantes) {
    state.bets.banderas.participantes = state.players.map((p) => p.id);
  }
  // Banderas, 3-putt y Chupes eran una sola apuesta compartida; ahora son
  // 3 independientes. Si el estado guardado todavía no tiene threePutt/
  // chupes por separado, se crean heredando el monto y participantes que
  // ya tenía "banderas" (para no perder la configuración de quien ya
  // jugaba), y de ahí en adelante cada quien se edita por su cuenta.
  if (!state.bets.threePutt) {
    state.bets.threePutt = {
      enabled: state.bets.banderas.enabled,
      monto: state.bets.banderas.monto,
      participantes: [...state.bets.banderas.participantes],
    };
  }
  if (!state.bets.chupes) {
    state.bets.chupes = {
      enabled: state.bets.banderas.enabled,
      monto: 0,
      participantes: [...state.bets.banderas.participantes],
    };
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

