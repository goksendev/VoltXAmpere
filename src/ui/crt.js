// ══════════════════════════════════════════════════════════════
// CRT OSCILLOSCOPE MODE + CURSOR + MEASUREMENTS (Sprint 22 Enhanced)
// ══════════════════════════════════════════════════════════════

// ── CRT State ──
var _crtTraceHistory = [[], [], [], []];
var CRT_PERSISTENCE_FRAMES = 15;
var _crtPhosphorColors = ['#00ff41', '#41ff41', '#ffff00', '#00ffff'];
var _crtPersistence = 35; // 0-100 slider value
var _crtPhosphorType = 'P31'; // P31, P7, P1, P43
var _crtBootAnim = 0; // 0=no anim, >0 = ms since CRT turned on
var _crtBootStart = 0;

var CRT_PHOSPHOR_PALETTES = {
  P31: { name: 'P31 (Classic Green)', main: '#00ff41', fade: '#004010', all: ['#00ff41','#00ff41','#00ff41','#00ff41'] },
  P7:  { name: 'P7 (Blue-Green)',     main: '#00ccaa', fade: '#003322', all: ['#00ccaa','#00ccaa','#00ccaa','#00ccaa'] },
  P1:  { name: 'P1 (Green Short)',    main: '#33ff33', fade: '#003300', all: ['#33ff33','#33ff33','#33ff33','#33ff33'] },
  P43: { name: 'P43 (Green Medium)',  main: '#22dd44', fade: '#002208', all: ['#22dd44','#22dd44','#22dd44','#22dd44'] }
};

function toggleCRT() {
  S.crtMode = !S.crtMode;
  var btn = document.getElementById('btn-crt');
  if (btn) btn.classList.toggle('active', S.crtMode);
  var sl = document.getElementById('crt-scanlines');
  var vg = document.getElementById('crt-vignette');
  if (sl) sl.style.display = S.crtMode ? 'block' : 'none';
  if (vg) vg.style.display = S.crtMode ? 'block' : 'none';
  if (S.crtMode) {
    _crtBootStart = performance.now();
    _crtBootAnim = 1;
    // Apply phosphor palette
    var pal = CRT_PHOSPHOR_PALETTES[_crtPhosphorType] || CRT_PHOSPHOR_PALETTES.P31;
    _crtPhosphorColors = pal.all.slice();
  } else {
    _crtTraceHistory = [[], [], [], []];
    _crtBootAnim = 0;
  }
  needsRender = true;
}

function setCRTPersistence(val) {
  _crtPersistence = Math.max(0, Math.min(100, val));
  CRT_PERSISTENCE_FRAMES = Math.max(1, Math.round(_crtPersistence / 100 * 30));
  needsRender = true;
}

function setCRTPhosphor(type) {
  _crtPhosphorType = type;
  var pal = CRT_PHOSPHOR_PALETTES[type] || CRT_PHOSPHOR_PALETTES.P31;
  _crtPhosphorColors = pal.all.slice();
  needsRender = true;
}

// CRT boot animation progress (0-1, or -1 if done)
function getCRTBootProgress() {
  if (!_crtBootAnim) return -1;
  var elapsed = performance.now() - _crtBootStart;
  if (elapsed >= 1000) { _crtBootAnim = 0; return -1; }
  return elapsed / 1000;
}

// Beam intensity: slower movement = brighter
function computeBeamIntensity(vals, i) {
  if (i <= 0 || i >= vals.length) return 1;
  var dv = Math.abs(vals[i] - vals[i - 1]);
  var maxDv = 0.5; // normalize factor
  return 1 / (1 + dv / maxDv * 2);
}

// ── CURSOR SYSTEM (Enhanced) ──
var _scopeCursorDrag = null; // 'a' | 'b' | null
var _scopeCursorMode = 'time'; // 'time' | 'voltage' | 'cross'
var _scopeCursorVY1 = 60, _scopeCursorVY2 = 140; // voltage cursor Y positions

