window.GL = window.GL || {};

GL.sheet = (function () {
  const { $ } = GL.dom;
  let openSheets = 0;

  function openSheet(sheetId) {
    const scrim = $("sheetScrim");
    const sheet = $(sheetId);
    scrim.classList.add("show");
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => sheet.classList.add("show"));
    openSheets++;
    document.body.style.overflow = "hidden";
  }

  function closeSheet(sheetId) {
    const sheet = $(sheetId);
    sheet.classList.remove("show");
    setTimeout(() => sheet.classList.add("hidden"), 260);
    openSheets = Math.max(0, openSheets - 1);
    if (openSheets === 0) {
      $("sheetScrim").classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  function closeAllSheets() {
    document.querySelectorAll(".sheet").forEach((sheet) => {
      sheet.classList.remove("show");
      setTimeout(() => sheet.classList.add("hidden"), 260);
    });
    openSheets = 0;
    $("sheetScrim").classList.remove("show");
    document.body.style.overflow = "";
  }

  return { openSheet, closeSheet, closeAllSheets };
})();
