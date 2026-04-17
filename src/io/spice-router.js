// ──────── SPRINT 70a-fix: OBSTACLE-AWARE MANHATTAN ROUTER ────────
// All routing accepts an optional `boxes` list (axis-aligned part bodies)
// and chooses trunks / L-corners that do NOT traverse body interiors.
// A segment is "inside a body" when its axis-coordinate sits strictly
// between the body's inner edges (edge-padded by PAD) across the body's
// other-axis extent. Pin-edge grazing is permitted.

VXA.SpiceRouter = (function() {
  'use strict';

  var PAD = 6;       // body-edge pin padding
  var CHAN_STEP = 20; // grid-snapped scan step when searching for clean channel

  function snap20(v) { return Math.round(v / 20) * 20; }

  function dedupWires(wires) {
    var seen = {}, out = [];
    wires.forEach(function(w) {
      if (w.x1 === w.x2 && w.y1 === w.y2) return;
      var k1 = w.x1+','+w.y1+'→'+w.x2+','+w.y2;
      var k2 = w.x2+','+w.y2+'→'+w.x1+','+w.y1;
      if (seen[k1] || seen[k2]) return;
      seen[k1] = true;
      out.push(w);
    });
    return out;
  }

  // Does axis-aligned segment hit the interior of bounding box?
  function segmentHitsBox(seg, b) {
    if (seg.x1 === seg.x2) {
      var x = seg.x1;
      if (x <= b.minX + PAD || x >= b.maxX - PAD) return false;
      var yA = Math.min(seg.y1, seg.y2), yB = Math.max(seg.y1, seg.y2);
      if (yB <= b.minY + PAD || yA >= b.maxY - PAD) return false;
      return true;
    } else {
      var y = seg.y1;
      if (y <= b.minY + PAD || y >= b.maxY - PAD) return false;
      var xA = Math.min(seg.x1, seg.x2), xB = Math.max(seg.x1, seg.x2);
      if (xB <= b.minX + PAD || xA >= b.maxX - PAD) return false;
      return true;
    }
  }

  function segmentsHitAny(segs, boxes) {
    if (!boxes || boxes.length === 0) return false;
    for (var i = 0; i < segs.length; i++)
      for (var j = 0; j < boxes.length; j++)
        if (segmentHitsBox(segs[i], boxes[j])) return true;
    return false;
  }

  // Find a trunk Y (horizontal trunk) close to `prefer` that clears all boxes
  // in the [minX..maxX] column. Scans outwards in 20-snapped increments.
  function cleanTrunkY(prefer, minX, maxX, boxes) {
    if (!boxes || boxes.length === 0) return prefer;
    function tests(y) {
      for (var j = 0; j < boxes.length; j++) {
        var b = boxes[j];
        if (y > b.minY + PAD && y < b.maxY - PAD
            && maxX > b.minX + PAD && minX < b.maxX - PAD) return false;
      }
      return true;
    }
    var pref = snap20(prefer);
    if (tests(pref)) return pref;
    for (var d = CHAN_STEP; d <= 600; d += CHAN_STEP) {
      if (tests(pref + d)) return pref + d;
      if (tests(pref - d)) return pref - d;
    }
    return pref;
  }

  function cleanTrunkX(prefer, minY, maxY, boxes) {
    if (!boxes || boxes.length === 0) return prefer;
    function tests(x) {
      for (var j = 0; j < boxes.length; j++) {
        var b = boxes[j];
        if (x > b.minX + PAD && x < b.maxX - PAD
            && maxY > b.minY + PAD && minY < b.maxY - PAD) return false;
      }
      return true;
    }
    var pref = snap20(prefer);
    if (tests(pref)) return pref;
    for (var d = CHAN_STEP; d <= 600; d += CHAN_STEP) {
      if (tests(pref + d)) return pref + d;
      if (tests(pref - d)) return pref - d;
    }
    return pref;
  }

  // Build horizontal-trunk wires for a given trunk Y. Pin stubs use lShape
  // which is obstacle + foreign-pin aware when nodePinSet / foreignPinArr
  // are threaded through opts (see connectNode).
  var _curNodePinSet = null, _curForeignPinArr = null, _curReservedEndpoints = null;
  function _setRouteContext(nodePinSet, foreignPinArr, reservedEndpoints) {
    _curNodePinSet = nodePinSet || null;
    _curForeignPinArr = foreignPinArr || null;
    _curReservedEndpoints = reservedEndpoints || null;
  }
  // (legacy comment retained):
  // the trunk is emitted as multiple short segments split at every pin's
  // contact X, so each contact point is a shared wire endpoint. The
  // simulator's pin-merge logic unions wire endpoints only — a pin-stub
  // landing on the interior of a long trunk would leave that pin
  // electrically floating.
  function buildHTrunk(pins, ty, boxes) {
    var xs = pins.map(function(p) { return p.x; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var wires = [];
    pins.forEach(function(p) {
      if (p.y === ty) return;
      var segs = lShape(p, { x: p.x, y: ty }, boxes, _curNodePinSet, _curForeignPinArr, _curReservedEndpoints);
      segs.forEach(function(s) { wires.push(s); });
    });
    if (maxX > minX) {
      var stops = {};
      pins.forEach(function(p) { stops[p.x] = true; });
      stops[minX] = true; stops[maxX] = true;
      var sortedStops = Object.keys(stops).map(Number).sort(function(a, b) { return a - b; });
      for (var i = 0; i < sortedStops.length - 1; i++) {
        wires.push({ x1: sortedStops[i], y1: ty, x2: sortedStops[i+1], y2: ty });
      }
    }
    return wires;
  }

  function buildVTrunk(pins, tx, boxes) {
    var ys = pins.map(function(p) { return p.y; });
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var wires = [];
    pins.forEach(function(p) {
      if (p.x === tx) return;
      var segs = lShape(p, { x: tx, y: p.y }, boxes, _curNodePinSet, _curForeignPinArr, _curReservedEndpoints);
      segs.forEach(function(s) { wires.push(s); });
    });
    if (maxY > minY) {
      var stops = {};
      pins.forEach(function(p) { stops[p.y] = true; });
      stops[minY] = true; stops[maxY] = true;
      var sortedStops = Object.keys(stops).map(Number).sort(function(a, b) { return a - b; });
      for (var i = 0; i < sortedStops.length - 1; i++) {
        wires.push({ x1: tx, y1: sortedStops[i], x2: tx, y2: sortedStops[i+1] });
      }
    }
    return wires;
  }

  // Sprint 70a-fix-3: the simulator's snap-to-nearest-pin radius is 25
  // Chebyshev px (SNAP_TOL in sim-legacy.js), so any wire endpoint whose
  // Chebyshev distance to a foreign pin is <=24 will be wrongly merged
  // into that pin's net. Reject such endpoints. foreignPinArr is an
  // array of {x,y} — for small circuits the O(wires*foreignPins) cost
  // is negligible.
  var SIM_SNAP_TOL = 25;
  function endpointsTouchForeignPin(wires, nodePinSet, foreignPinArr, reservedEndpoints) {
    for (var i = 0; i < wires.length; i++) {
      var w = wires[i];
      var ends = [[w.x1, w.y1], [w.x2, w.y2]];
      for (var e = 0; e < 2; e++) {
        var ex = ends[e][0], ey = ends[e][1];
        var ekey = ex + ',' + ey;
        if (nodePinSet && nodePinSet.has(ekey)) continue;
        // Reserved endpoints from previously-routed nodes — an exact match
        // shorts two otherwise-separate nets when the simulator unions
        // wire endpoints by key.
        if (reservedEndpoints && reservedEndpoints.has && reservedEndpoints.has(ekey)) return true;
        if (foreignPinArr && foreignPinArr.length > 0) {
          for (var j = 0; j < foreignPinArr.length; j++) {
            var fp = foreignPinArr[j];
            var d = Math.max(Math.abs(fp.x - ex), Math.abs(fp.y - ey));
            if (d < SIM_SNAP_TOL) return true;
          }
        }
      }
    }
    return false;
  }

  // A trunk on axis A at value V cannot share that axis-value with any
  // foreign pin — even when the foreign pin is well outside the trunk's
  // extent, some OTHER node's routing later may extend a wire along that
  // line and collide at a shared endpoint. This is the only way to prevent
  // cross-node shorts without a global re-routing pass.
  function trunkAxisConflicts(axisVal, axisKey, foreignPinArr) {
    if (!foreignPinArr || foreignPinArr.length === 0) return false;
    for (var i = 0; i < foreignPinArr.length; i++) {
      if (foreignPinArr[i][axisKey] === axisVal) return true;
    }
    return false;
  }

  function horizontalTrunk(pins, trunkY, boxes, nodePinSet, foreignPinArr, reservedY, reservedEndpoints) {
    if (pins.length < 2) return [];
    var ys = pins.map(function(p) { return p.y; });
    var prefer = trunkY != null ? trunkY : snap20(ys.reduce(function(s,v){return s+v;},0)/ys.length);
    var ty = scanCleanValue(prefer, function(y) {
      if (reservedY && reservedY.has && reservedY.has(y)) return false;
      if (trunkAxisConflicts(y, 'y', foreignPinArr)) return false;
      var w = buildHTrunk(pins, y, boxes);
      if (segmentsHitAny(w, boxes)) return false;
      if (endpointsTouchForeignPin(w, nodePinSet, foreignPinArr, reservedEndpoints)) return false;
      return true;
    });
    return buildHTrunk(pins, ty, boxes);
  }

  function verticalTrunk(pins, trunkX, boxes, nodePinSet, foreignPinArr, reservedX, reservedEndpoints) {
    if (pins.length < 2) return [];
    var xs = pins.map(function(p) { return p.x; });
    var prefer = trunkX != null ? trunkX : snap20(xs.reduce(function(s,v){return s+v;},0)/xs.length);
    var tx = scanCleanValue(prefer, function(x) {
      if (reservedX && reservedX.has && reservedX.has(x)) return false;
      if (trunkAxisConflicts(x, 'x', foreignPinArr)) return false;
      var w = buildVTrunk(pins, x, boxes);
      if (segmentsHitAny(w, boxes)) return false;
      if (endpointsTouchForeignPin(w, nodePinSet, foreignPinArr, reservedEndpoints)) return false;
      return true;
    });
    return buildVTrunk(pins, tx, boxes);
  }

  // Iterate 20-snapped candidates around prefer in expanding +/- pairs.
  // Returns first value for which predicate(v) === true, or prefer otherwise.
  function scanCleanValue(prefer, predicate, maxDist) {
    var p = snap20(prefer);
    if (predicate(p)) return p;
    maxDist = maxDist || 600;
    for (var d = 20; d <= maxDist; d += 20) {
      if (predicate(p + d)) return p + d;
      if (predicate(p - d)) return p - d;
    }
    return p;
  }

  // Two-pin Manhattan connection — tries direct, L-variants, then
  // full-segment-validated U-detours. Sprint 70a-fix-2: the detour scans
  // trunk Y (or X) candidates so that ALL THREE segments (in-stub, trunk,
  // out-stub) clear every body. Earlier version only validated the trunk
  // segment, causing the final vertical drop into the destination pin's
  // own body when that pin sat inside an active device's X range.
  function lShape(pinA, pinB, boxes, nodePinSet, foreignPinArr, reservedEndpoints) {
    if (pinA.x === pinB.x && pinA.y === pinB.y) return [];

    function wiresValid(wires) {
      if (segmentsHitAny(wires, boxes)) return false;
      if (endpointsTouchForeignPin(wires, nodePinSet || new Set(), foreignPinArr || [], reservedEndpoints)) return false;
      return true;
    }

    // Helper: 3-segment U-detour with horizontal trunk at tY.
    function uDetourY(tY) {
      return [
        { x1:pinA.x, y1:pinA.y, x2:pinA.x, y2:tY },
        { x1:pinA.x, y1:tY, x2:pinB.x, y2:tY },
        { x1:pinB.x, y1:tY, x2:pinB.x, y2:pinB.y }
      ];
    }
    // Helper: 3-segment detour with vertical trunk at tX.
    function uDetourX(tX) {
      return [
        { x1:pinA.x, y1:pinA.y, x2:tX, y2:pinA.y },
        { x1:tX, y1:pinA.y, x2:tX, y2:pinB.y },
        { x1:tX, y1:pinB.y, x2:pinB.x, y2:pinB.y }
      ];
    }

    // Collinear pins (same X) — direct is a single vertical wire.
    if (pinA.x === pinB.x) {
      var direct = [{ x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }];
      if (wiresValid(direct)) return direct;
      var cx = scanCleanValue(pinA.x, function(x) { return wiresValid(uDetourX(x)); });
      if (wiresValid(uDetourX(cx))) return uDetourX(cx);
      return direct;
    }

    if (pinA.y === pinB.y) {
      var directH = [{ x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }];
      if (wiresValid(directH)) return directH;
      var cy = scanCleanValue(pinA.y, function(y) { return wiresValid(uDetourY(y)); });
      if (wiresValid(uDetourY(cy))) return uDetourY(cy);
      return directH;
    }

    var variantA = [
      { x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinA.y },
      { x1:pinB.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }
    ];
    var variantB = [
      { x1:pinA.x, y1:pinA.y, x2:pinA.x, y2:pinB.y },
      { x1:pinA.x, y1:pinB.y, x2:pinB.x, y2:pinB.y }
    ];
    if (wiresValid(variantA)) return variantA;
    if (wiresValid(variantB)) return variantB;
    var preferY = snap20((pinA.y + pinB.y) / 2);
    var ty = scanCleanValue(preferY, function(y) { return wiresValid(uDetourY(y)); });
    if (wiresValid(uDetourY(ty))) return uDetourY(ty);
    var preferX = snap20((pinA.x + pinB.x) / 2);
    var tx = scanCleanValue(preferX, function(x) { return wiresValid(uDetourX(x)); });
    if (wiresValid(uDetourX(tx))) return uDetourX(tx);
    // Fallback: choose variant with fewer body hits (connectivity may fail
    // gracefully but the circuit still renders).
    var scoreA = 0, scoreB = 0;
    variantA.forEach(function(s) { boxes.forEach(function(b) { if (segmentHitsBox(s, b)) scoreA++; }); });
    variantB.forEach(function(s) { boxes.forEach(function(b) { if (segmentHitsBox(s, b)) scoreB++; }); });
    return scoreA <= scoreB ? variantA : variantB;
  }

  function countHits(segs, boxes) {
    var c = 0;
    for (var i = 0; i < segs.length; i++)
      for (var j = 0; j < boxes.length; j++)
        if (segmentHitsBox(segs[i], boxes[j])) c++;
    return c;
  }

  function starL(pins, boxes, nodePinSet, foreignPinArr, reservedEndpoints) {
    var wires = [];
    for (var i = 1; i < pins.length; i++) {
      var segs = lShape(pins[0], pins[i], boxes, nodePinSet, foreignPinArr, reservedEndpoints);
      segs.forEach(function(s) { wires.push(s); });
    }
    return wires;
  }

  function connectNode(pins, opts) {
    if (!pins || pins.length < 2) return [];
    opts = opts || {};
    var boxes = opts.boxes || [];
    var nodePinSet = opts.nodePinSet || new Set(pins.map(function(p) { return p.x+','+p.y; }));
    var foreignPinArr = opts.foreignPinArr || new Set();
    var reservedEndpoints = opts.reservedEndpoints || null;
    if (pins.length === 2) return dedupWires(lShape(pins[0], pins[1], boxes, nodePinSet, foreignPinArr, reservedEndpoints));

    _setRouteContext(nodePinSet, foreignPinArr, reservedEndpoints);
    var candidates = [
      { name:'h-trunk', wires: horizontalTrunk(pins, opts.trunkY, boxes, nodePinSet, foreignPinArr, opts.reservedY, reservedEndpoints) },
      { name:'v-trunk', wires: verticalTrunk(pins, opts.trunkX, boxes, nodePinSet, foreignPinArr, opts.reservedX, reservedEndpoints) },
      { name:'star-l',  wires: starL(pins, boxes, nodePinSet, foreignPinArr, reservedEndpoints) }
    ];
    _setRouteContext(null, null, null);
    // Penalise candidates whose wire endpoints land on foreign pins — this
    // would cause the simulator to merge unrelated nets.
    function score(wires) {
      var hits = countHits(wires, boxes);
      var foreign = endpointsTouchForeignPin(wires, nodePinSet, foreignPinArr) ? 1 : 0;
      return foreign * 10000 + hits * 1000 + wires.length;
    }
    var best = candidates[0];
    var bestScore = score(best.wires);
    for (var i = 1; i < candidates.length; i++) {
      var c = candidates[i];
      var s = score(c.wires);
      if (s < bestScore) { best = c; bestScore = s; }
    }
    return dedupWires(best.wires);
  }

  // Consolidate grounds onto a horizontal rail at busY. Sprint 70a-fix-3:
  // The rail is emitted as multiple short segments so EVERY drop's bus
  // contact X and the ground-symbol X are shared wire endpoints. The
  // upstream simulator (src/engine/sim-legacy.js buildCircuitFromCanvas)
  // only unions wire endpoints — a pin lying on a wire's interior stays
  // electrically isolated. Before this fix the ground symbol sat on the
  // middle of a single long bus wire and never joined the ground net,
  // so every node-0 part was marked floating by the DC solver.
  //
  // foreignPinArr (optional) — forbids drop endpoints from landing within
  // SIM_SNAP_TOL-1 of a non-ground pin, which would otherwise be merged
  // by the simulator's snap-to-nearest-pin routine.
  function groundBus(gndPins, busY, boxes, foreignPinArr) {
    if (!gndPins || gndPins.length === 0) return { wires: [], groundX: 0, groundY: busY };
    var wires = [];
    var stops = []; // X positions that must appear as segment endpoints on the bus

    // Foreign-pin proximity predicate: drop endpoints at busY must not fall
    // within SIM_SNAP_TOL-1 of any non-GND pin.
    function busEndpointSafe(x) {
      if (!foreignPinArr || foreignPinArr.length === 0) return true;
      for (var i = 0; i < foreignPinArr.length; i++) {
        var fp = foreignPinArr[i];
        if (Math.max(Math.abs(fp.x - x), Math.abs(fp.y - busY)) < SIM_SNAP_TOL) return false;
      }
      return true;
    }
    gndPins.forEach(function(p) {
      var drop = { x1: p.x, y1: p.y, x2: p.x, y2: busY };
      var directSafe = !segmentsHitAny([drop], boxes) && busEndpointSafe(p.x);
      if (!directSafe) {
        // Scan for a clean detour X that both clears bodies AND keeps the
        // bus-endpoint clear of foreign pins.
        var cleanX = scanCleanValue(p.x, function(x) {
          var w1 = { x1: p.x, y1: p.y, x2: x, y2: p.y };
          var w2 = { x1: x, y1: p.y, x2: x, y2: busY };
          if (segmentsHitAny([w1, w2], boxes)) return false;
          return busEndpointSafe(x);
        });
        wires.push({ x1: p.x, y1: p.y, x2: cleanX, y2: p.y });
        wires.push({ x1: cleanX, y1: p.y, x2: cleanX, y2: busY });
        stops.push(cleanX);
      } else if (p.y !== busY) {
        wires.push(drop);
        stops.push(p.x);
      } else {
        stops.push(p.x);
      }
    });

    // Ground symbol X — centered over the bus stops, 20-snapped, and
    // inserted as an additional stop so it becomes an endpoint too.
    var minX = Math.min.apply(null, stops);
    var maxX = Math.max.apply(null, stops);
    var gx = snap20((minX + maxX) / 2);
    stops.push(gx);

    // Dedup stops and sort ascending.
    var uniq = {};
    stops.forEach(function(x) { uniq[x] = true; });
    var sortedStops = Object.keys(uniq).map(Number).sort(function(a, b) { return a - b; });

    // Emit the bus as consecutive segments so every stop is a shared endpoint.
    for (var i = 0; i < sortedStops.length - 1; i++) {
      wires.push({ x1: sortedStops[i], y1: busY, x2: sortedStops[i+1], y2: busY });
    }

    return { wires: dedupWires(wires), groundX: gx, groundY: busY };
  }

  return {
    connectNode: connectNode,
    groundBus: groundBus,
    horizontalTrunk: function(p,ty,b){return dedupWires(horizontalTrunk(p,ty,b||[]));},
    verticalTrunk: function(p,tx,b){return dedupWires(verticalTrunk(p,tx,b||[]));},
    lShape: function(a,b,bx){return dedupWires(lShape(a,b,bx||[]));},
    segmentHitsBox: segmentHitsBox,
    dedupWires: dedupWires
  };
})();
