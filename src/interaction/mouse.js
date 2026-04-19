// ──────── MOUSE EVENTS ────────
const wrap = document.getElementById('canvas-wrap');

wrap.addEventListener('mousemove', e => {
  const r = cvs.getBoundingClientRect();
  S.mouse.x = e.clientX - r.left; S.mouse.y = e.clientY - r.top;
  // Breadboard mode: redirect mouse events
  if (VXA.Breadboard && VXA.Breadboard.isActive()) { VXA.Breadboard.handleMouseMove(e); return; }
  const w = s2w(S.mouse.x, S.mouse.y); S.mouse.wx = w.x; S.mouse.wy = w.y;
  S.hoveredPin = findNearestPin(w.x, w.y);
  S.hovered = hitTestPart(w.x, w.y);
  // Wire hover detection
  S._hoveredWire = null;
  if (!S.hovered && S.mode === 'select') {
    for (var _whi = 0; _whi < S.wires.length; _whi++) {
      var _hw = S.wires[_whi];
      var _hdx = _hw.x2-_hw.x1, _hdy = _hw.y2-_hw.y1, _hlen = Math.sqrt(_hdx*_hdx+_hdy*_hdy);
      if (_hlen < 1) continue;
      var _ht = Math.max(0,Math.min(1,((w.x-_hw.x1)*_hdx+(w.y-_hw.y1)*_hdy)/(_hlen*_hlen)));
      var _hpx = _hw.x1+_ht*_hdx, _hpy = _hw.y1+_ht*_hdy;
      if (Math.sqrt((w.x-_hpx)*(w.x-_hpx)+(w.y-_hpy)*(w.y-_hpy)) < 8) { S._hoveredWire = _hw; break; }
    }
  }

  // dragging parts
  if (S.drag.active && S.drag.type === 'move') {
    // If dragged part is in a group, ensure all group members are in drag.parts
    if (S.drag.parts.length > 0) {
      S.groups.forEach(function(g) {
        if (S.drag.parts.some(function(dp){ return g.partIds.includes(dp.id); })) {
          g.partIds.forEach(function(pid) {
            if (!S.drag.parts.some(function(dp){ return dp.id === pid; })) {
              var pp = S.parts.find(function(p){ return p.id === pid; });
              if (pp) S.drag.parts.push({id:pid, ox:pp.x, oy:pp.y});
            }
          });
        }
      });
    }
    const dx = w.x - S.drag.sx, dy = w.y - S.drag.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { if (typeof hidePartPopup === 'function') hidePartPopup(); }
    // Move parts
    S.drag.parts.forEach(d => {
      const p = S.parts.find(pp => pp.id === d.id);
      if (p) { p.x = snap(d.ox + dx); p.y = snap(d.oy + dy); }
    });
    // Move bound wire endpoints using pre-computed bindings (by part ID, not position)
    if (S.drag._wireBindings) {
      S.drag._wireBindings.forEach(function(b) {
        var p = S.parts.find(function(pp) { return pp.id === b.partId; });
        if (!p) return;
        var pins = getPartPins(p);
        if (b.pinIdx >= pins.length) return;
        var npx = Math.round(pins[b.pinIdx].x), npy = Math.round(pins[b.pinIdx].y);
        var ww = S.wires[b.wi];
        if (!ww) return;
        if (b.end === 1) { ww.x1 = npx; ww.y1 = npy; }
        else { ww.x2 = npx; ww.y2 = npy; }
      });
    }
    needsRender = true;
  }
  // panning
  if (S.drag.active && S.drag.type === 'pan') {
    S.view.ox += e.movementX; S.view.oy += e.movementY; needsRender = true;
  }
  // box select
  if (S.selBox) { S.selBox.x2 = w.x; S.selBox.y2 = w.y; needsRender = true; }
  // Sprint 14: Probe drag
  if (VXA.Probes && VXA.Probes.isDragging()) { VXA.Probes.onDrag(w.x, w.y); needsRender = true; }
  // wire preview
  // Sprint 104.5 — L-shape autoroute. We stash the raw target as
  // wirePreview (legacy consumers stay happy) and additionally build
  // an `Lpath` two-segment path on the state so drawing.js can draw the
  // elbow. Direction is chosen by the dominant axis so the longer leg
  // ends up first — the user's eye follows the path naturally.
  if (S.mode === 'wire' && S.wireStart) {
    var tx = snap(w.x), ty = snap(w.y);
    S.wirePreview = { x: tx, y: ty };
    var dx = Math.abs(tx - S.wireStart.x);
    var dy = Math.abs(ty - S.wireStart.y);
    var horizFirst = dx >= dy;
    var corner = horizFirst ? { x: tx, y: S.wireStart.y } : { x: S.wireStart.x, y: ty };
    S.wireLPath = { corner: corner, target: { x: tx, y: ty }, horizFirst: horizFirst };
    needsRender = true;
  }
  if (S.mode === 'place') needsRender = true;
});

