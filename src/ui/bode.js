// ──────── BODE PLOT ────────
// Sprint 78: backend migrated from transient sweep to VXA.ACAnalysis
// (complex MNA, one linear solve per frequency). Typical speedup on a
// 60-point decade sweep: 10–50× versus the old 40-steps-per-period
// transient-and-sample loop. Draw code unchanged.
var bodeData = null;
function runBode(fStart, fStop, ppd) {
  if (!S.parts.length) return;
  fStart = fStart || 10; fStop = fStop || 100000; ppd = ppd || 20;
  buildCircuitFromCanvas();
  if (!SIM || SIM.N <= 1) return;
  if (!VXA.ACAnalysis || typeof VXA.ACAnalysis.run !== 'function') {
    console.error('[Bode] VXA.ACAnalysis not loaded');
    return;
  }
  // Need at least one AC voltage source; otherwise there is nothing to sweep.
  var acSrc = SIM.comps.find(function(c){ return c.type === 'V' && c.isAC; });
  if (!acSrc) { bodeData = null; switchTab('bode'); return; }

  // Output node selection: convention used by the prior transient code —
  // node 2 if the circuit has >2 non-ground nodes, otherwise node 1.
  var outNode = SIM.N > 2 ? 2 : 1;

  var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  var results = VXA.ACAnalysis.run(fStart, fStop, ppd, outNode);
  var t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

  bodeData = { f: [], mag: [], phase: [] };
  for (var i = 0; i < results.length; i++) {
    bodeData.f.push(results[i].freq);
    bodeData.mag.push(results[i].gain_dB);
    bodeData.phase.push(results[i].phase);
  }
  bodeData._elapsedMs = t1 - t0;
  bodeData._method = 'ac-mna';

  var ov = document.getElementById('ov-bode'); if (ov) ov.style.display = 'none';
  switchTab('bode');
}

