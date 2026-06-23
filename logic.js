/* ============================================================
   LAS LOMAS BETS — logic.js
   Toda la lógica de golf y dinero vive aquí, sin tocar el DOM.
   ============================================================ */

/**
 * Reparte N golpes de ventaja entre los 18 hoyos, priorizando los más
 * difíciles según strokeIndex (1 = más difícil). Si diff > 18, da una
 * segunda vuelta de golpes extra.
 * @returns {Array<number>} 18 valores de golpes por hoyo
 */
function repartirGolpesPorDificultad(diff, strokeIndex) {
  const strokes = new Array(18).fill(0);
  for (let hole = 0; hole < 18; hole++) {
    const si = strokeIndex[hole];
    if (si <= diff) strokes[hole] += 1;
    if (si <= diff - 18) strokes[hole] += 1;
  }
  return strokes;
}

/**
 * Porcentaje del hándicap que se usa SOLO para loba (algunos grupos juegan
 * loba con el hcp recortado, ej: 80%, en vez del 100% de las demás modalidades).
 */
const LOBA_HCP_PORCENTAJE = 0.8;

/**
 * Calcula los golpes de ventaja por jugador y por hoyo, para uso INDIVIDUAL
 * (skins, individuales). Regla: el jugador con hcp más bajo del grupo
 * juega "a la par" (0 golpes). Los demás reciben golpes = diferencia
 * respecto al más bajo, repartidos en los hoyos más difíciles.
 *
 * @param {Array} players - [{id, hcp: {individuales, foursome, skins, loba, stableford}}, ...]
 * @param {Array<number>} strokeIndex - 18 valores, dificultad de cada hoyo
 * @param {string} modalidad - cuál hándicap leer: "individuales", "foursome",
 *   "skins", "loba" o "stableford". Cada jugador puede llevar un hándicap
 *   distinto por modalidad (ej: acuerdos históricos que no siguen el hcp oficial).
 * @param {number} porcentaje - opcional, % del hcp a usar antes de calcular
 *   la diferencia (ej: 0.8 para loba al 80%). Por defecto 1 (100%, sin recorte).
 *   El porcentaje se aplica SIN redondear cada hcp por separado; el redondeo
 *   ocurre al final, sobre la diferencia ya calculada (evita doble redondeo).
 * @returns {Object} { [playerId]: [18 valores de golpes de ventaja] }
 */
function calcGolpesVentaja(players, strokeIndex, modalidad, porcentaje) {
  const pct = porcentaje || 1;
  const hcpAjustado = players.map((p) => ({ id: p.id, hcp: p.hcp[modalidad] * pct })); // sin redondear aquí
  const minHcp = Math.min(...hcpAjustado.map((p) => p.hcp));
  const result = {};

  hcpAjustado.forEach((p) => {
    const diff = Math.max(0, Math.round(p.hcp - minHcp)); // redondeo solo al final, sobre la diferencia
    result[p.id] = repartirGolpesPorDificultad(diff, strokeIndex);
  });

  return result;
}

// Porcentaje de hándicap usado específicamente para loba (algunos clubes
// juegan loba con el hcp recortado al 80%, en vez del 100% de las demás
// modalidades).
const PORCENTAJE_HCP_LOBA = 0.8;

/**
 * Calcula los golpes de ventaja para FOURSOME, donde la ventaja se calcula
 * a nivel de PAREJA (suma de hcp de los 2), no por jugador individual.
 * La pareja con la suma de hcp más alta recibe la diferencia de golpes,
 * y esos golpes se acreditan TODOS a un solo jugador: el de mayor hcp
 * individual dentro de esa pareja.
 *
 * @param {Array} players - [{id, hcp}, ...] (todos los jugadores, para buscar hcp)
 * @param {Array<number>} strokeIndex
 * @param {Array} crosses - lista de cruces {id, base:[id,id], rival:[id,id]}
 * @returns {Object} { [crossId]: { [playerId]: [18 valores] } }
 *   Solo los jugadores que reciben ventaja en ESE cruce tienen valores != 0;
 *   el resto del cruce queda en 0 (juegan a la par dentro de su pareja).
 */
