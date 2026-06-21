/* ============================================================
   LAS LOMAS BETS — ui.js (parte 1: helpers)
   ============================================================ */

function fmtMoney(n) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded).toLocaleString("es-CO");
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

function holesPlayedCount(state) {
  // un hoyo cuenta como "jugado" si al menos un jugador tiene golpe ahí
  let count = 0;
  for (let h = 0; h < 18; h++) {
    const any = state.players.some((p) => state.scores[p.id][h] !== null);
    if (any) count++;
  }
  return count;
}

/* ============================================================
   PANTALLA: CONFIGURAR RONDA
   ============================================================ */

function renderConfigScreen(state, onChange) {
  const wrap = el(`<div></div>`);
  const course = getActiveCourse(state);

  /* ---- SELECTOR DE CANCHA ---- */
  wrap.appendChild(el(`<h2 class="screen-title">Cancha de hoy</h2>`));
  const courseCard = el(`
    <div class="card">
      <div class="field">
        <label>Jugando en</label>
        <select data-role="course-select" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:11px 12px;color:var(--crema);font-size:15px">
          ${state.courses.map((c) => `<option value="${c.id}" ${c.id === course.id ? "selected" : ""}>${c.name}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-ghost btn-small" data-role="add-course" style="width:100%">+ Agregar cancha nueva</button>
    </div>
  `);
  courseCard.querySelector('[data-role="course-select"]').addEventListener("change", (e) => {
    state.round.courseId = e.target.value;
    onChange(state);
  });
  courseCard.querySelector('[data-role="add-course"]').addEventListener("click", () => {
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
  });
  wrap.appendChild(courseCard);
  const esDatoReal = course.id === "lomas";
  const avisoTexto = esDatoReal
    ? `${course.name} ya tiene par y hándicap por hoyo 100% reales, de la tarjeta oficial del club.`
    : `${course.name} todavía tiene una plantilla genérica de par y hándicap por hoyo. Ajústala abajo con su tarjeta oficial la primera vez que juegues ahí, para que los golpes de ventaja salgan correctos.`;
  wrap.appendChild(el(`<p class="help-text">${avisoTexto}</p>`));

  /* ---- JUGADORES ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Jugadores y hándicap</h2>`));

  state.players.forEach((p) => {
    const card = el(`
      <div class="card">
        <div class="field-row">
          <div class="field" style="flex:2">
            <label>Nombre</label>
            <input type="text" value="${p.name}" data-role="name" />
          </div>
          <div class="field" style="flex:1">
            <label>HCP</label>
            <input type="number" value="${p.hcp}" step="0.1" data-role="hcp" />
          </div>
        </div>
      </div>
    `);
    card.querySelector('[data-role="name"]').addEventListener("input", (e) => {
      p.name = e.target.value;
      onChange(state, { skipRender: true });
    });
    card.querySelector('[data-role="hcp"]').addEventListener("input", (e) => {
      p.hcp = parseFloat(e.target.value) || 0;
      onChange(state);
    });
    wrap.appendChild(card);
  });

  /* ---- QUÉ SE JUEGA HOY ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Qué se juega hoy</h2>`));
  const modalidades = [
    { key: "individuales", label: "Individuales" },
    { key: "foursome", label: "Foursome cruzado" },
    { key: "skins", label: "Skins" },
    { key: "unidades", label: "Unidades (birdie/águila/etc.)" },
    { key: "loba", label: "Loba" },
  ];
  const modalCard = el(`<div class="card"></div>`);
  modalidades.forEach((m) => {
    const row = el(`
      <div class="checkbox-row">
        <input type="checkbox" ${state.bets[m.key].enabled ? "checked" : ""} data-key="${m.key}" />
        <span>${m.label}</span>
      </div>
    `);
    row.querySelector("input").addEventListener("change", (e) => {
      state.bets[m.key].enabled = e.target.checked;
      onChange(state);
    });
    modalCard.appendChild(row);
  });
  wrap.appendChild(modalCard);

  /* ---- MONTOS ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Montos de las apuestas</h2>`));

  const betsCard = el(`
    <div class="card">
      <div class="field">
        <label>Foursome — $ bola baja (por cruce, por hoyo)</label>
        <input type="number" value="${state.bets.foursome.crosses[0].montoBaja}" data-role="fs-baja" />
      </div>
      <div class="field">
        <label>Foursome — $ bola alta (por cruce, por hoyo)</label>
        <input type="number" value="${state.bets.foursome.crosses[0].montoAlta}" data-role="fs-alta" />
      </div>
      <p class="help-text">Mismo monto para los 3 cruces (1+2 vs 3+4 / vs 3+5 / vs 4+5). Editable por cruce en la pestaña Apuestas.</p>

      <div class="field">
        <label>Skins — $ por hoyo</label>
        <input type="number" value="${state.bets.skins.montoPorHoyo}" data-role="skins" />
      </div>

      <div class="field">
        <label>Unidades — $ por birdie / águila / hoyo en uno / sandy / oyes</label>
        <input type="number" value="${state.bets.unidades.monto}" data-role="unidades" />
      </div>

      <div class="field">
        <label>Loba — $ base por jugador (se multiplica x3 y se reparte)</label>
        <input type="number" value="${state.bets.loba.monto}" data-role="loba" />
      </div>
    </div>
  `);

  betsCard.querySelector('[data-role="fs-baja"]').addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    state.bets.foursome.crosses.forEach((c) => (c.montoBaja = v));
    onChange(state);
  });
  betsCard.querySelector('[data-role="fs-alta"]').addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    state.bets.foursome.crosses.forEach((c) => (c.montoAlta = v));
    onChange(state);
  });
  betsCard.querySelector('[data-role="skins"]').addEventListener("input", (e) => {
    state.bets.skins.montoPorHoyo = parseFloat(e.target.value) || 0;
    onChange(state);
  });
  betsCard.querySelector('[data-role="unidades"]').addEventListener("input", (e) => {
    state.bets.unidades.monto = parseFloat(e.target.value) || 0;
    onChange(state);
  });
  betsCard.querySelector('[data-role="loba"]').addEventListener("input", (e) => {
    state.bets.loba.monto = parseFloat(e.target.value) || 0;
    onChange(state);
  });
  wrap.appendChild(betsCard);

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

  return wrap;
}

/* ============================================================
   PANTALLA: TARJETA DE HOYO
   ============================================================ */

