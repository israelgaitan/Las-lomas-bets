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
 * Clave estable para identificar un partido 1v1 sin importar el orden en
 * que vengan los ids (1,3) y (3,1) deben mapear a la misma clave. Se usa
 * para guardar el ganador manual del oyes de individuales por hoyo.
 */
function matchKey(a, b) {
  return Math.min(a, b) + "-" + Math.max(a, b);
}

/**
 * Deriva quién gana el oyes ENTRE dos grupos de jugadores (1 jugador cada
 * uno para individuales, 2 para foursome/rotación) a partir del orden de
 * cercanía a la bandera marcado UNA sola vez por hoyo (state.oyesOrden[h]:
 * { [playerId]: posición, 1 = más cerca }). Gana el grupo que tenga, entre
 * sus integrantes, al que quedó más cerca (posición más baja). Si nadie
 * de ninguno de los 2 grupos fue marcado, no hay ganador (null).
 * @param {Object} ordenHoyo - state.oyesOrden[h]
 * @param {Array<number>} idsA
 * @param {Array<number>} idsB
 * @returns {"a"|"b"|null}
 */
function ganadorOyesEntre(ordenHoyo, idsA, idsB) {
  const posDe = (id) => (ordenHoyo && ordenHoyo[id]) || Infinity;
  const minA = Math.min(...idsA.map(posDe));
  const minB = Math.min(...idsB.map(posDe));
  if (minA === Infinity && minB === Infinity) return null;
  if (minA < minB) return "a";
  if (minB < minA) return "b";
  return null;
}

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
      matches.push({ a: participantIds[i], b: participantIds[j], montoIda: 0, montoVuelta: 0, ventajaManual: null });
    }
  }
  return matches;
}

/**
 * Genera los 3 cruces de foursome a partir de la pareja "base" elegida.
 * Los otros 3 jugadores forman las 3 combinaciones posibles de parejas
 * (round-robin de 3), cada una enfrentando a la base.
 * Conserva los montos: si un cruce nuevo coincide exactamente con uno
 * viejo (misma base y mismo rival), hereda su monto tal cual. Si no hay
 * coincidencia exacta (ej: la base cambió por completo), hereda el monto
 * del PRIMER cruce viejo disponible, para no resetear a $0 sin avisar —
 * el usuario puede seguir ajustando cada cruce individualmente después.
 * @param {Array<number>} basePlayers - los 2 ids de la pareja base
 * @param {Array} allPlayers - lista completa de jugadores [{id,...}]
 * @param {Array} crucesViejos - cruces anteriores, para heredar montos
 * @returns {Array} 3 cruces {id, base, rival, montoIda, montoVuelta}
 */
/**
 * Genera los 3 segmentos de "cambio de pareja cada 6 hoyos" a partir de
 * EXACTAMENTE 4 jugadores. Con 4 jugadores [a,b,c,d] hay 3 combinaciones
 * posibles de parejas 2v2, una por cada bloque de 6 hoyos, así cada quien
 * termina jugando 6 hoyos con cada uno de los otros 3.
 * Los bloques siguen el ORDEN DE JUEGO: si la ronda arranca en el hoyo 10,
 * el primer bloque son los hoyos 10-15, el segundo 16-18+1-3, etc. Por eso
 * cada segmento guarda su lista explícita de hoyos (hoyos: [índices 0-based])
 * en vez de un rango desde/hasta.
 * @param {Array<number>} participantes - exactamente 4 ids
 * @param {Array} segmentosViejos - para heredar montos y parejas ya elegidas
 * @param {number} hoyoInicial - 1 o 10
 * @returns {Array} 3 segmentos {id, hoyos, base, rival, monto}
 */
/**
 * Genera los bloques del modo "Foursome" de 4 jugadores.
 * - rotar=true: 3 bloques de 6 hoyos (en tu orden real de juego), pasando
 *   por las 3 combinaciones posibles de pareja — cada quien juega 6 hoyos
 *   con cada uno de los otros 3.
 * - rotar=false: 1 solo bloque con los 18 hoyos, pareja FIJA elegida a mano.
 * @param {Array<number>} participantes - exactamente 4 ids
 * @param {Array} segmentosViejos - para heredar montos y parejas ya elegidas
 * @param {number} hoyoInicial - 1 o 10
 * @param {boolean} rotar - true = cambia de pareja cada 6 hoyos, false = pareja fija los 18
 * @returns {Array} 1 o 3 segmentos {id, hoyos, base, rival, monto}
 */
function generarSegmentosRotacion(participantes, segmentosViejos, hoyoInicial, rotar) {
  const [a, b, c, d] = participantes;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return segmentosViejos || [];

  // orden de juego real de los 18 hoyos (índices 0-based)
  const inicio = (hoyoInicial || 1) - 1;
  const ordenJuego = [];
  for (let i = 0; i < 18; i++) ordenJuego.push((inicio + i) % 18);

  if (rotar === false) {
    // pareja fija para los 18 hoyos completos
    const viejo = (segmentosViejos || [])[0];
    const parejaValida =
      viejo &&
      viejo.base && viejo.rival &&
      [...viejo.base, ...viejo.rival].length === 4 &&
      [...viejo.base, ...viejo.rival].every((id2) => participantes.includes(id2));
    return [
      {
        id: "S1",
        hoyos: ordenJuego,
        base: parejaValida ? [...viejo.base] : [a, b],
        rival: parejaValida ? [...viejo.rival] : [c, d],
        monto: viejo ? viejo.monto : 0,
      },
    ];
  }

  const bloques = [ordenJuego.slice(0, 6), ordenJuego.slice(6, 12), ordenJuego.slice(12, 18)];
  const parejasPorDefecto = [
    { base: [a, b], rival: [c, d] },
    { base: [a, c], rival: [b, d] },
    { base: [a, d], rival: [b, c] },
  ];

  return ["S1", "S2", "S3"].map((id, i) => {
    const viejo = (segmentosViejos || []).find((s) => s.id === id);
    // conservamos las parejas y el monto que el usuario ya haya elegido a
    // mano, siempre que sigan siendo válidas con estos 4 participantes
    const parejaValida =
      viejo &&
      viejo.base && viejo.rival &&
      [...viejo.base, ...viejo.rival].length === 4 &&
      [...viejo.base, ...viejo.rival].every((id2) => participantes.includes(id2));
    return {
      id,
      hoyos: bloques[i],
      base: parejaValida ? [...viejo.base] : parejasPorDefecto[i].base,
      rival: parejaValida ? [...viejo.rival] : parejasPorDefecto[i].rival,
      monto: viejo ? viejo.monto : 0,

    };
  });
}

