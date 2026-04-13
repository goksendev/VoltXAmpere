VXA.Graph = (function() {
  function niceStep(rough) {
    var exp = Math.floor(Math.log10(Math.abs(rough) || 1));
    var frac = rough / Math.pow(10, exp);
    var nice = frac <= 1.5 ? 1 : frac <= 3.5 ? 2 : frac <= 7.5 ? 5 : 10;
    return nice * Math.pow(10, exp);
  }
  function fmtLabel(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(0) + 'G';
    if (a >= 1e6) return (v / 1e6).toFixed(0) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(0) + 'k';
    if (a >= 1) return v.toFixed(a < 10 ? 1 : 0);
    if (a >= 1e-3) return (v * 1e3).toFixed(0) + 'm';
    if (a >= 1e-6) return (v * 1e6).toFixed(0) + 'µ';
    if (a >= 1e-9) return (v * 1e9).toFixed(0) + 'n';
    return v.toExponential(0);
  }
  function getLogTicks(min, max) {
    var ticks = [], s = Math.floor(Math.log10(Math.max(min, 1e-15))), e = Math.ceil(Math.log10(Math.max(max, 1e-15)));
    for (var d = s; d <= e; d++) { var base = Math.pow(10, d); [1, 2, 5].forEach(function(m) { var v = m * base; if (v >= min * 0.9 && v <= max * 1.1) ticks.push(v); }); }
    return ticks;
  }
  function getLinTicks(min, max, count) {
    var step = niceStep((max - min) / (count || 6)), ticks = [], v = Math.ceil(min / step) * step;
    while (v <= max + step * 0.01) { ticks.push(v); v += step; }
    return ticks;
  }
  function draw(canvas, traces, options) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width / (window.devicePixelRatio || 1), h = canvas.height / (window.devicePixelRatio || 1);
    var pad = { t: 25, r: 20, b: 35, l: 55 }, pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, w, h);
    if (!traces || !traces.length || !traces[0].length) return;
    var opt = options || {};
    var logX = opt.logX || false, logY = opt.logY || false;
    var all = []; traces.forEach(function(tr) { tr.forEach(function(d) { all.push(d); }); });
    var xMin = opt.xMin != null ? opt.xMin : Math.min.apply(null, all.map(function(d) { return d.x; }));
    var xMax = opt.xMax != null ? opt.xMax : Math.max.apply(null, all.map(function(d) { return d.x; }));
    var yMin = opt.yMin != null ? opt.yMin : Math.min.apply(null, all.map(function(d) { return d.y; }));
    var yMax = opt.yMax != null ? opt.yMax : Math.max.apply(null, all.map(function(d) { return d.y; }));
    if (yMax - yMin < 0.01) { yMin -= 1; yMax += 1; } else { var yr = (yMax - yMin) * 0.05; yMin -= yr; yMax += yr; }
    if (logX && xMin <= 0) xMin = 1;
    function x2s(x) { var n = logX ? (Math.log10(Math.max(x, 1e-15)) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) : (x - xMin) / (xMax - xMin); return pad.l + n * pw; }
    function y2s(y) { var n = (y - yMin) / (yMax - yMin); return pad.t + (1 - n) * ph; }
    // Grid
    var xT = logX ? getLogTicks(xMin, xMax) : getLinTicks(xMin, xMax, 8);
    var yT = getLinTicks(yMin, yMax, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    xT.forEach(function(x) { var sx = x2s(x); ctx.beginPath(); ctx.moveTo(sx, pad.t); ctx.lineTo(sx, pad.t + ph); ctx.stroke(); });
    yT.forEach(function(y) { var sy = y2s(y); ctx.beginPath(); ctx.moveTo(pad.l, sy); ctx.lineTo(pad.l + pw, sy); ctx.stroke(); });
    // Axis labels
    ctx.fillStyle = '#6e7681'; ctx.font = '9px "JetBrains Mono"';
    ctx.textAlign = 'center'; xT.forEach(function(x) { ctx.fillText(fmtLabel(x), x2s(x), h - pad.b + 15); });
    ctx.textAlign = 'right'; yT.forEach(function(y) { ctx.fillText(fmtLabel(y), pad.l - 5, y2s(y) + 3); });
    // Axis titles
    ctx.fillStyle = '#8b949e'; ctx.font = '10px "Inter", sans-serif'; ctx.textAlign = 'center';
    if (opt.xLabel) ctx.fillText(opt.xLabel, pad.l + pw / 2, h - 3);
    if (opt.title) { ctx.fillStyle = '#e6edf3'; ctx.font = '11px "Inter", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(opt.title, pad.l, 14); }
    // Traces
    var colors = opt.colors || ['#3fb950', '#58a6ff', '#d29922', '#f778ba', '#00e09e', '#f59e0b'];
    traces.forEach(function(tr, ti) {
      if (tr.length < 2) return;
      ctx.strokeStyle = colors[ti % colors.length]; ctx.lineWidth = 1.5; ctx.shadowColor = colors[ti % colors.length]; ctx.shadowBlur = 3;
      ctx.beginPath();
      tr.forEach(function(d, i) { var sx = x2s(d.x), sy = y2s(d.y); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); });
      ctx.stroke(); ctx.shadowBlur = 0;
    });
    canvas._graphMeta = { x2s: x2s, y2s: y2s, pad: pad, pw: pw, ph: ph, xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax, logX: logX, traces: traces };
  }
  return { draw: draw, fmtLabel: fmtLabel, getLogTicks: getLogTicks, getLinTicks: getLinTicks };
})();
// 8.10: ANALİZ EXPORT (CSV + PNG)
function exportAnalysisCSV(data, filename) {
  if (!data || !data.length) return;
  var keys = Object.keys(data[0]);
  var csv = keys.join(',') + '\n';
  data.forEach(function(row) { csv += keys.map(function(k) { return row[k]; }).join(',') + '\n'; });
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename || 'vxa_analysis.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function exportAnalysisPNG(canvas, filename) {
  if (!canvas) return;
  var url = canvas.toDataURL('image/png');
  var a = document.createElement('a'); a.href = url;
  a.download = filename || 'vxa_analysis.png'; a.click();
}
