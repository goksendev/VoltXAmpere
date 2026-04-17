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
  // Sprint 69 FIX: The original Sprint 58 implementation set `scope.ch[0].src`
  // to a node index, but sim.js looks up `src` as a part ID via
  // S.parts.find(pp => pp.id === sch.src). This mismatch meant auto-assign
  // silently produced flat 0V traces. Since the default `src: null` mode
  // already picks nodes by index (scope.ch[ch] maps to nodes[ch]), this hook
  // is now a NO-OP that simply ensures channels are ON — the rest is handled
  // by the default fall-through in sim.js.
  if (typeof window !== 'undefined') {
    setInterval(function() {
      if (typeof S === 'undefined' || !S || !S.sim || !S.sim.running) return;
      if (!S.scope || !Array.isArray(S.scope.ch)) return;
      // Ensure at least channels 0 & 1 are ON if nothing is explicitly set.
      var anySet = false;
      for (var ci = 0; ci < S.scope.ch.length; ci++) {
        if (S.scope.ch[ci] && S.scope.ch[ci].src && S.scope.ch[ci].on) anySet = true;
      }
      if (anySet) return;
      // Turn on channels but leave src=null — sim.js falls back to node-index mode.
      if (S.scope.ch[0]) { S.scope.ch[0].on = true; S.scope.ch[0].src = null; }
      if (S.scope.ch[1]) { S.scope.ch[1].on = true; S.scope.ch[1].src = null; }
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