function calcVentajasForusome(players, strokeIndex, crosses) {
  const hcpOf = (id) => players.find((p) => p.id === id).hcp.foursome;
  const result = {};

  crosses.forEach((cross) => {
    const sumaBase = cross.base.reduce((s, id) => s + hcpOf(id), 0);
    const sumaRival = cross.rival.reduce((s, id) => s + hcpOf(id), 0);
    const diff = Math.abs(sumaBase - sumaRival);

    // por defecto, los 4 jugadores del cruce van en 0
    const ventajasCruce = {};
    [...cross.base, ...cross.rival].forEach((id) => {
      ventajasCruce[id] = new Array(18).fill(0);
    });

    if (diff > 0) {
      // la pareja con la suma más alta recibe la ventaja
      const parejaQueRecibe = sumaBase > sumaRival ? cross.base : cross.rival;
      // dentro de esa pareja, el de mayor hcp individual se lleva todos los golpes
      const jugadorReceptor = parejaQueRecibe.reduce((max, id) =>
        hcpOf(id) > hcpOf(max) ? id : max
      , parejaQueRecibe[0]);

      ventajasCruce[jugadorReceptor] = repartirGolpesPorDificultad(diff, strokeIndex);
    }

    result[cross.id] = ventajasCruce;
  });

  return result;
}



/**
 * Golpe neto de un jugador en un hoyo = golpe bruto - golpes de ventaja en ese hoyo.
 * Devuelve null si no hay golpe registrado aún.
 */
function golpeNeto(brutos, ventajas, playerId, holeIdx) {
  const bruto = brutos[playerId][holeIdx];
  if (bruto === null || bruto === undefined) return null;
  return bruto - ventajas[playerId][holeIdx];
}

/* ----------------------------------------------------------
   1. INDIVIDUALES (mano a mano, SE PAGA HOYO POR HOYO)
   En cada hoyo, quien tenga menos golpes netos en ESE hoyo se gana
   el monto de ESE hoyo. Empate = no se paga nada (no acumula).
   ---------------------------------------------------------- */

/**
 * @param {Object} match - {a, b, montoIda, montoVuelta}
 *   montoIda = $ por hoyo ganado en hoyos 1-9
 *   montoVuelta = $ por hoyo ganado en hoyos 10-18
 * @returns {Object} detalle hoyo a hoyo + saldo neto total del partido
 */
/**
 * Genera todos los enfrentamientos posibles (round-robin) entre una lista
 * de jugadores participantes. Cada partido nuevo arranca en $0, editable
 * después uno por uno.
 * @param {Array<number>} participantIds
 * @returns {Array} lista de {a, b, montoIda:0, montoVuelta:0}
 */
function generarTodosVsTodos(participantIds) {
  const matches = [];
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      matches.push({ a: participantIds[i], b: participantIds[j], montoIda: 0, montoVuelta: 0 });
    }
  }
  return matches;
}

/**
 * Cuenta cuántos eventos especiales (birdie, águila, hoyo en uno, sandy,
 * oyes) logró un jugador en un hoyo dado. Se usa para sumar "unidades"
 * dentro de individuales y foursome. No incluye "ganar el hoyo" — eso se
 * suma aparte en cada función que la usa.
 */
function contarEventosJugador(bruto, par, esSandy, esOyes) {
  if (bruto === null || bruto === undefined) return 0;
  let count = 0;
  if (bruto === 1) count++; // hoyo en uno
  if (bruto === par - 2 && bruto !== 1) count++; // águila
  if (bruto === par - 1) count++; // birdie
  if (esSandy) count++;
  if (esOyes && par === 3) count++;
  return count;
}

/**
 * @param {Object} match - {a, b, montoIda, montoVuelta}
 * @param {Array<number>} par - par de cada hoyo de la cancha activa
 * @param {Object} sandies - { [playerId]: [18 booleanos] }
 * @param {Object} oyes - { [playerId]: [18 booleanos] }
 * Cada jugador suma "unidades" en el hoyo: ganar el hoyo (golpe neto más
 * bajo) = 1 unidad, más 1 unidad por cada evento especial que logre
 * (birdie, águila, hoyo en uno, sandy, oyes). Se cobra la DIFERENCIA de
 * unidades entre los 2, multiplicada por el monto de esa vuelta.
 */
