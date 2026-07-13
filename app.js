const STORAGE_KEYS = {
  logs: "gym-tracker-logs",
  theme: "gym-tracker-theme",
  goal: "gym-tracker-goal",
  reminder: "gym-tracker-reminder",
  iosBannerDismissed: "gym-tracker-ios-banner-dismissed",
  journal: "gym-tracker-journal",
  updatedAt: "gym-tracker-updated-at",
};

const state = {
  logs: [],
  journal: [],
  theme: "light",
  goalTarget: 20,
  reminderDate: null,
  installPrompt: null,
  calendarView: { year: new Date().getFullYear(), month: new Date().getMonth() },
  activeTab: "punch",
};

let weeklyChart;
let monthlyChart;
let workoutChart;

const els = {};

function init() {
  cacheElements();
  loadState();
  bindEvents();
  render();
  registerServiceWorker();
  prepareInstallUi();
  warmReminder();
  maybeShowIosInstallBanner();
}

function cacheElements() {
  els.themeToggle = document.getElementById("themeToggle");
  els.installBtn = document.getElementById("installBtn");
  els.notifyBtn = document.getElementById("notifyBtn");
  els.notice = document.getElementById("notice");

  els.wentBtn = document.getElementById("wentBtn");
  els.restBtn = document.getElementById("restBtn");
  els.missedBtn = document.getElementById("missedBtn");
  els.heroDate = document.getElementById("heroDate");
  els.heroSerial = document.getElementById("heroSerial");
  els.quickNoteToggle = document.getElementById("quickNoteToggle");
  els.quickNoteWrap = document.getElementById("quickNoteWrap");
  els.quickNoteInput = document.getElementById("quickNoteInput");
  els.quickNoteSave = document.getElementById("quickNoteSave");

  els.totalDays = document.getElementById("totalDays");
  els.currentStreak = document.getElementById("currentStreak");
  els.longestStreak = document.getElementById("longestStreak");
  els.consistency = document.getElementById("consistency");
  els.currentStreak2 = document.getElementById("currentStreak2");
  els.longestStreak2 = document.getElementById("longestStreak2");
  els.consistency2 = document.getElementById("consistency2");
  els.missedDays = document.getElementById("missedDays");
  els.goalProgressText = document.getElementById("goalProgressText");

  els.calendar = document.getElementById("calendar");
  els.calendarLabel = document.getElementById("calendarLabel");
  els.prevMonthBtn = document.getElementById("prevMonthBtn");
  els.nextMonthBtn = document.getElementById("nextMonthBtn");

  els.weeklyChart = document.getElementById("weeklyChart");
  els.monthlyChart = document.getElementById("monthlyChart");
  els.workoutChart = document.getElementById("workoutChart");

  els.recentLogs = document.getElementById("recentLogs");
  els.achievements = document.getElementById("achievements");

  els.goalInput = document.getElementById("goalInput");
  els.saveGoalBtn = document.getElementById("saveGoalBtn");
  els.goalBar = document.getElementById("goalBar");
  els.goalText = document.getElementById("goalText");

  els.exportAllBtn = document.getElementById("exportAllBtn");
  els.exportMonthBtn = document.getElementById("exportMonthBtn");
  els.exportRangeBtn = document.getElementById("exportRangeBtn");
  els.rangeStart = document.getElementById("rangeStart");
  els.rangeEnd = document.getElementById("rangeEnd");

  els.journalInput = document.getElementById("journalInput");
  els.saveJournalBtn = document.getElementById("saveJournalBtn");
  els.journalList = document.getElementById("journalList");

  els.downloadBackupBtn = document.getElementById("downloadBackupBtn");
  els.restoreBackupBtn = document.getElementById("restoreBackupBtn");
  els.restoreFileInput = document.getElementById("restoreFileInput");
  els.backupStatus = document.getElementById("backupStatus");

  els.entryModal = document.getElementById("entryModal");
  els.detailModal = document.getElementById("detailModal");
  els.modalTitle = document.getElementById("modalTitle");
  els.detailTitle = document.getElementById("detailTitle");
  els.detailContent = document.getElementById("detailContent");
  els.statusSelect = document.getElementById("statusSelect");
  els.customWorkout = document.getElementById("customWorkout");
  els.workoutWrap = document.getElementById("workoutWrap");
  els.reasonWrap = document.getElementById("reasonWrap");
  els.reasonInput = document.getElementById("reasonInput");
  els.cancelBtn = document.getElementById("cancelBtn");
  els.saveBtn = document.getElementById("saveBtn");
  els.closeDetailBtn = document.getElementById("closeDetailBtn");
  els.editDetailBtn = document.getElementById("editDetailBtn");

  els.iosInstallBanner = document.getElementById("iosInstallBanner");
  els.iosBannerClose = document.getElementById("iosBannerClose");

  els.tabBtns = Array.from(document.querySelectorAll(".tab-btn"));
  els.tabPanels = {
    punch: document.getElementById("panel-punch"),
    calendar: document.getElementById("panel-calendar"),
    stats: document.getElementById("panel-stats"),
    settings: document.getElementById("panel-settings"),
  };
}

