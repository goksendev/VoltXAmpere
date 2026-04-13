// ──────── BODE PLOT ────────
var bodeData = null;
function runBode(fStart, fStop, ppd) {
  if (!S.parts.length) return;
  fStart = fStart || 10; fStop = fStop || 100000; ppd = ppd || 20;
  buildCircuitFromCanvas();
  if (!SIM || SIM.N <= 1) return;
  bodeData = { f: [], mag: [], phase: [] };
  var decades = Math.log10(fStop/fStart);
  var total = Math.ceil(decades * ppd);
  var acSrc = SIM.comps.find(function(c){ return c.type === 'V' && c.isAC; });
  if (!acSrc) { bodeData = null; switchTab('bode'); return; }
  var origFreq = acSrc.freq;
  for (var i = 0; i <= total; i++) {
    var f = fStart * Math.pow(10, i/ppd);
    acSrc.freq = f;
    S.sim.t = 0;
    S._nodeVoltages = null;
    var periods = 5, dt = 1/(f*40);
    var stepsPerPeriod = 40, totalSteps = periods * stepsPerPeriod;
    var maxOut = 0, minOut = 1e30;
    for (var s = 0; s < totalSteps; s++) {
      S.sim.t += dt;
      try { solveStep(dt); } catch(e) { break; }
      if (s >= (periods-2)*stepsPerPeriod && S._nodeVoltages) {
        var vOut = S._nodeVoltages.length > 2 ? Math.abs(S._nodeVoltages[2]||0) : Math.abs(S._nodeVoltages[1]||0);
        if (vOut > maxOut) maxOut = vOut;
        if (vOut < minOut) minOut = vOut;
      }
    }
    var vpp = maxOut - minOut;
    var gain = (acSrc.val > 0) ? (vpp / 2) / acSrc.val : 0;
    var magDB = gain > 1e-10 ? 20 * Math.log10(gain) : -100;
    // Real phase measurement: compare input and output zero-crossings
    var inZero = -1, outZero = -1, phaseDeg = 0;
    S.sim.t = 0; S._nodeVoltages = null;
    for (var s2 = 0; s2 < totalSteps; s2++) {
      S.sim.t += dt;
      try { solveStep(dt); } catch(e) { break; }
      if (s2 >= (periods-2)*stepsPerPeriod && S._nodeVoltages) {
        var vIn = acSrc.val * Math.sin(2*Math.PI*f*S.sim.t);
        var vOut2 = S._nodeVoltages.length > 2 ? (S._nodeVoltages[2]||0) : (S._nodeVoltages[1]||0);
        var prevIn = acSrc.val * Math.sin(2*Math.PI*f*(S.sim.t-dt));
        var prevOut = S._nodeVoltages.length > 2 ? (S._nodeVoltages[2]||0) : (S._nodeVoltages[1]||0);
        if (inZero < 0 && prevIn <= 0 && vIn > 0) inZero = S.sim.t;
        if (outZero < 0 && inZero > 0 && prevOut <= 0 && vOut2 > 0) outZero = S.sim.t;
        if (inZero > 0 && outZero > 0) break;
      }
    }
    if (inZero > 0 && outZero > 0) {
      var delay = outZero - inZero;
      phaseDeg = -delay * f * 360;
      while (phaseDeg < -180) phaseDeg += 360;
      while (phaseDeg > 180) phaseDeg -= 360;
    } else {
      phaseDeg = gain < 0.5 ? -90 : 0; // fallback estimate
    }
    bodeData.f.push(f);
    bodeData.mag.push(magDB);
    bodeData.phase.push(phaseDeg);
  }
  acSrc.freq = origFreq;
  S.sim.t = 0;
  S._nodeVoltages = null;
  var ov=document.getElementById('ov-bode');if(ov)ov.style.display='none';
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
    var x = mx + pw*i/4;
    c.fillText(fmtVal(f,'Hz'), x, py+ph+14);
  }
}
