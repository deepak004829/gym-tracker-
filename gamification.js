window.GL = window.GL || {};

// ============================================================
// Gamification: XP, Ranks, Achievements, Daily Missions
// ============================================================
GL.gamification = (function () {
  const STORAGE_KEY = "gym-log-gamification";

  const RANKS = [
    { name: "Beginner", emoji: "⚔️", minXP: 0 },
    { name: "Trainee",  emoji: "🥉", minXP: 200 },
    { name: "Warrior",  emoji: "🥈", minXP: 500 },
    { name: "Athlete",  emoji: "🥇", minXP: 1000 },
    { name: "Elite",    emoji: "👑", minXP: 2000 },
    { name: "Legend",   emoji: "💎", minXP: 4000 },
  ];

  const ACHIEVEMENTS = [
    { id: "first_workout",   emoji: "🏆", label: "First Workout",    desc: "Log your very first gym day",        check: (s) => s.totalWent >= 1 },
    { id: "streak_3",        emoji: "🔥", label: "3 Day Streak",     desc: "3 days in a row",                    check: (s) => s.currentStreak >= 3 },
    { id: "streak_7",        emoji: "🔥", label: "7 Day Streak",     desc: "7 days in a row",                    check: (s) => s.currentStreak >= 7 },
    { id: "streak_30",       emoji: "🌟", label: "30 Day Streak",    desc: "30 days in a row — incredible",      check: (s) => s.currentStreak >= 30 },
    { id: "workouts_10",     emoji: "💪", label: "10 Workouts",      desc: "Logged 10 total gym days",           check: (s) => s.totalWent >= 10 },
    { id: "leg_warrior",     emoji: "💪", label: "Leg Day Warrior",  desc: "5 leg day sessions",                 check: (s) => s.legDays >= 5 },
    { id: "workouts_30",     emoji: "⚡", label: "30 Workouts",      desc: "Logged 30 total gym days",           check: (s) => s.totalWent >= 30 },
    { id: "elite_athlete",   emoji: "👑", label: "Elite Athlete",    desc: "Reach Elite rank",                   check: (s) => s.totalXP >= 2000 },
    { id: "note_taker",      emoji: "📝", label: "Note Taker",       desc: "Add 5 workout notes",                check: (s) => s.noteCount >= 5 },
    { id: "planner",         emoji: "📋", label: "Planner",          desc: "Create 5 workout plans",             check: (s) => s.planCount >= 5 },
  ];

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeData(JSON.parse(raw));
    } catch {}
    return normalizeData({});
  }

  function normalizeData(data) {
    return {
      totalXP: Number(data.totalXP) || 0,
      earnedXP: data.earnedXP && typeof data.earnedXP === "object" ? data.earnedXP : {}, // { "2024-07-15": {cardio,workout,attendance,note,plan,exercises:{id:true}} }
      earnedAchievements: Array.isArray(data.earnedAchievements) ? data.earnedAchievements : [],
      missions: data.missions || null,
      notificationTime: data.notificationTime || null,
      notifEnabled: !!data.notifEnabled,
      updatedAt: Number(data.updatedAt) || 0,
    };
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  let _data = loadData();
  function getData() { return _data; }

  // Reset in-memory + local gamification state (called on sign-out / guest
  // entry so one account's XP never leaks onto another account on a shared
  // device — the caller is responsible for also clearing localStorage).
  function reset() {
    _data = normalizeData({});
    saveData(_data);
  }

  // Debounced push of the current gamification data to the signed-in user's
  // Firestore profile doc. No-ops for guests or before Firestore is ready.
  let _remoteTimer = null;
  function persistRemote() {
    clearTimeout(_remoteTimer);
    _remoteTimer = setTimeout(() => {
      try {
        const state = GL.store && GL.store.getState();
        if (!state || state.auth.isGuest || !state.cloud.profileRef) return;
        state.cloud.profileRef.set({
          gamification: {
            totalXP: _data.totalXP,
            earnedXP: _data.earnedXP,
            earnedAchievements: _data.earnedAchievements,
            updatedAt: _data.updatedAt,
          },
        }, { merge: true }).catch(() => {});
      } catch {}
    }, 500);
  }

  // Merge gamification data that came down from Firestore (e.g. on sign-in,
  // or from another device). Last-write-wins by updatedAt so we never lose
  // the more recent side, and never regress a signed-in user's totals back
  // to zero just because the local cache was empty.
  function mergeRemote(remote) {
    if (!remote) return;
    const remoteUpdated = Number(remote.updatedAt) || 0;
    if (remoteUpdated > (_data.updatedAt || 0)) {
      _data = normalizeData({ ..._data, ...remote, updatedAt: remoteUpdated });
      saveData(_data);
    }
  }

  // Compute stats from the main GL store
  function computeStats() {
    const state = GL.store.getState();
    const logs = state.logs || [];
    const journal = state.journal || [];
    const plans = state.plans || {};
    const totalWent = logs.filter(l => l.status === "Went").length;
    const currentStreak = GL.store.currentStreak();
    const legDays = logs.filter(l => l.status === "Went" && l.workoutType?.includes("Legs")).length;
    const noteCount = journal.length;
    const planCount = Object.values(plans).filter(p => p.exercises && p.exercises.length > 0).length;
    return { totalWent, currentStreak, legDays, noteCount, planCount, totalXP: _data.totalXP };
  }

  // Award XP for a day's completed work. Every category is deduplicated per
  // calendar date (and, for individual exercises, per exercise id) so the
  // same action can never pay out twice — resuming a workout, refreshing
  // the page, or re-opening the app after a crash never re-awards XP.
  //
  // Reward table:
  //   cardio completed        -> +20  (once per day)
  //   exercise completed      -> +10  (once per exercise per day)
  //   workout completed       -> +50  (once per day)
  //   daily attendance (Went) -> +25  (once per day)
  //   note added              -> +10  (once per day)
  //   plan created            -> +20  (once per day)
  //   achievement unlock      -> +25  (handled in checkAchievements, once per achievement ever)
  //
  // Nothing is awarded for opening the app, entering Preview Mode, or simply
  // pressing Play / starting cardio — only for work that actually finished.
  function awardXP(date, { note = false, plan = false, cardio = false, workout = false, attendance = false, exerciseId = null } = {}) {
    const earned = _data.earnedXP[date] || {};
    let gain = 0;
    if (note && !earned.note) { gain += 10; earned.note = true; }
    if (plan && !earned.plan) { gain += 20; earned.plan = true; }
    if (cardio && !earned.cardio) { gain += 20; earned.cardio = true; }
    if (workout && !earned.workout) { gain += 50; earned.workout = true; }
    if (attendance && !earned.attendance) { gain += 25; earned.attendance = true; }
    if (exerciseId) {
      earned.exercises = earned.exercises || {};
      if (!earned.exercises[exerciseId]) { gain += 10; earned.exercises[exerciseId] = true; }
    }
    if (gain > 0) {
      _data.totalXP += gain;
      _data.earnedXP[date] = earned;
      _data.updatedAt = Date.now();
      saveData(_data);
      persistRemote();
    }
    return gain;
  }

  // Checks all achievements against current stats and unlocks any that have
  // newly qualified (each achievement can only ever unlock once — dedup is
  // by id, not by date). Returns the list of achievements that were newly
  // unlocked by *this* call, so a caller can show "Achievement unlocked!"
  // exactly once. Intentionally NOT called from inside awardXP, so callers
  // control when they want to know about (and toast) fresh unlocks.
  function checkAchievements() {
    const stats = computeStats();
    const newlyEarned = [];
    ACHIEVEMENTS.forEach(a => {
      if (!_data.earnedAchievements.includes(a.id) && a.check(stats)) {
        _data.earnedAchievements.push(a.id);
        _data.totalXP += 25; // achievement unlock bonus
        newlyEarned.push(a);
      }
    });
    if (newlyEarned.length) {
      _data.updatedAt = Date.now();
      saveData(_data);
      persistRemote();
    }
    return newlyEarned;
  }

  function getCurrentRank() {
    const xp = _data.totalXP;
    let rank = RANKS[0];
    for (const r of RANKS) { if (xp >= r.minXP) rank = r; }
    return rank;
  }

  function getNextRank() {
    const xp = _data.totalXP;
    for (let i = 0; i < RANKS.length; i++) {
      if (xp < RANKS[i].minXP) return RANKS[i];
    }
    return null;
  }

  function getLevelInfo() {
    const xp = _data.totalXP;
    // 1000 XP per level, but escalating
    const level = Math.floor(xp / 200) + 1;
    const levelStart = (level - 1) * 200;
    const levelEnd = level * 200;
    const levelXP = xp - levelStart;
    const levelNeeded = levelEnd - levelStart;
    return { level, levelXP, levelNeeded, totalXP: xp };
  }

  function getTodayMissions() {
    const today = GL.date.key();
    if (_data.missions?.date !== today) {
      _data.missions = { date: today, logged: false, noted: false, planned: false };
      saveData(_data);
    }
    return _data.missions;
  }

  function updateMission(key, val) {
    getTodayMissions();
    _data.missions[key] = val;
    saveData(_data);
  }

  function setNotification(enabled, time) {
    _data.notifEnabled = enabled;
    _data.notificationTime = time || null;
    saveData(_data);
  }

  // Motivational messages for notifications
  const NOTIF_MESSAGES = [
    "💪 Time to crush it! Your gym session awaits.",
    "🔥 Every rep counts. Let's go!",
    "⚡ Your future self will thank you for showing up today.",
    "🏆 Champions train even on tough days. Be a champion.",
    "💎 Consistency is the secret weapon. Don't break the chain!",
    "🌟 One workout can change your whole day. Make it happen.",
    "👑 Legends are made in the gym. Your legend continues today.",
    "🥇 You didn't come this far to only come this far. Keep going!",
    "🔥 The only bad workout is the one that didn't happen.",
    "💪 Pain is temporary. Glory is forever. Hit the gym!",
  ];

  function getRandomMotivation() {
    return NOTIF_MESSAGES[Math.floor(Math.random() * NOTIF_MESSAGES.length)];
  }

  return {
    getData, saveData, loadData, reset, mergeRemote,
    awardXP, checkAchievements, computeStats,
    getCurrentRank, getNextRank, getLevelInfo,
    getTodayMissions, updateMission,
    setNotification, getRandomMotivation,
    RANKS, ACHIEVEMENTS,
  };
})();
