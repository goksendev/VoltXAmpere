// ──────── FFT ────────
var fftData = null;
function runFFT() {
  if (!S.scope || !S.scope.ch[0].on) return;
  var buf = S.scope.ch[0].buf, ptr = S.scope.ptr;
  var N = 512;
  var re = new Float64Array(N), im = new Float64Array(N);
  for (var i = 0; i < N; i++) {
    var win = 0.5 * (1 - Math.cos(2*Math.PI*i/(N-1)));
    re[i] = buf[(ptr + i) % 600] * win;
  }
  var bits = Math.log2(N);
  for (var i = 0; i < N; i++) {
    var j = 0;
    for (var b = 0; b < bits; b++) j |= ((i >> b) & 1) << (bits - 1 - b);
    if (j > i) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (var s = 1; s <= bits; s++) {
    var m = 1 << s, mh = m >> 1;
    var wR = Math.cos(2*Math.PI/m), wI = -Math.sin(2*Math.PI/m);
    for (var k = 0; k < N; k += m) {
      var uR = 1, uI = 0;
      for (var j = 0; j < mh; j++) {
        var tR = uR*re[k+j+mh] - uI*im[k+j+mh];
        var tI = uR*im[k+j+mh] + uI*re[k+j+mh];
        re[k+j+mh] = re[k+j] - tR; im[k+j+mh] = im[k+j] - tI;
        re[k+j] += tR; im[k+j] += tI;
        var tmp = uR*wR - uI*wI; uI = uR*wI + uI*wR; uR = tmp;
      }
    }
  }
  fftData = { freq: [], mag: [] };
  var sampleRate = 1 / SIM_DT / SUBSTEPS;
  for (var i = 1; i < N/2; i++) {
    var mag = Math.sqrt(re[i]*re[i] + im[i]*im[i]) / (N/2);
    var magDB = mag > 1e-10 ? 20*Math.log10(mag) : -100;
    fftData.freq.push(i * sampleRate / N);
    fftData.mag.push(magDB);
  }
  var ov=document.getElementById('ov-fft');if(ov)ov.style.display='none';
  switchTab('fft');
}

function drawFFT() {
  var cvs = document.getElementById('FFTC');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);
  if (!fftData || !fftData.freq.length) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('FFT yapılmadı. Simülasyon çalışırken FFT butonuna basın.', w/2, h/2); return;
  }
  var d = fftData, mx=50,my=20,pw=w-mx-20,ph=h-my-30;
  var yMin=-80, yMax=Math.max.apply(null,d.mag)+5;
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
  for(var i=0;i<=5;i++){var y=my+ph*i/5;c.beginPath();c.moveTo(mx,y);c.lineTo(mx+pw,y);c.stroke();}
  var barW = Math.max(1, pw / d.freq.length - 1);
  for(var i=0;i<d.freq.length;i++){
    var x = mx + i/d.freq.length*pw;
    var magN = Math.max(0, (d.mag[i]-yMin)/(yMax-yMin));
    var bh = magN * ph;
    c.fillStyle = i < 10 ? '#00e09e' : '#3b82f6';
    c.fillRect(x, my+ph-bh, barW, bh);
  }
  c.fillStyle='#5a6a7a';c.font='9px "JetBrains Mono"';c.textAlign='right';
  for(var i=0;i<=5;i++) c.fillText(Math.round(yMin+(yMax-yMin)*(5-i)/5)+'dB',mx-4,my+ph*i/5+4);
  c.textAlign='center';c.fillText('Frekans (Hz)',w/2,h-3);
}
