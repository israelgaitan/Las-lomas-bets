/* ============================================================
   LAS LOMAS BETS — main.js
   Shell de la app: header, tabs, ciclo de render.
   ============================================================ */

(function () {
  let state = loadState();
  let activeTab = "hole"; // "config" | "hole" | "bets" | "summary"

  // Si no hay hándicaps configurados todavía (todos en 0) y no hay golpes,
  // arrancamos en la pantalla de configuración.
  const allHcpZero = state.players.every((p) =>
    Object.values(p.hcp).every((v) => v === 0)
  );
  const noScores = holesPlayedCount(state) === 0;
  if (allHcpZero && noScores) activeTab = "config";

  const app = document.getElementById("app");

  // Al enfocar cualquier input numérico, seleccionamos su contenido completo.
  // Así, si el valor es "0" y empiezas a escribir, se reemplaza en vez de
  // quedar pegado como prefijo ("01500" en vez de "1500").
  app.addEventListener("focusin", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "number") {
      e.target.select();
    }
  });

  // Delegación de eventos para los tabs: un solo listener permanente en
  // `app` (que nunca se destruye), en vez de un listener por botón (que se
  // pierde en cada render). Esto evita que un click en un tab se "pierda"
  // cuando el blur de un input activo dispara un render justo antes de que
  // el navegador complete el click sobre el botón original.
  app.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn && btn.dataset.tabId) {
      activeTab = btn.dataset.tabId;
      render();
    }
  });

  function captureFocus() {
    const activeEl = document.activeElement;
    if (!activeEl || !(activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")) return null;
    // Construimos un selector simple: data-role + posición entre elementos con el mismo data-role
    const role = activeEl.getAttribute("data-role");
    if (!role) return null;
    const sameRole = Array.from(document.querySelectorAll(`[data-role="${role}"]`));
    const index = sameRole.indexOf(activeEl);
    return {
      role,
      index,
      selectionStart: activeEl.selectionStart,
      selectionEnd: activeEl.selectionEnd,
    };
  }

  function restoreFocus(captured) {
    if (!captured) return;
    const sameRole = Array.from(document.querySelectorAll(`[data-role="${captured.role}"]`));
    const target = sameRole[captured.index];
    if (!target) return;
    target.focus();
    if (typeof captured.selectionStart === "number" && target.setSelectionRange) {
      try {
        target.setSelectionRange(captured.selectionStart, captured.selectionEnd);
      } catch (e) {
        // algunos tipos de input (number) no soportan setSelectionRange en todos los navegadores
      }
    }
  }

  function render() {
    const focusState = captureFocus();
    app.innerHTML = "";

    // Header
    const header = el(`
      <div class="app-header">
        <span class="app-header__title"><span class="flag">⛳</span> Las Lomas Bets</span>
        <button class="app-header__reset" data-act="reset">Resetear ronda</button>
      </div>
    `);
    header.querySelector('[data-act="reset"]').addEventListener("click", () => {
      const ok = confirm(
        "¿Resetear todo? Se borrará TODA la información que metiste a mano: jugadores, hándicaps, montos de las 7 modalidades, participantes, golpes y marcas del juego. Las canchas (par y hándicap por hoyo) se conservan."
      );
      if (!ok) return;
      const coursesToKeep = state.courses;
      const fresh = newState();
      fresh.courses = coursesToKeep;
      // si la cancha que estaba activa ya no existe (no debería pasar, pero
      // por seguridad), usamos la primera disponible
      fresh.round.courseId = coursesToKeep.some((c) => c.id === state.round.courseId)
        ? state.round.courseId
        : coursesToKeep[0].id;
      activeTab = "config";
      onChange(fresh);
    });
    app.appendChild(header);

    // Main content
    const main = el(`<div class="app-main"></div>`);
    let screen;
    if (activeTab === "config") screen = renderConfigScreen(state, onChange);
    else if (activeTab === "hole") screen = renderHoleScreen(state, onChange);
    else if (activeTab === "bets") screen = renderBetsScreen(state, onChange);
    else screen = renderSummaryScreen(state, onChange);
    main.appendChild(screen);
    app.appendChild(main);

    // Tab bar
    const tabs = [
      { id: "config", icon: "⚙️", label: "Config" },
      { id: "hole", icon: "⛳", label: "Hoyo" },
      { id: "bets", icon: "💰", label: "Apuestas" },
      { id: "summary", icon: "🏆", label: "Resumen" },
    ];
    const tabBar = el(`<div class="tab-bar"></div>`);
    tabs.forEach((t) => {
      const btn = el(`
        <button class="tab-btn ${activeTab === t.id ? "active" : ""}" data-tab-id="${t.id}">
          <span class="tab-btn__icon">${t.icon}</span>
          <span>${t.label}</span>
        </button>
      `);
      tabBar.appendChild(btn);
    });
    app.appendChild(tabBar);

    restoreFocus(focusState);
  }

  function onChange(newState, opts) {
    state = newState;
    saveState(state);
    if (opts && opts.skipRender) return;
    // Diferimos el render un instante: si este onChange fue disparado por
    // el "change"/blur de un input justo cuando el usuario tocaba otro
    // elemento (ej: un tab), esto le da tiempo al navegador a completar
    // ese click/tap antes de que reconstruyamos el DOM.
    setTimeout(render, 0);
  }

  render();
})();
