// ──────── NOISE ANALYSIS ────────
var noiseData = null;
function runNoiseAnalysis() {
  if (!S.parts.length) return;
  buildCircuitFromCanvas();
  if (!SIM) return;
  var result = VXA.NoiseAnalysis.run(1, 1e6, 10);
  noiseData = { freq: [], vnoise: [], result: result };
  if (result.points && result.points.length > 0) {
    result.points.forEach(function(p) {
      noiseData.freq.push(p.freq);
      noiseData.vnoise.push(p.density_dB);
    });
  }
  var ov=document.getElementById('ov-noise');if(ov)ov.style.display='none';
  switchTab('noise');
}
function drawNoise() {
  var cvs = document.getElementById('NOISEC');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  cvs.width=r.width*DPR;cvs.height=r.height*DPR;
  cvs.style.width=r.width+'px';cvs.style.height=r.height+'px';
  var c=cvs.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var w=r.width,h=r.height;
  c.fillStyle='#080c14';c.fillRect(0,0,w,h);
  if (!noiseData) { c.fillStyle='#5a6a7a';c.font='13px Outfit';c.textAlign='center';c.fillText('G\u00fcr\u00fclt\u00fc analizi yap\u0131lmad\u0131.',w/2,h/2);return; }
  var d=noiseData,mx2=50,my=20,pw=w-mx2-20,ph=h-my-30;
  var yMin=Math.min.apply(null,d.vnoise)-5,yMax=Math.max.apply(null,d.vnoise)+5;
  c.strokeStyle='#ec4899';c.lineWidth=2;c.shadowColor='#ec4899';c.shadowBlur=4;
  c.beginPath();
  for(var i=0;i<d.freq.length;i++){
    var x=mx2+Math.log10(d.freq[i])/6*pw;
    var y=my+(1-(d.vnoise[i]-yMin)/(yMax-yMin))*ph;
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.stroke();c.shadowBlur=0;
  c.fillStyle='#5a6a7a';c.font='10px "JetBrains Mono"';c.textAlign='center';
  c.fillText('Frekans (Hz) \u2014 log',w/2,h-3);
  c.textAlign='right';c.fillText('V/\u221AHz (dB)',mx2-4,my+10);
}
