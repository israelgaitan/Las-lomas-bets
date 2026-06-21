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
 * Calcula los golpes de ventaja por jugador y por hoyo, para uso INDIVIDUAL
 * (skins, individuales, loba). Regla: el jugador con hcp más alto del grupo
 * juega "a la par" (0 golpes). Los demás reciben golpes = diferencia
 * respecto al hcp más alto, repartidos en los hoyos más difíciles.
 *
 * @param {Array} players - [{id, hcp}, ...]
 * @param {Array<number>} strokeIndex - 18 valores, dificultad de cada hoyo
 * @returns {Object} { [playerId]: [18 valores de golpes de ventaja] }
 */
function calcGolpesVentaja(players, strokeIndex) {
  const minHcp = Math.min(...players.map((p) => p.hcp));
  const result = {};

  players.forEach((p) => {
    const diff = Math.max(0, p.hcp - minHcp); // golpes que recibe este jugador
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
  const hcpOf = (id) => players.find((p) => p.id === id).hcp;
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
 * @param {Object} match - {a, b, monto} (monto = $ por hoyo ganado)
 * @returns {Object} detalle hoyo a hoyo + saldo neto total del partido
 */
function calcIndividual(match, brutos, ventajas) {
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

    holesCounted++;
    let ganadorHoyo = null;
    if (na < nb) {
      ganadorHoyo = match.a;
      saldoA += match.monto;
    } else if (nb < na) {
      ganadorHoyo = match.b;
      saldoA -= match.monto;
    }
    // empate: no se paga nada, no se acumula

    holeResults.push({
      hole: h + 1,
      jugado: true,
      netoA: na,
      netoB: nb,
      ganadorHoyo,
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
 * Devuelve detalle por hoyo + saldo total en dinero (positivo = gana "base").
 */
function calcForusomeCross(cross, brutos, ventajasCruce) {
  const holeResults = [];
  let saldoAlta = 0; // dinero neto a favor de "base" en bola alta
  let saldoBaja = 0;

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

    if (resultBaja === "base") saldoBaja += cross.montoBaja;
    else if (resultBaja === "rival") saldoBaja -= cross.montoBaja;

    if (resultAlta === "base") saldoAlta += cross.montoAlta;
    else if (resultAlta === "rival") saldoAlta -= cross.montoAlta;

    holeResults.push({
      hole: h + 1,
      jugado: true,
      base,
      rival,
      resultAlta,
      resultBaja,
    });
  }

  return {
    crossId: cross.id,
    base: cross.base,
    rival: cross.rival,
    holeResults,
    saldoAlta,
    saldoBaja,
    saldoTotal: saldoAlta + saldoBaja,
  };
}

/* ----------------------------------------------------------
   3. SKINS (individual, golpe neto más bajo, empate de 2 reparte,
      empate de 3+ acumula)
   ---------------------------------------------------------- */

/**
 * Calcula los skins ganados por cada jugador a través de los 18 hoyos.
 * @returns {Object} { porHoyo: [...], totalesPorJugador: {id: monto}, acumuladoPendiente }
 */
function calcSkins(players, brutos, ventajas, montoPorHoyo) {
  const porHoyo = [];
  const totalesPorJugador = {};
  players.forEach((p) => (totalesPorJugador[p.id] = 0));

  let bote = 0; // acumulado por empates de 3+

  for (let h = 0; h < 18; h++) {
    const netos = players
      .map((p) => ({ id: p.id, neto: golpeNeto(brutos, ventajas, p.id, h) }))
      .filter((x) => x.neto !== null);

    if (netos.length === 0) {
      porHoyo.push({ hole: h + 1, jugado: false });
      continue;
    }

    const minNeto = Math.min(...netos.map((x) => x.neto));
    const ganadores = netos.filter((x) => x.neto === minNeto).map((x) => x.id);

    bote += montoPorHoyo;

    let entry = { hole: h + 1, jugado: true, ganadores, monto: 0, acumulaSiguiente: false };

    if (ganadores.length === 1) {
      // 1 gana todo el bote acumulado
      totalesPorJugador[ganadores[0]] += bote;
      entry.monto = bote;
      bote = 0;
    } else if (ganadores.length === 2) {
      // se reparten el bote entre ellos
      const reparto = bote / 2;
      ganadores.forEach((id) => (totalesPorJugador[id] += reparto));
      entry.monto = bote;
      entry.repartoCadaUno = reparto;
      bote = 0;
    } else {
      // 3+ empatan: nadie gana, se acumula
      entry.acumulaSiguiente = true;
      entry.boteAcumulado = bote;
    }

    porHoyo.push(entry);
  }

  return { porHoyo, totalesPorJugador, botePendiente: bote };
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

/**
 * Calcula todos los pagos de unidades a través de los 18 hoyos.
 * @returns {Object} { detalle: [...por hoyo y jugador...], balances: {id: monto neto} }
 */
function calcUnidades(players, brutos, par, sandies, oyes, monto) {
  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));
  const detalle = [];

  for (let h = 0; h < 18; h++) {
    // por cada jugador, qué eventos logró en este hoyo
    const eventosHoyo = players.map((p) => ({
      id: p.id,
      eventos: detectarEventos(brutos[p.id][h], par[h], sandies[p.id][h], oyes[p.id][h]),
    }));

    const conEvento = eventosHoyo.filter((e) => e.eventos.length > 0);
    if (conEvento.length === 0) continue;

    conEvento.forEach(({ id, eventos }) => {
      eventos.forEach((evento) => {
        // este jugador cobra `monto` a cada uno de los demás jugadores
        const otros = players.filter((p) => p.id !== id);
        otros.forEach((o) => {
          balances[id] += monto;
          balances[o.id] -= monto;
        });
        detalle.push({ hole: h + 1, playerId: id, evento, monto: monto * otros.length });
      });
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
 * @param {Array} lobaConfig - 18 posiciones { loba, companero } (playerIds o null)
 * @returns {Object} { detalle: [...por hoyo...], balances: {id: monto neto} }
 */
function calcLoba(players, brutos, ventajas, lobaConfig, monto) {
  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));
  const detalle = [];

  for (let h = 0; h < 18; h++) {
    const cfg = lobaConfig[h];
    if (!cfg || !cfg.loba || !cfg.companero) {
      detalle.push({ hole: h + 1, configurado: false });
      continue;
    }

    const pareja = [cfg.loba, cfg.companero];
    const trio = players.map((p) => p.id).filter((id) => !pareja.includes(id));

    const netosPareja = pareja
      .map((id) => golpeNeto(brutos, ventajas, id, h))
      .filter((n) => n !== null);
    const netosTrio = trio
      .map((id) => golpeNeto(brutos, ventajas, id, h))
      .filter((n) => n !== null);

    if (netosPareja.length < pareja.length || netosTrio.length < trio.length) {
      detalle.push({ hole: h + 1, configurado: true, jugado: false, pareja, trio });
      continue;
    }

    const mejorPareja = Math.min(...netosPareja);
    const mejorTrio = Math.min(...netosTrio);

    let ganador = null;
    if (mejorPareja < mejorTrio) ganador = "pareja";
    else if (mejorTrio < mejorPareja) ganador = "trio";
    // empate: no se paga nada

    const totalBote = monto * 3; // siempre 3 unidades de apuesta en juego
    if (ganador === "pareja") {
      const cadaUno = totalBote / pareja.length;
      pareja.forEach((id) => (balances[id] += cadaUno));
      trio.forEach((id) => (balances[id] -= totalBote / trio.length));
    } else if (ganador === "trio") {
      const cadaUno = totalBote / trio.length;
      trio.forEach((id) => (balances[id] += cadaUno));
      pareja.forEach((id) => (balances[id] -= totalBote / pareja.length));
    }

    detalle.push({
      hole: h + 1,
      configurado: true,
      jugado: true,
      pareja,
      trio,
      mejorPareja,
      mejorTrio,
      ganador,
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
  const ventajas = calcGolpesVentaja(players, course.strokeIndex);

  const balances = {};
  players.forEach((p) => (balances[p.id] = 0));

  // Individuales
  const individualesResults = bets.individuales.enabled
    ? bets.individuales.matches.map((m) => calcIndividual(m, scores, ventajas))
    : [];
  individualesResults.forEach((r) => {
    balances[r.a] += r.saldoA;
    balances[r.b] -= r.saldoA;
  });

  // Foursome (ventaja calculada por SUMA de hcp de cada pareja, no individual)
  const ventajasForusome = bets.foursome.enabled
    ? calcVentajasForusome(players, course.strokeIndex, bets.foursome.crosses)
    : {};
  const foursomeResults = bets.foursome.enabled
    ? bets.foursome.crosses.map((c) => calcForusomeCross(c, scores, ventajasForusome[c.id]))
    : [];
  foursomeResults.forEach((r) => {
    // saldoTotal positivo = a favor de "base" (1+2), repartido entre los 2
    const perBase = r.saldoTotal / 2;
    r.base.forEach((id) => (balances[id] += perBase));
    const perRival = -r.saldoTotal / 2;
    r.rival.forEach((id) => (balances[id] += perRival));
  });

  // Skins
  const skinsResult = bets.skins.enabled
    ? calcSkins(players, scores, ventajas, bets.skins.montoPorHoyo)
    : { porHoyo: [], totalesPorJugador: Object.fromEntries(players.map((p) => [p.id, 0])), botePendiente: 0 };
  const totalSkinsBote = Object.values(skinsResult.totalesPorJugador).reduce((a, b) => a + b, 0);
  players.forEach((p) => {
    const ganado = skinsResult.totalesPorJugador[p.id];
    // cada jugador pone su parte proporcional del bote total jugado, recibe lo que ganó
    const aportePromedio = (totalSkinsBote) / players.length;
    balances[p.id] += ganado - aportePromedio;
  });

  // Unidades (birdie, águila, hoyo en uno, sandy, oyes)
  const unidadesResult = bets.unidades.enabled
    ? calcUnidades(players, scores, course.par, state.sandies, state.oyes, bets.unidades.monto)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += unidadesResult.balances[p.id];
  });

  // Loba
  const lobaResult = bets.loba.enabled
    ? calcLoba(players, scores, ventajas, state.loba, bets.loba.monto)
    : { detalle: [], balances: Object.fromEntries(players.map((p) => [p.id, 0])) };
  players.forEach((p) => {
    balances[p.id] += lobaResult.balances[p.id];
  });

  return {
    ventajas,
    individualesResults,
    foursomeResults,
    skinsResult,
    unidadesResult,
    lobaResult,
    balances,
  };
}
