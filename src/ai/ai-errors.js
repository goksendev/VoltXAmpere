// ──────── AI ERROR DETECTION + AUTO-CORRECTION (v8.0 Sprint 16) ────────
VXA.AIErrors = (function() {
  'use strict';

  var ERROR_TYPES = {
    FLOATING_NODE: { id: 'floating_node', severity: 'error', icon: '\uD83D\uDD0C', name: { tr: 'Ba\u011Flant\u0131s\u0131z Pin', en: 'Floating Node' } },
    NO_GROUND:     { id: 'no_ground',     severity: 'error', icon: '\u23DA',         name: { tr: 'Toprak Ba\u011Flant\u0131s\u0131 Yok', en: 'No Ground Connection' } },
    NO_SOURCE:     { id: 'no_source',     severity: 'error', icon: '\uD83D\uDD0B',   name: { tr: 'Kaynak Yok', en: 'No Power Source' } },
    NO_RESISTOR_LED:{ id: 'no_resistor_led', severity: 'error', icon: '\uD83D\uDCA1', name: { tr: 'Diren\u00e7siz LED', en: 'LED Without Resistor' } },
    SHORT_CIRCUIT: { id: 'short_circuit', severity: 'error', icon: '\u26A1',         name: { tr: 'K\u0131sa Devre', en: 'Short Circuit' } },
    OVERPOWER:     { id: 'overpower',     severity: 'warning', icon: '\uD83D\uDD25', name: { tr: 'G\u00fc\u00e7 A\u015F\u0131m\u0131 Riski', en: 'Power Overload Risk' } },
    REVERSE_POLARITY:{ id: 'reverse_polarity', severity: 'warning', icon: '\uD83D\uDD04', name: { tr: 'Ters Polarite', en: 'Reverse Polarity' } },
    FLOATING_OPAMP:{ id: 'floating_opamp', severity: 'warning', icon: '\uD83D\uDCD0', name: { tr: 'Op-Amp Besleme Yok', en: 'Op-Amp No Supply' } }
  };

  var _lastErrors = null;

  // Check if a pin position is connected to any wire
  function isPinWired(px, py, wires) {
    var tolerance = 2;
    for (var i = 0; i < wires.length; i++) {
      var w = wires[i];
      if ((Math.abs(w.x1 - px) < tolerance && Math.abs(w.y1 - py) < tolerance) ||
          (Math.abs(w.x2 - px) < tolerance && Math.abs(w.y2 - py) < tolerance)) {
        return true;
      }
    }
    return false;
  }

  // Get pin count for a component type
  function getPinCount(type) {
    if (type === 'ground' || type === 'gndLabel' || type === 'vccLabel' || type === 'netLabel') return 1;
    if (type === 'npn' || type === 'pnp' || type === 'nmos' || type === 'pmos' || type === 'opamp') return 3;
    return 2;
  }

  // Find parts connected to a wire endpoint
  function findPartAtPoint(px, py, parts, tolerance) {
    tolerance = tolerance || 2;
    for (var i = 0; i < parts.length; i++) {
      var pins = getPartPins(parts[i]);
      for (var j = 0; j < pins.length; j++) {
        if (Math.abs(pins[j].x - px) < tolerance && Math.abs(pins[j].y - py) < tolerance) {
          return { part: parts[i], pinIndex: j };
        }
      }
    }
    return null;
  }

  // Build connectivity graph from wires
  function buildGraph(parts, wires) {
    // Map each pin to a net ID
    var nets = {}; // "partId:pinIdx" → netId
    var netId = 0;

    // For each wire, connect its two endpoints' pins into the same net
    for (var w = 0; w < wires.length; w++) {
      var wire = wires[w];
      var a = findPartAtPoint(wire.x1, wire.y1, parts, 3);
      var b = findPartAtPoint(wire.x2, wire.y2, parts, 3);
      if (!a && !b) continue;

      var keyA = a ? a.part.id + ':' + a.pinIndex : 'wp:' + wire.x1 + ',' + wire.y1;
      var keyB = b ? b.part.id + ':' + b.pinIndex : 'wp:' + wire.x2 + ',' + wire.y2;

      var netA = nets[keyA];
      var netB = nets[keyB];

      if (netA === undefined && netB === undefined) {
        nets[keyA] = netId;
        nets[keyB] = netId;
        netId++;
      } else if (netA !== undefined && netB === undefined) {
        nets[keyB] = netA;
      } else if (netA === undefined && netB !== undefined) {
        nets[keyA] = netB;
      } else if (netA !== netB) {
        // Merge nets
        var oldNet = netB;
        for (var k in nets) { if (nets[k] === oldNet) nets[k] = netA; }
      }
    }
    return nets;
  }

  // Check if a part has a resistor in its net path (simplified)
  function hasResistorInNet(ledPart, parts, wires) {
    var nets = buildGraph(parts, wires);
    var ledPins = getPartPins(ledPart);

    for (var pin = 0; pin < ledPins.length; pin++) {
      var ledKey = ledPart.id + ':' + pin;
      var ledNet = nets[ledKey];
      if (ledNet === undefined) continue;

      // Check all parts on this net
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].id === ledPart.id) continue;
        if (parts[i].type === 'resistor') {
          var rPins = getPartPins(parts[i]);
          for (var rp = 0; rp < rPins.length; rp++) {
            var rKey = parts[i].id + ':' + rp;
            if (nets[rKey] === ledNet) return true;
          }
        }
      }
    }
    return false;
  }

  return {
    ERROR_TYPES: ERROR_TYPES,

    detect: function(parts, wires) {
      if (!parts) parts = S.parts;
      if (!wires) wires = S.wires;
      if (!parts || parts.length === 0) return [];

      var errors = [];

      // 1. FLOATING NODE
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var pinCount = getPinCount(p.type);
        var pins = getPartPins(p);
        for (var pin = 0; pin < Math.min(pinCount, pins.length); pin++) {
          if (!isPinWired(pins[pin].x, pins[pin].y, wires)) {
            // Labels are self-connected
            if (p.type === 'netLabel' || p.type === 'vccLabel' || p.type === 'gndLabel') continue;
            errors.push({
              type: ERROR_TYPES.FLOATING_NODE,
              partId: p.id, partType: p.type, pin: pin,
              message: (p.name || p.id) + ' pin ' + pin + ' is not connected',
              fix: null
            });
          }
        }
      }

      // 2. NO GROUND
      var hasGround = parts.some(function(p) {
        return p.type === 'ground' || p.type === 'gndLabel';
      });
      if (!hasGround && parts.length > 1) {
        errors.push({
          type: ERROR_TYPES.NO_GROUND,
          message: 'Circuit has no ground reference',
          fix: { action: 'addGround', description: { tr: 'Toprak bile\u015Feni ekle', en: 'Add ground component' } }
        });
      }

      // 3. NO SOURCE
      var hasSource = parts.some(function(p) {
        return p.type === 'dcSource' || p.type === 'acSource' || p.type === 'vdc' || p.type === 'vac' || p.type === 'vccLabel';
      });
      if (!hasSource && parts.length > 1) {
        errors.push({
          type: ERROR_TYPES.NO_SOURCE,
          message: 'Circuit has no power source',
          fix: null
        });
      }

      // 4. NO RESISTOR LED
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].type === 'led') {
          if (!hasResistorInNet(parts[j], parts, wires)) {
            var Vs = 5;
            for (var s = 0; s < parts.length; s++) {
              if (parts[s].type === 'dcSource' || parts[s].type === 'vdc') { Vs = parts[s].val || 5; break; }
            }
            var Vf = 1.8, If = 0.02;
            var R = Math.round((Vs - Vf) / If);
            var e12 = [100,120,150,180,220,270,330,390,470,560,680,820,1000];
            var bestR = e12[e12.length - 1];
            for (var e = 0; e < e12.length; e++) {
              if (e12[e] >= R) { bestR = e12[e]; break; }
            }
            errors.push({
              type: ERROR_TYPES.NO_RESISTOR_LED,
              partId: parts[j].id,
              message: (parts[j].name || parts[j].id) + ' has no current limiting resistor. Recommended: ' + bestR + '\u03A9',
              fix: { action: 'addResistorForLED', partId: parts[j].id, resistorValue: bestR,
                     description: { tr: bestR + '\u03A9 diren\u00e7 ekle', en: 'Add ' + bestR + '\u03A9 resistor' } }
            });
          }
        }
      }

      // 5. SHORT CIRCUIT — DC source pins directly wired together
      for (var sc = 0; sc < parts.length; sc++) {
        var sp = parts[sc];
        if (sp.type === 'dcSource' || sp.type === 'acSource' || sp.type === 'vdc' || sp.type === 'vac') {
          var sPins = getPartPins(sp);
          if (sPins.length >= 2) {
            var nets = buildGraph(parts, wires);
            var k0 = sp.id + ':0', k1 = sp.id + ':1';
            if (nets[k0] !== undefined && nets[k0] === nets[k1]) {
              // Check if there's any resistance in between
              var hasLoad = false;
              for (var lp = 0; lp < parts.length; lp++) {
                if (parts[lp].id === sp.id) continue;
                if (parts[lp].type === 'resistor' || parts[lp].type === 'led' || parts[lp].type === 'inductor') {
                  var lpPins = getPartPins(parts[lp]);
                  for (var lpp = 0; lpp < lpPins.length; lpp++) {
                    if (nets[parts[lp].id + ':' + lpp] === nets[k0]) { hasLoad = true; break; }
                  }
                  if (hasLoad) break;
                }
              }
              if (!hasLoad) {
                errors.push({
                  type: ERROR_TYPES.SHORT_CIRCUIT,
                  partId: sp.id,
                  message: (sp.name || sp.id) + ' terminals are short-circuited',
                  fix: null
                });
              }
            }
          }
        }
      }

      // 6. OVERPOWER (sim running)
      if (S.sim.running) {
        for (var op = 0; op < parts.length; op++) {
          var opp = parts[op];
          var power = Math.abs((opp._v || 0) * (opp._i || 0));
          var pMax = (opp._thermal && opp._thermal.Pmax) ? opp._thermal.Pmax : 0.25;
          if (power > pMax * 0.8) {
            errors.push({
              type: ERROR_TYPES.OVERPOWER,
              partId: opp.id, partType: opp.type,
              power: power, maxPower: pMax,
              message: (opp.name || opp.id) + ' at ' + Math.round(power / pMax * 100) + '% power capacity',
              fix: null
            });
          }
        }
      }

      _lastErrors = errors;
      return errors;
    },

    applyFix: function(fix) {
      if (!fix || !fix.action) return { success: false, error: 'No fix action' };

      if (fix.action === 'addGround') {
        var maxY = 0, avgX = 0;
        for (var i = 0; i < S.parts.length; i++) {
          if (S.parts[i].y > maxY) maxY = S.parts[i].y;
          avgX += S.parts[i].x;
        }
        avgX = S.parts.length > 0 ? Math.round(avgX / S.parts.length / 20) * 20 : 200;
        var gy = Math.round((maxY + 100) / 20) * 20;
        var gnd = VXA.addComponent('ground', avgX, gy);
        return { success: !!gnd, message: 'Ground added', partId: gnd ? gnd.id : null };
      }

      if (fix.action === 'addResistorForLED') {
        var led = S.parts.find(function(p) { return p.id === fix.partId; });
        if (!led) return { success: false, error: 'LED not found' };
        var rx = led.x - 100, ry = led.y;
        var res = VXA.addComponent('resistor', rx, ry, { val: fix.resistorValue });
        if (res) {
          // Wire resistor pin1 to LED pin0
          var resPins = getPartPins(res);
          var ledPins = getPartPins(led);
          if (resPins.length >= 2 && ledPins.length >= 1) {
            VXA.addWire(resPins[1].x, resPins[1].y, ledPins[0].x, ledPins[0].y);
          }
          return { success: true, message: fix.resistorValue + '\u03A9 resistor added', partId: res.id };
        }
        return { success: false, error: 'Could not add resistor' };
      }

      return { success: false, error: 'Unknown fix action: ' + fix.action };
    },

    getSummary: function(errors) {
      if (!errors) errors = _lastErrors || [];
      var s = { total: errors.length, errors: 0, warnings: 0 };
      for (var i = 0; i < errors.length; i++) {
        if (errors[i].type.severity === 'error') s.errors++; else s.warnings++;
      }
      return s;
    },

    getLastErrors: function() { return _lastErrors; },
    clearErrors: function() { _lastErrors = null; }
  };
})();

// Canvas error overlay
function drawErrorOverlay(ctx) {
  var errors = VXA.AIErrors ? VXA.AIErrors.getLastErrors() : null;
  if (!errors || errors.length === 0) return;

  for (var i = 0; i < errors.length; i++) {
    var err = errors[i];
    if (!err.partId) continue;
    var part = S.parts.find(function(p) { return p.id === err.partId; });
    if (!part) continue;

    var color = err.type.severity === 'error' ? '#ff4444' : '#ffaa00';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(part.x - 28, part.y - 20, 56, 40);
    ctx.setLineDash([]);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(err.type.icon, part.x + 22, part.y - 22);
    ctx.restore();
  }
}
