// ──────── PARAMETER SWEEP ────────
var paramSweepData = null;
function runParamSweep(partId, propName, start, stop, steps) {
  var part = S.parts.find(function(p){ return p.id === partId; });
  if (!part) return;
  paramSweepData = { x: [], traces: [], label: propName };
  var origVal = part.val;
  var step = (stop - start) / (steps || 10);
  for (var v = start; v <= stop + step/2; v += step) {
    part.val = v;
    buildCircuitFromCanvas();
    S.sim.t = 0; S._nodeVoltages = null;
    try { for (var i = 0; i < 100; i++) { S.sim.t += SIM_DT; solveStep(SIM_DT); } } catch(e){}
    var meas = S._nodeVoltages && S._nodeVoltages.length > 1 ? S._nodeVoltages[1] : 0;
    paramSweepData.x.push(v);
    paramSweepData.traces.push(meas);
  }
  part.val = origVal;
  buildCircuitFromCanvas();
  var ov=document.getElementById('ov-paramsweep');if(ov)ov.style.display='none';
  switchTab('paramsweep');
}

function drawParamSweep() {
  var cvs = document.getElementById('PSWEEP');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);
  if (!paramSweepData || !paramSweepData.x.length) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('Parameter Sweep yapılmadı.', w/2, h/2); return;
  }
  var d = paramSweepData, mx=50,my=20,pw=w-mx-20,ph=h-my-30;
  var xMin=Math.min.apply(null,d.x), xMax=Math.max.apply(null,d.x);
  var yMin=Math.min.apply(null,d.traces), yMax=Math.max.apply(null,d.traces);
  if (yMax===yMin){yMax+=1;yMin-=1;}
  c.strokeStyle='#00e09e';c.lineWidth=2;c.shadowColor='#00e09e';c.shadowBlur=6;
  c.beginPath();
  for(var i=0;i<d.x.length;i++){var x=mx+(d.x[i]-xMin)/(xMax-xMin)*pw;var y=my+(1-(d.traces[i]-yMin)/(yMax-yMin))*ph;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}
  c.stroke();c.shadowBlur=0;
}
