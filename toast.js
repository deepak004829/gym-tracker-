window.GL = window.GL || {};

GL.toast = (function () {
  const { $ } = GL.dom;
  let timer;
  function showToast(message) {
    const node = $("notice");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove("show"), 3200);
  }
  return { showToast };
})();
