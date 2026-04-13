// ──────── TEMPERATURE SWEEP ────────
var tempData = null;
function runTempSweep() {
  if (!S.parts.length) return;
  tempData = { temps: [], values: [] };
  var origVals = S.parts.map(function(p){ return p.val; });
  for (var T = -40; T <= 125; T += 5) {
    S.parts.forEach(function(p, i) {
      if (p.type === 'resistor') p.val = origVals[i] * (1 + 0.004 * (T - 25));
    });
    buildCircuitFromCanvas();
    S.sim.t = 0; S._nodeVoltages = null;
    try { for (var s = 0; s < 50; s++) { S.sim.t += SIM_DT; solveStep(SIM_DT); } } catch(e){}
    var meas = S._nodeVoltages && S._nodeVoltages.length > 1 ? Math.abs(S._nodeVoltages[1]) : 0;
    tempData.temps.push(T);
    tempData.values.push(meas);
  }
  S.parts.forEach(function(p, i) { p.val = origVals[i]; });
  buildCircuitFromCanvas();
  var ov=document.getElementById('ov-tempsweep');if(ov)ov.style.display='none';
  switchTab('tempsweep');
}
function drawTempSweep() {
  var cvs = document.getElementById('TSWEEP');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  cvs.width=r.width*DPR;cvs.height=r.height*DPR;
  cvs.style.width=r.width+'px';cvs.style.height=r.height+'px';
  var c=cvs.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var w=r.width,h=r.height;
  c.fillStyle='#080c14';c.fillRect(0,0,w,h);
  if (!tempData) { c.fillStyle='#5a6a7a';c.font='13px Outfit';c.textAlign='center';c.fillText('S\u0131cakl\u0131k taramas\u0131 yap\u0131lmad\u0131.',w/2,h/2);return; }
  var d=tempData,mx2=50,my=20,pw=w-mx2-20,ph=h-my-30;
  var yMin=Math.min.apply(null,d.values)*0.9,yMax=Math.max.apply(null,d.values)*1.1;
  if(yMax===yMin){yMax+=1;yMin-=1;}
  c.strokeStyle='rgba(255,255,255,0.06)';c.lineWidth=0.5;
  for(var i=0;i<=5;i++){var y=my+ph*i/5;c.beginPath();c.moveTo(mx2,y);c.lineTo(mx2+pw,y);c.stroke();}
  c.strokeStyle='#f59e0b';c.lineWidth=2;c.shadowColor='#f59e0b';c.shadowBlur=6;
  c.beginPath();
  for(var i=0;i<d.temps.length;i++){
    var x=mx2+(d.temps[i]+40)/165*pw;
    var y=my+(1-(d.values[i]-yMin)/(yMax-yMin))*ph;
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.stroke();c.shadowBlur=0;
  c.fillStyle='#5a6a7a';c.font='10px "JetBrains Mono"';c.textAlign='center';
  c.fillText('S\u0131cakl\u0131k (\u00B0C)',w/2,h-3);
  c.fillText('-40',mx2,h-3);c.fillText('125',mx2+pw,h-3);
}