function calcIndividual(match, brutos, ventajas, par, sandies, oyes) {
  const holeResults = [];
  let saldoA = 0; // dinero neto a favor de "a" (negativo = a favor de "b")
  let holesCounted = 0;

  for (let h = 0; h < 18; h++) {
    const na = golpeNeto(brutos, ventajas, match.a, h);
    const nb = golpeNeto(brutos, ventajas, match.b, h);

    if (na === null || nb === null) {
      holeResults.push({ hole: h + 1, jugado: false });
      continue;
    }

    const montoHoyo = h < 9 ? match.montoIda : match.montoVuelta;

    // unidades por eventos especiales (independiente de quién gane el hoyo)
    const eventosA = contarEventosJugador(brutos[match.a][h], par[h], sandies[match.a][h], oyes[match.a][h]);
    const eventosB = contarEventosJugador(brutos[match.b][h], par[h], sandies[match.b][h], oyes[match.b][h]);

    // unidad por ganar el hoyo (golpe neto más bajo)
    let unidadesA = eventosA;
    let unidadesB = eventosB;
    let ganadorHoyo = null;
    if (na < nb) {
      ganadorHoyo = match.a;
      unidadesA += 1;
    } else if (nb < na) {
      ganadorHoyo = match.b;
      unidadesB += 1;
    }
    // empate en golpe neto: nadie suma la unidad de "ganar el hoyo",
    // pero los eventos especiales de cada uno sí cuentan igual

    holesCounted++;
    const diffUnidades = unidadesA - unidadesB;
    saldoA += diffUnidades * montoHoyo;

    holeResults.push({
      hole: h + 1,
      jugado: true,
      netoA: na,
      netoB: nb,
      ganadorHoyo,
      montoHoyo,
      unidadesA,
      unidadesB,
      diffUnidades,
    });
  }

  return {
    ...match,
    holeResults,
    holesCounted,
    saldoA, // positivo = "a" va ganando dinero, negativo = "b" va ganando
  };
}

/* ----------------------------------------------------------
   2. FOURSOME CRUZADO (bola alta + bola baja por hoyo)
   ---------------------------------------------------------- */

/**
 * Para una pareja [p1, p2] en un hoyo dado, devuelve {alta, baja} = los
 * golpes netos ordenados (alta = peor/mayor, baja = mejor/menor).
 */
function bolaAltaBaja(pair, brutos, ventajas, holeIdx) {
  const n1 = golpeNeto(brutos, ventajas, pair[0], holeIdx);
  const n2 = golpeNeto(brutos, ventajas, pair[1], holeIdx);
  if (n1 === null || n2 === null) return { alta: null, baja: null };
  return {
    baja: Math.min(n1, n2),
    alta: Math.max(n1, n2),
  };
}

/**
 * Calcula el resultado hoyo a hoyo y acumulado de un cruce de foursome.
 * @param {Object} ventajasCruce - golpes de ventaja SOLO para este cruce
 *   (de calcVentajasForusome), no los de calcGolpesVentaja individual.
 * @param {Array<number>} par - par de cada hoyo de la cancha activa
 * @param {Object} sandies, oyes - { [playerId]: [18 booleanos] }
 * Cada pareja suma "unidades" en el hoyo: ganar bola baja = 1, ganar bola
 * alta = 1, más 1 unidad por cada evento especial (birdie, águila, hoyo en
 * uno, sandy, oyes) de CUALQUIERA de los 2 jugadores de la pareja. Se
 * cobra la diferencia de unidades entre las 2 parejas, multiplicada por
 * el monto de esa vuelta.
 * Devuelve detalle por hoyo + saldo total en dinero (positivo = gana "base").
 */
function calcForusomeCross(cross, brutos, ventajasCruce, par, sandies, oyes) {
  const holeResults = [];
  let saldoTotal = 0; // dinero neto a favor de "base" (negativo = a favor de "rival")

  for (let h = 0; h < 18; h++) {
    const base = bolaAltaBaja(cross.base, brutos, ventajasCruce, h);
    const rival = bolaAltaBaja(cross.rival, brutos, ventajasCruce, h);

    if (base.alta === null || rival.alta === null) {
      holeResults.push({ hole: h + 1, jugado: false });
      continue;
    }

    // Bola baja: gana quien tenga el golpe neto más bajo más bajo
    let resultBaja = "empate";
    if (base.baja < rival.baja) resultBaja = "base";
    else if (base.baja > rival.baja) resultBaja = "rival";

    // Bola alta: gana quien tenga el golpe neto alto más bajo (mejor "peor bola")
    let resultAlta = "empate";
    if (base.alta < rival.alta) resultAlta = "base";
    else if (base.alta > rival.alta) resultAlta = "rival";

    const montoHoyo = h < 9 ? cross.montoIda : cross.montoVuelta;

    // eventos especiales de cualquiera de los 2 jugadores de cada pareja
    const eventosBase = cross.base.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h]),
      0
    );
    const eventosRival = cross.rival.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h]),
      0
    );

    let unidadesBase = eventosBase;
    let unidadesRival = eventosRival;
    if (resultBaja === "base") unidadesBase += 1;
    else if (resultBaja === "rival") unidadesRival += 1;
    if (resultAlta === "base") unidadesBase += 1;
    else if (resultAlta === "rival") unidadesRival += 1;

    const diffUnidades = unidadesBase - unidadesRival;
    saldoTotal += diffUnidades * montoHoyo;

    holeResults.push({
      hole: h + 1,
      jugado: true,
      base,
      rival,
      resultAlta,
      resultBaja,
      montoHoyo,
      unidadesBase,
      unidadesRival,
      diffUnidades,
    });
  }

  return {
    crossId: cross.id,
    base: cross.base,
    rival: cross.rival,
    holeResults,
    saldoTotal,
  };
}

