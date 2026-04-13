// ──────── SENSITIVITY ANALYSIS ────────
var sensData = null;
function runSensitivity() {
  if (!S.parts.length) return;
  sensData = { names: [], values: [] };
  var passives = S.parts.filter(function(p){ return p.type==='resistor'||p.type==='capacitor'||p.type==='inductor'; });
  if (!passives.length) return;
  buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
  try{for(var i=0;i<50;i++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
  var baseline = S._nodeVoltages && S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;
  passives.forEach(function(p) {
    var orig = p.val, delta = orig * 0.01;
    p.val = orig + delta;
    buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
    try{for(var i=0;i<50;i++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
    var perturbed = S._nodeVoltages && S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;
    var sens = Math.abs((perturbed - baseline) / delta);
    sensData.names.push(p.name || (p.type.charAt(0).toUpperCase() + p.id));
    sensData.values.push(sens);
    p.val = orig;
  });
  buildCircuitFromCanvas();
  var ov=document.getElementById('ov-sensitivity');if(ov)ov.style.display='none';
  switchTab('sensitivity');
}
function drawSensitivity() {
  var cvs2 = document.getElementById('SENSC');
  if (!cvs2) return;
  var r=cvs2.parentElement.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  cvs2.width=r.width*DPR;cvs2.height=r.height*DPR;
  cvs2.style.width=r.width+'px';cvs2.style.height=r.height+'px';
  var c=cvs2.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var w=r.width,h=r.height;
  c.fillStyle='#080c14';c.fillRect(0,0,w,h);
  if(!sensData||!sensData.names.length){c.fillStyle='#5a6a7a';c.font='13px Outfit';c.textAlign='center';c.fillText('Duyarl\u0131l\u0131k analizi yap\u0131lmad\u0131.',w/2,h/2);return;}
  var d=sensData,mx=80,my=20,pw=w-mx-20,ph=h-my-30;
  var maxV=Math.max.apply(null,d.values)||1;
  var barH=Math.min(20,ph/d.names.length-2);
  for(var i=0;i<d.names.length;i++){
    var y=my+i*(barH+4);
    var bw=(d.values[i]/maxV)*pw;
    c.fillStyle='rgba(0,224,158,0.6)';c.fillRect(mx,y,bw,barH);
    c.strokeStyle='#00e09e';c.lineWidth=1;c.strokeRect(mx,y,bw,barH);
    c.fillStyle='#8899aa';c.font='10px "JetBrains Mono"';c.textAlign='right';c.textBaseline='middle';
    c.fillText(d.names[i],mx-6,y+barH/2);
    c.textAlign='left';c.fillText(d.values[i].toExponential(2),mx+bw+6,y+barH/2);
  }
  c.fillStyle='#5a6a7a';c.font='10px Outfit';c.textAlign='center';c.fillText('\u2202Vout / \u2202param',w/2,h-3);
}
