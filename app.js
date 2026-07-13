const STORAGE_KEYS = {
  logs: "gym-tracker-logs",
  theme: "gym-tracker-theme",
  goal: "gym-tracker-goal",
  reminder: "gym-tracker-reminder",
};

const state = {
  logs: [],
  theme: "light",
  goalTarget: 20,
  reminderDate: null,
  installPrompt: null,
  calendarView: { year: new Date().getFullYear(), month: new Date().getMonth() },
  cloud: {
    db: null,
    uid: null,
    docRef: null,
    pushTimer: null,
    initialSyncDone: false,
  },
};

let weeklyChart;
let monthlyChart;
let streakChart;
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
  initCloudSync();
}

function cacheElements() {
  els.wentBtn = document.getElementById("wentBtn");
  els.missedBtn = document.getElementById("missedBtn");
  els.wentBtnMobile = document.getElementById("wentBtnMobile");
  els.missedBtnMobile = document.getElementById("missedBtnMobile");
  els.heroDate = document.getElementById("heroDate");
  els.themeToggle = document.getElementById("themeToggle");
  els.installBtn = document.getElementById("installBtn");
  els.notifyBtn = document.getElementById("notifyBtn");
  els.syncBtn = document.getElementById("syncBtn");
  els.syncStatusDot = document.getElementById("syncStatusDot");
  els.syncStatusText = document.getElementById("syncStatusText");
  els.notice = document.getElementById("notice");
  els.totalDays = document.getElementById("totalDays");
  els.currentStreak = document.getElementById("currentStreak");
  els.longestStreak = document.getElementById("longestStreak");
  els.consistency = document.getElementById("consistency");
  els.missedDays = document.getElementById("missedDays");
  els.goalProgressText = document.getElementById("goalProgressText");
  els.calendar = document.getElementById("calendar");
  els.calendarLabel = document.getElementById("calendarLabel");
  els.prevMonthBtn = document.getElementById("prevMonthBtn");
  els.nextMonthBtn = document.getElementById("nextMonthBtn");
  els.weeklyChart = document.getElementById("weeklyChart");
  els.monthlyChart = document.getElementById("monthlyChart");
  els.streakChart = document.getElementById("streakChart");
  els.workoutChart = document.getElementById("workoutChart");
  els.recentLogs = document.getElementById("recentLogs");
  els.achievements = document.getElementById("achievements");
  els.goalInput = document.getElementById("goalInput");
  els.goalBar = document.getElementById("goalBar");
  els.goalText = document.getElementById("goalText");
  els.exportAllBtn = document.getElementById("exportAllBtn");
  els.exportMonthBtn = document.getElementById("exportMonthBtn");
  els.exportRangeBtn = document.getElementById("exportRangeBtn");
  els.rangeStart = document.getElementById("rangeStart");
  els.rangeEnd = document.getElementById("rangeEnd");
  els.entryModal = document.getElementById("entryModal");
  els.detailModal = document.getElementById("detailModal");
  els.modalTitle = document.getElementById("modalTitle");
  els.detailTitle = document.getElementById("detailTitle");
  els.detailContent = document.getElementById("detailContent");
  els.statusSelect = document.getElementById("statusSelect");
  els.workoutSelect = document.getElementById("workoutSelect");
  els.customWorkout = document.getElementById("customWorkout");
  els.workoutWrap = document.getElementById("workoutWrap");
  els.reasonWrap = document.getElementById("reasonWrap");
  els.reasonInput = document.getElementById("reasonInput");
  els.storyInput = document.getElementById("storyInput");
  els.cancelBtn = document.getElementById("cancelBtn");
  els.saveBtn = document.getElementById("saveBtn");
  els.closeDetailBtn = document.getElementById("closeDetailBtn");
  els.editDetailBtn = document.getElementById("editDetailBtn");
}