/**
 * Como calcForusomeCross, pero para UN SEGMENTO de 6 hoyos dentro de un
 * foursome con cambio de pareja: solo cuenta los hoyos [desde, hasta) del
 * segmento, con un monto plano por hoyo (no ida/vuelta, porque los
 * segmentos no respetan el corte de 9 hoyos).
 */
function calcForusomeSegmento(segmento, brutos, ventajasSegmento, par, sandies, oyesOrden, metidas, contarEventos) {
  const holeResults = [];
  let saldoTotal = 0;

  for (let h = 0; h < 18; h++) {
    if (!segmento.hoyos.includes(h)) {
      holeResults.push({ hole: h + 1, jugado: false, fueraDeSegmento: true });
      continue;
    }

    const base = bolaAltaBaja(segmento.base, brutos, ventajasSegmento, h);
    const rival = bolaAltaBaja(segmento.rival, brutos, ventajasSegmento, h);

    if (base.alta === null || rival.alta === null) {
      holeResults.push({ hole: h + 1, jugado: false });
      continue;
    }

    let resultBaja = "empate";
    if (base.baja < rival.baja) resultBaja = "base";
    else if (base.baja > rival.baja) resultBaja = "rival";

    let resultAlta = "empate";
    if (base.alta < rival.alta) resultAlta = "base";
    else if (base.alta > rival.alta) resultAlta = "rival";

    const montoHoyo = segmento.monto;

    const eventosBase = contarEventos
      ? segmento.base.reduce(
          (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], false, metidas[id][h]),
          0
        )
      : 0;
    const eventosRival = contarEventos
      ? segmento.rival.reduce(
          (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], false, metidas[id][h]),
          0
        )
      : 0;

    let unidadesBase = eventosBase;
    let unidadesRival = eventosRival;
    if (resultBaja === "base") unidadesBase += 1;
    else if (resultBaja === "rival") unidadesRival += 1;
    if (resultAlta === "base") unidadesBase += 1;
    else if (resultAlta === "rival") unidadesRival += 1;

    const resultadoOyes = par[h] === 3 ? ganadorOyesEntre(oyesOrden[h], segmento.base, segmento.rival) : null;
    const oyesGanador = resultadoOyes === "a" ? "base" : resultadoOyes === "b" ? "rival" : null;
    if (oyesGanador === "base") unidadesBase += 1;
    else if (oyesGanador === "rival") unidadesRival += 1;

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
      oyesGanador,
    });
  }

  const totalUnidades = holeResults.reduce((sum, r) => sum + (r.diffUnidades || 0), 0);

  return {
    crossId: segmento.id,
    base: segmento.base,
    rival: segmento.rival,
    holeResults,
    saldoTotal,
    totalUnidades,
  };
}


/**
 * Genera los cruces de foursome a partir de la pareja "base" elegida y los
 * demás PARTICIPANTES de foursome de hoy (allPlayers puede ser un
 * subconjunto de los 5 jugadores de la ronda, ej: si hoy solo son 4).
 * - Con 3 "otros" (5 participantes en total): foursome CRUZADO, genera los
 *   3 cruces posibles (A/B/C) contra las 3 combinaciones de a 2.
 * - Con 2 "otros" (4 participantes en total): foursome NORMAL, un solo
 *   cruce 2 vs 2 (base contra esos 2, sin combinaciones).
 */
function generarCrucesForusome(basePlayers, allPlayers, crucesViejos) {
  const otros = allPlayers.map((p) => p.id).filter((id) => !basePlayers.includes(id));
  const mismaPareja = (a, b) => a.length === b.length && a.every((id) => b.includes(id));
  const montoPorDefecto =
    crucesViejos && crucesViejos.length > 0
      ? { montoIda: crucesViejos[0].montoIda, montoVuelta: crucesViejos[0].montoVuelta }
      : { montoIda: 0, montoVuelta: 0 };

  let parejas;
  if (otros.length === 3) {
    parejas = [
      [otros[0], otros[1]],
      [otros[0], otros[2]],
      [otros[1], otros[2]],
    ];
  } else if (otros.length === 2) {
    // foursome normal (4 jugadores en total): un solo cruce, sin combinaciones
    parejas = [otros];
  } else {
    return crucesViejos || []; // requiere exactamente 4 o 5 participantes
  }

  const labels = ["A", "B", "C"];

  return parejas.map((rival, i) => {
    const viejo = (crucesViejos || []).find((c) => mismaPareja(c.rival, rival) && mismaPareja(c.base, basePlayers));
    return {
      id: labels[i],
      base: [...basePlayers],
      rival,
      montoIda: viejo ? viejo.montoIda : montoPorDefecto.montoIda,
      montoVuelta: viejo ? viejo.montoVuelta : montoPorDefecto.montoVuelta,
    };
  });
}

/**
 * Cuenta cuántos eventos especiales (birdie, águila, hoyo en uno, sandy,
 * oyes, metida de afuera) logró un jugador en un hoyo dado. Se usa para
 * sumar "unidades" dentro de individuales y foursome. No incluye "ganar
 * el hoyo" — eso se suma aparte en cada función que la usa.
 */
function contarEventosJugador(bruto, par, esSandy, esOyes, esMetida) {
  if (bruto === null || bruto === undefined) return 0;
  let count = 0;
  if (bruto === 1) count++; // hoyo en uno
  if (bruto === par - 2 && bruto !== 1) count++; // águila
  if (bruto === par - 1) count++; // birdie
  if (esSandy) count++;
  if (esOyes && par === 3) count++;
  if (esMetida) count++; // metida de afuera (chip-in)
  return count;
}

