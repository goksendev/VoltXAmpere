// ──────── DC SWEEP ────────
var dcSweepData = null;
function runDCSweep(srcType, start, stop, steps) {
  if (!S.parts.length) return;
  dcSweepData = { x: [], y: [], label: 'V(out)' };
  var src = S.parts.find(function(p){ return p.type === srcType; });
  if (!src) src = S.parts.find(function(p){ return p.type === 'vdc'; });
  if (!src) return;
  var origVal = src.val;
  start = start || 0; stop = stop || 10; steps = steps || 50;
  var step = (stop - start) / steps;
  for (var v = start; v <= stop + step/2; v += step) {
    src.val = v;
    buildCircuitFromCanvas();
    try { solveStep(SIM_DT); } catch(e) {}
    var meas = 0;
    if (S._nodeVoltages && S._nodeVoltages.length > 1) {
      var maxN = 0, maxV = 0;
      for (var ni = 1; ni < S._nodeVoltages.length; ni++) {
        if (Math.abs(S._nodeVoltages[ni]) > maxV) { maxV = Math.abs(S._nodeVoltages[ni]); maxN = ni; }
      }
      meas = S._nodeVoltages.length > 2 ? S._nodeVoltages[2] || 0 : S._nodeVoltages[1] || 0;
    }
    dcSweepData.x.push(v);
    dcSweepData.y.push(meas);
  }
  src.val = origVal;
  buildCircuitFromCanvas();
  var ov=document.getElementById('ov-dcsweep');if(ov)ov.style.display='none';
  switchTab('dcsweep');
}

function drawDCSweep() {
  var cvs = document.getElementById('DCSW');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);
  if (!dcSweepData || !dcSweepData.x.length) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('DC Sweep yapılmadı. Bir preset yükleyin ve simülasyonu çalıştırın.', w/2, h/2);
    return;
  }
  var d = dcSweepData, mx = 50, my = 30, pw = w-mx-20, ph = h-my-30;
  var xMin = Math.min.apply(null,d.x), xMax = Math.max.apply(null,d.x);
  var yMin = Math.min.apply(null,d.y), yMax = Math.max.apply(null,d.y);
  if (yMax === yMin) { yMax += 1; yMin -= 1; }
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
  for (var i = 0; i <= 5; i++) { var y = my + ph*i/5; c.beginPath(); c.moveTo(mx, y); c.lineTo(mx+pw, y); c.stroke(); }
  for (var i = 0; i <= 5; i++) { var x = mx + pw*i/5; c.beginPath(); c.moveTo(x, my); c.lineTo(x, my+ph); c.stroke(); }
  c.fillStyle = '#5a6a7a'; c.font = '10px "JetBrains Mono"'; c.textAlign = 'center';
  for (var i = 0; i <= 5; i++) { c.fillText(fmtVal(xMin+(xMax-xMin)*i/5,''), mx+pw*i/5, h-5); }
  c.textAlign = 'right';
  for (var i = 0; i <= 5; i++) { c.fillText(fmtVal(yMax-(yMax-yMin)*i/5,'V'), mx-4, my+ph*i/5+4); }
  c.strokeStyle = '#00e09e'; c.lineWidth = 2; c.shadowColor = '#00e09e'; c.shadowBlur = 6;
  c.beginPath();
  for (var i = 0; i < d.x.length; i++) {
    var x = mx + (d.x[i]-xMin)/(xMax-xMin)*pw;
    var y = my + (1-(d.y[i]-yMin)/(yMax-yMin))*ph;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke(); c.shadowBlur = 0;
  c.fillStyle = '#00e09e'; c.font = '600 12px Outfit'; c.textAlign = 'left';
  c.fillText('DC Sweep — ' + d.label, mx + 10, my + 16);
}