function _initScopeCursorHandlers() {
  var sw = document.getElementById('scope-wrap');
  if (!sw) return;
  sw.addEventListener('mousedown', function(e) {
    if (!S.scope.cursors) return;
    var rect = sw.querySelector('canvas').getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (_scopeCursorMode === 'time' || _scopeCursorMode === 'cross') {
      if (Math.abs(mx - S.scope.cx1) < 12) { _scopeCursorDrag = 'a'; e.preventDefault(); return; }
      if (Math.abs(mx - S.scope.cx2) < 12) { _scopeCursorDrag = 'b'; e.preventDefault(); return; }
    }
    if (_scopeCursorMode === 'voltage' || _scopeCursorMode === 'cross') {
      if (Math.abs(my - _scopeCursorVY1) < 12) { _scopeCursorDrag = 'va'; e.preventDefault(); return; }
      if (Math.abs(my - _scopeCursorVY2) < 12) { _scopeCursorDrag = 'vb'; e.preventDefault(); return; }
    }
  });
  sw.addEventListener('mousemove', function(e) {
    if (!_scopeCursorDrag) return;
    var rect = sw.querySelector('canvas').getBoundingClientRect();
    var mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    var my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    if (_scopeCursorDrag === 'a') S.scope.cx1 = mx;
    else if (_scopeCursorDrag === 'b') S.scope.cx2 = mx;
    else if (_scopeCursorDrag === 'va') _scopeCursorVY1 = my;
    else if (_scopeCursorDrag === 'vb') _scopeCursorVY2 = my;
    needsRender = true;
  });
  sw.addEventListener('mouseup', function() { _scopeCursorDrag = null; });
  sw.addEventListener('mouseleave', function() { _scopeCursorDrag = null; });
}
_initScopeCursorHandlers();

function cycleCursorMode() {
  var modes = ['time', 'voltage', 'cross'];
  var idx = modes.indexOf(_scopeCursorMode);
  _scopeCursorMode = modes[(idx + 1) % modes.length];
  needsRender = true;
}

