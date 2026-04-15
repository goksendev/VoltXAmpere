// ──────── SPRINT 50: S-PARAM ANALYSIS TAB RUNNER ────────
// Minimal hookup: finds the first tline part, runs sparamSweep, renders
// Smith chart + S11/S21 Bode-style plot into the sparam tab canvas.

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  window.runSParam = function(opts) {
    opts = opts || {};
    var fStart = opts.fStart || 1e6;
    var fStop = opts.fStop || 1e9;
    var numPoints = opts.numPoints || 100;
    var Z0ref = opts.Z0ref || 50;

    // Find tline part (or default to demo values)
    var Z0 = 50, TD = 1e-9;
    if (typeof S !== 'undefined' && S && Array.isArray(S.parts)) {
      var tl = S.parts.find(function(p) { return p.type === 'tline'; });
      if (tl) {
        Z0 = tl.val || 50;
        TD = tl.td || tl.TD || 1e-9;
      }
    }

    var sweep = VXA.TransmissionLine.sparamSweep(Z0, TD, fStart, fStop, numPoints, Z0ref);

    // Render into #SPARAM_CANVAS if present
    var canvas = document.getElementById('SPARAM_CANVAS');
    if (canvas && canvas.getContext) {
      var ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#040a04';
      ctx.fillRect(0, 0, w, h);
      // Left half: Smith chart
      var smithR = Math.min(w * 0.25, h * 0.4);
      VXA.SmithChart.draw(ctx, w * 0.25, h * 0.5, smithR, sweep, Z0ref);
      // Right half: dB Bode
      var px = w * 0.55, py = h * 0.1, pw = w * 0.4, ph = h * 0.8;
      ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);
      // Axes labels
      ctx.fillStyle = '#3a6a3a'; ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(fStart.toExponential(0) + 'Hz', px, py + ph + 12);
      ctx.textAlign = 'right';
      ctx.fillText(fStop.toExponential(0) + 'Hz', px + pw, py + ph + 12);
      // Plot S11_dB (red) and S21_dB (green), clamped to [-60, +5]
      function plotTrace(color, key) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var i = 0; i < sweep.length; i++) {
          var dbv = sweep[i][key];
          if (!isFinite(dbv)) continue;
          var clamped = Math.max(-60, Math.min(5, dbv));
          var sx = px + (i / (sweep.length - 1)) * pw;
          var sy = py + ph - ((clamped + 60) / 65) * ph;
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      plotTrace('#ef4444', 'S11_dB');
      plotTrace('#4ade80', 'S21_dB');
      // Legend
      ctx.fillStyle = '#ef4444'; ctx.fillText('S11', px + 8, py + 14);
      ctx.fillStyle = '#4ade80'; ctx.fillText('S21', px + 40, py + 14);
    }

    // Render compact summary into #sparam-summary
    var sum = document.getElementById('sparam-summary');
    if (sum) {
      var midIdx = Math.floor(sweep.length / 2);
      var mid = sweep[midIdx];
      sum.textContent = '|S11| @ ' + (mid.freq / 1e6).toFixed(0) + 'MHz = ' +
        mid.S11_dB.toFixed(1) + ' dB (VSWR=' + (isFinite(mid.VSWR) ? mid.VSWR.toFixed(2) : '∞') + '), ' +
        '|S21| = ' + mid.S21_dB.toFixed(1) + ' dB';
    }
    return sweep;
  };
})();
