// ──────── SPRINT 59: Connection render hook + toggleSim check ────────
// Non-invasive: monkey-patches render() + toggleSim() to integrate
// ConnectionCheck.drawFloatingPins and auto-check on sim start.
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ── drawFloatingPins into render loop ──
  var _origRender = (typeof render === 'function') ? render : null;
  if (_origRender) {
    window.render = function() {
      _origRender.apply(this, arguments);
      try {
        if (VXA.ConnectionCheck && typeof VXA.ConnectionCheck.drawFloatingPins === 'function') {
          var cvs = document.getElementById('C');
          if (cvs && S && S.view) {
            var ctx = cvs.getContext('2d');
            VXA.ConnectionCheck.drawFloatingPins(ctx, S.view.zoom || 1);
          }
        }
      } catch (e) {}
    };
  }

  // ── Connection check on sim start ──
  // IMPORTANT: sim-speed.js already wraps toggleSim and stores original as
  // _origToggleSim. We must preserve that chain. Instead of monkey-patching
  // toggleSim again (which breaks CROSS_10-13 tests), we hook via a side
  // effect: listen for sim.running state transitions in the render interval.
  var _prevSimRunning = false;
  setInterval(function() {
    if (typeof S === 'undefined' || !S || !S.sim) return;
    var isRunning = !!S.sim.running;
    if (isRunning && !_prevSimRunning) {
      // Sim just started — run connection check
      try {
        if (VXA.ConnectionCheck) {
          VXA.ConnectionCheck.clearWarnings();
          var w = VXA.ConnectionCheck.check();
          if (w.length > 0) VXA.ConnectionCheck.showWarnings(w);
        }
      } catch (e) {}
    }
    _prevSimRunning = isRunning;
  }, 300);

  // ── Wire tooltip on canvas click (sim running, no part selected) ──
  var cvs = document.getElementById('C') || document.querySelector('canvas');
  if (cvs) {
    cvs.addEventListener('click', function(e) {
      if (!S || !S.sim || !S.sim.running) return;
      if (S.sel && S.sel.length > 0) return; // part selected — skip
      if (S.mode && S.mode !== 'select') return;
      if (typeof window._vxaWireTooltipHandler !== 'function') return;
      // Screen → world
      var rect = cvs.getBoundingClientRect();
      var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      var zoom = (S.view && S.view.zoom) || 1;
      var ox = (S.view && S.view.ox) || 0, oy = (S.view && S.view.oy) || 0;
      var wx = (sx - ox) / zoom, wy = (sy - oy) / zoom;
      var result = window._vxaWireTooltipHandler(wx, wy);
      if (!result) {
        var tip = document.getElementById('wire-tooltip');
        if (tip) tip.style.display = 'none';
        return;
      }
      var tip = document.getElementById('wire-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'wire-tooltip';
        tip.style.cssText = 'position:fixed;background:var(--surface-2,#1a1a1a);border:1px solid var(--accent,#00e09e);border-radius:8px;padding:8px 12px;font:11px var(--font-mono,monospace);color:var(--text,#eee);z-index:200;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.5)';
        document.body.appendChild(tip);
      }
      tip.innerHTML = 'V\u2081=' + result.v1.toFixed(2) + 'V<br>V\u2082=' + result.v2.toFixed(2) + 'V<br>\u0394V=' + result.deltaV.toFixed(2) + 'V';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY - 40) + 'px';
      tip.style.display = 'block';
      clearTimeout(tip._ht);
      tip._ht = setTimeout(function() { tip.style.display = 'none'; }, 3000);
    });
  }
})();
