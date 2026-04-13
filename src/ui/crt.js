// ──────── 4.1: CRT / PHOSPHOR OSCILLOSCOPE MODE ────────
var _crtTraceHistory = [[], [], [], []]; // 4 channel × N frames
var CRT_PERSISTENCE_FRAMES = 5;
var _crtPhosphorColors = ['#00ff41', '#41ff41', '#ffff00', '#00ffff'];

function toggleCRT() {
  S.crtMode = !S.crtMode;
  var btn = document.getElementById('btn-crt');
  if (btn) btn.classList.toggle('active', S.crtMode);
  var sl = document.getElementById('crt-scanlines');
  var vg = document.getElementById('crt-vignette');
  if (sl) sl.style.display = S.crtMode ? 'block' : 'none';
  if (vg) vg.style.display = S.crtMode ? 'block' : 'none';
  if (!S.crtMode) { _crtTraceHistory = [[], [], [], []]; }
  needsRender = true;
}

// ──────── 4.2: CURSOR MEASUREMENT SYSTEM ────────
var _scopeCursorDrag = null; // 'a' | 'b' | null

function _initScopeCursorHandlers() {
  var sw = document.getElementById('scope-wrap');
  if (!sw) return;
  sw.addEventListener('mousedown', function(e) {
    if (!S.scope.cursors) return;
    var rect = sw.querySelector('canvas').getBoundingClientRect();
    var mx = e.clientX - rect.left;
    if (Math.abs(mx - S.scope.cx1) < 10) { _scopeCursorDrag = 'a'; e.preventDefault(); }
    else if (Math.abs(mx - S.scope.cx2) < 10) { _scopeCursorDrag = 'b'; e.preventDefault(); }
  });
  sw.addEventListener('mousemove', function(e) {
    if (!_scopeCursorDrag) return;
    var rect = sw.querySelector('canvas').getBoundingClientRect();
    var mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    if (_scopeCursorDrag === 'a') S.scope.cx1 = mx;
    else S.scope.cx2 = mx;
    needsRender = true;
  });
  sw.addEventListener('mouseup', function() { _scopeCursorDrag = null; });
  sw.addEventListener('mouseleave', function() { _scopeCursorDrag = null; });
}
_initScopeCursorHandlers();

// ──────── 4.3: SCOPE MEASUREMENT PANEL ENHANCEMENT ────────
function computeScopeMeasurements(buf, ptr, tDiv) {
  var vals = [];
  for (var i = 0; i < 600; i++) vals.push(buf[(ptr + i) % 600]);
  if (vals.length < 10) return null;

  var vmin = Infinity, vmax = -Infinity, sum = 0, sumSq = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    if (v < vmin) vmin = v;
    if (v > vmax) vmax = v;
    sum += v;
    sumSq += v * v;
  }
  var vpp = vmax - vmin;
  var vavg = sum / vals.length;
  var vrms = Math.sqrt(sumSq / vals.length);

  // Frequency: count positive zero-crossings relative to vavg
  var crossings = 0;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] < vavg && vals[i] >= vavg) crossings++;
  }
  var samplesPerSec = 600 / (tDiv * 10);
  var freq = crossings > 1 ? (crossings - 1) * samplesPerSec / 600 / 2 : 0;
  var period = freq > 0 ? 1 / freq : 0;

  // Duty cycle
  var aboveAvg = 0;
  for (var i = 0; i < vals.length; i++) { if (vals[i] > vavg) aboveAvg++; }
  var duty = (aboveAvg / vals.length) * 100;

  // Rise time (10% → 90%)
  var v10 = vmin + vpp * 0.1, v90 = vmin + vpp * 0.9;
  var riseStart = -1, riseEnd = -1;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] < v10 && vals[i] >= v10 && riseStart < 0) riseStart = i;
    if (riseStart >= 0 && vals[i - 1] < v90 && vals[i] >= v90) { riseEnd = i; break; }
  }
  var dtPerSample = tDiv * 10 / 600;
  var riseTime = (riseStart >= 0 && riseEnd > riseStart) ? (riseEnd - riseStart) * dtPerSample : 0;

  // Fall time (90% → 10%)
  var fallStart = -1, fallEnd = -1;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] > v90 && vals[i] <= v90 && fallStart < 0) fallStart = i;
    if (fallStart >= 0 && vals[i - 1] > v10 && vals[i] <= v10) { fallEnd = i; break; }
  }
  var fallTime = (fallStart >= 0 && fallEnd > fallStart) ? (fallEnd - fallStart) * dtPerSample : 0;

  // THD (basic: compute ratio of harmonics to fundamental using simple FFT-like approach)
  var thd = 0;
  if (freq > 0 && vpp > 0.01) {
    var fundamental = 0, harmonics = 0;
    var N = vals.length;
    // Compute power at fundamental and first 5 harmonics
    for (var h = 1; h <= 6; h++) {
      var re = 0, im = 0;
      var fBin = crossings > 1 ? (crossings - 1) * h : h;
      for (var i = 0; i < N; i++) {
        var angle = 2 * Math.PI * fBin * i / N;
        re += vals[i] * Math.cos(angle);
        im += vals[i] * Math.sin(angle);
      }
      var mag = Math.sqrt(re * re + im * im) / N;
      if (h === 1) fundamental = mag; else harmonics += mag * mag;
    }
    if (fundamental > 0) thd = Math.sqrt(harmonics) / fundamental * 100;
  }

  return { vmin: vmin, vmax: vmax, vpp: vpp, vavg: vavg, vrms: vrms, freq: freq, period: period, duty: duty, riseTime: riseTime, fallTime: fallTime, thd: thd };
}

// ──────── 4.4: REFERENCE WAVEFORM (REF) ────────
var scopeRefData = [null, null, null, null];

function toggleRef() {
  // Find first active channel
  var activeCh = -1;
  for (var c = 0; c < 4; c++) { if (S.scope.ch[c].on) { activeCh = c; break; } }
  if (activeCh < 0) return;
  if (scopeRefData[activeCh]) {
    scopeRefData[activeCh] = null;
  } else {
    var buf = S.scope.ch[activeCh].buf;
    scopeRefData[activeCh] = new Float64Array(600);
    for (var i = 0; i < 600; i++) scopeRefData[activeCh][i] = buf[i];
  }
  var btn = document.getElementById('btn-ref');
  var hasAny = scopeRefData.some(function(r) { return r !== null; });
  if (btn) btn.classList.toggle('active', hasAny);
  needsRender = true;
}