wrap.addEventListener('mousedown', e => {
  hideCtx();
  // Breadboard mode: redirect mouse events
  if (VXA.Breadboard && VXA.Breadboard.isActive()) { if (VXA.Breadboard.handleMouseDown(e)) return; }
  const w = s2w(S.mouse.x, S.mouse.y);

  // middle-click pan
  if (e.button === 1) { S.drag.active = true; S.drag.type = 'pan'; e.preventDefault(); return; }
  if (e.button === 2) return; // right-click handled by contextmenu

  // PLACE MODE
  if (S.mode === 'place' && S.placingType) {
    saveUndo();
    const def = COMP[S.placingType];
    var px = snap(w.x), py = snap(w.y);
    // Sprint 104.5 — smart-offset: if the user targets a cell already
    // occupied (within GRID/2) and isn't holding Shift to force overlap,
    // nudge one grid down-right. Direction reacts to ghost rotation so
    // vertical components step sideways instead of sandwiching each
    // other. Shift bypass is announced in the enter-variant toast.
    var nudged = false;
    if (!e.shiftKey) {
      var near = S.parts.some(function(q) { return Math.abs(q.x - px) < GRID / 2 && Math.abs(q.y - py) < GRID / 2; });
      if (near) {
        var rot = (S.placeRot | 0) % 2;
        if (rot === 0) px += GRID; else py += GRID;
        nudged = true;
        if (typeof StampToast !== 'undefined' && StampToast.showNudge) StampToast.showNudge();
      }
    }
    const p = { id: S.nextId++, type: S.placingType, name: nextName(S.placingType), x: px, y: py, rot: S.placeRot, val: def.def, flipH: !!S.placeFlipH, flipV: !!S.placeFlipV };
    // Sprint 9: net label default name
    if (S.placingType === 'netLabel') { var nlCount = S.parts.filter(function(pp) { return pp.type === 'netLabel'; }).length; p.val = 'NET' + (nlCount + 1); }
    else if (S.placingType === 'vccLabel') { p.val = 'VCC'; }
    else if (S.placingType === 'gndLabel') { p.val = 'GND'; }
    // Sprint 7: assign default model
    var defModel = VXA.Models.getDefault(S.placingType);
    if (defModel) { p.model = defModel; applyModel(p, defModel); }
    S.parts.push(p); S.sel = [p.id]; needsRender = true; updateInspector();
    if (typeof VXA !== 'undefined' && VXA.Sound) VXA.Sound.play('click', p.x, p.y);
    return;
  }

  // Sprint 14: Probe mode — drag handling
  if (VXA.Probes && VXA.Probes.isActive()) {
    var probeHit = VXA.Probes.hitTest(w.x, w.y);
    if (probeHit) {
      VXA.Probes.startDrag(probeHit);
      return;
    }
    // Click in probe mode without hitting a probe → place red then black
    var pState = VXA.Probes.getState();
    if (!pState.probes.red.attached) { VXA.Probes.startDrag('red'); VXA.Probes.onDrag(w.x, w.y); VXA.Probes.onDrop(w.x, w.y); return; }
    if (!pState.probes.black.attached) { VXA.Probes.startDrag('black'); VXA.Probes.onDrag(w.x, w.y); VXA.Probes.onDrop(w.x, w.y); return; }
  }

  // WIRE MODE
  if (S.mode === 'wire') {
    const pin = S.hoveredPin;
    const tx = pin ? pin.x : snap(w.x), ty = pin ? pin.y : snap(w.y);
    if (!S.wireStart) {
      S.wireStart = { x: tx, y: ty };
      S.wireLPath = null;
      if (typeof resetWireLag === 'function') resetWireLag();
    }
    else {
      if (Math.abs(tx - S.wireStart.x) < 2 && Math.abs(ty - S.wireStart.y) < 2) {
        S.wireStart = null; S.wirePreview = null; S.wireLPath = null;
        if (typeof resetWireLag === 'function') resetWireLag();
        needsRender = true; return;
      }
      saveUndo();
      // Sprint 104.5 — push TWO segments forming an L. Axis choice mirrors
      // the live preview in the mousemove handler above.
      var dx = Math.abs(tx - S.wireStart.x);
      var dy = Math.abs(ty - S.wireStart.y);
      var horizFirst = dx >= dy;
      var corner = horizFirst ? { x: tx, y: S.wireStart.y } : { x: S.wireStart.x, y: ty };
      if (dx > 0 && dy > 0) {
        S.wires.push({ x1: S.wireStart.x, y1: S.wireStart.y, x2: corner.x, y2: corner.y });
        S.wires.push({ x1: corner.x, y1: corner.y, x2: tx, y2: ty });
      } else {
        // Pure horizontal or vertical — one segment is enough.
        S.wires.push({ x1: S.wireStart.x, y1: S.wireStart.y, x2: tx, y2: ty });
      }
      // Sprint 14: Flash effect on connection
      if (typeof onWireConnected === 'function') onWireConnected(tx, ty);
      // Wire mode stays open — start next wire from this point.
      S.wireStart = { x: tx, y: ty };
      S.wirePreview = null;
      S.wireLPath = null;
      if (typeof resetWireLag === 'function') resetWireLag();
      needsRender = true;
    }
    return;
  }

  // SELECT MODE — hit test
  const hit = hitTestPart(w.x, w.y);
  // Sprint 27a: Push Button — press on mousedown
  if (hit && hit.type === 'pushButton' && !e.ctrlKey && !e.metaKey) {
    hit.closed = true;
    S._pushBtnActive = hit;
    if (S.sim.running && typeof buildCircuitFromCanvas === 'function') buildCircuitFromCanvas();
    needsRender = true;
  }
  if (hit) {
    if (e.ctrlKey || e.metaKey) {
      const idx = S.sel.indexOf(hit.id);
      if (idx >= 0) S.sel.splice(idx, 1); else S.sel.push(hit.id);
    } else if (!S.sel.includes(hit.id)) { S.sel = [hit.id]; }
    // Show popup on single click
    if (typeof showPartPopup === 'function') showPartPopup(hit);
    // begin drag
    saveUndo();
    S.drag.active = true; S.drag.type = 'move'; S.drag.sx = w.x; S.drag.sy = w.y;
    S.drag.parts = S.sel.map(id => { const p = S.parts.find(pp => pp.id === id); return p ? { id, ox: p.x, oy: p.y } : null; }).filter(Boolean);
    // Pre-compute wire-to-part pin bindings for safe drag
    S.drag._wireBindings = [];
    var dragIds = {}; S.drag.parts.forEach(function(d) { dragIds[d.id] = true; });
    S.parts.forEach(function(p) {
      if (!dragIds[p.id]) return;
      var pins = getPartPins(p);
      pins.forEach(function(pin, pi) {
        var px = Math.round(pin.x), py = Math.round(pin.y);
        S.wires.forEach(function(ww, wi) {
          if (Math.abs(ww.x1 - px) < 5 && Math.abs(ww.y1 - py) < 5) S.drag._wireBindings.push({ wi: wi, end: 1, partId: p.id, pinIdx: pi });
          if (Math.abs(ww.x2 - px) < 5 && Math.abs(ww.y2 - py) < 5) S.drag._wireBindings.push({ wi: wi, end: 2, partId: p.id, pinIdx: pi });
        });
      });
    });
    needsRender = true; updateInspector();
  } else if (S._hoveredWire) {
    // Wire click = select wire
    S._selectedWire = S._hoveredWire;
    S.sel = [];
    if (typeof hidePartPopup === 'function') hidePartPopup();
    needsRender = true; updateInspector();
  } else {
    // box select start — clear wire selection too
    if (!e.ctrlKey && !e.metaKey) S.sel = [];
    S._selectedWire = null;
    if (typeof hidePartPopup === 'function') hidePartPopup();
    S.selBox = { x1: w.x, y1: w.y, x2: w.x, y2: w.y };
    needsRender = true; updateInspector();
  }
});

