/* ============================================================
   LAS LOMAS BETS — ui.js (parte 1: helpers)
   ============================================================ */

function fmtMoney(n) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded).toLocaleString("es-MX");
  return `${sign}$${abs}`;
}

function moneyClass(n) {
  if (n > 0) return "amount-pos";
  if (n < 0) return "amount-neg";
  return "amount-zero";
}

function playerName(state, id) {
  const p = state.players.find((p) => p.id === id);
  return p ? p.name : `Jugador ${id}`;
}

function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  if (tpl.content.children.length > 1) {
    console.warn("el(): la plantilla tiene más de un elemento raíz, solo se devuelve el primero:", html.slice(0, 80));
  }
  return tpl.content.firstElementChild;
}

// holesPlayedCount() ahora vive en logic.js (la necesita también archivarRonda)

/* ============================================================
   PANTALLA: CONFIGURAR RONDA
   ============================================================ */

/* ============================================================
   PANTALLA: NUEVA RONDA (3 pasos: dónde, quién, qué se juega)
   ============================================================ */

const HCP_MODALIDADES = [
  { key: "individuales", label: "Indiv." },
  { key: "foursome", label: "Foursome" },
  { key: "skins", label: "Skins" },
  { key: "loba", label: "Loba" },
  { key: "stableford", label: "Stableford" },
];

// En qué paso va el usuario y qué escribió en el buscador. Vive aquí (no en
// el state guardado) porque solo importa mientras tiene la pantalla abierta.
let pasoNuevaRonda = 1;
let busquedaAmigo = "";
const hcpDetalleAbierto = new Set(); // ids de jugador con "por modalidad" abierto

function reiniciarPasosNuevaRonda() {
  pasoNuevaRonda = 1;
  busquedaAmigo = "";
  hcpDetalleAbierto.clear();
}

// Pone a un amigo en el primer lugar libre de la ronda, con su hándicap
// guardado. Regresa false si ya están los 5 lugares ocupados.
function elegirAmigoHoy(state, f) {
  const slotLibre = state.players.find((p) => !p.friendId);
  if (!slotLibre) return false;
  slotLibre.name = f.name;
  slotLibre.friendId = f.id;
  slotLibre.hcp = { ...f.hcp };
  // si este amigo es "tú" (⭐), este lugar pasa a ser "quién soy yo" para
  // el historial — así el historial y "cuánto le he ganado a cada quien"
  // se calculan de la persona correcta.
  if (f.esYo) state.miPlayerId = slotLibre.id;
  return true;
}

// Libera el lugar que tenía este amigo y lo regresa a placeholder.
function quitarAmigoHoy(state, friendId) {
  const slot = state.players.find((p) => p.friendId === friendId);
  if (!slot) return;
  slot.name = `Jugador ${slot.id}`;
  slot.friendId = null;
  hcpDetalleAbierto.delete(slot.id);
}

// Cambia el hándicap del jugador de hoy y lo guarda también en su amigo,
// para que la próxima ronda ya salga con el número nuevo.
function guardarHcpEnAmigo(state, p) {
  const friend = state.friends.find((f) => f.id === p.friendId);
  if (friend) friend.hcp = { ...p.hcp };
}

