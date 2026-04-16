// ──────── SPRINT 56: SPICE IMPORT AUTO-WIRING ENHANCER ────────
// Wraps VXA.SpiceImport.placeCircuit to apply model after placement,
// run a connection check, and log warnings. Does NOT replace the
// underlying placement algorithm (which already does star-wire topology).

(function() {
  'use strict';
  if (typeof VXA === 'undefined' || !VXA.SpiceImport) return;

  var _origPlace = VXA.SpiceImport.placeCircuit;

  VXA.SpiceImport.placeCircuit = function(circuit) {
    // Run original placement (star wiring, ground node, fitToScreen)
    _origPlace.call(VXA.SpiceImport, circuit);

    // Post-placement: apply models to all newly placed parts
    if (typeof VXA.AutoSave !== 'undefined' && VXA.AutoSave.applyModelsToParts) {
      VXA.AutoSave.applyModelsToParts(S.parts);
    } else {
      // Fallback: iterate manually
      S.parts.forEach(function(p) {
        if (!p.model && typeof VXA.Models !== 'undefined' && VXA.Models.getDefault) {
          var def = VXA.Models.getDefault(p.type);
          if (def) {
            p.model = def;
            if (typeof applyModel === 'function') applyModel(p, def);
          }
        } else if (p.model && typeof applyModel === 'function') {
          applyModel(p, p.model);
        }
      });
    }

    // Post-placement: connection check + warnings
    if (typeof VXA.ConnectionCheck !== 'undefined' && VXA.ConnectionCheck.check) {
      var warnings = VXA.ConnectionCheck.check();
      if (warnings.length > 0) {
        VXA.ConnectionCheck.showWarnings(warnings);
      }
    }
  };

  // Expose a global for direct invocation from test / UI
  window.importSPICEWithAutoWiring = function(text) {
    if (!text) return { parts: 0, wires: 0 };
    var circuit = VXA.SpiceImport.parse(text);
    if (!circuit || !circuit.parts || circuit.parts.length === 0) return { parts: 0, wires: 0 };
    var prevParts = S.parts.length;
    var prevWires = S.wires.length;
    VXA.SpiceImport.placeCircuit(circuit);
    return {
      parts: S.parts.length - prevParts,
      wires: S.wires.length - prevWires
    };
  };
})();
