// ──────── HOLOGRAPHIC FORMULAS + SENSORY UI (v8.0 Sprint 14) ────────

// ===== A. FORMULA OVERLAY SYSTEM =====

var PART_FORMULAS = {
  resistor: function(p) {
    var V = Math.abs(p._v || 0);
    var I = Math.abs(p._i || 0);
    var R = p.val || 1;
    var P = V * I;
    var pMax = 0.25;
    if (p._thermal && p._thermal.Pmax) pMax = p._thermal.Pmax;
    return [
      { label: 'V = IR', value: fmtEng(V) + 'V = ' + fmtEng(I) + 'A \u00D7 ' + fmtEng(R) + '\u03A9', status: 'safe' },
      { label: 'P = I\u00B2R', value: fmtEng(P) + 'W', status: P > pMax ? 'danger' : P > pMax * 0.8 ? 'warn' : 'safe' }
    ];
  },
  capacitor: function(p) {
    var V = Math.abs(p._v || 0);
    var C = p.val || 1e-6;
    var E = 0.5 * C * V * V;
    var freq = 1000;
    var Xc = 1 / (2 * Math.PI * freq * C);
    return [
      { label: 'Xc = 1/(2\u03C0fC)', value: fmtEng(Xc) + '\u03A9 @ ' + fmtEng(freq) + 'Hz', status: 'safe' },
      { label: 'E = \u00BDC V\u00B2', value: fmtEng(E) + 'J', status: 'safe' }
    ];
  },
  inductor: function(p) {
    var L = p.val || 1e-3;
    var freq = 1000;
    var Xl = 2 * Math.PI * freq * L;
    return [
      { label: 'XL = 2\u03C0fL', value: fmtEng(Xl) + '\u03A9 @ ' + fmtEng(freq) + 'Hz', status: 'safe' }
    ];
  },
  diode: function(p) {
    var I = Math.abs(p._i || 0);
    var V = Math.abs(p._v || 0);
    return [
      { label: 'I = Is(e^(V/nVt)\u22121)', value: fmtEng(I) + 'A @ ' + fmtEng(V) + 'V', status: 'safe' }
    ];
  },
  led: function(p) {
    var I = Math.abs(p._i || 0);
    var V = Math.abs(p._v || 0);
    var P = V * I;
    return [
      { label: 'Vf \u2248 ' + V.toFixed(2) + 'V', value: 'If = ' + fmtEng(I) + 'A', status: I > 0.025 ? 'danger' : I > 0.02 ? 'warn' : 'safe' },
      { label: 'P = ' + fmtEng(P) + 'W', value: '', status: P > 0.1 ? 'danger' : 'safe' }
    ];
  },
  npn: function(p) { return _bjtFormulas(p); },
  pnp: function(p) { return _bjtFormulas(p); },
  nmos: function(p) { return _mosFormulas(p); },
  pmos: function(p) { return _mosFormulas(p); },
  opamp: function(p) {
    return [
      { label: 'Vout = Aol(V+ \u2212 V\u2212)', value: '', status: 'safe' }
    ];
  },
  dcSource: function(p) {
    var V = p.val || 0;
    var I = Math.abs(p._i || 0);
    var P = Math.abs(V) * I;
    return [
      { label: 'V = ' + fmtEng(V) + 'V', value: 'I = ' + fmtEng(I) + 'A', status: 'safe' },
      { label: 'P = ' + fmtEng(P) + 'W', value: '', status: 'safe' }
    ];
  },
  acSource: function(p) {
    var Vp = p.val || 5;
    var f = p.freq || 1000;
    var Vrms = Vp / Math.sqrt(2);
    return [
      { label: 'v(t) = ' + fmtEng(Vp) + 'sin(2\u03C0\u00B7' + fmtEng(f) + 't)', value: '', status: 'safe' },
      { label: 'Vrms = ' + fmtEng(Vrms) + 'V', value: '', status: 'safe' }
    ];
  },
  zener: function(p) {
    var V = Math.abs(p._v || 0);
    var I = Math.abs(p._i || 0);
    return [
      { label: 'Vz \u2248 ' + V.toFixed(2) + 'V', value: 'Iz = ' + fmtEng(I) + 'A', status: 'safe' }
    ];
  },
  fuse: function(p) {
    var I = Math.abs(p._i || 0);
    var Irated = p.val || 1;
    return [
      { label: 'I = ' + fmtEng(I) + 'A', value: 'Irated = ' + fmtEng(Irated) + 'A', status: I > Irated ? 'danger' : I > Irated * 0.8 ? 'warn' : 'safe' }
    ];
  }
};