/* ----------------------------------------------------------
   3. SKINS (individual, golpe neto más bajo)
   El monto vigente (base del hoyo + acumulado por empates de 3+) se
   cobra POR JUGADOR, no es un bote fijo total:
   - 1 gana: cobra el monto vigente a CADA UNO de los demás.
   - 2 empatan: cada uno cobra el monto vigente a cada uno de los que
     NO ganaron, y ese total se reparte entre los 2 ganadores.
   - 3+ empatan: nadie cobra, el monto se acumula (se suma al monto
     base del siguiente hoyo).
   ADEMÁS, independiente de lo anterior: cada birdie/águila/hoyo en
   uno/sandy/oyes que logre un jugador cobra el monto de SKINS a cada
   uno de los demás, sin importar si ganó o no el hoyo.
   ---------------------------------------------------------- */

/**
 * Calcula los skins ganados/perdidos por cada jugador a través de los 18 hoyos.
 * @returns {Object} { porHoyo: [...], totalesPorJugador: {id: monto neto}, montoPendiente }
 */
function calcSkins(players, brutos, ventajas, montoPorHoyo, par, sandies, oyes) {
  const porHoyo = [];
  const totalesPorJugador = {};
  players.forEach((p) => (totalesPorJugador[p.id] = 0));

  let acumulado = 0; // extra acumulado por empates de 3+, se suma al monto base del siguiente hoyo

  for (let h = 0; h < 18; h++) {
    const netos = players
      .map((p) => ({ id: p.id, neto: golpeNeto(brutos, ventajas, p.id, h) }))
      .filter((x) => x.neto !== null);

    if (netos.length === 0) {
      porHoyo.push({ hole: h + 1, jugado: false });
      continue;
    }

    const montoVigente = montoPorHoyo + acumulado;
    const minNeto = Math.min(...netos.map((x) => x.neto));
    const ganadores = netos.filter((x) => x.neto === minNeto).map((x) => x.id);
    const perdedores = players.map((p) => p.id).filter((id) => !ganadores.includes(id));

    let entry = { hole: h + 1, jugado: true, ganadores, montoVigente, acumulaSiguiente: false };

    if (ganadores.length === 1 || ganadores.length === 2) {
      // cada perdedor paga montoVigente UNA VEZ; ese total se reparte
      // entre los ganadores (si hay 1, se lo lleva todo; si hay 2, a la mitad)
      const totalCobrado = montoVigente * perdedores.length;
      const repartoPorGanador = totalCobrado / ganadores.length;

      ganadores.forEach((id) => (totalesPorJugador[id] += repartoPorGanador));
      perdedores.forEach((id) => (totalesPorJugador[id] -= montoVigente));

      entry.montoCadaGanador = repartoPorGanador;
      acumulado = 0;
    } else {
      // 3+ empatan: nadie cobra, se acumula para el siguiente hoyo
      entry.acumulaSiguiente = true;
      acumulado = montoVigente;
    }

    // Eventos especiales: cobran el monto base de skins (no el vigente con
    // acumulado) a cada uno de los demás, independiente de quién ganó el hoyo.
    const eventosHoyo = [];
    players.forEach((p) => {
      const cantEventos = contarEventosJugador(brutos[p.id][h], par[h], sandies[p.id][h], oyes[p.id][h]);
      if (cantEventos > 0) {
        const otros = players.filter((o) => o.id !== p.id);
        const totalEvento = montoPorHoyo * cantEventos;
        otros.forEach((o) => {
          totalesPorJugador[p.id] += totalEvento;
          totalesPorJugador[o.id] -= totalEvento;
        });
        eventosHoyo.push({ playerId: p.id, cantidad: cantEventos, monto: totalEvento * otros.length });
      }
    });
    if (eventosHoyo.length > 0) entry.eventosHoyo = eventosHoyo;

    porHoyo.push(entry);
  }

  return { porHoyo, totalesPorJugador, montoPendiente: acumulado };
}