function bindEvents() {
  els.wentBtn.addEventListener("click", () => openEntryModal("Went"));
  els.missedBtn.addEventListener("click", () => openEntryModal("Missed"));
  els.wentBtnMobile.addEventListener("click", () => openEntryModal("Went"));
  els.missedBtnMobile.addEventListener("click", () => openEntryModal("Missed"));
  els.themeToggle.addEventListener("click", toggleTheme);
  els.installBtn.addEventListener("click", installApp);
  els.notifyBtn.addEventListener("click", requestNotificationPermission);
  els.syncBtn.addEventListener("click", handleSyncButtonClick);
  els.goalInput.addEventListener("input", (event) => {
    state.goalTarget = Number(event.target.value || 20);
    saveState();
    renderGoal();
    queueCloudSync();
  });
  els.exportAllBtn.addEventListener("click", () => exportCSV(state.logs));
  els.exportMonthBtn.addEventListener("click", exportCurrentMonthCSV);
  els.exportRangeBtn.addEventListener("click", exportSelectedRangeCSV);
  els.saveBtn.addEventListener("click", saveEntry);
  els.cancelBtn.addEventListener("click", closeEntryModal);
  els.statusSelect.addEventListener("change", updateFormVisibility);
  els.workoutSelect.addEventListener("change", () => {
    els.customWorkout.classList.toggle("hidden", els.workoutSelect.value !== "Custom");
  });
  els.closeDetailBtn.addEventListener("click", closeDetailModal);
  els.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  bindCalendarSwipe();
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
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installBtn.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    els.installBtn.classList.add("hidden");
    showNotice("App installed successfully.");
  });
  window.addEventListener("online", () => {
    if (state.cloud.docRef) queueCloudSync(true);
    else setSyncState("off", "Local only — add Firebase keys to enable cloud sync");
  });
  window.addEventListener("offline", () => {
    setSyncState("offline", "Offline — changes saved locally, will sync when back online");
  });
  setInterval(checkReminder, 60000);
}

function loadState() {
  try {
    const savedLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.logs) || "[]");
    state.logs = Array.isArray(savedLogs) ? savedLogs : [];
    state.theme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
    state.goalTarget = Number(localStorage.getItem(STORAGE_KEYS.goal) || 20);
    state.reminderDate = localStorage.getItem(STORAGE_KEYS.reminder);
  } catch (error) {
    console.warn("Unable to load saved data", error);
  }
  applyTheme();
  els.goalInput.value = state.goalTarget;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  localStorage.setItem(STORAGE_KEYS.goal, String(state.goalTarget));
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
  queueCloudSync();
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

function openEntryModal(defaultStatus = "Went", dateKey = getTodayKey()) {
  const entry = getEntry(dateKey);
  els.modalTitle.textContent = entry ? `Edit ${formatDateLabel(dateKey)}` : `Log ${formatDateLabel(dateKey)}`;
  els.statusSelect.value = entry?.status || defaultStatus;
  els.workoutSelect.value = entry?.workoutType || "Chest";
  els.customWorkout.value = entry?.workoutType === "Custom" ? entry.workoutName || "" : "";
  els.reasonInput.value = entry?.reason || "";
  els.storyInput.value = entry?.story || "";
  els.saveBtn.dataset.date = dateKey;
  els.customWorkout.classList.toggle("hidden", els.workoutSelect.value !== "Custom");
  updateFormVisibility();
  els.entryModal.classList.remove("hidden");
  els.statusSelect.focus();
}

function closeEntryModal() {
  els.entryModal.classList.add("hidden");
}

function updateFormVisibility() {
  const status = els.statusSelect.value;
  els.workoutWrap.classList.toggle("hidden", status !== "Went");
  els.reasonWrap.classList.toggle("hidden", status === "Went");
  if (status !== "Went") {
    els.customWorkout.classList.add("hidden");
  }
}

