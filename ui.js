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

// holesPlayedCount() ahora vive en logic.js (la necesita también archivarRonda)

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
      <div class="field" style="margin-top:10px">
        <label>¿En qué hoyo arrancan?</label>
        <select data-role="hoyo-inicial" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:11px 12px;color:var(--crema);font-size:15px">
          <option value="1" ${state.round.hoyoInicial === 1 ? "selected" : ""}>Hoyo 1 (normal)</option>
          <option value="10" ${state.round.hoyoInicial === 10 ? "selected" : ""}>Hoyo 10 (salida por el 10)</option>
        </select>
      </div>
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
  courseCard.querySelector('[data-role="hoyo-inicial"]').addEventListener("change", (e) => {
    const nuevo = parseInt(e.target.value);
    state.round.hoyoInicial = nuevo;
    // saltamos directo a ese hoyo, salvo que ya se hayan anotado golpes
    // (para no mover a alguien que ya iba a la mitad de la ronda)
    if (holesPlayedCount(state) === 0) {
      state.round.currentHole = nuevo;
    }
    // los bloques de 6 hoyos siguen el orden de juego, así que hay que
    // recalcularlos si cambia por dónde arrancan
    if (state.bets.foursome.rotarParejas) {
      state.bets.foursome.segmentos = generarSegmentosRotacion(state.bets.foursome.participantes, state.bets.foursome.segmentos, nuevo);
    }
    onChange(state);
  });
  wrap.appendChild(courseCard);
  const esDatoReal = ["lomas", "atlas", "canadas"].includes(course.id);
  const avisoTexto = esDatoReal
    ? `${course.name} ya tiene par y hándicap por hoyo 100% reales, de la tarjeta oficial del club.`
    : `${course.name} todavía tiene una plantilla genérica de par y hándicap por hoyo. Ajústala abajo con su tarjeta oficial la primera vez que juegues ahí, para que los golpes de ventaja salgan correctos.`;
  wrap.appendChild(el(`<p class="help-text">${avisoTexto}</p>`));

  /* ---- MIS AMIGOS (lista permanente + biblia) ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Mis amigos</h2>`));
  wrap.appendChild(el(`<p class="help-text">Guarda aquí a la gente con la que juegas seguido. La "biblia" es un número que tú ajustas a mano (gana → sube o baja, según tu acuerdo) y queda guardado como referencia; el hándicap del día en "Jugadores y hándicap" siempre lo pones tú abajo.</p>`));

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
              <input type="text" value="${f.name}" data-role="friend-name" style="flex:1;min-width:0;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:8px;padding:8px 10px;color:var(--crema)" />
              <div class="stepper" style="flex-shrink:0">
                <button class="stepper__btn" data-act="biblia-minus">−</button>
                <span class="stepper__value" data-role="biblia-value" style="min-width:30px;text-align:center">${f.biblia > 0 ? "+" + f.biblia : f.biblia}</span>
                <button class="stepper__btn" data-act="biblia-plus">+</button>
              </div>
              <button class="btn btn-ghost btn-small" data-act="delete-friend" style="padding:8px 10px;flex-shrink:0">✕</button>
            </div>
            <p class="help-text" style="margin:4px 0 0">Total histórico contra ti: <span class="${moneyClass(f.individualesTotal + f.foursomeTotal)}">${fmtMoney(f.individualesTotal + f.foursomeTotal)}</span> <span style="opacity:0.6">(Individuales ${fmtMoney(f.individualesTotal)} · Foursome ${fmtMoney(f.foursomeTotal)})</span></p>
          </div>
        `);
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

  /* ---- JUGADORES ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Jugadores y hándicap</h2>`));
  wrap.appendChild(el(`<p class="help-text">Cada jugador puede llevar un hándicap distinto por modalidad (ej: acuerdos históricos que no siguen el hcp oficial actual).</p>`));

  const yoCard = el(`
    <div class="card">
      <div class="field">
        <label>¿Cuál de estos 5 eres tú?</label>
        <select data-role="yo-select" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
          ${state.players.map((p) => `<option value="${p.id}" ${state.miPlayerId === p.id ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
      </div>
      <p class="help-text" style="margin:6px 0 0">Se usa para llevar tu historial de individuales contra cada amigo y tu saldo total por ronda (abajo en Resumen).</p>
    </div>
  `);
  yoCard.querySelector('[data-role="yo-select"]').addEventListener("change", (e) => {
    state.miPlayerId = parseInt(e.target.value);
    onChange(state);
  });
  wrap.appendChild(yoCard);

  const HCP_MODALIDADES = [
    { key: "individuales", label: "Indiv." },
    { key: "foursome", label: "Foursome" },
    { key: "skins", label: "Skins" },
    { key: "loba", label: "Loba" },
    { key: "stableford", label: "Stableford" },
  ];

  state.players.forEach((p) => {
    const friendOptions = state.friends
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => `<option value="${f.id}" ${p.friendId === f.id ? "selected" : ""}>${f.name}${f.biblia !== 0 ? ` (biblia ${f.biblia > 0 ? "+" : ""}${f.biblia})` : ""}</option>`)
      .join("");
    const card = el(`
      <div class="card">
        <div class="field">
          <label>Nombre</label>
          <input type="text" value="${p.name}" data-role="name" />
        </div>
        ${state.friends.length > 0 ? `
        <div class="field" style="margin-top:6px">
          <select data-role="pick-friend" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:8px;color:var(--crema);font-size:13px">
            <option value="">— elegir de mis amigos —</option>
            ${friendOptions}
          </select>
        </div>` : ""}
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
      p.friendId = null; // editar el nombre a mano desliga de "mis amigos"
      onChange(state, { skipRender: true });
    });
    const pickFriend = card.querySelector('[data-role="pick-friend"]');
    if (pickFriend) {
      pickFriend.addEventListener("change", (e) => {
        if (e.target.value === "") {
          p.friendId = null;
          onChange(state);
          return;
        }
        const friend = state.friends.find((f) => f.id === e.target.value);
        if (friend) {
          p.name = friend.name;
          p.friendId = friend.id;
          onChange(state);
        }
      });
    }
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

  /* ---- PAREJA BASE DE FOURSOME ---- */
  if (state.bets.foursome.enabled) {
    wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Foursome</h2>`));

    const participantesCard = el(`
      <div class="card">
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
          alert("Foursome necesita exactamente 4 o 5 participantes (4 = foursome normal, 5 = foursome cruzado).");
          // revertir el check visualmente en el próximo render
        }
        if (nParticipantes !== 4) {
          state.bets.foursome.rotarParejas = false;
        } else if (state.bets.foursome.rotarParejas) {
          state.bets.foursome.segmentos = generarSegmentosRotacion(state.bets.foursome.participantes, state.bets.foursome.segmentos, state.round.hoyoInicial);
        }
        // si la base ya no está dentro de los participantes, la reseteamos
        // a los primeros 2 participantes disponibles
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
    participantesCard.appendChild(el(`<p class="help-text" style="margin-top:8px">${nParticipantesActual === 4 ? "4 seleccionados: foursome normal, un solo cruce 2 vs 2." : nParticipantesActual === 5 ? "5 seleccionados: foursome cruzado, 3 cruces contra las 3 combinaciones." : `⚠️ ${nParticipantesActual} seleccionados — elige exactamente 4 o 5.`}</p>`));
    wrap.appendChild(participantesCard);

    const jugadoresFoursomeActuales = state.players.filter((p) => state.bets.foursome.participantes.includes(p.id));

    if (nParticipantesActual === 4) {
      const rotarCard = el(`
        <div class="card" style="margin-top:10px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" data-role="fs-rotar" ${state.bets.foursome.rotarParejas ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
            <span>Cambiar de pareja cada 6 hoyos</span>
          </label>
          <p class="help-text" style="margin:6px 0 0">Con esto cada quien juega 6 hoyos con cada uno de los otros 3, pasando por las 3 combinaciones posibles. Reemplaza la pareja base fija.</p>
        </div>
      `);
      rotarCard.querySelector('[data-role="fs-rotar"]').addEventListener("change", (e) => {
        state.bets.foursome.rotarParejas = e.target.checked;
        if (e.target.checked) {
          state.bets.foursome.segmentos = generarSegmentosRotacion(state.bets.foursome.participantes, state.bets.foursome.segmentos, state.round.hoyoInicial);
        }
        onChange(state);
      });
      wrap.appendChild(rotarCard);
    }

    if (state.bets.foursome.rotarParejas && nParticipantesActual === 4) {
      const segCard = el(`<div class="card" style="margin-top:10px"></div>`);
      const [pa, pb, pc, pd] = state.bets.foursome.participantes;
      // las 3 formas posibles de partir 4 jugadores en 2 parejas
      const opcionesPareja = [
        { base: [pa, pb], rival: [pc, pd] },
        { base: [pa, pc], rival: [pb, pd] },
        { base: [pa, pd], rival: [pb, pc] },
      ];
      const claveDe = (o) => o.base.slice().sort().join(",") + "|" + o.rival.slice().sort().join(",");
      const rangoHoyos = (seg) => {
        const nums = seg.hoyos.map((x) => x + 1);
        return `Hoyos ${nums[0]}-${nums[nums.length - 1]}`;
      };
      state.bets.foursome.segmentos.forEach((seg, i) => {
        const claveActual = claveDe(seg);
        const row = el(`
          <div class="field" style="${i > 0 ? "margin-top:14px;padding-top:14px;border-top:1px solid var(--linea)" : ""}">
            <label>${rangoHoyos(seg)} — ¿quién va con quién?</label>
            <select data-seg-pareja="${seg.id}" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema);margin-bottom:8px">
              ${opcionesPareja.map((o) => {
                const bn = o.base.map((id) => playerName(state, id)).join(" + ");
                const rn = o.rival.map((id) => playerName(state, id)).join(" + ");
                return `<option value="${claveDe(o)}" ${claveDe(o) === claveActual ? "selected" : ""}>${bn} vs ${rn}</option>`;
              }).join("")}
            </select>
            <input type="number" value="${seg.monto}" data-seg-monto="${seg.id}" placeholder="$ por hoyo" />
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
        row.querySelector("input").addEventListener("input", (e) => {
          seg.monto = parseFloat(e.target.value) || 0;
          onChange(state, { skipRender: true });
        });
        row.querySelector("input").addEventListener("change", () => onChange(state));
        segCard.appendChild(row);
      });
      segCard.appendChild(el(`<p class="help-text" style="margin:10px 0 0">Los bloques siguen el orden de juego${state.round.hoyoInicial === 10 ? " (arrancando por el 10)" : ""}. Puedes elegir a mano quién va con quién en cada bloque.</p>`));
      wrap.appendChild(segCard);
    } else {
    const baseCard = el(`
      <div class="card" style="margin-top:10px">
        <p class="card__subtitle" style="margin-bottom:8px">${nParticipantesActual === 4 ? "Elige quiénes son hoy una pareja; los otros 2 forman la pareja rival." : "Se rifan antes de jugar: elige quiénes son hoy la pareja base. Los otros 3 forman las 3 combinaciones rivales automáticamente."}</p>
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
    }

    const unidadesCard = el(`
      <div class="card" style="margin-top:10px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" data-role="fs-unidades" ${state.bets.foursome.unidadesActivas ? "checked" : ""} style="width:20px;height:20px;flex-shrink:0" />
          <span>Contar birdie/águila/hoyo en uno/sandy/metida como unidades extra</span>
        </label>
        <p class="help-text" style="margin:6px 0 0">Si lo apagas, el foursome se juega SOLO con bola alta y bola baja (más el oyes manual del hoyo, si aplica) — sin sumar puntos extra por esos eventos.</p>
      </div>
    `);
    unidadesCard.querySelector('[data-role="fs-unidades"]').addEventListener("change", (e) => {
      state.bets.foursome.unidadesActivas = e.target.checked;
      onChange(state);
    });
    wrap.appendChild(unidadesCard);
  }

  /* ---- MONTOS ---- */
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">Montos de las apuestas</h2>`));

  const crucesFs = state.bets.foursome.crosses;
  const usaRotacionMontos = state.bets.foursome.rotarParejas && state.bets.foursome.participantes.length === 4;
  const idasIguales = crucesFs.every((c) => c.montoIda === crucesFs[0].montoIda);
  const vueltasIguales = crucesFs.every((c) => c.montoVuelta === crucesFs[0].montoVuelta);
  const fsIdaValue = idasIguales ? crucesFs[0].montoIda : "";
  const fsVueltaValue = vueltasIguales ? crucesFs[0].montoVuelta : "";

  const betsCard = el(`
    <div class="card">
      ${usaRotacionMontos ? `<p class="help-text" style="margin-top:0">Estás jugando foursome con cambio de pareja cada 6 hoyos — el monto de cada segmento se edita más abajo en la sección "Foursome" o arriba en Config.</p>` : `
      <div class="field">
        <label>Foursome — $ por hoyo, hoyos 1-9 (igual para bola alta y baja)</label>
        <input type="number" value="${fsIdaValue}" placeholder="${idasIguales ? "" : "Cruces con montos distintos"}" data-role="fs-ida" />
      </div>
      <div class="field">
        <label>Foursome — $ por hoyo, hoyos 10-18 (el que va perdiendo puede subirlo)</label>
        <input type="number" value="${fsVueltaValue}" placeholder="${vueltasIguales ? "" : "Cruces con montos distintos"}" data-role="fs-vuelta" />
      </div>
      <p class="help-text">${(idasIguales && vueltasIguales) ? "Mismo monto para los 3 cruces de la pareja base. Editable por cruce en la pestaña Apuestas." : "⚠️ Los 3 cruces tienen montos distintos (los ajustaste individualmente en Apuestas). Escribe aquí un número para forzarlos a todos por igual, o usa el botón de abajo para igualarlos al del primer cruce."}</p>
      ${(!idasIguales || !vueltasIguales) ? `<button class="btn btn-ghost btn-small" data-role="fs-igualar" style="width:100%;margin-bottom:8px">Igualar los 3 cruces al del primero (${crucesFs[0].montoIda}/${crucesFs[0].montoVuelta})</button>` : ""}
      `}

      <div class="field">
        <label>Skins — $ por hoyo</label>
        <input type="number" value="${state.bets.skins.montoPorHoyo}" data-role="skins" />
      </div>
      <p class="help-text" style="margin-top:-6px">Cada birdie/águila/hoyo en uno/sandy/oyes/unidad también cobra este monto a cada uno, además del bote por ganar el hoyo.</p>

      <div class="field">
        <label>Loba — $ base por jugador (se multiplica x3 y se reparte)</label>
        <input type="number" value="${state.bets.loba.monto}" data-role="loba" />
      </div>
      <p class="help-text" style="margin-top:-6px">Cada birdie/águila/hoyo en uno/sandy/oyes/unidad de cualquiera del equipo suma 1 unidad extra a su favor.</p>

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

  const fsIdaInput = betsCard.querySelector('[data-role="fs-ida"]');
  if (fsIdaInput) {
    fsIdaInput.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value) || 0;
      state.bets.foursome.crosses.forEach((c) => (c.montoIda = v));
      onChange(state, { skipRender: true });
    });
    fsIdaInput.addEventListener("change", () => onChange(state));
  }
  const fsVueltaInput = betsCard.querySelector('[data-role="fs-vuelta"]');
  if (fsVueltaInput) {
    fsVueltaInput.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value) || 0;
      state.bets.foursome.crosses.forEach((c) => (c.montoVuelta = v));
      onChange(state, { skipRender: true });
    });
    fsVueltaInput.addEventListener("change", () => onChange(state));
  }
  const igualarBtn = betsCard.querySelector('[data-role="fs-igualar"]');
  if (igualarBtn) {
    igualarBtn.addEventListener("click", () => {
      const v1 = crucesFs[0].montoIda;
      const v2 = crucesFs[0].montoVuelta;
      state.bets.foursome.crosses.forEach((c) => {
        c.montoIda = v1;
        c.montoVuelta = v2;
      });
      onChange(state);
    });
  }
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
    if (h > 0) {
      state.round.currentHole -= 1;
      onChange(state);
    } else if (arrancaEn10) {
      state.round.currentHole = 18;
      onChange(state);
    }
  });
  nav.querySelector('[data-act="next"]').addEventListener("click", () => {
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
    const isMetida = state.metidas[p.id][h];
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
            <button class="event-toggle ${isMetida ? "active" : ""}" data-act="metida">Unidad</button>
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
        <div class="player-row__controls" style="margin-top:8px">
          <div class="stepper">
            <button class="stepper__btn" data-act="chupes-minus">−</button>
            <span class="stepper__value ${banderasCfg.chupes === 0 ? "empty" : ""}" data-role="chupes-value" style="font-size:16px">🥤${banderasCfg.chupes}</span>
            <button class="stepper__btn" data-act="chupes-plus">+</button>
          </div>
          <p class="help-text" style="margin:0">Chupes (siempre negativo, le paga a cada uno de los demás)</p>
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
      const eventos = detectarEventos(bruto, par, isSandy, isOyes, isMetida);
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

  // Oyes de individuales: marcado manual por partido 1v1, solo en hoyos
  // par 3. El ganador puede variar según el rival (ej: 1 le gana el oyes
  // a 2, pero pierde el oyes contra 3), por eso es manual y no automático.
  if (state.bets.individuales.enabled && isPar3 && state.bets.individuales.matches.length > 0) {
    wrap.appendChild(el(`<p class="section-divider">Oyes de individuales (este hoyo)</p>`));
    const oyesIndCard = el(`<div class="card"></div>`);
    if (!state.individualesOyes[h]) state.individualesOyes[h] = {};
    const cfgOyesInd = state.individualesOyes[h];
    state.bets.individuales.matches.forEach((m) => {
      const key = matchKey(m.a, m.b);
      const nameA = playerName(state, m.a);
      const nameB = playerName(state, m.b);
      const valorActual = cfgOyesInd[key] || "";
      const row = el(`
        <div class="field" style="margin-bottom:10px">
          <label>${nameA} vs ${nameB}</label>
          <select data-match-key="${key}" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
            <option value="" ${valorActual === "" ? "selected" : ""}>— sin marcar —</option>
            <option value="${m.a}" ${String(valorActual) === String(m.a) ? "selected" : ""}>Gana ${nameA}</option>
            <option value="${m.b}" ${String(valorActual) === String(m.b) ? "selected" : ""}>Gana ${nameB}</option>
          </select>
        </div>
      `);
      row.querySelector("select").addEventListener("change", (e) => {
        if (e.target.value === "") delete cfgOyesInd[key];
        else cfgOyesInd[key] = Number(e.target.value);
        onChange(state);
      });
      oyesIndCard.appendChild(row);
    });
    wrap.appendChild(oyesIndCard);
  }

  // Oyes de foursome: marcado manual por cruce (o por segmento, si hay
  // rotación de parejas), solo en hoyos par 3. Reemplaza el conteo
  // automático del botón Oyes individual para foursome.
  if (state.bets.foursome.enabled && isPar3) {
    const usaRotacion = state.bets.foursome.rotarParejas && state.bets.foursome.participantes.length === 4;
    const fuentesOyesFs = usaRotacion
      ? state.bets.foursome.segmentos.filter((seg) => seg.hoyos.includes(h))
      : state.bets.foursome.crosses;
    if (fuentesOyesFs.length > 0) {
    wrap.appendChild(el(`<p class="section-divider">Oyes de foursome (este hoyo)</p>`));
    const oyesCard = el(`<div class="card"></div>`);
    if (!state.foursomeOyes[h]) state.foursomeOyes[h] = {};
    const cfgOyes = state.foursomeOyes[h];
    fuentesOyesFs.forEach((cross) => {
      const baseNames = cross.base.map((id) => playerName(state, id)).join("+");
      const rivalNames = cross.rival.map((id) => playerName(state, id)).join("+");
      const valorActual = cfgOyes[cross.id] || "";
      const row = el(`
        <div class="field" style="margin-bottom:10px">
          <label>${baseNames} vs ${rivalNames}</label>
          <select data-cross-id="${cross.id}" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid var(--linea);border-radius:10px;padding:10px;color:var(--crema)">
            <option value="" ${valorActual === "" ? "selected" : ""}>— sin marcar —</option>
            <option value="base" ${valorActual === "base" ? "selected" : ""}>Gana ${baseNames}</option>
            <option value="rival" ${valorActual === "rival" ? "selected" : ""}>Gana ${rivalNames}</option>
          </select>
        </div>
      `);
      row.querySelector("select").addEventListener("change", (e) => {
        if (e.target.value === "") delete cfgOyes[cross.id];
        else cfgOyes[cross.id] = e.target.value;
        onChange(state);
      });
      oyesCard.appendChild(row);
    });
    wrap.appendChild(oyesCard);
    }
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
    if (state.bets.banderas.enabled) {
      filas.push(["Banderas", resumenHasta.banderasResult.balances[p.id] || 0, null]);
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
          ${state.players.map((p, i) => `<option value="${p.id}" ${i === 1 ? "selected" : ""}>${p.name}</option>`).join("")}
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
    if (a === b) {
      alert("Elige 2 jugadores distintos para crear el partido.");
      return;
    }
    state.bets.individuales.matches.push({ a, b, montoIda, montoVuelta });
    onChange(state);
  });
  wrap.appendChild(indCard);
  }

  /* ---- FOURSOME ---- */
  if (state.bets.foursome.enabled) {
  const usaRotacionApuestas = state.bets.foursome.rotarParejas && state.bets.foursome.participantes.length === 4;
  wrap.appendChild(el(`<h2 class="screen-title" style="margin-top:24px">${usaRotacionApuestas ? "Foursome (cambio de pareja cada 6 hoyos)" : "Foursome cruzado"}</h2>`));
  const rangoHoyosSeg = (seg) => {
    const nums = seg.hoyos.map((x) => x + 1);
    return `Hoyos ${nums[0]}-${nums[nums.length - 1]}`;
  };
  resumen.foursomeResults.forEach((r) => {
    const baseNames = r.base.map((id) => playerName(state, id)).join(" + ");
    const rivalNames = r.rival.map((id) => playerName(state, id)).join(" + ");

    if (usaRotacionApuestas) {
      const seg = state.bets.foursome.segmentos.find((s) => s.id === r.crossId);
      const card = el(`
        <div class="card">
          <p class="card__title">${rangoHoyosSeg(seg)}: ${baseNames}<span style="opacity:0.5;font-size:12px"> vs </span>${rivalNames}</p>
          <div class="field">
            <label>$ por hoyo</label>
            <input type="number" value="${seg.monto}" data-role="monto" />
          </div>
          <div class="match-row" style="border-top:1px solid var(--linea);padding-top:10px">
            <span class="match-row__names">Saldo del segmento</span>
            <span class="match-row__amount ${moneyClass(r.saldoTotal)}">${fmtMoney(Math.abs(r.saldoTotal))} ${r.saldoTotal === 0 ? "" : (r.saldoTotal > 0 ? "a favor de " + baseNames : "a favor de " + rivalNames)}</span>
          </div>
        </div>
      `);
      card.querySelector('[data-role="monto"]').addEventListener("input", (e) => {
        seg.monto = parseFloat(e.target.value) || 0;
        onChange(state, { skipRender: true });
      });
      card.querySelector('[data-role="monto"]').addEventListener("change", () => onChange(state));
      wrap.appendChild(card);
      return;
    }

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
  skinsCard.appendChild(el(`<p class="help-text" style="margin:4px 0 8px">Cada hoyo ganado limpio lo pagan solo los demás participantes de skins. La ventaja se calcula entre ellos, no contra todo el grupo.</p>`));

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
    sfCard.appendChild(el(`<p class="help-text" style="margin:4px 0 0">Los premios los pelean solo entre ellos, y la ventaja se calcula entre ellos, no contra todo el grupo.</p>`));
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
        const txt = d.tipo === "banderas" ? `🚩×${d.cantidad}` : d.tipo === "chupes" ? `🥤×${d.cantidad}` : "3-putt";
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

  // Tarjeta de golf: hoyo por hoyo, con OUT/IN/TOT, como una tarjeta real.
  // Colores: verde = bajo par, rojo = sobre par, blanco = par exacto.
  // Scroll horizontal porque 18 columnas no caben en pantalla de celular.
  wrap.appendChild(el(`<p class="section-divider">Tarjeta de golf</p>`));
  const course = getActiveCourse(state);
  const par = course.par;
  const cellStyle = "min-width:28px;text-align:center;padding:6px 2px;font-family:var(--font-mono);font-size:12px;white-space:nowrap";
  const headerCellStyle = cellStyle + ";opacity:0.6;font-size:10px";

  const scoreColor = (bruto, parHoyo) => {
    if (bruto === null || bruto === undefined) return "opacity:0.3";
    if (bruto < parHoyo) return "color:#7ee787;font-weight:700"; // bajo par
    if (bruto > parHoyo) return "color:#ff7b72"; // sobre par
    return "color:var(--crema)"; // par exacto
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
      fila.appendChild(el(`<td style="${cellStyle};${scoreColor(bruto, par[h])}">${bruto !== null && bruto !== undefined ? bruto : "—"}</td>`));
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
      const t = resumen.stablefordResult.totales[p.id];
      for (let h = 0; h < 18; h++) {
        const pts = puntosPorHoyo[h];
        filaPts.appendChild(el(`<td style="${puntosCellStyle}">${pts !== null ? pts : "—"}</td>`));
        if (h === 8) filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${t.ida.jugados > 0 ? t.ida.total : "—"}</td>`));
      }
      filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${t.vuelta.jugados > 0 ? t.vuelta.total : "—"}</td>`));
      filaPts.appendChild(el(`<td style="${puntosCellStyle};font-weight:700">${t.total.jugados > 0 ? t.total.total : "—"}</td>`));
      table.appendChild(filaPts);
    }
  });

  scrollWrap.appendChild(table);
  wrap.appendChild(scrollWrap);
  wrap.appendChild(el(`<p class="help-text">Desliza la tabla hacia los lados para ver todos los hoyos. Verde = bajo par, rojo = sobre par.${state.bets.stableford.enabled ? " La fila \"pts\" son los puntos Stableford de cada hoyo." : ""}</p>`));

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

    const filas = [];
    if (state.bets.individuales.enabled) filas.push(["Individuales", ind]);
    if (state.bets.foursome.enabled) filas.push(["Foursome", fs]);
    if (state.bets.skins.enabled) filas.push(["Skins", sk]);
    if (state.bets.loba.enabled) filas.push(["Loba", lob]);
    if (state.bets.stableford.enabled) filas.push(["Stableford", sf]);
    if (state.bets.banderas.enabled) filas.push(["Banderas", band]);

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
  if (state.roundsHistory.length > 0) {
    const totalAcumulado = state.roundsHistory.reduce((sum, r) => sum + r.balanceYo, 0);
    wrap.appendChild(el(`<p class="section-divider">Tu historial de rondas guardadas</p>`));
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
        histCard.appendChild(el(`
          <div class="match-row" style="padding:7px 0">
            <span class="match-row__names" style="font-size:14px">${fechaFmt} · ${r.courseName}</span>
            <span class="match-row__amount ${moneyClass(r.balanceYo)}" style="font-size:15px;font-weight:600">${fmtMoney(r.balanceYo)}</span>
          </div>
        `));
      });
    wrap.appendChild(histCard);
    wrap.appendChild(el(`<p class="help-text">Se guarda automáticamente cada vez que tocas "Resetear ronda" con golpes ya registrados.</p>`));
  }

  return wrap;
}
