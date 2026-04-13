// ──────── WORST CASE ANALYSIS ────────
var wcData = null;
var wcMethod = 'evp'; // 'evp' (Extreme Value) or 'rss' (Root Sum of Squares)

function runWorstCase(method) {
  if (method) wcMethod = method;
  if (!S.parts.length) return;
  var tolerance = 0.1;
  var passives = S.parts.filter(function(p){ return p.type==='resistor'||p.type==='capacitor'||p.type==='inductor'; });
  var origVals = passives.map(function(p){ return p.val; });

  // Nominal simulation
  buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
  try{for(var i=0;i<50;i++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
  var nominal = S._nodeVoltages&&S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;

  if (wcMethod === 'rss') {
    // RSS method — vary each component individually and combine deviations
    var sumSq = 0;
    for (var ci = 0; ci < passives.length; ci++) {
      // Vary component ci to +tolerance
      passives[ci].val = origVals[ci] * (1 + tolerance);
      buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
      try{for(var j=0;j<50;j++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
      var vHigh = S._nodeVoltages&&S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;

      // Vary component ci to -tolerance
      passives[ci].val = origVals[ci] * (1 - tolerance);
      buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
      try{for(var j=0;j<50;j++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
      var vLow = S._nodeVoltages&&S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;

      // Restore
      passives[ci].val = origVals[ci];

      // Maximum deviation from nominal for this component
      var dHigh = Math.abs(vHigh - nominal);
      var dLow = Math.abs(vLow - nominal);
      var maxDev = Math.max(dHigh, dLow);
      sumSq += maxDev * maxDev;
    }
    var rssSpread = Math.sqrt(sumSq);
    wcData = { nominal: nominal, best: nominal + rssSpread, worst: nominal - rssSpread, method: 'rss' };
  } else {
    // EVP method — all components at extreme simultaneously
    passives.forEach(function(p){ p.val *= (1 - tolerance); });
    buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
    try{for(var i=0;i<50;i++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
    var allMin = S._nodeVoltages&&S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;
    passives.forEach(function(p,i){ p.val = origVals[i] * (1 + tolerance); });
    buildCircuitFromCanvas(); S.sim.t=0; S._nodeVoltages=null;
    try{for(var i=0;i<50;i++){S.sim.t+=SIM_DT;solveStep(SIM_DT);}}catch(e){}
    var allMax = S._nodeVoltages&&S._nodeVoltages.length>1 ? S._nodeVoltages[1] : 0;
    wcData = { nominal: nominal, best: Math.max(allMin, allMax), worst: Math.min(allMin, allMax), method: 'evp' };
  }

  passives.forEach(function(p,i){ p.val = origVals[i]; });
  buildCircuitFromCanvas();
  var ov=document.getElementById('ov-worstcase');if(ov)ov.style.display='none';
  switchTab('worstcase');
}
function drawWorstCase() {
  var cvs3 = document.getElementById('WCC');
  if (!cvs3) return;
  var r=cvs3.parentElement.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  cvs3.width=r.width*DPR;cvs3.height=r.height*DPR;
  cvs3.style.width=r.width+'px';cvs3.style.height=r.height+'px';
  var c=cvs3.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var w=r.width,h=r.height;
  c.fillStyle='#080c14';c.fillRect(0,0,w,h);
  if(!wcData){c.fillStyle='#5a6a7a';c.font='13px Outfit';c.textAlign='center';c.fillText('Worst-case analizi yap\u0131lmad\u0131.',w/2,h/2);return;}
  c.font='600 14px Outfit';c.textAlign='center';c.fillStyle='#e0e7f0';
  c.fillText('Worst-Case Analiz Sonu\u00e7lar\u0131',w/2,30);
  c.font='500 16px "JetBrains Mono"';
  var cy = h/2 - 30;
  c.fillStyle='#00e09e'; c.fillText('Nominal: '+fmtVal(wcData.nominal,'V'),w/2,cy);
  c.fillStyle='#22c55e'; c.fillText('Best Case: '+fmtVal(wcData.best,'V'),w/2,cy+30);
  c.fillStyle='#f0454a'; c.fillText('Worst Case: '+fmtVal(wcData.worst,'V'),w/2,cy+60);
  c.fillStyle='#f59e0b'; c.fillText('Spread: '+fmtVal(Math.abs(wcData.best-wcData.worst),'V')+' (\u00B110%)',w/2,cy+90);
  c.font='400 12px Outfit'; c.fillStyle='#5a6a7a'; c.fillText('Method: '+(wcData.method==='rss'?'RSS (Root Sum of Squares)':'EVP (Extreme Value)'),w/2,cy+120);
}