function bindEvents() {
  els.wentBtn.addEventListener("click", () => openEntryModal("Went"));
  els.restBtn.addEventListener("click", () => openEntryModal("Rest"));
  els.missedBtn.addEventListener("click", () => openEntryModal("Missed"));

  els.quickNoteToggle.addEventListener("click", () => {
    els.quickNoteWrap.classList.toggle("hidden");
    if (!els.quickNoteWrap.classList.contains("hidden")) els.quickNoteInput.focus();
  });
  els.quickNoteSave.addEventListener("click", saveQuickNote);

  els.themeToggle.addEventListener("click", toggleTheme);
  els.installBtn.addEventListener("click", installApp);
  els.notifyBtn.addEventListener("click", requestNotificationPermission);

  els.saveGoalBtn.addEventListener("click", () => {

    if (els.goalInput.disabled) {

      els.goalInput.disabled = false;

      els.saveGoalBtn.textContent = "Save Goal";

      els.goalInput.focus();

      return;
    }

    saveGoal();
  });


  els.exportAllBtn.addEventListener("click", () => exportCSV(state.logs));
  els.exportMonthBtn.addEventListener("click", exportCurrentMonthCSV);
  els.exportRangeBtn.addEventListener("click", exportSelectedRangeCSV);

  els.saveJournalBtn.addEventListener("click", saveJournalEntry);

  els.downloadBackupBtn.addEventListener("click", downloadBackup);
  els.restoreBackupBtn.addEventListener("click", () => els.restoreFileInput.click());
  els.restoreFileInput.addEventListener("change", handleRestoreFile);

  els.saveBtn.addEventListener("click", saveEntry);
  els.cancelBtn.addEventListener("click", closeEntryModal);
  els.statusSelect.addEventListener("change", updateFormVisibility);
  const customWorkoutCheck = document.getElementById("customWorkoutCheck");

if (customWorkoutCheck) {
  customWorkoutCheck.addEventListener("change", () => {
    els.customWorkout.classList.toggle(
      "hidden",
      !customWorkoutCheck.checked
    );
  });
}
  els.closeDetailBtn.addEventListener("click", closeDetailModal);
  els.editDetailBtn.addEventListener("click", () => {
    const selectedDate = els.editDetailBtn.dataset.date;
    closeDetailModal();
    openEntryModal(null, selectedDate);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEntryModal();
      closeDetailModal();
    }
  });
  els.entryModal.addEventListener("click", (event) => {
    if (event.target.id === "entryModal") closeEntryModal();
  });
  els.detailModal.addEventListener("click", (event) => {
    if (event.target.id === "detailModal") closeDetailModal();
  });

  els.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  els.iosBannerClose.addEventListener("click", dismissIosBanner);
  bindCalendarSwipe();

  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installBtn.classList.remove("hidden");
    els.installBtn.textContent = "Install";
  });
  window.addEventListener("appinstalled", () => {
    showNotice("App installed successfully.");
  });
  setInterval(checkReminder, 60000);
}

/* ================= TABS ================= */

function showTab(name) {
  state.activeTab = name;
  Object.entries(els.tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== name);
  });
  els.tabBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  if (name === "stats") {
    requestAnimationFrame(() => renderCharts());
  }
}

/* ================= STATE ================= */