/**
 * @param {Object} match - {a, b, montoIda, montoVuelta, ventajaManual}
 *   ventajaManual = {jugador: playerId, golpes: number} | null. Si está
 *   puesto, REEMPLAZA el hándicap automático SOLO para este partido
 *   específico (útil para "biblia": acuerdos históricos con un rival en
 *   particular que no siguen el hándicap calculado). Si es null, se usa
 *   el hándicap normal (relativo al grupo, calculado por calcGolpesVentaja).
 * @param {Array<number>} par - par de cada hoyo de la cancha activa
 * @param {Array<number>} strokeIndex - hándicap de cada hoyo de la cancha,
 *   necesario para repartir la ventaja manual en los hoyos correctos.
 * @param {Object} sandies - { [playerId]: [18 booleanos] }
 * @param {Array} oyesOrden - 18 posiciones { [playerId]: posición (1=más
 *   cerca) }, UNA sola marca por hoyo (no por partido). El ganador del oyes
 *   de ESTE partido se deriva solo comparando la posición de match.a contra
 *   la de match.b (quien haya quedado más cerca de los dos).
 * @param {Object} metidas - { [playerId]: [18 booleanos] } metida de
 *   afuera (chip-in) marcada manualmente, aplica en cualquier hoyo.
 * Cada jugador suma "unidades" en el hoyo: ganar el hoyo (golpe neto más
 * bajo) = 1 unidad, más 1 unidad por cada evento especial que logre
 * (birdie, águila, hoyo en uno, sandy, metida de afuera), más 1 unidad si
 * ganó el oyes de ESTE partido. Se cobra la DIFERENCIA de unidades entre
 * los 2, multiplicada por el monto de esa vuelta.
 */