function _bjtFormulas(p) {
  var Ic = Math.abs(p._i || 0);
  var Vt = 0.026;
  var beta = p.beta || p.hfe || 100;
  var Ib = beta > 0 ? Ic / beta : 0;
  var gm = Vt > 0 ? Ic / Vt : 0;
  return [
    { label: 'Ic = \u03B2\u00B7Ib', value: fmtEng(Ic) + 'A = ' + beta + '\u00B7' + fmtEng(Ib) + 'A', status: 'safe' },
    { label: 'gm = Ic/Vt', value: fmtEng(gm) + 'S', status: 'safe' }
  ];
}

function _mosFormulas(p) {
  var Id = Math.abs(p._i || 0);
  var Vgs = p._vgs || 0;
  var Vth = p._vth || 1.5;
  return [
    { label: 'Id = \u00BDKp(Vgs\u2212Vth)\u00B2', value: fmtEng(Id) + 'A', status: 'safe' },
    { label: 'Vgs=' + Vgs.toFixed(2) + 'V', value: 'Vth=' + Vth.toFixed(2) + 'V', status: Math.abs(Vgs) < Math.abs(Vth) ? 'warn' : 'safe' }
  ];
}

// Engineering notation formatter
function fmtEng(val) {
  if (val === 0) return '0';
  var abs = Math.abs(val);
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + 'k';
  if (abs >= 1) return val.toFixed(2);
  if (abs >= 1e-3) return (val * 1e3).toFixed(2) + 'm';
  if (abs >= 1e-6) return (val * 1e6).toFixed(2) + '\u00B5';
  if (abs >= 1e-9) return (val * 1e9).toFixed(2) + 'n';
  if (abs >= 1e-12) return (val * 1e12).toFixed(2) + 'p';
  return val.toExponential(2);
}

// Hover timing
var _formulaHoverStartTime = 0;
var _formulaLastHoveredId = null;

