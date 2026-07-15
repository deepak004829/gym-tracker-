// Small, dependency-free date helpers. Every date in app state is stored as
// a "YYYY-MM-DD" string key in local time — never a Date object — so it can
// be compared, sorted, and used as a Firestore doc id directly.
//
// Plain script (no import/export) so the app can be opened straight from a
// folder via file:// as well as from a server — ES modules are blocked by
// CORS under file://, plain scripts are not.
window.GL = window.GL || {};

GL.date = (function () {
  function key(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function fromKey(dateKey) {
    return new Date(`${dateKey}T12:00:00`);
  }

  function displayDate(dateKey = key(), opts = { weekday: "long", month: "long", day: "numeric" }) {
    return fromKey(dateKey).toLocaleDateString(undefined, opts);
  }

  function isToday(dateKey) {
    return dateKey === key();
  }

  function addDays(dateKey, delta) {
    const d = fromKey(dateKey);
    d.setDate(d.getDate() + delta);
    return key(d);
  }

  function startOfWeek(dateKey = key()) {
    const d = fromKey(dateKey);
    d.setDate(d.getDate() - d.getDay());
    return key(d);
  }

  function last7Days(dateKey = key()) {
    const out = [];
    for (let i = 6; i >= 0; i--) out.push(addDays(dateKey, -i));
    return out;
  }

  const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return { key, fromKey, displayDate, isToday, addDays, startOfWeek, last7Days, WEEKDAY_LETTERS, MONTH_LABELS };
})();