wrap.addEventListener('mouseup', (e) => {
  // Breadboard mode: redirect mouse events
  if (VXA.Breadboard && VXA.Breadboard.isActive()) { VXA.Breadboard.handleMouseUp(e); return; }
  // Sprint 27a: Push Button release
  if (S._pushBtnActive) {
    S._pushBtnActive.closed = false;
    S._pushBtnActive = null;
    if (S.sim.running && typeof buildCircuitFromCanvas === 'function') buildCircuitFromCanvas();
    needsRender = true;
  }
  // Sprint 14: Probe drop
  if (VXA.Probes && VXA.Probes.isDragging()) {
    var _pw = s2w(S.mouse.x, S.mouse.y);
    VXA.Probes.onDrop(_pw.x, _pw.y);
  }
  if (S.drag.active) { S.drag.active = false; S.drag.type = null; }
  if (S.selBox) {
    const b = S.selBox;
    const x1 = Math.min(b.x1, b.x2), x2 = Math.max(b.x1, b.x2);
    const y1 = Math.min(b.y1, b.y2), y2 = Math.max(b.y1, b.y2);
    if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
      S.parts.forEach(p => { if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2 && !S.sel.includes(p.id)) S.sel.push(p.id); });
    }
    S.selBox = null; needsRender = true; updateInspector();
  }
});

