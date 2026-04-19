// ──────── SPRINT 104.4 (REVISED) — CONTEXT-AWARE STAMP SHORTCUTS ────────
// Letters do different jobs depending on whether a stamp (place mode) is
// active.
//
//   SELECTION MODE (S.mode !== 'place')
//     R C L V A D G Q M J O P → start stamp for that component
//     Shift+Q / Shift+M / Shift+J → complementary variant
//     W → wire mode, Space → sim toggle
//
//   STAMP MODE (S.mode === 'place')
//     R        → rotate ghost 90° CCW
//     Shift+R  → rotate ghost 90° CW
//     F        → flip horizontal
//     Shift+F  → flip vertical
//     Any comp letter (C L V A D G Q M J O P, Shift variants) → switch to
//                that component. startPlace resets rotation/flip so the
//                user doesn't get a surprise upside-down kapasitör because
//                they rotated a resistor earlier.
//     W → wire mode (cancels current stamp).
//     Esc / Del / Backspace → leave stamp mode.
//
// Space is **always** sim play/pause — even in stamp mode. Rotation lives
// on R so the muscle memory from KiCad / Eagle / Altium still works.
var _KBD_LETTER_MAP = {
  r: 'resistor',
  c: 'capacitor',
  l: 'inductor',
  v: 'vdc',
  a: 'vac',
  d: 'diode',
  g: 'ground',
  q: 'npn',
  m: 'nmos',
  j: 'njfet',
  o: 'opamp',
  p: 'potentiometer'
};
var _KBD_SHIFT_MAP = {
  q: 'pnp',
  m: 'pmos',
  j: 'pjfet'
};

function _isTypingTarget(t) {
  if (!t) return false;
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}
function _modalOpen() {
  // A modal is considered visible if it's .show-classed or uses
  // display:flex via the `.show` convention used across the app.
  var shown = document.querySelector('#settings-modal.show, #shortcuts-modal.show, #about-modal.show, #ency-modal.show, #tutorial-list-modal.show, .gallery-modal.show, .share-modal.show');
  return !!shown;
}
function _letterShortcutTarget(k, shift) {
  if (shift && _KBD_SHIFT_MAP[k]) return _KBD_SHIFT_MAP[k];
  return _KBD_LETTER_MAP[k] || null;
}

// ──────── KEYBOARD EVENTS ────────
document.addEventListener('keydown', e => {
  if (_isTypingTarget(e.target)) return;
  const k = e.key.toLowerCase();

  // number shortcuts (legacy — keyed via COMP.def.key)
  for (const [type, def] of Object.entries(COMP)) { if (def.key && k === def.key && !e.ctrlKey && !e.metaKey && !e.altKey) { startPlace(type); return; } }

  if (k === 'escape') {
    S.mode = 'select'; S.placingType = null; S.wireStart = null; S.wirePreview = null;
    document.getElementById('btn-wire').classList.remove('active'); needsRender = true;
    if (typeof _syncStampSelection === 'function') _syncStampSelection();
    return;
  }
  if (k === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleWire(); return; }

  // Sprint 104.4 (revised) — context-aware letter shortcuts.
  //   inStamp + R / Shift+R → rotate ghost
  //   inStamp + F / Shift+F → flip ghost
  //   Any mode + comp letter → startPlace that component (stamp switch or
  //     initial stamp-mode entry; startPlace resets rotation/flip state).
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !_modalOpen()) {
    var letterKey = e.key.length === 1 ? e.key.toLowerCase() : null;
    var inStamp = (S.mode === 'place' && !!S.placingType);
    if (letterKey && /^[a-z]$/.test(letterKey)) {
      // Stamp-only orientation keys must come first so R doesn't restart
      // the same resistor stamp from scratch (which would clobber any
      // rotation the user just set).
      if (inStamp) {
        if (letterKey === 'r') {
          e.preventDefault();
          if (typeof rotateGhost === 'function') rotateGhost(e.shiftKey ? 1 : -1);
          return;
        }
        if (letterKey === 'f') {
          e.preventDefault();
          if (typeof flipGhost === 'function') flipGhost(e.shiftKey ? 'v' : 'h');
          return;
        }
      }
      // Component switch or initial stamp entry.
      var compKey = _letterShortcutTarget(letterKey, e.shiftKey);
      if (compKey && (window.COMP && window.COMP[compKey])) {
        e.preventDefault();
        var previousStamp = inStamp ? S.placingType : null;
        startPlace(compKey);
        if (typeof StampToast !== 'undefined' && StampToast.show) {
          var shown = e.shiftKey ? ('⇧' + letterKey.toUpperCase()) : letterKey.toUpperCase();
          StampToast.show(compKey, window.COMP[compKey].cat, shown, previousStamp ? 'switch' : 'enter');
        }
        return;
      }
    }
  }

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
  if (k === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (VXA.Breadboard) VXA.Breadboard.toggle(); return; }
  if (k === 'c' && e.shiftKey && !e.ctrlKey && !e.metaKey) { if (typeof cycleCursorMode === 'function') cycleCursorMode(); return; }
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
  if (k === ' ') {
    // Sprint 104.4 (revised) — Space is *always* sim play/pause, even in
    // stamp mode. Rotation lives on R in stamp mode; muscle memory from
    // other schematic editors keeps Space = play across contexts.
    e.preventDefault();
    toggleSim();
    return;
  }
  if (k === '=' || k === '+') { S.view.zoom = Math.min(S.view.maxZoom, S.view.zoom * 1.2); needsRender = true; return; }
  if (k === '-') { S.view.zoom = Math.max(S.view.minZoom, S.view.zoom / 1.2); needsRender = true; return; }
  if (k === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); S.view.zoom = 1; S.view.ox = cvs.width / DPR / 2; S.view.oy = cvs.height / DPR / 2; needsRender = true; return; }
  if (k === 'f' && e.ctrlKey && e.shiftKey) {
    e.preventDefault(); fitToScreen(); return;
  }
});
