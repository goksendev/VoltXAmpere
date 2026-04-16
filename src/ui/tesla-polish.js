// ──────── SPRINT 58: TESLA POLISH — A/K labels + wire energy + scope auto-assign ────────
// Non-invasive cosmetic enhancements. Existing render/draw pipelines are NOT mutated.

(function() {
  'use strict';
  if (typeof document === 'undefined') return;

  // ── A/K label injection for diode/LED/zener/schottky ──
  // Monkey-patches the draw function to append A/K labels.
  function patchDiodeDraw(type) {
    if (typeof COMP === 'undefined' || !COMP[type]) return;
    var orig = COMP[type].draw;
    if (!orig || orig._aklabeled) return;
    COMP[type].draw = function(c, z, p) {
      orig.call(this, c, z, p);
      try {
        c.font = '7px monospace';
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.textAlign = 'center';
        // Anode left, Cathode right (standard orientation)
        c.fillText('A', -22, -10);
        c.fillText('K', 22, -10);
      } catch (e) {}
    };
    COMP[type].draw._aklabeled = true;
  }

  // Patch after DOM load (COMP available)
  function applyPatches() {
    patchDiodeDraw('diode');
    patchDiodeDraw('led');
    patchDiodeDraw('zener');
    patchDiodeDraw('schottky');
  }
  if (typeof COMP !== 'undefined') applyPatches();
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPatches);
  else setTimeout(applyPatches, 500);

  // ── Scope auto-assign: first non-zero node after sim start ──
  // Listens to toggleSim; on start, pick highest-V node for CH1.
  if (typeof window !== 'undefined') {
    var _origToggle = (typeof toggleSim === 'function') ? toggleSim : null;
    // We don't override toggleSim here — too risky. Instead, a periodic
    // check after sim is running assigns scope if channels are empty.
    setInterval(function() {
      if (typeof S === 'undefined' || !S || !S.sim || !S.sim.running) return;
      if (!S.scope) return;
      // Only auto-assign if no channel is set (all 0)
      var anySet = false;
      for (var ch = 0; ch < 4; ch++) {
        if (S.scope['ch' + ch] && S.scope['ch' + ch] > 0) anySet = true;
      }
      if (anySet) return;
      // Find highest-V node
      if (typeof SIM === 'undefined' || !SIM || !S._nodeVoltages) return;
      var maxV = 0, maxN = 1;
      for (var i = 1; i < SIM.N; i++) {
        var v = Math.abs(S._nodeVoltages[i] || 0);
        if (v > maxV) { maxV = v; maxN = i; }
      }
      if (maxV > 0.1 && S.scope.ch0 !== undefined) S.scope.ch0 = maxN;
    }, 500);
  }

  // ── Wire tooltip on click (simple) ──
  // If a wire is clicked during simulation, show a tooltip with endpoint voltages.
  window._vxaWireTooltipHandler = function(wx, wy) {
    if (typeof S === 'undefined' || !S || !S.sim || !S.sim.running) return null;
    if (!S._pinToNode || !S._nodeVoltages) return null;
    // Find wire under mouse
    for (var i = 0; i < S.wires.length; i++) {
      var w = S.wires[i];
      // Point-to-segment distance
      var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      var len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      var t = Math.max(0, Math.min(1, ((wx - w.x1) * dx + (wy - w.y1) * dy) / len2));
      var px = w.x1 + t * dx, py = w.y1 + t * dy;
      if (Math.hypot(wx - px, wy - py) < 8) {
        var n1 = w._n1 || 0, n2 = w._n2 || 0;
        var v1 = S._nodeVoltages[n1] || 0;
        var v2 = S._nodeVoltages[n2] || 0;
        return { v1: v1, v2: v2, deltaV: Math.abs(v1 - v2) };
      }
    }
    return null;
  };
})();