function renderHoleScreen(state, onChange) {
  const wrap = el(`<div></div>`);
  const h = state.round.currentHole - 1; // índice 0-based
  const course = getActiveCourse(state);
  const par = course.par[h];
  const si = course.strokeIndex[h];
  const isPar3 = par === 3;

  // Navegación de hoyo
  const nav = el(`
    <div class="hole-nav">
      <button class="hole-nav__btn" data-act="prev" ${h === 0 ? "disabled" : ""}>‹</button>
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
      <button class="hole-nav__btn" data-act="next" ${h === 17 ? "disabled" : ""}>›</button>
    </div>
  `);
  nav.querySelector('[data-act="prev"]').addEventListener("click", () => {
    if (h > 0) {
      state.round.currentHole -= 1;
      onChange(state);
    }
  });
  nav.querySelector('[data-act="next"]').addEventListener("click", () => {
    if (h < 17) {
      state.round.currentHole += 1;
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
      state.round.currentHole = i + 1;
      onChange(state);
    });
    progress.appendChild(dot);
  }
  wrap.appendChild(progress);

  // Fila por jugador
  state.players.forEach((p) => {
    const bruto = state.scores[p.id][h];
    const isSandy = state.sandies[p.id][h];
    const isOyes = state.oyes[p.id][h];

    const row = el(`
      <div class="player-row">
        <div class="player-row__top">
          <span class="player-row__name">${p.name}</span>
          <span class="player-row__hcp">HCP ${p.hcp}</span>
        </div>
        <div class="player-row__controls">
          <div class="stepper">
            <button class="stepper__btn" data-act="minus">−</button>
            <span class="stepper__value ${bruto === null ? "empty" : ""}" data-role="value">${bruto === null ? "—" : bruto}</span>
            <button class="stepper__btn" data-act="plus">+</button>
          </div>
          <div class="event-toggles">
            <button class="event-toggle ${isSandy ? "active" : ""}" data-act="sandy">Sandy</button>
            ${isPar3 ? `<button class="event-toggle ${isOyes ? "active" : ""}" data-act="oyes">Oyes</button>` : ""}
          </div>
        </div>
      </div>
    `);

    function currentBruto() {
      return state.scores[p.id][h];
    }

    row.querySelector('[data-act="minus"]').addEventListener("click", () => {
      const cur = currentBruto();
      const next = cur === null ? Math.max(1, par - 1) : Math.max(1, cur - 1);
      state.scores[p.id][h] = next;
      onChange(state);
    });
    row.querySelector('[data-act="plus"]').addEventListener("click", () => {
      const cur = currentBruto();
      const next = cur === null ? par : cur + 1;
      state.scores[p.id][h] = next;
      onChange(state);
    });
    row.querySelector('[data-act="sandy"]').addEventListener("click", () => {
      state.sandies[p.id][h] = !state.sandies[p.id][h];
      onChange(state);
    });
    const oyesBtn = row.querySelector('[data-act="oyes"]');
    if (oyesBtn) {
      oyesBtn.addEventListener("click", () => {
        state.oyes[p.id][h] = !state.oyes[p.id][h];
        onChange(state);
      });
    }

    // Badges de eventos detectados automáticamente
    if (bruto !== null) {
      const eventos = detectarEventos(bruto, par, isSandy, isOyes);
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
              ${state.players.filter((p) => p.id !== cfg.loba).map((p) => `<option value="${p.id}" ${cfg.companero === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <p class="help-text">El resto del grupo forma el equipo de 3 automáticamente.</p>
      </div>
    `);
    lobaCard.querySelector('[data-role="loba-select"]').addEventListener("change", (e) => {
      const val = e.target.value ? parseInt(e.target.value) : null;
      cfg.loba = val;
      if (cfg.companero === val) cfg.companero = null;
      onChange(state);
    });
    lobaCard.querySelector('[data-role="comp-select"]').addEventListener("change", (e) => {
      cfg.companero = e.target.value ? parseInt(e.target.value) : null;
      onChange(state);
    });
    wrap.appendChild(lobaCard);
  }

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
  const indCard = el(`<div class="card"></div>`);

  if (state.bets.individuales.matches.length === 0) {
    indCard.appendChild(el(`<p class="help-text">Aún no hay partidos 1v1. Agrega uno abajo.</p>`));
  }

  resumen.individualesResults.forEach((r, idx) => {
    const row = el(`
      <div class="match-row">
        <span class="match-row__names">${playerName(state, r.a)}<span class="match-row__vs">vs</span>${playerName(state, r.b)}</span>
        <span class="match-row__amount ${moneyClass(r.saldoA)}">${r.holesCounted === 0 ? "—" : fmtMoney(Math.abs(r.saldoA))}</span>
      </div>
    `);
    row.addEventListener("click", () => {
      state.bets.individuales.matches.splice(idx, 1);
      onChange(state);
    });
    indCard.appendChild(row);
  });

  const addMatchRow = el(`
    <div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <select data-role="a" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
          ${state.players.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <select data-role="b" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
          ${state.players.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <input data-role="monto" type="number" placeholder="$/hoyo" style="width:80px;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)" />
      </div>
      <button class="btn btn-ghost btn-small" data-role="add" style="margin-top:10px;width:100%">+ Agregar partido</button>
    </div>
  `);
  indCard.appendChild(addMatchRow);
  addMatchRow.querySelector('[data-role="add"]').addEventListener("click", () => {
    const a = parseInt(addMatchRow.querySelector('[data-role="a"]').value);
    const b = parseInt(addMatchRow.querySelector('[data-role="b"]').value);
    const monto = parseFloat(addMatchRow.querySelector('[data-role="monto"]').value) || 0;
    if (a === b) return;
    state.bets.individuales.matches.push({ a, b, monto });
    onChange(state);
  });
  wrap.appendChild(indCard);
  wrap.appendChild(el(`<p class="help-text">Toca un partido para eliminarlo.</p>`));
  }

  /* ---- FOURSOME ---- */
  if (state.bets.foursome.enabled) {
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
            <label>$ bola baja / hoyo</label>
            <input type="number" value="${cross.montoBaja}" data-role="baja" />
          </div>
          <div class="field">
            <label>$ bola alta / hoyo</label>
            <input type="number" value="${cross.montoAlta}" data-role="alta" />
          </div>
        </div>
        <div class="match-row" style="border-top:1px solid var(--linea);padding-top:10px">
          <span class="match-row__names">Saldo del cruce</span>
          <span class="match-row__amount ${moneyClass(r.saldoTotal)}">${fmtMoney(Math.abs(r.saldoTotal))} ${r.saldoTotal === 0 ? "" : (r.saldoTotal > 0 ? "a favor de " + baseNames : "a favor de " + rivalNames)}</span>
        </div>
      </div>
    `);
    card.querySelector('[data-role="baja"]').addEventListener("input", (e) => {
      cross.montoBaja = parseFloat(e.target.value) || 0;
      onChange(state);
    });
    card.querySelector('[data-role="alta"]').addEventListener("input", (e) => {
      cross.montoAlta = parseFloat(e.target.value) || 0;
      onChange(state);
    });
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
    onChange(state);
  });
  state.players.forEach((p) => {
    const ganado = resumen.skinsResult.totalesPorJugador[p.id];
    skinsCard.appendChild(el(`
      <div class="match-row">
        <span class="match-row__names">${p.name}</span>
        <span class="match-row__amount ${moneyClass(ganado)}">${fmtMoney(ganado)}</span>
      </div>
    `));
  });
  if (resumen.skinsResult.botePendiente > 0) {
    skinsCard.appendChild(el(`<p class="help-text">Bote acumulado pendiente (empate de 3+): ${fmtMoney(resumen.skinsResult.botePendiente)}</p>`));
  }
  wrap.appendChild(skinsCard);
  }

  /* ---- UNIDADES ---- */
  if (state.bets.unidades.enabled) {
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Unidades</h2>`));
  const uniCard = el(`
    <div class="card">
      <div class="field">
        <label>$ por birdie / águila / hoyo en uno / sandy / oyes</label>
        <input type="number" value="${state.bets.unidades.monto}" data-role="monto" />
      </div>
      <p class="help-text">Quien logra el evento cobra este monto a cada uno de los demás.</p>
    </div>
  `);
  uniCard.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
    state.bets.unidades.monto = parseFloat(e.target.value) || 0;
    onChange(state);
  });
  if (resumen.unidadesResult.detalle.length === 0) {
    uniCard.appendChild(el(`<p class="help-text">Sin eventos registrados todavía.</p>`));
  } else {
    resumen.unidadesResult.detalle.slice().reverse().forEach((d) => {
      uniCard.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">H${d.hole} · ${playerName(state, d.playerId)} · ${d.evento}</span>
          <span class="match-row__amount amount-pos">+${fmtMoney(d.monto)}</span>
        </div>
      `));
    });
  }
  wrap.appendChild(uniCard);
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
      onChange(state);
    });
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
        const parejaNames = d.pareja.map((id) => playerName(state, id)).join(" + ");
        const trioNames = d.trio.map((id) => playerName(state, id)).join(" + ");
        const ganadorTxt = d.ganador === "pareja" ? parejaNames : d.ganador === "trio" ? trioNames : "Empate";
        lobaCard.appendChild(el(`
          <div class="match-row">
            <span class="match-row__names">H${d.hole} · ${parejaNames} vs ${trioNames}</span>
            <span class="match-row__amount" style="font-size:12px">${ganadorTxt}</span>
          </div>
        `));
      });
    }
    wrap.appendChild(lobaCard);
  }

  return wrap;
}

/* ============================================================
   PANTALLA: RESUMEN
   ============================================================ */

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
    return wrap;
  }

  const sorted = [...state.players].sort(
    (a, b) => resumen.balances[b.id] - resumen.balances[a.id]
  );

  sorted.forEach((p) => {
    const bal = resumen.balances[p.id];
    wrap.appendChild(el(`
      <div class="balance-row">
        <span class="balance-row__name">${p.name}</span>
        <span class="balance-row__amount ${moneyClass(bal)}">${fmtMoney(bal)}</span>
      </div>
    `));
  });

  wrap.appendChild(el(`<p class="section-divider">Desglose por modalidad</p>`));

  const breakdown = el(`<div class="card"></div>`);
  state.players.forEach((p) => {
    const ind = resumen.individualesResults.reduce((sum, r) => {
      if (r.a === p.id) return sum + r.saldoA;
      if (r.b === p.id) return sum - r.saldoA;
      return sum;
    }, 0);
    const fs = resumen.foursomeResults.reduce((sum, r) => {
      if (r.base.includes(p.id)) return sum + r.saldoTotal / 2;
      if (r.rival.includes(p.id)) return sum - r.saldoTotal / 2;
      return sum;
    }, 0);
    const totalSkinsBote = Object.values(resumen.skinsResult.totalesPorJugador).reduce((a, b) => a + b, 0);
    const sk = resumen.skinsResult.totalesPorJugador[p.id] - totalSkinsBote / state.players.length;
    const uni = resumen.unidadesResult.balances[p.id];
    const lob = resumen.lobaResult.balances[p.id];

    const filas = [];
    if (state.bets.individuales.enabled) filas.push(["Individuales", ind]);
    if (state.bets.foursome.enabled) filas.push(["Foursome", fs]);
    if (state.bets.skins.enabled) filas.push(["Skins", sk]);
    if (state.bets.unidades.enabled) filas.push(["Unidades", uni]);
    if (state.bets.loba.enabled) filas.push(["Loba", lob]);

    const filasHtml = filas.map(([label, val], i) => `
      <div class="match-row" style="padding:4px 0;${i === filas.length - 1 ? "border-bottom:none" : ""}">
        <span class="match-row__names" style="font-size:12px;opacity:0.7">${label}</span>
        <span class="match-row__amount ${moneyClass(val)}" style="font-size:12px">${fmtMoney(val)}</span>
      </div>
    `).join("");

    breakdown.appendChild(el(`
      <div style="margin-bottom:14px">
        <p style="font-weight:600;font-size:13px;margin:0 0 6px">${p.name}</p>
        ${filasHtml}
      </div>
    `));
  });
  wrap.appendChild(breakdown);

  return wrap;
}
