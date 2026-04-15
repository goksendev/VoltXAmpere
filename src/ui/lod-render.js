// ──────── SPRINT 45: LOD RENDER HELPER ────────
// Pure helpers for computing Level-of-Detail tier + optional LOD-aware draw.
// Current render-loop is not mutated — drawPartLOD is available for call sites
// (breadboard preview, export, future batched drawScene) to opt into LOD.

VXA.LOD = (function() {
  'use strict';

  // Pixel-size thresholds mapped from zoom. COMP default width ≈ 80 world-units.
  // Returns 0..3:
  //   0: point  (screenSize < 8)   — single pixel
  //   1: box    (screenSize < 20)  — tinted rectangle
  //   2: simple (screenSize < 40)  — low-detail stroke
  //   3: full   (otherwise)        — normal def.draw()
  function lodLevel(zoom) {
    var s = 80 * (zoom || 1);
    if (s < 8)  return 0;
    if (s < 20) return 1;
    if (s < 40) return 2;
    return 3;
  }

  // Convenience: screen size in pixels for a given part def + zoom.
  function screenSize(zoom) { return 80 * (zoom || 1); }

  // LOD-aware draw. Caller still manages ctx.translate/rotate for LOD 2+3.
  // For LOD 0 and 1 we draw directly in screen space to avoid transform cost.
  function drawPartLOD(ctx, part, zoom, defOverride) {
    if (!ctx || !part) return;
    var def = defOverride || (typeof COMP !== 'undefined' ? COMP[part.type] : null);
    if (!def) return;
    var lvl = lodLevel(zoom);
    var ox = (typeof S !== 'undefined' && S.view) ? S.view.ox : 0;
    var oy = (typeof S !== 'undefined' && S.view) ? S.view.oy : 0;
    var sx = part.x * zoom + ox;
    var sy = part.y * zoom + oy;
    var color = def.color || '#888';

    if (lvl === 0) {
      ctx.fillStyle = color;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      return;
    }
    if (lvl === 1) {
      var ss = 80 * zoom;
      var prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(sx - ss / 3, sy - ss / 4, ss / 1.5, ss / 2);
      ctx.globalAlpha = prevAlpha;
      return;
    }
    // LOD 2 + 3 — delegate to def.draw() inside a scaled transform.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(zoom, zoom);
    if (part.rot) ctx.rotate((part.rot || 0) * Math.PI / 2);
    if (part.flipH) ctx.scale(-1, 1);
    if (part.flipV) ctx.scale(1, -1);
    ctx.strokeStyle = color;
    ctx.lineWidth = lvl === 2 ? 1.5 / zoom : 2 / zoom;
    try { def.draw(ctx, zoom, part); } catch (e) { /* non-fatal */ }
    ctx.restore();
  }

  return { lodLevel: lodLevel, screenSize: screenSize, drawPartLOD: drawPartLOD };
})();
// Also expose drawPartLOD globally for convenience
if (typeof window !== 'undefined') window.drawPartLOD = VXA.LOD.drawPartLOD;
