window.GL = window.GL || {};

GL.pageHome = (function () {
  const { $, escapeHtml, animateNumber } = GL.dom;
  const { key, displayDate } = GL.date;
  const { getState, getLog, currentStreak, todayPlan } = GL.store;
  const { icon } = GL.icons;

  const RING_RADIUS = 46;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;
  const GOAL_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365];

  function last7Days(today) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(GL.date.key(d));
    }
    return days;
  }

  function renderHome({ onQuickStatus, onOpenDetail } = {}) {
    const state = getState();
    const today = key();
    const entry = getLog(today);
    const streak = currentStreak();

    const weekWent = last7Days(today).filter(d => getLog(d)?.status === "Went").length;
    const ringPct = Math.min(1, weekWent / 7);
    $("ringFill").setAttribute("stroke-dasharray", `${RING_CIRC}`);
    $("ringFill").setAttribute("stroke-dashoffset", `${RING_CIRC * (1 - ringPct)}`);
    animateNumber($("ringCount"), streak);
    $("ringSub").textContent = entry
      ? entry.status === "Went" ? "Logged for today. Nice work."
        : entry.status === "Rest" ? "Resting today — that counts too."
        : "Marked as missed. Tomorrow's a reset."
      : "Tap a status below to check in.";

    // Today status chips
    document.querySelectorAll(".status-chip").forEach(chip => {
      chip.classList.toggle("done", entry?.status === chip.dataset.status);
      chip.onclick = () => onQuickStatus?.(chip.dataset.status);
    });

    // Week strip
    const strip = $("weekStrip");
    strip.innerHTML = last7Days(today).map(d => {
      const log = getLog(d);
      const cls = log ? log.status.toLowerCase() : "";
      const label = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
      return `<div class="week-day"><span>${label}</span><div class="week-dot ${cls} ${d === today ? "today" : ""}" data-date="${d}">${log ? (log.status === "Went" ? "✓" : log.status === "Rest" ? "–" : "×") : ""}</div></div>`;
    }).join("");
    strip.querySelectorAll(".week-dot").forEach(dot => dot.onclick = () => onOpenDetail?.(dot.dataset.date));

    // Planner title
    const plannerTitle = $("plannerTitle");
    if (plannerTitle) {
      const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long" });
      plannerTitle.textContent = `${dateLabel}'s workout`;
    }

    // Achievement banner — only on fresh milestones
    const banner = $("achievementBanner");
    if (banner) {
      if (GOAL_MILESTONES.includes(streak) && !state.celebratedStreaks.has(streak)) {
        banner.classList.remove("hidden");
        const achText = $("achievementText");
        if (achText) achText.textContent = `${streak}-day streak. Keep it rolling.`;
      } else if (!GOAL_MILESTONES.includes(streak)) {
        banner.classList.add("hidden");
      }
    }

    renderRingBadge(streak);
    renderRecentActivity(onOpenDetail);
    renderGamificationSection();
    renderDailyMissions();
  }

  function renderRingBadge(streak) {
    const gEl = document.getElementById("ringBadgeGroup");
    if (!gEl) return;
    const g = GL.gamification;
    if (!g) return;
    const rank = g.getCurrentRank();
    gEl.innerHTML = `
      <text x="52" y="48" text-anchor="middle" font-size="20" dominant-baseline="middle">${rank.emoji}</text>
      <text x="52" y="64" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.75)" font-weight="700">${rank.name.toUpperCase()}</text>
    `;
  }

  function renderGamificationSection() {
    const container = document.getElementById("gamificationSection");
    if (!container) return;
    const g = GL.gamification;
    if (!g) return;

    const rank = g.getCurrentRank();
    const nextRank = g.getNextRank();
    const lvl = g.getLevelInfo();
    const data = g.getData();
    const stats = g.computeStats();

    const xpPct = Math.min(100, Math.round((lvl.levelXP / lvl.levelNeeded) * 100));
    const earned = data.earnedAchievements;
    const allAch = g.ACHIEVEMENTS;
    const lastEarned = earned.length ? allAch.find(a => a.id === earned[earned.length - 1]) : null;
    const nextUp = allAch.find(a => !earned.includes(a.id));

    const featuredHTML = [
      lastEarned ? `<div class="ach-item earned ach-featured">
        <span class="ach-emoji">${lastEarned.emoji}</span>
        <div class="ach-info"><strong>${lastEarned.label}</strong><p>${lastEarned.desc}</p></div>
        <span class="ach-check">✓</span>
      </div>` : "",
      nextUp ? `<div class="ach-item locked ach-featured">
        <span class="ach-emoji">${nextUp.emoji}</span>
        <div class="ach-info"><strong>${nextUp.label}</strong><p class="ach-provoke">${provokeCopy(nextUp, stats)}</p></div>
        <span class="ach-lock">🔒</span>
      </div>` : (lastEarned ? `<div class="ach-item earned ach-featured">
        <span class="ach-emoji">🏆</span>
        <div class="ach-info"><strong>All achievements unlocked</strong><p>You've cleared the Hall of Fame.</p></div>
      </div>` : ""),
    ].join("");

    const fullListHTML = allAch.map(a => {
      const isEarned = earned.includes(a.id);
      return `<div class="ach-item ${isEarned ? "earned" : "locked"}">
        <span class="ach-emoji">${a.emoji}</span>
        <div class="ach-info"><strong>${a.label}</strong><p>${a.desc}</p></div>
        ${isEarned ? '<span class="ach-check">✓</span>' : '<span class="ach-lock">🔒</span>'}
      </div>`;
    }).join("");

    container.innerHTML = `
      <div class="gam-card">
        <div class="gam-rank-row">
          <div class="gam-rank-badge">
            <span class="rank-emoji">${rank.emoji}</span>
            <div>
              <p class="eyebrow" style="margin:0">RANK</p>
              <strong class="rank-name">${rank.name}</strong>
            </div>
          </div>
          ${nextRank
            ? `<div class="rank-next"><span class="muted" style="font-size:.7rem">Next: ${nextRank.emoji} ${nextRank.name}</span><span class="muted" style="font-size:.7rem">${nextRank.minXP - data.totalXP} XP away</span></div>`
            : `<span class="rank-max">MAX RANK 💎</span>`}
        </div>
        <div class="xp-section">
          <div class="xp-header">
            <span class="eyebrow" style="margin:0">LEVEL ${lvl.level}</span>
            <span class="xp-label num">${lvl.levelXP} / ${lvl.levelNeeded} XP</span>
          </div>
          <div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div>
          <div class="xp-rewards">
            <span>🏋️ Gym day = +50 XP</span>
            <span>📝 Notes = +10 XP</span>
            <span>📋 Plan = +20 XP</span>
          </div>
        </div>
      </div>
      <div class="section-head" style="margin-top:20px"><div><p class="eyebrow">HALL OF FAME</p><h2>Achievements</h2></div><span class="muted" style="font-size:.76rem">${earned.length}/${allAch.length}</span></div>
      <div class="ach-list">${featuredHTML}</div>
      <button type="button" id="achToggleBtn" class="ach-toggle">See all ${allAch.length} achievements ›</button>
      <div class="ach-list ach-list-full hidden" id="achFullList">${fullListHTML}</div>
    `;

    const toggleBtn = $("achToggleBtn");
    const fullList = $("achFullList");
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const nowHidden = fullList.classList.toggle("hidden");
        toggleBtn.textContent = nowHidden ? `See all ${allAch.length} achievements ›` : "Hide full list ‹";
      };
    }
  }

  function provokeCopy(a, stats) {
    const progress = {
      first_workout:  { have: stats.totalWent, need: 1 },
      streak_3:       { have: stats.currentStreak, need: 3 },
      streak_7:       { have: stats.currentStreak, need: 7 },
      streak_30:      { have: stats.currentStreak, need: 30 },
      workouts_10:    { have: stats.totalWent, need: 10 },
      leg_warrior:    { have: stats.legDays, need: 5 },
      workouts_30:    { have: stats.totalWent, need: 30 },
      elite_athlete:  { have: stats.totalXP, need: 2000 },
      note_taker:     { have: stats.noteCount, need: 5 },
      planner:        { have: stats.planCount, need: 5 },
    }[a.id];
    if (!progress) return "Keep going — it's within reach.";
    const gap = Math.max(0, progress.need - progress.have);
    if (gap <= 0) return "Unlocking any moment now.";
    if (a.id.startsWith("streak")) return gap === 1 ? "One more day and it's yours. Don't stop now." : `${gap} days to go — don't break it now.`;
    if (a.id === "workouts_10" || a.id === "workouts_30") return `${gap} more session${gap === 1 ? "" : "s"} and it's locked in.`;
    if (a.id === "elite_athlete") return `${gap} XP away from Elite rank. So close.`;
    if (a.id === "leg_warrior") return `${gap} more leg day${gap === 1 ? "" : "s"} to earn it.`;
    if (a.id === "note_taker") return `${gap} more note${gap === 1 ? "" : "s"} away.`;
    if (a.id === "planner") return `${gap} more plan${gap === 1 ? "" : "s"} away.`;
    return "Getting closer.";
  }

  function renderDailyMissions() {
    const container = document.getElementById("dailyMissionsSection");
    if (!container) return;
    const g = GL.gamification;
    if (!g) return;

    const missions = g.getTodayMissions();
    const state = getState();
    const today = key();
    const entry = getLog(today);
    const note = (state.journal || []).find(n => n.date === today);
    const plan = state.plans?.[today];
    const hasPlan = plan && plan.exercises && plan.exercises.length > 0;

    const logged = !!(entry && entry.status === "Went");
    const noted = !!note;
    const planned = hasPlan;

    container.innerHTML = `
      <div class="section-head" style="margin-top:20px"><div><p class="eyebrow">DAILY GRIND</p><h2>Today's Missions</h2></div><span class="mission-reward">+50 XP</span></div>
      <div class="mission-card">
        <div class="mission-item ${logged ? "done" : ""}">
          <span class="mission-check">${logged ? "☑" : "☐"}</span>
          <div class="mission-text"><strong>Log workout</strong><p>Mark today as Went</p></div>
          <span class="mission-xp">+50 XP</span>
        </div>
        <div class="mission-item ${noted ? "done" : ""}">
          <span class="mission-check">${noted ? "☑" : "☐"}</span>
          <div class="mission-text"><strong>Add workout note</strong><p>Write how it felt</p></div>
          <span class="mission-xp">+10 XP</span>
        </div>
        <div class="mission-item ${planned ? "done" : ""}">
          <span class="mission-check">${planned ? "☑" : "☐"}</span>
          <div class="mission-text"><strong>Complete a plan</strong><p>Log exercises with sets & reps</p></div>
          <span class="mission-xp">+20 XP</span>
        </div>
        <div class="mission-progress">
          <span class="muted" style="font-size:.74rem">${[logged,noted,planned].filter(Boolean).length}/3 complete</span>
          ${[logged,noted,planned].every(Boolean) ? '<span class="mission-done-badge">🎉 All done!</span>' : ''}
        </div>
      </div>
    `;
  }

  function renderRecentActivity(onOpenDetail) {
    const state = getState();
    const today = key();
    const last3 = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      last3.push(GL.date.key(d));
    }

    const list = $("recentActivity");
    if (!list) return;

    if (!state.logs.length) {
      list.innerHTML = `<div class="empty-state">${icon("empty")}<p>No check-ins yet.<br>Log today to start your streak.</p></div>`;
      return;
    }

    const items = last3.map(date => ({ date, item: state.logs.find(l => l.date === date) }));

    list.innerHTML = items.map(({ date, item }) => {
      const label = new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
      if (!item) {
        return `<button class="activity-item activity-empty" data-date="${date}" type="button">
          <span class="dot dot-empty"></span>
          <div><strong style="color:var(--muted)">No entry</strong><p>${label}</p></div>
          <span class="chev">${icon("chevron")}</span>
        </button>`;
      }
      const cls = item.status.toLowerCase();
      const workoutText = item.workoutType?.length ? ` · ${escapeHtml(item.workoutType.join(", "))}` : "";
      return `<button class="activity-item" data-date="${date}" type="button">
        <span class="dot ${cls}"></span>
        <div><strong>${item.status}</strong><p>${label}${workoutText}</p></div>
        <span class="chev">${icon("chevron")}</span>
      </button>`;
    }).join("");

    list.querySelectorAll("button").forEach(btn => btn.onclick = () => onOpenDetail?.(btn.dataset.date));
  }

  return { renderHome };
})();