// ── ENHANCED MEASUREMENTS ──
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

  // Frequency: zero-crossing with LINEAR INTERPOLATION for ±0.1% accuracy
  var crossings = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] < vavg && vals[i] >= vavg) {
      // Interpolate exact crossing point
      var frac = (vavg - vals[i - 1]) / (vals[i] - vals[i - 1]);
      crossings.push(i - 1 + frac);
    }
  }
  var dtPerSample = tDiv * 10 / 600;
  var freq = 0, period = 0;
  if (crossings.length >= 2) {
    var totalCycles = crossings.length - 1;
    var totalSamples = crossings[crossings.length - 1] - crossings[0];
    period = totalSamples * dtPerSample / totalCycles;
    freq = period > 0 ? 1 / period : 0;
  }

  // Vrms over last complete period (more accurate)
  if (crossings.length >= 3) {
    var startIdx = Math.floor(crossings[0]);
    var endIdx = Math.ceil(crossings[crossings.length - 1]);
    var pSum = 0, pN = 0;
    for (var i = startIdx; i <= endIdx && i < vals.length; i++) {
      pSum += vals[i] * vals[i]; pN++;
    }
    if (pN > 0) vrms = Math.sqrt(pSum / pN);
  }

  // Duty cycle
  var aboveAvg = 0;
  for (var i = 0; i < vals.length; i++) { if (vals[i] > vavg) aboveAvg++; }
  var duty = (aboveAvg / vals.length) * 100;

  // Rise time (10% → 90%) with interpolation
  var v10 = vmin + vpp * 0.1, v90 = vmin + vpp * 0.9;
  var riseStart = -1, riseEnd = -1;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] < v10 && vals[i] >= v10 && riseStart < 0) {
      riseStart = i - 1 + (v10 - vals[i - 1]) / (vals[i] - vals[i - 1]);
    }
    if (riseStart >= 0 && vals[i - 1] < v90 && vals[i] >= v90) {
      riseEnd = i - 1 + (v90 - vals[i - 1]) / (vals[i] - vals[i - 1]);
      break;
    }
  }
  var riseTime = (riseStart >= 0 && riseEnd > riseStart) ? (riseEnd - riseStart) * dtPerSample : 0;

  // Fall time (90% → 10%) with interpolation
  var fallStart = -1, fallEnd = -1;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i - 1] > v90 && vals[i] <= v90 && fallStart < 0) {
      fallStart = i - 1 + (v90 - vals[i - 1]) / (vals[i] - vals[i - 1]);
    }
    if (fallStart >= 0 && vals[i - 1] > v10 && vals[i] <= v10) {
      fallEnd = i - 1 + (v10 - vals[i - 1]) / (vals[i] - vals[i - 1]);
      break;
    }
  }
  var fallTime = (fallStart >= 0 && fallEnd > fallStart) ? (fallEnd - fallStart) * dtPerSample : 0;

  // THD
  var thd = 0;
  if (freq > 0 && vpp > 0.01) {
    var fundamental = 0, harmonics = 0;
    var N = vals.length;
    for (var h = 1; h <= 6; h++) {
      var re = 0, im = 0;
      var fBin = crossings.length > 1 ? (crossings.length - 1) * h : h;
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

  // ── NEW: Overshoot, Settling Time, Slew Rate, Crest Factor ──
  // Overshoot: (peak - steady) / steady * 100
  var overshoot = 0;
  if (vpp > 0.01) {
    var lastQuarter = vals.slice(Math.floor(vals.length * 0.75));
    var steadyState = lastQuarter.reduce(function(a, b) { return a + b; }, 0) / lastQuarter.length;
    if (Math.abs(steadyState) > 0.001) {
      overshoot = Math.max(0, (vmax - steadyState) / Math.abs(steadyState) * 100);
    }
  }

  // Slew rate: max |dV/dt| in V/µs
  var maxDvDt = 0;
  for (var i = 1; i < vals.length; i++) {
    var dvdt = Math.abs(vals[i] - vals[i - 1]) / dtPerSample;
    if (dvdt > maxDvDt) maxDvDt = dvdt;
  }
  var slewRate = maxDvDt * 1e-6; // V/µs

  // Crest factor: Vpeak / Vrms
  var crestFactor = vrms > 0 ? Math.max(Math.abs(vmax), Math.abs(vmin)) / vrms : 0;

  // Settling time (±2% band around steady state)
  var settlingTime = 0;
  if (vpp > 0.01) {
    var ss = vals.slice(Math.floor(vals.length * 0.8));
    var ssAvg = ss.reduce(function(a, b) { return a + b; }, 0) / ss.length;
    var band = Math.abs(ssAvg) * 0.02 || vpp * 0.02;
    for (var i = vals.length - 1; i >= 0; i--) {
      if (Math.abs(vals[i] - ssAvg) > band) {
        settlingTime = (vals.length - 1 - i) * dtPerSample;
        settlingTime = (vals.length - 1 - i) > 0 ? i * dtPerSample : 0;
        break;
      }
    }
  }

  return {
    vmin: vmin, vmax: vmax, vpp: vpp, vavg: vavg, vrms: vrms,
    freq: freq, period: period, duty: duty,
    riseTime: riseTime, fallTime: fallTime, thd: thd,
    // Sprint 22 new:
    overshoot: overshoot, slewRate: slewRate,
    crestFactor: crestFactor, settlingTime: settlingTime
  };
}

// ── REFERENCE WAVEFORM ──
var scopeRefData = [null, null, null, null];

function toggleRef() {
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

// ── AUTO SCALE ──
function autoScaleScope() {
  // Find best V/div and T/div for visible signals
  var maxVpp = 0;
  for (var c = 0; c < 4; c++) {
    if (!S.scope.ch[c].on) continue;
    var buf = S.scope.ch[c].buf;
    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < 600; i++) { var v = buf[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    var vpp = mx - mn;
    if (vpp > maxVpp) maxVpp = vpp;
  }
  if (maxVpp > 0) {
    // Nice V/div: signal fills ~6 divisions
    var nice = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    var targetVdiv = maxVpp / 6;
    var bestVdiv = nice[nice.length - 1];
    for (var i = 0; i < nice.length; i++) {
      if (nice[i] >= targetVdiv) { bestVdiv = nice[i]; break; }
    }
    for (var c = 0; c < 4; c++) S.scope.ch[c].vDiv = bestVdiv;
    var el = document.getElementById('sc-vdiv');
    if (el) el.value = String(bestVdiv);
  }
  needsRender = true;
}
