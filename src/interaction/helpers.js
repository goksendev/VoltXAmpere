// ──────── FORMAT VALUE (ENGINEERING NOTATION) ────────
function fmtVal(v, u) {
  if (v == null || !u) return '';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toPrecision(3) + 'G' + u;
  if (abs >= 1e6) return (v / 1e6).toPrecision(3) + 'M' + u;
  if (abs >= 1e3) return (v / 1e3).toPrecision(3) + 'k' + u;
  if (abs >= 1) return v.toPrecision(3) + u;
  if (abs >= 1e-3) return (v * 1e3).toPrecision(3) + 'm' + u;
  if (abs >= 1e-6) return (v * 1e6).toPrecision(3) + '\u00B5' + u;
  if (abs >= 1e-9) return (v * 1e9).toPrecision(3) + 'n' + u;
  if (abs >= 1e-12) return (v * 1e12).toPrecision(3) + 'p' + u;
  return v.toExponential(2) + u;
}

// ──────── NAME COUNTER ────────
const _nc = {};
function nextName(type) { const en = COMP[type].en; _nc[en] = (_nc[en] || 0) + 1; return en + _nc[en]; }

// ──────── MODE ACTIONS ────────
function startPlace(type) {
  // Sprint 104.4 (revised) — component switch resets ghost orientation so
  // the user never ends up with a surprise 180° flipped kapasitör because
  // they rotated a resistor a moment ago. If consistent-angle stamping is
  // needed later we'll add a "lock orientation" toggle.
  S.mode = 'place'; S.placingType = type;
  S.placeRot = 0; S.placeFlipH = false; S.placeFlipV = false;
  S.sel = [];
  S.wireStart = null; S.wirePreview = null;
  document.getElementById('btn-wire').classList.remove('active');
  needsRender = true; updateInspector();
  // UI sync for the stamp/keyboard pipeline:
  //   • close any hover datasheet panel (pointer about to leave the card)
  //   • flag canvas-wrap so the CSS cursor switches to crosshair
  //   • mark the matching sidebar card so the category glow reads
  //     "this is selected" even when the pick came from a shortcut
  try { if (typeof DatasheetPanel !== 'undefined' && DatasheetPanel.closeNow) DatasheetPanel.closeNow(); } catch (e) {}
  try { if (typeof StampToast !== 'undefined' && StampToast.resetNudge) StampToast.resetNudge(); } catch (e) {}
  var wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.add('place-mode');
  if (typeof _syncStampSelection === 'function') _syncStampSelection();
}

// Sprint 104.4 (revised) — rotate/flip the current ghost. Direction +1 is
// CW, -1 is CCW (drawing.js multiplies placeRot by π/2 with canvas Y-down,
// so +1 increments produce clockwise visible rotation). No-op when no
// stamp is active.
function rotateGhost(dir) {
  if (S.mode !== 'place' || !S.placingType) return;
  var d = dir | 0; if (d === 0) d = 1;
  S.placeRot = ((S.placeRot + d) % 4 + 4) % 4;
  needsRender = true;
}
function flipGhost(axis) {
  if (S.mode !== 'place' || !S.placingType) return;
  if (axis === 'h') S.placeFlipH = !S.placeFlipH;
  else if (axis === 'v') S.placeFlipV = !S.placeFlipV;
  needsRender = true;
}

// Sprint 104.5 — mouse-less placement for Enter key. Targets the current
// ghost position (snap of S.mouse.wx/wy). Skips the smart-offset nudge
// when the user holds Shift, matching the mouse click override.
function _stampPlaceAtGhost(shiftHeld) {
  if (S.mode !== 'place' || !S.placingType) return;
  if (typeof snap !== 'function' || !S.mouse) return;
  var def = COMP[S.placingType]; if (!def) return;
  var px = snap(S.mouse.wx);
  var py = snap(S.mouse.wy);
  if (!shiftHeld) {
    var near = S.parts.some(function(q) { return Math.abs(q.x - px) < GRID / 2 && Math.abs(q.y - py) < GRID / 2; });
    if (near) {
      var rot = (S.placeRot | 0) % 2;
      if (rot === 0) px += GRID; else py += GRID;
      if (typeof StampToast !== 'undefined' && StampToast.showNudge) StampToast.showNudge();
    }
  }
  saveUndo();
  var p = { id: S.nextId++, type: S.placingType, name: nextName(S.placingType), x: px, y: py, rot: S.placeRot, val: def.def, flipH: !!S.placeFlipH, flipV: !!S.placeFlipV };
  if (S.placingType === 'netLabel') { var nlCount = S.parts.filter(function(pp) { return pp.type === 'netLabel'; }).length; p.val = 'NET' + (nlCount + 1); }
  else if (S.placingType === 'vccLabel') { p.val = 'VCC'; }
  else if (S.placingType === 'gndLabel') { p.val = 'GND'; }
  var defModel = (typeof VXA !== 'undefined' && VXA.Models) ? VXA.Models.getDefault(S.placingType) : null;
  if (defModel) { p.model = defModel; if (typeof applyModel === 'function') applyModel(p, defModel); }
  S.parts.push(p); S.sel = [p.id]; needsRender = true;
  if (typeof updateInspector === 'function') updateInspector();
}