function saveEntry() {
  const dateKey = els.saveBtn.dataset.date || getTodayKey();
  const status = els.statusSelect.value;
  const workoutType = els.workoutSelect.value;
  const workoutName = workoutType === "Custom" ? els.customWorkout.value.trim() : workoutType;
  const reason = els.reasonInput.value.trim();
  const story = els.storyInput.value.trim();

  const existingIndex = state.logs.findIndex((entry) => entry.date === dateKey);
  const payload = {
    date: dateKey,
    status,
    workoutType: status === "Went" ? workoutType : "",
    workoutName: status === "Went" ? workoutName : "",
    reason: status === "Missed" ? reason : "",
    story,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    state.logs[existingIndex] = payload;
  } else {
    state.logs.push(payload);
  }

  state.logs.sort((a, b) => a.date.localeCompare(b.date));
  saveState();
  render();
  closeEntryModal();
  showNotice("Entry saved.");
  queueCloudSync(true);
}

function render() {
  renderHero();
  renderStats();
  renderCalendar();
  renderCharts();
  renderRecentLogs();
  renderAchievements();
  renderGoal();
}

function renderHero() {
  const today = new Date();
  els.heroDate.textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function renderStats() {
  const totalGymDays = state.logs.filter((entry) => entry.status === "Went").length;
  const totalMissedDays = state.logs.filter((entry) => entry.status === "Missed").length;
  const currentStreak = calculateCurrentStreak();
  const longestStreak = calculateLongestStreak();
  const consistency = state.logs.length ? Math.round((totalGymDays / state.logs.length) * 100) : 0;

  els.totalDays.textContent = totalGymDays;
  els.currentStreak.textContent = currentStreak;
  els.longestStreak.textContent = longestStreak;
  els.consistency.textContent = `${consistency}%`;
  els.missedDays.textContent = totalMissedDays;
  els.goalProgressText.textContent = `${Math.round((totalGymDays / state.goalTarget) * 100)}%`;
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
    if (entry.status === "Went" && diff <= 1) {
      streak += 1;
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
    } else {
      current = 0;
    }
  });
  return max;
}

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
      cell.classList.add(entry.status === "Went" ? "went" : "missed");
    }
    if (isSameDay(date, new Date())) {
      cell.classList.add("today");
    }
    const emoji = entry?.status === "Went" ? "❤️" : entry?.status === "Missed" ? "😢" : "";
    cell.innerHTML = `<span class="day-num">${day}</span>${emoji ? `<span class="day-emoji">${emoji}</span>` : ""}`;
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
    year -= 1;
  } else if (month > 11) {
    month = 0;
    year += 1;
  }
  state.calendarView = { year, month };
  renderCalendar();
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

function renderCharts() {
  renderWeeklyChart();
  renderMonthlyChart();
  renderStreakChart();
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
  const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
  const data = [0, 0, 0, 0];
  const today = new Date();
  state.logs.forEach((entry) => {
    if (entry.status !== "Went") return;
    const entryDate = new Date(`${entry.date}T12:00:00`);
    const diff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
    if (diff < 7) data[3] += 1;
    else if (diff < 14) data[2] += 1;
    else if (diff < 21) data[1] += 1;
    else if (diff < 28) data[0] += 1;
  });

  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(els.weeklyChart, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Gym Days", data, backgroundColor: chartAccentColor(), borderRadius: 6 }],
    },
    options: baseChartOptions(false),
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
    data: {
      labels: months,
      datasets: [{ label: "Monthly gym days", data, borderColor: chartAccentColor(), tension: 0.3, fill: true, backgroundColor: chartAccentColor() + "33" }],
    },
    options: baseChartOptions(false),
  });
}

function renderStreakChart() {
  const labels = [];
  const data = [];
  const end = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const key = formatCalendarKey(date);
    labels.push(date.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    const entry = getEntry(key);
    data.push(entry?.status === "Went" ? 1 : 0);
  }

  if (streakChart) streakChart.destroy();
  streakChart = new Chart(els.streakChart, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Daily activity", data, borderColor: chartAccentColor(), backgroundColor: chartAccentColor() + "22", fill: true, tension: 0.3, pointRadius: 0 }],
    },
    options: baseChartOptions(false),
  });
}

