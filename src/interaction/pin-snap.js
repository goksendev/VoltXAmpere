// ──────── SPRINT 56: ENHANCED PIN SNAP ────────
// Standalone snap-to-nearest-pin utility. Called from mouse handlers.
// Does NOT modify any existing mouse.js code — opt-in via snapWireEndToPin().

(function() {
  'use strict';

  var SNAP_RADIUS = 25; // px in world coordinates (up from ~18 effective)

  function pinWorldXY(part, pinDef) {
    var dx = pinDef.dx || 0, dy = pinDef.dy || 0;
    if (part.rot) {
      var rad = (part.rot || 0) * Math.PI / 2;
      var c = Math.cos(rad), s = Math.sin(rad);
      return { x: part.x + dx * c - dy * s, y: part.y + dx * s + dy * c };
    }
    return { x: part.x + dx, y: part.y + dy };
  }

  window.snapWireEndToPin = function(wx, wy, excludePartId) {
    if (typeof S === 'undefined' || !Array.isArray(S.parts)) return null;
    var bestDist = SNAP_RADIUS;
    var bestPin = null;
    for (var i = 0; i < S.parts.length; i++) {
      var part = S.parts[i];
      if (excludePartId && part.id === excludePartId) continue;
      var def = (typeof COMP !== 'undefined') ? COMP[part.type] : null;
      if (!def || !def.pins) continue;
      var pinSrc = (Array.isArray(part.pins) && part.pins.length > 0) ? part.pins : def.pins;
      for (var j = 0; j < pinSrc.length; j++) {
        var pw = pinWorldXY(part, pinSrc[j]);
        var dist = Math.hypot(pw.x - wx, pw.y - wy);
        if (dist < bestDist) {
          bestDist = dist;
          bestPin = { x: pw.x, y: pw.y, partId: part.id, pinIndex: j };
        }
      }
    }
    return bestPin;
  };

  window.SNAP_RADIUS = SNAP_RADIUS;
})();
