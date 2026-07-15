window.GL = window.GL || {};

GL.dom = (function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  // Escapes user text before it is ever concatenated into innerHTML.
  function escapeHtml(value = "") {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  // Lightweight animated count-up used for streaks and stat numbers.
  function animateNumber(node, to, { duration = 600, decimals = 0 } = {}) {
    const from = Number(node.dataset.value || 0);
    if (from === to) { node.textContent = to; node.dataset.value = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      node.textContent = decimals ? value.toFixed(decimals) : Math.round(value);
      if (t < 1) requestAnimationFrame(step);
      else node.dataset.value = to;
    };
    requestAnimationFrame(step);
  }

  return { $, qs, qsa, el, escapeHtml, animateNumber };
})();
