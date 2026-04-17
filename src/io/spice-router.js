// ──────── SPRINT 70a: SPICE IMPORT MANHATTAN ROUTER ────────
// Converts star-topology node pin sets into 90° Manhattan wire segments.
// Two modes: trunk (horizontal or vertical backbone for a node with ≥2 pins)
// and direct L-shape (for 2 pins). Ground bus consolidator emits a single
// horizontal rail at bottom + one ground symbol.

VXA.SpiceRouter = (function() {
  'use strict';

  function snap20(v) { return Math.round(v / 20) * 20; }

  // Remove degenerate (zero-length) and exact-duplicate segments.
  function dedupWires(wires) {
    var seen = {};
    var out = [];
    wires.forEach(function(w) {
      if (w.x1 === w.x2 && w.y1 === w.y2) return;
      var k1 = w.x1 + ',' + w.y1 + '→' + w.x2 + ',' + w.y2;
      var k2 = w.x2 + ',' + w.y2 + '→' + w.x1 + ',' + w.y1;
      if (seen[k1] || seen[k2]) return;
      seen[k1] = true;
      out.push(w);
    });
    return out;
  }

  // Route a single node (≥2 pins) using a horizontal trunk at trunkY.
  // Every pin: vertical stub from pin to trunk, then single horizontal segment
  // spanning min→max X of pins.
  function horizontalTrunk(pins, trunkY) {
    if (pins.length < 2) return [];
    var ty = trunkY != null ? trunkY : snap20(pins.reduce(function(s, p) { return s + p.y; }, 0) / pins.length);
    var wires = [];
    var xs = pins.map(function(p) { return p.x; });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    pins.forEach(function(p) {
      if (p.y !== ty) wires.push({ x1: p.x, y1: p.y, x2: p.x, y2: ty });
    });
    if (maxX > minX) wires.push({ x1: minX, y1: ty, x2: maxX, y2: ty });
    return wires;
  }

  // Route using a vertical trunk at trunkX.
  function verticalTrunk(pins, trunkX) {
    if (pins.length < 2) return [];
    var tx = trunkX != null ? trunkX : snap20(pins.reduce(function(s, p) { return s + p.x; }, 0) / pins.length);
    var wires = [];
    var ys = pins.map(function(p) { return p.y; });
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    pins.forEach(function(p) {
      if (p.x !== tx) wires.push({ x1: p.x, y1: p.y, x2: tx, y2: p.y });
    });
    if (maxY > minY) wires.push({ x1: tx, y1: minY, x2: tx, y2: maxY });
    return wires;
  }

  // Direct L-shape between 2 pins: horizontal first, then vertical.
  function lShape(pinA, pinB) {
    if (pinA.x === pinB.x && pinA.y === pinB.y) return [];
    if (pinA.x === pinB.x) return [{ x1: pinA.x, y1: pinA.y, x2: pinB.x, y2: pinB.y }];
    if (pinA.y === pinB.y) return [{ x1: pinA.x, y1: pinA.y, x2: pinB.x, y2: pinB.y }];
    // Bend point
    return [
      { x1: pinA.x, y1: pinA.y, x2: pinB.x, y2: pinA.y },
      { x1: pinB.x, y1: pinA.y, x2: pinB.x, y2: pinB.y }
    ];
  }

  // Auto-pick routing mode from pin distribution.
  // Returns wires array (already deduped).
  function connectNode(pins, opts) {
    if (!pins || pins.length < 2) return [];
    opts = opts || {};
    if (pins.length === 2) return dedupWires(lShape(pins[0], pins[1]));

    // ≥3 pins: pick trunk orientation based on which axis has more spread
    var xs = pins.map(function(p) { return p.x; });
    var ys = pins.map(function(p) { return p.y; });
    var xRange = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    var yRange = Math.max.apply(null, ys) - Math.min.apply(null, ys);

    if (xRange >= yRange) {
      // pins spread horizontally → horizontal trunk
      return dedupWires(horizontalTrunk(pins, opts.trunkY));
    }
    return dedupWires(verticalTrunk(pins, opts.trunkX));
  }

  // Consolidate all ground pins onto a single horizontal rail.
  // Returns { wires, groundX, groundY } — caller places ONE ground symbol at (groundX, groundY+20).
  function groundBus(gndPins, busY) {
    if (!gndPins || gndPins.length === 0) return { wires: [], groundX: 0, groundY: busY };
    var wires = [];
    var xs = gndPins.map(function(p) { return p.x; });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    // Vertical drop from each pin to bus
    gndPins.forEach(function(p) {
      if (p.y !== busY) wires.push({ x1: p.x, y1: p.y, x2: p.x, y2: busY });
    });
    // Horizontal bus spanning all drop points
    if (maxX > minX) wires.push({ x1: minX, y1: busY, x2: maxX, y2: busY });
    var gx = snap20((minX + maxX) / 2);
    return { wires: dedupWires(wires), groundX: gx, groundY: busY };
  }

  return {
    connectNode: connectNode,
    groundBus: groundBus,
    horizontalTrunk: function(pins, ty) { return dedupWires(horizontalTrunk(pins, ty)); },
    verticalTrunk: function(pins, tx) { return dedupWires(verticalTrunk(pins, tx)); },
    lShape: lShape,
    dedupWires: dedupWires
  };
})();
