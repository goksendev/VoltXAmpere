// ──────── SPRINT 50: SMITH CHART (v9.0) ────────
// Canvas-based Smith chart renderer. CRT-green theme, independent of scope.

VXA.SmithChart = (function() {
  'use strict';

  function draw(ctx, cx, cy, radius, data, Z0ref) {
    if (!ctx) return;
    Z0ref = Z0ref || 50;
    ctx.save();
    // Background
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,20,0,0.3)'; ctx.fill();
    ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 1; ctx.stroke();

    // Constant-resistance circles
    ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 0.5;
    [0, 0.2, 0.5, 1, 2, 5].forEach(function(r) {
      var cr = radius / (1 + r);
      var ccx = cx + radius * r / (1 + r);
      ctx.beginPath(); ctx.arc(ccx, cy, cr, 0, 2 * Math.PI); ctx.stroke();
    });

    // Constant-reactance arcs
    [0.2, 0.5, 1, 2, 5].forEach(function(x) {
      var rx = radius / x;
      ctx.beginPath(); ctx.arc(cx + radius, cy - rx, rx, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + radius, cy + rx, rx, Math.PI, 3 * Math.PI / 2); ctx.stroke();
    });

    // Horizontal axis
    ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();

    // S11 trace
    if (Array.isArray(data) && data.length > 0) {
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      var first = true;
      for (var i = 0; i < data.length; i++) {
        var s11 = data[i].S11;
        if (!s11) continue;
        var sx = cx + s11.re * radius;
        var sy = cy - s11.im * radius;
        if (first) { ctx.moveTo(sx, sy); first = false; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      // Start dot
      if (data[0] && data[0].S11) {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.arc(cx + data[0].S11.re * radius, cy - data[0].S11.im * radius, 4, 0, 2 * Math.PI); ctx.fill();
      }
    }

    // Labels
    ctx.fillStyle = '#3a6a3a';
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('0', cx - radius - 10, cy + 4);
    ctx.fillText('∞', cx + radius + 10, cy + 4);
    ctx.fillText('Z₀=' + Z0ref + 'Ω', cx, cy + radius + 14);

    ctx.restore();
  }

  return { draw: draw };
})();