/* ----------------------------------------------------------
   4. UNIDADES (birdie, águila, hoyo en uno, sandy)
   Se detectan con golpes BRUTOS vs par (excepto sandy, manual).
   Mismo monto fijo para los 4 eventos. Quien lo logra cobra
   ese monto a CADA uno de los demás jugadores.
   Si 2+ jugadores logran el mismo evento en el mismo hoyo,
   cada uno cobra a los demás (incluido el otro que también lo logró).
   ---------------------------------------------------------- */

const EVENTOS = {
  HOYO_EN_UNO: "Hoyo en uno",
  AGUILA: "Águila",
  BIRDIE: "Birdie",
  SANDY: "Sandy",
  OYES: "Oyes",
};

/**
 * Detecta qué evento(s) logró un jugador en un hoyo dado (golpes brutos vs par).
 * @returns {Array<string>} lista de nombres de evento, puede tener varios (ej: hoyo en uno Y birdie no se solapan en la práctica, pero por si acaso devolvemos todos los que matcheen)
 */
function detectarEventos(bruto, par, esSandy, esOyes) {
  const eventos = [];
  if (bruto === null || bruto === undefined) return eventos;

  if (bruto === 1) eventos.push(EVENTOS.HOYO_EN_UNO);
  if (bruto === par - 2 && bruto !== 1) eventos.push(EVENTOS.AGUILA);
  if (bruto === par - 1) eventos.push(EVENTOS.BIRDIE);
  if (esSandy) eventos.push(EVENTOS.SANDY);
  if (esOyes && par === 3) eventos.push(EVENTOS.OYES);

  return eventos;
}

/* ----------------------------------------------------------
   6. STABLEFORD (puntos individuales, 3 premios: ida/vuelta/total)
   Tabla de puntos según golpe NETO vs par:
   doble bogey o peor=0, bogey=1, par=2, birdie=3, águila=4, hoyo en uno=5.
   El hcp es el normal (100%, el de menor hcp es la referencia).
   Sin importar cuántos empaten en un premio, cada perdedor paga el monto
   completo una vez, repartido entre todos los empatados ganadores.
   ---------------------------------------------------------- */

/**
 * Convierte un golpe neto en puntos stableford según el par del hoyo.
 * @returns {number} puntos (0 a 5), o null si no hay golpe registrado
 */
function puntosStableford(neto, par) {
  if (neto === null || neto === undefined) return null;
  const diff = neto - par; // negativo = bajo par
  if (diff <= -3) return 5; // hoyo en uno / triple-eagle, tope práctico
  if (diff === -2) return 4; // águila
  if (diff === -1) return 3; // birdie
  if (diff === 0) return 2; // par
  if (diff === 1) return 1; // bogey
  return 0; // doble bogey o peor
}

/**
 * Calcula los puntos stableford de cada jugador, hoyo a hoyo, y resuelve
 * los 3 premios (ida 1-9, vuelta 10-18, total 18).
 * @param {Object} montos - { ida, vuelta, total } montos por premio
 * @returns {Object} { puntosPorHoyo: {id:[18]}, totales: {id:{ida,vuelta,total}}, premios: {...}, balances: {id: monto neto} }
 */
