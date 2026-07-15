window.GL = window.GL || {};

GL.pageProgress = (function () {
  const { $, animateNumber } = GL.dom;
  const { key, fromKey, MONTH_LABELS, WEEKDAY_LETTERS } = GL.date;
  const { getState, getLog, currentStreak, longestStreak, monthConsistency, muscleMix } = GL.store;

  let monthlyChart = null;
  let chartInitialized = false;

  // Indian national holidays
  const INDIA_HOLIDAYS = {
    "2025-01-01": "New Year's Day",
    "2025-01-14": "Makar Sankranti",
    "2025-01-26": "Republic Day 🇮🇳",
    "2025-03-17": "Holi",
    "2025-04-14": "Ambedkar Jayanti",
    "2025-04-18": "Good Friday",
    "2025-05-01": "Labour Day",
    "2025-06-07": "Eid ul-Adha",
    "2025-08-15": "Independence Day 🇮🇳",
    "2025-08-27": "Janmashtami",
    "2025-10-02": "Gandhi Jayanti",
    "2025-10-02": "Gandhi Jayanti",
    "2025-10-20": "Dussehra",
    "2025-10-20": "Diwali",
    "2025-11-05": "Diwali",
    "2025-12-25": "Christmas",
    "2026-01-01": "New Year's Day",
    "2026-01-14": "Makar Sankranti",
    "2026-01-26": "Republic Day 🇮🇳",
    "2026-03-06": "Holi",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Ambedkar Jayanti",
    "2026-05-01": "Labour Day",
    "2026-08-15": "Independence Day 🇮🇳",
    "2026-10-02": "Gandhi Jayanti",
    "2026-12-25": "Christmas",
  };

  function renderProgress({ onOpenDetail } = {}) {
    renderCalendar({ onOpenDetail });
    renderStats();
  }

  function renderCalendar({ onOpenDetail } = {}) {
    const state = getState();
    const { year, month } = state.calendar;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const today = key();

    $("historyLabel").textContent = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    const grid = $("heatGrid");
    const cells = [];

    // Start from Monday (Indian calendar)
    const firstDow = first.getDay(); // 0=Sun
    // Shift so week starts Monday: Mon=0, Tue=1, ..., Sun=6
    const startPad = (firstDow === 0) ? 6 : firstDow - 1;
    for (let i = 0; i < startPad; i++) cells.push(`<div class="heat-cell pad"></div>`);

    for (let day = 1; day <= last.getDate(); day++) {
      const date = key(new Date(year, month, day));
      const entry = getLog(date);
      const cls = entry ? entry.status.toLowerCase() : "";
      const holiday = INDIA_HOLIDAYS[date];
      const isHoliday = !!holiday;
      const isSunday = new Date(`${date}T12:00:00`).getDay() === 0;

      cells.push(`<button type="button" class="heat-cell ${cls} ${date === today ? "today" : ""} ${isHoliday ? "holiday" : ""} ${isSunday ? "sunday" : ""}" data-date="${date}" data-holiday="${holiday || ""}" title="${holiday || ""}">
        <span class="fill"></span>
        <span>${day}</span>
        ${isHoliday ? '<span class="holiday-dot"></span>' : ''}
      </button>`);
    }

    grid.innerHTML = cells.join("");
    grid.querySelectorAll("button").forEach((cell) => {
      cell.onclick = () => {
        const hol = cell.dataset.holiday;
        if (hol) GL.toast?.showToast(`🎉 ${hol}`);
        onOpenDetail?.(cell.dataset.date);
      };
    });
  }

  function changeHistoryMonth(delta, rerender) {
    const state = getState();
    let month = state.calendar.month + delta;
    let year = state.calendar.year;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    state.calendar = { year, month };
    rerender();
  }

  function weekdayLabelsHTML() {
    // Indian week starts Monday
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    return days.map((d) => `<span>${d}</span>`).join("");
  }

  function renderStats() {
    const state = getState();
    const streak = currentStreak();
    const best = longestStreak();
    const { percent, totalWent } = monthConsistency();

    animateNumber($("statStreak"), streak);
    animateNumber($("statBest"), best);
    $("statConsistency").textContent = `${percent}%`;
    animateNumber($("statTotal"), totalWent);

    const now = new Date();
    const completed = state.logs.filter((item) => {
      const d = fromKey(item.date);
      return item.status === "Went" && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const goalPct = Math.min(100, Math.round((completed / state.goalTarget) * 100));
    $("statGoal").textContent = `${goalPct}%`;

    const went = state.logs.filter((i) => i.status === "Went");
    let freq = "0";
    if (went.length) {
      const firstEntry = fromKey([...went].sort((a, b) => a.date.localeCompare(b.date))[0].date);
      const weeks = Math.max(1, Math.ceil((now - firstEntry) / (7 * 86400000)));
      freq = (went.length / weeks).toFixed(1);
    }
    $("statFrequency").textContent = freq;

    renderMuscleBars();

    // Always attempt to render chart; retry if Chart.js not yet loaded
    tryRenderMonthlyChart(0);
  }

  function tryRenderMonthlyChart(attempt) {
    if (typeof Chart !== "undefined") {
      renderMonthlyChart();
      return;
    }
    if (attempt < 10) {
      setTimeout(() => tryRenderMonthlyChart(attempt + 1), 300);
    }
  }

  function renderMuscleBars() {
    const mix = muscleMix();
    const max = Math.max(1, ...mix.map((m) => m.count));
    $("muscleBars").innerHTML = mix.map((m) => `
      <div class="bar-row">
        <span class="label">${m.category}</span>
        <span class="track"><div style="width:${(m.count / max) * 100}%"></div></span>
        <span class="val num">${m.count}</span>
      </div>`).join("");
  }

  function renderMonthlyChart() {
    const canvas = $("monthlyChart");
    const panel = document.getElementById("panel-progress");
    if (!canvas || !panel) return;

    const state = getState();
    const text = getComputedStyle(document.body).getPropertyValue("--muted").trim() || "#888";
    const accent = getComputedStyle(document.body).getPropertyValue("--ember").trim() || "#ff5a36";
    const line = getComputedStyle(document.body).getPropertyValue("--line").trim() || "#eee";

    const data = Array(12).fill(0);
    state.logs.filter((i) => i.status === "Went").forEach((i) => data[fromKey(i.date).getMonth()]++);

    // Always destroy old chart first
    if (monthlyChart) {
      try { monthlyChart.destroy(); } catch {}
      monthlyChart = null;
    }

    try {
      monthlyChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: MONTH_LABELS,
          datasets: [{
            data,
            backgroundColor: data.map((v, i) => i === new Date().getMonth() ? accent : `${accent}88`),
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 22,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600 },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: text, font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { precision: 0, color: text }, grid: { color: line } },
          },
        },
      });
    } catch(e) {
      console.warn("Chart render error:", e);
    }
  }

  return { renderProgress, changeHistoryMonth, weekdayLabelsHTML };
})();
