(function () {
  const { $ } = GL.dom;
  const { key } = GL.date;
  const { getState, loadPreferences, savePreferences, getLog, currentStreak, todayPlan } = GL.store;
  const { initNav } = GL.nav;
  const { showToast } = GL.toast;
  const { closeAllSheets } = GL.sheet;
  const { initLogSheet, openLogSheet } = GL.logSheet;
  const { initDetailSheet, openDetailSheet } = GL.detailSheet;
  const { initPlanSheet, openPlanSheet } = GL.planSheet;
  const { initAuthGate, showGate, showApp, setAuthMode } = GL.authGate;
  const { renderHome } = GL.pageHome;
  const { renderProgress, changeHistoryMonth, weekdayLabelsHTML } = GL.pageProgress;
  const { initSettingsSheet, renderSettings, applyTheme, tryAutoSchedule } = GL.settingsSheet;
  const { firebaseReady, initAuth, signOutUser } = GL.authApi;
  const { configureSync, initSync, queueProfileSync, saveLog, savePlanRecord } = GL.sync;

  const state = getState();

  function render() {
    renderHome({ onQuickStatus: handleQuickStatus, onOpenPlan: openPlanSheet, onOpenDetail: openDetailSheet });
    renderProgress({ onOpenDetail: openDetailSheet });
    if (!$("settingsSheet").classList.contains("hidden")) renderSettings();
  }

  function handleQuickStatus(status) {
    openLogSheet(status, key());
  }

  function onLogSaved(entry) {
    // Award XP for gym day
    const today = key();
    const note = (state.journal || []).find(n => n.date === today);
    const plan = state.plans?.[today];
    const hasPlan = plan && plan.exercises && plan.exercises.length > 0;
    const newAch = GL.gamification.awardXP(today, {
      gym: entry.status === "Went",
      note: !!(note?.text || entry.note),
      plan: hasPlan,
    });
    // Show achievement toast
    if (newAch && newAch.length) {
      setTimeout(() => {
        newAch.forEach(a => showToast(`${a.emoji} Achievement unlocked: ${a.label}!`));
      }, 600);
    }
    if (!state.auth.isGuest) saveLog(entry);
    render();
  }

  function setTheme(theme) {
    state.theme = theme;
    applyTheme();
    savePreferences();
    if (!state.auth.isGuest) queueProfileSync();
    renderSettings();
  }

  function saveGoal(target) {
    state.goalTarget = Math.max(1, Math.min(31, target));
    if (!state.auth.isGuest) queueProfileSync();
    renderSettings();
  }

  function exportCSV() {
    if (!state.logs.length) { showToast("Nothing to export yet."); return; }
    const rows = [["Date", "Status", "Workout focus", "Reason"], ...state.logs.map((item) => [item.date, item.status, (item.workoutType || []).join(" | "), item.reason || ""])];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "gym-log-export.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  function toggleReminder(checked) {
    state.reminder = checked;
    savePreferences();
    if (state.reminder && !("Notification" in window)) { showToast("Notifications aren't supported in this browser."); return; }
    if (state.reminder) {
      Notification.requestPermission().then((permission) => {
        if (permission !== "granted") { state.reminder = false; $("reminderToggle").checked = false; savePreferences(); showToast("Notification permission was not granted."); }
        else showToast("Daily reminder enabled.");
      });
    } else showToast("Daily reminder turned off.");
  }

  function bindStaticUI() {
    $("weekdayRow").innerHTML = weekdayLabelsHTML();
    initNav();
    $("fabLog").onclick = () => openLogSheet(getLog(key())?.status || "Went", key());
    [$("themeSystemBtn"), $("themeLightBtn"), $("themeDarkBtn")].forEach((btn) => btn.onclick = () => setTheme(btn.dataset.theme));
    $("prevMonthBtn").onclick = () => changeHistoryMonth(-1, () => renderProgress({ onOpenDetail: openDetailSheet }));
    $("nextMonthBtn").onclick = () => changeHistoryMonth(1, () => renderProgress({ onOpenDetail: openDetailSheet }));
    $("signOutBtn").onclick = async () => {
      if (state.auth.isGuest) { state.auth.isGuest = false; setAuthMode("signin"); showGate(); return; }
      try { await signOutUser(); } catch { showToast("Couldn't sign out. Try again."); }
    };
    $("goalMinus").onclick = () => saveGoal(state.goalTarget - 1);
    $("goalPlus").onclick = () => saveGoal(state.goalTarget + 1);
    $("reminderToggle").onchange = (e) => toggleReminder(e.target.checked);
    $("exportAllBtn").onclick = exportCSV;
    $("sheetScrim").onclick = closeAllSheets;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllSheets(); });

    initLogSheet({ onSave: onLogSaved, getStreakAfterSave: currentStreak });
    initDetailSheet({ onEditRequest: (date) => openLogSheet(getLog(date)?.status || "Went", date) });
    initPlanSheet({ onSave: () => {
      const today = key();
      const plan = state.plans?.[today];
      const hasPlan = plan && plan.exercises && plan.exercises.length > 0;
      if (hasPlan) {
        GL.gamification.awardXP(today, { plan: true });
      }
      if (!state.auth.isGuest) savePlanRecord(today, todayPlan());
      render();
    }});
    initSettingsSheet();
    initAuthGate({ onGuestEnter: enterGuest });

    // Home brand only visible on home tab
    document.querySelectorAll(".tab-btn").forEach(btn => {
      const orig = btn.onclick;
      btn.addEventListener("click", () => {
        const isHome = btn.dataset.tab === "home";
        const brand = document.querySelector(".home-brand-only");
        if (brand) brand.style.visibility = isHome ? "visible" : "hidden";
      });
    });
  }

  function enterGuest() {
    state.auth = { ...state.auth, user: null, isGuest: true };
    state.logs = []; state.journal = []; state.plans = {}; state.goalTarget = 12;
    showApp();
    render();
  }

  function enterApp(user) {
    state.auth = { ...state.auth, user, isGuest: false };
    state.logs = []; state.journal = []; state.plans = {}; state.cloud.ready = false;
    showApp();
    initSync(user);
    render();
  }

  function startFirebase() {
    configureSync({
      onStatus: (text) => { $("syncStatusText").textContent = text; },
      // onError: () => showToast("We couldn't sync your latest changes."),,
      onDataChange: render,
    });
    initAuth(enterApp, showGate, (message) => { showGate(); $("authError").textContent = message; $("authError").classList.remove("hidden"); });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  }

  function init() {
    loadPreferences();
    applyTheme();
    bindStaticUI();
    startFirebase();
    registerServiceWorker();
    // Auto-schedule notification if previously set
    setTimeout(() => { try { tryAutoSchedule(); } catch {} }, 1000);
    render();
  }

  init();
})();