// Sprint 104.4 — keeps sidebar card .selected class + canvas cursor in
// sync with the current place-mode target. Called from startPlace (entry)
// and from keyboard.js Escape handler (exit).
function _syncStampSelection() {
  var active = (typeof S !== 'undefined' && S.mode === 'place') ? S.placingType : null;
  var cards = document.querySelectorAll('#comp-panel-body .comp-item');
  cards.forEach(function(c) {
    c.classList.toggle('selected', c.dataset.comp === active);
  });
  var wrap = document.getElementById('canvas-wrap');
  if (wrap) wrap.classList.toggle('place-mode', !!active);
}
function toggleWire() {
  if (S.mode === 'wire') {
    S.mode = 'select'; S.wireStart = null; S.wirePreview = null;
    document.getElementById('btn-wire').classList.remove('active');
  } else {
    S.mode = 'wire'; S.placingType = null; S.wireStart = null;
    document.getElementById('btn-wire').classList.add('active');
  }
  needsRender = true;
}
function toggleSim() {
  S.sim.running = !S.sim.running;
  document.getElementById('sim-dot').classList.toggle('on', S.sim.running);
  document.getElementById('sim-label').textContent = S.sim.running ? 'ÇALIŞIYOR' : 'DURDURULDU';
  document.getElementById('btn-sim').innerHTML = S.sim.running ? '&#9646;&#9646; Durdur' : '&#9654; Başlat';
  if (S.sim.running) {
    S.sim.error = '';
    VXA.AdaptiveStep.reset();
    if (typeof resetSparseVerification === 'function') resetSparseVerification();
    buildCircuitFromCanvas();
    if (typeof autoDetectDt === 'function') autoDetectDt();
    VXA.SimV2.findDCOperatingPoint();
    // TimeMachine: enable and reset for new simulation run
    if (VXA.TimeMachine) {
      if (VXA.TimeMachine.isPlayback()) {
        if (typeof _tlExitPlayback === 'function') _tlExitPlayback();
        else VXA.TimeMachine.resume();
      }
      VXA.TimeMachine.setEnabled(true);
      VXA.TimeMachine.reset();
    }
    // Sprint 17: Init digital engine
    if (VXA.Digital) VXA.Digital.init(S.parts);
    // Sprint 18: Reset mixed-signal
    if (VXA.MixedSignal) VXA.MixedSignal.reset();
  } else {
    // Sim stopped — stop all hums
    if (VXA.SpatialAudio) VXA.SpatialAudio.stopAll();
    // Sprint 17: Stop digital engine
    if (VXA.Digital) VXA.Digital.stop();
  }
  if (typeof announce === 'function') announce(S.sim.running ? 'Sim\u00fclasyon ba\u015flad\u0131' : 'Sim\u00fclasyon durduruldu');
}

// ──────── SELECTION ACTIONS ────────
function rotateSelected() {
  if (S.mode === 'place') { S.placeRot = (S.placeRot + 1) % 4; needsRender = true; return; }
  if (!S.sel.length) return; saveUndo();
  S.parts.filter(p => S.sel.includes(p.id)).forEach(p => p.rot = ((p.rot || 0) + 1) % 4);
  needsRender = true; updateInspector();
}
function deleteSelected() {
  if (!S.sel.length) return; saveUndo();
  // remove wires connected to deleted parts
  S.wires = S.wires.filter(w => {
    for (const id of S.sel) {
      const p = S.parts.find(pp => pp.id === id); if (!p) continue;
      const pins = getPartPins(p);
      for (const pin of pins) {
        if ((Math.abs(w.x1 - pin.x) < 3 && Math.abs(w.y1 - pin.y) < 3) ||
            (Math.abs(w.x2 - pin.x) < 3 && Math.abs(w.y2 - pin.y) < 3)) return false;
      }
    }
    return true;
  });
  S.parts = S.parts.filter(p => !S.sel.includes(p.id));
  S.sel = []; needsRender = true; updateInspector();
}