function calcIndividual(match, brutos, ventajas, par, strokeIndex, sandies, oyesOrden, metidas) {
  const holeResults = [];
  let saldoA = 0; // dinero neto a favor de "a" (negativo = a favor de "b")
  let holesCounted = 0;

  // Ventaja de ESTE partido en particular: si hay ventajaManual, se
  // reemplaza el hándicap automático solo aquí (no afecta los demás
  // partidos de match.a ni match.b contra otros rivales).
  let ventajasA = ventajas[match.a];
  let ventajasB = ventajas[match.b];
  if (match.ventajaManual && match.ventajaManual.jugador && match.ventajaManual.golpes > 0) {
    const golpesManual = repartirGolpesPorDificultad(match.ventajaManual.golpes, strokeIndex);
    if (match.ventajaManual.jugador === match.a) {
      ventajasA = golpesManual;
      ventajasB = new Array(18).fill(0);
    } else if (match.ventajaManual.jugador === match.b) {
      ventajasB = golpesManual;
      ventajasA = new Array(18).fill(0);
    }
  }

  for (let h = 0; h < 18; h++) {
    const na = golpeNeto(brutos, { [match.a]: ventajasA }, match.a, h);
    const nb = golpeNeto(brutos, { [match.b]: ventajasB }, match.b, h);

    if (na === null || nb === null) {
      holeResults.push({ hole: h + 1, jugado: false });
      continue;
    }

    const montoHoyo = h < 9 ? match.montoIda : match.montoVuelta;

    // unidades por eventos especiales (independiente de quién gane el hoyo)
    const eventosA = contarEventosJugador(brutos[match.a][h], par[h], sandies[match.a][h], false, metidas[match.a][h]);
    const eventosB = contarEventosJugador(brutos[match.b][h], par[h], sandies[match.b][h], false, metidas[match.b][h]);

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

    // oyes de este partido (solo hoyos par 3): se deriva del orden de
    // cercanía marcado UNA vez por hoyo, comparando solo a match.a vs
    // match.b (sin importar dónde quedaron los demás jugadores del grupo).
    let oyesGanador = null;
    if (par[h] === 3) {
      const resultado = ganadorOyesEntre(oyesOrden[h], [match.a], [match.b]);
      if (resultado === "a") {
        oyesGanador = match.a;
        unidadesA += 1;
      } else if (resultado === "b") {
        oyesGanador = match.b;
        unidadesB += 1;
      }
    }

    holesCounted++;
    const diffUnidades = unidadesA - unidadesB;
    saldoA += diffUnidades * montoHoyo;

    holeResults.push({
      hole: h + 1,
      jugado: true,
      netoA: na,
      netoB: nb,
      ganadorHoyo,
      oyesGanador,
      montoHoyo,
      unidadesA,
      unidadesB,
      diffUnidades,
    });
  }

  const totalUnidades = holeResults.reduce((sum, r) => sum + (r.diffUnidades || 0), 0);

  return {
    ...match,
    holeResults,
    holesCounted,
    saldoA, // positivo = "a" va ganando dinero, negativo = "b" va ganando
    totalUnidades, // positivo = "a" lleva más unidades, negativo = "b" lleva más
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
 * @param {Object} sandies - { [playerId]: [18 booleanos] }
 * @param {Array} oyesOrden - 18 posiciones { [playerId]: posición (1=más
 *   cerca) }, UNA sola marca por hoyo. Gana el oyes de este cruce el
 *   equipo (base o rival) que tenga, entre sus 2 integrantes, al que
 *   quedó más cerca de la bandera.
 * Cada pareja suma "unidades" en el hoyo: ganar bola baja = 1, ganar bola
 * alta = 1, más 1 unidad por cada evento especial (birdie, águila, hoyo en
 * uno, sandy) de CUALQUIERA de los 2 jugadores de la pareja, más 1 unidad
 * si su equipo ganó el oyes manual de este cruce en ese hoyo. Se cobra la
 * diferencia de unidades entre las 2 parejas, multiplicada por el monto
 * de esa vuelta.
 * Devuelve detalle por hoyo + saldo total en dinero (positivo = gana "base").
 */
function calcForusomeCross(cross, brutos, ventajasCruce, par, sandies, oyesOrden, metidas, contarEventos) {
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
    // (esOyes=false siempre: el oyes en foursome se marca manual por cruce,
    // no se toma del botón individual de cada jugador). Si contarEventos
    // está apagado, el foursome se juega SOLO con bola alta/baja (+ oyes
    // manual), sin sumar unidades extra por birdie/águila/sandy/metida.
    const eventosBase = contarEventos
      ? cross.base.reduce(
          (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], false, metidas[id][h]),
          0
        )
      : 0;
    const eventosRival = contarEventos
      ? cross.rival.reduce(
          (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], false, metidas[id][h]),
          0
        )
      : 0;

    let unidadesBase = eventosBase;
    let unidadesRival = eventosRival;
    if (resultBaja === "base") unidadesBase += 1;
    else if (resultBaja === "rival") unidadesRival += 1;
    if (resultAlta === "base") unidadesBase += 1;
    else if (resultAlta === "rival") unidadesRival += 1;

    // Oyes manual (solo aplica en par 3): reemplaza el oyes individual
    // automático para foursome, se marca por cruce desde la tarjeta de hoyo.
    const resultadoOyesCross = par[h] === 3 ? ganadorOyesEntre(oyesOrden[h], cross.base, cross.rival) : null;
    const oyesGanador = resultadoOyesCross === "a" ? "base" : resultadoOyesCross === "b" ? "rival" : null;
    if (oyesGanador === "base") unidadesBase += 1;
    else if (oyesGanador === "rival") unidadesRival += 1;

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
      oyesGanador,
    });
  }

  const totalUnidades = holeResults.reduce((sum, r) => sum + (r.diffUnidades || 0), 0);

  return {
    crossId: cross.id,
    base: cross.base,
    rival: cross.rival,
    holeResults,
    saldoTotal,
    totalUnidades, // positivo = "base" lleva más unidades, negativo = "rival" lleva más
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
function calcSkins(players, brutos, ventajas, montoPorHoyo, par, sandies, oyes, metidas, hoyoInicial) {
  const porHoyo = new Array(18).fill(null);
  const totalesPorJugador = {};
  const unidadesPorJugador = {};
  players.forEach((p) => {
    totalesPorJugador[p.id] = 0;
    unidadesPorJugador[p.id] = 0;
  });

  let acumulado = 0; // extra acumulado por empates de 3+, se suma al monto base del siguiente hoyo JUGADO

  // El acumulado por empates de 3+ debe pasar al SIGUIENTE HOYO EN EL
  // ORDEN REAL DE JUEGO, no al siguiente número de hoyo — si no, un
  // empate en el hoyo 18 se "arrastraría" al hoyo 19 (que no existe) en
  // vez de al hoyo 1, si la ronda arranca en el 10.
  const orden = ordenDeJuego(hoyoInicial);

  orden.forEach((h) => {
    const netos = players
      .map((p) => ({ id: p.id, neto: golpeNeto(brutos, ventajas, p.id, h) }))
      .filter((x) => x.neto !== null);

    if (netos.length === 0) {
      porHoyo[h] = { hole: h + 1, jugado: false };
      return;
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

      // Rayas = dinero / monto BASE de skins (el que pusiste en Apuestas,
      // sin contar acumulado por empates), para que 1 raya sea SIEMPRE el
      // mismo valor en dinero y cuadre exacto con el total. Ganar limpio
      // contra 3 rivales = 3 rayas (1 por cada uno que te paga). Empatar
      // a 2 = 1 raya cada uno (el bote de 2 perdedores se reparte entre 2).
      // Rayas = dinero / monto BASE de skins (el que pusiste en Apuestas,
      // sin contar acumulado por empates), para que 1 raya sea SIEMPRE el
      // mismo valor en dinero y cuadre exacto con el total. Ganar limpio
      // contra 3 rivales = 3 rayas (1 por cada uno que te paga). Empatar
      // a 2 = 1 raya cada uno (el bote de 2 perdedores se reparte entre 2).
      if (montoPorHoyo > 0) {
        ganadores.forEach((id) => (unidadesPorJugador[id] += repartoPorGanador / montoPorHoyo));
        perdedores.forEach((id) => (unidadesPorJugador[id] -= montoVigente / montoPorHoyo));
      }

      entry.montoCadaGanador = repartoPorGanador;
      acumulado = 0;
    } else {
      // 3+ empatan: nadie cobra ni suma rayas todavía; tanto el dinero
      // como las rayas se acumulan para el siguiente hoyo JUGADO
      entry.acumulaSiguiente = true;
      acumulado = montoVigente;
    }

    // Eventos especiales: cobran el monto base de skins a cada uno de los
    // demás, independiente de quién ganó el hoyo. Las rayas del evento
    // también van 1 por cada rival que paga (igual que ganar el hoyo), no
    // 1 por evento — así siempre cuadra con el dinero real.
    const eventosHoyo = [];
    players.forEach((p) => {
      const cantEventos = contarEventosJugador(brutos[p.id][h], par[h], sandies[p.id][h], oyes[p.id][h], metidas[p.id][h]);
      if (cantEventos > 0) {
        const otros = players.filter((o) => o.id !== p.id);
        const totalEvento = montoPorHoyo * cantEventos;
        otros.forEach((o) => {
          totalesPorJugador[p.id] += totalEvento;
          totalesPorJugador[o.id] -= totalEvento;
        });
        unidadesPorJugador[p.id] += cantEventos * otros.length;
        otros.forEach((o) => (unidadesPorJugador[o.id] -= cantEventos));
        eventosHoyo.push({ playerId: p.id, cantidad: cantEventos, monto: totalEvento * otros.length });
      }
    });
    if (eventosHoyo.length > 0) entry.eventosHoyo = eventosHoyo;

    porHoyo[h] = entry;
  });

  return { porHoyo, totalesPorJugador, unidadesPorJugador, montoPendiente: acumulado };
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
  METIDA: "Unidad",
};

/**
 * Detecta qué evento(s) logró un jugador en un hoyo dado (golpes brutos vs par).
 * @returns {Array<string>} lista de nombres de evento, puede tener varios (ej: hoyo en uno Y birdie no se solapan en la práctica, pero por si acaso devolvemos todos los que matcheen)
 */
function detectarEventos(bruto, par, esSandy, esOyes, esMetida) {
  const eventos = [];
  if (bruto === null || bruto === undefined) return eventos;

  if (bruto === 1) eventos.push(EVENTOS.HOYO_EN_UNO);
  if (bruto === par - 2 && bruto !== 1) eventos.push(EVENTOS.AGUILA);
  if (bruto === par - 1) eventos.push(EVENTOS.BIRDIE);
  if (esSandy) eventos.push(EVENTOS.SANDY);
  if (esOyes && par === 3) eventos.push(EVENTOS.OYES);
  if (esMetida) eventos.push(EVENTOS.METIDA);

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
function calcStableford(players, brutos, ventajas, par, montos, hoyoInicial) {
  const puntosPorHoyo = {};
  players.forEach((p) => (puntosPorHoyo[p.id] = new Array(18).fill(null)));

  for (let h = 0; h < 18; h++) {
    players.forEach((p) => {
      const neto = golpeNeto(brutos, ventajas, p.id, h);
      puntosPorHoyo[p.id][h] = puntosStableford(neto, par[h]);
    });
  }

  // "ida" = los primeros 9 hoyos que se JUEGAN en orden real (no siempre
  // son los hoyos 1-9: si arrancan en el 10, la ida son los hoyos 10-18).
  const orden = ordenDeJuego(hoyoInicial);
  const indicesIda = orden.slice(0, 9);
  const indicesVuelta = orden.slice(9, 18);

  const sumaIndices = (id, indices) => {
    let total = 0;
    let jugados = 0;
    indices.forEach((h) => {
      const pts = puntosPorHoyo[id][h];
      if (pts !== null) {
        total += pts;
        jugados++;
      }
    });
    return { total, jugados };
  };

  const totales = {};
  players.forEach((p) => {
    totales[p.id] = {
      ida: sumaIndices(p.id, indicesIda),
      vuelta: sumaIndices(p.id, indicesVuelta),
      total: sumaIndices(p.id, [...indicesIda, ...indicesVuelta]),
    };
  });

  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));

  function resolverPremio(key, monto, hoyosDelRango) {
    // el premio SOLO se decide (y se cobra) cuando el segmento está
    // COMPLETO para TODOS los que juegan stableford — los 9 hoyos de
    // ida/vuelta, o los 18 del total. Antes de eso no hay ganador, aunque
    // ya se vean puntos parciales en el desglose. Sin este candado se
    // pagaba de más con solo 1 hoyo jugado de esa mitad, como si ya
    // estuviera decidido — justo lo que generaba el salto raro al cruzar
    // de la vuelta a la ida en una ronda que arranca en el hoyo 10.
    const todosCompletos = players.every((p) => totales[p.id][key].jugados === hoyosDelRango);
    if (!todosCompletos) return { ganadores: [], montoCadaGanador: 0, decidido: false };

    const conPuntos = players.map((p) => ({ id: p.id, pts: totales[p.id][key].total }));
    const maxPts = Math.max(...conPuntos.map((x) => x.pts));
    const ganadores = conPuntos.filter((x) => x.pts === maxPts).map((x) => x.id);
    const perdedores = players.map((p) => p.id).filter((id) => !ganadores.includes(id));

    if (ganadores.length === players.length) {
      // todos empatados, nadie pierde, no hay nada que cobrar
      return { ganadores, montoCadaGanador: 0, decidido: true };
    }

    const totalCobrado = monto * perdedores.length;
    const montoCadaGanador = totalCobrado / ganadores.length;

    ganadores.forEach((id) => (balances[id] += montoCadaGanador));
    perdedores.forEach((id) => (balances[id] -= monto));

    return { ganadores, montoCadaGanador, decidido: true };
  }

  const premios = {
    ida: resolverPremio("ida", montos.ida, 9),
    vuelta: resolverPremio("vuelta", montos.vuelta, 9),
    total: resolverPremio("total", montos.total, 18),
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
/**
 * Genérica: cobra "cantidadFn(cfg)" unidades de "monto" al jugador que las
 * tiene, pagando a CADA uno de los demás PARTICIPANTES de esta apuesta
 * específica (no de todo el grupo). Si signo=1, quien tiene la cantidad
 * COBRA (banderas); si signo=-1, quien la tiene PAGA (3-putt, chupes).
 */
function calcContadorPorHoyo(players, banderasState, monto, participantIds, cantidadFn, tipo, signo) {
  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));
  const detalle = [];

  const participantes = players.filter((p) => participantIds.includes(p.id));

  for (let h = 0; h < 18; h++) {
    participantes.forEach((p) => {
      const cfg = banderasState[p.id] && banderasState[p.id][h];
      if (!cfg) return;
      const cantidad = cantidadFn(cfg);
      if (!cantidad) return;

      const otros = participantes.filter((o) => o.id !== p.id);
      const totalCobrado = monto * cantidad;
      otros.forEach((o) => {
        balances[p.id] += signo * totalCobrado;
        balances[o.id] -= signo * totalCobrado;
      });
      detalle.push({ hole: h + 1, playerId: p.id, tipo, cantidad, monto: totalCobrado * otros.length });
    });
  }

  return { detalle, balances };
}