function calcStableford(players, brutos, ventajas, par, montos) {
  const puntosPorHoyo = {};
  players.forEach((p) => (puntosPorHoyo[p.id] = new Array(18).fill(null)));

  for (let h = 0; h < 18; h++) {
    players.forEach((p) => {
      const neto = golpeNeto(brutos, ventajas, p.id, h);
      puntosPorHoyo[p.id][h] = puntosStableford(neto, par[h]);
    });
  }

  const sumaRango = (id, ini, fin) => {
    let total = 0;
    let jugados = 0;
    for (let h = ini; h < fin; h++) {
      const pts = puntosPorHoyo[id][h];
      if (pts !== null) {
        total += pts;
        jugados++;
      }
    }
    return { total, jugados };
  };

  const totales = {};
  players.forEach((p) => {
    totales[p.id] = {
      ida: sumaRango(p.id, 0, 9),
      vuelta: sumaRango(p.id, 9, 18),
      total: sumaRango(p.id, 0, 18),
    };
  });

  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));

  function resolverPremio(key, monto) {
    // solo cuenta a quienes ya jugaron al menos 1 hoyo de ese rango
    const conPuntos = players
      .map((p) => ({ id: p.id, pts: totales[p.id][key].total, jugados: totales[p.id][key].jugados }))
      .filter((x) => x.jugados > 0);

    if (conPuntos.length === 0) return { ganadores: [], montoCadaGanador: 0 };

    const maxPts = Math.max(...conPuntos.map((x) => x.pts));
    const ganadores = conPuntos.filter((x) => x.pts === maxPts).map((x) => x.id);
    const perdedores = players.map((p) => p.id).filter((id) => !ganadores.includes(id));

    if (ganadores.length === players.length) {
      // todos empatados, nadie pierde, no hay nada que cobrar
      return { ganadores, montoCadaGanador: 0 };
    }

    const totalCobrado = monto * perdedores.length;
    const montoCadaGanador = totalCobrado / ganadores.length;

    ganadores.forEach((id) => (balances[id] += montoCadaGanador));
    perdedores.forEach((id) => (balances[id] -= monto));

    return { ganadores, montoCadaGanador };
  }

  const premios = {
    ida: resolverPremio("ida", montos.ida),
    vuelta: resolverPremio("vuelta", montos.vuelta),
    total: resolverPremio("total", montos.total),
  };

  return { puntosPorHoyo, totales, premios, balances };
}

/* ----------------------------------------------------------
   7. BANDERAS / 3-PUTT (marcado manual por jugador y hoyo)
   Banderas: monto base × N banderas, cobrado a cada uno de los demás.
   3-putt: monto base × 1, pagado a cada uno de los demás.
   Cada evento de cada jugador es independiente; no se compensan entre sí
   más allá de la suma natural en el balance final de cada uno.
   ---------------------------------------------------------- */

/**
 * @param {Object} banderasState - { [playerId]: [18 valores { banderas, threePutt }] }
 * @param {Array<number>} participantIds - solo estos jugadores cobran/pagan;
 *   quien no participa queda excluido del todo (ni cobra ni paga nada)
 * @returns {Object} { detalle: [...por hoyo y jugador...], balances: {id: monto neto} }
 */
function calcBanderas(players, banderasState, monto, participantIds) {
  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));
  const detalle = [];

  const participantes = players.filter((p) => participantIds.includes(p.id));

  for (let h = 0; h < 18; h++) {
    participantes.forEach((p) => {
      const cfg = banderasState[p.id][h];
      if (!cfg) return;

      if (cfg.banderas > 0) {
        const otros = participantes.filter((o) => o.id !== p.id);
        const totalCobrado = monto * cfg.banderas;
        otros.forEach((o) => {
          balances[p.id] += totalCobrado;
          balances[o.id] -= totalCobrado;
        });
        detalle.push({ hole: h + 1, playerId: p.id, tipo: "banderas", cantidad: cfg.banderas, monto: totalCobrado * otros.length });
      } else if (cfg.threePutt) {
        const otros = participantes.filter((o) => o.id !== p.id);
        otros.forEach((o) => {
          balances[p.id] -= monto;
          balances[o.id] += monto;
        });
        detalle.push({ hole: h + 1, playerId: p.id, tipo: "3putt", cantidad: 1, monto: monto * otros.length });
      }
    });
  }

  return { detalle, balances };
}



/* ----------------------------------------------------------
   5. LOBA (equipos manuales por hoyo, 2 vs 3, mejor bola neta)
   Pago simétrico: monto base × cantidad de jugadores en el equipo
   contrario al ganador, repartido entre los ganadores.
   Ejemplo: monto=100. Gana la pareja (2) -> cobra 100x3=300, /2=150 c/u.
            Gana el trío (3) -> cobra 100x2=200, /3=66.67 c/u.
   NOTA: usamos la fórmula simétrica confirmada por el usuario:
   siempre se mueven 3 × monto en total, repartido entre los ganadores,
   sin importar cuál equipo gane (pareja o trío).
   ---------------------------------------------------------- */