function loadState() {
  try {
    const savedLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.logs) || "[]");
    state.logs = Array.isArray(savedLogs) ? savedLogs : [];
    const savedJournal = JSON.parse(localStorage.getItem(STORAGE_KEYS.journal) || "[]");
    state.journal = Array.isArray(savedJournal) ? savedJournal : [];
    state.theme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
    state.goalTarget = Number(localStorage.getItem(STORAGE_KEYS.goal) || 20);
    state.reminderDate = localStorage.getItem(STORAGE_KEYS.reminder);
  } catch (error) {
    console.warn("Unable to load saved data", error);
  }
  applyTheme();
  if (state.goalTarget > 0) {

  els.goalInput.value = state.goalTarget;

  els.goalInput.disabled = true;

  if (els.saveGoalBtn) {
    els.saveGoalBtn.textContent = "Edit Goal";
  }
}

}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
  localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(state.journal));
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  localStorage.setItem(STORAGE_KEYS.goal, String(state.goalTarget));
  localStorage.setItem(STORAGE_KEYS.updatedAt, String(Date.now()));
  if (state.reminderDate) {
    localStorage.setItem(STORAGE_KEYS.reminder, state.reminderDate);
  }
}

function applyTheme() {
  document.body.classList.toggle("dark", state.theme === "dark");
  els.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.theme === "dark" ? "#0B0F09" : "#EFF1EA");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
  render();
}
function saveGoal() {

  const target = Number(els.goalInput.value);

  if (!target || target < 1) {
    showNotice("Please enter a valid goal.");
    return;
  }

  state.goalTarget = target;

  saveState();

  els.goalInput.disabled = true;

  els.saveGoalBtn.textContent = "Edit Goal";

  renderGoal();

  showNotice("Goal saved.");
}

function showNotice(message) {
  els.notice.textContent = message;
  els.notice.classList.remove("hidden");
  clearTimeout(showNotice.timeout);
  showNotice.timeout = setTimeout(() => els.notice.classList.add("hidden"), 2600);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEntry(dateKey) {
  return state.logs.find((entry) => entry.date === dateKey) || null;
}

function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ================= ENTRY MODAL ================= */


function openEntryModal(defaultStatus = "Went", dateKey = getTodayKey()) {
  const entry = getEntry(dateKey);

  els.modalTitle.textContent =
    entry
      ? `Edit ${formatDateLabel(dateKey)}`
      : `Log ${formatDateLabel(dateKey)}`;

  /* force selected button status */
  els.statusSelect.value = defaultStatus;

  document
    .querySelectorAll('#workoutGroup input[type="checkbox"]')
    .forEach(cb => cb.checked = false);

  if (
    entry &&
    entry.status === defaultStatus &&
    Array.isArray(entry.workoutType)
  ) {
    entry.workoutType.forEach(type => {
      const checkbox = document.querySelector(
        `#workoutGroup input[value="${type}"]`
      );

      if (checkbox) checkbox.checked = true;
    });
  }

  els.customWorkout.value =
    entry?.status === defaultStatus
      ? entry.workoutName || ""
      : "";

  els.reasonInput.value =
    entry?.status === defaultStatus
      ? entry.reason || ""
      : "";

  els.saveBtn.dataset.date = dateKey;

  updateFormVisibility();

  els.entryModal.classList.remove("hidden");
}



function closeEntryModal() {
  els.entryModal.classList.add("hidden");
}
function updateFormVisibility() {
  const status = els.statusSelect.value;

  els.workoutWrap.classList.toggle(
    "hidden",
    status !== "Went"
  );

  els.reasonWrap.classList.toggle(
    "hidden",
    status !== "Missed"
  );
}

function saveEntry() {
  const dateKey = els.saveBtn.dataset.date || getTodayKey();
  const status = els.statusSelect.value;

  const workoutTypes = [
    ...document.querySelectorAll(
      '#workoutGroup input[type="checkbox"]:checked'
    )
  ].map(cb => cb.value);

  const workoutName =
    workoutTypes.includes("Custom")
      ? els.customWorkout.value.trim()
      : "";

  const reason = els.reasonInput.value.trim();

  if (status === "Missed" && !reason) {
    showNotice("Please enter a reason for missing the gym.");
    els.reasonInput.focus();
    return;
  }

  if (status === "Went" && workoutTypes.length === 0) {
    showNotice("Please select at least one workout type.");
    return;
  }

  const existingIndex = state.logs.findIndex(
    entry => entry.date === dateKey
  );

  const payload = {
    date: dateKey,
    status,
    workoutType: status === "Went" ? workoutTypes : [],
    workoutName: status === "Went" ? workoutName : "",
    reason: status === "Missed" ? reason : "",
    loggedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    state.logs[existingIndex] = payload;
  } else {
    state.logs.push(payload);
  }

  state.logs.sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  document
    .querySelectorAll('#workoutGroup input[type="checkbox"]')
    .forEach(cb => cb.checked = false);

  els.customWorkout.value = "";
  els.reasonInput.value = "";

  saveState();
  render();
  closeEntryModal();

  showNotice("Entry saved.");
}


/* ================= QUICK NOTE / JOURNAL ================= */

function saveQuickNote() {
  const text = els.quickNoteInput.value.trim();
  if (!text) return;
  addJournalEntry(text);
  els.quickNoteInput.value = "";
  els.quickNoteWrap.classList.add("hidden");
  showNotice("Note saved to your journal.");
}

function saveJournalEntry() {
  const text = els.journalInput.value.trim();
  if (!text) return;
  addJournalEntry(text);
  els.journalInput.value = "";
  showNotice("Journal entry saved.");
}

function addJournalEntry(text) {
  state.journal.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: getTodayKey(),
    text,
    createdAt: Date.now(),
  });
  saveState();
  renderJournal();
}

