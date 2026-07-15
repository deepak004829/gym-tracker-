// Minimal hand-picked stroke icon set — currentColor so CSS controls color.
window.GL = window.GL || {};

GL.icons = (function () {
  const ICON = {
    home: `<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9v-6h6v6h2.5a1 1 0 0 0 1-1v-9"/></svg>`,
    history: `<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`,
    insights: `<svg viewBox="0 0 24 24"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>`,
    profile: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10"/></svg>`,
    dash: `<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>`,
    x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>`,
    flame: `<svg viewBox="0 0 24 24"><path d="M12 2c1 4-4 5-4 9a4 4 0 0 0 8 0c0-1.2-.5-2-1-2.8.8.2 3 1.6 3 5a6 6 0 0 1-12 0C6 8 12 6 12 2Z"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17" rx="2.4"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v1a4 4 0 0 0 3.5 4M17 5h3v1a4 4 0 0 1-3.5 4M9.5 17.5h5M12 13v4.5M8 21h8"/></svg>`,
    calendarDay: `<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>`,
    target: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/></svg>`,
    moon: `<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>`,
    download: `<svg viewBox="0 0 24 24"><path d="M12 3v13m0 0-4.5-4.5M12 16l4.5-4.5"/><path d="M4 19.5h16"/></svg>`,
    bell: `<svg viewBox="0 0 24 24"><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg>`,
    logout: `<svg viewBox="0 0 24 24"><path d="M9 21H5.5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 5.5 3H9"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>`,
    grip: `<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7m-8 0 .8 12.2A2 2 0 0 0 9.8 21h4.4a2 2 0 0 0 2-1.8L17 7"/></svg>`,
    dumbbell: `<svg viewBox="0 0 24 24"><path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/></svg>`,
    empty: `<svg viewBox="0 0 24 24"><path d="M4 19V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13M4 19h16M4 19l3-4 3 2 4-5 3 3"/></svg>`,
  };

  function icon(name, extraClass = "") {
    return (ICON[name] || "").replace("<svg ", `<svg class="${extraClass}" `);
  }

  return { ICON, icon };
})();
