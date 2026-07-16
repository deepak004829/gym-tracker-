(function () {
  const { $ } = GL.dom;
  const { key, displayDate } = GL.date;
  const { getState, loadPreferences, savePreferences, getLog, currentStreak, todayPlan } = GL.store;
  const { initNav } = GL.nav;
  const { showToast } = GL.toast;
  const { closeAllSheets } = GL.sheet;
  const { initLogSheet, openLogSheet } = GL.logSheet;
  const { initDetailSheet, openDetailSheet } = GL.detailSheet;
  const { initAuthGate, showGate, showApp, setAuthMode } = GL.authGate;
  const { renderHome } = GL.pageHome;
  const { renderProgress, changeHistoryMonth, weekdayLabelsHTML } = GL.pageProgress;
  const { initSettingsSheet, renderSettings, applyTheme, tryAutoSchedule } = GL.settingsSheet;
  const { firebaseReady, initAuth, signOutUser, clearLocalUserData } = GL.authApi;
  const { configureSync, initSync, queueProfileSync, saveLog, savePlanRecord } = GL.sync;

  const state = getState();

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  function render() {
    renderHome({ onQuickStatus: handleQuickStatus, onOpenDetail: openDetailSheet });
    renderProgress({ onOpenDetail: openDetailSheet });
    renderPlanner();
    renderXpBadge();
    if (!$("settingsSheet").classList.contains("hidden")) renderSettings();
  }

  function renderXpBadge() {
    const badge = $("topbarXpBadge");
    if (!badge) return;
    const totalXP = GL.gamification.getData().totalXP;
    badge.textContent = `${totalXP} XP`;
    badge.classList.remove("hidden");
  }

  function handleQuickStatus(status) {
    openLogSheet(status, key());
  }

  function onLogSaved(entry, note) {
    if (!state.auth.isGuest) saveLog(entry);
    const today = key();
    const gained = GL.gamification.awardXP(entry.date, {
      attendance: entry.status === "Went",
      note: !!note && entry.date === today,
    });
    if (gained) showToast(`+${gained} XP`);
    const newAch = GL.gamification.checkAchievements();
    newAch.forEach((a) => showToast(`🏆 Achievement unlocked: ${a.label}`));
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

  // ──────────────────────────────────────────────────────────────
  // WORKOUT PLANNER — inline on Home screen
  // ──────────────────────────────────────────────────────────────

  let _plannerDirty = false;

  function renderPlanner() {
    const plan = todayPlan();

    // Inject a default 10-min cardio warm-up if plan has never been touched today
    if (!plan._cardioInjected && (!plan.exercises || plan.exercises.length === 0)) {
      plan.exercises = [{
        id: "default-cardio-warmup",
        name: "🏃 Cardio Warm-Up",
        sets: "1",
        reps: "5 min",
        weight: "",
        done: false,
        type: "cardio",
        isDefaultCardio: true,
      }];
      plan._cardioInjected = true;
      // Don't mark as dirty — this is just the default starter
    }

    const exercises = plan.exercises || [];
    const list = $("plannerExerciseList");
    const empty = $("plannerEmpty");
    const saveBtn = $("plannerSaveBtn");

    empty.classList.toggle("hidden", exercises.length > 0);
    saveBtn.classList.toggle("hidden", !_plannerDirty);

    if (!exercises.length) { list.innerHTML = ""; return; }

    list.innerHTML = exercises.map((ex, i) => {
      const meta = buildExMeta(ex);
      return `
      <div class="planner-ex-card" data-id="${ex.id}" data-index="${i}">
        <div class="planner-ex-top">
          <span class="planner-ex-drag" data-drag title="Drag to reorder">
            <svg viewBox="0 0 24 24" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:2;opacity:.5"><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>
          </span>
          <span class="planner-ex-num">${i + 1}</span>
          <span class="planner-ex-name">${escHtml(ex.name || "Unnamed exercise")}</span>
          <span class="planner-ex-meta">${meta}</span>
        </div>
        <div class="planner-ex-actions">
          <button type="button" class="edit-ex-btn" data-id="${ex.id}" aria-label="Edit">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
          </button>
          <button type="button" class="del-btn del-ex-btn" data-id="${ex.id}" aria-label="Delete">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Delete
          </button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll(".edit-ex-btn").forEach(btn => {
      btn.onclick = () => { openExerciseEditor(btn.dataset.id); };
    });
    list.querySelectorAll(".del-ex-btn").forEach(btn => {
      btn.onclick = () => { deleteExercise(btn.dataset.id); };
    });

    // Spotify-style drag-to-reorder
    enablePlannerDrag(list, plan);
  }

  // Pointer-based drag reorder with smooth Spotify-like feel
  function enablePlannerDrag(list, plan) {
    list.querySelectorAll("[data-drag]").forEach(handle => {
      handle.style.cursor = "grab";
      handle.style.touchAction = "none";
      handle.onpointerdown = (downEvent) => {
        const card = handle.closest(".planner-ex-card");
        const cards = [...list.querySelectorAll(".planner-ex-card")];
        const startY = downEvent.clientY;
        const cardH = card.offsetHeight;

        handle.style.cursor = "grabbing";
        card.style.transition = "none";
        card.style.boxShadow = "0 8px 32px rgba(0,0,0,.22)";
        card.style.zIndex = "10";
        card.style.position = "relative";
        card.style.opacity = "0.95";
        card.setPointerCapture(downEvent.pointerId);

        let lastSwappedTo = Number(card.dataset.index);

        const onMove = (moveEvent) => {
          const dy = moveEvent.clientY - startY;
          card.style.transform = `translateY(${dy}px)`;
          const midY = card.offsetTop + dy + cardH / 2;

          cards.forEach(c => {
            if (c === card) return;
            const cMid = c.offsetTop + c.offsetHeight / 2;
            if (Math.abs(cMid - midY) < c.offsetHeight * 0.55) {
              const from = Number(card.dataset.index);
              const to = Number(c.dataset.index);
              if (from !== to && to !== lastSwappedTo) {
                lastSwappedTo = to;
                const [moved] = plan.exercises.splice(from, 1);
                plan.exercises.splice(to, 0, moved);
                markPlannerDirty();
              }
            }
          });
        };

        const onUp = () => {
          card.style.transform = "";
          card.style.boxShadow = "";
          card.style.zIndex = "";
          card.style.opacity = "";
          card.style.position = "";
          card.style.transition = "";
          handle.style.cursor = "grab";
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onUp);
        };

        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
      };
    });
  }

  function buildExMeta(ex) {
    const sets = ex.sets ? ex.sets + " set" + (ex.sets != 1 ? "s" : "") : "";
    const reps = ex.reps ? "× " + ex.reps + " reps" : "";
    return [sets, reps].filter(Boolean).join(" ");
  }

  function escHtml(str) {
    const d = document.createElement("div"); d.textContent = str; return d.innerHTML;
  }

  function cryptoId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }

  function markPlannerDirty() {
    _plannerDirty = true;
    renderPlanner();
  }

  function addExercise() {
    const plan = todayPlan();
    const newEx = { id: cryptoId(), name: "", sets: "3", reps: "10", weight: "" };
    plan.exercises.push(newEx);
    markPlannerDirty();
    // Open editor for the new exercise immediately
    openExerciseEditor(newEx.id);
  }

  function moveExercise(index, direction) {
    const plan = todayPlan();
    const exercises = plan.exercises;
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    markPlannerDirty();
  }

  function deleteExercise(id) {
    const plan = todayPlan();
    const card = $("plannerExerciseList").querySelector(`[data-id="${id}"]`);
    if (card) {
      card.classList.add("removing");
      setTimeout(() => {
        plan.exercises = plan.exercises.filter(ex => ex.id !== id);
        markPlannerDirty();
      }, 200);
    } else {
      plan.exercises = plan.exercises.filter(ex => ex.id !== id);
      markPlannerDirty();
    }
  }

  function savePlan() {
    _plannerDirty = false;
    const today = key();
    const plan = todayPlan();
    if (!state.auth.isGuest) savePlanRecord(today, plan);
    const hasRealExercises = (plan.exercises || []).some((ex) => !ex.isDefaultCardio);
    if (hasRealExercises) {
      const gained = GL.gamification.awardXP(today, { plan: true });
      if (gained) showToast(`Workout plan saved. +${gained} XP`);
      else showToast("Workout plan saved.");
      GL.gamification.checkAchievements().forEach(a => showToast(`🏆 Achievement unlocked: ${a.label}`));
    } else {
      showToast("Workout plan saved.");
    }
    renderPlanner();
  }

  // ──────────────────────────────────────────────────────────────
  // Exercise Editor (reuses the plan sheet as a modal)
  // ──────────────────────────────────────────────────────────────

  let _editingExId = null;

  function openExerciseEditor(exId) {
    _editingExId = exId;
    const plan = todayPlan();
    const ex = plan.exercises.find(e => e.id === exId) || {};
    const { openSheet, closeSheet } = GL.sheet;

    // Inject editor UI into planSheet
    const sheet = $("planSheet");
    sheet.innerHTML = `
      <div class="sheet-grip"></div>
      <button id="exEditorClose" class="sheet-close" type="button">×</button>
      <p class="eyebrow">${ex.name ? "EDIT EXERCISE" : "ADD EXERCISE"}</p>
      <h2 style="margin-bottom:20px">${ex.name ? escHtml(ex.name) : "New exercise"}</h2>

      <div class="ex-editor-field">
        <label>Exercise name</label>
        <input id="exEditorName" type="text" placeholder="e.g. Bench Press" value="${escHtml(ex.name || "")}" autocomplete="off">
      </div>
      <div class="ex-editor-sets-row">
        <div class="ex-editor-field">
          <label>Sets</label>
          <input id="exEditorSets" type="number" inputmode="numeric" min="1" max="20" placeholder="3" value="${escHtml(String(ex.sets ?? "3"))}">
        </div>
        <div class="ex-editor-field">
          <label>Reps</label>
          <input id="exEditorReps" type="text" inputmode="numeric" placeholder="10 or Failure" value="${escHtml(String(ex.reps ?? "10"))}">
        </div>
      </div>
      <div class="sheet-actions" style="margin-top:8px">
        <button id="exEditorCancel" class="btn secondary" type="button">Cancel</button>
        <button id="exEditorSave" class="btn primary" type="button">Save exercise</button>
      </div>
    `;

    $("exEditorClose").onclick = () => { cancelExerciseEdit(); closeSheet("planSheet"); };
    $("exEditorCancel").onclick = () => { cancelExerciseEdit(); closeSheet("planSheet"); };
    $("exEditorSave").onclick = () => { saveExerciseEdit(); closeSheet("planSheet"); };

    // Focus name field
    openSheet("planSheet");
    setTimeout(() => { const n = $("exEditorName"); if (n) n.focus(); }, 320);
  }

  function cancelExerciseEdit() {
    // If this was a brand new exercise with no name yet, remove it
    const plan = todayPlan();
    const ex = plan.exercises.find(e => e.id === _editingExId);
    if (ex && !ex.name) {
      plan.exercises = plan.exercises.filter(e => e.id !== _editingExId);
      renderPlanner();
    }
    _editingExId = null;
  }

  function saveExerciseEdit() {
    const plan = todayPlan();
    const ex = plan.exercises.find(e => e.id === _editingExId);
    if (!ex) { _editingExId = null; return; }

    const name = ($("exEditorName")?.value || "").trim();
    const sets = $("exEditorSets")?.value || "3";
    const reps = ($("exEditorReps")?.value || "10").trim();

    if (!name) { showToast("Enter an exercise name."); return; }
    ex.name = name;
    ex.sets = sets;
    ex.reps = reps;
    _editingExId = null;
    markPlannerDirty();
  }

  // ──────────────────────────────────────────────────────────────
  // WORKOUT MODE
  // ──────────────────────────────────────────────────────────────

  const CARDIO_MIN_MS = 5 * 60 * 1000; // Phase 1: fixed 5-minute minimum

  let _wm = {
    exercises: [],
    currentIndex: 0,
    setData: [],
    allResults: [],
    restTimer: null,
    restSeconds: 0,
    startTime: null,
    cardio: null, // active cardio sub-session for the exercise currently in view
  };

  function isCardioExercise(ex) {
    return !!(ex && (ex.type === "cardio" || ex.isDefaultCardio));
  }

  function startWorkout() {
    const plan = todayPlan();
    const exercises = (plan.exercises || []).map((ex) => ({ ...ex }));
    if (!exercises.length) { showToast("Add an exercise to today's workout first."); return; }

    $("workoutMode").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("wmProgressFill").style.width = "0%";

    _wm.exercises = exercises;
    _wm.currentIndex = 0;
    _wm.allResults = [];
    _wm.startTime = Date.now();
    _wm.cardio = null;

    showExerciseView(0);
  }

  function exitWorkout() {
    stopRestTimer();
    stopActiveCardioTimers();
    $("workoutMode").classList.add("hidden");
    document.body.style.overflow = "";
    showOnlyView(null);
  }

  function showOnlyView(id) {
    ["wmExerciseView", "wmRestView", "wmExerciseDoneView", "wmWorkoutDoneView", "wmCardioView"].forEach(v => {
      $(v).classList.toggle("hidden", v !== id);
    });
  }

  function showExerciseView(index) {
    const ex = _wm.exercises[index];
    const total = _wm.exercises.length;
    const pct = Math.round((index / total) * 100);
    $("wmProgressFill").style.width = pct + "%";

    if (isCardioExercise(ex)) {
      $("wmExerciseCounter").textContent = total > 1 ? `Exercise ${index + 1} of ${total} · Cardio` : "Cardio";
      startCardioExercise(index);
      return;
    }

    showOnlyView("wmExerciseView");
    $("wmExerciseCounter").textContent = `Exercise ${index + 1} of ${total}`;

    // Exercise name + target
    $("wmExerciseName").textContent = ex.name || "Exercise";
    const sets = ex.sets || "—";
    const reps = ex.reps || "—";
    $("wmExerciseTarget").textContent = `Target: ${sets} Sets × ${reps} Reps`;

    // Build set rows
    const numSets = parseInt(ex.sets, 10) || 1;
    _wm.setData = Array.from({ length: numSets }, () => ({ target: ex.reps, actual: "", done: false }));

    renderSetRows(ex);

    // Update complete button label — disabled until every set is marked done
    const isLast = index === _wm.exercises.length - 1;
    $("wmCompleteExerciseBtn").textContent = isLast ? "Finish workout" : "Next exercise →";
    $("wmCompleteExerciseBtn").onclick = () => completeExercise();
    updateCompleteButtonState();
  }

  function updateCompleteButtonState() {
    const btn = $("wmCompleteExerciseBtn");
    const allDone = _wm.setData.length > 0 && _wm.setData.every((s) => s.done);
    btn.disabled = !allDone;
  }

  function renderSetRows(ex) {
    const container = $("wmSetsContainer");
    container.innerHTML = _wm.setData.map((set, i) => `
      <div class="wm-set-row ${set.done ? "completed" : ""}" data-set="${i}">
        <span class="wm-set-label">S${i + 1}</span>
        <span class="wm-set-target">
          <strong>${escHtml(String(set.target))}</strong>
          reps target
        </span>
        <div class="wm-set-input-wrap">
          <label>REPS</label>
          <input class="wm-set-input" type="number" inputmode="numeric" min="0" placeholder="${escHtml(String(set.target))}" value="${escHtml(String(set.actual))}" data-set-input="${i}">
        </div>
        <button type="button" class="wm-set-done-btn ${set.done ? "done" : ""}" data-set-btn="${i}" aria-label="Mark set done">
          <svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10"/></svg>
        </button>
      </div>
    `).join("");

    container.querySelectorAll("[data-set-input]").forEach(input => {
      const i = Number(input.dataset.setInput);
      input.oninput = () => { _wm.setData[i].actual = input.value; };
    });

    container.querySelectorAll("[data-set-btn]").forEach(btn => {
      const i = Number(btn.dataset.setBtn);
      btn.onclick = () => {
        // Read latest input value
        const input = container.querySelector(`[data-set-input="${i}"]`);
        if (input) _wm.setData[i].actual = input.value;

        const alreadyDone = _wm.setData[i].done;
        if (!alreadyDone) {
          // Complete this set
          _wm.setData[i].done = true;
          renderSetRows(_wm.exercises[_wm.currentIndex]);
          // Start rest timer (unless last set)
          const allDone = _wm.setData.every(s => s.done);
          if (!allDone) startRestTimer();
        } else {
          // Toggle undone
          _wm.setData[i].done = false;
          renderSetRows(_wm.exercises[_wm.currentIndex]);
        }
        updateCompleteButtonState();
      };
    });
  }

  function completeExercise() {
    const ex = _wm.exercises[_wm.currentIndex];
    // Save results for this exercise
    _wm.allResults.push({
      name: ex.name,
      sets: _wm.setData.map(s => ({ target: s.target, actual: s.actual || s.target })),
    });

    stopRestTimer();

    const gained = GL.gamification.awardXP(key(), { exerciseId: ex.id });
    if (gained) showToast(`+${gained} XP — ${ex.name || "Exercise"} complete`);
    GL.gamification.checkAchievements().forEach(a => showToast(`🏆 Achievement unlocked: ${a.label}`));

    const isLast = _wm.currentIndex === _wm.exercises.length - 1;
    if (isLast) {
      showWorkoutComplete();
    } else {
      showExerciseDone(ex.name);
    }
  }

  function showExerciseDone(name) {
    showOnlyView("wmExerciseDoneView");
    $("wmExerciseDoneName").textContent = name;
    $("wmNextExerciseBtn").onclick = () => {
      _wm.currentIndex++;
      showExerciseView(_wm.currentIndex);
    };
  }

  function showWorkoutComplete() {
    showOnlyView("wmWorkoutDoneView");
    $("wmProgressFill").style.width = "100%";

    const setResults = _wm.allResults.filter(r => r.sets);
    const cardioResults = _wm.allResults.filter(r => r.type === "cardio");
    const isPureCardio = setResults.length === 0 && cardioResults.length > 0;

    // Calculate summary
    const totalExercises = _wm.allResults.length;
    let totalSets = 0, totalReps = 0, completedSets = 0, plannedSets = 0;
    setResults.forEach(r => {
      r.sets.forEach(s => {
        totalSets++;
        plannedSets++;
        const reps = parseInt(s.actual, 10);
        if (!isNaN(reps)) { totalReps += reps; completedSets++; }
        else { totalReps += parseInt(s.target, 10) || 0; completedSets++; }
      });
    });
    const cardioDurationMs = cardioResults.reduce((sum, r) => sum + (r.durationMs || 0), 0);
    const durationMs = Date.now() - _wm.startTime;
    const durationStr = fmtDuration(durationMs);
    const completionPct = plannedSets > 0 ? Math.round((completedSets / plannedSets) * 100) : 100;

    const doneIcon = $("wmWorkoutDoneView").querySelector(".wm-done-icon");
    const doneTitle = $("wmWorkoutDoneView").querySelector(".wm-done-title");

    if (isPureCardio) {
      doneIcon.textContent = "🏃";
      doneTitle.textContent = "Cardio complete!";
      $("wmSumExercises").textContent = fmtDuration(cardioDurationMs);
      $("wmSumExercisesLabel").textContent = "Duration";
      $("wmSumSets").textContent = cardioResults[0].laps?.length || "—";
      $("wmSumSetsLabel").textContent = "Laps";
      $("wmSumReps").textContent = "—";
      $("wmSumRepsLabel").textContent = "—";
      $("wmSumDuration").textContent = fmtDuration(cardioDurationMs);
      $("wmCompletionPct").textContent = "💪";
      setTimeout(() => { $("wmCompletionRing").style.strokeDashoffset = 0; }, 100);
    } else {
      doneIcon.textContent = "🎉";
      doneTitle.textContent = "Workout complete!";
      $("wmSumExercisesLabel").textContent = "Exercises";
      $("wmSumSetsLabel").textContent = "Sets";
      $("wmSumRepsLabel").textContent = "Total reps";
      $("wmSumExercises").textContent = totalExercises;
      $("wmSumSets").textContent = totalSets;
      $("wmSumReps").textContent = totalReps;
      $("wmSumDuration").textContent = durationStr;
      $("wmCompletionPct").textContent = completionPct + "%";
      const circumference = 213.6;
      setTimeout(() => {
        $("wmCompletionRing").style.strokeDashoffset = circumference - (circumference * completionPct / 100);
      }, 100);
    }

    // Save to Firebase
    saveWorkoutHistory(completionPct, totalSets, totalReps, durationMs);

    // All completion conditions (cardio minimum reached + every exercise +
    // every set) are satisfied by the time we reach this screen, since each
    // step above gated the next. Finalize attendance/XP/achievements now,
    // exactly once — not deferred to the Finish button, and never from
    // Preview Mode or from merely starting cardio or a workout.
    finalizeWorkoutCompletion();

    $("wmFinishBtn").onclick = () => { exitWorkout(); };
  }

  function finalizeWorkoutCompletion() {
    const today = key();
    if (!getLog(today)) {
      const entry = {
        date: today,
        status: "Went",
        workoutType: [],
        reason: "",
        updatedAt: Date.now(),
        loggedAt: new Date().toISOString(),
      };
      state.logs = state.logs.filter(l => l.date !== today);
      state.logs.push(entry);
      state.logs.sort((a, b) => a.date.localeCompare(b.date));
      if (!state.auth.isGuest) saveLog(entry);
    }
    const gained = GL.gamification.awardXP(today, { workout: true, attendance: true });
    if (gained) showToast(`Workout complete! +${gained} XP`);
    const newAch = GL.gamification.checkAchievements();
    newAch.forEach(a => showToast(`🏆 Achievement unlocked: ${a.label}`));
    render();
  }

  function saveWorkoutHistory(completionPct, totalSets, totalReps, durationMs) {
    if (state.auth.isGuest || !state.cloud.plansRef) return;
    const today = key();
    const historyRecord = {
      date: today,
      completedAt: new Date().toISOString(),
      durationMs,
      totalSets,
      totalReps,
      completionPct,
      exercises: _wm.allResults,
      updatedAt: Date.now(),
    };
    // Save alongside the plan with a workoutHistory field
    state.cloud.plansRef.doc(today).set({ workoutHistory: historyRecord }, { merge: true }).catch(console.error);
  }


  // ──────────────────────────────────────────────────────────────
  // Cardio Mode
  //
  // Cardio is just the first exercise in the plan — not the workout, not
  // attendance. It only becomes "done" once CARDIO_MIN_MS has elapsed.
  // Elapsed time is persisted to localStorage on every tick (keyed by
  // today's date) so pausing, exiting, or closing the app entirely never
  // loses progress — reopening resumes exactly where it left off.
  // ──────────────────────────────────────────────────────────────

  function cardioStorageKey(date) { return `gym-log-cardio-${date}`; }

  function loadCardioSession(date) {
    try {
      const raw = localStorage.getItem(cardioStorageKey(date));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function persistCardioSession(session) {
    session.lastPersistedAt = Date.now();
    try { localStorage.setItem(cardioStorageKey(session.date), JSON.stringify({
      date: session.date, accumulatedMs: session.accumulatedMs, running: session.running,
      lastResumeAt: session.lastResumeAt, lastPersistedAt: session.lastPersistedAt, laps: session.laps,
    })); } catch {}
  }

  function clearCardioSession(date) {
    try { localStorage.removeItem(cardioStorageKey(date)); } catch {}
  }

  function cardioElapsedMs(session) {
    return session.accumulatedMs + (session.running ? Date.now() - session.lastResumeAt : 0);
  }

  function startCardioExercise(index) {
    const today = key();
    let session = loadCardioSession(today);
    const now = Date.now();
    if (!session) {
      session = { date: today, accumulatedMs: 0, running: true, lastResumeAt: now, laps: [] };
    } else if (session.running) {
      // Resuming a session that was still marked "running" from a previous
      // page load (e.g. the app was closed/crashed without a pause). Fold
      // time only up to the last moment we KNOW the timer was actually
      // ticking (lastPersistedAt) into the bank — never trust lastResumeAt
      // across a gap, or however long the app was shut counts as elapsed.
      const knownRunEnd = session.lastPersistedAt || session.lastResumeAt;
      session.accumulatedMs += Math.max(0, knownRunEnd - session.lastResumeAt);
      session.running = true;
      session.lastResumeAt = now;
    } else {
      session.running = true;
      session.lastResumeAt = now;
    }
    persistCardioSession(session);
    _wm.cardio = session;

    showOnlyView("wmCardioView");
    renderCardioLaps();
    updateCardioDisplay();
    updateCardioStopButton();

    _wm.cardio.tickTimer = setInterval(() => {
      updateCardioDisplay();
      updateCardioStopButton();
      persistCardioSession(_wm.cardio);
    }, 1000);

    _wm.cardio.onHide = () => { if (_wm.cardio) persistCardioSession(_wm.cardio); };
    document.addEventListener("visibilitychange", _wm.cardio.onHide);
    window.addEventListener("pagehide", _wm.cardio.onHide);

    // Motivational status messages that rotate
    const motivations = [
      "Keep going 💪", "You\'re doing great 🔥", "Stay strong 💥",
      "Push it! 🚀", "Breathe and pace ⚡", "Almost there 🏁",
    ];
    let mIdx = 0;
    const statusEl = $("cardioStatus");
    _wm.cardio.motivTimer = setInterval(() => {
      mIdx = (mIdx + 1) % motivations.length;
      if (statusEl) statusEl.textContent = motivations[mIdx];
    }, 15000);
  }

  function stopActiveCardioTimers() {
    if (!_wm.cardio) return;
    if (_wm.cardio.tickTimer) { clearInterval(_wm.cardio.tickTimer); _wm.cardio.tickTimer = null; }
    if (_wm.cardio.motivTimer) { clearInterval(_wm.cardio.motivTimer); _wm.cardio.motivTimer = null; }
    if (_wm.cardio.onHide) {
      document.removeEventListener("visibilitychange", _wm.cardio.onHide);
      window.removeEventListener("pagehide", _wm.cardio.onHide);
      _wm.cardio.onHide = null;
    }
  }

  // Pause the running cardio timer (banking elapsed time) without ending
  // the exercise — used when the user exits the workout mid-cardio.
  function pauseCardioSession() {
    if (!_wm.cardio) return;
    if (_wm.cardio.running) {
      _wm.cardio.accumulatedMs += Date.now() - _wm.cardio.lastResumeAt;
      _wm.cardio.running = false;
    }
    persistCardioSession(_wm.cardio);
    stopActiveCardioTimers();
  }

  function updateCardioDisplay() {
    const elapsed = cardioElapsedMs(_wm.cardio);
    $("cardioElapsed").textContent = fmtDuration(elapsed);
  }

  function updateCardioStopButton() {
    const elapsed = cardioElapsedMs(_wm.cardio);
    const btn = $("cardioStopBtn");
    const label = $("cardioStopLabel");
    const note = $("cardioMinNote");
    if (elapsed >= CARDIO_MIN_MS) {
      btn.disabled = false;
      if (label) label.textContent = "Stop & Save";
      if (note) note.textContent = "Minimum reached — you can finish anytime";
    } else {
      btn.disabled = true;
      const remain = CARDIO_MIN_MS - elapsed;
      if (label) label.textContent = "Keep going…";
      if (note) note.textContent = `${fmtDuration(remain)} left to reach the 5:00 minimum`;
    }
  }

  function fmtDuration(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return h + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
    return m + ":" + String(s).padStart(2,"0");
  }

  function recordCardioLap() {
    if (!_wm.cardio) return;
    const totalElapsed = cardioElapsedMs(_wm.cardio);
    const lastLap = _wm.cardio.laps.length ? _wm.cardio.laps[_wm.cardio.laps.length - 1].total : 0;
    _wm.cardio.laps.push({ lapNum: _wm.cardio.laps.length + 1, total: totalElapsed, split: totalElapsed - lastLap });
    persistCardioSession(_wm.cardio);
    renderCardioLaps();
  }

  function renderCardioLaps() {
    const container = $("cardioLaps");
    const laps = (_wm.cardio && _wm.cardio.laps) || [];
    // Most recent lap on top
    const reversed = [...laps].reverse();
    container.innerHTML = reversed.map(l =>
      `<div class="cardio-lap-item">
        <span>Lap ${l.lapNum}</span>
        <span>${fmtDuration(l.split)}</span>
       </div>`
    ).join("");
  }

  // Called only once CARDIO_MIN_MS has been reached (button is disabled
  // otherwise, and this re-checks defensively).
  function finishCardioExercise() {
    if (!_wm.cardio || cardioElapsedMs(_wm.cardio) < CARDIO_MIN_MS) return;

    const durationMs = cardioElapsedMs(_wm.cardio);
    const laps = _wm.cardio.laps;
    stopActiveCardioTimers();
    clearCardioSession(key());

    const ex = _wm.exercises[_wm.currentIndex];
    _wm.allResults.push({ name: ex.name || "Cardio", type: "cardio", durationMs, laps });
    _wm.cardio = null;

    const gained = GL.gamification.awardXP(key(), { cardio: true });
    if (gained) showToast(`+${gained} XP — Cardio complete!`);
    GL.gamification.checkAchievements().forEach(a => showToast(`🏆 Achievement unlocked: ${a.label}`));

    const isLast = _wm.currentIndex === _wm.exercises.length - 1;
    if (isLast) showWorkoutComplete();
    else showExerciseDone(ex.name || "Cardio");
  }

  // ──────────────────────────────────────────────────────────────
  // Rest Timer
  // ──────────────────────────────────────────────────────────────

  function startRestTimer(seconds) {
    stopRestTimer();
    _wm.restSeconds = seconds || 60;
    showOnlyView("wmRestView");
    updateTimerDisplay();

    _wm.restTimer = setInterval(() => {
      _wm.restSeconds--;
      updateTimerDisplay();
      if (_wm.restSeconds <= 0) {
        stopRestTimer();
        // Return to exercise view
        showExerciseView(_wm.currentIndex);
      }
    }, 1000);
  }

  function stopRestTimer() {
    if (_wm.restTimer) { clearInterval(_wm.restTimer); _wm.restTimer = null; }
  }

  function updateTimerDisplay() {
    $("wmTimerDisplay").textContent = _wm.restSeconds;
  }

  // ──────────────────────────────────────────────────────────────
  // Static UI bindings
  // ──────────────────────────────────────────────────────────────

  function bindStaticUI() {
    $("weekdayRow").innerHTML = weekdayLabelsHTML();
    initNav();

    // Planner
    $("plannerAddBtn").onclick = addExercise;
    $("plannerSaveBtn").onclick = savePlan;

    // FAB → Start Workout
    $("fabStartWorkout").onclick = startWorkout;

    // Workout mode buttons
    $("wmExitBtn").onclick = () => {
      if (_wm.cardio) {
        // Cardio in progress — pause and preserve elapsed time, don't discard it
        pauseCardioSession();
        exitWorkout();
        return;
      }
      if (confirm("Exit workout? Progress will be lost.")) exitWorkout();
    };
    $("wmSkipRestBtn").onclick = () => { stopRestTimer(); showExerciseView(_wm.currentIndex); };
    $("wmAddTimeBtn").onclick = () => { _wm.restSeconds += 30; updateTimerDisplay(); };

    // Cardio mode buttons
    $("cardioLapBtn").onclick = () => recordCardioLap();
    $("cardioStopBtn").onclick = () => finishCardioExercise();

    [$("themeSystemBtn"), $("themeLightBtn"), $("themeDarkBtn")].forEach((btn) => btn.onclick = () => setTheme(btn.dataset.theme));
    $("prevMonthBtn").onclick = () => changeHistoryMonth(-1, () => renderProgress({ onOpenDetail: openDetailSheet }));
    $("nextMonthBtn").onclick = () => changeHistoryMonth(1, () => renderProgress({ onOpenDetail: openDetailSheet }));
    $("signOutBtn").onclick = async () => {
      if (state.auth.isGuest) {
        state.auth.isGuest = false;
        state.logs = []; state.journal = []; state.plans = {};
        setAuthMode("signin");
        showGate();
        return;
      }
      try {
        // 1. Unsubscribe Firestore listeners before wiping state
        if (state.cloud && state.cloud.unsubs) {
          state.cloud.unsubs.forEach((fn) => { try { fn(); } catch {} });
          state.cloud.unsubs = [];
        }
        // 2. Clear sensitive in-memory state
        state.auth = { user: null, isGuest: false };
        state.logs = []; state.journal = []; state.plans = {};
        state.cloud = { ready: false, unsubs: [], profileRef: null, logsRef: null, notesRef: null, plansRef: null };
        // 3. Wipe user-specific localStorage keys
        clearLocalUserData();
        GL.gamification.reset();
        // 4. Firebase sign-out — triggers onAuthStateChanged → showGate
        await signOutUser();
      } catch {
        showToast("Couldn't sign out. Try again.");
      }
    };
    $("goalMinus").onclick = () => saveGoal(state.goalTarget - 1);
    $("goalPlus").onclick = () => saveGoal(state.goalTarget + 1);
    $("reminderToggle").onchange = (e) => toggleReminder(e.target.checked);
    $("exportAllBtn").onclick = exportCSV;
    $("sheetScrim").onclick = closeAllSheets;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllSheets(); });

    initLogSheet({ onSave: onLogSaved, getStreakAfterSave: currentStreak });
    initDetailSheet({ onEditRequest: (date) => openLogSheet(getLog(date)?.status || "Went", date) });
    initSettingsSheet();
    initAuthGate({ onGuestEnter: enterGuest });

    // Home brand visible only on home tab
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const isHome = btn.dataset.tab === "home";
        const brand = document.querySelector(".home-brand-only");
        if (brand) brand.style.visibility = isHome ? "visible" : "hidden";
      });
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Splash Screen
  // ──────────────────────────────────────────────────────────────

  function hideSplash() {
    const splash = $("splashScreen");
    if (!splash || splash.classList.contains("splash-gone")) return;
    splash.classList.add("splash-fade");
    setTimeout(() => {
      splash.classList.add("splash-gone");
      splash.style.display = "none";
    }, 420);
  }

  // ──────────────────────────────────────────────────────────────
  // Auth / App lifecycle
  // ──────────────────────────────────────────────────────────────

  function enterGuest() {
    state.auth = { ...state.auth, user: null, isGuest: true };
    state.logs = []; state.journal = []; state.plans = {}; state.goalTarget = 12;
    GL.gamification.reset();
    hideSplash();
    showApp();
    render();
  }

  function enterApp(user) {
    state.auth = { ...state.auth, user, isGuest: false };
    state.logs = []; state.journal = []; state.plans = {}; state.cloud.ready = false;
    GL.gamification.reset();
    hideSplash();
    showApp();
    initSync(user);
    render();
  }

  function startFirebase() {
    configureSync({
      onStatus: (text) => { $("syncStatusText").textContent = text; },
      onError: () => showToast("We couldn't sync your latest changes."),
      onDataChange: render,
    });
    initAuth(
      enterApp,
      () => { hideSplash(); showGate(); },
      (message) => { hideSplash(); showGate(); $("authError").textContent = message; $("authError").classList.remove("hidden"); }
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Update notification — fired when a new SW is waiting
  // ──────────────────────────────────────────────────────────────

  let _waitingSW = null; // holds the waiting SW registration so we can skip-wait

  function showUpdateUI() {
    // Banner at the bottom of the screen
    const banner = $("updateBanner");
    if (banner) banner.classList.remove("hidden");

    // Row inside Settings (visible whenever settings sheet is rendered)
    // We store a flag so renderSettings can pick it up even if called later
    window._pwaUpdateReady = true;
    const row = document.getElementById("settingsUpdateBtn");
    if (row) row.classList.remove("hidden");
  }

  function applyUpdate() {
    if (_waitingSW) {
      // Tell the waiting SW to take over immediately
      _waitingSW.postMessage({ type: "SKIP_WAITING" });
    } else {
      // Fallback: just hard-reload; the browser will grab the new cached version
      window.location.reload();
    }
  }

  // Expose so settings-sheet.js can call it from the in-settings update row
  GL._applyUpdate = applyUpdate;

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;

    navigator.serviceWorker.register("./service-worker.js").then((reg) => {
      // A new SW just installed and is waiting (page was already open)
      if (reg.waiting) {
        _waitingSW = reg.waiting;
        showUpdateUI();
      }

      // A new SW starts installing while the page is open
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version cached and ready, old version still running
            _waitingSW = newWorker;
            showUpdateUI();
          }
        });
      });
    }).catch(() => {});

    // When the SW controller changes (after skip-wait), reload to get fresh files
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    // Wire up the update banner buttons
    const updateBtn     = $("updateBtn");
    const updateDismiss = $("updateDismissBtn");
    if (updateBtn)     updateBtn.onclick     = applyUpdate;
    if (updateDismiss) updateDismiss.onclick = () => {
      const banner = $("updateBanner");
      if (banner) banner.classList.add("hidden");
    };
  }

  // ──────────────────────────────────────────────────────────────
  // PWA Install Prompt
  // ──────────────────────────────────────────────────────────────

  function initInstallPrompt() {
    // Never show if already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Don't show if user already dismissed within 7 days
    const dismissed = localStorage.getItem("installDismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const banner   = $("installBanner");
    const native   = $("installNative");
    const ios      = $("installIos");

    function showBanner() {
      banner.classList.remove("hidden");
      // Position above tab bar only once app shell is visible
      if ($("tabBar").classList.contains("hidden")) {
        banner.classList.add("no-tabbar");
      }
    }

    function dismiss() {
      banner.classList.add("hidden");
      localStorage.setItem("installDismissed", String(Date.now()));
    }

    // ── Android / Chrome ──────────────────────────────
    window._pwaInstallPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      window._pwaInstallPrompt = e;
      native.classList.remove("hidden");
      showBanner();
    });

    $("installBtn").onclick = async () => {
      if (!window._pwaInstallPrompt) return;
      window._pwaInstallPrompt.prompt();
      const { outcome } = await window._pwaInstallPrompt.userChoice;
      window._pwaInstallPrompt = null;
      if (outcome === "accepted") {
        banner.classList.add("hidden");
      } else {
        dismiss();
      }
    };

    $("installDismissBtn").onclick = dismiss;

    // Hide banner if user installs via other means
    window.addEventListener("appinstalled", () => {
      banner.classList.add("hidden");
    });

    // ── iOS Safari ────────────────────────────────────
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|opios|chrome/i.test(navigator.userAgent);

    if (isIos && isSafari && !isStandalone) {
      // Delay slightly so it doesn't fight the auth gate animation
      setTimeout(() => {
        ios.classList.remove("hidden");
        showBanner();
      }, 3000);
    }

    $("installIosDismissBtn").onclick = dismiss;
  }

  function init() {
    loadPreferences();
    applyTheme();
    bindStaticUI();
    startFirebase();
    registerServiceWorker();
    initInstallPrompt();
    setTimeout(() => { try { tryAutoSchedule(); } catch {} }, 1000);
    render();
  }

  init();
})();