wrap.addEventListener('dblclick', (e) => {
  // Breadboard mode: redirect dblclick
  if (VXA.Breadboard && VXA.Breadboard.isActive()) { VXA.Breadboard.handleDblClick(e); return; }
  if (S.mode === 'wire') {
    S.wireStart = null; S.wirePreview = null; S.mode = 'select';
    document.getElementById('btn-wire').classList.remove('active'); needsRender = true;
    return;
  }
  var w2 = s2w(S.mouse.x, S.mouse.y), hit = hitTestPart(w2.x, w2.y);
  if (hit && hit.type === 'switch') {
    saveUndo(); hit.closed = !hit.closed; needsRender = true;
    if (typeof VXA !== 'undefined' && VXA.Sound) VXA.Sound.play('switch', hit.x, hit.y);
    if (S.sim.running) buildCircuitFromCanvas();
    return;
  }
  // Double-click on part → inline edit
  if (hit && hit.type !== 'switch' && hit.type !== 'ground' && hit.type !== 'probe' && hit.type !== 'ammeter' && hit.type !== 'voltmeter') {
    if (!S.sel.includes(hit.id)) S.sel = [hit.id];
    openInlineEdit(hit);
    return;
  }
  // Double-click on wire → name the net
  if (S.mode === 'select') {
    for (var wi = 0; wi < S.wires.length; wi++) {
      var wire = S.wires[wi];
      var wmx = (wire.x1+wire.x2)/2, wmy = (wire.y1+wire.y2)/2;
      if (Math.abs(w2.x - wmx) < 20 && Math.abs(w2.y - wmy) < 20) {
        var name = prompt('Net ismi girin:', S.netNames[wi] || '');
        if (name !== null) { S.netNames[wi] = name; needsRender = true; }
        return;
      }
    }
  }
});

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const nz = Math.max(S.view.minZoom, Math.min(S.view.maxZoom, S.view.zoom * factor));
  const r = nz / S.view.zoom;
  S.view.ox = S.mouse.x - (S.mouse.x - S.view.ox) * r;
  S.view.oy = S.mouse.y - (S.mouse.y - S.view.oy) * r;
  S.view.zoom = nz; needsRender = true;
}, { passive: false });

wrap.addEventListener('contextmenu', function(e) {
  // Breadboard mode: redirect context menu
  if (VXA.Breadboard && VXA.Breadboard.isActive()) { VXA.Breadboard.handleContextMenu(e); return; }
  showSmartCtxMenu(e);
});

document.addEventListener('mousedown', e => { if (!ctxMenu.contains(e.target)) hideCtx(); });
