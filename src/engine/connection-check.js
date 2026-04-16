// ──────── SPRINT 56: CONNECTION CHECK (v9.0) ────────
// Detects floating (unconnected) pins. Opt-in — does NOT block simulation.
// Used by SPICE import post-check + toggleSim info overlay.

VXA.ConnectionCheck = (function() {
  'use strict';

  var TOLERANCE = 5; // px

  function pinWorldXY(part, pinDef) {
    var dx = pinDef.dx || 0, dy = pinDef.dy || 0;
    if (part.rot) {
      var rad = (part.rot || 0) * Math.PI / 2;
      var c = Math.cos(rad), s = Math.sin(rad);
      return { x: part.x + dx * c - dy * s, y: part.y + dx * s + dy * c };
    }
    return { x: part.x + dx, y: part.y + dy };
  }

  function check() {
    if (typeof S === 'undefined' || !S || !Array.isArray(S.parts)) return [];
    var warnings = [];
    var skipTypes = { ground:1, netLabel:1, netlabel:1, vccLabel:1, gndLabel:1 };

    for (var i = 0; i < S.parts.length; i++) {
      var part = S.parts[i];
      if (!part || skipTypes[part.type]) continue;
      var def = (typeof COMP !== 'undefined') ? COMP[part.type] : null;
      if (!def || !def.pins) continue;
      var pinSrc = (Array.isArray(part.pins) && part.pins.length > 0) ? part.pins : def.pins;

      for (var pi = 0; pi < pinSrc.length; pi++) {
        var pw = pinWorldXY(part, pinSrc[pi]);
        var connected = false;

        // Check wires
        if (Array.isArray(S.wires)) {
          for (var w = 0; w < S.wires.length; w++) {
            var wr = S.wires[w];
            if (Math.hypot(wr.x1 - pw.x, wr.y1 - pw.y) < TOLERANCE ||
                Math.hypot(wr.x2 - pw.x, wr.y2 - pw.y) < TOLERANCE) {
              connected = true; break;
            }
          }
        }

        // Check other part pins (direct overlap)
        if (!connected) {
          for (var j = 0; j < S.parts.length; j++) {
            if (j === i) continue;
            var other = S.parts[j];
            var oDef = (typeof COMP !== 'undefined') ? COMP[other.type] : null;
            if (!oDef || !oDef.pins) continue;
            var oPinSrc = (Array.isArray(other.pins) && other.pins.length > 0) ? other.pins : oDef.pins;
            for (var op = 0; op < oPinSrc.length; op++) {
              var ow = pinWorldXY(other, oPinSrc[op]);
              if (Math.hypot(ow.x - pw.x, ow.y - pw.y) < TOLERANCE) {
                connected = true; break;
              }
            }
            if (connected) break;
          }
        }

        if (!connected) {
          warnings.push({
            part: part,
            partName: part.name || part.type,
            pinIndex: pi,
            pinX: pw.x, pinY: pw.y,
            message: (part.name || part.type) + ' pin ' + (pi + 1) + ' unconnected'
          });
        }
      }
    }
    return warnings;
  }

  function showWarnings(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) return;
    // Tag parts for visual overlay
    for (var i = 0; i < warnings.length; i++) {
      var w = warnings[i];
      if (w.part) {
        if (!w.part._floatingPins) w.part._floatingPins = [];
        if (w.part._floatingPins.indexOf(w.pinIndex) < 0) w.part._floatingPins.push(w.pinIndex);
      }
    }
    var msg = warnings.length + ' unconnected pin(s):\n';
    for (var j = 0; j < Math.min(warnings.length, 5); j++) msg += '\u2022 ' + warnings[j].message + '\n';
    if (warnings.length > 5) msg += '...+' + (warnings.length - 5) + ' more';
    if (typeof showInfoCard === 'function') showInfoCard('\u26A0 Connection Warning', msg, '');
    if (typeof needsRender !== 'undefined') needsRender = true;
  }

  function clearWarnings() {
    if (typeof S === 'undefined' || !Array.isArray(S.parts)) return;
    for (var i = 0; i < S.parts.length; i++) delete S.parts[i]._floatingPins;
  }

  function drawFloatingPins(ctx, zoom) {
    if (!ctx || typeof S === 'undefined' || !Array.isArray(S.parts)) return;
    var ox = (S.view && S.view.ox) || 0;
    var oy = (S.view && S.view.oy) || 0;
    for (var i = 0; i < S.parts.length; i++) {
      var part = S.parts[i];
      if (!part || !Array.isArray(part._floatingPins) || part._floatingPins.length === 0) continue;
      var def = (typeof COMP !== 'undefined') ? COMP[part.type] : null;
      if (!def || !def.pins) continue;
      var pinSrc = (Array.isArray(part.pins) && part.pins.length > 0) ? part.pins : def.pins;
      for (var j = 0; j < part._floatingPins.length; j++) {
        var pi = part._floatingPins[j];
        if (pi >= pinSrc.length) continue;
        var pw = pinWorldXY(part, pinSrc[pi]);
        var sx = pw.x * zoom + ox, sy = pw.y * zoom + oy;
        ctx.beginPath();
        ctx.arc(sx, sy, 5 * zoom, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,60,60,0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ff3c3c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  return {
    check: check,
    showWarnings: showWarnings,
    clearWarnings: clearWarnings,
    drawFloatingPins: drawFloatingPins
  };
})();