function calcBanderas(players, banderasState, monto, participantIds) {
  return calcContadorPorHoyo(players, banderasState, monto, participantIds, (cfg) => cfg.banderas, "banderas", 1);
}

function calcThreePutt(players, banderasState, monto, participantIds) {
  return calcContadorPorHoyo(players, banderasState, monto, participantIds, (cfg) => (cfg.threePutt ? 1 : 0), "3putt", -1);
}

function calcChupes(players, banderasState, monto, participantIds) {
  return calcContadorPorHoyo(players, banderasState, monto, participantIds, (cfg) => cfg.chupes, "chupes", -1);
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
/**
 * Reparte el dinero de una diferencia de unidades en Loba (ya sea por ganar
 * el hoyo o por eventos especiales), usando el modo "va solo" (1v4, sin ×3)
 * o el modo normal (2v3, siempre se mueven 3×monto en total).
 * Muta balances directamente. unidadesDiff positivo = gana la pareja.
 * @returns {number} totalBote movido (solo informativo)
 */
function pagarDiferenciaLoba(balances, unidadesDiff, montoBase, multiplicador, pareja, trio, vaSolo) {
  if (unidadesDiff === 0) return 0;
  let totalBote = 0;
  if (vaSolo) {
    const montoPorUnidad = montoBase * multiplicador * Math.abs(unidadesDiff);
    totalBote = montoPorUnidad * trio.length;
    const loba = pareja[0];
    if (unidadesDiff > 0) {
      trio.forEach((o) => {
        balances[loba] += montoPorUnidad;
        balances[o] -= montoPorUnidad;
      });
    } else {
      trio.forEach((o) => {
        balances[loba] -= montoPorUnidad;
        balances[o] += montoPorUnidad;
      });
    }
  } else {
    totalBote = montoBase * multiplicador * Math.abs(unidadesDiff) * 3;
    if (unidadesDiff > 0) {
      const cadaUno = totalBote / pareja.length;
      pareja.forEach((id) => (balances[id] += cadaUno));
      trio.forEach((id) => (balances[id] -= totalBote / trio.length));
    } else {
      const cadaUno = totalBote / trio.length;
      trio.forEach((id) => (balances[id] += cadaUno));
      pareja.forEach((id) => (balances[id] -= totalBote / pareja.length));
    }
  }
  return totalBote;
}

/**
 * Loba: el bote de "quién gana el hoyo" (golpe neto, pareja vs trío) y los
 * eventos especiales (birdie/águila/hoyo en uno/sandy/oyes/metida) son DOS
 * cosas independientes:
 * - El bote del hoyo SOLO se resuelve por golpe neto. Si empatan en golpe
 *   neto, el monto base se acumula para el siguiente hoyo CONFIGURADO,
 *   sin importar si alguien tuvo un evento especial ese hoyo.
 * - Los eventos especiales se pagan aparte, de inmediato, ese mismo hoyo,
 *   con el monto base (sin el acumulado) — igual que birdie/sandy pagan en
 *   Individuales. Ganar el oyes no "rompe" el empate del bote del hoyo.
 */
function calcLoba(players, brutos, ventajas, lobaConfig, monto, par, sandies, oyes, metidas, hoyoInicial) {
  const balances = {};
  const unidadesPorJugador = {};
  players.forEach((p) => {
    balances[p.id] = 0;
    unidadesPorJugador[p.id] = 0;
  });
  const detalle = [];

  let acumulado = 0; // extra por empates de GOLPE, se suma al monto base del siguiente hoyo CONFIGURADO

  // igual que en Skins: el acumulado por empate de golpe debe pasar al
  // siguiente hoyo CONFIGURADO en el ORDEN REAL DE JUEGO, no al siguiente
  // número de hoyo — si no, un empate en el hoyo 18 se "arrastraría" al
  // hoyo 19 (inexistente) en vez de al hoyo 1 si la ronda arranca en el 10.
  const orden = ordenDeJuego(hoyoInicial);

  // Suma rayas = dinero real que ganó/perdió CADA jugador en este hoyo,
  // dividido entre el monto BASE de Loba (sin multiplicador ni acumulado)
  // — así 1 raya siempre vale exactamente el monto que pusiste en
  // Apuestas, igual que en Skins, sin importar si el jugador va en la
  // pareja (2 personas) o el trío (3 personas) ni el multiplicador del hoyo.
  function sumarRayasPorDinero(antes) {
    if (monto <= 0) return;
    players.forEach((p) => {
      const delta = balances[p.id] - antes[p.id];
      if (delta !== 0) unidadesPorJugador[p.id] += delta / monto;
    });
  }

  orden.forEach((h) => {
    const cfg = lobaConfig[h];
    if (!cfg || !cfg.loba || !cfg.companero) {
      detalle.push({ hole: h + 1, configurado: false });
      return;
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
      return;
    }

    const mejorPareja = Math.min(...netosPareja);
    const mejorTrio = Math.min(...netosTrio);
    const multiplicador = cfg.multiplicador || 1;

    // 1. Bote del hoyo: SOLO por golpe neto, independiente de eventos.
    let golpeGanador = null;
    let boteHoyo = 0;
    let acumulaSiguiente = false;
    if (mejorPareja < mejorTrio) {
      golpeGanador = "pareja";
    } else if (mejorTrio < mejorPareja) {
      golpeGanador = "trio";
    }

    if (golpeGanador === null) {
      // empate en golpe neto: se acumula el monto base, sin importar eventos
      acumulaSiguiente = true;
      acumulado += monto * multiplicador;
    } else {
      const montoVigente = monto + acumulado;
      const antesGolpe = { ...balances };
      // Yendo solo, el multiplicador significa RAYAS EXTRA por ganar el
      // hoyo (ej: multiplicador 2 = 2 rayas), no un multiplicador de
      // dinero — el monto de cada raya se queda fijo. En modo normal
      // (2v3) el multiplicador sigue siendo multiplicador de dinero,
      // como antes.
      if (vaSolo) {
        const unidadesGolpe = (golpeGanador === "pareja" ? 1 : -1) * multiplicador;
        boteHoyo = pagarDiferenciaLoba(balances, unidadesGolpe, montoVigente, 1, pareja, trio, vaSolo);
      } else {
        const unidadesGolpe = golpeGanador === "pareja" ? 1 : -1;
        boteHoyo = pagarDiferenciaLoba(balances, unidadesGolpe, montoVigente, multiplicador, pareja, trio, vaSolo);
      }
      sumarRayasPorDinero(antesGolpe);
      acumulado = 0;
    }

    // 2. Eventos especiales: se pagan aparte y de inmediato, con el monto
    // base (sin el acumulado del bote), sin afectar el empate/acumulado de
    // arriba. Yendo solo, cada evento SIEMPRE vale 1 raya fija (el
    // multiplicador del hoyo no aplica al oyes/birdie/etc, solo a la raya
    // de ganar el hoyo).
    const eventosPareja = pareja.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h], metidas[id][h]),
      0
    );
    const eventosTrio = trio.reduce(
      (sum, id) => sum + contarEventosJugador(brutos[id][h], par[h], sandies[id][h], oyes[id][h], metidas[id][h]),
      0
    );
    const diffEventos = eventosPareja - eventosTrio;
    const antesEventos = { ...balances };
    const boteEventos = pagarDiferenciaLoba(balances, diffEventos, monto, vaSolo ? 1 : multiplicador, pareja, trio, vaSolo);
    sumarRayasPorDinero(antesEventos);

    detalle.push({
      hole: h + 1,
      configurado: true,
      jugado: true,
      pareja,
      trio,
      vaSolo,
      mejorPareja,
      mejorTrio,
      ganador: golpeGanador,
      multiplicador,
      eventosPareja,
      eventosTrio,
      diffEventos,
      unidadesPareja: (golpeGanador === "pareja" ? 1 : 0) + eventosPareja,
      unidadesTrio: (golpeGanador === "trio" ? 1 : 0) + eventosTrio,
      totalBote: boteHoyo + boteEventos,
      acumulaSiguiente,
    });
  });

  return { detalle, balances, unidadesPorJugador };
}

