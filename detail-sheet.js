window.GL = window.GL || {};

GL.detailSheet = (function () {
  const { $, escapeHtml } = GL.dom;
  const { displayDate } = GL.date;
  const { getState, getLog } = GL.store;
  const { openSheet, closeSheet } = GL.sheet;
  const { icon } = GL.icons;

  let onEdit = () => {};
  function initDetailSheet({ onEditRequest }) {
    onEdit = onEditRequest;
    $("detailSheetClose").onclick = () => closeSheet("detailSheet");
    $("detailEditBtn").onclick = () => {
      const date = $("detailEditBtn").dataset.date;
      closeSheet("detailSheet");
      onEdit(date);
    };
  }

  function openDetailSheet(date) {
    const state = getState();
    const entry = getLog(date);
    const note = [...state.journal].find((n) => n.date === date);
    const plan = state.plans?.[date];
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });

    $("detailSheetTitle").textContent = dateLabel;
    $("detailEditBtn").dataset.date = date;
    $("detailEditBtn").classList.toggle("hidden", state.auth.isGuest);

    if (!entry) {
      $("detailSheetBody").innerHTML = `<div class="empty-state">${icon("empty")}<p>No check-in logged for this day.</p></div>`;
    } else {
      let html = `<div class="detail-status-row">
        <span class="status-pill-lg dot-${entry.status.toLowerCase()}">${entry.status}</span>
        <span class="detail-time-tag">${entry.loggedAt ? new Date(entry.loggedAt).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) : ""}</span>
      </div>`;

      // Workout focus chips
      if (entry.status === "Went" && entry.workoutType?.length) {
        html += `<div class="detail-chips">
          ${entry.workoutType.map(t => `<span class="detail-chip">${t}</span>`).join("")}
        </div>`;
      }

      // Missed reason
      if (entry.status === "Missed" && entry.reason) {
        html += `<div class="detail-block"><p class="eyebrow">What happened</p><p>${escapeHtml(entry.reason)}</p></div>`;
      }

      // Journal / quick note
      if (note?.text) {
        html += `<div class="detail-block">
          <p class="eyebrow">📝 Note</p>
          <p class="detail-note-text">${escapeHtml(note.text)}</p>
        </div>`;
      }

      // Workout plan + exercises
      if (plan && (plan.title || plan.notes || plan.exercises?.length)) {
        html += `<div class="detail-block plan-block">
          <p class="eyebrow">🏋️ Workout Plan</p>
          ${plan.title ? `<h4 class="plan-detail-title${plan.planDone ? " done" : ""}">${escapeHtml(plan.title)}</h4>` : ""}
          ${plan.focus ? `<p class="plan-detail-focus muted">${escapeHtml(plan.focus)}</p>` : ""}
          ${plan.exercises?.length ? `
          <div class="exercise-detail-list">
            ${plan.exercises.map(ex => `
              <div class="exercise-detail-row ${ex.done ? "done" : ""}">
                <div class="ex-done-dot">${ex.done ? "✓" : "○"}</div>
                <div class="ex-info">
                  <strong>${escapeHtml(ex.name || "Exercise")}</strong>
                  <div class="ex-metrics">
                    ${ex.sets ? `<span>Sets: <b>${ex.sets}</b></span>` : ""}
                    ${ex.reps ? `<span>Reps: <b>${ex.reps}</b></span>` : ""}
                    ${ex.weight ? `<span>Weight: <b>${ex.weight} kg</b></span>` : ""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>` : ""}
          ${plan.notes ? `<p class="plan-detail-notes muted">${escapeHtml(plan.notes)}</p>` : ""}
        </div>`;
      }

      $("detailSheetBody").innerHTML = html;
    }
    openSheet("detailSheet");
  }

  return { initDetailSheet, openDetailSheet };
})();
