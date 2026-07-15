window.GL = window.GL || {};

GL.settingsSheet = (function () {
  const { $ } = GL.dom;
  const { getState } = GL.store;
  const { openSheet, closeSheet } = GL.sheet;

  let _notifScheduled = false;

  function initSettingsSheet({ onOpen } = {}) {
    $("settingsBtn").onclick = () => openSettingsSheet(onOpen);
    $("settingsSheetClose").onclick = () => closeSheet("settingsSheet");
  }

  function openSettingsSheet(onOpen) {
    renderSettings();
    onOpen?.();
    openSheet("settingsSheet");
  }

  function renderSettings() {
    const state = getState();
    const isGuest = state.auth.isGuest;
    $("profileAvatar").textContent = isGuest ? "G" : (state.auth.user?.email || "G")[0].toUpperCase();
    $("profileName").textContent = isGuest ? "Guest" : (state.auth.user?.email || "Gym Log member");
    $("profileSub").textContent = isGuest ? "Preview mode — create an account to save" : "Firebase account";

    const now = new Date();
    const completed = state.logs.filter((item) => {
      const d = new Date(`${item.date}T12:00:00`);
      return item.status === "Went" && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    $("goalCount").textContent = state.goalTarget;
    $("goalText").textContent = `${completed} of ${state.goalTarget} gym days this month`;
    $("goalBar").style.width = `${Math.min(100, Math.round((completed / state.goalTarget) * 100))}%`;

    ["System", "Light", "Dark"].forEach((label) => {
      const btn = $(`theme${label}Btn`);
      btn.classList.toggle("active", state.theme === label.toLowerCase());
    });

    // Reminder
    $("reminderToggle").checked = state.reminder;
    $("appVersionText").textContent = "4.0.0";

    // Notification section
    renderNotifSection();
    // Tokens / rewards section
    renderTokensSection();
  }

  function renderTokensSection() {
    const container = document.getElementById("tokensSection");
    if (!container) return;

    const g = GL.gamification;
    const data = g.getData();
    const XP_PER_TOKEN = 100;
    const tokens = Math.floor(data.totalXP / XP_PER_TOKEN);
    const xpToNext = XP_PER_TOKEN - (data.totalXP % XP_PER_TOKEN);

    container.innerHTML = `
      <p class="settings-label" style="font-size:.68rem;font-weight:800;color:var(--muted);letter-spacing:.1em;margin:24px 0 8px">🎟️ REWARDS</p>
      <div class="card token-card">
        <div class="token-row">
          <div class="token-count-wrap">
            <span class="token-icon">🎟️</span>
            <div><strong class="token-count num">${tokens}</strong><span class="muted" style="font-size:.76rem;display:block">token${tokens === 1 ? "" : "s"} earned</span></div>
          </div>
          <button type="button" id="redeemTokensBtn" class="btn secondary" style="min-height:38px;padding:0 16px;font-size:.78rem">Redeem</button>
        </div>
        <p class="muted" style="font-size:.72rem;margin:10px 0 0">${xpToNext} XP to your next token · earned automatically as you log workouts, notes, and plans</p>
        <div id="couponGrid" class="coupon-grid hidden">
          <div class="coupon-item locked"><span class="coupon-emoji">🏷️</span><strong>Mystery coupon</strong><span class="muted">Coming soon</span></div>
          <div class="coupon-item locked"><span class="coupon-emoji">🎁</span><strong>Gear discount</strong><span class="muted">Coming soon</span></div>
          <div class="coupon-item locked"><span class="coupon-emoji">✨</span><strong>Premium theme</strong><span class="muted">Coming soon</span></div>
        </div>
      </div>
    `;

    document.getElementById("redeemTokensBtn").onclick = () => {
      const grid = document.getElementById("couponGrid");
      const nowHidden = grid.classList.toggle("hidden");
      if (nowHidden) return;
      GL.toast?.showToast("Redeeming is coming soon — keep stacking tokens!");
    };
  }

  function renderNotifSection() {
    const notifContainer = document.getElementById("notifTimeSection");
    if (!notifContainer) return;

    const g = GL.gamification;
    const gData = g.getData();
    const notifTime = gData.notificationTime || "08:00";
    const notifEnabled = gData.notifEnabled;

    notifContainer.innerHTML = `
      <p class="settings-label" style="font-size:.68rem;font-weight:800;color:var(--muted);letter-spacing:.1em;margin:24px 0 8px">🔔 NOTIFICATIONS</p>
      <div class="card notif-card">
        <div class="notif-row">
          <div>
            <strong style="font-size:.88rem">Daily Reminder</strong>
            <p class="muted" style="font-size:.76rem;margin:2px 0 0">Get a motivational push notification</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="notifToggleMain" ${notifEnabled ? "checked" : ""}>
            <span class="track"></span>
          </label>
        </div>
        <div class="notif-time-row ${notifEnabled ? "" : "hidden"}" id="notifTimeRow">
          <label class="notif-time-label">Reminder Time</label>
          <input type="time" id="notifTimeInput" class="notif-time-input" value="${notifTime}">
        </div>
        <div class="notif-preview ${notifEnabled ? "" : "hidden"}" id="notifPreview">
          <p class="muted" style="font-size:.74rem">🔔 Preview: <em>${GL.gamification.getRandomMotivation()}</em></p>
        </div>
        <div id="notifPermBadge" class="notif-perm-badge hidden"></div>
      </div>
    `;

    const toggle = document.getElementById("notifToggleMain");
    const timeRow = document.getElementById("notifTimeRow");
    const timeInput = document.getElementById("notifTimeInput");
    const preview = document.getElementById("notifPreview");
    const permBadge = document.getElementById("notifPermBadge");

    toggle.onchange = async () => {
      if (toggle.checked) {
        if (!("Notification" in window)) {
          toggle.checked = false;
          permBadge.textContent = "❌ Notifications not supported in this browser";
          permBadge.classList.remove("hidden");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toggle.checked = false;
          permBadge.textContent = "❌ Please enable notifications in your browser/phone settings";
          permBadge.classList.remove("hidden");
          GL.toast?.showToast("Notification permission denied.");
          return;
        }
        permBadge.classList.add("hidden");
        timeRow.classList.remove("hidden");
        preview.classList.remove("hidden");
        g.setNotification(true, timeInput.value);
        scheduleNotification(timeInput.value);
        GL.toast?.showToast("✅ Reminder set for " + timeInput.value);
      } else {
        timeRow.classList.add("hidden");
        preview.classList.add("hidden");
        g.setNotification(false, timeInput.value);
        GL.toast?.showToast("Reminder turned off.");
      }
    };

    timeInput.onchange = () => {
      g.setNotification(true, timeInput.value);
      scheduleNotification(timeInput.value);
      GL.toast?.showToast("✅ Reminder updated to " + timeInput.value);
    };
  }

  function scheduleNotification(time) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;

    // Clear previous
    if (window._notifTimer) clearTimeout(window._notifTimer);
    window._notifTimer = setTimeout(() => {
      try {
        new Notification("💪 Gym Log", {
          body: GL.gamification.getRandomMotivation(),
          icon: "icon-192.png",
          badge: "icon-192.png",
          tag: "gym-log-reminder",
        });
      } catch(e) { console.warn("Notification error:", e); }
      // Reschedule for next day
      scheduleNotification(time);
    }, delay);
  }

  // Auto-reschedule on load if enabled
  function tryAutoSchedule() {
    const g = GL.gamification;
    const gData = g.getData();
    if (gData.notifEnabled && gData.notificationTime) {
      if ("Notification" in window && Notification.permission === "granted") {
        scheduleNotification(gData.notificationTime);
      }
    }
  }

  function applyTheme() {
    const state = getState();
    const dark = state.theme === "dark" || (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark", dark);
  }

  return { initSettingsSheet, openSettingsSheet, renderSettings, applyTheme, tryAutoSchedule };
})();