/**
 * Junta los resultados de las 5 modalidades en un balance neto por jugador.
 * Respeta los interruptores enabled de cada modalidad.
 */
/**
 * Calcula el resumen general pero usando SOLO los golpes/marcas hasta el
 * hoyo indicado (inclusive), ignorando cualquier dato de hoyos posteriores.
 * Útil para mostrar "cómo voy hasta aquí" mientras se juega la ronda.
 * No muta el state original.
 * @param {number} hastaHoyo - número de hoyo 1-18 (inclusive)
 */
/**
 * Devuelve el orden real de juego (índices 0-based de hoyo) según por
 * dónde arranca la ronda. Con hoyoInicial=1: [0,1,...,17] (normal). Con
 * hoyoInicial=10: [9,10,...,17,0,1,...,8] (sale por el 10, da la vuelta).
 */
function ordenDeJuego(hoyoInicial) {
  const inicio = (hoyoInicial || 1) - 1;
  const orden = [];
  for (let i = 0; i < 18; i++) orden.push((inicio + i) % 18);
  return orden;
}

/**
 * @param {number} posicionEnOrden - cuántos hoyos del ORDEN DE JUEGO real
 *   se han jugado hasta ahora (incluyendo el actual), 1-18. NO es el
 *   número de hoyo — si la ronda arranca en el 10, el hoyo 10 es la
 *   posición 1, el hoyo 18 es la posición 9, el hoyo 1 es la posición 10, etc.
 *   Esto es necesario para que "acumulado hasta aquí" conserve los hoyos
 *   ya jugados sin importar en qué orden los jugaron.
 */
