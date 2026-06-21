/* ============================================================
   LAS LOMAS BETS — main.js
   Shell de la app: header, tabs, ciclo de render.
   ============================================================ */

(function () {
  let state = loadState();
  let activeTab = "hole"; // "config" | "hole" | "bets" | "summary"

  // Si no hay hándicaps configurados todavía (todos en 0) y no hay golpes,
  // arrancamos en la pantalla de configuración.
  const allHcpZero = state.players.every((p) => p.hcp === 0);
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
      const ok = confirm("¿Resetear toda la ronda? Se borrarán los golpes, sandys y oyes. Jugadores, hándicaps y montos se mantienen.");
      if (!ok) return;
      state.scores = {};
      state.sandies = {};
      state.oyes = {};
      state.players.forEach((p) => {
        state.scores[p.id] = emptyHoleScores();
        state.sandies[p.id] = emptySandyFlags();
        state.oyes[p.id] = emptySandyFlags();
      });
      state.round.currentHole = 1;
      onChange(state);
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
        <button class="tab-btn ${activeTab === t.id ? "active" : ""}">
          <span class="tab-btn__icon">${t.icon}</span>
          <span>${t.label}</span>
        </button>
      `);
      btn.addEventListener("click", () => {
        activeTab = t.id;
        render();
      });
      tabBar.appendChild(btn);
    });
    app.appendChild(tabBar);

    restoreFocus(focusState);
  }

  function onChange(newState, opts) {
    state = newState;
    saveState(state);
    if (!opts || !opts.skipRender) render();
  }

  render();
})();
