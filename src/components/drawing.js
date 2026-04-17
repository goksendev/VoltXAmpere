// ──────── DRAWING FUNCTIONS ────────

// Sprint 70b/e: current-aware visual feedback with log-scale palette
// and adaptive brightness. A flat linear ramp washed everything into
// red on 1 A circuits and made 10 µA circuits look dead; a log scale
// preserves engineering-decade distinctions (µA / mA / A / kA). Per-
// circuit brightness modulation then keeps every part visible —
// highest-current branch at 100 %, lowest at 60 % — so a mint circuit
// still shows a gradient without losing the "this is small-signal"
// cue from the base colour.
var _CUR_IDLE = 10e-6;  // below this: treat as idle
var _circuitMaxI = 0;   // refreshed once per frame from render-loop
function _logCurColor(absI) {
  if (absI < 10e-6)    return '#3a4a5a'; // idle grey
  if (absI < 1e-3)     return '#00bfa5'; // 10 µA – 1 mA: small-signal teal
  if (absI < 100e-3)   return '#00e09e'; // 1 mA – 100 mA: analog/digital mint
  if (absI < 1)        return '#f59e0b'; // 100 mA – 1 A: power orange
  if (absI < 5)        return '#ff3333'; // 1 A – 5 A: high-current red
  return '#c41e3a';                      // >5 A: danger dark-red
}
function _applyBrightness(hex, bright) {
  if (bright >= 1) return hex;
  var n = parseInt(hex.slice(1), 16);
  var r = Math.round(Math.min(255, ((n >> 16) & 0xff) * bright));
  var g = Math.round(Math.min(255, ((n >> 8) & 0xff) * bright));
  var b = Math.round(Math.min(255, (n & 0xff) * bright));
  var out = (r << 16) | (g << 8) | b;
  return '#' + out.toString(16).padStart(6, '0');
}
function _updateCircuitMaxI() {
  if (!S.sim || !S.sim.running) { _circuitMaxI = 0; return; }
  var m = 0;
  for (var i = 0; i < S.parts.length; i++) {
    var c = Math.abs(S.parts[i]._i || 0);
    if (c > m) m = c;
  }
  for (var j = 0; j < S.wires.length; j++) {
    var wc = Math.abs(S.wires[j]._current || 0);
    if (wc > m) m = wc;
  }
  _circuitMaxI = m;
}
function _curColor(cur, fallback) {
  if (!S.sim || !S.sim.running) return fallback;
  var a = Math.abs(cur || 0);
  if (a < _CUR_IDLE) return fallback;
  var base = _logCurColor(a);
  var bright = _circuitMaxI > 0 ? (0.6 + 0.4 * Math.min(1, a / _circuitMaxI)) : 1;
  return _applyBrightness(base, bright);
}

// Match Sprint 70a-fix-5's _segTouchesPoint: an interior pin-coord on
// a segmented bus is electrically on the wire. Used to gather the
// current flowing into a ground symbol's pin.
function _wireTouchesPoint(w, px, py) {
  if (Math.abs(w.x1 - px) <= 1 && Math.abs(w.y1 - py) <= 1) return true;
  if (Math.abs(w.x2 - px) <= 1 && Math.abs(w.y2 - py) <= 1) return true;
  if (w.x1 === w.x2 && px === w.x1) {
    var miY = Math.min(w.y1, w.y2), maY = Math.max(w.y1, w.y2);
    if (py > miY + 1 && py < maY - 1) return true;
  } else if (w.y1 === w.y2 && py === w.y1) {
    var miX = Math.min(w.x1, w.x2), maX = Math.max(w.x1, w.x2);
    if (px > miX + 1 && px < maX - 1) return true;
  }
  return false;
}
function _groundPinCurrent(part) {
  // Ground's sole pin is at dy=-20 relative to centre (rot=0 assumed —
  // the canonical import never rotates ground). Transform for safety.
  var r = (part.rot || 0) * Math.PI / 2, co = Math.cos(r), si = Math.sin(r);
  var pinX = part.x + 0 * co - (-20) * si;
  var pinY = part.y + 0 * si + (-20) * co;
  var maxCur = 0;
  for (var i = 0; i < S.wires.length; i++) {
    var w = S.wires[i];
    if (_wireTouchesPoint(w, pinX, pinY)) {
      var c = Math.abs(w._current || 0);
      if (c > maxCur) maxCur = c;
    }
  }
  return maxCur;
}

var _SOURCE_TYPES = { vdc:1, vac:1, pulse:1, pwl:1, idc:1, iac:1, noise:1 };
var _PASSIVE_TYPES = { resistor:1, capacitor:1, inductor:1 };

function getDetailLevel() {
  if (S.view.zoom < 0.3) return 'overview';
  if (S.view.zoom < 0.7) return 'medium';
  if (S.view.zoom < 2.0) return 'normal';
  if (S.view.zoom < 5.0) return 'detail';
  return 'microscope';
}

var BAND_COLORS = {
  0:'#000000',1:'#8B4513',2:'#FF0000',3:'#FF8800',4:'#FFD700',
  5:'#008000',6:'#0000FF',7:'#800080',8:'#808080',9:'#FFFFFF'
};
var TOLERANCE_COLORS = {1:'#8B4513',2:'#FF0000',5:'#CFB53B',10:'#C0C0C0',20:null};

function getColorBands(resistance) {
  if (resistance <= 0) return [];
  var exp = Math.floor(Math.log10(resistance));
  var sig = Math.round(resistance / Math.pow(10, exp - 1));
  if (sig >= 100) { sig = Math.round(sig / 10); exp++; }
  var d1 = Math.floor(sig / 10);
  var d2 = sig % 10;
  var multiplier = exp - 1;
  return [
    BAND_COLORS[d1],
    BAND_COLORS[d2],
    BAND_COLORS[Math.max(0, Math.min(9, multiplier))]
  ];
}

function drawColorBands(c, part) {
  var R = part.val || 1000;
  var bands = getColorBands(R);
  var tol = TOLERANCE_COLORS[part.tolerance || 5];
  if (tol) bands.push(tol);
  c.save();
  bands.forEach(function(color, i) {
    if (!color) return;
    c.fillStyle = color;
    c.fillRect(-13 + i * 7, -6, 5, 12);
    // thin dark outline for white/yellow bands
    if (color === '#FFFFFF' || color === '#FFD700') {
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.5;
      c.strokeRect(-13 + i * 7, -6, 5, 12);
    }
  });
  c.restore();
}

