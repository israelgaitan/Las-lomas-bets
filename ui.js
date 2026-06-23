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
  const esDatoReal = ["lomas", "atlas", "canadas"].includes(course.id);
  const avisoTexto = esDatoReal
    ? `${course.name} ya tiene par y hándicap por hoyo 100% reales, de la tarjeta oficial del club.`
    : `${course.name} todavía tiene una plantilla genérica de par y hándicap por hoyo. Ajústala abajo con su tarjeta oficial la primera vez que juegues ahí, para que los golpes de ventaja salgan correctos.`;
  wrap.appendChild(el(`<p class="help-text">${avisoTexto}</p>`));

  /* ---- JUGADORES ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Jugadores y hándicap</h2>`));
  wrap.appendChild(el(`<p class="help-text">Cada jugador puede llevar un hándicap distinto por modalidad (ej: acuerdos históricos que no siguen el hcp oficial actual).</p>`));

  const HCP_MODALIDADES = [
    { key: "individuales", label: "Indiv." },
    { key: "foursome", label: "Foursome" },
    { key: "skins", label: "Skins" },
    { key: "loba", label: "Loba" },
    { key: "stableford", label: "Stableford" },
  ];

  state.players.forEach((p) => {
    const card = el(`
      <div class="card">
        <div class="field">
          <label>Nombre</label>
          <input type="text" value="${p.name}" data-role="name" />
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:4px">
          ${HCP_MODALIDADES.map((m) => `
            <div style="text-align:center">
              <div style="font-size:10px;opacity:0.6;margin-bottom:3px">${m.label}</div>
              <input type="number" value="${p.hcp[m.key]}" step="0.1" data-hcp-key="${m.key}"
                style="width:100%;text-align:center;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:8px;padding:8px 2px;color:var(--crema);font-family:var(--font-mono);font-size:13px" />
            </div>
          `).join("")}
        </div>
      </div>
    `);
    card.querySelector('[data-role="name"]').addEventListener("input", (e) => {
      p.name = e.target.value;
      onChange(state, { skipRender: true });
    });
    HCP_MODALIDADES.forEach((m) => {
      const input = card.querySelector(`[data-hcp-key="${m.key}"]`);
      input.addEventListener("input", (e) => {
        p.hcp[m.key] = parseFloat(e.target.value) || 0;
        onChange(state, { skipRender: true });
      });
      input.addEventListener("change", () => onChange(state));
    });
    wrap.appendChild(card);
  });

  /* ---- QUÉ SE JUEGA HOY ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Qué se juega hoy</h2>`));
  const modalidades = [
    { key: "individuales", label: "Individuales" },
    { key: "foursome", label: "Foursome cruzado" },
    { key: "skins", label: "Skins" },
    { key: "loba", label: "Loba" },
    { key: "stableford", label: "Stableford" },
    { key: "banderas", label: "Banderas / 3-putt" },
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
        <label>Foursome — $ por hoyo, hoyos 1-9 (igual para bola alta y baja)</label>
        <input type="number" value="${state.bets.foursome.crosses[0].montoIda}" data-role="fs-ida" />
      </div>
      <div class="field">
        <label>Foursome — $ por hoyo, hoyos 10-18 (el que va perdiendo puede subirlo)</label>
        <input type="number" value="${state.bets.foursome.crosses[0].montoVuelta}" data-role="fs-vuelta" />
      </div>
      <p class="help-text">Mismo monto para los 3 cruces (1+2 vs 3+4 / vs 3+5 / vs 4+5). Editable por cruce en la pestaña Apuestas.</p>

      <div class="field">
        <label>Skins — $ por hoyo</label>
        <input type="number" value="${state.bets.skins.montoPorHoyo}" data-role="skins" />
      </div>
      <p class="help-text" style="margin-top:-6px">Cada birdie/águila/hoyo en uno/sandy/oyes también cobra este monto a cada uno, además del bote por ganar el hoyo.</p>

      <div class="field">
        <label>Loba — $ base por jugador (se multiplica x3 y se reparte)</label>
        <input type="number" value="${state.bets.loba.monto}" data-role="loba" />
      </div>
      <p class="help-text" style="margin-top:-6px">Cada birdie/águila/hoyo en uno/sandy/oyes de cualquiera del equipo suma 1 unidad extra a su favor.</p>

      <div class="field">
        <label>Stableford — $ premio ida (hoyos 1-9)</label>
        <input type="number" value="${state.bets.stableford.montoIda}" data-role="sf-ida" />
      </div>
      <div class="field">
        <label>Stableford — $ premio vuelta (hoyos 10-18)</label>
        <input type="number" value="${state.bets.stableford.montoVuelta}" data-role="sf-vuelta" />
      </div>
      <div class="field">
        <label>Stableford — $ premio total (18 hoyos)</label>
        <input type="number" value="${state.bets.stableford.montoTotal}" data-role="sf-total" />
      </div>

      <div class="field">
        <label>Banderas / 3-putt — $ por bandera (3-putt = 1 bandera negativa)</label>
        <input type="number" value="${state.bets.banderas.monto}" data-role="banderas" />
      </div>
    </div>
  `);

  betsCard.querySelector('[data-role="fs-ida"]').addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    state.bets.foursome.crosses.forEach((c) => (c.montoIda = v));
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="fs-ida"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="fs-vuelta"]').addEventListener("input", (e) => {
    const v = parseFloat(e.target.value) || 0;
    state.bets.foursome.crosses.forEach((c) => (c.montoVuelta = v));
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="fs-vuelta"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="skins"]').addEventListener("input", (e) => {
    state.bets.skins.montoPorHoyo = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="skins"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="loba"]').addEventListener("input", (e) => {
    state.bets.loba.monto = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="loba"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="sf-ida"]').addEventListener("input", (e) => {
    state.bets.stableford.montoIda = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="sf-ida"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="sf-vuelta"]').addEventListener("input", (e) => {
    state.bets.stableford.montoVuelta = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="sf-vuelta"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="sf-total"]').addEventListener("input", (e) => {
    state.bets.stableford.montoTotal = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="sf-total"]').addEventListener("change", () => onChange(state));
  betsCard.querySelector('[data-role="banderas"]').addEventListener("input", (e) => {
    state.bets.banderas.monto = parseFloat(e.target.value) || 0;
    onChange(state, { skipRender: true });
  });
  betsCard.querySelector('[data-role="banderas"]').addEventListener("change", () => onChange(state));
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
    const banderasCfg = state.banderas[p.id][h];

    const row = el(`
      <div class="player-row">
        <div class="player-row__top">
          <span class="player-row__name">${p.name}</span>
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
        ${state.bets.banderas.enabled && state.bets.banderas.participantes.includes(p.id) ? `
        <div class="player-row__controls" style="margin-top:8px">
          <div class="stepper">
            <button class="stepper__btn" data-act="banderas-minus">−</button>
            <span class="stepper__value ${banderasCfg.banderas === 0 ? "empty" : ""}" data-role="banderas-value" style="font-size:16px">🚩${banderasCfg.banderas}</span>
            <button class="stepper__btn" data-act="banderas-plus">+</button>
          </div>
          <div class="event-toggles">
            <button class="event-toggle ${banderasCfg.threePutt ? "active" : ""}" data-act="threeputt">3-putt</button>
          </div>
        </div>
        ` : ""}
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
        if (banderasCfg.banderas > 0) banderasCfg.threePutt = false; // mutuamente excluyentes
        onChange(state);
      });
    }
    const threePuttBtn = row.querySelector('[data-act="threeputt"]');
    if (threePuttBtn) {
      threePuttBtn.addEventListener("click", () => {
        banderasCfg.threePutt = !banderasCfg.threePutt;
        if (banderasCfg.threePutt) banderasCfg.banderas = 0; // mutuamente excluyentes
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
        <p class="help-text">Monto de este hoyo = monto base de loba × este número. Déjalo en 1 para jugarlo normal.</p>
      </div>
    `);
    lobaCard.querySelector('[data-role="loba-select"]').addEventListener("change", (e) => {
      const val = e.target.value ? parseInt(e.target.value) : null;
      cfg.loba = val;
      if (cfg.companero === val) cfg.companero = null;
      onChange(state);
    });
    lobaCard.querySelector('[data-role="comp-select"]').addEventListener("change", (e) => {
      const val = e.target.value;
      cfg.companero = val === "" ? null : val === "solo" ? "solo" : parseInt(val);
      onChange(state);
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
    const ok = confirm(`Esto reemplaza los partidos actuales con todos los enfrentamientos entre ${participantes.length} jugadores (${(participantes.length * (participantes.length - 1)) / 2} partidos, en $0 c/u). ¿Continuar?`);
    if (!ok) return;
    state.bets.individuales.matches = generarTodosVsTodos(participantes);
    onChange(state);
  });
  participantesCard.appendChild(genBtn);
  wrap.appendChild(participantesCard);

  const indCard = el(`<div class="card"></div>`);

  if (state.bets.individuales.matches.length === 0) {
    indCard.appendChild(el(`<p class="help-text">Aún no hay partidos 1v1. Genera todos vs todos arriba, o agrega uno manualmente abajo.</p>`));
  }

  resumen.individualesResults.forEach((r, idx) => {
    const match = state.bets.individuales.matches[idx];
    const matchBlock = el(`
      <div style="margin-bottom:14px;border-bottom:1px solid var(--linea);padding-bottom:12px">
        <div class="match-row" style="border-bottom:none;padding-bottom:6px">
          <span class="match-row__names">${playerName(state, r.a)}<span class="match-row__vs">vs</span>${playerName(state, r.b)}</span>
          <span class="match-row__amount ${moneyClass(r.saldoA)}">${r.holesCounted === 0 ? "—" : fmtMoney(Math.abs(r.saldoA))}</span>
        </div>
        <div class="field-row">
          <div class="field" style="margin-bottom:6px">
            <label>$/hoyo ida (1-9)</label>
            <input type="number" value="${match.montoIda}" data-role="match-ida" />
          </div>
          <div class="field" style="margin-bottom:6px">
            <label>$/hoyo vuelta (10-18)</label>
            <input type="number" value="${match.montoVuelta}" data-role="match-vuelta" />
          </div>
        </div>
        <button class="btn btn-ghost btn-small" data-role="match-delete" style="width:100%">Eliminar partido</button>
      </div>
    `);
    matchBlock.querySelector('[data-role="match-ida"]').addEventListener("input", (e) => {
      match.montoIda = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    matchBlock.querySelector('[data-role="match-ida"]').addEventListener("change", () => onChange(state));
    matchBlock.querySelector('[data-role="match-vuelta"]').addEventListener("input", (e) => {
      match.montoVuelta = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    matchBlock.querySelector('[data-role="match-vuelta"]').addEventListener("change", () => onChange(state));
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
          ${state.players.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input data-role="monto-ida" type="number" placeholder="$/hoyo ida" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)" />
        <input data-role="monto-vuelta" type="number" placeholder="$/hoyo vuelta" style="flex:1;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)" />
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
    if (a === b) return;
    state.bets.individuales.matches.push({ a, b, montoIda, montoVuelta });
    onChange(state);
  });
  wrap.appendChild(indCard);
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
            <label>$/hoyo, hoyos 1-9</label>
            <input type="number" value="${cross.montoIda}" data-role="ida" />
          </div>
          <div class="field">
            <label>$/hoyo, hoyos 10-18</label>
            <input type="number" value="${cross.montoVuelta}" data-role="vuelta" />
          </div>
        </div>
        <p class="help-text" style="margin-top:-6px">Mismo monto aplica a bola alta y bola baja.</p>
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
  state.players.forEach((p) => {
    const ganado = resumen.skinsResult.totalesPorJugador[p.id];
    skinsCard.appendChild(el(`
      <div class="match-row">
        <span class="match-row__names">${p.name}</span>
        <span class="match-row__amount ${moneyClass(ganado)}">${fmtMoney(ganado)}</span>
      </div>
    `));
  });
  if (resumen.skinsResult.montoPendiente > 0) {
    skinsCard.appendChild(el(`<p class="help-text">Monto acumulado pendiente (empate de 3+, se suma al próximo hoyo): ${fmtMoney(resumen.skinsResult.montoPendiente)}</p>`));
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
        const ganadorTxt = d.ganador === "pareja" ? parejaNames : d.ganador === "trio" ? trioNames : (d.acumulaSiguiente ? "Empate, acumula" : "Empate");
        const multTxt = d.multiplicador > 1 ? ` (×${d.multiplicador})` : "";
        lobaCard.appendChild(el(`
          <div class="match-row">
            <span class="match-row__names">H${d.hole}${multTxt} · ${parejaNames} vs ${trioNames}</span>
            <span class="match-row__amount" style="font-size:12px">${ganadorTxt}</span>
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
    wrap.appendChild(sfCard);

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
    state.players.forEach((p) => {
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
    state.players.forEach((p) => {
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

  /* ---- BANDERAS / 3-PUTT ---- */
  if (state.bets.banderas.enabled) {
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Banderas / 3-putt</h2>`));

    const bandParticipantesCard = el(`<div class="card"></div>`);
    bandParticipantesCard.appendChild(el(`<p class="card__subtitle" style="margin-bottom:8px">¿Quién juega banderas hoy?</p>`));
    state.players.forEach((p) => {
      const checked = state.bets.banderas.participantes.includes(p.id);
      const row = el(`
        <div class="checkbox-row">
          <input type="checkbox" ${checked ? "checked" : ""} data-player-id="${p.id}" />
          <span>${p.name}</span>
        </div>
      `);
      row.querySelector("input").addEventListener("change", (e) => {
        const list = state.bets.banderas.participantes;
        if (e.target.checked) {
          if (!list.includes(p.id)) list.push(p.id);
        } else {
          const i = list.indexOf(p.id);
          if (i >= 0) list.splice(i, 1);
        }
        onChange(state);
      });
      bandParticipantesCard.appendChild(row);
    });
    wrap.appendChild(bandParticipantesCard);
    wrap.appendChild(el(`<p class="help-text">Quien no participa no cobra ni paga nada; el resto se reparte solo entre quienes sí juegan.</p>`));

    const bandCard = el(`
      <div class="card">
        <div class="field">
          <label>$ por bandera (3-putt = 1 bandera negativa)</label>
          <input type="number" value="${state.bets.banderas.monto}" data-role="monto" />
        </div>
        <p class="help-text">Marca las banderas y 3-putts de cada jugador en la pestaña Hoyo.</p>
      </div>
    `);
    bandCard.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
      state.bets.banderas.monto = parseFloat(e.target.value) || 0;
      onChange(state, { skipRender: true });
    });
    bandCard.querySelector('[data-role="monto"]').addEventListener("change", () => onChange(state));
    state.players.forEach((p) => {
      const bal = resumen.banderasResult.balances[p.id] || 0;
      bandCard.appendChild(el(`
        <div class="match-row">
          <span class="match-row__names">${p.name}</span>
          <span class="match-row__amount ${moneyClass(bal)}">${fmtMoney(bal)}</span>
        </div>
      `));
    });
    if (resumen.banderasResult.detalle.length === 0) {
      bandCard.appendChild(el(`<p class="help-text">Sin banderas ni 3-putts registrados todavía.</p>`));
    } else {
      resumen.banderasResult.detalle.slice().reverse().forEach((d) => {
        const txt = d.tipo === "banderas" ? `🚩×${d.cantidad}` : "3-putt";
        bandCard.appendChild(el(`
          <div class="match-row">
            <span class="match-row__names">H${d.hole} · ${playerName(state, d.playerId)} · ${txt}</span>
            <span class="match-row__amount ${d.tipo === "banderas" ? "amount-pos" : "amount-neg"}" style="font-size:12px">${d.tipo === "banderas" ? "+" : "-"}${fmtMoney(d.monto)}</span>
          </div>
        `));
      });
    }
    wrap.appendChild(bandCard);
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
    const sk = resumen.skinsResult.totalesPorJugador[p.id];
    const lob = resumen.lobaResult.balances[p.id];
    const sf = resumen.stablefordResult.balances[p.id] || 0;
    const band = resumen.banderasResult.balances[p.id] || 0;

    const filas = [];
    if (state.bets.individuales.enabled) filas.push(["Individuales", ind]);
    if (state.bets.foursome.enabled) filas.push(["Foursome", fs]);
    if (state.bets.skins.enabled) filas.push(["Skins", sk]);
    if (state.bets.loba.enabled) filas.push(["Loba", lob]);
    if (state.bets.stableford.enabled) filas.push(["Stableford", sf]);
    if (state.bets.banderas.enabled) filas.push(["Banderas", band]);

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