function deleteJournalEntry(id) {
  state.journal = state.journal.filter((entry) => entry.id !== id);
  saveState();
  renderJournal();
}

function renderJournal() {
  if (!state.journal.length) {
    els.journalList.innerHTML = '<p class="muted">No entries yet. Write about today\'s plan above.</p>';
    return;
  }
  els.journalList.innerHTML = state.journal.map((entry) => `
    <div class="journal-entry">
      <div class="journal-body">
        <span class="journal-date">${formatDateLabel(entry.date)}</span>
        ${escapeHtml(entry.text)}
      </div>
      <button class="journal-delete" data-id="${entry.id}" aria-label="Delete entry">✕</button>
    </div>
  `).join("");
  els.journalList.querySelectorAll(".journal-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteJournalEntry(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ================= RENDER ================= */

function render() {
  renderHero();
  renderStats();
  renderCalendar();
  renderRecentLogs();
  renderAchievements();
  renderGoal();
  renderJournal();
  if (state.activeTab === "stats") renderCharts();
}

function renderHero() {
  function updateClock() {
    const now = new Date();

    els.heroDate.textContent =
      now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short"
      }) +
      " • " +
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    els.heroSerial.textContent = `#TKT-${mm}${dd}`;
  }

  updateClock();
  clearInterval(window.heroClockInterval);
  window.heroClockInterval = setInterval(updateClock, 1000);
}

function renderStats() {
  const totalGymDays = state.logs.filter((entry) => entry.status === "Went").length;
  const totalMissedDays = state.logs.filter((entry) => entry.status === "Missed").length;
  const currentStreak = calculateCurrentStreak();
  const longestStreak = calculateLongestStreak();
  const countedDays = state.logs.filter((entry) => entry.status === "Went" || entry.status === "Missed").length;
  const consistency = countedDays ? Math.round((totalGymDays / countedDays) * 100) : 0;

  els.totalDays.textContent = totalGymDays;
  els.missedDays.textContent = totalMissedDays;
  els.goalProgressText.textContent = `${Math.round((totalGymDays / state.goalTarget) * 100)}%`;

  [els.currentStreak, els.currentStreak2].forEach((el) => { if (el) el.textContent = currentStreak; });
  [els.longestStreak, els.longestStreak2].forEach((el) => { if (el) el.textContent = longestStreak; });
  [els.consistency, els.consistency2].forEach((el) => { if (el) el.textContent = `${consistency}%`; });
}

function calculateCurrentStreak() {
  const sortedLogs = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  for (let i = sortedLogs.length - 1; i >= 0; i--) {
    const entry = sortedLogs[i];
    const entryDate = new Date(`${entry.date}T12:00:00`);
    const diff = Math.floor((cursor - entryDate) / (1000 * 60 * 60 * 24));
    if (diff > 1) break;
    if (entry.status === "Went") {
      streak += 1;
      cursor = entryDate;
    } else if (entry.status === "Rest") {
      cursor = entryDate;
    } else {
      break;
    }
  }
  return streak;
}