function fmtHcp(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function renderNuevaRondaScreen(state, onChange, irA) {
  const wrap = el(`<div class="wiz"></div>`);
  const paso = pasoNuevaRonda;

  wrap.appendChild(el(`
    <div class="wiz-steps" aria-label="Paso ${paso} de 3">
      <span class="on"></span><span class="${paso >= 2 ? "on" : ""}"></span><span class="${paso >= 3 ? "on" : ""}"></span>
    </div>
  `));

  if (paso === 1) renderPasoDonde(wrap, state, onChange);
  else if (paso === 2) renderPasoQuien(wrap, state, onChange);
  else renderPasoQue(wrap, state, onChange);

  const acciones = el(`
    <div class="wiz-actions">
      ${paso > 1 ? `<button class="btn btn-ghost" data-act="atras">Atrás</button>` : ""}
      <button class="btn btn-primary" data-act="siguiente">${paso === 3 ? "Empezar ronda" : "Siguiente"}</button>
    </div>
  `);
  const atras = acciones.querySelector('[data-act="atras"]');
  if (atras) {
    atras.addEventListener("click", () => {
      pasoNuevaRonda = paso - 1;
      irA("nueva");
    });
  }
  acciones.querySelector('[data-act="siguiente"]').addEventListener("click", () => {
    if (paso < 3) {
      pasoNuevaRonda = paso + 1;
      busquedaAmigo = "";
      irA("nueva");
      return;
    }
    // abre la tarjeta en el hoyo de salida, salvo que ya se hayan anotado
    // golpes (alguien que regresó a editar a media ronda)
    if (holesPlayedCount(state) === 0) state.round.currentHole = state.round.hoyoInicial;
    reiniciarPasosNuevaRonda();
    onChange(state, { skipRender: true });
    irA("hole");
  });
  wrap.appendChild(acciones);
  return wrap;
}

/* ---- PASO 1: cancha, salida, reparto de ventajas ---- */
function renderPasoDonde(wrap, state, onChange) {
  const course = getActiveCourse(state);
  wrap.appendChild(el(`<h1 class="wiz-title">¿Dónde juegan?</h1>`));

  wrap.appendChild(el(`<h2 class="screen-title">Cancha</h2>`));
  const canchas = el(`<div class="choice-grid"></div>`);
  state.courses.forEach((c) => {
    const btn = el(`<button class="choice-btn ${c.id === course.id ? "on" : ""}">${c.name}</button>`);
    btn.addEventListener("click", () => {
      state.round.courseId = c.id;
      onChange(state);
    });
    canchas.appendChild(btn);
  });
  const nueva = el(`<button class="choice-btn choice-btn--nueva">+ Agregar cancha</button>`);
  nueva.addEventListener("click", () => agregarCancha(state, onChange));
  canchas.appendChild(nueva);
  wrap.appendChild(canchas);
  if (!["lomas", "atlas", "canadas"].includes(course.id)) {
    wrap.appendChild(el(`<p class="help-text" style="margin-top:-10px">${course.name} tiene par y hándicap genéricos. Ajústalos en Más → Canchas.</p>`));
  }

  wrap.appendChild(el(`<h2 class="screen-title">Salen por</h2>`));
  const salida = el(`<div class="choice-grid"></div>`);
  [1, 10].forEach((h) => {
    const btn = el(`<button class="choice-btn ${state.round.hoyoInicial === h ? "on" : ""}" style="text-align:center">Hoyo ${h}</button>`);
    btn.addEventListener("click", () => {
      state.round.hoyoInicial = h;
      // saltamos directo a ese hoyo, salvo que ya se hayan anotado golpes
      // (para no mover a alguien que ya iba a la mitad de la ronda)
      if (holesPlayedCount(state) === 0) state.round.currentHole = h;
      // los bloques de 6 hoyos siguen el orden de juego, así que hay que
      // recalcularlos si cambia por dónde arrancan
      if (state.bets.foursome.formato !== "cruzado" && state.bets.foursome.participantes4.length === 4) {
        state.bets.foursome.segmentos = generarSegmentosRotacion(state.bets.foursome.participantes4, state.bets.foursome.segmentos, h, state.bets.foursome.formato === "roundRobin");
      }
      onChange(state);
    });
    salida.appendChild(btn);
  });
  wrap.appendChild(salida);

  const inv = el(`
    <button class="toggle-row">
      <span>
        <span class="toggle-row__title">Invertir ventajas</span>
        <span class="toggle-row__sub">Intercambia ventajas de 1-9 y 10-18</span>
      </span>
      <span class="switch ${state.round.invertirVentajas ? "on" : ""}"></span>
    </button>
  `);
  inv.addEventListener("click", () => {
    state.round.invertirVentajas = !state.round.invertirVentajas;
    onChange(state);
  });
  wrap.appendChild(inv);
}

function agregarCancha(state, onChange) {
  const name = prompt("Nombre de la nueva cancha:");
  if (!name || !name.trim()) return;
  const id = "c" + Date.now();
  state.courses.push({
    id,
    name: name.trim(),
    par: [...DEFAULT_PAR],
    strokeIndex: [...DEFAULT_STROKE_INDEX],
  });
  state.round.courseId = id;
  onChange(state);
}

/* ---- PASO 2: quién juega hoy y con qué hándicap ---- */
function renderPasoQuien(wrap, state, onChange) {
  wrap.appendChild(el(`<h1 class="wiz-title">¿Quién juega?</h1>`));

  const hoy = state.players.filter((p) => p.friendId);
  wrap.appendChild(el(`<h2 class="screen-title">Hoy juegan · ${hoy.length} de 5</h2>`));
  if (hoy.length === 0) {
    wrap.appendChild(el(`<p class="help-text">Toca nombres abajo para agregarlos.</p>`));
  }
  hoy.forEach((p) => {
    const friend = state.friends.find((f) => f.id === p.friendId);
    const abierto = hcpDetalleAbierto.has(p.id);
    const row = el(`
      <div class="hoy-row">
        <div class="hoy-row__main">
          <div class="hoy-row__name">
            <span>${p.name}</span>
            <button class="hoy-row__link" data-act="detalle">${abierto ? "Ocultar modalidades" : "Por modalidad"}</button>
          </div>
          <div class="stepper">
            <button class="stepper__btn" data-act="minus" aria-label="Bajar hándicap">−</button>
            <span class="stepper__value" style="width:38px;font-size:18px">${fmtHcp(p.hcp.individuales)}</span>
            <button class="stepper__btn" data-act="plus" aria-label="Subir hándicap">+</button>
          </div>
          <button class="hoy-row__quitar" data-act="quitar" aria-label="Quitar a ${p.name} de hoy">✕</button>
        </div>
        ${abierto ? `
        <div class="hcp-grid">
          ${HCP_MODALIDADES.map((m) => `
            <label>
              <span>${m.label}</span>
              <input type="number" step="0.1" value="${p.hcp[m.key]}" data-role="hcp-${p.id}-${m.key}" data-hcp-key="${m.key}" />
            </label>
          `).join("")}
        </div>` : ""}
      </div>
    `);
    // los botones ± mueven parejo las 5 modalidades (casi siempre es el
    // mismo número); el detalle por modalidad queda en "Por modalidad"
    const mover = (d) => {
      HCP_MODALIDADES.forEach((m) => {
        p.hcp[m.key] = Math.max(0, Math.round((p.hcp[m.key] + d) * 10) / 10);
      });
      guardarHcpEnAmigo(state, p);
      onChange(state);
    };
    row.querySelector('[data-act="minus"]').addEventListener("click", () => mover(-1));
    row.querySelector('[data-act="plus"]').addEventListener("click", () => mover(1));
    row.querySelector('[data-act="detalle"]').addEventListener("click", () => {
      if (abierto) hcpDetalleAbierto.delete(p.id);
      else hcpDetalleAbierto.add(p.id);
      onChange(state);
    });
    row.querySelector('[data-act="quitar"]').addEventListener("click", () => {
      if (friend) quitarAmigoHoy(state, friend.id);
      onChange(state);
    });
    row.querySelectorAll("[data-hcp-key]").forEach((input) => {
      input.addEventListener("input", (e) => {
        p.hcp[input.dataset.hcpKey] = parseFloat(e.target.value) || 0;
        guardarHcpEnAmigo(state, p);
        onChange(state, { skipRender: true });
      });
      input.addEventListener("change", () => onChange(state));
    });
    wrap.appendChild(row);
  });
  if (hoy.length > 0) {
    wrap.appendChild(el(`<p class="help-text" style="margin-top:2px">Si cambias un hándicap, se queda guardado en tu amigo.</p>`));
  }
  if (!state.friends.some((f) => f.esYo)) {
    wrap.appendChild(el(`<p class="help-text">Marca tu ⭐ en Más → Mis amigos para salir ya elegido cada ronda.</p>`));
  }

  /* --- amigos para agregar, primero los que más juegan contigo --- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:18px">Toca para agregar</h2>`));
  const buscador = el(`
    <label class="search-box">
      <span aria-hidden="true">⌕</span>
      <input type="text" placeholder="Buscar amigo" aria-label="Buscar amigo" data-role="buscar-amigo" value="${busquedaAmigo}" />
    </label>
  `);
  buscador.querySelector("input").addEventListener("input", (e) => {
    busquedaAmigo = e.target.value;
    onChange(state);
  });
  wrap.appendChild(buscador);

  const q = busquedaAmigo.trim().toLowerCase();
  const disponibles = state.friends
    .filter((f) => !state.players.some((p) => p.friendId === f.id))
    .filter((f) => !q || f.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const ra = (a.individualesHistorial || []).length;
      const rb = (b.individualesHistorial || []).length;
      return rb - ra || a.name.localeCompare(b.name);
    });
  const chips = el(`<div class="chips"></div>`);
  disponibles.forEach((f) => {
    const chip = el(`<button class="chip"><span>${f.name}</span><span class="chip__hcp">${fmtHcp(f.hcp.individuales)}</span></button>`);
    chip.addEventListener("click", () => {
      if (!elegirAmigoHoy(state, f)) {
        alert("Ya hay 5 jugadores. Quita a alguien primero.");
        return;
      }
      busquedaAmigo = "";
      onChange(state);
    });
    chips.appendChild(chip);
  });
  const nuevo = el(`<button class="chip chip--nuevo">+ Nuevo amigo</button>`);
  nuevo.addEventListener("click", () => {
    const name = prompt("Nombre del amigo:", busquedaAmigo.trim());
    if (!name || !name.trim()) return;
    const f = defaultFriend("f" + Date.now(), name.trim());
    state.friends.push(f);
    elegirAmigoHoy(state, f);
    busquedaAmigo = "";
    onChange(state);
  });
  chips.appendChild(nuevo);
  wrap.appendChild(chips);
  if (q && disponibles.length === 0) {
    wrap.appendChild(el(`<p class="help-text" style="margin-top:8px">Nadie con ese nombre.</p>`));
  }
}

/* ---- PASO 3: qué se juega y cuánto (sale como la ronda anterior) ---- */
function renderPasoQue(wrap, state, onChange) {
  wrap.appendChild(el(`<h1 class="wiz-title">¿Qué se juega?</h1>`));
  wrap.appendChild(el(`<p class="wiz-sub">Como la última vez. Cambia solo lo distinto.</p>`));

  const fs = state.bets.foursome;
  const esCruzado = fs.formato === "cruzado";
  const cruces = fs.crosses;
  const segs = fs.segmentos;

  // cada monto: valor actual + cómo se guarda. Foursome escribe el mismo
  // monto en sus 3 cruces (o segmentos); el detalle por cruce sigue en Apuestas.
  const filas = [
    { key: "individuales", label: "Individuales", nota: "Los partidos se arman en Apuestas", montos: [] },
    {
      key: "foursome",
      label: "Foursome",
      nota: esCruzado ? "Ida / vuelta, los 3 cruces" : fs.formato === "normal" ? "Ida / vuelta" : "Por hoyo, los 3 bloques",
      montos: esCruzado
        ? [
            { valor: cruces[0].montoIda, guardar: (v) => cruces.forEach((c) => (c.montoIda = v)), etiqueta: "ida" },
            { valor: cruces[0].montoVuelta, guardar: (v) => cruces.forEach((c) => (c.montoVuelta = v)), etiqueta: "vuelta" },
          ]
        : fs.formato === "normal"
        ? [
            { valor: segs[0] ? segs[0].montoIda : 0, guardar: (v) => segs.forEach((s) => (s.montoIda = v)), etiqueta: "ida" },
            { valor: segs[0] ? segs[0].montoVuelta : 0, guardar: (v) => segs.forEach((s) => (s.montoVuelta = v)), etiqueta: "vuelta" },
          ]
        : [{ valor: segs[0] ? segs[0].monto : 0, guardar: (v) => segs.forEach((s) => (s.monto = v)), etiqueta: "por hoyo" }],
    },
    { key: "skins", label: "Skins", nota: "Por hoyo", montos: [{ valor: state.bets.skins.montoPorHoyo, guardar: (v) => (state.bets.skins.montoPorHoyo = v), etiqueta: "por hoyo" }] },
    {
      key: "stableford",
      label: "Stableford",
      nota: "Ida · vuelta · total",
      montos: [
        { valor: state.bets.stableford.montoIda, guardar: (v) => (state.bets.stableford.montoIda = v), etiqueta: "ida" },
        { valor: state.bets.stableford.montoVuelta, guardar: (v) => (state.bets.stableford.montoVuelta = v), etiqueta: "vuelta" },
        { valor: state.bets.stableford.montoTotal, guardar: (v) => (state.bets.stableford.montoTotal = v), etiqueta: "total" },
      ],
    },
    { key: "loba", label: "Loba", nota: "Base por jugador", montos: [{ valor: state.bets.loba.monto, guardar: (v) => (state.bets.loba.monto = v), etiqueta: "base" }] },
    { key: "banderas", label: "Banderas", nota: "Por bandera", montos: [{ valor: state.bets.banderas.monto, guardar: (v) => (state.bets.banderas.monto = v), etiqueta: "por bandera" }] },
    { key: "threePutt", label: "3-putt", nota: "A cada uno", montos: [{ valor: state.bets.threePutt.monto, guardar: (v) => (state.bets.threePutt.monto = v), etiqueta: "monto" }] },
    { key: "chupes", label: "Chupes", nota: "A cada uno", montos: [{ valor: state.bets.chupes.monto, guardar: (v) => (state.bets.chupes.monto = v), etiqueta: "monto" }] },
  ];

  const lista = el(`<div class="bet-list"></div>`);
  filas.forEach((f) => {
    const on = state.bets[f.key].enabled;
    const row = el(`
      <div class="bet-row ${on ? "" : "off"}">
        <button class="switch ${on ? "on" : ""}" data-act="toggle" aria-label="${on ? "Apagar" : "Prender"} ${f.label}"></button>
        <div class="bet-row__info">
          <span class="bet-row__name">${f.label}</span>
          <span class="bet-row__nota">${f.nota}</span>
        </div>
        <div class="bet-row__montos ${f.montos.length === 3 ? "bet-row__montos--3" : ""}">
          ${f.montos.map((m, i) => `<input type="number" inputmode="decimal" value="${m.valor}" data-role="monto-${f.key}-${i}" aria-label="${f.label} ${m.etiqueta}" />`).join("")}
        </div>
      </div>
    `);
    row.querySelector('[data-act="toggle"]').addEventListener("click", () => {
      state.bets[f.key].enabled = !on;
      onChange(state);
    });
    f.montos.forEach((m, i) => {
      const input = row.querySelector(`[data-role="monto-${f.key}-${i}"]`);
      input.addEventListener("input", (e) => {
        m.guardar(parseFloat(e.target.value) || 0);
        onChange(state, { skipRender: true });
      });
      input.addEventListener("change", () => onChange(state));
    });
    lista.appendChild(row);
  });
  wrap.appendChild(lista);
  wrap.appendChild(el(`<p class="help-text" style="margin-top:10px">Formato de foursome, parejas y quién entra a cada apuesta: en Apuestas.</p>`));
}


function renderConfigScreen(state, onChange, irA) {
  const wrap = el(`<div></div>`);
  const course = getActiveCourse(state);

  /* ---- RONDA DE HOY (cancha, jugadores y apuestas viven en "Nueva ronda") ---- */
  const nJugadores = state.players.filter((p) => p.friendId).length;
  const nApuestas = Object.values(state.bets).filter((b) => b.enabled).length;
  wrap.appendChild(el(`<h2 class="screen-title">Ronda de hoy</h2>`));
  const rondaCard = el(`
    <div class="card">
      <p style="margin:0 0 10px">${course.name} · salida por el ${state.round.hoyoInicial} · ${nJugadores} jugadores · ${nApuestas} apuestas</p>
      <button class="btn btn-ghost btn-small" data-act="editar-ronda" style="width:100%">Editar ronda de hoy</button>
    </div>
  `);
  rondaCard.querySelector('[data-act="editar-ronda"]').addEventListener("click", () => {
    reiniciarPasosNuevaRonda();
    irA("nueva");
  });
  wrap.appendChild(rondaCard);

  /* ---- RESPALDO (exportar/importar todo lo guardado) ---- */
  const rondasSinRespaldo = state.roundsHistory.length - (state.respaldo.rondas || 0);
  const hazExportar = () => {
    const fecha = new Date().toISOString().slice(0, 10);
    const filename = `las-lomas-bets-respaldo-${fecha}.json`;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/json" })] })) {
      navigator.share({ files: [new File([blob], filename, { type: "application/json" })], title: "Respaldo Las Lomas Bets" }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    // marcamos el respaldo como hecho AHORA, con las rondas que tenías en
    // ese momento — así dejamos de avisar hasta que se acumulen otras 5
    state.respaldo = { fecha: new Date().toISOString(), rondas: state.roundsHistory.length };
    onChange(state);
  };
  if (rondasSinRespaldo >= 5) {
    const avisoRespaldo = el(`
      <div class="card" style="border:1px solid var(--terracota);margin-bottom:10px">
        <p style="margin:0 0 8px;font-weight:600">Llevas ${rondasSinRespaldo} rondas sin exportar un respaldo</p>
        <p class="help-text" style="margin:0 0 10px">Exporta un respaldo para no perderlo.</p>
        <button data-role="exportar-aviso" class="btn btn-primary btn-small" style="width:100%">Exportar respaldo ahora</button>
      </div>
    `);
    avisoRespaldo.querySelector('[data-role="exportar-aviso"]').addEventListener("click", hazExportar);
    wrap.appendChild(avisoRespaldo);
  }
  /* ---- MIS AMIGOS (lista permanente + biblia) ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Mis amigos</h2>`));

  const friendsCard = el(`<div class="card"></div>`);
  if (state.friends.length === 0) {
    friendsCard.appendChild(el(`<p class="help-text" style="margin:0">Todavía no agregas amigos.</p>`));
  } else {
    state.friends
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => {
        const row = el(`
          <div style="margin-bottom:10px">
            <div class="field-row" style="align-items:center;gap:8px">
              <button class="btn btn-small" data-act="marcar-yo" style="flex-shrink:0;padding:8px 9px;${f.esYo ? "background:var(--dorado);color:var(--verde-campo-oscuro)" : "background:rgba(0,0,0,0.2)"}">${f.esYo ? "⭐ Yo" : "☆"}</button>
              <input type="text" value="${f.name}" data-role="friend-name" style="flex:1;min-width:0;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:8px;padding:8px 10px;color:var(--crema)" />
              <div class="stepper" style="flex-shrink:0">
                <button class="stepper__btn" data-act="biblia-minus">−</button>
                <span class="stepper__value" data-role="biblia-value" style="min-width:30px;text-align:center">${f.biblia > 0 ? "+" + f.biblia : f.biblia}</span>
                <button class="stepper__btn" data-act="biblia-plus">+</button>
              </div>
              <button class="btn btn-ghost btn-small" data-act="delete-friend" style="padding:8px 10px;flex-shrink:0">✕</button>
            </div>
            <p class="help-text" style="margin:4px 0 0">Individuales histórico: <span class="${moneyClass(f.individualesTotal)}">${fmtMoney(f.individualesTotal)}</span></p>
          </div>
        `);
        row.querySelector('[data-act="marcar-yo"]').addEventListener("click", () => {
          const yaEraYo = f.esYo;
          state.friends.forEach((x) => (x.esYo = false));
          f.esYo = !yaEraYo;
          onChange(state);
        });
        row.querySelector('[data-role="friend-name"]').addEventListener("input", (e) => {
          f.name = e.target.value;
          onChange(state, { skipRender: true });
        });
        row.querySelector('[data-act="biblia-minus"]').addEventListener("click", () => {
          f.biblia -= 1;
          onChange(state);
        });
        row.querySelector('[data-act="biblia-plus"]').addEventListener("click", () => {
          f.biblia += 1;
          onChange(state);
        });
        row.querySelector('[data-act="delete-friend"]').addEventListener("click", () => {
          if (!confirm(`¿Borrar a ${f.name} de tu lista de amigos?`)) return;
          state.friends = state.friends.filter((x) => x.id !== f.id);
          onChange(state);
        });
        friendsCard.appendChild(row);
      });
  }
  wrap.appendChild(friendsCard);
  const addFriendBtn = el(`<button class="btn btn-ghost btn-small" data-role="add-friend" style="width:100%;margin-top:8px">+ Agregar amigo</button>`);
  addFriendBtn.addEventListener("click", () => {
    const name = prompt("Nombre del amigo:");
    if (!name || !name.trim()) return;
    state.friends.push(defaultFriend("f" + Date.now(), name.trim()));
    onChange(state);
  });
  wrap.appendChild(addFriendBtn);

  /* ---- CANCHAS: par y hándicap por hoyo de la cancha de hoy ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Canchas</h2>`));
  const esDatoReal = ["lomas", "atlas", "canadas"].includes(course.id);
  const avisoTexto = esDatoReal
    ? `${course.name} ya tiene par y hándicap por hoyo 100% reales, de la tarjeta oficial del club.`
    : `⚠️ Par y hándicap genéricos. Ajústalos abajo.`;
  if (!esDatoReal) wrap.appendChild(el(`<p class="help-text">${avisoTexto}</p>`));

  const addCourseBtn = el(`<button class="btn btn-ghost btn-small" style="width:100%;margin-bottom:8px">+ Agregar cancha nueva</button>`);
  addCourseBtn.addEventListener("click", () => agregarCancha(state, onChange));
  wrap.appendChild(addCourseBtn);

  /* ---- PAR Y STROKE INDEX DE LA CANCHA ACTIVA ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Par — ${course.name}</h2>`));
  const parCard = el(`<div class="card"></div>`);
  const parGrid = el(`<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px"></div>`);
  for (let h = 0; h < 18; h++) {
    const cell = el(`
      <div style="text-align:center">
        <div style="font-size:10px;opacity:0.5;margin-bottom:3px">H${h + 1}</div>
        <input type="number" value="${course.par[h]}" data-hole="${h}"
          style="width:100%;text-align:center;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:8px;padding:8px 2px;color:var(--crema);font-family:var(--font-mono);font-size:13px" />
      </div>
    `);
    cell.querySelector("input").addEventListener("input", (e) => {
      course.par[h] = parseInt(e.target.value) || 4;
      onChange(state, { skipRender: true });
    });
    parGrid.appendChild(cell);
  }
  parCard.appendChild(parGrid);
  wrap.appendChild(parCard);

  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Hándicap por hoyo (1=más difícil) — ${course.name}</h2>`));
  const siCard = el(`<div class="card"></div>`);
  const siGrid = el(`<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px"></div>`);
  for (let h = 0; h < 18; h++) {
    const cell = el(`
      <div style="text-align:center">
        <div style="font-size:10px;opacity:0.5;margin-bottom:3px">H${h + 1}</div>
        <input type="number" value="${course.strokeIndex[h]}" data-hole="${h}"
          style="width:100%;text-align:center;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:8px;padding:8px 2px;color:var(--crema);font-family:var(--font-mono);font-size:13px" />
      </div>
    `);
    cell.querySelector("input").addEventListener("input", (e) => {
      course.strokeIndex[h] = parseInt(e.target.value) || 1;
      onChange(state, { skipRender: true });
    });
    siGrid.appendChild(cell);
  }
  siCard.appendChild(siGrid);
  wrap.appendChild(siCard);

  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Respaldo</h2>`));
  const respaldoCard = el(`
    <div class="card">
      <p class="help-text" style="margin-top:0">Tus datos viven solo en este teléfono. Exporta un respaldo seguido.</p>
      <button class="btn btn-ghost btn-small" data-role="exportar" style="width:100%;margin-bottom:8px">Exportar respaldo</button>
      <button class="btn btn-ghost btn-small" data-role="importar" style="width:100%">Restaurar desde un respaldo</button>
      <input type="file" accept="application/json,.json" data-role="import-file" style="display:none" />
    </div>
  `);
  respaldoCard.querySelector('[data-role="exportar"]').addEventListener("click", hazExportar);
  const importInput = respaldoCard.querySelector('[data-role="import-file"]');
  respaldoCard.querySelector('[data-role="importar"]').addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let parsed;
      try {
        parsed = JSON.parse(ev.target.result);
      } catch (err) {
        alert("No se pudo leer el archivo. Asegúrate de que sea un respaldo exportado desde esta misma app.");
        return;
      }
      if (!parsed || !Array.isArray(parsed.players) || !parsed.bets) {
        alert("Este archivo no parece un respaldo válido de Las Lomas Bets.");
        return;
      }
      const ok = confirm("Esto va a REEMPLAZAR todo lo que tienes ahorita en la app (jugadores, hándicaps, montos, historial, amigos) con lo que traiga este respaldo. ¿Continuar?");
      if (!ok) {
        importInput.value = "";
        return;
      }
      const migrado = migrateState(parsed);
      onChange(migrado);
    };
    reader.readAsText(file);
  });
  wrap.appendChild(respaldoCard);

  return wrap;
}

/* ============================================================
   PANTALLA: TARJETA DE HOYO
   ============================================================ */

const NOMBRES_VS_PAR = { "-3": "Albatros", "-2": "Águila", "-1": "Birdie", "0": "Par", "1": "Bogey", "2": "Doble", "3": "Triple" };

function nombreVsPar(golpes, par) {
  if (golpes === 1) return "H en 1";
  const diff = golpes - par;
  return NOMBRES_VS_PAR[diff] || `+${diff}`;
}

function claseVsPar(golpes, par) {
  const diff = golpes - par;
  if (diff < 0) return "under";
  if (diff === 0) return "even";
  return "over";
}

// Fila de botones grandes para el golpe del hoyo: de águila a doble bogey,
// con chips chicos a los lados para lo que se sale de ese rango.
function scoreChipsHtml(bruto, par) {
  const desde = Math.max(1, par - 2);
  const hasta = par + 2;
  const chip = (valor, extraClase) => {
    const activo = bruto === valor;
    return `
      <button class="score-chip score-chip--${claseVsPar(valor, par)} ${activo ? "active" : ""} ${extraClase || ""}" data-score="${valor}">
        <span class="score-chip__num">${valor}</span>
        <span class="score-chip__label">${nombreVsPar(valor, par)}</span>
      </button>`;
  };
  const partes = [];
  if (par - 3 >= 1) {
    const fuera = bruto !== null && bruto < desde;
    partes.push(`
      <button class="score-chip score-chip--side score-chip--under ${fuera ? "active" : ""}" data-score="menos" aria-label="Menos golpes">
        <span class="score-chip__num">${fuera ? bruto : "−"}</span>
        ${fuera ? `<span class="score-chip__label">${nombreVsPar(bruto, par)}</span>` : ""}
      </button>`);
  }
  for (let v = desde; v <= hasta; v++) partes.push(chip(v));
  const fueraArriba = bruto !== null && bruto > hasta;
  partes.push(`
    <button class="score-chip score-chip--side score-chip--over ${fueraArriba ? "active" : ""}" data-score="mas" aria-label="Más golpes">
      <span class="score-chip__num">${fueraArriba ? bruto : "+"}</span>
      ${fueraArriba ? `<span class="score-chip__label">${nombreVsPar(bruto, par)}</span>` : ""}
    </button>`);
  return `<div class="score-chips">${partes.join("")}</div>`;
}

/* ---- AVANCE AUTOMÁTICO DE HOYO ---- */

// Lo que además de los golpes hace falta capturar en el hoyo antes de
// poder pasar solos al siguiente (si no, se quedaría sin marcar).
function pendientesDelHoyo(state, h) {
  const course = getActiveCourse(state);
  const pendientes = [];
  const usaOyes =
    (state.bets.individuales.enabled && state.bets.individuales.matches.length > 0) ||
    state.bets.foursome.enabled ||
    state.bets.skins.enabled ||
    state.bets.loba.enabled;
  if (course.par[h] === 3 && usaOyes && Object.keys(state.oyesOrden[h] || {}).length === 0) {
    pendientes.push("Oyes");
  }
  if (state.bets.loba.enabled) {
    const cfg = state.loba[h];
    if (!cfg || cfg.loba === null || cfg.companero === null) pendientes.push("Loba");
  }
  return pendientes;
}

function hoyoCompleto(state, h) {
  return state.players.every((p) => state.scores[p.id][h] !== null) && pendientesDelHoyo(state, h).length === 0;
}

let avanceTimer = null;
let avanceToast = null;

function cancelarAvance() {
  if (avanceTimer) clearTimeout(avanceTimer);
  avanceTimer = null;
  if (avanceToast) avanceToast.remove();
  avanceToast = null;
}

// Aplica un cambio del hoyo y, si con él el hoyo quedó completo (antes no
// lo estaba), programa el paso al siguiente hoyo en orden de juego. Se
// muestra un aviso con "Quedarme" por si todavía falta algo (unidad,
// banderas, etc.).
function registrarCambioDeHoyo(state, h, onChange, aplicar) {
  const estabaCompleto = hoyoCompleto(state, h);
  aplicar();
  const quedoCompleto = hoyoCompleto(state, h);
  if (!quedoCompleto) cancelarAvance();
  onChange(state);
  if (!quedoCompleto) return;
  // si ya estaba completo, solo reiniciamos el aviso cuando sigue corriendo
  // (ej. marcando el 2º y 3º del oyes): así no se cambia de hoyo a media
  // captura, pero editar un hoyo viejo no te mueve.
  if (estabaCompleto && !avanceTimer) return;

  const orden = ordenDeJuego(state.round.hoyoInicial);
  const pos = orden.indexOf(h);
  if (pos === orden.length - 1) return; // último hoyo de la ronda
  const siguiente = orden[pos + 1];

  cancelarAvance();
  avanceToast = el(`
    <div class="advance-toast" role="status">
      <span>Hoyo ${h + 1} completo · pasando al <b>${siguiente + 1}</b></span>
      <button data-act="quedarme">Quedarme</button>
      <div class="advance-toast__bar"></div>
    </div>
  `);
  avanceToast.querySelector('[data-act="quedarme"]').addEventListener("click", cancelarAvance);
  document.body.appendChild(avanceToast);
  avanceTimer = setTimeout(() => {
    cancelarAvance();
    // si mientras tanto se cambiaron de hoyo a mano o el hoyo dejó de
    // estar completo, no hacemos nada
    if (state.round.currentHole !== h + 1 || !hoyoCompleto(state, h)) return;
    state.round.currentHole = siguiente + 1;
    onChange(state);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 1600);
}

function renderHoleScreen(state, onChange) {
  const wrap = el(`<div></div>`);
  const h = state.round.currentHole - 1; // índice 0-based
  const course = getActiveCourse(state);
  const par = course.par[h];
  const si = course.strokeIndex[h];
  const isPar3 = par === 3;
  const siEfectivo = strokeIndexEfectivo(course.strokeIndex, state.round.invertirVentajas);

  // Navegación de hoyo. Si la ronda arranca en el 10, la navegación da la
  // vuelta (del 18 pasa al 1 y del 1 regresa al 18), para poder seguir el
  // orden real de juego sin quedarse atorado en los extremos.
  const arrancaEn10 = state.round.hoyoInicial === 10;
  const nav = el(`
    <div class="hole-nav">
      <button class="hole-nav__btn" data-act="prev" ${!arrancaEn10 && h === 0 ? "disabled" : ""}>‹</button>
      <div class="hole-flag">
        <div class="hole-flag__number-row">
          <span class="hole-flag__label">Hoyo</span>
          <span class="hole-flag__number">${h + 1}</span>
        </div>
        <div class="hole-flag__meta">
          <span>Par <b>${par}</b></span>
          <span>Hcp hoyo <b>${si}</b></span>
        </div>
      </div>
      <button class="hole-nav__btn" data-act="next" ${!arrancaEn10 && h === 17 ? "disabled" : ""}>›</button>
    </div>
  `);
  nav.querySelector('[data-act="prev"]').addEventListener("click", () => {
    cancelarAvance();
    if (h > 0) {
      state.round.currentHole -= 1;
      onChange(state);
    } else if (arrancaEn10) {
      state.round.currentHole = 18;
      onChange(state);
    }
  });
  nav.querySelector('[data-act="next"]').addEventListener("click", () => {
    cancelarAvance();
    if (h < 17) {
      state.round.currentHole += 1;
      onChange(state);
    } else if (arrancaEn10) {
      state.round.currentHole = 1;
      onChange(state);
    }
  });
  wrap.appendChild(nav);

  // Barra de progreso de 18 hoyos
  const progress = el(`<div class="hole-progress"></div>`);
  for (let i = 0; i < 18; i++) {
    const played = state.players.some((p) => state.scores[p.id][i] !== null);
    const dot = el(`<div class="hole-progress__dot"></div>`);
    if (i === h) dot.classList.add("current");
    else if (played) dot.classList.add("played");
    dot.addEventListener("click", () => {
      cancelarAvance();
      state.round.currentHole = i + 1;
      onChange(state);
    });
    progress.appendChild(dot);
  }
  wrap.appendChild(progress);

  // Ventaja en este hoyo: quién recibe golpe, modalidad por modalidad
  // (cada una puede llevar hándicaps distintos, así que la ventaja no es
  // necesariamente la misma persona en todas). Se guarda por jugador para
  // pintarla como badge directo en su fila, en vez de una tarjeta aparte.
  const ventajasPorJugador = {};
  state.players.forEach((p) => (ventajasPorJugador[p.id] = []));
  function agregarVentaja(playerId, texto) {
    if (!ventajasPorJugador[playerId]) ventajasPorJugador[playerId] = [];
    ventajasPorJugador[playerId].push(texto);
  }

  if (state.bets.individuales.enabled) {
    const vInd = calcGolpesVentaja(state.players, siEfectivo, "individuales");
    state.players.forEach((p) => {
      if (vInd[p.id][h] > 0) agregarVentaja(p.id, `Ind${vInd[p.id][h] > 1 ? ` +${vInd[p.id][h]}` : ""}`);
    });
    // partidos con ventaja manual (biblia) pueden diferir del hándicap
    // automático de arriba — se marcan aparte para no confundir.
    state.bets.individuales.matches.forEach((m) => {
      if (!m.ventajaManual || !m.ventajaManual.jugador || !m.ventajaManual.golpes) return;
      const golpesManual = repartirGolpesPorDificultad(m.ventajaManual.golpes, siEfectivo);
      if (golpesManual[h] > 0) {
        const rivalId = m.ventajaManual.jugador === m.a ? m.b : m.a;
        agregarVentaja(m.ventajaManual.jugador, `Ind vs ${playerName(state, rivalId)}${golpesManual[h] > 1 ? ` +${golpesManual[h]}` : ""}`);
      }
    });
  }

  if (state.bets.foursome.enabled) {
    const formatoF = state.bets.foursome.formato || "cruzado";
    if (formatoF === "cruzado") {
      const vFs = calcVentajasForusome(state.players, siEfectivo, state.bets.foursome.crosses);
      state.bets.foursome.crosses.forEach((cross) => {
        const receptor = [...cross.base, ...cross.rival].find((id) => (vFs[cross.id][id] || [])[h] > 0);
        if (receptor) {
          const golpes = vFs[cross.id][receptor][h];
          agregarVentaja(receptor, `Fs${golpes > 1 ? ` +${golpes}` : ""}`);
        }
      });
    } else if (state.bets.foursome.participantes4.length === 4) {
      const jugadores4 = state.players.filter((p) => state.bets.foursome.participantes4.includes(p.id));
      const segmentosActivos = formatoF === "normal" ? state.bets.foursome.segmentos.slice(0, 1) : state.bets.foursome.segmentos;
      const segmentoDeEsteHoyo = segmentosActivos.find((seg) => seg.hoyos.includes(h));
      if (segmentoDeEsteHoyo) {
        const vFs = calcVentajasForusome(jugadores4, siEfectivo, [segmentoDeEsteHoyo]);
        const receptor = [...segmentoDeEsteHoyo.base, ...segmentoDeEsteHoyo.rival].find((id) => (vFs[segmentoDeEsteHoyo.id][id] || [])[h] > 0);
        if (receptor) {
          const golpes = vFs[segmentoDeEsteHoyo.id][receptor][h];
          agregarVentaja(receptor, `Fs${golpes > 1 ? ` +${golpes}` : ""}`);
        }
      }
    }
  }

  if (state.bets.skins.enabled) {
    const jugadoresSkins = state.players.filter((p) => state.bets.skins.participantes.includes(p.id));
    const vSkins = calcGolpesVentaja(jugadoresSkins, siEfectivo, "skins");
    jugadoresSkins.forEach((p) => {
      if (vSkins[p.id][h] > 0) agregarVentaja(p.id, `Sk${vSkins[p.id][h] > 1 ? ` +${vSkins[p.id][h]}` : ""}`);
    });
  }

  if (state.bets.loba.enabled) {
    const vLoba = calcGolpesVentaja(state.players, siEfectivo, "loba");
    state.players.forEach((p) => {
      if (vLoba[p.id][h] > 0) agregarVentaja(p.id, `Loba${vLoba[p.id][h] > 1 ? ` +${vLoba[p.id][h]}` : ""}`);
    });
  }

  if (state.bets.stableford.enabled) {
    const jugadoresSf = state.players.filter((p) => state.bets.stableford.participantes.includes(p.id));
    const vSf = calcGolpesVentaja(jugadoresSf, siEfectivo, "stableford");
    jugadoresSf.forEach((p) => {
      if (vSf[p.id][h] > 0) agregarVentaja(p.id, `SF${vSf[p.id][h] > 1 ? ` +${vSf[p.id][h]}` : ""}`);
    });
  }

  // (la ventaja ya no se muestra en una tarjeta aparte: se pinta como
  // badge directo junto al nombre de cada jugador en su fila, más abajo)

  // Fila por jugador
  state.players.forEach((p) => {
    const bruto = state.scores[p.id][h];
    const isMetida = state.metidas[p.id][h];
    // ganó el oyes de este hoyo (quedó en posición 1 = más cerca de la
    // bandera) según el orden de cercanía compartido. Se usa solo para
    // mostrar el badge de "Oyes" en su fila.
    const isOyes = (state.oyesOrden[h] || {})[p.id] === 1;
    const banderasCfg = state.banderas[p.id][h];

    // Banderas, chupes y 3-putt van juntos en una sola fila compacta debajo
    // de los golpes, para que la tarjeta de cada jugador no crezca tanto.
    const extras = [];
    if (state.bets.banderas.enabled && state.bets.banderas.participantes.includes(p.id)) {
      extras.push(`
          <div class="stepper stepper--compact">
            <button class="stepper__btn" data-act="banderas-minus">−</button>
            <span class="stepper__value ${banderasCfg.banderas === 0 ? "empty" : ""}" data-role="banderas-value">🚩${banderasCfg.banderas}</span>
            <button class="stepper__btn" data-act="banderas-plus">+</button>
          </div>`);
    }
    if (state.bets.chupes.enabled && state.bets.chupes.participantes.includes(p.id)) {
      extras.push(`
          <div class="stepper stepper--compact">
            <button class="stepper__btn" data-act="chupes-minus">−</button>
            <span class="stepper__value ${banderasCfg.chupes === 0 ? "empty" : ""}" data-role="chupes-value">🥤${banderasCfg.chupes}</span>
            <button class="stepper__btn" data-act="chupes-plus">+</button>
          </div>`);
    }
    if (state.bets.threePutt.enabled && state.bets.threePutt.participantes.includes(p.id)) {
      extras.push(`<button class="event-toggle ${banderasCfg.threePutt ? "active" : ""}" data-act="threeputt">3-putt</button>`);
    }
    const extrasHtml = extras.join("");

    const row = el(`
      <div class="player-row">
        <div class="player-row__top">
          <span class="player-row__name">${p.name}</span>
          ${(ventajasPorJugador[p.id] || []).map((v) => `<span class="ventaja-badge">${v}</span>`).join("")}
          <div class="event-toggles">
            <button class="event-toggle ${isMetida ? "active" : ""}" data-act="metida">Unidad</button>
          </div>
        </div>
        ${scoreChipsHtml(bruto, par)}
        ${extrasHtml ? `<div class="player-row__extras">${extrasHtml}</div>` : ""}
      </div>
    `);

    function currentBruto() {
      return state.scores[p.id][h];
    }

    // Botones de golpe relativos al par. Tocar el que ya está marcado lo
    // borra (para corregir un toque equivocado). Los chips "−"/"+" de las
    // orillas cubren resultados raros (albatros, triple bogey o peor).
    row.querySelectorAll("[data-score]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cur = currentBruto();
        const tipo = btn.dataset.score;
        let next;
        if (tipo === "menos") next = Math.max(1, cur !== null && cur < par - 2 ? cur - 1 : par - 3);
        else if (tipo === "mas") next = cur !== null && cur > par + 2 ? cur + 1 : par + 3;
        else {
          const valor = parseInt(tipo);
          next = cur === valor ? null : valor;
        }
        registrarCambioDeHoyo(state, h, onChange, () => {
          state.scores[p.id][h] = next;
        });
      });
    });
    row.querySelector('[data-act="metida"]').addEventListener("click", () => {
      state.metidas[p.id][h] = !state.metidas[p.id][h];
      onChange(state);
    });
    const banderasMinusBtn = row.querySelector('[data-act="banderas-minus"]');
    if (banderasMinusBtn) {
      banderasMinusBtn.addEventListener("click", () => {
        banderasCfg.banderas = Math.max(0, banderasCfg.banderas - 1);
        onChange(state);
      });
    }
    const banderasPlusBtn = row.querySelector('[data-act="banderas-plus"]');
    if (banderasPlusBtn) {
      banderasPlusBtn.addEventListener("click", () => {
        banderasCfg.banderas += 1;
        onChange(state);
      });
    }
    const threePuttBtn = row.querySelector('[data-act="threeputt"]');
    if (threePuttBtn) {
      threePuttBtn.addEventListener("click", () => {
        banderasCfg.threePutt = !banderasCfg.threePutt;
        onChange(state);
      });
    }
    const chupesMinusBtn = row.querySelector('[data-act="chupes-minus"]');
    if (chupesMinusBtn) {
      chupesMinusBtn.addEventListener("click", () => {
        banderasCfg.chupes = Math.max(0, banderasCfg.chupes - 1);
        onChange(state);
      });
    }
    const chupesPlusBtn = row.querySelector('[data-act="chupes-plus"]');
    if (chupesPlusBtn) {
      chupesPlusBtn.addEventListener("click", () => {
        banderasCfg.chupes += 1;
        onChange(state);
      });
    }

    // Badges de eventos detectados automáticamente
    if (bruto !== null) {
      const eventos = detectarEventos(bruto, par, false, isOyes, isMetida);
      if (eventos.length > 0) {
        const badges = el(`<div class="event-badges"></div>`);
        eventos.forEach((ev) => {
          badges.appendChild(el(`<span class="event-badge">${ev}</span>`));
        });
        row.appendChild(badges);
      }
    }

    wrap.appendChild(row);
  });

  // Si ya están todos los golpes pero falta algo del hoyo (oyes / loba),
  // avisamos aquí: el avance automático espera a que se complete.
  const pendientes = pendientesDelHoyo(state, h);
  if (pendientes.length > 0 && state.players.every((p) => state.scores[p.id][h] !== null)) {
    wrap.appendChild(el(`<p class="hole-pending">Falta marcar ${pendientes.join(" y ")} para pasar al siguiente hoyo ↓</p>`));
  }

  // Oyes: UNA sola marca por hoyo par 3 (orden de cercanía a la bandera).
  // Todas las modalidades que usan oyes (individuales, foursome, rotación,
  // skins, loba) derivan solas quién gana comparando estas posiciones —
  // ya no hay que marcarlo modalidad por modalidad.
  const usaOyesAlgunaModalidad =
    (state.bets.individuales.enabled && state.bets.individuales.matches.length > 0) ||
    state.bets.foursome.enabled ||
    state.bets.skins.enabled ||
    state.bets.loba.enabled;

  if (isPar3 && usaOyesAlgunaModalidad) {
    wrap.appendChild(el(`<p class="section-divider" style="font-size:15px">Oyes — orden de cercanía a la bandera</p>`));
    // Se toca a los jugadores en orden de cercanía: el primero queda 1º, el
    // siguiente 2º, etc. Tocar a alguien ya marcado lo quita y los de atrás
    // suben un lugar. "Nadie" deja constancia de que nadie quedó en green
    // (sin ganador), para que el hoyo no se quede esperando el oyes.
    if (!state.oyesOrden[h]) state.oyesOrden[h] = {};
    const ordenHoyo = state.oyesOrden[h];
    const nadie = ordenHoyo.nadie === true;
    const oyesCard = el(`
      <div class="card oyes-card">
        <p class="help-text" style="margin:0 0 10px">Más cerca primero.</p>
        <div class="oyes-picks">
          ${state.players.map((p) => {
            const pos = ordenHoyo[p.id];
            return `
              <button class="oyes-pick ${pos ? "active" : ""} ${pos === 1 ? "first" : ""}" data-oyes-player="${p.id}">
                <span class="oyes-pick__pos">${pos ? `${pos}º` : ""}</span>
                <span class="oyes-pick__name">${p.name}</span>
              </button>`;
          }).join("")}
        </div>
        <div class="oyes-actions">
          <button class="event-toggle ${nadie ? "active" : ""}" data-act="oyes-nadie">Nadie en green</button>
          <button class="event-toggle" data-act="oyes-reset">Volver a escoger</button>
        </div>
      </div>
    `);
    oyesCard.querySelectorAll("[data-oyes-player]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.oyesPlayer);
        registrarCambioDeHoyo(state, h, onChange, () => {
          delete ordenHoyo.nadie;
          const pos = ordenHoyo[id];
          if (pos) {
            delete ordenHoyo[id];
            Object.keys(ordenHoyo).forEach((otroId) => {
              if (ordenHoyo[otroId] > pos) ordenHoyo[otroId] -= 1;
            });
          } else {
            const ocupadas = Object.keys(ordenHoyo).filter((k) => typeof ordenHoyo[k] === "number").length;
            ordenHoyo[id] = ocupadas + 1;
          }
        });
      });
    });
    oyesCard.querySelector('[data-act="oyes-nadie"]').addEventListener("click", () => {
      registrarCambioDeHoyo(state, h, onChange, () => {
        Object.keys(ordenHoyo).forEach((k) => delete ordenHoyo[k]);
        if (!nadie) ordenHoyo.nadie = true;
      });
    });
    oyesCard.querySelector('[data-act="oyes-reset"]').addEventListener("click", () => {
      registrarCambioDeHoyo(state, h, onChange, () => {
        Object.keys(ordenHoyo).forEach((k) => delete ordenHoyo[k]);
      });
    });
    wrap.appendChild(oyesCard);
  }

  // Loba: marcar manualmente quién es loba y su compañero en este hoyo
  if (state.bets.loba.enabled) {
    wrap.appendChild(el(`<p class="section-divider">Loba de este hoyo</p>`));
    const cfg = state.loba[h];
    const lobaCard = el(`
      <div class="card">
        <div class="field-row">
          <div class="field">
            <label>Loba</label>
            <select data-role="loba-select" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
              <option value="">— elegir —</option>
              ${state.players.map((p) => `<option value="${p.id}" ${cfg.loba === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Compañero</label>
            <select data-role="comp-select" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
              <option value="">— elegir —</option>
              <option value="solo" ${cfg.companero === "solo" ? "selected" : ""}>Va solo (1 vs 4)</option>
              ${state.players.filter((p) => p.id !== cfg.loba).map((p) => `<option value="${p.id}" ${cfg.companero === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <p class="help-text">${cfg.companero === "solo" ? "Va solo contra los otros 4 jugadores juntos." : "El resto del grupo forma el equipo de 3 automáticamente."}</p>
        <div class="field" style="margin-top:10px">
          <label>Multiplicador del hoyo ${h + 1} (puedes subirlo manualmente cuando decidan, ej: irse solo)</label>
          <input type="number" min="1" step="1" value="${cfg.multiplicador}" data-role="multiplicador" />
        </div>
      </div>
    `);
    lobaCard.querySelector('[data-role="loba-select"]').addEventListener("change", (e) => {
      registrarCambioDeHoyo(state, h, onChange, () => {
        const val = e.target.value ? parseInt(e.target.value) : null;
        cfg.loba = val;
        if (cfg.companero === val) cfg.companero = null;
      });
    });
    lobaCard.querySelector('[data-role="comp-select"]').addEventListener("change", (e) => {
      registrarCambioDeHoyo(state, h, onChange, () => {
        const val = e.target.value;
        cfg.companero = val === "" ? null : val === "solo" ? "solo" : parseInt(val);
      });
    });
    const multInput = lobaCard.querySelector('[data-role="multiplicador"]');
    if (multInput) {
      multInput.addEventListener("input", (e) => {
        cfg.multiplicador = parseFloat(e.target.value) || 1;
        onChange(state, { skipRender: true });
      });
      multInput.addEventListener("change", () => onChange(state));
    }
    wrap.appendChild(lobaCard);
  }

  /* ---- ACUMULADO HASTA ESTE HOYO (para ir verificando sobre la marcha) ---- */
  wrap.appendChild(el(`<p class="section-divider">Acumulado hasta el hoyo ${h + 1}</p>`));
  const ordenJuego = ordenDeJuego(state.round.hoyoInicial);
  const posicionEnOrden = ordenJuego.indexOf(h) + 1;
  const resumenHasta = calcResumenHastaHoyo(state, posicionEnOrden);
  const accCard = el(`<div class="card"></div>`);
  state.players.forEach((p) => {
    const bal = resumenHasta.balances[p.id];
    accCard.appendChild(el(`
      <div class="balance-row" style="margin-bottom:6px">
        <span class="balance-row__name" style="font-size:14px">${p.name}</span>
        <span class="balance-row__amount ${moneyClass(bal)}" style="font-size:15px">${fmtMoney(bal)}</span>
      </div>
    `));
  });

  const toggleBtn = el(`<button class="btn btn-ghost btn-small" style="width:100%;margin-top:6px">Ver desglose por modalidad</button>`);
  const desgloseWrap = el(`<div style="display:none;margin-top:8px"></div>`);

  function unidadesTxt(u) {
    if (!u) return "";
    const redondeado = Math.round(u * 10) / 10; // por los 0.5 de empates en skins
    return ` (${redondeado > 0 ? "+" : ""}${redondeado}u)`;
  }

  state.players.forEach((p) => {
    const filas = [];

    if (state.bets.individuales.enabled) {
      resumenHasta.individualesResults.forEach((r) => {
        if (r.a !== p.id && r.b !== p.id) return;
        const esA = r.a === p.id;
        const rivalId = esA ? r.b : r.a;
        const dinero = esA ? r.saldoA : -r.saldoA;
        const unidades = esA ? r.totalUnidades : -r.totalUnidades;
        filas.push([`vs ${playerName(state, rivalId)}`, dinero, unidades]);
      });
    }
    if (state.bets.foursome.enabled) {
      resumenHasta.foursomeResults.forEach((r) => {
        const enBase = r.base.includes(p.id);
        const enRival = r.rival.includes(p.id);
        if (!enBase && !enRival) return;
        const miEquipo = enBase ? r.base : r.rival;
        const companeroId = miEquipo.find((id) => id !== p.id);
        const companeroNombre = companeroId !== undefined ? playerName(state, companeroId) : "";
        const rivalNames = (enBase ? r.rival : r.base).map((id) => playerName(state, id)).join("+");
        // Cada jugador de la pareja cobra el monto COMPLETO del cruce, sin
        // dividir entre los 2 (confirmado: si la pareja gana $500 de
        // diferencia, CADA UNO de los 2 cobra $500, no $250).
        const dinero = enBase ? r.saldoTotal : -r.saldoTotal;
        const unidades = enBase ? r.totalUnidades : -r.totalUnidades;
        filas.push([`Foursome (con ${companeroNombre}) vs ${rivalNames}`, dinero, unidades]);
      });
    }
    if (state.bets.skins.enabled && state.bets.skins.participantes.includes(p.id)) {
      filas.push(["Skins", resumenHasta.skinsResult.totalesPorJugador[p.id] || 0, (resumenHasta.skinsResult.unidadesPorJugador || {})[p.id] || 0]);
    }
    if (state.bets.loba.enabled) {
      filas.push(["Loba", resumenHasta.lobaResult.balances[p.id], resumenHasta.lobaResult.unidadesPorJugador[p.id]]);
    }
    if (state.bets.stableford.enabled) {
      // Aquí mostramos puntos acumulados, NO dinero: el premio de Stableford
      // se paga hasta que se cierra la ida/vuelta/total completos, así que
      // un "$" a mitad de ronda solo confundiría (parecería que ya perdiste
      // dinero en ese hoyo cuando en realidad nada se ha cobrado todavía).
      if (state.bets.stableford.participantes.includes(p.id)) {
        const t = resumenHasta.stablefordResult.totales[p.id];
        const pts = t && t.total.jugados > 0 ? t.total.total : 0;
        filas.push([`Stableford`, pts, null, "puntos"]);
      }
    }
    if (state.bets.banderas.enabled && state.bets.banderas.participantes.includes(p.id)) {
      filas.push(["Banderas", resumenHasta.banderasResult.balances[p.id] || 0, null]);
    }
    if (state.bets.threePutt.enabled && state.bets.threePutt.participantes.includes(p.id)) {
      filas.push(["3-putt", resumenHasta.threePuttResult.balances[p.id] || 0, null]);
    }
    if (state.bets.chupes.enabled && state.bets.chupes.participantes.includes(p.id)) {
      filas.push(["Chupes", resumenHasta.chupesResult.balances[p.id] || 0, null]);
    }

    const filasHtml = filas.map(([label, val, unidades, tipo]) => {
      const esPuntos = tipo === "puntos";
      const valorTxt = esPuntos ? `${val} pts` : fmtMoney(val);
      const claseColor = esPuntos ? "" : moneyClass(val);
      return `
        <div class="match-row" style="padding:4px 0">
          <span class="match-row__names" style="font-size:13px;opacity:0.7">${label}</span>
          <span class="match-row__amount ${claseColor}" style="font-size:15px;font-weight:600">${valorTxt}${unidadesTxt(unidades)}</span>
        </div>
      `;
    }).join("");

    desgloseWrap.appendChild(el(`
      <div style="margin-bottom:10px">
        <p style="font-weight:600;font-size:12px;margin:0 0 4px">${p.name}</p>
        ${filasHtml}
      </div>
    `));
  });
  toggleBtn.addEventListener("click", () => {
    const visible = desgloseWrap.style.display !== "none";
    desgloseWrap.style.display = visible ? "none" : "block";
    toggleBtn.textContent = visible ? "Ver desglose por modalidad" : "Ocultar desglose";
  });
  accCard.appendChild(toggleBtn);
  accCard.appendChild(desgloseWrap);
  wrap.appendChild(accCard);

  return wrap;
}


/* ============================================================
   PANTALLA: APUESTAS
   ============================================================ */

function renderBetsScreen(state, onChange) {
  const wrap = el(`<div></div>`);
  const resumen = calcResumenGeneral(state);

  /* ---- INDIVIDUALES ---- */
  if (state.bets.individuales.enabled) {
  wrap.appendChild(el(`<h2 class="screen-title">Individuales (1v1, por hoyo)</h2>`));

  const participantesCard = el(`<div class="card"></div>`);
  participantesCard.appendChild(el(`<p class="card__subtitle" style="margin-bottom:8px">¿Quién juega individuales hoy?</p>`));
  state.players.forEach((p) => {
    const checked = state.bets.individuales.participantes.includes(p.id);
    const row = el(`
      <div class="checkbox-row">
        <input type="checkbox" ${checked ? "checked" : ""} data-player-id="${p.id}" />
        <span>${p.name}</span>
      </div>
    `);
    row.querySelector("input").addEventListener("change", (e) => {
      const list = state.bets.individuales.participantes;
      if (e.target.checked) {
        if (!list.includes(p.id)) list.push(p.id);
      } else {
        const i = list.indexOf(p.id);
        if (i >= 0) list.splice(i, 1);
      }
      onChange(state);
    });
    participantesCard.appendChild(row);
  });
  const genBtn = el(`<button class="btn btn-primary btn-small" style="width:100%;margin-top:10px">Generar todos vs todos</button>`);
  genBtn.addEventListener("click", () => {
    const participantes = state.bets.individuales.participantes;
    if (participantes.length < 2) {
      alert("Selecciona al menos 2 jugadores para generar enfrentamientos.");
      return;
    }
    const ok = confirm(`Esto reemplaza los partidos actuales con todos los enfrentamientos entre ${participantes.length} jugadores (${(participantes.length * (participantes.length - 1)) / 2} partidos, en $100/hoyo ida y vuelta c/u). ¿Continuar?`);
    if (!ok) return;
    state.bets.individuales.matches = generarTodosVsTodos(participantes);
    onChange(state);
  });
  participantesCard.appendChild(genBtn);
  wrap.appendChild(participantesCard);

  const indCard = el(`<div class="card"></div>`);

  if (state.bets.individuales.matches.length === 0) {
    indCard.appendChild(el(`<p class="help-text">Sin partidos todavía.</p>`));
  }

  resumen.individualesResults.forEach((r, idx) => {
    const match = state.bets.individuales.matches[idx];
    const nombreA = playerName(state, r.a);
    const nombreB = playerName(state, r.b);
    const vm = match.ventajaManual;
    const esMatchPlay = match.modo === "matchPlay";
    const marcadorHoyos = esMatchPlay && r.holesCounted > 0
      ? `<p class="help-text" style="margin:2px 0 8px">Hoyos ganados: ${nombreA} ${r.hoyosGanadosA} – ${r.hoyosGanadosB} ${nombreB}</p>`
      : "";
    const matchBlock = el(`
      <div style="margin-bottom:14px;border-bottom:1px solid var(--linea);padding-bottom:12px">
        <div class="match-row" style="border-bottom:none;padding-bottom:6px">
          <span class="match-row__names">${nombreA}<span class="match-row__vs">vs</span>${nombreB}</span>
          <span class="match-row__amount ${moneyClass(r.saldoA)}">${r.holesCounted === 0 ? "—" : fmtMoney(Math.abs(r.saldoA))}</span>
        </div>
        ${marcadorHoyos}
        <div class="field" style="margin-bottom:6px">
          <label>Modo de juego</label>
          <select data-role="match-modo" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
            <option value="normal" ${!esMatchPlay ? "selected" : ""}>Normal (hoyos + birdies/águilas/sandies/oyes)</option>
            <option value="matchPlay" ${esMatchPlay ? "selected" : ""}>Match Play (solo hoyos ganados)</option>
          </select>
        </div>
        <div class="field-row">
          ${esMatchPlay ? `
          <div class="field" style="margin-bottom:6px">
            <label>$ del partido (al que gane más hoyos)</label>
            <input type="number" value="${match.montoMatch || 0}" data-role="match-monto" />
          </div>
          ` : `
          <div class="field" style="margin-bottom:6px">
            <label>$/hoyo ida (1-9)</label>
            <input type="number" value="${match.montoIda}" data-role="match-ida" />
          </div>
          <div class="field" style="margin-bottom:6px">
            <label>$/hoyo vuelta (10-18)</label>
            <input type="number" value="${match.montoVuelta}" data-role="match-vuelta" />
          </div>
          `}
        </div>
        <div class="field" style="margin-bottom:6px">
          <label>Ventaja de este partido (biblia) — reemplaza el hándicap automático</label>
          <select data-role="vm-jugador" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
            <option value="" ${!vm ? "selected" : ""}>Usar hándicap automático</option>
            <option value="${r.a}" ${vm && vm.jugador === r.a ? "selected" : ""}>${nombreA} recibe ventaja</option>
            <option value="${r.b}" ${vm && vm.jugador === r.b ? "selected" : ""}>${nombreB} recibe ventaja</option>
          </select>
        </div>
        ${vm ? `
        <div class="field" style="margin-bottom:6px">
          <label>Golpes de ventaja para ${vm.jugador === r.a ? nombreA : nombreB}</label>
          <input type="number" value="${vm.golpes}" data-role="vm-golpes" min="0" />
        </div>
        ` : ""}
        <button class="btn btn-ghost btn-small" data-role="match-delete" style="width:100%">Eliminar partido</button>
      </div>
    `);
    matchBlock.querySelector('[data-role="match-modo"]').addEventListener("change", (e) => {
      match.modo = e.target.value;
      onChange(state);
    });
    const matchIdaInput = matchBlock.querySelector('[data-role="match-ida"]');
    if (matchIdaInput) {
      matchIdaInput.addEventListener("input", (e) => {
        match.montoIda = parseFloat(e.target.value) || 0;
        onChange(state, { skipRender: true });
      });
      matchIdaInput.addEventListener("change", () => onChange(state));
    }
    const matchVueltaInput = matchBlock.querySelector('[data-role="match-vuelta"]');
    if (matchVueltaInput) {
      matchVueltaInput.addEventListener("input", (e) => {
        match.montoVuelta = parseFloat(e.target.value) || 0;
        onChange(state, { skipRender: true });
      });
      matchVueltaInput.addEventListener("change", () => onChange(state));
    }
    const matchMontoInput = matchBlock.querySelector('[data-role="match-monto"]');
    if (matchMontoInput) {
      matchMontoInput.addEventListener("input", (e) => {
        match.montoMatch = parseFloat(e.target.value) || 0;
        onChange(state, { skipRender: true });
      });
      matchMontoInput.addEventListener("change", () => onChange(state));
    }
    matchBlock.querySelector('[data-role="vm-jugador"]').addEventListener("change", (e) => {
      if (e.target.value === "") {
        match.ventajaManual = null;
      } else {
        match.ventajaManual = { jugador: parseInt(e.target.value), golpes: (match.ventajaManual && match.ventajaManual.golpes) || 1 };
      }
      onChange(state);
    });
    const vmGolpesInput = matchBlock.querySelector('[data-role="vm-golpes"]');
    if (vmGolpesInput) {
      vmGolpesInput.addEventListener("input", (e) => {
        match.ventajaManual.golpes = Math.max(0, parseInt(e.target.value) || 0);
        onChange(state, { skipRender: true });
      });
      vmGolpesInput.addEventListener("change", () => onChange(state));
    }
    matchBlock.querySelector('[data-role="match-delete"]').addEventListener("click", () => {
      state.bets.individuales.matches.splice(idx, 1);
      onChange(state);
    });
    indCard.appendChild(matchBlock);
  });

  const addMatchRow = el(`
    <div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <select data-role="a" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
          ${state.players.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <select data-role="b" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
          ${state.players.map((p, i) => `<option value="${p.id}" ${i === 1 ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input data-role="monto-ida" type="number" value="100" placeholder="$/hoyo ida" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)" />
        <input data-role="monto-vuelta" type="number" value="100" placeholder="$/hoyo vuelta" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)" />
      </div>
      <button class="btn btn-ghost btn-small" data-role="add" style="margin-top:10px;width:100%">+ Agregar partido</button>
    </div>
  `);
  indCard.appendChild(addMatchRow);
  addMatchRow.querySelector('[data-role="add"]').addEventListener("click", () => {
    const a = parseInt(addMatchRow.querySelector('[data-role="a"]').value);
    const b = parseInt(addMatchRow.querySelector('[data-role="b"]').value);
    const montoIda = parseFloat(addMatchRow.querySelector('[data-role="monto-ida"]').value) || 0;
    const montoVuelta = parseFloat(addMatchRow.querySelector('[data-role="monto-vuelta"]').value) || 0;
    if (a === b) {
      alert("Elige 2 jugadores distintos para crear el partido.");
      return;
    }
    state.bets.individuales.matches.push({ a, b, montoIda, montoVuelta, ventajaManual: null, modo: "normal", montoMatch: 0 });
    onChange(state);
  });
  wrap.appendChild(indCard);
  }

  /* ---- FOURSOME: formato, quién juega, parejas base (antes en Config) ---- */
  if (state.bets.foursome.enabled) {
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Foursome — configuración de hoy</h2>`));

    const formatoCard = el(`
      <div class="card">
        <p class="card__subtitle" style="margin-bottom:8px">¿Qué formato juegan hoy?</p>
        <select data-role="fs-formato" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:11px 12px;color:var(--crema);font-size:15px">
          <option value="cruzado" ${state.bets.foursome.formato === "cruzado" ? "selected" : ""}>Foursome cruzado (5 jugadores, 3 cruces)</option>
          <option value="roundRobin" ${state.bets.foursome.formato === "roundRobin" ? "selected" : ""}>Foursome Round Robin (4 jugadores, cambia de pareja cada 6 hoyos)</option>
          <option value="normal" ${state.bets.foursome.formato === "normal" ? "selected" : ""}>Foursome normal (4 jugadores, misma pareja los 18 hoyos)</option>
        </select>
      </div>
    `);
    formatoCard.querySelector('[data-role="fs-formato"]').addEventListener("change", (e) => {
      state.bets.foursome.formato = e.target.value;
      // Al cambiar de formato hay que regenerar los segmentos con el
      // rango de hoyos correcto (18 completos para "normal", 3 bloques
      // de 6 para "roundRobin") — si no, un segmento que venía de un
      // formato anterior puede quedarse con un rango de hoyos viejo (ej.
      // solo 1-6 de un Round Robin) y el dinero deja de moverse desde el
      // hoyo 7 en adelante sin avisar. generarSegmentosRotacion conserva
      // las parejas y montos ya elegidos si siguen siendo válidos.
      if (state.bets.foursome.participantes4.length === 4) {
        state.bets.foursome.segmentos = generarSegmentosRotacion(
          state.bets.foursome.participantes4,
          state.bets.foursome.segmentos,
          state.round.hoyoInicial,
          state.bets.foursome.formato === "roundRobin"
        );
      }
      onChange(state);
    });
    wrap.appendChild(formatoCard);

    if (state.bets.foursome.formato === "cruzado") {
      const participantesCard = el(`
        <div class="card" style="margin-top:10px">
          <p class="card__subtitle" style="margin-bottom:8px">¿Quién juega foursome hoy?</p>
        </div>
      `);
      state.players.forEach((p) => {
        const checked = state.bets.foursome.participantes.includes(p.id);
        const row = el(`
          <label style="display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer">
            <input type="checkbox" data-fs-part="${p.id}" ${checked ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
            <span>${p.name}</span>
          </label>
        `);
        row.querySelector("input").addEventListener("change", (e) => {
          const id = p.id;
          if (e.target.checked) {
            if (!state.bets.foursome.participantes.includes(id)) state.bets.foursome.participantes.push(id);
          } else {
            state.bets.foursome.participantes = state.bets.foursome.participantes.filter((x) => x !== id);
          }
          const nParticipantes = state.bets.foursome.participantes.length;
          if (nParticipantes !== 4 && nParticipantes !== 5) {
            alert("Foursome cruzado necesita exactamente 4 o 5 participantes.");
          }
          if (!state.bets.foursome.participantes.includes(state.bets.foursome.basePlayers[0]) ||
              !state.bets.foursome.participantes.includes(state.bets.foursome.basePlayers[1])) {
            state.bets.foursome.basePlayers = state.bets.foursome.participantes.slice(0, 2);
          }
          const jugadoresFoursome = state.players.filter((pl) => state.bets.foursome.participantes.includes(pl.id));
          state.bets.foursome.crosses = generarCrucesForusome(state.bets.foursome.basePlayers, jugadoresFoursome, state.bets.foursome.crosses);
          onChange(state);
        });
        participantesCard.appendChild(row);
      });
      const nParticipantesActual = state.bets.foursome.participantes.length;
      participantesCard.appendChild(el(`<p class="help-text" style="margin-top:8px">${nParticipantesActual === 4 ? "4 seleccionados: un solo cruce 2 vs 2." : nParticipantesActual === 5 ? "5 seleccionados: cruzado, 3 cruces contra las 3 combinaciones." : `⚠️ ${nParticipantesActual} seleccionados — elige exactamente 4 o 5.`}</p>`));
      wrap.appendChild(participantesCard);

      const jugadoresFoursomeActuales = state.players.filter((p) => state.bets.foursome.participantes.includes(p.id));

      const baseCard = el(`
        <div class="card" style="margin-top:10px">
          <p class="card__subtitle" style="margin-bottom:8px">${nParticipantesActual === 4 ? "Elige una pareja." : "Elige la pareja base."}</p>
          <div class="field-row">
            <div class="field">
              <label>Base 1</label>
              <select data-role="base1" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
                ${jugadoresFoursomeActuales.map((p) => `<option value="${p.id}" ${state.bets.foursome.basePlayers[0] === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Base 2</label>
              <select data-role="base2" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
                ${jugadoresFoursomeActuales.map((p) => `<option value="${p.id}" ${state.bets.foursome.basePlayers[1] === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
      `);
      function actualizarBase() {
        const b1 = parseInt(baseCard.querySelector('[data-role="base1"]').value);
        const b2 = parseInt(baseCard.querySelector('[data-role="base2"]').value);
        if (b1 === b2) {
          alert("Los 2 jugadores de la base deben ser distintos.");
          return;
        }
        state.bets.foursome.basePlayers = [b1, b2];
        const jugadoresFoursome = state.players.filter((p) => state.bets.foursome.participantes.includes(p.id));
        state.bets.foursome.crosses = generarCrucesForusome([b1, b2], jugadoresFoursome, state.bets.foursome.crosses);
        onChange(state);
      }
      baseCard.querySelector('[data-role="base1"]').addEventListener("change", actualizarBase);
      baseCard.querySelector('[data-role="base2"]').addEventListener("change", actualizarBase);
      wrap.appendChild(baseCard);
    } else {
      // roundRobin o normal: 4 jugadores exactos
      const participantesCard = el(`
        <div class="card" style="margin-top:10px">
          <p class="card__subtitle" style="margin-bottom:8px">¿Quién juega foursome hoy? (exactamente 4)</p>
        </div>
      `);
      state.players.forEach((p) => {
        const checked = state.bets.foursome.participantes4.includes(p.id);
        const row = el(`
          <label style="display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer">
            <input type="checkbox" data-rot-part="${p.id}" ${checked ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
            <span>${p.name}</span>
          </label>
        `);
        row.querySelector("input").addEventListener("change", (e) => {
          const id = p.id;
          if (e.target.checked) {
            if (!state.bets.foursome.participantes4.includes(id)) state.bets.foursome.participantes4.push(id);
          } else {
            state.bets.foursome.participantes4 = state.bets.foursome.participantes4.filter((x) => x !== id);
          }
          if (state.bets.foursome.participantes4.length !== 4) {
            alert("Este formato necesita EXACTAMENTE 4 participantes.");
          } else {
            state.bets.foursome.segmentos = generarSegmentosRotacion(state.bets.foursome.participantes4, state.bets.foursome.segmentos, state.round.hoyoInicial, state.bets.foursome.formato !== "normal");
          }
          onChange(state);
        });
        participantesCard.appendChild(row);
      });
      const n4Actual = state.bets.foursome.participantes4.length;
      participantesCard.appendChild(el(`<p class="help-text" style="margin-top:8px">${n4Actual === 4 ? "4 seleccionados ✓" : `⚠️ ${n4Actual} seleccionados — elige exactamente 4.`}</p>`));
      wrap.appendChild(participantesCard);

      if (n4Actual === 4) {
        const segCard = el(`<div class="card" style="margin-top:10px"></div>`);
        const rotar = state.bets.foursome.formato === "roundRobin";
        const [pa, pb, pc, pd] = state.bets.foursome.participantes4;
        // las 3 formas posibles de partir 4 jugadores en 2 parejas
        const opcionesPareja = [
          { base: [pa, pb], rival: [pc, pd] },
          { base: [pa, pc], rival: [pb, pd] },
          { base: [pa, pd], rival: [pb, pc] },
        ];
        const claveDe = (o) => o.base.slice().sort().join(",") + "|" + o.rival.slice().sort().join(",");
        const rangoHoyos = (seg) => {
          if (!rotar) return "Los 18 hoyos";
          const nums = seg.hoyos.map((x) => x + 1);
          return `Hoyos ${nums[0]}-${nums[nums.length - 1]}`;
        };
        const segmentosMostrados = rotar ? state.bets.foursome.segmentos : state.bets.foursome.segmentos.slice(0, 1);
        segmentosMostrados.forEach((seg, i) => {
          const claveActual = claveDe(seg);
          const row = el(`
            <div class="field" style="${i > 0 ? "margin-top:14px;padding-top:14px;border-top:1px solid var(--linea)" : ""}">
              <label>${rangoHoyos(seg)} — ¿quién va con quién?</label>
              <select data-seg-pareja="${seg.id}" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
                ${opcionesPareja.map((o) => {
                  const bn = o.base.map((id) => playerName(state, id)).join(" + ");
                  const rn = o.rival.map((id) => playerName(state, id)).join(" + ");
                  return `<option value="${claveDe(o)}" ${claveDe(o) === claveActual ? "selected" : ""}>${bn} vs ${rn}</option>`;
                }).join("")}
              </select>
            </div>
          `);
          row.querySelector("select").addEventListener("change", (e) => {
            const elegida = opcionesPareja.find((o) => claveDe(o) === e.target.value);
            if (elegida) {
              seg.base = [...elegida.base];
              seg.rival = [...elegida.rival];
              onChange(state);
            }
          });
          segCard.appendChild(row);
        });
        if (rotar && state.round.hoyoInicial === 10) {
          segCard.appendChild(el(`<p class="help-text" style="margin:10px 0 0">Arrancando por el 10.</p>`));
        }
        wrap.appendChild(segCard);
      }
    }
  }

  /* ---- FOURSOME ---- */
  if (state.bets.foursome.enabled && state.bets.foursome.formato === "cruzado") {
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Foursome cruzado</h2>`));
  resumen.foursomeResults.forEach((r) => {
    const baseNames = r.base.map((id) => playerName(state, id)).join(" + ");
    const rivalNames = r.rival.map((id) => playerName(state, id)).join(" + ");
    const cross = state.bets.foursome.crosses.find((c) => c.id === r.crossId);

    const card = el(`
      <div class="card">
        <p class="card__title">${baseNames}<span style="opacity:0.5;font-size:12px"> vs </span>${rivalNames}</p>
        <div class="field-row">
          <div class="field">
            <label>$/hoyo, hoyos 1-9</label>
            <input type="number" value="${cross.montoIda}" data-role="ida" />
          </div>
          <div class="field">
            <label>$/hoyo, hoyos 10-18</label>
            <input type="number" value="${cross.montoVuelta}" data-role="vuelta" />
          </div>
        </div>
        <div class="match-row" style="border-top:1px solid var(--linea);padding-top:10px">
          <span class="match-row__names">Saldo del cruce</span>
          <span class="match-row__amount ${moneyClass(r.saldoTotal)}">${fmtMoney(Math.abs(r.saldoTotal))} ${r.saldoTotal === 0 ? "" : (r.saldoTotal > 0 ? "a favor de " + baseNames : "a favor de " + rivalNames)}</span>
        </div>
      </div>
    `);
    card.querySelector('[data-role="ida"]').addEventListener("input", (e) => {
      cross.montoIda = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    card.querySelector('[data-role="ida"]').addEventListener("change", () => onChange(state));
    card.querySelector('[data-role="vuelta"]').addEventListener("input", (e) => {
      cross.montoVuelta = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    card.querySelector('[data-role="vuelta"]').addEventListener("change", () => onChange(state));
    wrap.appendChild(card);
  });
  }

  /* ---- FOURSOME ROUND ROBIN / NORMAL (4 jugadores) ---- */
  if (state.bets.foursome.enabled && state.bets.foursome.formato !== "cruzado" && state.bets.foursome.participantes4.length === 4) {
    const titulo = state.bets.foursome.formato === "roundRobin" ? "Foursome Round Robin" : "Foursome normal";
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">${titulo}</h2>`));
    const rangoHoyosSeg = (seg) => {
      if (state.bets.foursome.formato === "normal") return "Los 18 hoyos";
      const nums = seg.hoyos.map((x) => x + 1);
      return `Hoyos ${nums[0]}-${nums[nums.length - 1]}`;
    };
    resumen.foursomeResults.forEach((r) => {
      const baseNames = r.base.map((id) => playerName(state, id)).join(" + ");
      const rivalNames = r.rival.map((id) => playerName(state, id)).join(" + ");
      const seg = state.bets.foursome.segmentos.find((s) => s.id === r.crossId);
      const esNormal = state.bets.foursome.formato === "normal";
      const card = el(`
        <div class="card">
          <p class="card__title">${rangoHoyosSeg(seg)}: ${baseNames}<span style="opacity:0.5;font-size:12px"> vs </span>${rivalNames}</p>
          ${esNormal ? `
          <div class="field-row">
            <div class="field">
              <label>$/hoyo, hoyos 1-9</label>
              <input type="number" value="${seg.montoIda}" data-role="monto-ida" />
            </div>
            <div class="field">
              <label>$/hoyo, hoyos 10-18</label>
              <input type="number" value="${seg.montoVuelta}" data-role="monto-vuelta" />
            </div>
          </div>
          ` : `
          <div class="field">
            <label>$ por hoyo</label>
            <input type="number" value="${seg.monto}" data-role="monto" />
          </div>
          `}
          <div class="match-row" style="border-top:1px solid var(--linea);padding-top:10px">
            <span class="match-row__names">Saldo del segmento</span>
            <span class="match-row__amount ${moneyClass(r.saldoTotal)}">${fmtMoney(Math.abs(r.saldoTotal))} ${r.saldoTotal === 0 ? "" : (r.saldoTotal > 0 ? "a favor de " + baseNames : "a favor de " + rivalNames)}</span>
          </div>
        </div>
      `);
      const montoIdaInput = card.querySelector('[data-role="monto-ida"]');
      if (montoIdaInput) {
        montoIdaInput.addEventListener("input", (e) => {
          seg.montoIda = parseFloat(e.target.value) || 0;
          onChange(state, { skipRender: true });
        });
        montoIdaInput.addEventListener("change", () => onChange(state));
      }
      const montoVueltaInput = card.querySelector('[data-role="monto-vuelta"]');
      if (montoVueltaInput) {
        montoVueltaInput.addEventListener("input", (e) => {
          seg.montoVuelta = parseFloat(e.target.value) || 0;
          onChange(state, { skipRender: true });
        });
        montoVueltaInput.addEventListener("change", () => onChange(state));
      }
      const montoInput = card.querySelector('[data-role="monto"]');
      if (montoInput) {
        montoInput.addEventListener("input", (e) => {
          seg.monto = parseFloat(e.target.value) || 0;
          onChange(state, { skipRender: true });
        });
        montoInput.addEventListener("change", () => onChange(state));
      }
      wrap.appendChild(card);
    });
  }

  /* ---- SKINS ---- */
  if (state.bets.skins.enabled) {
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Skins</h2>`));
  const skinsCard = el(`
    <div class="card">
      <div class="field">
        <label>$ por hoyo</label>
        <input type="number" value="${state.bets.skins.montoPorHoyo}" data-role="monto" />
      </div>
    </div>
  `);
  skinsCard.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
    state.bets.skins.montoPorHoyo = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  skinsCard.querySelector('[data-role="monto"]').addEventListener("change", () => onChange(state));

  skinsCard.appendChild(el(`<p class="help-text" style="margin:8px 0 4px">¿Quién juega skins hoy?</p>`));
  state.players.forEach((p) => {
    const checked = state.bets.skins.participantes.includes(p.id);
    const row = el(`
      <label style="display:flex;align-items:center;gap:10px;padding:4px 0;cursor:pointer">
        <input type="checkbox" data-skins-part="${p.id}" ${checked ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
        <span>${p.name}</span>
      </label>
    `);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!state.bets.skins.participantes.includes(p.id)) state.bets.skins.participantes.push(p.id);
      } else {
        state.bets.skins.participantes = state.bets.skins.participantes.filter((x) => x !== p.id);
      }
      onChange(state);
    });
    skinsCard.appendChild(row);
  });

  state.players.filter((p) => state.bets.skins.participantes.includes(p.id)).forEach((p) => {
    const ganado = resumen.skinsResult.totalesPorJugador[p.id] || 0;
    skinsCard.appendChild(el(`
      <div class="match-row">
        <span class="match-row__names">${p.name}</span>
        <span class="match-row__amount ${moneyClass(ganado)}">${fmtMoney(ganado)}</span>
      </div>
    `));
  });
  if (resumen.skinsResult.montoPendiente > 0) {
    skinsCard.appendChild(el(`<p class="help-text">Acumulado: ${fmtMoney(resumen.skinsResult.montoPendiente)}</p>`));
  }
  wrap.appendChild(skinsCard);
  }

  /* ---- LOBA ---- */
  if (state.bets.loba.enabled) {
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Loba</h2>`));
    const lobaCard = el(`
      <div class="card">
        <div class="field">
          <label>$ base por jugador (se multiplica x3 y se reparte)</label>
          <input type="number" value="${state.bets.loba.monto}" data-role="monto" />
        </div>
      </div>
    `);
    lobaCard.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
      state.bets.loba.monto = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    lobaCard.querySelector('[data-role="monto"]').addEventListener("change", () => onChange(state));
    state.players.forEach((p) => {
      const ganado = resumen.lobaResult.balances[p.id];
      lobaCard.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">${p.name}</span>
          <span class="match-row__amount ${moneyClass(ganado)}">${fmtMoney(ganado)}</span>
        </div>
      `));
    });
    const jugados = resumen.lobaResult.detalle.filter((d) => d.jugado);
    if (jugados.length === 0) {
      lobaCard.appendChild(el(`<p class="help-text">Aún no hay hoyos de loba jugados. Configúralos en la pestaña Hoyo.</p>`));
    } else {
      jugados.slice().reverse().forEach((d) => {
        const parejaNames = d.pareja.map((id) => playerName(state, id)).join(" + ") + (d.vaSolo ? " (solo)" : "");
        const trioNames = d.trio.map((id) => playerName(state, id)).join(" + ");
        const ganadorTxt = d.ganador === "pareja" ? parejaNames : d.ganador === "trio" ? trioNames : (d.acumulaSiguiente ? "Empate golpe, acumula" : "Empate");
        const eventosTxt = d.diffEventos ? ` · eventos: ${d.diffEventos > 0 ? parejaNames : trioNames} +${Math.abs(d.diffEventos)}` : "";
        const multTxt = d.multiplicador > 1 ? ` (×${d.multiplicador})` : "";
        lobaCard.appendChild(el(`
          <div class="match-row">
            <span class="match-row__names">H${d.hole}${multTxt} · ${parejaNames} vs ${trioNames}</span>
            <span class="match-row__amount" style="font-size:12px">${ganadorTxt}${eventosTxt}</span>
          </div>
        `));
      });
    }
    wrap.appendChild(lobaCard);
  }

  /* ---- STABLEFORD ---- */
  if (state.bets.stableford.enabled) {
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Stableford</h2>`));
    const sfCard = el(`
      <div class="card">
        <div class="field-row">
          <div class="field">
            <label>$ premio ida</label>
            <input type="number" value="${state.bets.stableford.montoIda}" data-role="sf-ida" />
          </div>
          <div class="field">
            <label>$ premio vuelta</label>
            <input type="number" value="${state.bets.stableford.montoVuelta}" data-role="sf-vuelta" />
          </div>
          <div class="field">
            <label>$ premio total</label>
            <input type="number" value="${state.bets.stableford.montoTotal}" data-role="sf-total" />
          </div>
        </div>
      </div>
    `);
    sfCard.querySelector('[data-role="sf-ida"]').addEventListener("input", (e) => {
      state.bets.stableford.montoIda = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    sfCard.querySelector('[data-role="sf-ida"]').addEventListener("change", () => onChange(state));
    sfCard.querySelector('[data-role="sf-vuelta"]').addEventListener("input", (e) => {
      state.bets.stableford.montoVuelta = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    sfCard.querySelector('[data-role="sf-vuelta"]').addEventListener("change", () => onChange(state));
    sfCard.querySelector('[data-role="sf-total"]').addEventListener("input", (e) => {
      state.bets.stableford.montoTotal = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    sfCard.querySelector('[data-role="sf-total"]').addEventListener("change", () => onChange(state));

    sfCard.appendChild(el(`<p class="help-text" style="margin:8px 0 4px">¿Quién juega stableford hoy?</p>`));
    state.players.forEach((p) => {
      const checked = state.bets.stableford.participantes.includes(p.id);
      const row = el(`
        <label style="display:flex;align-items:center;gap:10px;padding:4px 0;cursor:pointer">
          <input type="checkbox" data-sf-part="${p.id}" ${checked ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
          <span>${p.name}</span>
        </label>
      `);
      row.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) {
          if (!state.bets.stableford.participantes.includes(p.id)) state.bets.stableford.participantes.push(p.id);
        } else {
          state.bets.stableford.participantes = state.bets.stableford.participantes.filter((x) => x !== p.id);
        }
        onChange(state);
      });
      sfCard.appendChild(row);
    });
    wrap.appendChild(sfCard);

    const jugadoresSf = state.players.filter((p) => state.bets.stableford.participantes.includes(p.id));

    const sfTable = el(`<div class="card"></div>`);
    sfTable.appendChild(el(`
      <div class="match-row" style="font-weight:600;font-size:12px;opacity:0.7">
        <span class="match-row__names">Jugador</span>
        <span style="display:flex;gap:14px">
          <span style="width:32px;text-align:right">Ida</span>
          <span style="width:32px;text-align:right">Vta</span>
          <span style="width:32px;text-align:right">Tot</span>
        </span>
      </div>
    `));
    jugadoresSf.forEach((p) => {
      const t = resumen.stablefordResult.totales[p.id];
      if (!t) return;
      sfTable.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">${p.name}</span>
          <span style="display:flex;gap:14px;font-family:var(--font-mono);font-size:13px">
            <span style="width:32px;text-align:right">${t.ida.jugados > 0 ? t.ida.total : "—"}</span>
            <span style="width:32px;text-align:right">${t.vuelta.jugados > 0 ? t.vuelta.total : "—"}</span>
            <span style="width:32px;text-align:right">${t.total.jugados > 0 ? t.total.total : "—"}</span>
          </span>
        </div>
      `));
    });
    wrap.appendChild(sfTable);

    const sfBalances = el(`<div class="card"></div>`);
    jugadoresSf.forEach((p) => {
      const bal = resumen.stablefordResult.balances[p.id] || 0;
      sfBalances.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">${p.name}</span>
          <span class="match-row__amount ${moneyClass(bal)}">${fmtMoney(bal)}</span>
        </div>
      `));
    });
    wrap.appendChild(sfBalances);
  }

  /* ---- BANDERAS / 3-PUTT / CHUPES (3 apuestas independientes) ---- */
  function renderApuestaContador(betKey, titulo, labelMonto, resultKey, emoji, tipoDetalle, ayudaVacio) {
    if (!state.bets[betKey].enabled) return;
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">${titulo}</h2>`));

    const participantesCard = el(`<div class="card"></div>`);
    participantesCard.appendChild(el(`<p class="card__subtitle" style="margin-bottom:8px">¿Quién juega ${titulo.toLowerCase()} hoy?</p>`));
    state.players.forEach((p) => {
      const checked = state.bets[betKey].participantes.includes(p.id);
      const row = el(`
        <div class="checkbox-row">
          <input type="checkbox" ${checked ? "checked" : ""} data-player-id="${p.id}" />
          <span>${p.name}</span>
        </div>
      `);
      row.querySelector("input").addEventListener("change", (e) => {
        const list = state.bets[betKey].participantes;
        if (e.target.checked) {
          if (!list.includes(p.id)) list.push(p.id);
        } else {
          const i = list.indexOf(p.id);
          if (i >= 0) list.splice(i, 1);
        }
        onChange(state);
      });
      participantesCard.appendChild(row);
    });
    wrap.appendChild(participantesCard);

    const card = el(`
      <div class="card">
        <div class="field">
          <label>${labelMonto}</label>
          <input type="number" value="${state.bets[betKey].monto}" data-role="monto" />
        </div>
      </div>
    `);
    card.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
      state.bets[betKey].monto = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    card.querySelector('[data-role="monto"]').addEventListener("change", () => onChange(state));
    state.players.filter((p) => state.bets[betKey].participantes.includes(p.id)).forEach((p) => {
      const bal = resumen[resultKey].balances[p.id] || 0;
      card.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">${p.name}</span>
          <span class="match-row__amount ${moneyClass(bal)}">${fmtMoney(bal)}</span>
        </div>
      `));
    });
    if (resumen[resultKey].detalle.length === 0) {
      card.appendChild(el(`<p class="help-text">${ayudaVacio}</p>`));
    } else {
      resumen[resultKey].detalle.slice().reverse().forEach((d) => {
        const esPositivo = betKey === "banderas";
        card.appendChild(el(`
          <div class="match-row">
            <span class="match-row__names">H${d.hole} · ${playerName(state, d.playerId)} · ${emoji}×${d.cantidad}</span>
            <span class="match-row__amount ${esPositivo ? "amount-pos" : "amount-neg"}" style="font-size:12px">${esPositivo ? "+" : "-"}${fmtMoney(d.monto)}</span>
          </div>
        `));
      });
    }
    wrap.appendChild(card);
  }

  renderApuestaContador("banderas", "Banderas", "$ por bandera", "banderasResult", "🚩", "banderas", "Sin banderas registradas todavía.");
  renderApuestaContador("threePutt", "3-putt", "$ por 3-putt", "threePuttResult", "🎯", "3putt", "Sin 3-putts registrados todavía.");
  renderApuestaContador("chupes", "Chupes", "$ por chupe", "chupesResult", "🥤", "chupes", "Sin chupes registrados todavía.");

  return wrap;
}

/* ============================================================
   PANTALLA: RESUMEN
   ============================================================ */

function sumaGolpesBrutos(state, playerId, desde, hasta) {
  let suma = 0;
  let jugados = 0;
  for (let h = desde; h < hasta; h++) {
    const v = state.scores[playerId][h];
    if (v !== null && v !== undefined) {
      suma += v;
      jugados++;
    }
  }
  return { suma, jugados };
}

/**
 * Pinta la sección de historial de rondas guardadas (siempre visible, sin
 * importar si la ronda ACTUAL ya tiene golpes capturados o no — el
 * historial es sobre rondas pasadas, no sobre la de hoy).
 */
function apendHistorialDeRondas(wrap, state) {
  wrap.appendChild(el(`<p class="section-divider">Tu historial de rondas guardadas</p>`));
  if (state.roundsHistory.length === 0) {
    wrap.appendChild(el(`<p class="help-text">Aún no hay rondas guardadas.</p>`));
    return;
  }
  const totalAcumulado = state.roundsHistory.reduce((sum, r) => sum + r.balanceYo, 0);

  // Estadísticas rápidas de las últimas 10 rondas (o menos, si no llevas
  // 10 todavía) — puro resumen de lo que ya está en el historial, no
  // guarda nada nuevo.
  const ultimas10 = state.roundsHistory.slice(-10);
  const promedio = ultimas10.reduce((sum, r) => sum + r.balanceYo, 0) / ultimas10.length;
  const victorias = ultimas10.filter((r) => r.balanceYo > 0).length;
  const derrotas = ultimas10.filter((r) => r.balanceYo < 0).length;
  const mejorRonda = Math.max(...ultimas10.map((r) => r.balanceYo));
  const peorRonda = Math.min(...ultimas10.map((r) => r.balanceYo));
  const statsCard = el(`
    <div class="card" style="margin-bottom:10px">
      <p class="card__subtitle" style="margin-bottom:8px">Estadísticas · últimas ${ultimas10.length} ronda${ultimas10.length === 1 ? "" : "s"}</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px 12px">
        <div>
          <div class="help-text" style="margin:0">Promedio</div>
          <div class="${moneyClass(promedio)}" style="font-weight:600;font-family:var(--font-mono)">${fmtMoney(Math.round(promedio))} / ronda</div>
        </div>
        <div>
          <div class="help-text" style="margin:0">Victorias / Derrotas</div>
          <div style="font-weight:600;font-family:var(--font-mono)">${victorias} / ${derrotas}</div>
        </div>
        <div>
          <div class="help-text" style="margin:0">Mejor ronda</div>
          <div class="amount-pos" style="font-weight:600;font-family:var(--font-mono)">${fmtMoney(mejorRonda)}</div>
        </div>
        <div>
          <div class="help-text" style="margin:0">Peor ronda</div>
          <div class="amount-neg" style="font-weight:600;font-family:var(--font-mono)">${fmtMoney(peorRonda)}</div>
        </div>
      </div>
    </div>
  `);
  wrap.appendChild(statsCard);

  const histCard = el(`<div class="card"></div>`);
  histCard.appendChild(el(`
    <div class="balance-row" style="border-bottom:1px solid var(--linea);margin-bottom:8px;padding-bottom:8px">
      <span class="balance-row__name">Saldo acumulado (${state.roundsHistory.length} ronda${state.roundsHistory.length === 1 ? "" : "s"})</span>
      <span class="balance-row__amount ${moneyClass(totalAcumulado)}">${fmtMoney(totalAcumulado)}</span>
    </div>
  `));
  state.roundsHistory
    .slice()
    .reverse()
    .forEach((r) => {
      const fechaFmt = new Date(r.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
      const rondaBlock = el(`<div style="padding:7px 0;border-bottom:1px solid var(--linea)"></div>`);
      const header = el(`
        <div class="match-row" style="border-bottom:none;padding:0;cursor:pointer">
          <span class="match-row__names" style="font-size:14px">${fechaFmt} · ${r.courseName}</span>
          <span class="match-row__amount ${moneyClass(r.balanceYo)}" style="font-size:15px;font-weight:600">${fmtMoney(r.balanceYo)}</span>
        </div>
      `);
      rondaBlock.appendChild(header);
      if (r.jugadores && r.jugadores.length > 0) {
        const detalleWrap = el(`<div style="display:none;margin-top:8px"></div>`);
        r.jugadores.forEach((j) => {
          const jugadorBlock = el(`
            <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)">
              <div class="balance-row" style="padding:2px 0">
                <span class="balance-row__name">${j.nombre}${j.golpes > 0 ? ` <span class="help-text" style="font-size:11px">· ${j.golpes} golpes</span>` : ""}</span>
                <span class="balance-row__amount ${moneyClass(j.total)}">${fmtMoney(j.total)}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px 10px;margin-top:4px">
                ${[
                  ["Individuales", j.desglose.individuales],
                  ["Foursome", j.desglose.foursome],
                  ["Skins", j.desglose.skins],
                  ["Loba", j.desglose.loba],
                  ["Stableford", j.desglose.stableford],
                  ["Banderas", j.desglose.banderas + j.desglose.threePutt + j.desglose.chupes],
                ]
                  .filter(([, monto]) => monto !== 0)
                  .map(([label, monto]) => `<span class="help-text" style="font-size:12px">${label}: <span class="${moneyClass(monto)}">${fmtMoney(monto)}</span></span>`)
                  .join("")}
              </div>
            </div>
          `);
          detalleWrap.appendChild(jugadorBlock);
        });
        rondaBlock.appendChild(detalleWrap);
        header.addEventListener("click", () => {
          detalleWrap.style.display = detalleWrap.style.display === "none" ? "block" : "none";
        });
      }
      histCard.appendChild(rondaBlock);
    });
  wrap.appendChild(histCard);

  const exportCsvBtn = el(`<button class="btn btn-ghost btn-small" style="width:100%;margin-top:8px">Exportar historial a Excel</button>`);
  exportCsvBtn.addEventListener("click", () => {
    const columnas = ["Fecha", "Cancha", "Individuales", "Foursome", "Skins", "Loba", "Stableford", "Banderas", "3-putt", "Chupes", "Total"];
    const filasCsv = [columnas.join(",")];
    state.roundsHistory.forEach((r) => {
      const d = r.desglose || {};
      const fechaFmt = new Date(r.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const fila = [
        fechaFmt,
        `"${r.courseName.replace(/"/g, '""')}"`,
        d.individuales || 0,
        d.foursome || 0,
        d.skins || 0,
        d.loba || 0,
        d.stableford || 0,
        d.banderas || 0,
        d.threePutt || 0,
        d.chupes || 0,
        r.balanceYo,
      ];
      filasCsv.push(fila.join(","));
    });
    // BOM al inicio para que Excel abra los acentos bien (ej. "Cañadas")
    const csvContent = "\uFEFF" + filasCsv.join("\r\n");
    const fecha = new Date().toISOString().slice(0, 10);
    const filename = `las-lomas-bets-historial-${fecha}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "text/csv" })] })) {
      navigator.share({ files: [new File([blob], filename, { type: "text/csv" })], title: "Historial Las Lomas Bets" }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
  wrap.appendChild(exportCsvBtn);
}

function renderSummaryScreen(state, onChange) {
  const wrap = el(`<div></div>`);
  const resumen = calcResumenGeneral(state);
  const played = holesPlayedCount(state);

  wrap.appendChild(el(`<h2 class="screen-title">Balance neto · ${played}/18 hoyos</h2>`));

  if (played === 0) {
    wrap.appendChild(el(`
      <div class="empty-state">
        Aún no hay golpes registrados.<br/>Empieza a anotar en la pestaña Hoyo.
      </div>
    `));
    apendHistorialDeRondas(wrap, state);
    return wrap;
  }

  // Tarjeta de golf: hoyo por hoyo, con OUT/IN/TOT, como una tarjeta real.
  // Colores: verde = bajo par, rojo = sobre par, blanco = par exacto.
  // Scroll horizontal porque 18 columnas no caben en pantalla de celular.
  wrap.appendChild(el(`<p class="section-divider">Tarjeta de golf</p>`));
  const course = getActiveCourse(state);
  const par = course.par;
  const cellStyle = "min-width:30px;text-align:center;padding:7px 2px;font-family:var(--font-mono);font-size:12px;white-space:nowrap";
  const headerCellStyle = cellStyle + ";opacity:0.6;font-size:10px";

  const scoreColor = (bruto, parHoyo) => {
    if (bruto === null || bruto === undefined) return "opacity:0.3";
    if (bruto < parHoyo) return "font-weight:700"; // bajo par
    if (bruto > parHoyo) return ""; // sobre par
    return "color:var(--crema)"; // par exacto
  };

  // Marca tipo tarjeta clásica: águila (o mejor) = dos círculos azules,
  // birdie = un círculo rojo, bogey = un cuadrado, doble (o peor) = dos.
  const marcaScore = (bruto, parHoyo) => {
    if (bruto === null || bruto === undefined) return "—";
    const d = bruto - parHoyo;
    const clase = d <= -2 ? "aguila" : d === -1 ? "birdie" : d === 1 ? "bogey" : d >= 2 ? "doble" : "";
    return clase ? `<span class="sc-marca sc-marca--${clase}">${bruto}</span>` : `${bruto}`;
  };

  const scrollWrap = el(`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px" class="card"></div>`);
  const table = el(`<table style="border-collapse:collapse;width:100%"></table>`);

  // fila de hoyos
  const filaHoyos = el(`<tr></tr>`);
  filaHoyos.appendChild(el(`<td style="${headerCellStyle};text-align:left;min-width:70px">Hoyo</td>`));
  for (let h = 0; h < 18; h++) {
    filaHoyos.appendChild(el(`<td style="${headerCellStyle}">${h + 1}</td>`));
    if (h === 8) filaHoyos.appendChild(el(`<td style="${headerCellStyle};font-weight:700">OUT</td>`));
  }
  filaHoyos.appendChild(el(`<td style="${headerCellStyle};font-weight:700">IN</td>`));
  filaHoyos.appendChild(el(`<td style="${headerCellStyle};font-weight:700">TOT</td>`));
  table.appendChild(filaHoyos);

  // fila de par
  const filaPar = el(`<tr style="border-bottom:1px solid var(--linea)"></tr>`);
  filaPar.appendChild(el(`<td style="${cellStyle};text-align:left;opacity:0.7">Par</td>`));
  let parOut = 0, parIn = 0;
  for (let h = 0; h < 18; h++) {
    filaPar.appendChild(el(`<td style="${cellStyle};opacity:0.7">${par[h]}</td>`));
    if (h < 9) parOut += par[h]; else parIn += par[h];
    if (h === 8) filaPar.appendChild(el(`<td style="${cellStyle};opacity:0.7;font-weight:700">${parOut}</td>`));
  }
  filaPar.appendChild(el(`<td style="${cellStyle};opacity:0.7;font-weight:700">${parIn}</td>`));
  filaPar.appendChild(el(`<td style="${cellStyle};opacity:0.7;font-weight:700">${parOut + parIn}</td>`));
  table.appendChild(filaPar);

  // una fila por jugador (golpes), y si Stableford está activo, una fila
  // extra debajo con los puntos de ese jugador en cada hoyo
  state.players.forEach((p) => {
    const fila = el(`<tr style="${state.bets.stableford.enabled ? "" : "border-bottom:1px solid var(--linea)"}"></tr>`);
    fila.appendChild(el(`<td style="${cellStyle};text-align:left;font-weight:600">${p.name}</td>`));
    const ida = sumaGolpesBrutos(state, p.id, 0, 9);
    const vuelta = sumaGolpesBrutos(state, p.id, 9, 18);
    for (let h = 0; h < 18; h++) {
      const bruto = state.scores[p.id][h];
      fila.appendChild(el(`<td style="${cellStyle};${scoreColor(bruto, par[h])}">${marcaScore(bruto, par[h])}</td>`));
      if (h === 8) fila.appendChild(el(`<td style="${cellStyle};font-weight:700">${ida.jugados > 0 ? ida.suma : "—"}</td>`));
    }
    fila.appendChild(el(`<td style="${cellStyle};font-weight:700">${vuelta.jugados > 0 ? vuelta.suma : "—"}</td>`));
    const totalJugados = ida.jugados + vuelta.jugados;
    fila.appendChild(el(`<td style="${cellStyle};font-weight:700">${totalJugados > 0 ? ida.suma + vuelta.suma : "—"}</td>`));
    table.appendChild(fila);

    if (state.bets.stableford.enabled && state.bets.stableford.participantes.includes(p.id) && resumen.stablefordResult.totales[p.id]) {
      const puntosCellStyle = cellStyle + ";opacity:0.65;font-size:10px";
      const filaPts = el(`<tr style="border-bottom:1px solid var(--linea)"></tr>`);
      filaPts.appendChild(el(`<td style="${puntosCellStyle};text-align:left">pts</td>`));
      const puntosPorHoyo = resumen.stablefordResult.puntosPorHoyo[p.id];
      // El OUT/IN de esta tarjeta son los hoyos FÍSICOS 1-9 / 10-18 (las
      // columnas que se ven), no la "ida"/"vuelta" de la apuesta de
      // Stableford (que sigue tu ORDEN DE JUEGO real y puede ser distinta
      // si arrancas en el hoyo 10) — por eso se suman aparte aquí en vez
      // de usar totales[p.id].ida/vuelta.
      let sumaOut = 0;
      let jugadosOut = 0;
      let sumaIn = 0;
      let jugadosIn = 0;
      for (let h = 0; h < 18; h++) {
        const pts = puntosPorHoyo[h];
        filaPts.appendChild(el(`<td style="${puntosCellStyle}">${pts !== null ? pts : "—"}</td>`));
        if (pts !== null) {
          if (h < 9) { sumaOut += pts; jugadosOut++; } else { sumaIn += pts; jugadosIn++; }
        }
        if (h === 8) filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${jugadosOut > 0 ? sumaOut : "—"}</td>`));
      }
      filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${jugadosIn > 0 ? sumaIn : "—"}</td>`));
      filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${(jugadosOut + jugadosIn) > 0 ? sumaOut + sumaIn : "—"}</td>`));
      table.appendChild(filaPts);
    }
  });

  // Filas extra en la MISMA tarjeta: Foursome y Skins, hoyo por hoyo,
  // igual de compactas que la fila "pts" de arriba — para verlo junto a
  // los golpes sin tener que bajar a otra tarjeta.
  const extraCellStyle = cellStyle + ";font-weight:700";
  const signo = (v) => (v > 0 ? "+" : "") + v;
  const colorVal = (v) => (v === null ? "opacity:0.3" : v > 0 ? "color:#7ee787" : v < 0 ? "color:#ff7b72" : "color:var(--crema)");
  // Fila genérica: valores por hoyo (null = no jugado) con subtotal OUT/IN/TOT
  const agregarFilaUnidades = (etiqueta, valoresPorHoyo) => {
    const fila = el(`<tr style="border-top:1px solid var(--linea)"></tr>`);
    fila.appendChild(el(`<td style="${cellStyle};text-align:left;font-weight:600;font-size:11px">${etiqueta}</td>`));
    let out = 0, outJug = 0, inn = 0, inJug = 0;
    for (let h = 0; h < 18; h++) {
      const val = valoresPorHoyo[h];
      fila.appendChild(el(`<td style="${cellStyle};${colorVal(val)}">${val !== null ? signo(val) : "—"}</td>`));
      if (val !== null) { if (h < 9) { out += val; outJug++; } else { inn += val; inJug++; } }
      if (h === 8) fila.appendChild(el(`<td style="${extraCellStyle}">${outJug > 0 ? signo(out) : "—"}</td>`));
    }
    fila.appendChild(el(`<td style="${extraCellStyle}">${inJug > 0 ? signo(inn) : "—"}</td>`));
    fila.appendChild(el(`<td style="${extraCellStyle}">${(outJug + inJug) > 0 ? signo(out + inn) : "—"}</td>`));
    table.appendChild(fila);
  };

  // Individuales: una fila por partido, unidades de cada hoyo desde el
  // punto de vista del primer jugador (en match play: +1/-1 por hoyo ganado)
  if (state.bets.individuales.enabled) {
    resumen.individualesResults.forEach((r) => {
      const esMatchPlay = r.modo === "matchPlay";
      const valores = [];
      for (let h = 0; h < 18; h++) {
        const hr = r.holeResults[h];
        if (!hr || !hr.jugado) { valores.push(null); continue; }
        if (esMatchPlay) valores.push(hr.ganadorHoyo === r.a ? 1 : hr.ganadorHoyo === r.b ? -1 : 0);
        else valores.push(hr.diffUnidades);
      }
      agregarFilaUnidades(`${playerName(state, r.a)} vs ${playerName(state, r.b)}`, valores);
    });
  }
  if (state.bets.foursome.enabled) {
    resumen.foursomeResults.forEach((r) => {
      const baseIniciales = r.base.map((id) => playerName(state, id)).join("+");
      const rivalIniciales = r.rival.map((id) => playerName(state, id)).join("+");
      const filaFs = el(`<tr style="border-top:1px solid var(--linea)"></tr>`);
      filaFs.appendChild(el(`<td style="${cellStyle};text-align:left;font-weight:600;font-size:11px">${baseIniciales} vs ${rivalIniciales}</td>`));
      let out = 0, outJug = 0, inn = 0, inJug = 0;
      for (let h = 0; h < 18; h++) {
        const hr = r.holeResults[h];
        const val = hr && hr.jugado ? hr.diffUnidades : null;
        const color = val === null ? "opacity:0.3" : val > 0 ? "color:#7ee787" : val < 0 ? "color:#ff7b72" : "color:var(--crema)";
        filaFs.appendChild(el(`<td style="${cellStyle};${color}">${val !== null ? (val > 0 ? "+" : "") + val : "—"}</td>`));
        if (val !== null) { if (h < 9) { out += val; outJug++; } else { inn += val; inJug++; } }
        if (h === 8) filaFs.appendChild(el(`<td style="${extraCellStyle}">${outJug > 0 ? (out > 0 ? "+" : "") + out : "—"}</td>`));
      }
      filaFs.appendChild(el(`<td style="${extraCellStyle}">${inJug > 0 ? (inn > 0 ? "+" : "") + inn : "—"}</td>`));
      filaFs.appendChild(el(`<td style="${extraCellStyle}">${(outJug + inJug) > 0 ? (out + inn > 0 ? "+" : "") + (out + inn) : "—"}</td>`));
      table.appendChild(filaFs);
    });
  }
  if (state.bets.skins.enabled) {
    const filaSk = el(`<tr style="border-top:1px solid var(--linea)"></tr>`);
    filaSk.appendChild(el(`<td style="${cellStyle};text-align:left;font-weight:600">Skins</td>`));
    let out = 0, inn = 0;
    for (let h = 0; h < 18; h++) {
      const e = resumen.skinsResult.porHoyo[h];
      let texto = "—";
      let color = "opacity:0.3";
      if (e && e.jugado) {
        if (e.acumulaSiguiente) {
          texto = "acum";
          color = "opacity:0.5;font-size:10px";
        } else {
          texto = `+${Math.round(e.montoCadaGanador)}`;
          color = "color:#7ee787";
          if (h < 9) out += e.montoCadaGanador; else inn += e.montoCadaGanador;
        }
      }
      filaSk.appendChild(el(`<td style="${cellStyle};${color}">${texto}</td>`));
      if (h === 8) filaSk.appendChild(el(`<td style="${extraCellStyle}">${out > 0 ? "+" + Math.round(out) : "—"}</td>`));
    }
    filaSk.appendChild(el(`<td style="${extraCellStyle}">${inn > 0 ? "+" + Math.round(inn) : "—"}</td>`));
    filaSk.appendChild(el(`<td style="${extraCellStyle}">${(out + inn) > 0 ? "+" + Math.round(out + inn) : "—"}</td>`));
    table.appendChild(filaSk);
  }

  // Loba: por hoyo, unidades de la pareja menos las del trío (+ = gana la
  // pareja de la loba, - = gana el trío). "acum" si empataron el golpe.
  if (state.bets.loba.enabled) {
    const valores = new Array(18).fill(null);
    resumen.lobaResult.detalle.forEach((e) => {
      if (e.configurado && e.jugado) valores[e.hole - 1] = e.unidadesPareja - e.unidadesTrio;
    });
    agregarFilaUnidades("Loba (pareja)", valores);
  }

  scrollWrap.appendChild(table);
  wrap.appendChild(scrollWrap);

  wrap.appendChild(el(`<p class="section-divider">Balance neto (dinero)</p>`));

  const sorted = [...state.players].sort(
    (a, b) => resumen.balances[b.id] - resumen.balances[a.id]
  );

  sorted.forEach((p) => {
    const bal = resumen.balances[p.id];
    wrap.appendChild(el(`
      <div class="balance-row">
        <span class="balance-row__name" style="font-size:16px">${p.name}</span>
        <span class="balance-row__amount ${moneyClass(bal)}" style="font-size:18px">${fmtMoney(bal)}</span>
      </div>
    `));
  });

  // Compartir el resultado al grupo (WhatsApp u otra app). Solo incluye
  // a los jugadores que sí tienen golpes capturados en esta ronda, para no
  // mandar "Jugador 5 $0" cuando juegan 4.
  const btnCompartir = el(`<button class="btn btn-primary" style="width:100%;margin:12px 0 4px">📲 Compartir resultado</button>`);
  btnCompartir.addEventListener("click", () => {
    const course = getActiveCourse(state);
    const fecha = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    const conGolpes = sorted.filter((p) => state.scores[p.id].some((s) => s !== null));
    const lineas = conGolpes.map((p) => {
      const bal = resumen.balances[p.id];
      return `${p.name}: ${bal > 0 ? "+" : ""}${fmtMoney(bal)}`;
    });
    const texto = `⛳ Las Lomas Bets · ${course.name} · ${fecha}\n${played}/18 hoyos\n\n${lineas.join("\n")}`;
    if (navigator.share) {
      navigator.share({ text: texto }).catch(() => {});
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
    }
  });
  wrap.appendChild(btnCompartir);

  wrap.appendChild(el(`<p class="section-divider">Desglose por modalidad</p>`));

  const breakdown = el(`<div class="card"></div>`);
  state.players.forEach((p) => {
    const ind = resumen.individualesResults.reduce((sum, r) => {
      if (r.a === p.id) return sum + r.saldoA;
      if (r.b === p.id) return sum - r.saldoA;
      return sum;
    }, 0);
    const fs = resumen.foursomeResults.reduce((sum, r) => {
      // Cada jugador de la pareja cobra el monto COMPLETO del cruce, sin
      // dividir entre los 2 (confirmado por el usuario con ejemplo numérico).
      if (r.base.includes(p.id)) return sum + r.saldoTotal;
      if (r.rival.includes(p.id)) return sum - r.saldoTotal;
      return sum;
    }, 0);
    const sk = resumen.skinsResult.totalesPorJugador[p.id] || 0;
    const lob = resumen.lobaResult.balances[p.id] || 0;
    const sf = resumen.stablefordResult.balances[p.id] || 0;
    const band = resumen.banderasResult.balances[p.id] || 0;
    const tp = resumen.threePuttResult.balances[p.id] || 0;
    const chu = resumen.chupesResult.balances[p.id] || 0;

    const filas = [];
    if (state.bets.individuales.enabled) filas.push(["Individuales", ind]);
    if (state.bets.foursome.enabled) filas.push(["Foursome", fs]);
    if (state.bets.skins.enabled) filas.push(["Skins", sk]);
    if (state.bets.loba.enabled) filas.push(["Loba", lob]);
    if (state.bets.stableford.enabled) filas.push(["Stableford", sf]);
    if (state.bets.banderas.enabled) filas.push(["Banderas", band]);
    if (state.bets.threePutt.enabled) filas.push(["3-putt", tp]);
    if (state.bets.chupes.enabled) filas.push(["Chupes", chu]);

    const filasHtml = filas.map(([label, val], i) => `
      <div class="match-row" style="padding:6px 0;${i === filas.length - 1 ? "border-bottom:none" : ""}">
        <span class="match-row__names" style="font-size:15px;opacity:0.75">${label}</span>
        <span class="match-row__amount ${moneyClass(val)}" style="font-size:16px;font-weight:600">${fmtMoney(val)}</span>
      </div>
    `).join("");

    breakdown.appendChild(el(`
      <div style="margin-bottom:16px">
        <p style="font-weight:700;font-size:16px;margin:0 0 6px">${p.name}</p>
        ${filasHtml}
      </div>
    `));
  });
  wrap.appendChild(breakdown);

  /* ---- HISTORIAL DE RONDAS GUARDADAS ---- */
  apendHistorialDeRondas(wrap, state);

  return wrap;
}