/**
 * @param {Array} lobaConfig - 18 posiciones { loba, companero, multiplicador }
 *   companero puede ser un playerId (pareja normal, 2 vs 3) o el string
 *   "solo" (el jugador de loba va solo, 1 vs 4).
 * @param {Array<number>} par - par de cada hoyo de la cancha activa
 * @param {Object} sandies, oyes - { [playerId]: [18 booleanos] }
 * Cada equipo suma 1 unidad por ganar mejor bola neta, más 1 unidad extra
 * por cada birdie/águila/hoyo en uno/sandy/oyes que logre CUALQUIERA de
 * sus jugadores. Se cobra la diferencia de unidades entre los 2 equipos,
 * multiplicada por el monto de loba y el multiplicador de ese hoyo.
 * Si el hoyo empata (diferencia de unidades = 0), no se paga nada y el
 * monto base de ese hoyo se acumula, sumándose al monto del siguiente
 * hoyo de loba configurado (igual que en skins).
 * @returns {Object} { detalle: [...por hoyo...], balances: {id: monto neto} }
 */
function calcLoba(players, brutos, ventajas, lobaConfig, monto, par, sandies, oyes) {
  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));
  const detalle = [];

  let acumulado = 0; // extra por empates, se suma al monto base del siguiente hoyo CONFIGURADO

  for (let h = 0; h < 18; h++) {
    const cfg = lobaConfig[h];
    if (!cfg || !cfg.loba || !cfg.companero) {
      detalle.push({ hole: h + 1, configurado: false });
      continue;
    }

    const vaSolo = cfg.companero === "solo";
    const pareja = vaSolo ? [cfg.loba] : [cfg.loba, cfg.companero];
    const trio = players.map((p) => p.id).filter((id) => !pareja.includes(id));

    const netosPareja = pareja
      .map((id) => golpeNeto(brutos, ventajas, id, h))
      .filter((n) => n !== null);
    const netosTrio = trio
      .map((id) => golpeNeto(brutos, ventajas, id, h))
      .filter((n) => n !== null);

    if (netosPareja.length < pareja.length || netosTrio.length < trio.length) {
      detalle.push({ hole: h + 1, configurado: true, jugado: false, pareja, trio, vaSolo });
      continue;
    }

    const mejorPareja = Math.min(...netosPareja);
    const mejorTrio = Math.min(...netosTrio);

    // eventos especiales de cualquiera de los jugadores de cada equipo
    const eventosPareja = pareja.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h]),
      0
    );
    const eventosTrio = trio.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h]),
      0
    );

    let unidadesPareja = eventosPareja;
    let unidadesTrio = eventosTrio;
    let ganador = null;
    if (mejorPareja < mejorTrio) {
      ganador = "pareja";
      unidadesPareja += 1;
    } else if (mejorTrio < mejorPareja) {
      ganador = "trio";
      unidadesTrio += 1;
    }
    // empate en golpe neto: nadie suma la unidad de "ganar el hoyo",
    // pero los eventos especiales de cada equipo sí cuentan igual

    const diffUnidades = unidadesPareja - unidadesTrio;
    const multiplicador = cfg.multiplicador || 1;
    const montoVigente = monto + acumulado;
    // NOTA: el "×3" viene de la mecánica original de loba (siempre se
    // mueven 3 unidades de apuesta en juego por cada unidad de diferencia:
    // monto×3 cuando diff=1, equivalente a la regla confirmada por el
    // usuario "gana pareja se lleva 300 con monto=100"). Con diff>1 (ganar
    // el hoyo + birdie, etc.) escalamos linealmente: monto×3 por cada
    // unidad de diferencia.
    const totalBote = montoVigente * multiplicador * Math.abs(diffUnidades) * 3;

    let acumulaSiguiente = false;
    if (diffUnidades > 0) {
      const cadaUno = totalBote / pareja.length;
      pareja.forEach((id) => (balances[id] += cadaUno));
      trio.forEach((id) => (balances[id] -= totalBote / trio.length));
      acumulado = 0;
    } else if (diffUnidades < 0) {
      const cadaUno = totalBote / trio.length;
      trio.forEach((id) => (balances[id] += cadaUno));
      pareja.forEach((id) => (balances[id] -= totalBote / pareja.length));
      acumulado = 0;
    } else {
      // empate total (golpe neto Y eventos especiales iguales): no se paga
      // nada, el monto base de este hoyo se acumula para el siguiente
      acumulaSiguiente = true;
      acumulado += monto * multiplicador;
    }

    detalle.push({
      hole: h + 1,
      configurado: true,
      jugado: true,
      pareja,
      trio,
      vaSolo,
      mejorPareja,
      mejorTrio,
      ganador,
      multiplicador,
      unidadesPareja,
      unidadesTrio,
      diffUnidades,
      totalBote,
      acumulaSiguiente,
    });
  }

  return { detalle, balances };
}

