// ──────── SPRINT 45: LAYER CACHE ────────
// Triple-buffered offscreen canvas layers:
//   Layer 0: Grid (invalidates when zoom/pan changes)
//   Layer 1: Components + wires (invalidates when circuit changes)
//   Layer 2: Dynamic overlay (selection, probe, current flow — always dirty)
// Render loop integration is opt-in; Sprint 45 ships the API + tests.

VXA.LayerCache = (function() {
  'use strict';

  var layers = [null, null, null];
  var dirty = [true, true, true];
  var lastZoom = -1, lastOx = -Infinity, lastOy = -Infinity;
  var lastPartCount = -1, lastWireCount = -1;
  var inited = false;

  function _createCanvas(w, h) {
    // Honour OffscreenCanvas if available, else fall back to <canvas>.
    if (typeof OffscreenCanvas === 'function') {
      try { return new OffscreenCanvas(Math.max(1, w), Math.max(1, h)); } catch (e) {}
    }
    if (typeof document !== 'undefined' && document.createElement) {
      var c = document.createElement('canvas');
      c.width = Math.max(1, w); c.height = Math.max(1, h);
      return c;
    }
    return null;
  }

  function init(width, height) {
    width = width | 0; height = height | 0;
    for (var i = 0; i < 3; i++) layers[i] = _createCanvas(width, height);
    dirty = [true, true, true];
    inited = true;
    return layers.every(function(x) { return !!x; });
  }

  function resize(width, height) {
    if (!inited) return init(width, height);
    width = width | 0; height = height | 0;
    for (var i = 0; i < 3; i++) {
      if (!layers[i]) { layers[i] = _createCanvas(width, height); }
      else {
        layers[i].width = Math.max(1, width);
        layers[i].height = Math.max(1, height);
      }
    }
    dirty = [true, true, true];
    return true;
  }

  function checkDirty() {
    if (typeof S === 'undefined' || !S) { dirty[2] = true; return; }
    if (S.view) {
      if (S.view.zoom !== lastZoom || S.view.ox !== lastOx || S.view.oy !== lastOy) {
        dirty[0] = true; dirty[1] = true;
        lastZoom = S.view.zoom; lastOx = S.view.ox; lastOy = S.view.oy;
      }
    }
    if (Array.isArray(S.parts)) {
      if (S.parts.length !== lastPartCount) { dirty[1] = true; lastPartCount = S.parts.length; if (VXA.SpatialIndex) VXA.SpatialIndex.markDirty(); }
    }
    if (Array.isArray(S.wires)) {
      if (S.wires.length !== lastWireCount) { dirty[1] = true; lastWireCount = S.wires.length; }
    }
    dirty[2] = true;
  }

  function getLayer(i) { return layers[i] || null; }
  function isDirty(i) { return !!dirty[i]; }
  function setDirty(i) { if (i >= 0 && i < 3) dirty[i] = true; }
  function setClean(i) { if (i >= 0 && i < 3) dirty[i] = false; }

  function composit(targetCtx) {
    if (!targetCtx) return false;
    try {
      for (var i = 0; i < 3; i++) {
        if (layers[i]) targetCtx.drawImage(layers[i], 0, 0);
      }
      return true;
    } catch (e) { return false; }
  }

  return {
    init: init, resize: resize,
    checkDirty: checkDirty,
    getLayer: getLayer, isDirty: isDirty, setDirty: setDirty, setClean: setClean,
    composit: composit
  };
})();
