// ──────── MOUSE EVENTS ────────
const wrap = document.getElementById('canvas-wrap');

wrap.addEventListener('mousemove', e => {
  const r = cvs.getBoundingClientRect();
  S.mouse.x = e.clientX - r.left; S.mouse.y = e.clientY - r.top;
  const w = s2w(S.mouse.x, S.mouse.y); S.mouse.wx = w.x; S.mouse.wy = w.y;
  S.hoveredPin = findNearestPin(w.x, w.y);
  S.hovered = hitTestPart(w.x, w.y);

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
    S.drag.parts.forEach(d => {
      const p = S.parts.find(pp => pp.id === d.id);
      if (!p) return;
      // Get OLD pin positions before moving
      var oldPins = getPartPins(p);
      // Move part
      p.x = snap(d.ox + dx); p.y = snap(d.oy + dy);
      // Get NEW pin positions after moving
      var newPins = getPartPins(p);
      // Move wire endpoints that were connected to old pin positions
      for (var pi = 0; pi < oldPins.length; pi++) {
        var opx = Math.round(oldPins[pi].x), opy = Math.round(oldPins[pi].y);
        var npx = Math.round(newPins[pi].x), npy = Math.round(newPins[pi].y);
        if (opx === npx && opy === npy) continue;
        for (var wi = 0; wi < S.wires.length; wi++) {
          var ww = S.wires[wi];
          if (Math.abs(ww.x1 - opx) < 15 && Math.abs(ww.y1 - opy) < 15) { ww.x1 = npx; ww.y1 = npy; }
          if (Math.abs(ww.x2 - opx) < 15 && Math.abs(ww.y2 - opy) < 15) { ww.x2 = npx; ww.y2 = npy; }
        }
      }
    });
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
  if (S.mode === 'wire' && S.wireStart) { S.wirePreview = { x: w.x, y: w.y }; needsRender = true; }
  if (S.mode === 'place') needsRender = true;
});

wrap.addEventListener('mousedown', e => {
  hideCtx();
  const w = s2w(S.mouse.x, S.mouse.y);

  // middle-click pan
  if (e.button === 1) { S.drag.active = true; S.drag.type = 'pan'; e.preventDefault(); return; }
  if (e.button === 2) return; // right-click handled by contextmenu

  // PLACE MODE
  if (S.mode === 'place' && S.placingType) {
    saveUndo();
    const def = COMP[S.placingType];
    const p = { id: S.nextId++, type: S.placingType, name: nextName(S.placingType), x: snap(w.x), y: snap(w.y), rot: S.placeRot, val: def.def, flipH: false, flipV: false };
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
      if (typeof resetWireLag === 'function') resetWireLag();
    }
    else {
      if (Math.abs(tx - S.wireStart.x) < 2 && Math.abs(ty - S.wireStart.y) < 2) {
        S.wireStart = null; S.wirePreview = null;
        if (typeof resetWireLag === 'function') resetWireLag();
        needsRender = true; return;
      }
      saveUndo();
      S.wires.push({ x1: S.wireStart.x, y1: S.wireStart.y, x2: tx, y2: ty });
      // Sprint 14: Flash effect on connection
      if (typeof onWireConnected === 'function') onWireConnected(tx, ty);
      // Wire mode stays open — start next wire from this point
      // User exits with ESC or right-click
      S.wireStart = { x: tx, y: ty };
      S.wirePreview = null;
      if (typeof resetWireLag === 'function') resetWireLag();
      needsRender = true;
    }
    return;
  }

  // SELECT MODE — hit test
  const hit = hitTestPart(w.x, w.y);
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
    needsRender = true; updateInspector();
  } else {
    // box select start
    if (!e.ctrlKey && !e.metaKey) S.sel = [];
    S.selBox = { x1: w.x, y1: w.y, x2: w.x, y2: w.y };
    needsRender = true; updateInspector();
  }
});

wrap.addEventListener('mouseup', () => {
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

wrap.addEventListener('dblclick', () => {
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
  showSmartCtxMenu(e);
});

document.addEventListener('mousedown', e => { if (!ctxMenu.contains(e.target)) hideCtx(); });