function drawPinNames(c, part) {
  var def = COMP[part.type]; if (!def || !def.pinNames) return;
  var pins = def.pins;
  c.save();
  c.font = '7px "JetBrains Mono"'; c.fillStyle = '#8899aa'; c.textBaseline = 'middle';
  def.pinNames.forEach(function(name, i) {
    if (!pins[i]) return;
    var px = pins[i].dx, py = pins[i].dy;
    c.textAlign = px < 0 ? 'right' : px > 0 ? 'left' : 'center';
    var ox = px < 0 ? -5 : px > 0 ? 5 : 0;
    var oy = py < 0 ? -5 : py > 0 ? 5 : 0;
    c.fillText(name, px + ox, py + oy);
  });
  c.restore();
}

function drawBackground(c, w, h) {
  var z = S.view.zoom, g = GRID * z;
  switch (S.bgStyle) {
    case 'techGrid':
      c.fillStyle = '#06080c'; c.fillRect(0, 0, w, h);
      if (g < 4) return;
      var ox = ((S.view.ox % g) + g) % g, oy = ((S.view.oy % g) + g) % g;
      c.fillStyle = 'rgba(0,212,255,0.05)';
      for (var x = ox; x < w; x += g) for (var y = oy; y < h; y += g) {
        c.beginPath(); c.arc(x, y, 0.7, 0, Math.PI * 2); c.fill();
      }
      if (g > 15) {
        var mg = g * 5;
        var mox = ((S.view.ox % mg) + mg) % mg, moy = ((S.view.oy % mg) + mg) % mg;
        c.fillStyle = 'rgba(0,212,255,0.10)';
        for (var x2 = mox; x2 < w; x2 += mg) for (var y2 = moy; y2 < h; y2 += mg) {
          c.beginPath(); c.arc(x2, y2, 1.2, 0, Math.PI * 2); c.fill();
        }
      }
      break;

    case 'engPaper':
      c.fillStyle = '#f5f0e0'; c.fillRect(0, 0, w, h);
      if (g < 4) return;
      var ox = ((S.view.ox % g) + g) % g, oy = ((S.view.oy % g) + g) % g;
      c.strokeStyle = 'rgba(80,120,200,0.12)'; c.lineWidth = 0.5;
      c.beginPath();
      for (var x = ox; x < w; x += g) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (var y = oy; y < h; y += g) { c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
      if (g > 15) {
        var mg = g * 5;
        var mox = ((S.view.ox % mg) + mg) % mg, moy = ((S.view.oy % mg) + mg) % mg;
        c.strokeStyle = 'rgba(80,120,200,0.25)'; c.lineWidth = 1;
        c.beginPath();
        for (var x2 = mox; x2 < w; x2 += mg) { c.moveTo(x2, 0); c.lineTo(x2, h); }
        for (var y2 = moy; y2 < h; y2 += mg) { c.moveTo(0, y2); c.lineTo(w, y2); }
        c.stroke();
      }
      break;

    case 'blueprint':
      c.fillStyle = '#1a2744'; c.fillRect(0, 0, w, h);
      if (g < 4) return;
      var ox = ((S.view.ox % g) + g) % g, oy = ((S.view.oy % g) + g) % g;
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.5;
      c.beginPath();
      for (var x = ox; x < w; x += g) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (var y = oy; y < h; y += g) { c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
      if (g > 15) {
        var mg = g * 5;
        var mox = ((S.view.ox % mg) + mg) % mg, moy = ((S.view.oy % mg) + mg) % mg;
        c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
        c.beginPath();
        for (var x2 = mox; x2 < w; x2 += mg) { c.moveTo(x2, 0); c.lineTo(x2, h); }
        for (var y2 = moy; y2 < h; y2 += mg) { c.moveTo(0, y2); c.lineTo(w, y2); }
        c.stroke();
      }
      break;

    case 'oscBg':
      c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
      if (g < 4) return;
      var ox = ((S.view.ox % g) + g) % g, oy = ((S.view.oy % g) + g) % g;
      c.strokeStyle = 'rgba(0,255,0,0.06)'; c.lineWidth = 0.5;
      c.beginPath();
      for (var x = ox; x < w; x += g) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (var y = oy; y < h; y += g) { c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
      if (g > 15) {
        var mg = g * 5;
        var mox = ((S.view.ox % mg) + mg) % mg, moy = ((S.view.oy % mg) + mg) % mg;
        c.strokeStyle = 'rgba(0,255,0,0.12)'; c.lineWidth = 1;
        c.beginPath();
        for (var x2 = mox; x2 < w; x2 += mg) { c.moveTo(x2, 0); c.lineTo(x2, h); }
        for (var y2 = moy; y2 < h; y2 += mg) { c.moveTo(0, y2); c.lineTo(w, y2); }
        c.stroke();
      }
      break;

    case 'whiteBg':
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      if (g < 4) return;
      var ox = ((S.view.ox % g) + g) % g, oy = ((S.view.oy % g) + g) % g;
      c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 0.5;
      c.beginPath();
      for (var x = ox; x < w; x += g) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (var y = oy; y < h; y += g) { c.moveTo(0, y); c.lineTo(w, y); }
      c.stroke();
      if (g > 15) {
        var mg = g * 5;
        var mox = ((S.view.ox % mg) + mg) % mg, moy = ((S.view.oy % mg) + mg) % mg;
        c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
        c.beginPath();
        for (var x2 = mox; x2 < w; x2 += mg) { c.moveTo(x2, 0); c.lineTo(x2, h); }
        for (var y2 = moy; y2 < h; y2 += mg) { c.moveTo(0, y2); c.lineTo(w, y2); }
        c.stroke();
      }
      break;

    default:
      c.fillStyle = '#06080c'; c.fillRect(0, 0, w, h);
  }
}

function drawGrid() {
  var w = cvs.width / DPR, h = cvs.height / DPR;
  drawBackground(ctx, w, h);
}

function drawPart(part) {
  const def = COMP[part.type]; if (!def) return;
  const rot = (part.rot || 0) * Math.PI / 2;
  const detail = getDetailLevel();

  // overview: simplified rectangle
  if (detail === 'overview') {
    ctx.fillStyle = (part.damaged ? '#f0454a' : def.color) + '44';
    ctx.strokeStyle = part.damaged ? '#f0454a' : def.color; ctx.lineWidth = 1;
    ctx.fillRect(part.x - 16, part.y - 10, 32, 20);
    ctx.strokeRect(part.x - 16, part.y - 10, 32, 20);
    return;
  }

  // Thermal shake effect (85°C+)
  var thermalShakeX = 0, thermalShakeY = 0;
  var th = part._thermal;
  if (th && th.T > 85 && !part.damaged) {
    var shakeIntensity = Math.min(1, (th.T - 85) / 70);
    thermalShakeX = (Math.random() - 0.5) * shakeIntensity * 1.5;
    thermalShakeY = (Math.random() - 0.5) * shakeIntensity * 1.5;
  }

  ctx.save(); ctx.translate(part.x + thermalShakeX, part.y + thermalShakeY); ctx.rotate(rot);

  // Sprint 14: Capacitor breathing effect
  var _capBreath = (typeof getCapacitorBreathing === 'function') ? getCapacitorBreathing(part) : null;
  if (_capBreath) {
    ctx.scale(_capBreath.scale, _capBreath.scale);
  }

  // Damaged parts: draw in grey
  if (part.damaged && !part._explodeAnim?.active && !part._burnAnim?.active) {
    ctx.globalAlpha = 0.6;
  }

  if (S.sel.includes(part.id)) {
    var _pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
    ctx.shadowColor = 'rgba(136,204,255,' + _pulse + ')';
    ctx.shadowBlur = 18 * _pulse;
    ctx.lineWidth = (ctx.lineWidth || 2) + 1;
  }

  // Sprint 70b — live current → body colour override. Mutate def.color
  // only for the draw call, then restore. Ground reads current from
  // wires touching its pin (it has no _i itself); passives read part._i.
  var _origDefColor = def.color;
  var _overrode = false;
  if (S.sim && S.sim.running) {
    if (part.type === 'ground') {
      var gc = _groundPinCurrent(part);
      if (gc >= _CUR_IDLE) { def.color = _curColor(gc, _origDefColor); _overrode = true; }
    } else if (_PASSIVE_TYPES[part.type]) {
      var pc = Math.abs(part._i || 0);
      if (pc >= _CUR_IDLE) { def.color = _curColor(pc, _origDefColor); _overrode = true; }
    }
  }

  def.draw(ctx, GRID, part);

  if (_overrode) def.color = _origDefColor;

  // Sprint 82: core-saturation halo. Only inductors set part._saturated,
  // and only when the user configured a finite Isat for that part. The
  // halo breathes at ~2 Hz; amber for 0.7×Isat < |I| ≤ Isat, red once
  // we're above the knee.
  if (part.type === 'inductor' && part._saturated && S.sim && S.sim.running) {
    var _abs = Math.abs(part._i || 0);
    var _knee = isFinite(part.Isat) && part.Isat > 0 ? part.Isat : _abs;
    var _hot  = _abs >= _knee;
    var _sp = 0.5 + 0.5 * Math.sin(Date.now() / 160);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.strokeStyle = _hot
      ? 'rgba(255, 80, 80, ' + (0.45 + 0.35 * _sp) + ')'
      : 'rgba(245, 200, 50, ' + (0.35 + 0.25 * _sp) + ')';
    ctx.lineWidth = _hot ? 3 : 2;
    ctx.shadowColor = _hot ? 'rgba(255,80,80,0.6)' : 'rgba(245,200,50,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  // Sprint 70b — active source pulse ring. Signals "this source is
  // delivering energy" without bleeding into the schematic symbol.
  // Gentle 1.5 Hz breathing at ~radius 24, matched to the source's
  // brand colour. Only when the simulator is running AND the source
  // is actually sourcing current.
  if (S.sim && S.sim.running && _SOURCE_TYPES[part.type]) {
    var srcCurRaw = part._i || 0;
    var srcVRaw = part._v || 0;
    var srcCur = Math.abs(srcCurRaw);
    if (srcCur >= _CUR_IDLE) {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      // Sprint 70d: the warning ring fires when POWER is flowing back
      // into the source (V·I < 0). Sign of current alone isn't enough —
      // a reverse-polarity battery has negative V and negative I, but
      // still delivers (positive P). The P<0 test is polarity-agnostic.
      var ringSinking = (srcVRaw * srcCurRaw) < -1e-9;
      var alpha = ringSinking
        ? 0.30 + 0.15 * Math.sin(now * 2 * Math.PI * 2.5)
        : 0.18 + 0.12 * Math.sin(now * 2 * Math.PI * 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ringSinking ? '#ff3333' : _origDefColor;
      ctx.lineWidth = ringSinking ? 4 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

  // Damage crack marks (permanent, after animation ends)
  if (part.damaged && !part._explodeAnim?.active && !part._burnAnim?.active) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f0454a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -10); ctx.lineTo(2, 0); ctx.lineTo(-4, 10);
    ctx.stroke();
    // X mark
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
  }

  // Burn animation (resistor, etc.)
  if (part._burnAnim && part._burnAnim.active) {
    var elapsed = performance.now() - part._burnAnim.startTime;
    var progress = Math.min(1, elapsed / part._burnAnim.duration);
    // Darken overlay
    ctx.fillStyle = 'rgba(30,20,10,' + (progress * 0.7) + ')';
    ctx.fillRect(-22, -10, 44, 20);
    // Spawn smoke/embers periodically
    if (!part._burnAnim.particlesSpawned && elapsed > 200) {
      VXA.Particles.explode(part.x, part.y, 'resistor', def.color);
      part._burnAnim.particlesSpawned = true;
    }
    if (elapsed >= part._burnAnim.duration) {
      part._burnAnim.active = false;
    }
  }

  // Color bands for resistors at detail/microscope zoom
  if (part.type === 'resistor' && !part.damaged && (detail === 'detail' || detail === 'microscope')) {
    drawColorBands(ctx, part);
  }

  // Pin names at detail/microscope zoom
  if (detail === 'detail' || detail === 'microscope') {
    drawPinNames(ctx, part);
  }

  ctx.restore();

  // Thermal color overlay (warm/hot/critical)
  if (th && th.T > 40 && !part.damaged) {
    var overlayColor, overlayAlpha;
    if (th.T < 60)       { overlayColor = '255,200,0';   overlayAlpha = 0.08; }
    else if (th.T < 85)  { overlayColor = '255,150,0';   overlayAlpha = 0.15; }
    else if (th.T < 120) { overlayColor = '255,80,0';    overlayAlpha = 0.25; }
    else                  { overlayColor = '255,40,40';   overlayAlpha = 0.35; }
    ctx.save();
    ctx.translate(part.x + thermalShakeX, part.y + thermalShakeY);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(' + overlayColor + ',' + overlayAlpha + ')';
    ctx.fillRect(-22, -12, 44, 24);
    ctx.restore();
  }

  // Temperature badge (normal+ zoom, T > 40°C)
  if (th && th.T > 40 && detail !== 'overview' && detail !== 'medium') {
    var tempColor = th.T < 60 ? '#22c55e' : th.T < 85 ? '#eab308' : th.T < 120 ? '#f59e0b' : '#f0454a';
    ctx.font = 'bold 8px "JetBrains Mono"';
    ctx.fillStyle = tempColor;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(th.T) + '\u00B0C', part.x + 22, part.y - 14);
  }

  // Smoke particles for critical temperature (120°C+)
  if (th && th.T > 120 && !part.damaged && S.sim.running && Math.random() < 0.15) {
    VXA.Particles.spawn(part.x, part.y - 10, 'smoke', 'rgba(80,80,80,0.3)', 1);
  }

  // LED explosion animation (5 phases)
  if (part._explodeAnim && part._explodeAnim.active && part.type === 'led') {
    var elapsed = performance.now() - part._explodeAnim.startTime;
    ctx.save(); ctx.translate(part.x, part.y);
    if (elapsed < 100) {
      // Phase 1: Glow intensifies
      var t = elapsed / 100;
      var glowR = 8 + t * 22;
      ctx.shadowColor = '#eab308'; ctx.shadowBlur = 25 * t;
      ctx.fillStyle = 'rgba(234,179,8,' + (0.5 + t * 0.5) + ')';
      ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
    } else if (elapsed < 200) {
      // Phase 2: White out
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
    } else if (elapsed < 280) {
      // Phase 3: Crack flash — particles spawned once
      if (!part._explodeAnim.particlesSpawned) {
        VXA.Particles.explode(part.x, part.y, 'led', '#eab308');
        part._explodeAnim.particlesSpawned = true;
      }
      var flashAlpha = 1 - (elapsed - 200) / 80;
      ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    } else if (elapsed < 500) {
      // Phase 4: Fade to dark
      var fadeT = (elapsed - 280) / 220;
      var glowR = 30 * (1 - fadeT);
      ctx.fillStyle = 'rgba(100,80,0,' + ((1 - fadeT) * 0.3) + ')';
      ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
    } else {
      // Phase 5: Done
      part._explodeAnim.active = false;
    }
    ctx.shadowBlur = 0; ctx.restore();
  }

  // Capacitor explosion animation
  if (part._explodeAnim && part._explodeAnim.active && part.type === 'capacitor') {
    var elapsed = performance.now() - part._explodeAnim.startTime;
    ctx.save(); ctx.translate(part.x, part.y);
    if (elapsed < 200) {
      // Phase 1: Swell
      var t = elapsed / 200;
      ctx.fillStyle = 'rgba(200,180,100,' + (t * 0.3) + ')';
      ctx.fillRect(-8, -14 - t * 4, 16, 28 + t * 8);
    } else if (elapsed < 400) {
      // Phase 2: Gas/smoke
      if (Math.random() < 0.3) VXA.Particles.spawn(part.x, part.y - 14, 'smoke', 'rgba(120,120,100,0.4)', 1);
    } else if (elapsed < 500) {
      // Phase 3: Explosion
      if (!part._explodeAnim.particlesSpawned) {
        VXA.Particles.explode(part.x, part.y, 'capacitor', '#888');
        part._explodeAnim.particlesSpawned = true;
      }
      var flashAlpha = 1 - (elapsed - 400) / 100;
      ctx.fillStyle = 'rgba(255,255,200,' + flashAlpha + ')';
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
    } else {
      part._explodeAnim.active = false;
    }
    ctx.shadowBlur = 0; ctx.restore();
  }

  // pins visible at normal+ zoom — unconnected pins shown in red
  if (detail === 'normal' || detail === 'detail' || detail === 'microscope') {
    var pins = getPartPins(part);
    pins.forEach(function(pin) {
      var connected = S.wires.some(function(w) {
        return (Math.abs(w.x1 - pin.x) < 5 && Math.abs(w.y1 - pin.y) < 5) ||
               (Math.abs(w.x2 - pin.x) < 5 && Math.abs(w.y2 - pin.y) < 5);
      });
      ctx.fillStyle = connected ? '#44cc44' : '#ff4444';
      ctx.beginPath(); ctx.arc(pin.x, pin.y, connected ? 3 : 3.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  // LED glow (only when not damaged)
  if (part.type === 'led' && !part.damaged && (part._i || 0) > 0.001) {
    var bri = Math.min(Math.abs(part._i) / 0.02, 1);
    ctx.save();
    // Radial gradient glow — visible even without shadowBlur
    var glowR = 10 + bri * 18;
    var grad = ctx.createRadialGradient(part.x, part.y, 2, part.x, part.y, glowR);
    grad.addColorStop(0, 'rgba(234,179,8,' + (bri * 0.9) + ')');
    grad.addColorStop(0.4, 'rgba(234,179,8,' + (bri * 0.4) + ')');
    grad.addColorStop(1, 'rgba(234,179,8,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(part.x, part.y, glowR, 0, Math.PI * 2); ctx.fill();
    // Shadow layer for extra bloom
    if (bri > 0.3) {
      ctx.shadowColor = '#eab308'; ctx.shadowBlur = 20 * bri;
      ctx.fillStyle = 'rgba(234,179,8,' + (bri * 0.3) + ')';
      ctx.beginPath(); ctx.arc(part.x, part.y, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // value label (not in overview)
  if (def.unit && part.val) {
    ctx.font = '10px "JetBrains Mono"'; ctx.fillStyle = part.damaged ? '#f0454a' : '#5a6a7a'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(fmtVal(part.val, def.unit), part.x, part.y + 24);
  }
  // Net label name display (Sprint 9)
  if (part.type === 'netLabel') {
    ctx.font = 'bold 10px "JetBrains Mono"'; ctx.fillStyle = '#00d4ff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var nlName = typeof part.val === 'string' ? part.val : (part.labelName || 'NET1');
    ctx.fillText(nlName, part.x + 10, part.y);
  }
  // name label (medium+)
  if (detail !== 'medium' && part.type !== 'netLabel' && part.type !== 'vccLabel' && part.type !== 'gndLabel') {
    ctx.font = '9px Outfit'; ctx.fillStyle = part.damaged ? '#f0454a' : '#3a4a5a'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(part.name, part.x, part.y - 24);
  } else if (detail === 'medium' && part.type !== 'netLabel' && part.type !== 'vccLabel' && part.type !== 'gndLabel') {
    // medium: small ID only
    ctx.font = '7px "JetBrains Mono"'; ctx.fillStyle = '#3a4a5a'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(part.name, part.x, part.y - 18);
  }
  // Damage status label
  if (part.damaged && detail !== 'overview') {
    ctx.font = 'bold 8px "JetBrains Mono"'; ctx.fillStyle = '#f0454a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('\u26A0 ' + (part.damageResult === 'open' ? 'OPEN' : 'SHORT'), part.x, part.y + 34);
  }
  // probe indicator
  for (let c = 0; c < 4; c++) {
    if (S.scope.ch[c].src === part.id) {
      ctx.fillStyle = S.scope.ch[c].color;
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('\u25CF' + S.scope.ch[c].label, part.x + 28, part.y - 12);
      break;
    }
  }
}

function drawWire(w) {
  var dist = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  var cur = Math.abs(w._current || 0);
  var style = S.wireStyle || 'catenary';

  // Wire hover/selection override
  var isHovered = (S._hoveredWire === w);
  var isSelected = (S._selectedWire === w);

  // Sprint 70e: unified current-aware colour — log palette + adaptive
  // brightness from _curColor. Idle wires share the same dull grey the
  // rest of the palette falls back to.
  var wireColor;
  if (isSelected || isHovered) {
    wireColor = '#4488ff';
  } else {
    wireColor = _curColor(cur, '#3a4a5a');
  }
  // Vibration / motion effect still triggered by current magnitude,
  // but now against the circuit-wide maximum so it scales with context.
  var wireRatio = _circuitMaxI > 0 ? Math.min(1, cur / _circuitMaxI) : 0;

  ctx.strokeStyle = wireColor;
  if (isSelected || isHovered) { ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 6; ctx.lineWidth = 3; }
  ctx.lineWidth = 2;

  // Sprint 12: Kablo titreşim efekti
  var vibrate = S.sim.running && S.realisticMode && wireRatio > 0.15 && !S.reducedMotion;

  if (vibrate && dist > 10) {
    var now = Date.now();
    var freq = 8 + wireRatio * 30;
    var amp = 0.5 + wireRatio * 3;
    if (wireRatio > 0.9) { freq = 50; amp = 5; }

    // Kablo yönüne dik birim vektör
    var wdx = w.x2 - w.x1, wdy = w.y2 - w.y1;
    var len = Math.sqrt(wdx * wdx + wdy * wdy);
    var nx = -wdy / len, ny = wdx / len;

    var segments = Math.max(5, Math.round(len / 15));

    // Glow efekti (yüksek akım)
    if (wireRatio > 0.8) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ff0000';
      ctx.beginPath();
      for (var gs = 0; gs <= segments; gs++) {
        var gt = gs / segments;
        var gpx = w.x1 + wdx * gt;
        var gpy = w.y1 + wdy * gt;
        var gEnv = Math.sin(gt * Math.PI);
        var gVib = Math.sin(now * freq / 1000 * Math.PI * 2 + gs * 0.8) * amp * gEnv;
        gpx += nx * gVib; gpy += ny * gVib;
        if (gs === 0) ctx.moveTo(gpx, gpy); else ctx.lineTo(gpx, gpy);
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = wireColor;
      ctx.lineWidth = 2;
    }

    // Ana kablo titreşimli çizim
    ctx.beginPath();
    for (var s = 0; s <= segments; s++) {
      var t = s / segments;
      var px, py;
      // Kablo stili bazında pozisyon hesapla
      if (style === 'catenary') {
        var sag2 = Math.min(dist * 0.1, 25);
        var mx2 = (w.x1 + w.x2) / 2, my2 = (w.y1 + w.y2) / 2 + sag2;
        px = (1-t)*(1-t)*w.x1 + 2*(1-t)*t*mx2 + t*t*w.x2;
        py = (1-t)*(1-t)*w.y1 + 2*(1-t)*t*my2 + t*t*w.y2;
      } else {
        px = w.x1 + wdx * t;
        py = w.y1 + wdy * t;
      }
      var envelope = Math.sin(t * Math.PI);
      var vibOffset = Math.sin(now * freq / 1000 * Math.PI * 2 + s * 0.8) * amp * envelope;
      px += nx * vibOffset; py += ny * vibOffset;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    // Normal kablo çizim (titreşimsiz)
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);

    var sag, mx, my;
    switch (style) {
      case 'manhattan':
        var midX = (w.x1 + w.x2) / 2;
        ctx.lineTo(midX, w.y1);
        ctx.lineTo(midX, w.y2);
        ctx.lineTo(w.x2, w.y2);
        break;
      case 'straight':
        ctx.lineTo(w.x2, w.y2);
        break;
      case 'spline':
        var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
        var cx1 = w.x1 + dx * 0.33, cy1 = w.y1;
        var cx2 = w.x2 - dx * 0.33, cy2 = w.y2;
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, w.x2, w.y2);
        break;
      case 'catenary':
      default:
        sag = Math.min(dist * 0.1, 25);
        mx = (w.x1 + w.x2) / 2;
        my = (w.y1 + w.y2) / 2 + sag;
        ctx.quadraticCurveTo(mx, my, w.x2, w.y2);
        break;
    }
    ctx.stroke();
  }

  // Enhanced current flow animation
  if (!S.reducedMotion && S.sim.running && S.animationsOn && cur > 1e-6) {
    var dirSign = (S.currentDirection === 'conventional' ? 1 : -1) * ((w._current || 0) > 0 ? 1 : -1);
    var speed = Math.min(200, 20 + cur * 100);
    var animT = (performance.now() / 1000) * speed;

    // Dot color and size based on current magnitude — warm yellow→orange→red
    var dotColor, dotSize;
    if (cur < 0.001)      { dotColor = 'rgba(255,238,102,0.5)'; dotSize = 1.5; }
    else if (cur < 0.01)  { dotColor = 'rgba(255,204,0,0.8)';   dotSize = 2; }
    else if (cur < 0.1)   { dotColor = '#ffcc00';                dotSize = 2.5; }
    else if (cur < 0.5)   { dotColor = '#ff8800';                dotSize = 3; }
    else if (cur < 1)     { dotColor = '#ff4422';                dotSize = 3.5; }
    else                  { dotColor = '#ff2222';                dotSize = 4; }

    ctx.fillStyle = dotColor;
    ctx.save();
    if (cur > 0.5) { ctx.shadowColor = dotColor; ctx.shadowBlur = 4; }

    var spacing = Math.max(12, 25 - cur * 5);
    var count = Math.max(2, Math.floor(dist / spacing));

    for (var j = 0; j < count; j++) {
      var frac = ((j * spacing + animT * dirSign) % (dist || 1)) / (dist || 1);
      frac = ((frac % 1) + 1) % 1;

      var px, py;
      if (style === 'catenary') {
        if (!sag) { sag = Math.min(dist * 0.1, 25); mx = (w.x1 + w.x2) / 2; my = (w.y1 + w.y2) / 2 + sag; }
        px = (1-frac)*(1-frac)*w.x1 + 2*(1-frac)*frac*mx + frac*frac*w.x2;
        py = (1-frac)*(1-frac)*w.y1 + 2*(1-frac)*frac*my + frac*frac*w.y2;
      } else if (style === 'manhattan') {
        // Approximate along manhattan path
        var midX2 = (w.x1 + w.x2) / 2;
        var seg1 = Math.abs(midX2 - w.x1), seg2 = Math.abs(w.y2 - w.y1), seg3 = Math.abs(w.x2 - midX2);
        var totalLen = seg1 + seg2 + seg3;
        var d = frac * totalLen;
        if (d <= seg1) { px = w.x1 + (midX2 - w.x1) * (d / seg1); py = w.y1; }
        else if (d <= seg1 + seg2) { px = midX2; py = w.y1 + (w.y2 - w.y1) * ((d - seg1) / seg2); }
        else { px = midX2 + (w.x2 - midX2) * ((d - seg1 - seg2) / seg3); py = w.y2; }
      } else {
        // straight/spline: linear interpolation approximation
        px = w.x1 + (w.x2 - w.x1) * frac;
        py = w.y1 + (w.y2 - w.y1) * frac;
      }

      ctx.beginPath(); ctx.arc(px, py, dotSize, 0, Math.PI * 2); ctx.fill();
    }

    // Sprint 70g: direction arrows render at every zoom level and on
    // every wire long enough to host at least one glyph. Arrow size
    // tracks the engineering-decade of |I| (µA → 3 px, mA → 5 px,
    // 0.1–1 A → 7 px, ≥ 1 A → 9 px) so a glance tells you whether
    // the wire is a sensor line or a power rail. Colour is pulled
    // from _curColor so the arrow agrees with the wire body and the
    // rest of the palette (Sprint 70e).
    var arrowSize = cur < 1e-3 ? 3 : cur < 0.1 ? 5 : cur < 1 ? 7 : 9;
    var arrowCount = Math.max(1, Math.floor(dist / 60));
    var arrowColor = _curColor(cur, '#3a4a5a');
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = Math.max(1.5, arrowSize * 0.25);
    ctx.lineCap = 'round';
    for (var ai = 0; ai < arrowCount; ai++) {
      var midFrac = (ai + 0.5) / arrowCount;
      var ax, ay, ax2, ay2;
      if (style === 'catenary') {
        if (!sag) { sag = Math.min(dist * 0.1, 25); mx = (w.x1 + w.x2) / 2; my = (w.y1 + w.y2) / 2 + sag; }
        ax = (1-midFrac)*(1-midFrac)*w.x1 + 2*(1-midFrac)*midFrac*mx + midFrac*midFrac*w.x2;
        ay = (1-midFrac)*(1-midFrac)*w.y1 + 2*(1-midFrac)*midFrac*my + midFrac*midFrac*w.y2;
        var mf2 = midFrac + 0.01;
        ax2 = (1-mf2)*(1-mf2)*w.x1 + 2*(1-mf2)*mf2*mx + mf2*mf2*w.x2;
        ay2 = (1-mf2)*(1-mf2)*w.y1 + 2*(1-mf2)*mf2*my + mf2*mf2*w.y2;
      } else if (style === 'manhattan') {
        var midXA = (w.x1 + w.x2) / 2;
        var sA = Math.abs(midXA - w.x1), sB = Math.abs(w.y2 - w.y1), sC = Math.abs(w.x2 - midXA);
        var totLA = sA + sB + sC;
        var dA = midFrac * totLA;
        if (dA <= sA) {
          ax = w.x1 + (midXA - w.x1) * (sA > 0 ? dA / sA : 0); ay = w.y1;
          ax2 = ax + (w.x2 >= w.x1 ? 1 : -1); ay2 = ay;
        } else if (dA <= sA + sB) {
          ax = midXA; ay = w.y1 + (w.y2 - w.y1) * (sB > 0 ? (dA - sA) / sB : 0);
          ax2 = ax; ay2 = ay + (w.y2 > w.y1 ? 1 : -1);
        } else {
          ax = midXA + (w.x2 - midXA) * (sC > 0 ? (dA - sA - sB) / sC : 0); ay = w.y2;
          ax2 = ax + (w.x2 >= midXA ? 1 : -1); ay2 = ay;
        }
      } else {
        ax = w.x1 + (w.x2 - w.x1) * midFrac;
        ay = w.y1 + (w.y2 - w.y1) * midFrac;
        ax2 = ax + (w.x2 - w.x1) * 0.01;
        ay2 = ay + (w.y2 - w.y1) * 0.01;
      }
      var angle = Math.atan2((ay2 - ay) * dirSign, (ax2 - ax) * dirSign);
      ctx.beginPath();
      ctx.moveTo(ax - arrowSize * Math.cos(angle - 0.45), ay - arrowSize * Math.sin(angle - 0.45));
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - arrowSize * Math.cos(angle + 0.45), ay - arrowSize * Math.sin(angle + 0.45));
      ctx.stroke();
    }

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Net name label
  var wIdx = S.wires.indexOf(w);
  if (wIdx >= 0 && S.netNames[wIdx]) {
    ctx.font = '600 10px "JetBrains Mono"';
    ctx.fillStyle = '#00e09e';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(S.netNames[wIdx], (w.x1+w.x2)/2, Math.min(w.y1,w.y2) - 4);
  }
}

function drawWirePreview() {
  if (!S.wireStart || !S.wirePreview) return;
  var s = S.wireStart;
  var pin = S.hoveredPin;
  var tx = pin ? pin.x : snap(S.wirePreview.x), ty = pin ? pin.y : snap(S.wirePreview.y);

  // Sprint 14: Elastic bezier with lag
  if (typeof updateWireLag === 'function') updateWireLag(tx, ty);
  var lagX = (typeof _wireLag !== 'undefined' && _wireLag.init) ? _wireLag.x : tx;
  var lagY = (typeof _wireLag !== 'undefined' && _wireLag.init) ? _wireLag.y : ty;

  // Sprint 14: Pin magnetic snap glow
  if (pin && typeof _roundRect === 'function') {
    var proximity = 1 - (Math.hypot(tx - S.wirePreview.x, ty - S.wirePreview.y) / 18);
    if (proximity > 0) {
      var glowR = 8 + proximity * 8;
      var glowA = 0.2 + proximity * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74, 158, 255, ' + glowA + ')';
      ctx.fill();
      ctx.restore();
    }
  }

  var dist = Math.hypot(lagX - s.x, lagY - s.y);
  ctx.strokeStyle = '#00e09e'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(s.x, s.y);

  // Elastic bezier: use lag point as control point
  var midX = (s.x + lagX) / 2;
  var midY = (s.y + lagY) / 2;

  switch (S.wireStyle) {
    case 'manhattan':
      ctx.lineTo(midX, s.y); ctx.lineTo(midX, lagY); ctx.lineTo(lagX, lagY);
      break;
    case 'straight':
      ctx.quadraticCurveTo(midX, s.y, lagX, lagY);
      break;
    case 'spline':
      var dx = lagX - s.x;
      ctx.bezierCurveTo(s.x + dx * 0.33, s.y, lagX - dx * 0.33, lagY, lagX, lagY);
      break;
    case 'catenary':
    default:
      var sag = Math.min(dist * 0.1, 25);
      var mx = midX, my = midY + sag;
      ctx.quadraticCurveTo(mx, my, lagX, lagY);
      break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGhostPreview() {
  if (S.mode !== 'place' || !S.placingType) return;
  const def = COMP[S.placingType]; if (!def) return;
  const wx = snap(S.mouse.wx), wy = snap(S.mouse.wy);
  ctx.save(); ctx.globalAlpha = 0.4;
  ctx.translate(wx, wy); ctx.rotate(S.placeRot * Math.PI / 2);
  def.draw(ctx, GRID, {});
  ctx.restore();
  // ghost pins
  const r = S.placeRot * Math.PI / 2, cos = Math.cos(r), sin = Math.sin(r);
  ctx.globalAlpha = 0.35;
  def.pins.forEach(p => {
    const px = wx + p.dx * cos - p.dy * sin, py = wy + p.dx * sin + p.dy * cos;
    ctx.fillStyle = '#00e09e'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawSelBox() {
  if (!S.selBox) return;
  const b = S.selBox;
  const x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
  const w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
  ctx.fillStyle = 'rgba(59,130,246,0.06)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
  ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
}

function drawSnapGlow() {
  if (!S.hoveredPin) return;
  const p = S.hoveredPin, t = Date.now() / 500;
  const r = S.reducedMotion ? 10 : (10 + 2 * Math.sin(t * Math.PI * 2));
  ctx.save();
  ctx.shadowColor = '#00e09e'; ctx.shadowBlur = 15;
  ctx.strokeStyle = 'rgba(0,224,158,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#00e09e'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function voltageToColor(v) {
  const t = Math.max(-1, Math.min(1, v / 15));
  if (t < 0) return `rgba(${Math.round(100-100*t)},${Math.round(100+100*t)},255,0.5)`;
  if (t > 0) return `rgba(255,${Math.round(100-100*t)},${Math.round(100-100*t)},0.5)`;
  return 'rgba(128,128,128,0.3)';
}

function drawVoltageMap() {
  if (!S.voltageMap || !S.sim.running || !S._nodeVoltages) return;
  for (const p of S.parts) {
    const pins = getPartPins(p);
    pins.forEach((pin, i) => {
      const key = Math.round(pin.x) + ',' + Math.round(pin.y);
      const ni = S._pinToNode && S._pinToNode[key];
      if (ni == null) return;
      const v = S._nodeVoltages[ni] || 0;
      ctx.fillStyle = voltageToColor(v);
      ctx.beginPath(); ctx.arc(pin.x, pin.y, 7, 0, Math.PI*2); ctx.fill();
      ctx.font = '8px "JetBrains Mono"'; ctx.fillStyle = '#e0e7f0'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(v.toFixed(1)+'V', pin.x, pin.y - 8);
    });
  }
}

function drawScope() {
  const w = scvs.width / DPR, h = scvs.height / DPR;
  const ctrlH = 36, plotH = h - ctrlH;

  if (S.scope.persist) {
    sctx.fillStyle = 'rgba(8,12,20,0.15)';
  } else {
    sctx.fillStyle = '#080c14';
  }
  sctx.fillRect(0, 0, w, h);

  // 10x8 grid
  sctx.strokeStyle = 'rgba(255,255,255,0.04)'; sctx.lineWidth = 0.5;
  sctx.beginPath();
  for (let i = 1; i < 10; i++) { const x = w*i/10; sctx.moveTo(x,0); sctx.lineTo(x,plotH); }
  for (let i = 1; i < 8; i++) { const y = plotH*i/8; sctx.moveTo(0,y); sctx.lineTo(w,y); }
  sctx.stroke();

  // Center crosshair
  sctx.strokeStyle = 'rgba(255,255,255,0.10)'; sctx.lineWidth = 0.5;
  sctx.beginPath();
  sctx.moveTo(0, plotH/2); sctx.lineTo(w, plotH/2);
  sctx.moveTo(w/2, 0); sctx.lineTo(w/2, plotH);
  sctx.stroke();

  // Trigger level line
  if (S.scope.trigger.mode !== 'auto') {
    const tCh = S.scope.ch[S.scope.trigger.src];
    const tY = plotH/2 - (S.scope.trigger.level / (tCh.vDiv || 2)) * (plotH/8);
    sctx.strokeStyle = tCh.color + '60'; sctx.lineWidth = 1; sctx.setLineDash([4,4]);
    sctx.beginPath(); sctx.moveTo(0, tY); sctx.lineTo(w, tY); sctx.stroke();
    sctx.setLineDash([]);
  }

  // Draw each active channel
  let stats = { mn: Infinity, mx: -Infinity, sum: 0, sumSq: 0, count: 0, crossings: 0 };

  for (let c = 0; c < 4; c++) {
    const ch = S.scope.ch[c];
    if (!ch.on) continue;

    const buf = ch.buf, ptr = S.scope.ptr;
    const vd = ch.vDiv || 2;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < 600; i++) { const v = buf[(ptr+i)%600]; if(v<mn) mn=v; if(v>mx) mx=v; }

    const autoVDiv = vd === 0 ? Math.max((mx-mn)/6, 0.01) : vd;
    const yScale = (plotH/8) / autoVDiv;
    const mid = vd === 0 ? (mx+mn)/2 : 0;

    // Glow layer
    sctx.save();
    sctx.strokeStyle = ch.color; sctx.lineWidth = 4; sctx.globalAlpha = 0.12;
    sctx.shadowColor = ch.color; sctx.shadowBlur = 12;
    sctx.beginPath();
    for (let i = 0; i < 600; i++) {
      const x = i/600*w, y = plotH/2 - (buf[(ptr+i)%600] - mid) * yScale;
      if (i===0) sctx.moveTo(x,y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
    }
    sctx.stroke(); sctx.restore();

    // Sharp line
    sctx.strokeStyle = ch.color; sctx.lineWidth = 1.5; sctx.globalAlpha = 0.9;
    sctx.beginPath();
    for (let i = 0; i < 600; i++) {
      const x = i/600*w, y = plotH/2 - (buf[(ptr+i)%600] - mid) * yScale;
      if (i===0) sctx.moveTo(x,y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
    }
    sctx.stroke(); sctx.globalAlpha = 1;

    // Stats for first active channel
    if (stats.count === 0) {
      stats.mn = mn; stats.mx = mx;
      let prevV = buf[ptr % 600];
      for (let i = 0; i < 600; i++) {
        const v = buf[(ptr+i)%600];
        stats.sum += v; stats.sumSq += v*v; stats.count++;
        if (i > 0 && prevV <= 0 && v > 0) stats.crossings++;
        prevV = v;
      }
    }
  }

  // X-Y mode (Lissajous)
  if (S.scope.mode === 'xy' && S.scope.ch[0].on && S.scope.ch[1].on) {
    var buf0 = S.scope.ch[0].buf, buf1 = S.scope.ch[1].buf;
    var ptr = S.scope.ptr;
    sctx.strokeStyle = '#00e09e'; sctx.lineWidth = 1.5;
    sctx.shadowColor = '#00e09e'; sctx.shadowBlur = 6;
    sctx.beginPath();
    for (var i = 0; i < 600; i++) {
      var vx = buf0[(ptr+i)%600], vy = buf1[(ptr+i)%600];
      var sx = w/2 + vx * (w*0.3) / (S.scope.ch[0].vDiv||2);
      var sy = plotH/2 - vy * (plotH*0.3) / (S.scope.ch[1].vDiv||2);
      if (i === 0) sctx.moveTo(sx, sy); else sctx.lineTo(sx, sy);
    }
    sctx.stroke(); sctx.shadowBlur = 0;
  }

  // Math channel
  if (S.scope.math && S.scope.ch[0].on && S.scope.ch[1].on) {
    var buf0 = S.scope.ch[0].buf, buf1 = S.scope.ch[1].buf, ptr = S.scope.ptr;
    sctx.strokeStyle = '#ffffff'; sctx.lineWidth = 1; sctx.globalAlpha = 0.7;
    sctx.setLineDash([4,3]);
    sctx.beginPath();
    for (var i = 0; i < 600; i++) {
      var v0 = buf0[(ptr+i)%600], v1 = buf1[(ptr+i)%600];
      var vm = 0;
      if (S.scope.math === 'add') vm = v0 + v1;
      else if (S.scope.math === 'sub') vm = v0 - v1;
      else if (S.scope.math === 'mul') vm = v0 * v1;
      else if (S.scope.math === 'dvdt' && i > 0) vm = (v0 - buf0[(ptr+i-1)%600]) * 1000;
      var x = i/600*w, y = plotH/2 - vm * (plotH*0.3) / (S.scope.ch[0].vDiv||2);
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, Math.max(0, Math.min(plotH, y)));
    }
    sctx.stroke(); sctx.setLineDash([]); sctx.globalAlpha = 1;
  }

  // Cursors
  if (S.scope.cursors) {
    var cx1 = S.scope.cx1, cx2 = S.scope.cx2;
    sctx.strokeStyle = '#eab308'; sctx.lineWidth = 1; sctx.setLineDash([3,3]);
    sctx.beginPath(); sctx.moveTo(cx1, 0); sctx.lineTo(cx1, plotH); sctx.stroke();
    sctx.beginPath(); sctx.moveTo(cx2, 0); sctx.lineTo(cx2, plotH); sctx.stroke();
    sctx.setLineDash([]);
    var samplesPerPx = 600 / w;
    var dt_cursor = Math.abs(cx2 - cx1) * samplesPerPx * SIM_DT * SUBSTEPS;
    sctx.fillStyle = '#eab308'; sctx.font = '10px "JetBrains Mono"'; sctx.textAlign = 'center';
    sctx.fillText('\u0394t=' + fmtVal(dt_cursor, 's'), (cx1+cx2)/2, 12);
    if (dt_cursor > 0) sctx.fillText('f=' + fmtVal(1/dt_cursor, 'Hz'), (cx1+cx2)/2, 24);
  }

  // Channel labels
  for (let c = 0; c < 4; c++) {
    if (!S.scope.ch[c].on) continue;
    sctx.font = '600 10px "JetBrains Mono"';
    sctx.fillStyle = S.scope.ch[c].color;
    sctx.fillText(S.scope.ch[c].label, 8, 14 + c*14);
  }

  // Update measurement cards
  if (stats.count > 0) {
    const vpp = stats.mx - stats.mn;
    const vrms = Math.sqrt(stats.sumSq / stats.count);
    const samplesPerSec = 600 / (S.scope.tDiv * 10);
    const freq = stats.crossings > 1 ? (stats.crossings - 1) * samplesPerSec / 600 / 2 : 0;

    document.getElementById('sc-vpp').textContent = fmtVal(vpp, 'V');
    document.getElementById('sc-vrms').textContent = fmtVal(vrms, 'V');
    if (freq > 0) {
      document.getElementById('sc-freq').textContent = fmtVal(freq, 'Hz');
      document.getElementById('sc-per').textContent = fmtVal(1/freq, 's');
    }
  }
}