function calcResumenHastaHoyo(state, posicionEnOrden) {
  const orden = ordenDeJuego(state.round.hoyoInicial);
  const indicesJugados = new Set(orden.slice(0, posicionEnOrden));
  const recortado = JSON.parse(JSON.stringify(state));

  const limpiarNoJugados = (obj, valorVacio) => {
    Object.keys(obj).forEach((playerId) => {
      for (let h = 0; h < 18; h++) {
        if (indicesJugados.has(h)) continue;
        if (Array.isArray(obj[playerId])) obj[playerId][h] = valorVacio;
      }
    });
  };

  limpiarNoJugados(recortado.scores, null);
  // sandies/metidas/banderas usan false/0 como "vacío", no null
  limpiarNoJugados(recortado.sandies, false);
  limpiarNoJugados(recortado.metidas, false);
  Object.keys(recortado.banderas).forEach((playerId) => {
    for (let h = 0; h < 18; h++) {
      if (indicesJugados.has(h)) continue;
      recortado.banderas[playerId][h] = { banderas: 0, threePutt: false, chupes: 0 };
    }
  });
  for (let h = 0; h < 18; h++) {
    if (indicesJugados.has(h)) continue;
    recortado.loba[h] = { loba: null, companero: null, multiplicador: 1 };
  }

  return calcResumenGeneral(recortado);
}

