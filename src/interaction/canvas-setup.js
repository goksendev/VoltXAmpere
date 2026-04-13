// ──────── CANVAS SETUP ────────
const cvs = document.getElementById('C'), ctx = cvs.getContext('2d');
const scvs = document.getElementById('SC'), sctx = scvs.getContext('2d');

function resizeCanvas(c, x) {
  const r = c.parentElement.getBoundingClientRect();
  c.width = r.width * DPR; c.height = r.height * DPR;
  c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
  x.setTransform(DPR, 0, 0, DPR, 0, 0); needsRender = true;
}
new ResizeObserver(() => resizeCanvas(cvs, ctx)).observe(cvs.parentElement);
new ResizeObserver(() => resizeCanvas(scvs, sctx)).observe(scvs.parentElement);
setTimeout(() => {
  resizeCanvas(cvs, ctx); resizeCanvas(scvs, sctx);
  S.view.ox = cvs.width / DPR / 2; S.view.oy = cvs.height / DPR / 2; needsRender = true;
}, 60);

// ──────── COORDINATE TRANSFORMS ────────
function s2w(sx, sy) { return { x: (sx - S.view.ox) / S.view.zoom, y: (sy - S.view.oy) / S.view.zoom }; }
function w2s(wx, wy) { return { x: wx * S.view.zoom + S.view.ox, y: wy * S.view.zoom + S.view.oy }; }
function snap(v) { return Math.round(v / GRID) * GRID; }

// ──────── PIN & HIT HELPERS ────────
function getPartPins(part) {
  const def = COMP[part.type]; if (!def) return [];
  const r = (part.rot || 0) * Math.PI / 2, cos = Math.cos(r), sin = Math.sin(r);
  return def.pins.map(p => ({ x: part.x + p.dx * cos - p.dy * sin, y: part.y + p.dx * sin + p.dy * cos }));
}
function findNearestPin(wx, wy) {
  let best = null, bd = PIN_SNAP;
  for (const p of S.parts) {
    for (const pin of getPartPins(p)) {
      const d = Math.hypot(pin.x - wx, pin.y - wy);
      if (d < bd) { bd = d; best = { x: pin.x, y: pin.y, partId: p.id }; }
    }
  }
  return best;
}
function hitTestPart(wx, wy) {
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i];
    if (Math.abs(p.x - wx) < 50 && Math.abs(p.y - wy) < 50) return p;
  }
  return null;
}
