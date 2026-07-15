window.GL = window.GL || {};

GL.logSheet = (function () {
  const { $, qsa } = GL.dom;
  const { key, displayDate } = GL.date;
  const { getState, getLog } = GL.store;
  const { icon } = GL.icons;
  const { openSheet, closeSheet } = GL.sheet;
  const { showToast } = GL.toast;
  const { fireConfetti } = GL.confetti;

  const FOCUS_OPTIONS = [
    { key: "Chest", icon: "dumbbell" }, { key: "Back", icon: "dumbbell" }, { key: "Legs", icon: "dumbbell" },
    { key: "Shoulders", icon: "dumbbell" }, { key: "Arms", icon: "dumbbell" }, { key: "Cardio", icon: "bolt" },
  ];

  let currentDate = key();
  let currentStatus = "Went";
  let selectedFocus = new Set();
  let onSaved = () => {};

  function initLogSheet({ onSave, getStreakAfterSave }) {
    onSaved = onSave;
    $("focusGrid").innerHTML = FOCUS_OPTIONS.map((f) => `<button type="button" class="focus-chip" data-focus="${f.key}">${icon(f.icon)}<span>${f.key}</span></button>`).join("");
    qsa(".status-pick").forEach((btn) => btn.onclick = () => selectStatus(btn.dataset.status));
    qsa(".focus-chip").forEach((btn) => btn.onclick = () => toggleFocus(btn));
    $("logSheetClose").onclick = () => closeSheet("logSheet");
    $("logSheetCancel").onclick = () => closeSheet("logSheet");
    $("logSheetSave").onclick = () => save(getStreakAfterSave);
    $("logNoteToggle").onclick = () => $("logNoteWrap").classList.toggle("hidden");
  }

  function openLogSheet(status = "Went", date = key()) {
    const state = getState();
    currentDate = date;
    const entry = getLog(date);
    currentStatus = status || entry?.status || "Went";
    selectedFocus = new Set(entry?.workoutType || []);
    $("logSheetTitle").textContent = date === key() ? "Log today" : displayDate(date);
    $("logReasonInput").value = entry?.reason || "";
    $("logNoteInput").value = "";
    $("logNoteWrap").classList.add("hidden");
    selectStatus(currentStatus);
    openSheet("logSheet");
  }

  function selectStatus(status) {
    currentStatus = status;
    qsa(".status-pick").forEach((btn) => btn.classList.toggle("selected", btn.dataset.status === status));
    $("focusSection").classList.toggle("hidden", status !== "Went");
    $("reasonField").classList.toggle("hidden", status !== "Missed");
  }

  function toggleFocus(btn) {
    const f = btn.dataset.focus;
    if (selectedFocus.has(f)) selectedFocus.delete(f); else selectedFocus.add(f);
    btn.classList.toggle("selected", selectedFocus.has(f));
  }

  function save(getStreakAfterSave) {
    const state = getState();
    if (currentStatus === "Went" && !selectedFocus.size) { showToast("Choose at least one focus area."); return; }
    const entry = {
      date: currentDate,
      status: currentStatus,
      workoutType: currentStatus === "Went" ? [...selectedFocus] : [],
      reason: currentStatus === "Missed" ? $("logReasonInput").value.trim() : "",
      updatedAt: Date.now(),
      loggedAt: new Date().toISOString(),
    };
    state.logs = state.logs.filter((item) => item.date !== currentDate);
    state.logs.push(entry);
    state.logs.sort((a, b) => a.date.localeCompare(b.date));

    const noteText = $("logNoteInput").value.trim();
    let note = null;
    if (noteText) {
      note = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: currentDate, text: noteText, createdAt: Date.now() };
      state.journal.unshift(note);
    }

    closeSheet("logSheet");
    onSaved(entry, note);

    const milestone = [7, 14, 30, 50, 100, 150, 200, 365];
    const streak = getStreakAfterSave?.();
    if (currentStatus === "Went" && milestone.includes(streak) && !state.celebratedStreaks.has(streak)) {
      state.celebratedStreaks.add(streak);
      fireConfetti();
      showToast(`\ud83c\udf89 ${streak}-day streak!`);
    } else {
      showToast("Check-in saved.");
    }
  }

  return { initLogSheet, openLogSheet };
})();
