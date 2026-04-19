// ──────── SPRINT 104.4 — STAMP MODE LETTER SHORTCUTS ────────
// Pills on the sidebar cards (R, C, L, V, A, D, G, Q, M, J, O, P) are now
// live keybindings. Pressing the letter enters place mode for that
// component; the mouse becomes a ghost preview that stamps on click. Shift+
// modifier swaps to the complementary variant: Shift+Q = PNP (vs NPN),
// Shift+M = P-MOSFET (vs N-MOSFET), Shift+J = P-JFET (vs N-JFET).
//
// Rotation moves to Space (was R in pre-104.4 builds) because R now means
// resistor. The Space handler below switches on mode so it still toggles
// the simulation when no component is in play.
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
// Shift+letter swap table — Q/M/J have complementary-polarity siblings.
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

  // Sprint 104.4 — letter shortcut pill bindings. Fires BEFORE legacy
  // single-letter handlers (R-rotate, G-voltage, P-probe) so those are
  // only reachable via modifiers now (e.g. rotation moved to Space).
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !_modalOpen()) {
    var letterKey = e.key.length === 1 ? e.key.toLowerCase() : null;
    if (letterKey && /^[a-z]$/.test(letterKey)) {
      var compKey = _letterShortcutTarget(letterKey, e.shiftKey);
      if (compKey && (window.COMP && window.COMP[compKey])) {
        e.preventDefault();
        startPlace(compKey);
        if (typeof StampToast !== 'undefined' && StampToast.show) {
          var shown = e.shiftKey ? ('⇧' + letterKey.toUpperCase()) : letterKey.toUpperCase();
          StampToast.show(compKey, window.COMP[compKey].cat, shown);
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
    // Sprint 104.4 — Space has a new double life. In place mode (active
    // stamp) or when a selection exists, it rotates. Otherwise keep the
    // original sim toggle. The rotateSelected function below already
    // switches on S.mode internally, so one call covers both ghost
    // preview rotation and selected-part rotation.
    e.preventDefault();
    if (S.mode === 'place' || (S.sel && S.sel.length)) rotateSelected();
    else toggleSim();
    return;
  }
  if (k === '=' || k === '+') { S.view.zoom = Math.min(S.view.maxZoom, S.view.zoom * 1.2); needsRender = true; return; }
  if (k === '-') { S.view.zoom = Math.max(S.view.minZoom, S.view.zoom / 1.2); needsRender = true; return; }
  if (k === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); S.view.zoom = 1; S.view.ox = cvs.width / DPR / 2; S.view.oy = cvs.height / DPR / 2; needsRender = true; return; }
  if (k === 'f' && e.ctrlKey && e.shiftKey) {
    e.preventDefault(); fitToScreen(); return;
  }
});