function drawFormulaOverlay(ctx, part) {
  if (!part || part.damaged) return;

  // Hover delay: 300ms before showing
  if (part.id !== _formulaLastHoveredId) {
    _formulaLastHoveredId = part.id;
    _formulaHoverStartTime = Date.now();
    return;
  }
  if (Date.now() - _formulaHoverStartTime < 300) return;

  var formulaFn = PART_FORMULAS[part.type];
  if (!formulaFn) return;
  var formulas;
  try { formulas = formulaFn(part); } catch(e) { return; }
  if (!formulas || formulas.length === 0) return;

  var boxW = 220;
  var lineH = 18;
  var padding = 10;
  var boxH = padding * 2 + formulas.length * lineH;

  // Position: right of component by default. Sprint 70h: diode / LED /
  // zener pins extend only ±30 px (vs ±40 for resistor/cap/inductor),
  // so a +35 px tooltip offset leaves the formula box overlapping the
  // glyph — widen the offset for narrow-pin parts.
  // Sprint 76: viewport-aware flip. If the tooltip would spill past
  // the right edge of the canvas at the current zoom/pan, draw it on
  // the LEFT of the component instead.
  var narrowPin = (part.type === 'diode' || part.type === 'led' || part.type === 'zener');
  var offset = narrowPin ? 55 : 35;
  var bx = part.x + offset;
  // Convert tooltip right edge to screen-space; if off-canvas, flip.
  var canvasW = (typeof cvs !== 'undefined' && cvs.width) ?
                cvs.width / ((typeof DPR !== 'undefined' && DPR) ? DPR : 1) : 1400;
  var zoom = (S && S.view && S.view.zoom) || 1;
  var ox = (S && S.view && S.view.ox) || 0;
  var rightEdgeScreen = ((bx + boxW) * zoom) + ox;
  if (rightEdgeScreen > canvasW - 8) {
    bx = part.x - offset - boxW;
  }
  var by = part.y - boxH / 2;

  // Fade-in (200ms after 300ms delay)
  var elapsed = Date.now() - _formulaHoverStartTime - 300;
  var alpha = Math.min(1, elapsed / 200);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background (dark semi-transparent)
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.strokeStyle = 'rgba(100, 140, 255, 0.3)';
  ctx.lineWidth = 1;

  // Rounded rect
  _roundRect(ctx, bx, by, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  // Formulas
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';

  for (var i = 0; i < formulas.length; i++) {
    var f = formulas[i];
    var fy = by + padding + i * lineH + lineH / 2;

    var labelColor = '#aabbff';
    var valueColor = '#00ff41';
    if (f.status === 'warn') { valueColor = '#ffff00'; }
    else if (f.status === 'danger') { valueColor = '#ff4444'; labelColor = '#ffaaaa'; }

    ctx.fillStyle = labelColor;
    ctx.textAlign = 'left';
    ctx.fillText(f.label, bx + padding, fy);

    if (f.value) {
      ctx.fillStyle = valueColor;
      ctx.textAlign = 'right';
      ctx.fillText(f.value, bx + boxW - padding, fy);
    }
  }

  ctx.restore();
}

// ===== B. WIRE PULLING TENSION FEEL =====

var _wireLag = { x: 0, y: 0, init: false };

function updateWireLag(wx, wy) {
  if (!_wireLag.init) { _wireLag.x = wx; _wireLag.y = wy; _wireLag.init = true; return; }
  var lerp = 0.35;
  _wireLag.x += (wx - _wireLag.x) * lerp;
  _wireLag.y += (wy - _wireLag.y) * lerp;
}

function resetWireLag() { _wireLag.init = false; }

// Flash effects for wire connection
var _flashEffects = [];

function onWireConnected(px, py) {
  if (VXA.SpatialAudio) { VXA.SpatialAudio.playAt('click', px, py); }
  _flashEffects.push({ x: px, y: py, startTime: Date.now(), duration: 150 });
}

function drawFlashEffects(ctx) {
  var now = Date.now();
  for (var i = _flashEffects.length - 1; i >= 0; i--) {
    var f = _flashEffects[i];
    var elapsed = now - f.startTime;
    if (elapsed > f.duration) { _flashEffects.splice(i, 1); continue; }
    var progress = elapsed / f.duration;
    var radius = 5 + progress * 15;
    var a = 1 - progress;
    ctx.save();
    ctx.beginPath();
    ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (a * 0.6) + ')';
    ctx.fill();
    ctx.restore();
  }
}

// ===== C. CAPACITOR BREATHING EFFECT =====

function getCapacitorBreathing(part) {
  if (!S.sim.running || !S.animationsOn) return null;
  if (part.type !== 'capacitor') return null;
  var V = Math.abs(part._v || 0);
  var maxV = 25;
  if (part.val > 1e-4) maxV = 25;
  else if (part.val > 1e-6) maxV = 50;
  else maxV = 100;
  var chargeRatio = Math.min(1, V / maxV);
  return {
    scale: 1 + chargeRatio * 0.05,
    chargeRatio: chargeRatio,
    // Color: plates darken with charge
    r: Math.round(85 - chargeRatio * 50),
    g: Math.round(136 - chargeRatio * 100),
    b: 170
  };
}

// ===== D. DRAGGABLE 3D PROBE UX =====
// Sprint 79: multimeter probe with wire attach, AC RMS, mode select, hold.
//
// Extensions over the original probe:
//   • Probes can snap to wires, not just part pins. Wire endpoints are
//     registered as nodes by buildCircuitFromCanvas, so we can resolve
//     any wire to a net via S._pinToNode.
//   • Node voltages are sampled per render frame into per-probe ring
//     buffers. This drives an isACSignal / getRMS pair (Sprint 72) so
//     the tooltip switches between DC instantaneous and AC RMS with
//     unambiguous labelling.
//   • Mode selector: auto / V / I / R / dB. Cycled with the 'm' key
//     while probe mode is active. R requires both probes on the same
//     part with a measurable current; dB requires black probe at a
//     non-zero reference.
//   • Hold buffer: live / min / max / peak, cycled with 'h'. Only
//     accumulates while S.sim.running.

VXA.Probes = (function() {
  'use strict';

  var _probes = {
    red:   { x: -1, y: -1, attached: false, partId: null, pinIndex: -1,
             wireIdx: null, color: '#ff3333', label: '+', vHistory: [] },
    black: { x: -1, y: -1, attached: false, partId: null, pinIndex: -1,
             wireIdx: null, color: '#444444', label: '\u2212', vHistory: [] }
  };

  var _activeProbe = null;
  var _probeMode   = false;
  var MODES        = ['auto', 'V', 'I', 'R', 'dB'];
  var HOLDS        = ['live', 'min', 'max', 'peak'];
  var _mode        = 'auto';
  var _hold        = 'live';
  var _holdState   = { vDiff: null, current: null };
  var HIST_CAP     = 500; // samples per probe (≈5s at 100 Hz paint)

  function _rmsSafe(h) {
    if (typeof getRMS === 'function') return getRMS(h);
    if (!h || h.length < 2) return 0;
    var s = 0; for (var i = 0; i < h.length; i++) s += h[i] * h[i];
    return Math.sqrt(s / h.length);
  }
  function _isACSafe(h) {
    if (typeof isACSignal === 'function') return isACSignal(h);
    if (!h || h.length < 10) return false;
    var hasPos = false, hasNeg = false;
    for (var i = 0; i < h.length; i++) {
      if (h[i] >  1e-9) hasPos = true;
      if (h[i] < -1e-9) hasNeg = true;
      if (hasPos && hasNeg) return true;
    }
    return false;
  }

  function findPinNear(wx, wy, maxDist) {
    var best = null, bestD = maxDist || 25;
    for (var i = 0; i < S.parts.length; i++) {
      var p = S.parts[i];
      var pins = getPartPins(p);
      for (var pi = 0; pi < pins.length; pi++) {
        var dx = wx - pins[pi].x, dy = wy - pins[pi].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) {
          bestD = d;
          best = { partId: p.id, pinIndex: pi, x: pins[pi].x, y: pins[pi].y, dist: d };
        }
      }
    }
    return best;
  }

  // Perpendicular distance from (px,py) to segment (ax,ay)-(bx,by).
  function _distPointToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) { var ddx = px - ax, ddy = py - ay; return Math.sqrt(ddx*ddx+ddy*ddy); }
    var t = ((px - ax) * dx + (py - ay) * dy) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var cx = ax + t * dx, cy = ay + t * dy;
    var ddx2 = px - cx, ddy2 = py - cy;
    return { d: Math.sqrt(ddx2*ddx2 + ddy2*ddy2), t: t, cx: cx, cy: cy };
  }

  function findWireNear(wx, wy, maxDist) {
    if (!S.wires || !S.wires.length) return null;
    var best = null, bestD = maxDist || 20;
    for (var i = 0; i < S.wires.length; i++) {
      var w = S.wires[i];
      var r = _distPointToSeg(wx, wy, w.x1, w.y1, w.x2, w.y2);
      if (r.d < bestD) {
        bestD = r.d;
        best = { wireIdx: i, x: r.cx, y: r.cy, dist: r.d };
      }
    }
    return best;
  }

  // Return the node index this probe is connected to, or null.
  function _probeNodeIdx(pr) {
    if (!S._pinToNode) return null;
    if (pr.wireIdx !== null && pr.wireIdx >= 0 && S.wires[pr.wireIdx]) {
      var w = S.wires[pr.wireIdx];
      var k1 = w.x1 + ',' + w.y1, k2 = w.x2 + ',' + w.y2;
      if (S._pinToNode[k1] !== undefined) return S._pinToNode[k1];
      if (S._pinToNode[k2] !== undefined) return S._pinToNode[k2];
    }
    if (pr.partId !== null) {
      var p = null;
      for (var i = 0; i < S.parts.length; i++) if (S.parts[i].id === pr.partId) { p = S.parts[i]; break; }
      if (!p) return null;
      var pins = getPartPins(p);
      if (pr.pinIndex < 0 || pr.pinIndex >= pins.length) return null;
      var pk = pins[pr.pinIndex].x + ',' + pins[pr.pinIndex].y;
      if (S._pinToNode[pk] !== undefined) return S._pinToNode[pk];
    }
    return null;
  }

  function _nodeVoltage(nodeIdx) {
    if (nodeIdx === null || nodeIdx === undefined || nodeIdx < 0) return 0;
    if (!S._nodeVoltages) return 0;
    return S._nodeVoltages[nodeIdx] || 0;
  }

  function _probePart(pr) {
    if (pr.partId === null) return null;
    for (var i = 0; i < S.parts.length; i++) if (S.parts[i].id === pr.partId) return S.parts[i];
    return null;
  }

  function _tickHistory() {
    var probes = [_probes.red, _probes.black];
    for (var i = 0; i < probes.length; i++) {
      var pr = probes[i];
      if (!pr.attached) { pr.vHistory = []; continue; }
      if (!pr.vHistory) pr.vHistory = [];
      var v = _nodeVoltage(_probeNodeIdx(pr));
      pr.vHistory.push(v);
      if (pr.vHistory.length > HIST_CAP) pr.vHistory.shift();
    }
  }

  function _updateHold(vDiff, current) {
    if (_hold === 'live') return;
    if (!(S.sim && S.sim.running)) return;
    if (_holdState.vDiff === null) _holdState.vDiff = vDiff;
    if (_hold === 'max'  && vDiff > _holdState.vDiff) _holdState.vDiff = vDiff;
    if (_hold === 'min'  && vDiff < _holdState.vDiff) _holdState.vDiff = vDiff;
    if (_hold === 'peak' && Math.abs(vDiff) > Math.abs(_holdState.vDiff)) _holdState.vDiff = vDiff;
    if (current !== null) {
      if (_holdState.current === null) _holdState.current = current;
      if (_hold === 'max'  && current > _holdState.current) _holdState.current = current;
      if (_hold === 'min'  && current < _holdState.current) _holdState.current = current;
      if (_hold === 'peak' && Math.abs(current) > Math.abs(_holdState.current)) _holdState.current = current;
    }
  }

  function _resetHold() { _holdState = { vDiff: null, current: null }; }

  function _cycle(arr, cur) { var i = arr.indexOf(cur); return arr[(i + 1) % arr.length]; }

  function _installKeys() {
    if (typeof window === 'undefined') return;
    if (window.__vxa_probeKeysInstalled) return;
    window.__vxa_probeKeysInstalled = true;
    window.addEventListener('keydown', function(e) {
      if (!_probeMode) return;
      var tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key === 'm' || e.key === 'M') {
        _mode = _cycle(MODES, _mode); needsRender = true; e.preventDefault();
      } else if (e.key === 'h' || e.key === 'H') {
        _hold = _cycle(HOLDS, _hold); _resetHold(); needsRender = true; e.preventDefault();
      }
    });
  }
  _installKeys();

  return {
    isActive: function() { return _probeMode; },

    toggle: function() {
      _probeMode = !_probeMode;
      if (!_probeMode) {
        _probes.red.attached = false; _probes.black.attached = false;
        _probes.red.x  = _probes.red.y  = -1;
        _probes.black.x = _probes.black.y = -1;
        _probes.red.wireIdx = _probes.black.wireIdx = null;
        _probes.red.partId  = _probes.black.partId  = null;
        _probes.red.vHistory = _probes.black.vHistory = [];
        _resetHold();
        _activeProbe = null;
      }
      needsRender = true;
    },

    setMode: function(m) { if (MODES.indexOf(m) >= 0) { _mode = m; needsRender = true; } },
    getMode: function() { return _mode; },
    setHold: function(h) { if (HOLDS.indexOf(h) >= 0) { _hold = h; _resetHold(); needsRender = true; } },
    getHold: function() { return _hold; },
    resetHold: _resetHold,

    startDrag: function(probeId) {
      if (!_probeMode) return;
      _activeProbe = probeId;
    },

    isDragging: function() { return _activeProbe !== null; },

    onDrag: function(wx, wy) {
      if (!_activeProbe) return;
      _probes[_activeProbe].x = wx;
      _probes[_activeProbe].y = wy;
      _probes[_activeProbe].attached = false;
      needsRender = true;
    },

    onDrop: function(wx, wy) {
      if (!_activeProbe) return;
      var pr = _probes[_activeProbe];
      // Sprint 79: pick whichever target (pin or wire) is physically
      // closer. Pins take priority only on a tie — otherwise dropping
      // on the middle of a long wire that happens to be within 25 px
      // of a pin would always snap to the pin, which is not what the
      // user is pointing at.
      var pin  = findPinNear(wx, wy, 25);
      var wire = findWireNear(wx, wy, 20);
      var pickPin = false, pickWire = false;
      if (pin && wire) {
        // Prefer wire when strictly closer; pins win on equality so
        // endpoint clicks still snap to the pin.
        if (wire.dist < pin.dist - 0.5) pickWire = true;
        else                            pickPin  = true;
      } else if (pin)  { pickPin  = true; }
      else if (wire)   { pickWire = true; }

      if (pickPin) {
        pr.x = pin.x; pr.y = pin.y;
        pr.attached = true;
        pr.partId   = pin.partId;
        pr.pinIndex = pin.pinIndex;
        pr.wireIdx  = null;
        pr.vHistory = [];
        if (VXA.SpatialAudio) VXA.SpatialAudio.playAt('click', pin.x, pin.y);
      } else if (pickWire) {
        pr.x = wire.x; pr.y = wire.y;
        pr.attached = true;
        pr.partId   = null;
        pr.pinIndex = -1;
        pr.wireIdx  = wire.wireIdx;
        pr.vHistory = [];
        if (VXA.SpatialAudio) VXA.SpatialAudio.playAt('click', wire.x, wire.y);
      } else {
        pr.attached = false;
        pr.x = -1; pr.y = -1;
        pr.wireIdx = null; pr.partId = null;
      }
      _activeProbe = null;
      _resetHold();
      needsRender = true;
    },

    hitTest: function(wx, wy) {
      if (!_probeMode) return null;
      var ids = ['red', 'black'];
      for (var i = 0; i < ids.length; i++) {
        var pr = _probes[ids[i]];
        if (pr.x < 0 && pr.y < 0) continue;
        var dx = wx - pr.x, dy = wy - pr.y;
        if (Math.sqrt(dx * dx + dy * dy) < 15) return ids[i];
      }
      return null;
    },

    // Primary measurement API. Signed ΔV, current (through same part OR
    // through wire if probed there), plus AC RMS when the probe history
    // indicates the node is oscillating.
    getMeasurement: function() {
      if (!_probes.red.attached || !_probes.black.attached) return null;

      var nR = _probeNodeIdx(_probes.red);
      var nB = _probeNodeIdx(_probes.black);
      var vR = _nodeVoltage(nR), vB = _nodeVoltage(nB);
      var vDiff = vR - vB;

      // Build ΔV history for RMS.
      var vDiffHistory = null;
      var hR = _probes.red.vHistory, hB = _probes.black.vHistory;
      if (hR && hB && hR.length === hB.length && hR.length > 10) {
        vDiffHistory = new Array(hR.length);
        for (var h = 0; h < hR.length; h++) vDiffHistory[h] = hR[h] - hB[h];
      }
      var vDiffIsAC = vDiffHistory ? _isACSafe(vDiffHistory) : false;
      var vDiffRMS  = vDiffIsAC ? _rmsSafe(vDiffHistory) : null;

      // Current — only meaningful when both probes share a part, or
      // when the red probe is on a wire (wire._current is signed in
      // the wire's native direction).
      var current = null, currentRMS = null, currentIsAC = false, power = null;
      if (_probes.red.partId !== null && _probes.red.partId === _probes.black.partId) {
        var p = _probePart(_probes.red);
        if (p) {
          current = p._i || 0;
          if (_isACSafe(p._iHistory)) { currentRMS = _rmsSafe(p._iHistory); currentIsAC = true; }
          power = Math.abs(vDiff * current);
        }
      } else if (_probes.red.wireIdx !== null && _probes.red.wireIdx >= 0 && S.wires) {
        var w = S.wires[_probes.red.wireIdx];
        if (w) current = w._current || 0;
      }

      _updateHold(vDiff, current);

      // Resistance (mode 'R') — only makes sense on a single part with
      // non-zero current. Uses signed ΔV / signed I. Returns null if
      // the probes aren't configured for a meaningful reading.
      var resistance = null;
      if (_mode === 'R' && current !== null && Math.abs(current) > 1e-9) {
        resistance = vDiff / current;
      }

      // dB ratio — 20·log10(|V_red| / |V_black|). Requires non-zero
      // reference. RMS pair is used when both probes see AC.
      var dB = null;
      if (_mode === 'dB' && Math.abs(vB) > 1e-9) {
        var vRref = Math.abs(vR), vBref = Math.abs(vB);
        if (vDiffIsAC && hR && hB && hR.length > 10) {
          vRref = _rmsSafe(hR); vBref = _rmsSafe(hB);
        }
        if (vBref > 1e-12 && vRref > 1e-12) dB = 20 * Math.log10(vRref / vBref);
      }

      return {
        voltage: vDiff, vDiffRMS: vDiffRMS, vDiffIsAC: vDiffIsAC,
        vRed: vR, vBlack: vB,
        current: current, currentRMS: currentRMS, currentIsAC: currentIsAC,
        power: power,
        resistance: resistance,
        dB: dB,
        mode: _mode, hold: _hold,
        holdVDiff: _holdState.vDiff, holdCurrent: _holdState.current,
        redOnWire:   _probes.red.wireIdx   !== null,
        blackOnWire: _probes.black.wireIdx !== null
      };
    },

    draw: function(ctx) {
      if (!_probeMode) return;

      _tickHistory();

      var ids = ['red', 'black'];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var pr = _probes[id];
        if (pr.x < 0 && pr.y < 0 && !_activeProbe) continue;

        ctx.save();
        var radius = pr.attached ? 6 : 4;

        if (pr.attached) {
          var pulse = 0.25 + Math.sin(Date.now() / 300) * 0.15;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, pr.wireIdx !== null ? 14 : 12, 0, Math.PI * 2);
          ctx.fillStyle = id === 'red'
            ? 'rgba(255, 50, 50, ' + pulse + ')'
            : 'rgba(100, 100, 100, ' + pulse + ')';
          ctx.fill();
          // Extra ring when attached to a wire (visual distinction)
          if (pr.wireIdx !== null) {
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = id === 'red' ? 'rgba(255,80,80,0.8)' : 'rgba(180,180,180,0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        ctx.beginPath();
        ctx.arc(pr.x, pr.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = pr.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pr.label, pr.x, pr.y);

        ctx.restore();
      }

      // Measurement tooltip
      var m = this.getMeasurement();
      if (!m) return;

      var px = (_probes.red.x + _probes.black.x) / 2;
      var py = Math.min(_probes.red.y, _probes.black.y) - 45;

      var lines = [];
      // Header — mode + hold
      var header = '[' + m.mode.toUpperCase() + (m.hold !== 'live' ? ' · ' + m.hold.toUpperCase() : '') + ']';
      lines.push(header);

      // Voltage — live or held
      if (m.mode !== 'I' && m.mode !== 'R') {
        var vShown = (m.hold !== 'live' && m.holdVDiff !== null) ? m.holdVDiff : m.voltage;
        var vLbl;
        if (m.vDiffIsAC && m.hold === 'live') {
          vLbl = '\u0394V (RMS) = ' + fmtEng(m.vDiffRMS) + 'V';
        } else if (m.hold !== 'live') {
          vLbl = '\u0394V (' + m.hold + ') = ' + fmtEng(vShown) + 'V';
        } else {
          vLbl = '\u0394V = ' + fmtEng(vShown) + 'V';
        }
        lines.push(vLbl);
      }

      // Current
      if ((m.mode === 'auto' || m.mode === 'I') && m.current !== null) {
        var iShown = (m.hold !== 'live' && m.holdCurrent !== null) ? m.holdCurrent : m.current;
        var iLbl;
        if (m.currentIsAC && m.hold === 'live') {
          iLbl = 'I (RMS) = ' + fmtEng(m.currentRMS) + 'A';
        } else if (m.hold !== 'live') {
          iLbl = 'I (' + m.hold + ') = ' + fmtEng(iShown) + 'A';
        } else {
          iLbl = 'I = ' + fmtEng(iShown) + 'A';
        }
        lines.push(iLbl);
      }

      if (m.mode === 'auto' && m.power !== null) {
        lines.push('P = ' + fmtEng(m.power) + 'W');
      }
      if (m.mode === 'R') {
        lines.push(m.resistance !== null
          ? 'R = ' + fmtEng(m.resistance) + '\u03a9'
          : 'R = — (both probes on one part w/ I ≠ 0)');
      }
      if (m.mode === 'dB') {
        lines.push(m.dB !== null
          ? '20·log\u2081\u2080(V\u208a/V\u208b) = ' + m.dB.toFixed(2) + ' dB'
          : 'dB = — (V\u208b ≈ 0)');
      }

      // Hint footer
      lines.push('[m] mode · [h] hold');

      var lineH = 14, pad = 6;
      var bW = 170, bH = pad * 2 + lines.length * lineH;
      var bx = px - bW / 2, by = py - bH;

      ctx.save();
      ctx.fillStyle   = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
      ctx.lineWidth   = 1;
      _roundRect(ctx, bx, by, bW, bH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var li = 0; li < lines.length; li++) {
        // Color: header in blue, hint in grey, rest in green
        if (li === 0)                    ctx.fillStyle = '#4a9eff';
        else if (li === lines.length - 1) ctx.fillStyle = '#5a6a7a';
        else                              ctx.fillStyle = '#00ff41';
        ctx.fillText(lines[li], px, by + pad + li * lineH + lineH / 2);
      }
      ctx.restore();
    },

    getState: function() {
      return {
        probes: _probes, mode: _probeMode, active: _activeProbe,
        measureMode: _mode, hold: _hold
      };
    }
  };
})();

// ===== SHARED HELPER =====
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Global toggle for probe mode (toolbar)
function toggleProbeMode() {
  if (VXA.Probes) VXA.Probes.toggle();
  var btn = document.getElementById('btn-probes');
  if (btn) btn.classList.toggle('active', VXA.Probes && VXA.Probes.isActive());
}
