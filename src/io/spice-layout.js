// ──────── SPRINT 70a: SPICE IMPORT LAYOUT ENGINE ────────
// Graph-based column/row assignment for imported SPICE circuits.
// Sources → leftmost column, cascaded node depth → increasing columns,
// GND → bottom bus (handled by router). Each column stacks parts vertically.

VXA.SpiceLayout = (function() {
  'use strict';

  // Sprint 70a-fix-2: tighter grid. 20px snap, 120px column pitch, 80px row pitch.
  // 120 = part body (~80) + 40 routing channel. 80 = min safe pitch so a 3-pin
  // NPN/MOS collector pin (dy=-40) cannot fall inside the body of the part
  // above it (body radius 28 + pin lead 40 = 68 required separation).
  var COL_W = 120, ROW_H = 80;

  var SOURCE_TYPES = { vdc: 1, vac: 1, pulse: 1, pwl: 1, idc: 1, iac: 1, noise: 1 };
  var CONTROLLED_TYPES = { vcvs: 1, vccs: 1, ccvs: 1, cccs: 1 };
  var ACTIVE_3PIN = { npn: 1, pnp: 1, nmos: 1, pmos: 1, njfet: 1, pjfet: 1, scr: 1, triac: 1 };
  // Parts that default to VERTICAL pin layout (pins on top/bottom)
  var VERTICAL_DEFAULT = { vdc: 1, vac: 1, pulse: 1, pwl: 1, idc: 1, iac: 1, noise: 1, ground: 1 };
  // Sprint 70a-fix-2: 2-pin passives industry standard — horizontal (rot=0).
  // Matches LTspice, KiCad, Multisim, Falstad default orientation.
  var TWO_PIN_PASSIVE = { resistor: 1, capacitor: 1, inductor: 1, diode: 1, led: 1, zener: 1, fuse: 1, switch: 1 };

  function isSource(type) { return SOURCE_TYPES[type] === 1; }
  function isVerticalDefault(type) { return VERTICAL_DEFAULT[type] === 1; }

  // ─── Main entry ───
  // Input: { parts: [{type, nodes, val, ...}], nodeCount }
  // Output: { placements: [{partIdx, x, y, rot}], nodeDepth: {n: col}, maxCol }
  function computeLayout(circuit) {
    var parts = circuit.parts || [];
    var nodeCount = circuit.nodeCount || 1;
    if (parts.length === 0) {
      return { placements: [], nodeDepth: {}, maxCol: 0 };
    }

    // 1. Build node → [{partIdx, pinIdx}] adjacency
    var nodeToParts = {};
    for (var i = 0; i < nodeCount; i++) nodeToParts[i] = [];
    parts.forEach(function(p, pi) {
      (p.nodes || []).forEach(function(n, pin) {
        if (n != null && nodeToParts[n]) nodeToParts[n].push({ partIdx: pi, pinIdx: pin });
      });
    });

    // 2. Find source rail nodes (positive terminals of V sources)
    var sourceRails = {};
    parts.forEach(function(p) {
      if (isSource(p.type) && p.nodes && p.nodes[0] != null && p.nodes[0] !== 0) {
        sourceRails[p.nodes[0]] = true;
      }
    });
    // Fallback: if no V+ rail, seed with any non-GND node that has degree ≥ 2
    if (Object.keys(sourceRails).length === 0) {
      for (var n = 1; n < nodeCount; n++) {
        if (nodeToParts[n] && nodeToParts[n].length >= 2) { sourceRails[n] = true; break; }
      }
    }

    // 3. BFS depth from source rails — skip through sources themselves
    var nodeDepth = {};
    Object.keys(sourceRails).forEach(function(n) { nodeDepth[n] = 0; });
    var queue = Object.keys(sourceRails).map(Number);
    while (queue.length > 0) {
      var curr = queue.shift();
      var cd = nodeDepth[curr];
      (nodeToParts[curr] || []).forEach(function(ref) {
        var pt = parts[ref.partIdx];
        if (isSource(pt.type)) return; // don't propagate through sources
        (pt.nodes || []).forEach(function(nn) {
          if (nn === curr || nn === 0 || nn == null) return;
          if (nodeDepth[nn] === undefined) {
            nodeDepth[nn] = cd + 1;
            queue.push(nn);
          }
        });
      });
    }
    // Uncolored nodes → depth 1 fallback
    for (var k = 1; k < nodeCount; k++) {
      if (nodeDepth[k] === undefined) nodeDepth[k] = 1;
    }

    // 4. Max depth across non-GND nodes
    var maxDepth = 0;
    Object.keys(nodeDepth).forEach(function(nk) {
      if (+nk !== 0 && nodeDepth[nk] > maxDepth) maxDepth = nodeDepth[nk];
    });

    // 5. Assign each part a column + row + rotation
    var colParts = {}; // col → [partIdx]
    var placements = [];

    parts.forEach(function(p, pi) {
      var ns = (p.nodes || []).filter(function(x) { return x != null; });
      var nonGnd = ns.filter(function(x) { return x !== 0; });
      var col = 0, rot = 0;

      // Column assignment
      if (isSource(p.type)) {
        col = 0; // sources always left
      } else if (ACTIVE_3PIN[p.type] || CONTROLLED_TYPES[p.type] || p.type === 'opamp' || p.type === 'subcircuit') {
        // Active device → place at center of its node-column range.
        // Sprint 70a-fix-2: use explicit undefined check — nodeDepth[n]=0
        // (source rail) is falsy in JS `|| 1` short-circuits, which was
        // pushing every rail-connected part one column too far right.
        if (nonGnd.length === 0) col = 1;
        else {
          var depths = nonGnd.map(function(n) {
            return (nodeDepth[n] !== undefined) ? nodeDepth[n] : 1;
          });
          col = Math.round((Math.min.apply(null, depths) + Math.max.apply(null, depths)) / 2) + 1;
        }
      } else {
        // Passive 2-pin or generic — same fix as above
        if (nonGnd.length === 0) {
          col = maxDepth + 1; // floating GND-only → rightmost
        } else if (nonGnd.length === 1) {
          var dSingle = (nodeDepth[nonGnd[0]] !== undefined) ? nodeDepth[nonGnd[0]] : 1;
          col = dSingle + 1;
        } else {
          var d1 = (nodeDepth[nonGnd[0]] !== undefined) ? nodeDepth[nonGnd[0]] : 1;
          var d2 = (nodeDepth[nonGnd[1]] !== undefined) ? nodeDepth[nonGnd[1]] : 1;
          col = (d1 === d2) ? d1 + 1 : Math.min(d1, d2) + 1;
        }
      }
      if (col < 0) col = 0;

      // Rotation — Sprint 70a-fix-2
      // Sources: rot=0 (natural vertical pin orientation).
      // 2-pin passives: ALWAYS rot=0 (industry standard — horizontal).
      //   Even when connecting to GND or stacking in parallel, router handles
      //   the vertical bus via clean channels; keeping parts horizontal yields
      //   far more compact and readable layouts.
      // Active 3-pin / controlled sources: rot=0 (base/gate on left, C/E on right).
      rot = 0;

      if (!colParts[col]) colParts[col] = [];
      var row = colParts[col].length;
      colParts[col].push(pi);
      placements.push({ partIdx: pi, col: col, row: row, rot: rot, _type: p.type });
    });

    // 6. Convert col/row → x/y (20-snapped). Sprint 70a-fix-4:
    // Per-column ROW_H adapts to content. When a column contains ≥2 parts
    // AND any of them have pins on the vertical axis (V/I sources, 3-pin
    // actives, controlled sources), stacking at ROW_H=80 places adjacent
    // pin leads within the simulator's 25px Chebyshev snap radius of
    // each other — in the worst case EXACTLY coincident (e.g. two V
    // sources 80 apart: bottom pin of upper = top pin of lower). Use
    // ROW_H_WIDE=140 for these columns: it guarantees ≥60 px between
    // the nearest pins of vertically adjacent parts even when both
    // parts have ±40 pin leads.
    var ROW_H_WIDE = 140;
    var VERTICAL_PINNED = {
      vdc:1, vac:1, pulse:1, pwl:1, idc:1, iac:1, noise:1,
      npn:1, pnp:1, nmos:1, pmos:1, njfet:1, pjfet:1,
      vcvs:1, vccs:1, ccvs:1, cccs:1
    };
    var colRowH = {};
    Object.keys(colParts).forEach(function(c) {
      var needsWide = colParts[c].length >= 2 && colParts[c].some(function(pi) {
        return !!VERTICAL_PINNED[parts[pi].type];
      });
      colRowH[c] = needsWide ? ROW_H_WIDE : ROW_H;
    });
    placements.forEach(function(pl) {
      var countInCol = colParts[pl.col].length;
      var rh = colRowH[pl.col] || ROW_H;
      var xRaw = pl.col * COL_W;
      var yRaw = (pl.row - (countInCol - 1) / 2) * rh;
      pl.x = Math.round(xRaw / 20) * 20;
      pl.y = Math.round(yRaw / 20) * 20;
    });

    // 7. Center the whole layout around the origin (x-axis).
    // Y is already centered per column. fitToScreen zoom/pans the view,
    // but centering world coords keeps GND symbol and ground rail
    // symmetric around canvas middle.
    var xMin = Infinity, xMax = -Infinity;
    placements.forEach(function(pl) {
      if (pl.x < xMin) xMin = pl.x;
      if (pl.x > xMax) xMax = pl.x;
    });
    var shift = isFinite(xMin) ? Math.round((xMin + xMax) / 2 / 20) * 20 : 0;
    placements.forEach(function(pl) { pl.x -= shift; });

    return {
      placements: placements,
      nodeDepth: nodeDepth,
      maxCol: maxDepth + 1,
      colParts: colParts
    };
  }

  return { computeLayout: computeLayout };
})();