function calculateLongestStreak() {
  let max = 0;
  let current = 0;
  const sortedLogs = [...state.logs].sort((a, b) => a.date.localeCompare(b.date));
  sortedLogs.forEach((entry) => {
    if (entry.status === "Went") {
      current += 1;
      max = Math.max(max, current);
    } else if (entry.status === "Missed") {
      current = 0;
    }
    // Rest days leave the current streak untouched
  });
  return max;
}

/* ================= CALENDAR ================= */

function renderCalendar() {
  const { year, month } = state.calendarView;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthLabel = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  els.calendarLabel.textContent = monthLabel;
  els.calendar.innerHTML = "";

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdays.forEach((day) => {
    const weekday = document.createElement("div");
    weekday.className = "weekday";
    weekday.textContent = day;
    els.calendar.appendChild(weekday);
  });

  for (let i = 0; i < startDay; i += 1) {
    const filler = document.createElement("div");
    filler.className = "day-cell empty";
    els.calendar.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatCalendarKey(date);
    const entry = getEntry(dateKey);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (entry) {
      const cls = entry.status === "Went" ? "went" : entry.status === "Rest" ? "rest" : "missed";
      cell.classList.add(cls);
    }
    if (isSameDay(date, new Date())) {
      cell.classList.add("today");
    }
    let emoji = "";
    let emojiClass = "";
    if (entry?.status === "Went") { emoji = "❤️"; emojiClass = "went-emoji"; }
    else if (entry?.status === "Rest") { emoji = "🛌"; emojiClass = "rest-emoji"; }
    else if (entry?.status === "Missed") { emoji = "😢"; emojiClass = "missed-emoji"; }
    cell.innerHTML = `<span class="day-num">${day}</span>${emoji ? `<span class="day-emoji ${emojiClass}">${emoji}</span>` : ""}`;
    cell.setAttribute("aria-label", `${formatDateLabel(dateKey)}${entry ? `, ${entry.status}` : ""}`);
    cell.addEventListener("click", () => openDayDetail(dateKey));
    els.calendar.appendChild(cell);
  }
}

function changeMonth(delta) {
  let { year, month } = state.calendarView;

  month += delta;

  if (month < 0) {
    month = 11;
    year--;
  } else if (month > 11) {
    month = 0;
    year++;
  }

  state.calendarView = { year, month };

  renderCalendar();
  renderCharts();
}

function bindCalendarSwipe() {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  els.calendar.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }, { passive: true });

  els.calendar.addEventListener("touchend", (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      changeMonth(deltaX < 0 ? 1 : -1);
    }
  }, { passive: true });
}

function formatCalendarKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ================= CHARTS ================= */

function renderCharts() {
  renderWeeklyChart();
  renderMonthlyChart();
  renderWorkoutChart();
}
function chartTextColor() {
  return getComputedStyle(document.body).getPropertyValue("--text").trim() || "#10150D";
}

function chartGridColor() {
  return getComputedStyle(document.body).getPropertyValue("--border").trim() || "#DEE2D6";
}

function chartAccentColor() {
  return getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#B7E834";
}

function baseChartOptions(showLegend = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: showLegend, labels: { color: chartTextColor() } } },
    scales: {
      x: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
      y: { ticks: { color: chartTextColor() }, grid: { color: chartGridColor() } },
    },
  };
}

function renderWeeklyChart() {
  const labels = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
  const data = [0, 0, 0, 0, 0];

  const currentMonth = state.calendarView.month;
  const currentYear = state.calendarView.year;

  state.logs.forEach((entry) => {
    if (entry.status !== "Went") return;

    const date = new Date(`${entry.date}T12:00:00`);

    if (
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    ) {
      const week = Math.ceil(date.getDate() / 7);
      data[week - 1]++;
    }
  });

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(els.weeklyChart, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Gym Days",
        data,
        backgroundColor: chartAccentColor(),
        borderRadius: 6
      }]
    },
    options: baseChartOptions(false)
  });
}

function renderMonthlyChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const data = Array(12).fill(0);
  state.logs.forEach((entry) => {
    if (entry.status !== "Went") return;
    const date = new Date(`${entry.date}T12:00:00`);
    data[date.getMonth()] += 1;
  });

  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(els.monthlyChart, {
    type: "line",
    data: { labels: months, datasets: [{ label: "Monthly gym days", data, borderColor: chartAccentColor(), tension: 0.3, fill: true, backgroundColor: chartAccentColor() + "33" }] },
    options: baseChartOptions(false),
  });
}

