// ──────── MONTE CARLO (Sprint 22 Enhanced) ────────
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
  var mx2=50,my=30,pw=w-mx2-40,ph=h-my-50;
  var bw=pw/bins;

  // Grid lines
  c.strokeStyle='rgba(255,255,255,0.05)';c.lineWidth=0.5;
  for(var gi=0;gi<=4;gi++){var gy=my+ph*gi/4;c.beginPath();c.moveTo(mx2,gy);c.lineTo(mx2+pw,gy);c.stroke();}

  // Histogram bars with border
  for(var i=0;i<bins;i++){
    var bh=(hist[i]/maxH)*ph;
    var x=mx2+i*bw;
    c.fillStyle='rgba(0,224,158,0.5)';c.fillRect(x,my+ph-bh,bw-1,bh);
    c.strokeStyle='rgba(0,224,158,0.8)';c.lineWidth=1;c.strokeRect(x,my+ph-bh,bw-1,bh);
  }

  // ═══ Sprint 22: Normal distribution curve overlay ═══
  var mu = mcData.mean, sigma = mcData.stdDev;
  if (sigma > 0) {
    // Scale: normal PDF peak = 1/(sigma*sqrt(2pi)), scale to match histogram
    var pdfPeak = 1 / (sigma * Math.sqrt(2 * Math.PI));
    var pdfScale = (maxH * binW) / pdfPeak; // Scale to match histogram area
    c.strokeStyle = '#ff6644'; c.lineWidth = 2; c.setLineDash([]);
    c.beginPath();
    for (var xi = 0; xi <= pw; xi += 2) {
      var xVal = mn + (mx - mn) * xi / pw;
      var pdf = Math.exp(-0.5 * Math.pow((xVal - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI));
      var yPx = my + ph - (pdf * pdfScale / maxH) * ph;
      if (xi === 0) c.moveTo(mx2 + xi, yPx); else c.lineTo(mx2 + xi, yPx);
    }
    c.stroke();

    // ═══ µ ± σ lines ═══
    var sigmaLines = [
      { n: 1, color: '#22cc44', label: '\u00B11\u03C3' },
      { n: 2, color: '#ddaa00', label: '\u00B12\u03C3' },
      { n: 3, color: '#ff4444', label: '\u00B13\u03C3' }
    ];
    for (var si = 0; si < sigmaLines.length; si++) {
      var sl = sigmaLines[si];
      var xLow = mx2 + ((mu - sl.n * sigma) - mn) / (mx - mn) * pw;
      var xHigh = mx2 + ((mu + sl.n * sigma) - mn) / (mx - mn) * pw;
      c.setLineDash([3, 3]); c.strokeStyle = sl.color; c.lineWidth = 1;
      if (xLow >= mx2 && xLow <= mx2 + pw) { c.beginPath(); c.moveTo(xLow, my); c.lineTo(xLow, my + ph); c.stroke(); }
      if (xHigh >= mx2 && xHigh <= mx2 + pw) { c.beginPath(); c.moveTo(xHigh, my); c.lineTo(xHigh, my + ph); c.stroke(); }
      c.setLineDash([]);
    }
    // µ line (white solid)
    var muX = mx2 + (mu - mn) / (mx - mn) * pw;
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(muX, my); c.lineTo(muX, my + ph); c.stroke();
  }

  // ═══ Statistics box ═══
  var bx = mx2 + pw - 140, by = my + 6;
  c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(bx, by, 136, 62);
  c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 0.5; c.strokeRect(bx, by, 136, 62);
  c.font = '9px "JetBrains Mono"'; c.textAlign = 'left';
  c.fillStyle = '#ffffff'; c.fillText('\u03BC = ' + fmtVal(mu, 'V'), bx + 6, by + 13);
  c.fillStyle = '#aaa'; c.fillText('\u03C3 = ' + fmtVal(sigma, 'V'), bx + 6, by + 26);
  c.fillText('3\u03C3 = [' + fmtVal(mu - 3 * sigma, 'V') + ', ' + fmtVal(mu + 3 * sigma, 'V') + ']', bx + 6, by + 39);
  // Yield within ±5%
  if (mu > 0) {
    var withinBand = vals.filter(function(v) { return Math.abs(v - mu) / mu < 0.05; }).length;
    var yield5 = (withinBand / vals.length * 100).toFixed(1);
    c.fillStyle = parseFloat(yield5) > 95 ? '#22cc44' : '#ddaa00';
    c.fillText('Yield(\u00B15%): ' + yield5 + '%', bx + 6, by + 52);
  }

  // X axis labels
  c.fillStyle = '#5a6a7a'; c.font = '9px "JetBrains Mono"'; c.textAlign = 'center';
  for (var li = 0; li <= 4; li++) {
    var lv = mn + (mx - mn) * li / 4;
    c.fillText(fmtVal(lv, 'V'), mx2 + pw * li / 4, my + ph + 14);
  }

  // Legend
  c.font = '9px monospace';
  c.fillStyle = '#ff6644'; c.fillText('\u2500\u2500 Normal', mx2 + 4, my + 12);
  c.fillStyle = '#22cc44'; c.fillText('| 1\u03C3', mx2 + 70, my + 12);
  c.fillStyle = '#ddaa00'; c.fillText('| 2\u03C3', mx2 + 96, my + 12);
  c.fillStyle = '#ff4444'; c.fillText('| 3\u03C3', mx2 + 122, my + 12);

  // Title
  c.fillStyle = '#e0e7f0'; c.font = '600 11px Outfit'; c.textAlign = 'center';
  c.fillText('Monte Carlo (\u00B1' + mcData.tol + '%, N=' + mcData.runs + ')', w / 2, my - 10);
}
