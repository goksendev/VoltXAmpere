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

  function horizontalTrunk(pins, trunkY, boxes) {
    if (pins.length < 2) return [];
    var xs = pins.map(function(p) { return p.x; });
    var ys = pins.map(function(p) { return p.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var prefer = trunkY != null ? trunkY : snap20(ys.reduce(function(s,v){return s+v;},0)/ys.length);
    var ty = cleanTrunkY(prefer, minX, maxX, boxes);
    var wires = [];
    pins.forEach(function(p) {
      if (p.y !== ty) wires.push({ x1: p.x, y1: p.y, x2: p.x, y2: ty });
    });
    if (maxX > minX) wires.push({ x1: minX, y1: ty, x2: maxX, y2: ty });
    return wires;
  }

  function verticalTrunk(pins, trunkX, boxes) {
    if (pins.length < 2) return [];
    var xs = pins.map(function(p) { return p.x; });
    var ys = pins.map(function(p) { return p.y; });
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var prefer = trunkX != null ? trunkX : snap20(xs.reduce(function(s,v){return s+v;},0)/xs.length);
    var tx = cleanTrunkX(prefer, minY, maxY, boxes);
    var wires = [];
    pins.forEach(function(p) {
      if (p.x !== tx) wires.push({ x1: p.x, y1: p.y, x2: tx, y2: p.y });
    });
    if (maxY > minY) wires.push({ x1: tx, y1: minY, x2: tx, y2: maxY });
    return wires;
  }

  // Two-pin Manhattan connection, tries both L-variants then U-detour.
  function lShape(pinA, pinB, boxes) {
    if (pinA.x === pinB.x && pinA.y === pinB.y) return [];
    if (pinA.x === pinB.x) return [{ x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }];
    if (pinA.y === pinB.y) return [{ x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }];
    var variantA = [
      { x1:pinA.x, y1:pinA.y, x2:pinB.x, y2:pinA.y },
      { x1:pinB.x, y1:pinA.y, x2:pinB.x, y2:pinB.y }
    ];
    var variantB = [
      { x1:pinA.x, y1:pinA.y, x2:pinA.x, y2:pinB.y },
      { x1:pinA.x, y1:pinB.y, x2:pinB.x, y2:pinB.y }
    ];
    if (!segmentsHitAny(variantA, boxes)) return variantA;
    if (!segmentsHitAny(variantB, boxes)) return variantB;
    // Both L's hit a body — do a U-detour via a clean horizontal channel.
    var minX = Math.min(pinA.x, pinB.x), maxX = Math.max(pinA.x, pinB.x);
    var prefer = snap20((pinA.y + pinB.y) / 2);
    var cleanY = cleanTrunkY(prefer, minX, maxX, boxes);
    return [
      { x1:pinA.x, y1:pinA.y, x2:pinA.x, y2:cleanY },
      { x1:pinA.x, y1:cleanY, x2:pinB.x, y2:cleanY },
      { x1:pinB.x, y1:cleanY, x2:pinB.x, y2:pinB.y }
    ];
  }

  function countHits(segs, boxes) {
    var c = 0;
    for (var i = 0; i < segs.length; i++)
      for (var j = 0; j < boxes.length; j++)
        if (segmentHitsBox(segs[i], boxes[j])) c++;
    return c;
  }

  // Star-L: connect every pin[i≥1] to pin[0] with obstacle-aware L-shape.
  // Used when trunk routing inevitably collides with parts (e.g. 4-pin
  // controlled sources where pins flank a wide body).
  function starL(pins, boxes) {
    var wires = [];
    for (var i = 1; i < pins.length; i++) {
      var segs = lShape(pins[0], pins[i], boxes);
      segs.forEach(function(s) { wires.push(s); });
    }
    return wires;
  }

  function connectNode(pins, opts) {
    if (!pins || pins.length < 2) return [];
    opts = opts || {};
    var boxes = opts.boxes || [];
    if (pins.length === 2) return dedupWires(lShape(pins[0], pins[1], boxes));

    // Try 3 strategies; pick minimum collisions (tiebreaker: fewer wires).
    var candidates = [
      { name:'h-trunk', wires: horizontalTrunk(pins, opts.trunkY, boxes) },
      { name:'v-trunk', wires: verticalTrunk(pins, opts.trunkX, boxes) },
      { name:'star-l',  wires: starL(pins, boxes) }
    ];
    var best = candidates[0];
    var bestScore = countHits(best.wires, boxes) * 1000 + best.wires.length;
    for (var i = 1; i < candidates.length; i++) {
      var c = candidates[i];
      var s = countHits(c.wires, boxes) * 1000 + c.wires.length;
      if (s < bestScore) { best = c; bestScore = s; }
    }
    return dedupWires(best.wires);
  }

  // Consolidate grounds onto a horizontal rail at busY. When a pin's direct
  // drop collides with a part, it exits horizontally to the nearest clean
  // channel X first, then drops.
  function groundBus(gndPins, busY, boxes) {
    if (!gndPins || gndPins.length === 0) return { wires: [], groundX: 0, groundY: busY };
    var wires = [];
    var xs = gndPins.map(function(p) { return p.x; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);

    gndPins.forEach(function(p) {
      var drop = { x1: p.x, y1: p.y, x2: p.x, y2: busY };
      if (segmentsHitAny([drop], boxes)) {
        var cleanX = cleanTrunkX(p.x, Math.min(p.y, busY), Math.max(p.y, busY), boxes);
        wires.push({ x1: p.x, y1: p.y, x2: cleanX, y2: p.y });
        wires.push({ x1: cleanX, y1: p.y, x2: cleanX, y2: busY });
        if (cleanX < minX) minX = cleanX;
        if (cleanX > maxX) maxX = cleanX;
      } else if (p.y !== busY) {
        wires.push(drop);
      }
    });
    if (maxX > minX) wires.push({ x1: minX, y1: busY, x2: maxX, y2: busY });
    return { wires: dedupWires(wires), groundX: snap20((minX+maxX)/2), groundY: busY };
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