function renderWorkoutChart() {
  const categories = [
    "Chest",
    "Back",
    "Legs",
    "Shoulders",
    "Arms",
    "Cardio",
    "Custom"
  ];

  const data = Array(categories.length).fill(0);

  state.logs.forEach((entry) => {
    if (entry.status !== "Went") return;

    if (Array.isArray(entry.workoutType)) {
      entry.workoutType.forEach(type => {
        const index = categories.indexOf(type);

        if (index >= 0) {
          data[index]++;
        }
      });
    }
  });

  const palette = [
    "#B7E834",
    "#7FB0E0",
    "#E4572E",
    "#F2B94A",
    "#9B7BD8",
    "#4AC0C0",
    "#D46FB0"
  ];

  if (workoutChart) workoutChart.destroy();

  workoutChart = new Chart(els.workoutChart, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{
        data,
        backgroundColor: palette
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: chartTextColor(),
            boxWidth: 12,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

/* ================= LISTS ================= */
function renderRecentLogs() 
{
  const recent = [...state.logs]
    .sort((a, b) => {
      const aTime = a.loggedAt || a.date;
      const bTime = b.loggedAt || b.date;
      return bTime.localeCompare(aTime);
    })
    .slice(0, 10);

  if (!recent.length) {
    els.recentLogs.innerHTML =
      '<div class="activity-item">No activity yet. Log your first workout above.</div>';
    return;
  }

  els.recentLogs.innerHTML = recent.map((entry) => {

    const timestamp = entry.loggedAt
      ? new Date(entry.loggedAt).toLocaleString()
      : formatDateLabel(entry.date);

    let details = "";

    if (entry.status === "Went") {

      const workoutText =
        Array.isArray(entry.workoutType)
          ? entry.workoutType.join(", ")
          : entry.workoutType || "-";

      details = `Workout: ${workoutText}`;

    } else if (entry.status === "Missed") {

      details = `Reason: ${entry.reason}`;

    } else {

      details = "Rest Day";

    }

    return `
      <div class="activity-item">
        <strong>${timestamp}</strong>
        <br>
        ${entry.status} · ${details}
      </div>
    `;
  }).join("");
}

function renderAchievements() {
  const totalGymDays = state.logs.filter((entry) => entry.status === "Went").length;
  const currentStreak = calculateCurrentStreak();
  const achievements = [
    { title: "First gym day", unlocked: totalGymDays >= 1, icon: "🎉" },
    { title: "7 day streak", unlocked: currentStreak >= 7, icon: "🔥" },
    { title: "30 day streak", unlocked: currentStreak >= 30, icon: "🏅" },
    { title: "100 gym days", unlocked: totalGymDays >= 100, icon: "💪" },
    { title: "365 day legend", unlocked: totalGymDays >= 365, icon: "👑" },
  ];

  els.achievements.innerHTML = achievements.map((item) => `
    <div class="achievement-item ${item.unlocked ? "" : "locked"}">
      <div class="stamp">${item.icon}</div>
      <div>
        <strong>${item.title}</strong>
        <p class="muted">${item.unlocked ? "Unlocked" : "Keep going"}</p>
      </div>
    </div>
  `).join("");
}

function renderGoal() {

  const totalGymDays =
    state.logs.filter(
      entry => entry.status === "Went"
    ).length;

  const progress =
    state.goalTarget > 0
      ? Math.min(
          100,
          Math.round(
            (totalGymDays / state.goalTarget) * 100
          )
        )
      : 0;

  els.goalBar.style.width = `${progress}%`;

  els.goalBar.style.background =
    progress >= 100
      ? "#00C853"
      : "#4CAF50";

  els.goalText.textContent =
    `${totalGymDays}/${state.goalTarget} gym days completed (${progress}%)`;
}

/* ================= DAY DETAIL ================= */
function openDayDetail(dateKey) {
  const entry = getEntry(dateKey);

  if (!entry) {

    els.detailContent.innerHTML =
      '<p class="muted">No record for this day.</p>';

  } else {

    const workoutText =
      Array.isArray(entry.workoutType)
        ? entry.workoutType.join(", ")
        : entry.workoutType || "-";

    els.detailContent.innerHTML = `
      <p><strong>Date:</strong> ${formatDateLabel(dateKey)}</p>
      <p><strong>Status:</strong> ${entry.status}</p>
      <p><strong>Workout:</strong> ${workoutText}</p>
      <p><strong>Reason:</strong> ${entry.reason || "-"}</p>
    `;
  }

  els.editDetailBtn.dataset.date = dateKey;

  els.detailModal.classList.remove("hidden");
}

function closeDetailModal() {
  els.detailModal.classList.add("hidden");
}

/* ================= NOTIFICATIONS / INSTALL ================= */

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showNotice("Notifications are not supported in this browser.");
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      els.notifyBtn.textContent = "Enabled";
      showNotice("Reminder notifications enabled.");
    } else {
      showNotice("Permission denied. Reminders are off.");
    }
  });
}

