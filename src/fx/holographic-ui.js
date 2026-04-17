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

  // Position: right of component. Sprint 70h: diode / LED / zener
  // pins extend only ±30 px (vs ±40 for resistor/cap/inductor), so a
  // +35 tooltip offset leaves the formula box overlapping the glyph.
  // Bump the offset for narrow-pin parts.
  var narrowPin = (part.type === 'diode' || part.type === 'led' || part.type === 'zener');
  var bx = part.x + (narrowPin ? 55 : 35);
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

VXA.Probes = (function() {
  'use strict';

  var _probes = {
    red:   { x: -1, y: -1, attached: false, partId: null, pinIndex: -1, color: '#ff3333', label: '+' },
    black: { x: -1, y: -1, attached: false, partId: null, pinIndex: -1, color: '#444444', label: '\u2212' }
  };

  var _activeProbe = null;
  var _probeMode = false;

  function findPinNear(wx, wy, maxDist) {
    var best = null, bestD = maxDist || 25;
    for (var i = 0; i < S.parts.length; i++) {
      var p = S.parts[i];
      var pins = getPartPins(p);
      for (var pi = 0; pi < pins.length; pi++) {
        var dx = wx - pins[pi].x, dy = wy - pins[pi].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) { bestD = d; best = { partId: p.id, pinIndex: pi, x: pins[pi].x, y: pins[pi].y, dist: d }; }
      }
    }
    return best;
  }

  return {
    isActive: function() { return _probeMode; },

    toggle: function() {
      _probeMode = !_probeMode;
      if (!_probeMode) {
        _probes.red.attached = false; _probes.black.attached = false;
        _probes.red.x = _probes.red.y = -1;
        _probes.black.x = _probes.black.y = -1;
        _activeProbe = null;
      }
      needsRender = true;
    },

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
      var pin = findPinNear(wx, wy, 25);
      if (pin) {
        _probes[_activeProbe].x = pin.x;
        _probes[_activeProbe].y = pin.y;
        _probes[_activeProbe].attached = true;
        _probes[_activeProbe].partId = pin.partId;
        _probes[_activeProbe].pinIndex = pin.pinIndex;
        if (VXA.SpatialAudio) VXA.SpatialAudio.playAt('click', pin.x, pin.y);
      } else {
        _probes[_activeProbe].attached = false;
        _probes[_activeProbe].x = -1;
        _probes[_activeProbe].y = -1;
      }
      _activeProbe = null;
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
      // If no probe placed, check if near toolbar area — start from mouse pos
      return null;
    },

    getMeasurement: function() {
      if (!_probes.red.attached || !_probes.black.attached) return null;
      var rPart = null, bPart = null;
      for (var i = 0; i < S.parts.length; i++) {
        if (S.parts[i].id === _probes.red.partId) rPart = S.parts[i];
        if (S.parts[i].id === _probes.black.partId) bPart = S.parts[i];
      }
      if (!rPart || !bPart) return null;

      // Get pin voltages from node voltages if available
      var vRed = rPart._v || 0;
      var vBlack = bPart._v || 0;
      var vDiff = vRed - vBlack;
      var current = null, power = null;
      if (_probes.red.partId === _probes.black.partId) {
        current = Math.abs(rPart._i || 0);
        power = Math.abs(vDiff * current);
      }
      return { voltage: vDiff, vRed: vRed, vBlack: vBlack, current: current, power: power };
    },

    draw: function(ctx) {
      if (!_probeMode) return;
      var ids = ['red', 'black'];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var pr = _probes[id];
        if (pr.x < 0 && pr.y < 0 && !_activeProbe) continue;

        ctx.save();
        var radius = pr.attached ? 6 : 4;

        // Pulsing glow if attached
        if (pr.attached) {
          var pulse = 0.25 + Math.sin(Date.now() / 300) * 0.15;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 12, 0, Math.PI * 2);
          ctx.fillStyle = id === 'red' ? 'rgba(255, 50, 50, ' + pulse + ')' : 'rgba(100, 100, 100, ' + pulse + ')';
          ctx.fill();
        }

        // Probe tip
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = pr.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pr.label, pr.x, pr.y);

        ctx.restore();
      }

      // Measurement tooltip
      var m = this.getMeasurement();
      if (m) {
        var px = (_probes.red.x + _probes.black.x) / 2;
        var py = Math.min(_probes.red.y, _probes.black.y) - 45;

        var lines = ['\u0394V = ' + fmtEng(m.voltage) + 'V'];
        if (m.current !== null) lines.push('I = ' + fmtEng(m.current) + 'A');
        if (m.power !== null) lines.push('P = ' + fmtEng(m.power) + 'W');

        var lineH = 16, pad = 8;
        var bW = 140, bH = pad * 2 + lines.length * lineH;
        var bx = px - bW / 2, by = py - bH;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
        ctx.lineWidth = 1;
        _roundRect(ctx, bx, by, bW, bH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00ff41';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (var li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], px, by + pad + li * lineH + lineH / 2);
        }
        ctx.restore();
      }
    },

    getState: function() { return { probes: _probes, mode: _probeMode, active: _activeProbe }; }
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
