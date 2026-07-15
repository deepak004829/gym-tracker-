window.GL = window.GL || {};

GL.planSheet = (function () {
  const { $, qsa, escapeHtml } = GL.dom;
  const { displayDate } = GL.date;
  const { getState, todayPlan, previousPerformance } = GL.store;
  const { icon } = GL.icons;
  const { openSheet, closeSheet } = GL.sheet;
  const { showToast } = GL.toast;

  let onPersist = () => {};
  let saveTimer;

  function initPlanSheet({ onSave }) {
    onPersist = onSave;
    $("planSheetClose").onclick = () => closeSheet("planSheet");
    $("planSheetDone").onclick = () => closeSheet("planSheet");
    $("planTextInput").oninput = () => { todayPlan().title = $("planTextInput").value; queueSave(); };
    $("planCompleteToggle").onclick = () => {
      const plan = todayPlan();
      plan.planDone = !plan.planDone;
      queueSave();
      renderPlanDoneState(plan);
    };
    $("planNotesInput").oninput = () => { todayPlan().notes = $("planNotesInput").value; queueSave(); };
    $("addExerciseBtn").onclick = addExercise;
  }

  function openPlanSheet() {
    const plan = todayPlan();
    $("planSheetDate").textContent = displayDate();
    // Older entries stored the intention separately in `focus` — fold it in once, on open, so nothing is lost.
    if (plan.focus && !plan.title) { plan.title = plan.focus; }
    $("planTextInput").value = plan.title || "";
    $("planNotesInput").value = plan.notes || "";
    renderPlanDoneState(plan);
    renderExerciseCards();
    openSheet("planSheet");
  }

  function renderPlanDoneState(plan) {
    $("planEditorCard").classList.toggle("plan-done", !!plan.planDone);
    $("planCompleteToggle").classList.toggle("done", !!plan.planDone);
    $("planCompleteToggle").setAttribute("aria-pressed", String(!!plan.planDone));
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onPersist(), 400);
  }

  function addExercise() {
    todayPlan().exercises.push({ id: cryptoId(), name: "", sets: "", reps: "", weight: "", done: false });
    queueSave();
    renderExerciseCards();
  }

  function cryptoId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

  function knownExerciseNames() {
    const plans = getState().plans || {};
    const names = new Set();
    Object.values(plans).forEach((p) => (p.exercises || []).forEach((ex) => {
      const n = (ex.name || "").trim();
      if (n) names.add(n);
    }));
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  function renderExerciseCards() {
    const plan = todayPlan();
    const list = $("exerciseCards");
    $("emptyExercises").classList.toggle("hidden", plan.exercises.length > 0);
    list.innerHTML = plan.exercises.map((ex, index) => {
      const prev = ex.name ? previousPerformance(ex.name) : null;
      const prevText = prev ? `Last time: ${[prev.weight && `${prev.weight}kg`, prev.sets && `${prev.sets}\u00d7${prev.reps || "?"}`].filter(Boolean).join(" \u00b7 ") || "logged"}` : "";
      return `
      <div class="exercise-card" data-id="${ex.id}" data-index="${index}">
        <div class="row1">
          <span class="seq">${index + 1}</span>
          <span class="drag" data-drag>${icon("grip")}</span>
          <input class="ex-name" list="exerciseNameOptions" data-field="name" data-id="${ex.id}" value="${escapeHtml(ex.name)}" placeholder="Exercise name">
          <button type="button" class="done-toggle ${ex.done ? "done" : ""}" data-toggle-done="${ex.id}">${icon("check")}</button>
        </div>
        <div class="row2">
          <label><span>Weight (kg)</span><input inputmode="decimal" data-field="weight" data-id="${ex.id}" value="${escapeHtml(String(ex.weight ?? ""))}"></label>
          <label><span>Sets</span><input inputmode="numeric" data-field="sets" data-id="${ex.id}" value="${escapeHtml(String(ex.sets ?? ""))}"></label>
          <label><span>Reps</span><input inputmode="numeric" data-field="reps" data-id="${ex.id}" value="${escapeHtml(String(ex.reps ?? ""))}"></label>
        </div>
        ${prevText ? `<p class="prev">${prevText}</p>` : ""}
        <div class="row3">
          <button type="button" class="save" data-save="${ex.id}" aria-label="Confirm">${icon("check")}</button>
          <button type="button" class="del" data-del="${ex.id}" aria-label="Delete">${icon("x")}</button>
        </div>
      </div>`;
    }).join("");
    $("exerciseNameOptions")?.remove();
    const datalist = document.createElement("datalist");
    datalist.id = "exerciseNameOptions";
    datalist.innerHTML = knownExerciseNames().map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
    list.after(datalist);

    list.querySelectorAll("input[data-field]").forEach((input) => {
      input.oninput = () => {
        const ex = plan.exercises.find((e) => e.id === input.dataset.id);
        if (ex) { ex[input.dataset.field] = input.value; queueSave(); }
      };
    });
    list.querySelectorAll("[data-toggle-done]").forEach((btn) => {
      btn.onclick = () => {
        const ex = plan.exercises.find((e) => e.id === btn.dataset.toggleDone);
        if (ex) { ex.done = !ex.done; queueSave(); renderExerciseCards(); }
      };
    });
    list.querySelectorAll("[data-save]").forEach((btn) => {
      btn.onclick = () => {
        btn.classList.add("saved");
        showToast("Saved");
        setTimeout(() => btn.classList.remove("saved"), 700);
      };
    });
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = () => {
        const card = btn.closest(".exercise-card");
        card.classList.add("removing");
        setTimeout(() => {
          plan.exercises = plan.exercises.filter((e) => e.id !== btn.dataset.del);
          queueSave();
          renderExerciseCards();
        }, 180);
      };
    });

    enableDragReorder(list, plan);
  }

  // Pointer-based drag reorder — works with mouse and touch via unified Pointer Events.
  function enableDragReorder(list, plan) {
    list.querySelectorAll("[data-drag]").forEach((handle) => {
      handle.onpointerdown = (downEvent) => {
        const card = handle.closest(".exercise-card");
        const cards = [...list.querySelectorAll(".exercise-card")];
        let startY = downEvent.clientY;
        card.style.position = "relative";
        card.style.zIndex = "5";
        card.setPointerCapture(downEvent.pointerId);

        const onMove = (moveEvent) => {
          const dy = moveEvent.clientY - startY;
          card.style.transform = `translateY(${dy}px)`;
          const midY = card.offsetTop + dy + card.offsetHeight / 2;
          const target = cards.find((c) => c !== card && Math.abs((c.offsetTop + c.offsetHeight / 2) - midY) < c.offsetHeight / 2);
          if (target) {
            const from = Number(card.dataset.index), to = Number(target.dataset.index);
            const [moved] = plan.exercises.splice(from, 1);
            plan.exercises.splice(to, 0, moved);
            queueSave();
            renderExerciseCards();
          }
        };
        const onUp = () => {
          card.style.transform = "";
          card.style.zIndex = "";
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      };
    });
  }

  return { initPlanSheet, openPlanSheet };
})();