function warmReminder() {
  if (state.reminderDate === getTodayKey()) return;
  checkReminder();
}

function checkReminder() {
  const now = new Date();
  const today = getTodayKey();
  if (now.getHours() < 20) return;
  const hasEntryToday = Boolean(getEntry(today));
  if (!hasEntryToday && state.reminderDate !== today) {
    showNotice("Did you go to the gym today?");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Did you go to the gym today?", { body: "Tap to log your workout, rest day, or a missed day." });
    }
    state.reminderDate = today;
    saveState();
  }
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
  return isIos && isSafari;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function maybeShowIosInstallBanner() {
  if (!isIosSafari() || isStandalone()) return;
  const dismissedAt = Number(localStorage.getItem(STORAGE_KEYS.iosBannerDismissed) || 0);
  const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  if (dismissedAt && daysSinceDismiss < 7) return;
  setTimeout(() => els.iosInstallBanner.classList.remove("hidden"), 1600);
}

function dismissIosBanner() {
  els.iosInstallBanner.classList.add("hidden");
  localStorage.setItem(STORAGE_KEYS.iosBannerDismissed, String(Date.now()));
}

function installApp() {
  if (isIosSafari() && !isStandalone()) {
    els.iosInstallBanner.classList.remove("hidden");
    return;
  }
  if (!state.installPrompt) {
    showNotice("Use Share → Add to Home Screen on iPhone, or the browser menu on Android.");
    return;
  }
  state.installPrompt.prompt();
  state.installPrompt = null;
}

function prepareInstallUi() {
  if (isStandalone()) {
    els.installBtn.textContent = "Installed";
    els.installBtn.disabled = true;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    els.notifyBtn.textContent = "Enabled";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("Service worker registration failed", error));
}

/* ================= EXPORT ================= */

function exportCSV(entries) {
  const rows = [["Date", "Status", "Workout Type", "Workout Name", "Reason"]];
  entries.forEach((entry) => rows.push([entry.date, entry.status, entry.workoutType || "", entry.workoutName || "", entry.reason || ""]));
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(csv, "gym-tracker-export.csv", "text/csv;charset=utf-8;");
}

function exportCurrentMonthCSV() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const filtered = state.logs.filter((entry) => entry.date.startsWith(`${year}-${month}-`));
  exportCSV(filtered);
}

function exportSelectedRangeCSV() {
  const start = els.rangeStart.value;
  const end = els.rangeEnd.value;
  if (!start || !end) {
    showNotice("Select a date range first.");
    return;
  }
  const filtered = state.logs.filter((entry) => entry.date >= start && entry.date <= end);
  exportCSV(filtered);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ================= BACKUP & RESTORE ================= */

function downloadBackup() {
  const payload = {
    app: "gym-tracker",
    exportedAt: new Date().toISOString(),
    logs: state.logs,
    journal: state.journal,
    goalTarget: state.goalTarget,
  };
  const stamp = getTodayKey();
  downloadFile(JSON.stringify(payload, null, 2), `gym-tracker-backup-${stamp}.json`, "application/json");
  showNotice("Backup downloaded.");
}

function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.logs)) throw new Error("Invalid backup file");
      state.logs = data.logs;
      state.journal = Array.isArray(data.journal) ? data.journal : [];
      state.goalTarget = Number(data.goalTarget) || state.goalTarget;
      saveState();
      els.goalInput.value = state.goalTarget;
      render();
      showNotice("Backup restored.");
    } catch (error) {
      console.error(error);
      showNotice("That file doesn't look like a valid backup.");
    } finally {
      els.restoreFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

init();

