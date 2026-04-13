// ──────── TOUCH SUPPORT ────────
(function initTouch() {
  if (navigator.maxTouchPoints < 1) return;
  const wrap = document.getElementById('canvas-wrap');
  let lastTouches = null, lastDist = 0;

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const r = cvs.getBoundingClientRect();
      const mx = t.clientX - r.left, my = t.clientY - r.top;
      // Simulate mousedown
      wrap.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0 }));
    }
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
    }
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      wrap.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
    }
    if (e.touches.length === 2 && lastTouches) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      // Pinch zoom
      if (lastDist > 0) {
        const factor = d / lastDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const r = cvs.getBoundingClientRect();
        const mx = cx - r.left, my = cy - r.top;
        const nz = Math.max(S.view.minZoom, Math.min(S.view.maxZoom, S.view.zoom * factor));
        const ratio = nz / S.view.zoom;
        S.view.ox = mx - (mx - S.view.ox) * ratio;
        S.view.oy = my - (my - S.view.oy) * ratio;
        S.view.zoom = nz;
      }
      // Two-finger pan
      const pmx = (lastTouches[0].x + lastTouches[1].x) / 2;
      const pmy = (lastTouches[0].y + lastTouches[1].y) / 2;
      const cmx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cmy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      S.view.ox += cmx - pmx;
      S.view.oy += cmy - pmy;

      lastDist = d;
      lastTouches = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
      needsRender = true;
    }
    e.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      wrap.dispatchEvent(new MouseEvent('mouseup', {}));
      lastTouches = null; lastDist = 0;
    }
    e.preventDefault();
  }, { passive: false });
})();