function drawBode() {
  var cvs = document.getElementById('BODE');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);
  if (!bodeData || !bodeData.f.length) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('Bode Plot yapılmadı. AC devre kurun ve simülasyonu çalıştırın.', w/2, h/2);
    return;
  }
  var d = bodeData, mx = 55, my = 20, pw = w-mx-20, ph = (h-my-30)/2;
  var magMin = Math.min.apply(null,d.mag)-5, magMax = Math.max.apply(null,d.mag)+5;
  if (magMax - magMin < 10) { magMax += 5; magMin -= 5; }
  c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
  for (var i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(mx, my+ph*i/4); c.lineTo(mx+pw, my+ph*i/4); c.stroke(); }
  c.strokeStyle = '#00e09e'; c.lineWidth = 1.5; c.shadowColor = '#00e09e'; c.shadowBlur = 4;
  c.beginPath();
  for (var i = 0; i < d.f.length; i++) {
    var x = mx + Math.log10(d.f[i]/d.f[0]) / Math.log10(d.f[d.f.length-1]/d.f[0]) * pw;
    var y = my + (1-(d.mag[i]-magMin)/(magMax-magMin))*ph;
    if (i===0) c.moveTo(x,y); else c.lineTo(x,y);
  }
  c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#5a6a7a'; c.font = '9px "JetBrains Mono"'; c.textAlign = 'right';
  for (var i = 0; i <= 4; i++) {
    var val = magMax - (magMax-magMin)*i/4;
    c.fillText(val.toFixed(0)+' dB', mx-4, my+ph*i/4+3);
  }
  c.fillStyle = '#00e09e'; c.font = '600 10px Outfit'; c.textAlign = 'left';
  c.fillText('Kazanç (dB)', mx+4, my+12);
  var py = my + ph + 15;
  var phMin = Math.min.apply(null,d.phase)-10, phMax = Math.max.apply(null,d.phase)+10;
  c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
  for (var i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(mx, py+ph*i/4); c.lineTo(mx+pw, py+ph*i/4); c.stroke(); }
  c.strokeStyle = '#f59e0b'; c.lineWidth = 1.5; c.shadowColor = '#f59e0b'; c.shadowBlur = 4;
  c.beginPath();
  for (var i = 0; i < d.f.length; i++) {
    var x = mx + Math.log10(d.f[i]/d.f[0]) / Math.log10(d.f[d.f.length-1]/d.f[0]) * pw;
    var y = py + (1-(d.phase[i]-phMin)/(phMax-phMin))*ph;
    if (i===0) c.moveTo(x,y); else c.lineTo(x,y);
  }
  c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#5a6a7a'; c.font = '9px "JetBrains Mono"'; c.textAlign = 'right';
  for (var i = 0; i <= 4; i++) {
    var val = phMax - (phMax-phMin)*i/4;
    c.fillText(val.toFixed(0)+'\u00b0', mx-4, py+ph*i/4+3);
  }
  c.fillStyle = '#f59e0b'; c.font = '600 10px Outfit'; c.textAlign = 'left';
  c.fillText('Faz (\u00b0)', mx+4, py+12);
  c.fillStyle = '#5a6a7a'; c.font = '9px "JetBrains Mono"'; c.textAlign = 'center';
  var fMin = d.f[0], fMax = d.f[d.f.length-1];
  var logRange = Math.log10(fMax/fMin);
  for (var i = 0; i <= 4; i++) {
    var f = fMin * Math.pow(10, logRange*i/4);
    var x2 = mx + pw*i/4;
    c.fillText(fmtVal(f,'Hz'), x2, py+ph+14);
  }

  // ═══ Sprint 22: -3dB, Phase Margin, Gain Margin Markers ═══
  var dcGain = d.mag[0];
  var f3dBVal = null, fUnityVal = null, pmVal = null, gmVal = null;

  // Find -3dB frequency
  for (var i = 1; i < d.f.length; i++) {
    if (d.mag[i] <= dcGain - 3 && d.mag[i - 1] > dcGain - 3) {
      var ratio = (dcGain - 3 - d.mag[i - 1]) / (d.mag[i] - d.mag[i - 1]);
      f3dBVal = d.f[i - 1] * Math.pow(d.f[i] / d.f[i - 1], ratio);
      break;
    }
  }
  // Find unity gain frequency (0dB crossing)
  for (var i = 1; i < d.f.length; i++) {
    if (d.mag[i] <= 0 && d.mag[i - 1] > 0) {
      var ratio2 = (0 - d.mag[i - 1]) / (d.mag[i] - d.mag[i - 1]);
      fUnityVal = d.f[i - 1] * Math.pow(d.f[i] / d.f[i - 1], ratio2);
      // Phase at unity gain → phase margin
      var phAtUnity = d.phase[i - 1] + ratio2 * (d.phase[i] - d.phase[i - 1]);
      pmVal = 180 + phAtUnity;
      break;
    }
  }
  // Find gain margin (gain at -180° crossing)
  for (var i = 1; i < d.f.length; i++) {
    if (d.phase[i] <= -180 && d.phase[i - 1] > -180) {
      var ratio3 = (-180 - d.phase[i - 1]) / (d.phase[i] - d.phase[i - 1]);
      var magAt180 = d.mag[i - 1] + ratio3 * (d.mag[i] - d.mag[i - 1]);
      gmVal = -magAt180;
      break;
    }
  }

  // Draw -3dB marker
  if (f3dBVal) {
    var f3x = mx + Math.log10(f3dBVal / fMin) / logRange * pw;
    var dbLine = dcGain - 3;
    var f3y = my + (1 - (dbLine - magMin) / (magMax - magMin)) * ph;
    c.setLineDash([4, 3]); c.strokeStyle = 'rgba(0,224,158,0.5)'; c.lineWidth = 1;
    // Horizontal -3dB line
    c.beginPath(); c.moveTo(mx, f3y); c.lineTo(mx + pw, f3y); c.stroke();
    // Vertical f3dB line
    c.beginPath(); c.moveTo(f3x, my); c.lineTo(f3x, my + ph); c.stroke();
    c.setLineDash([]);
    // Dot at intersection
    c.fillStyle = '#00e09e';
    c.beginPath(); c.arc(f3x, f3y, 4, 0, Math.PI * 2); c.fill();
    // Label
    c.font = '9px "JetBrains Mono"'; c.textAlign = 'left'; c.fillStyle = '#00e09e';
    c.fillText('f\u2083dB=' + fmtVal(f3dBVal, 'Hz'), f3x + 6, f3y - 6);
  }

  // Draw phase margin
  if (pmVal !== null && fUnityVal) {
    var fux = mx + Math.log10(fUnityVal / fMin) / logRange * pw;
    // Vertical line in phase plot
    c.setLineDash([3, 2]); c.lineWidth = 1;
    c.strokeStyle = pmVal > 45 ? '#22cc44' : (pmVal > 30 ? '#ddaa00' : '#ff4444');
    c.beginPath(); c.moveTo(fux, py); c.lineTo(fux, py + ph); c.stroke();
    c.setLineDash([]);
    // Phase margin annotation
    var phMinus180y = py + (1 - (-180 - phMin) / (phMax - phMin)) * ph;
    var phActualY = py + (1 - ((pmVal - 180) - phMin) / (phMax - phMin)) * ph;
    // Arrow from -180 to actual phase
    c.strokeStyle = pmVal > 45 ? '#22cc44' : (pmVal > 30 ? '#ddaa00' : '#ff4444');
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(fux, phMinus180y); c.lineTo(fux, phActualY); c.stroke();
    // Arrowhead
    c.beginPath(); c.moveTo(fux, phActualY); c.lineTo(fux - 3, phActualY + 6); c.lineTo(fux + 3, phActualY + 6); c.fill();
    // Label
    c.font = 'bold 9px "JetBrains Mono"'; c.textAlign = 'left';
    c.fillText('PM=' + pmVal.toFixed(1) + '\u00B0', fux + 6, (phMinus180y + phActualY) / 2);
  }

  // Draw gain margin
  if (gmVal !== null) {
    // Find -180° frequency position
    for (var i = 1; i < d.f.length; i++) {
      if (d.phase[i] <= -180 && d.phase[i - 1] > -180) {
        var r4 = (-180 - d.phase[i - 1]) / (d.phase[i] - d.phase[i - 1]);
        var fGM = d.f[i - 1] * Math.pow(d.f[i] / d.f[i - 1], r4);
        var fgx = mx + Math.log10(fGM / fMin) / logRange * pw;
        var zeroDbY = my + (1 - (0 - magMin) / (magMax - magMin)) * ph;
        var magGMy = my + (1 - (-gmVal - magMin) / (magMax - magMin)) * ph;
        c.setLineDash([3, 2]); c.strokeStyle = 'rgba(255,100,100,0.5)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(fgx, my); c.lineTo(fgx, my + ph); c.stroke();
        c.setLineDash([]);
        // Arrow from actual to 0dB
        c.strokeStyle = '#ff6644'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(fgx, magGMy); c.lineTo(fgx, zeroDbY); c.stroke();
        c.fillStyle = '#ff6644'; c.font = 'bold 9px "JetBrains Mono"'; c.textAlign = 'left';
        c.fillText('GM=' + gmVal.toFixed(1) + 'dB', fgx + 6, (zeroDbY + magGMy) / 2);
        break;
      }
    }
  }

  // Draw unity gain frequency marker
  if (fUnityVal) {
    var fux2 = mx + Math.log10(fUnityVal / fMin) / logRange * pw;
    c.fillStyle = '#888'; c.font = '8px "JetBrains Mono"'; c.textAlign = 'center';
    c.fillText('f\u1D64=' + fmtVal(fUnityVal, 'Hz'), fux2, my + ph + 12);
  }

  // Sprint 78: tiny footer note — AC-MNA backend + timing.
  if (d._elapsedMs !== undefined) {
    c.fillStyle = 'rgba(0,224,158,0.55)'; c.font = '8px "JetBrains Mono"'; c.textAlign = 'right';
    c.fillText('AC-MNA · ' + d._elapsedMs.toFixed(1) + ' ms · ' + d.f.length + ' pts', w - 6, h - 6);
  }
}