function calcResumenGeneral(state) {
  const { players, scores, bets, round } = state;
  const course = getActiveCourse(state);

  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));

  // Individuales (hándicap propio de esta modalidad). La ventaja se
  // calcula POR PARTIDO, solo entre los 2 jugadores involucrados (el de
  // menor hcp de ESOS 2 es la referencia), no contra el más bajo de todo
  // el grupo — así cada 1v1 usa la diferencia real entre ambos rivales.
  const individualesResults = bets.individuales.enabled
    ? bets.individuales.matches.map((m) => {
        const jugadoresPartido = players.filter((p) => p.id === m.a || p.id === m.b);
        const ventajasPartido = calcGolpesVentaja(jugadoresPartido, course.strokeIndex, "individuales");
        return calcIndividual(m, scores, ventajasPartido, course.par, course.strokeIndex, state.sandies, state.oyesOrden, state.metidas);
      })
    : [];
  individualesResults.forEach((r) => {
    balances[r.a] += r.saldoA;
    balances[r.b] -= r.saldoA;
  });

  // Foursome: UN solo formato activo a la vez (cruzado, roundRobin o
  // normal), elegido con bets.foursome.formato. La ventaja siempre se
  // calcula por SUMA de hcp.foursome de cada pareja, no individual.
  const formatoFoursome = bets.foursome.formato || "cruzado";
  let foursomeResults = [];
  if (bets.foursome.enabled) {
    if (formatoFoursome === "cruzado") {
      const ventajasForusome = calcVentajasForusome(players, course.strokeIndex, bets.foursome.crosses);
      foursomeResults = bets.foursome.crosses.map((c) =>
        calcForusomeCross(c, scores, ventajasForusome[c.id], course.par, state.sandies, state.oyesOrden, state.metidas, true)
      );
    } else {
      // roundRobin o normal: necesitan EXACTAMENTE 4 participantes propios
      const jugadores4 = players.filter((p) => bets.foursome.participantes4.includes(p.id));
      if (jugadores4.length === 4) {
        const ventajas4 = calcVentajasForusome(jugadores4, course.strokeIndex, bets.foursome.segmentos);
        const segmentosActivos = formatoFoursome === "normal" ? bets.foursome.segmentos.slice(0, 1) : bets.foursome.segmentos;
        foursomeResults = segmentosActivos.map((seg) =>
          calcForusomeSegmento(seg, scores, ventajas4[seg.id], course.par, state.sandies, state.oyesOrden, state.metidas, true)
        );
      }
    }
  }
  foursomeResults.forEach((r) => {
    // saldoTotal positivo = a favor de "base". Cada jugador de la pareja
    // COBRA EL MONTO COMPLETO del cruce/segmento, no se reparte entre los
    // 2 (confirmado con ejemplo numérico: si da $500 a favor de la base,
    // CADA UNO de los 2 de la base cobra $500, no $250).
    r.base.forEach((id) => (balances[id] += r.saldoTotal));
    r.rival.forEach((id) => (balances[id] -= r.saldoTotal));
  });

  // Derivado del orden de cercanía compartido: quien haya quedado en
  // posición 1 (más cerca) ese hoyo cuenta como "oyes" para Skins y Loba
  // (pagan como cualquier otro evento especial: birdie, sandy, etc.).
  const oyesGanadorPorHoyo = {};
  players.forEach((p) => {
    oyesGanadorPorHoyo[p.id] = new Array(18).fill(false).map((_, h) => (state.oyesOrden[h] || {})[p.id] === 1);
  });

  // Skins (hándicap propio de esta modalidad). totalesPorJugador ya es el
  // balance neto: positivo gana, negativo paga. Incluye además el cobro
  // por birdie/águila/hoyo en uno/sandy/oyes.
  // Solo participan los jugadores marcados en bets.skins.participantes; la
  // ventaja se calcula relativa al más bajo de ESE subgrupo, no del grupo
  // completo, para que jugar skins entre 4 no dependa de quién no juega.
  const jugadoresSkins = players.filter((p) => bets.skins.participantes.includes(p.id));
  const ventajasSkins = calcGolpesVentaja(jugadoresSkins, course.strokeIndex, "skins");
  const skinsResult = bets.skins.enabled && jugadoresSkins.length >= 2
    ? calcSkins(jugadoresSkins, scores, ventajasSkins, bets.skins.montoPorHoyo, course.par, state.sandies, oyesGanadorPorHoyo, state.metidas, round.hoyoInicial)
    : { porHoyo: [], totalesPorJugador: Object.fromEntries(players.map((p) => [p.id, 0])), montoPendiente: 0 };
  players.forEach((p) => {
    balances[p.id] += skinsResult.totalesPorJugador[p.id] || 0;
  });

  // Loba (hándicap propio de esta modalidad, además recortado al 80%).
  // Incluye además el cobro por birdie/águila/hoyo en uno/sandy/oyes de
  // cualquiera de los jugadores del equipo.
  const ventajasLoba = calcGolpesVentaja(players, course.strokeIndex, "loba");
  const lobaResult = bets.loba.enabled
    ? calcLoba(players, scores, ventajasLoba, state.loba, bets.loba.monto, course.par, state.sandies, oyesGanadorPorHoyo, state.metidas, round.hoyoInicial)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += lobaResult.balances[p.id];
  });

  // Stableford (hándicap propio de esta modalidad, 3 premios).
  // Solo participan los marcados en bets.stableford.participantes; la
  // ventaja se calcula relativa al más bajo de ESE subgrupo.
  const jugadoresStableford = players.filter((p) => bets.stableford.participantes.includes(p.id));
  const ventajasStableford = calcGolpesVentaja(jugadoresStableford, course.strokeIndex, "stableford");
  const stablefordResult = bets.stableford.enabled && jugadoresStableford.length >= 2
    ? calcStableford(jugadoresStableford, scores, ventajasStableford, course.par, {
        ida: bets.stableford.montoIda,
        vuelta: bets.stableford.montoVuelta,
        total: bets.stableford.montoTotal,
      }, round.hoyoInicial)
    : { puntosPorHoyo: {}, totales: {}, premios: {}, balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += stablefordResult.balances[p.id] || 0;
  });

  // Banderas / 3-putt / Chupes: 3 apuestas INDEPENDIENTES (cada una con su
  // propio monto y sus propios participantes), marcado manual, no usa hándicap.
  const banderasResult = bets.banderas.enabled
    ? calcBanderas(players, state.banderas, bets.banderas.monto, bets.banderas.participantes)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  const threePuttResult = bets.threePutt.enabled
    ? calcThreePutt(players, state.banderas, bets.threePutt.monto, bets.threePutt.participantes)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  const chupesResult = bets.chupes.enabled
    ? calcChupes(players, state.banderas, bets.chupes.monto, bets.chupes.participantes)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += banderasResult.balances[p.id];
    balances[p.id] += threePuttResult.balances[p.id];
    balances[p.id] += chupesResult.balances[p.id];
  });

  return {
    ventajas: calcGolpesVentaja(players, course.strokeIndex, "individuales"), // ventaja del grupo completo, solo informativa
    individualesResults,
    foursomeResults,
    skinsResult,
    lobaResult,
    stablefordResult,
    banderasResult,
    threePuttResult,
    chupesResult,
    balances,
  };
}

/* ----------------------------------------------------------
   HISTORIAL: guardar el resultado de la ronda actual antes de resetear.
   ---------------------------------------------------------- */

/**
 * Cierra la ronda actual y guarda su resultado en el historial permanente:
 * - Le suma a cada amigo (identificado por friendId en el jugador de hoy)
 *   el dinero que ganaste/perdiste contra él en INDIVIDUALES hoy, tomando
 *   como referencia a state.miPlayerId.
 * - Guarda una entrada en state.roundsHistory con tu saldo TOTAL del día
 *   (todas las modalidades activas).
 * Muta el state que recibe (friends y roundsHistory); no toca nada más.
 * No hace nada si no hay ningún golpe registrado todavía.
 * @returns {boolean} true si guardó algo, false si no había nada que guardar
 */
function archivarRonda(state) {
  if (holesPlayedCount(state) === 0) return false;

  const resumen = calcResumenGeneral(state);
  const course = getActiveCourse(state);
  const yo = state.miPlayerId;
  const fecha = new Date().toISOString();

  // 1. Individuales contra cada amigo (solo partidos donde juego yo)
  if (state.bets.individuales.enabled) {
    resumen.individualesResults.forEach((r) => {
      if (r.a !== yo && r.b !== yo) return; // no soy parte de este partido
      const rivalId = r.a === yo ? r.b : r.a;
      const montoParaMi = r.a === yo ? r.saldoA : -r.saldoA;
      const rivalPlayer = state.players.find((p) => p.id === rivalId);
      if (!rivalPlayer || !rivalPlayer.friendId) return; // rival no ligado a un amigo guardado
      const friend = state.friends.find((f) => f.id === rivalPlayer.friendId);
      if (!friend) return;
      friend.individualesTotal += montoParaMi;
      friend.individualesHistorial.push({ fecha, monto: montoParaMi, courseName: course.name });
    });
  }

  // 2. Saldo total del día (todas las modalidades activas), guardado en el historial general
  state.roundsHistory.push({
    id: "r" + Date.now(),
    fecha,
    courseName: course.name,
    balanceYo: resumen.balances[yo] || 0,
  });

  return true;
}

function holesPlayedCount(state) {
  let count = 0;
  for (let h = 0; h < 18; h++) {
    const any = state.players.some((p) => state.scores[p.id][h] !== null);
    if (any) count++;
  }
  return count;
}
