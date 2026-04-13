// ──────── MONTE CARLO ────────
var mcData = null;
function runMonteCarlo(tolerance, runs) {
  tolerance = tolerance || 10; runs = runs || 200;
  if (!S.parts.length) return;
  mcData = { values: [], tol: tolerance, runs: runs };
  var origVals = S.parts.map(function(p){ return p.val; });
  for (var r = 0; r < runs; r++) {
    S.parts.forEach(function(p, i) {
      if (p.type === 'resistor' || p.type === 'capacitor' || p.type === 'inductor') {
        var gaussRand = Math.sqrt(-2*Math.log(Math.random())) * Math.cos(2*Math.PI*Math.random());
        p.val = origVals[i] * (1 + gaussRand * tolerance / 300);
      }
    });
    buildCircuitFromCanvas();
    S.sim.t = 0; S._nodeVoltages = null;
    try { for (var s = 0; s < 50; s++) { S.sim.t += SIM_DT; solveStep(SIM_DT); } } catch(e){}
    var meas = S._nodeVoltages && S._nodeVoltages.length > 1 ? Math.abs(S._nodeVoltages[1]) : 0;
    mcData.values.push(meas);
  }
  S.parts.forEach(function(p, i) { p.val = origVals[i]; });
  buildCircuitFromCanvas();
  var vals = mcData.values.slice().sort(function(a,b){return a-b;});
  mcData.mean = vals.reduce(function(a,b){return a+b;},0) / vals.length;
  mcData.stdDev = Math.sqrt(vals.reduce(function(a,b){return a+(b-mcData.mean)*(b-mcData.mean);},0)/vals.length);
  mcData.min = vals[0]; mcData.max = vals[vals.length-1];
  var ov=document.getElementById('ov-montecarlo');if(ov)ov.style.display='none';
  switchTab('montecarlo');
}
function drawMonteCarlo() {
  var cvs = document.getElementById('MCC');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width<10||r.height<10) return;
  cvs.width=r.width*DPR;cvs.height=r.height*DPR;
  cvs.style.width=r.width+'px';cvs.style.height=r.height+'px';
  var c=cvs.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var w=r.width,h=r.height;
  c.fillStyle='#080c14';c.fillRect(0,0,w,h);
  if (!mcData) { c.fillStyle='#5a6a7a';c.font='13px Outfit';c.textAlign='center';c.fillText('Monte Carlo yap\u0131lmad\u0131.',w/2,h/2);return; }
  var bins=30, vals=mcData.values, mn=mcData.min, mx=mcData.max;
  if (mx===mn){mx+=1;mn-=1;}
  var binW=(mx-mn)/bins, hist=new Array(bins).fill(0);
  vals.forEach(function(v){var b=Math.min(bins-1,Math.floor((v-mn)/binW));hist[b]++;});
  var maxH=Math.max.apply(null,hist);
  var mx2=50,my=30,pw=w-mx2-40,ph=h-my-40;
  var bw=pw/bins;
  for(var i=0;i<bins;i++){
    var bh=(hist[i]/maxH)*ph;
    var x=mx2+i*bw;
    c.fillStyle='rgba(0,224,158,0.6)';c.fillRect(x,my+ph-bh,bw-1,bh);
    c.strokeStyle='#00e09e';c.lineWidth=1;c.strokeRect(x,my+ph-bh,bw-1,bh);
  }
  c.fillStyle='#e0e7f0';c.font='600 11px "JetBrains Mono"';c.textAlign='left';
  c.fillText('Ortalama: '+fmtVal(mcData.mean,'V')+' | StdDev: '+fmtVal(mcData.stdDev,'V'),mx2,h-8);
  c.fillText('Min: '+fmtVal(mcData.min,'V')+' | Max: '+fmtVal(mcData.max,'V')+' | N='+mcData.runs,mx2+pw/2,h-8);
  c.fillStyle='#5a6a7a';c.font='10px "JetBrains Mono"';c.textAlign='center';
  c.fillText('Tolerans: \u00B1'+mcData.tol+'%',w/2,my-8);
}