/**
 * Junta los resultados de las 5 modalidades en un balance neto por jugador.
 * Respeta los interruptores enabled de cada modalidad.
 */
function calcResumenGeneral(state) {
  const { players, scores, bets, round } = state;
  const course = getActiveCourse(state);

  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));

  // Individuales (hándicap propio de esta modalidad)
  const ventajasIndividuales = calcGolpesVentaja(players, course.strokeIndex, "individuales");
  const individualesResults = bets.individuales.enabled
    ? bets.individuales.matches.map((m) => calcIndividual(m, scores, ventajasIndividuales, course.par, state.sandies, state.oyes))
    : [];
  individualesResults.forEach((r) => {
    balances[r.a] += r.saldoA;
    balances[r.b] -= r.saldoA;
  });

  // Foursome (ventaja calculada por SUMA de hcp.foursome de cada pareja, no individual)
  const ventajasForusome = bets.foursome.enabled
    ? calcVentajasForusome(players, course.strokeIndex, bets.foursome.crosses)
    : {};
  const foursomeResults = bets.foursome.enabled
    ? bets.foursome.crosses.map((c) => calcForusomeCross(c, scores, ventajasForusome[c.id], course.par, state.sandies, state.oyes))
    : [];
  foursomeResults.forEach((r) => {
    // saldoTotal positivo = a favor de "base" (1+2), repartido entre los 2
    const perBase = r.saldoTotal / 2;
    r.base.forEach((id) => (balances[id] += perBase));
    const perRival = -r.saldoTotal / 2;
    r.rival.forEach((id) => (balances[id] += perRival));
  });

  // Skins (hándicap propio de esta modalidad). totalesPorJugador ya es el
  // balance neto: positivo gana, negativo paga. Incluye además el cobro
  // por birdie/águila/hoyo en uno/sandy/oyes.
  const ventajasSkins = calcGolpesVentaja(players, course.strokeIndex, "skins");
  const skinsResult = bets.skins.enabled
    ? calcSkins(players, scores, ventajasSkins, bets.skins.montoPorHoyo, course.par, state.sandies, state.oyes)
    : { porHoyo: [], totalesPorJugador: Object.fromEntries(players.map((p) => [p.id, 0])), montoPendiente: 0 };
  players.forEach((p) => {
    balances[p.id] += skinsResult.totalesPorJugador[p.id];
  });

  // Loba (hándicap propio de esta modalidad, además recortado al 80%).
  // Incluye además el cobro por birdie/águila/hoyo en uno/sandy/oyes de
  // cualquiera de los jugadores del equipo.
  const ventajasLoba = calcGolpesVentaja(players, course.strokeIndex, "loba", LOBA_HCP_PORCENTAJE);
  const lobaResult = bets.loba.enabled
    ? calcLoba(players, scores, ventajasLoba, state.loba, bets.loba.monto, course.par, state.sandies, state.oyes)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += lobaResult.balances[p.id];
  });

  // Stableford (hándicap propio de esta modalidad, 3 premios)
  const ventajasStableford = calcGolpesVentaja(players, course.strokeIndex, "stableford");
  const stablefordResult = bets.stableford.enabled
    ? calcStableford(players, scores, ventajasStableford, course.par, {
        ida: bets.stableford.montoIda,
        vuelta: bets.stableford.montoVuelta,
        total: bets.stableford.montoTotal,
      })
    : { puntosPorHoyo: {}, totales: {}, premios: {}, balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += stablefordResult.balances[p.id];
  });

  // Banderas / 3-putt (marcado manual, no usa hándicap)
  const banderasResult = bets.banderas.enabled
    ? calcBanderas(players, state.banderas, bets.banderas.monto, bets.banderas.participantes)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += banderasResult.balances[p.id];
  });

  return {
    ventajas: ventajasIndividuales, // se mantiene por compatibilidad de nombre
    individualesResults,
    foursomeResults,
    skinsResult,
    lobaResult,
    stablefordResult,
    banderasResult,
    balances,
  };
}