function renderWorkoutChart() {
  const categories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Cardio", "Custom"];
  const data = Array(categories.length).fill(0);
  state.logs.forEach((entry) => {
    if (entry.status !== "Went") return;
    const index = categories.indexOf(entry.workoutType || entry.workoutName || "Custom");
    if (index >= 0) data[index] += 1;
  });

  const palette = ["#B7E834", "#7FB0E0", "#E4572E", "#F2B94A", "#9B7BD8", "#4AC0C0", "#D46FB0"];

  if (workoutChart) workoutChart.destroy();
  workoutChart = new Chart(els.workoutChart, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{ data, backgroundColor: palette }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: chartTextColor(), boxWidth: 12, font: { size: 11 } } } },
    },
  });
}

function renderRecentLogs() {
  const recent = [...state.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (!recent.length) {
    els.recentLogs.innerHTML = '<div class="activity-item">No activity yet. Log your first workout above.</div>';
    return;
  }
  els.recentLogs.innerHTML = recent.map((entry) => {
    const details = entry.status === "Went"
      ? `Workout: ${entry.workoutName || entry.workoutType || "-"}`
      : `Reason: ${entry.reason || "-"}`;
    const storyPreview = entry.story
      ? `<div class="story-preview">${escapeHtml(entry.story.length > 140 ? `${entry.story.slice(0, 140)}…` : entry.story)}</div>`
      : "";
    return `<div class="activity-item"><strong>${formatDateLabel(entry.date)}</strong><br>${entry.status} · ${details}${storyPreview}</div>`;
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
  const totalGymDays = state.logs.filter((entry) => entry.status === "Went").length;
  const progress = Math.min(100, Math.round((totalGymDays / state.goalTarget) * 100));
  els.goalBar.style.width = `${progress}%`;
  els.goalText.textContent = `${totalGymDays}/${state.goalTarget} days completed (${progress}%)`;
}

function openDayDetail(dateKey) {
  const entry = getEntry(dateKey);
  if (!entry) {
    els.detailContent.innerHTML = '<p class="muted">No record for this day.</p>';
  } else {
    els.detailContent.innerHTML = `
      <p><strong>Date:</strong> ${formatDateLabel(dateKey)}</p>
      <p><strong>Status:</strong> ${entry.status}</p>
      <p><strong>Workout:</strong> ${entry.workoutName || entry.workoutType || "-"}</p>
      <p><strong>Reason:</strong> ${entry.reason || "-"}</p>
      ${entry.story ? `<div class="story-block">${escapeHtml(entry.story).replace(/\n/g, "<br>")}</div>` : ""}
    `;
  }
  els.editDetailBtn.dataset.date = dateKey;
  els.detailModal.classList.remove("hidden");
}

function closeDetailModal() {
  els.detailModal.classList.add("hidden");
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showNotice("Notifications are not supported in this browser.");
    return;
  }

  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
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
      new Notification("Did you go to the gym today?", {
        body: "Tap to log your workout or a missed day.",
      });
    }
    state.reminderDate = today;
    saveState();
  }
}

function installApp() {
  if (!state.installPrompt) {
    showNotice("Use Share → Add to Home Screen on iPhone, or the browser menu on Android.");
    return;
  }
  state.installPrompt.prompt();
  state.installPrompt = null;
}

function prepareInstallUi() {
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    els.installBtn.classList.add("hidden");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("Service worker registration failed", error));
}

