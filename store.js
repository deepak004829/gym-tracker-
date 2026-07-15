window.GL = window.GL || {};

GL.store = (function () {
  const { key, fromKey } = GL.date;
  const LOCAL_KEYS = { theme: "gym-log-theme", reminder: "gym-log-reminder" };

  const state = {
    logs: [],          // [{date,status,workoutType[],reason,updatedAt,loggedAt}]
    journal: [],        // [{id,date,text,createdAt}]
    plans: {},           // { [date]: {title,focus,notes,planDone,exercises:[{id,name,sets,reps,weight,done}]} }
    goalTarget: 12,
    theme: "system",
    reminder: false,
    activeTab: "home",
    calendar: { year: new Date().getFullYear(), month: new Date().getMonth() },
    auth: { user: null, isGuest: false, mode: "signin" },
    cloud: { profileRef: null, logsRef: null, notesRef: null, plansRef: null, unsubs: [], timer: null, ready: false, migrating: false },
    celebratedStreaks: new Set(),
  };

  const listeners = new Set();
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify() { listeners.forEach((fn) => fn(state)); }
  function getState() { return state; }

  function loadPreferences() {
    try {
      state.theme = localStorage.getItem(LOCAL_KEYS.theme) || "system";
      state.reminder = localStorage.getItem(LOCAL_KEYS.reminder) === "true";
    } catch {}
  }
  function savePreferences() {
    try {
      localStorage.setItem(LOCAL_KEYS.theme, state.theme);
      localStorage.setItem(LOCAL_KEYS.reminder, String(state.reminder));
    } catch {}
  }

  function getLog(date) { return state.logs.find((item) => item.date === date); }

  function todayPlan() {
    const date = key();
    if (!state.plans[date]) state.plans[date] = { title: "", focus: "", notes: "", planDone: false, exercises: [] };
    return state.plans[date];
  }

  // Looks back through saved plans (excluding today) for the most recent time
  // this exercise name was logged, so the exercise card can show "last time".
  function previousPerformance(name) {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    const todayKey = key();
    const dates = Object.keys(state.plans).filter((d) => d !== todayKey).sort().reverse();
    for (const date of dates) {
      const match = state.plans[date].exercises.find((e) => e.name.trim().toLowerCase() === needle && (e.weight || e.sets || e.reps));
      if (match) return { date, ...match };
    }
    return null;
  }

  function currentStreak() {
    const map = new Map(state.logs.map((item) => [item.date, item.status]));
    let cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    if (!map.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
    let total = 0;
    for (;;) {
      const status = map.get(key(cursor));
      if (status === "Went") total++;
      else if (status !== "Rest") break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return total;
  }

  function longestStreak() {
    let best = 0, current = 0, last = null;
    [...state.logs].sort((a, b) => a.date.localeCompare(b.date)).forEach((item) => {
      const date = fromKey(item.date);
      if (last && Math.round((date - last) / 86400000) > 1) current = 0;
      if (item.status === "Went") current++;
      else if (item.status === "Missed") current = 0;
      best = Math.max(best, current);
      last = date;
    });
    return best;
  }

  function monthConsistency(now = new Date()) {
    const went = state.logs.filter((item) => item.status === "Went");
    const inMonth = (item) => { const d = fromKey(item.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
    const monthWent = went.filter(inMonth).length;
    const decided = state.logs.filter((item) => inMonth(item) && (item.status === "Went" || item.status === "Missed")).length;
    return { monthWent, decided, percent: decided ? Math.round((monthWent / decided) * 100) : 0, totalWent: went.length };
  }

  function muscleMix() {
    const categories = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Cardio"];
    return categories.map((category) => ({
      category,
      count: state.logs.reduce((total, item) => total + (item.status === "Went" && item.workoutType?.includes(category) ? 1 : 0), 0),
    }));
  }

  return {
    subscribe, notify, getState, loadPreferences, savePreferences,
    getLog, todayPlan, previousPerformance, currentStreak, longestStreak,
    monthConsistency, muscleMix, STORAGE: LOCAL_KEYS,
  };
})();
