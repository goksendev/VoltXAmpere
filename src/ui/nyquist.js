// ──────── NYQUIST PLOT ────────
// Sprint 78: complex-plane view of the same AC sweep Bode uses.
// Shares VXA.ACAnalysis backend, adds the (−1, 0) stability reference
// and unit circle so closed-loop stability can be read at a glance.
var nyquistData = null;

function runNyquist(fStart, fStop, ppd) {
  if (!S.parts.length) return;
  fStart = fStart || 10; fStop = fStop || 100000; ppd = ppd || 20;
  buildCircuitFromCanvas();
  if (!SIM || SIM.N <= 1) return;
  if (!VXA.ACAnalysis || typeof VXA.ACAnalysis.run !== 'function') {
    console.error('[Nyquist] VXA.ACAnalysis not loaded');
    return;
  }
  var acSrc = SIM.comps.find(function(c){ return c.type === 'V' && c.isAC; });
  if (!acSrc) { nyquistData = null; switchTab('nyquist'); return; }

  var outNode = SIM.N > 2 ? 2 : 1;

  var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  var results = VXA.ACAnalysis.run(fStart, fStop, ppd, outNode);
  var t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

  // Convert (magnitude dB, phase deg) → (Re, Im).
  nyquistData = { re: [], im: [], f: [] };
  for (var i = 0; i < results.length; i++) {
    var mag = Math.pow(10, results[i].gain_dB / 20);
    var phaseRad = results[i].phase * Math.PI / 180;
    nyquistData.re.push(mag * Math.cos(phaseRad));
    nyquistData.im.push(mag * Math.sin(phaseRad));
    nyquistData.f.push(results[i].freq);
  }
  nyquistData._elapsedMs = t1 - t0;

  var ov = document.getElementById('ov-nyquist'); if (ov) ov.style.display = 'none';
  switchTab('nyquist');
}

function drawNyquist() {
  var cvs = document.getElementById('NYQUIST');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);

  if (!nyquistData || !nyquistData.re.length) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('Nyquist plot yapılmadı. AC devre kurun ve sweep çalıştırın.', w/2, h/2);
    return;
  }

  var d = nyquistData;
  var minRe = Math.min.apply(null, d.re), maxRe = Math.max.apply(null, d.re);
  var minIm = Math.min.apply(null, d.im), maxIm = Math.max.apply(null, d.im);
  // Ensure the (−1, 0) stability point is always on screen.
  minRe = Math.min(minRe, -1.5); maxRe = Math.max(maxRe, 0.5);
  // Square the viewport so angles read truly (complex plane needs equal aspect).
  var maxRange = Math.max(maxRe - minRe, maxIm - minIm) * 1.1;
  var midRe = (maxRe + minRe) / 2, midIm = (maxIm + minIm) / 2;
  minRe = midRe - maxRange/2; maxRe = midRe + maxRange/2;
  minIm = midIm - maxRange/2; maxIm = midIm + maxRange/2;

  var padding = 40;
  var plotW = w - 2*padding, plotH = h - 2*padding;
  function rx(re) { return padding + (re - minRe) / (maxRe - minRe) * plotW; }
  function ry(im) { return padding + (1 - (im - minIm) / (maxIm - minIm)) * plotH; }

  var x0 = rx(0), y0 = ry(0);

  // Axes (Re=0, Im=0)
  c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(padding, y0); c.lineTo(w - padding, y0); c.stroke();
  c.beginPath(); c.moveTo(x0, padding); c.lineTo(x0, h - padding); c.stroke();

  // Unit circle (|H|=1) — stability reference
  var scale = plotW / (maxRe - minRe);
  c.strokeStyle = 'rgba(245,158,11,0.3)'; c.setLineDash([3,3]); c.lineWidth = 1;
  c.beginPath(); c.arc(x0, y0, scale, 0, 2*Math.PI); c.stroke();
  c.setLineDash([]);

  // Nyquist trajectory
  c.strokeStyle = '#00e09e'; c.lineWidth = 2;
  c.shadowColor = '#00e09e'; c.shadowBlur = 4;
  c.beginPath();
  for (var i = 0; i < d.re.length; i++) {
    var x = rx(d.re[i]), y = ry(d.im[i]);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  c.shadowBlur = 0;

  // Mirror image (ω → −ω) — traditional Nyquist needs both halves to
  // enclose the (−1, 0) point for the encirclement criterion.
  c.strokeStyle = 'rgba(0,224,158,0.35)'; c.lineWidth = 1.5; c.setLineDash([2,3]);
  c.beginPath();
  for (var i = 0; i < d.re.length; i++) {
    var x = rx(d.re[i]), y = ry(-d.im[i]);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke(); c.setLineDash([]);

  // Start (low freq) and end (high freq) markers
  if (d.re.length > 1) {
    var xs = rx(d.re[0]), ys = ry(d.im[0]);
    c.fillStyle = '#00e09e'; c.beginPath(); c.arc(xs, ys, 4, 0, 2*Math.PI); c.fill();
    c.fillStyle = '#5a6a7a'; c.font = '9px "JetBrains Mono"'; c.textAlign = 'left';
    c.fillText(fmtVal(d.f[0], 'Hz') + ' (ω→0)', xs + 6, ys - 6);

    var last = d.re.length - 1;
    var xe = rx(d.re[last]), ye = ry(d.im[last]);
    c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(xe, ye, 4, 0, 2*Math.PI); c.fill();
    c.fillStyle = '#5a6a7a';
    c.fillText(fmtVal(d.f[last], 'Hz') + ' (ω→∞)', xe + 6, ye - 6);
  }

  // Stability point (−1, 0) — drawn last so it's always on top
  var stabX = rx(-1);
  c.fillStyle = '#ff3333';
  c.beginPath(); c.arc(stabX, y0, 5, 0, 2*Math.PI); c.fill();
  c.strokeStyle = '#ff3333'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(stabX, y0, 8, 0, 2*Math.PI); c.stroke();
  c.font = '10px "JetBrains Mono"'; c.fillStyle = '#ff3333'; c.textAlign = 'center';
  c.fillText('(−1, 0)', stabX, y0 + 20);

  // Axis labels
  c.fillStyle = '#888'; c.font = '10px "JetBrains Mono"';
  c.textAlign = 'right'; c.fillText('Re', w - padding + 2, y0 + 12);
  c.textAlign = 'left'; c.save(); c.translate(x0 - 12, padding); c.rotate(-Math.PI/2);
  c.fillText('Im', 0, 0); c.restore();

  // Header
  c.fillStyle = '#00e09e'; c.font = 'bold 11px Outfit'; c.textAlign = 'left';
  c.fillText('Nyquist Plot', padding, 15);
  c.fillStyle = '#5a6a7a'; c.font = '9px Outfit';
  c.fillText('Kararlılık: (−1, 0) noktası eğrinin dışında mı?', padding, 28);

  // Footer — backend + timing
  if (d._elapsedMs !== undefined) {
    c.fillStyle = 'rgba(0,224,158,0.55)'; c.font = '8px "JetBrains Mono"'; c.textAlign = 'right';
    c.fillText('AC-MNA · ' + d._elapsedMs.toFixed(1) + ' ms · ' + d.f.length + ' pts', w - 6, h - 6);
  }
}
