window.GL = window.GL || {};

GL.confetti = (function () {
  const COLORS = ["#ff5a36", "#c8ff4d", "#2f8fd6", "#ff9955"];

  function fireConfetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let canvas = document.getElementById("confettiCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "confettiCanvas";
      document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 60,
      y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 3,
      size: Math.random() * 7 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    }));

    let raf;
    function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      for (const p of pieces) {
        p.vy += 0.32;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.008;
        if (p.life <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(frame);
      else { cancelAnimationFrame(raf); canvas.remove(); }
    }
    frame();
  }

  return { fireConfetti };
})();