function exportCSV(entries) {
  const rows = [["Date", "Status", "Workout Type", "Workout Name", "Reason", "Story"]];
  entries.forEach((entry) => rows.push([entry.date, entry.status, entry.workoutType || "", entry.workoutName || "", entry.reason || "", entry.story || ""]));
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(csv, "gym-tracker-export.csv");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
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

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ---------- cloud sync (Firebase) ---------- */
/* The app is fully usable without any of this — every read/write above
 * goes through localStorage first. This layer just mirrors that same
 * data to Firestore when a connection is available, and pulls it back
 * down (merging by most-recent edit) if the app is reopened on a
 * device that's missing some entries. */

function firebaseIsConfigured() {
  return (
    typeof firebase !== "undefined" &&
    window.firebaseConfig &&
    window.firebaseConfig.apiKey &&
    window.firebaseConfig.apiKey !== "YOUR_API_KEY"
  );
}

function initCloudSync() {
  if (!firebaseIsConfigured()) {
    setSyncState("off", "Local only — add Firebase keys to enable cloud sync");
    return;
  }

  try {
    firebase.initializeApp(window.firebaseConfig);
  } catch (error) {
    console.warn("Firebase init failed", error);
    setSyncState("error", "Cloud sync unavailable — check your Firebase config");
    return;
  }

  const db = firebase.firestore();
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (error) {
    console.warn("Offline persistence unavailable", error);
  }
  state.cloud.db = db;
  setSyncState("syncing", "Connecting…");

  firebase.auth().onAuthStateChanged((user) => {
    if (!user) return;
    state.cloud.uid = user.uid;
    const docRef = db.collection("users").doc(user.uid);
    state.cloud.docRef = docRef;

    docRef.onSnapshot(
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists) mergeCloudData(snap.data());
        const fromCache = snap.metadata.fromCache;
        if (fromCache) {
          setSyncState(
            navigator.onLine ? "syncing" : "offline",
            navigator.onLine ? "Syncing…" : "Offline — changes saved locally, will sync when back online"
          );
        } else {
          setSyncState("online", "Synced just now");
        }
      },
      (error) => {
        console.warn("Cloud listener error", error);
        setSyncState("error", "Sync error — changes are still saved locally");
      }
    );
  });

  firebase.auth().signInAnonymously().catch((error) => {
    console.warn("Anonymous sign-in failed", error);
    setSyncState("error", "Could not connect to cloud — working offline for now");
  });
}

function mergeCloudData(cloudData) {
  if (!cloudData) return;
  const cloudLogs = Array.isArray(cloudData.logs) ? cloudData.logs : [];
  const map = new Map();
  state.logs.forEach((entry) => map.set(entry.date, entry));

  let changed = false;
  cloudLogs.forEach((cloudEntry) => {
    const local = map.get(cloudEntry.date);
    if (!local || (cloudEntry.updatedAt || 0) > (local.updatedAt || 0)) {
      map.set(cloudEntry.date, cloudEntry);
      changed = true;
    }
  });

  if (changed) {
    state.logs = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  if (!state.cloud.initialSyncDone) {
    if (typeof cloudData.goalTarget === "number") {
      state.goalTarget = cloudData.goalTarget;
      els.goalInput.value = state.goalTarget;
      changed = true;
    }
    state.cloud.initialSyncDone = true;
  }

  if (changed) {
    saveState();
    render();
  }
}

function queueCloudSync(immediate = false) {
  if (!state.cloud.docRef) return;
  if (!navigator.onLine) {
    setSyncState("offline", "Offline — changes saved locally, will sync when back online");
  }
  clearTimeout(state.cloud.pushTimer);
  if (immediate) {
    pushToCloud();
  } else {
    state.cloud.pushTimer = setTimeout(pushToCloud, 900);
  }
}

function pushToCloud() {
  if (!state.cloud.docRef) return;
  setSyncState("syncing", "Syncing…");
  state.cloud.docRef
    .set(
      {
        logs: state.logs,
        goalTarget: state.goalTarget,
        theme: state.theme,
        updatedAt: Date.now(),
      },
      { merge: true }
    )
    .then(() => {
      setSyncState(
        navigator.onLine ? "online" : "offline",
        navigator.onLine ? "Synced just now" : "Saved locally — will sync when back online"
      );
    })
    .catch((error) => {
      console.warn("Cloud sync failed", error);
      setSyncState("error", "Sync error — changes are still saved locally");
    });
}

function setSyncState(syncState, text) {
  if (els.syncBtn) els.syncBtn.dataset.state = syncState;
  if (els.syncStatusDot) els.syncStatusDot.dataset.state = syncState;
  if (els.syncStatusText) els.syncStatusText.textContent = text;
}

function handleSyncButtonClick() {
  if (!firebaseIsConfigured()) {
    showNotice("Add your Firebase keys in firebase-config.js to enable cloud sync.");
    return;
  }
  showNotice(els.syncStatusText ? els.syncStatusText.textContent : "Checking sync status…");
  if (state.cloud.docRef) queueCloudSync(true);
}

init();
