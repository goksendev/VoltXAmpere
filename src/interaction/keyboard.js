// ──────── KEYBOARD EVENTS ────────
document.addEventListener('keydown', e => {
  const t = e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return;
  const k = e.key.toLowerCase();

  // number shortcuts
  for (const [type, def] of Object.entries(COMP)) { if (def.key && k === def.key) { startPlace(type); return; } }

  if (k === 'escape') {
    S.mode = 'select'; S.placingType = null; S.wireStart = null; S.wirePreview = null;
    document.getElementById('btn-wire').classList.remove('active'); needsRender = true; return;
  }
  if (k === 'w') { toggleWire(); return; }
  if (k === 'r') { rotateSelected(); return; }
  if (k === 'h' && !e.ctrlKey) { ctxFlipH(); return; }
  if (k === 'delete' || k === 'backspace') {
    e.preventDefault();
    // Delete selected wire first, then parts
    if (S._selectedWire) {
      saveUndo();
      S.wires = S.wires.filter(function(w) { return w !== S._selectedWire; });
      S._selectedWire = null; needsRender = true; return;
    }
    deleteSelected(); return;
  }
  if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (k === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); return; }
  if (k === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); S.sel = S.parts.map(p => p.id); needsRender = true; updateInspector(); return; }
  if (k === 'c' && (e.ctrlKey || e.metaKey)) { doCopy(); return; }
  if (k === 'v' && (e.ctrlKey || e.metaKey)) { doPaste(); return; }
  if (k === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doDuplicate(); return; }
  if (k === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exportJSON(); return; }
  if (k === 'o' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); importJSON(); return; }
  if (k === 'i' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); showSpiceImportModal(); return; }
  if (k === 'e') {
    if (S.sel.length) { var ep = S.parts.find(function(pp){return pp.id===S.sel[0];}); if (ep) openInlineEdit(ep); }
    return;
  }
  if (k === 'p' && !e.shiftKey) { if (VXA.Probes && VXA.Probes.isActive()) { VXA.Probes.toggle(); return; } ctxProbe(); return; }
  if (k === 'p' && e.shiftKey) { if (typeof toggleProbeMode === 'function') toggleProbeMode(); return; }
  if (k === 't' && !e.ctrlKey) {
    var text = prompt('Not metni:', '');
    if (text) {
      var aw = s2w(S.mouse.x, S.mouse.y);
      S.annotations.push({id: Date.now(), x: snap(aw.x), y: snap(aw.y), text: text, fontSize: 12, color: '#8899aa'});
      needsRender = true;
    }
    return;
  }
  if (k === 'g' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault();
    if (S.sel.length < 2) return;
    var gParts = S.parts.filter(function(p){ return S.sel.includes(p.id); });
    var gx = Math.min.apply(null, gParts.map(function(p){return p.x;}))-40;
    var gy = Math.min.apply(null, gParts.map(function(p){return p.y;}))-40;
    var gw = Math.max.apply(null, gParts.map(function(p){return p.x;}))-gx+80;
    var gh = Math.max.apply(null, gParts.map(function(p){return p.y;}))-gy+80;
    var name = prompt('Grup adı:', 'Grup '+(S.groups.length+1));
    if (!name) return;
    S.groups.push({id:Date.now(), name:name, partIds:S.sel.slice(), x:gx, y:gy, w:gw, h:gh});
    needsRender = true; return;
  }
  if (k === 'g' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    S.groups = S.groups.filter(function(g) {
      return !S.sel.some(function(id){ return g.partIds.includes(id); });
    });
    needsRender = true; return;
  }
  if (k === 'g' && !e.ctrlKey && !e.metaKey) { S.voltageMap = !S.voltageMap; needsRender = true; return; }
  if (k === '?' || (k === '/' && e.shiftKey)) { document.getElementById('shortcuts-modal').classList.toggle('show'); return; }
  if (k === ' ') { e.preventDefault(); toggleSim(); return; }
  if (k === '=' || k === '+') { S.view.zoom = Math.min(S.view.maxZoom, S.view.zoom * 1.2); needsRender = true; return; }
  if (k === '-') { S.view.zoom = Math.max(S.view.minZoom, S.view.zoom / 1.2); needsRender = true; return; }
  if (k === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); S.view.zoom = 1; S.view.ox = cvs.width / DPR / 2; S.view.oy = cvs.height / DPR / 2; needsRender = true; return; }
  if (k === 'f' && e.ctrlKey && e.shiftKey) {
    e.preventDefault(); fitToScreen(); return;
  }
});
