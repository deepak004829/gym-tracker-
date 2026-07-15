window.GL = window.GL || {};

GL.nav = (function () {
  const { $, qsa } = GL.dom;
  const { getState } = GL.store;
  const PANEL_IDS = { home: "panel-home", progress: "panel-progress" };

  function initNav(onShow) {
    qsa(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => showTab(button.dataset.tab, onShow));
    });
  }

  function showTab(name, onShow) {
    const state = getState();
    state.activeTab = name;
    Object.entries(PANEL_IDS).forEach(([k, id]) => $(id).classList.toggle("hidden", k !== name));
    qsa(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
    onShow?.(name);
  }

  return { initNav, showTab };
})();
