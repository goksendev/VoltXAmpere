// ──────── SPRINT 40: .IC INITIAL CONDITIONS (v9.0) ────────
// SPICE-compatible initial conditions for nodes and inductor currents.
// Also seeds capacitor initial voltages via part.icVoltage.

VXA.InitialConditions = (function() {
  'use strict';

  var conditions = [];

  function parseICLine(line) {
    var content = String(line).replace(/^\.IC\s+/i, '').trim();
    // Match: V(name)=value  or  I(name)=value
    var re = /([VI])\s*\(\s*([^)]+)\s*\)\s*=\s*([\d.eE+\-]+\w*)/gi;
    var m, count = 0;
    while ((m = re.exec(content)) !== null) {
      var type = m[1].toUpperCase();
      var node = m[2].trim();
      var val = (typeof VXA.SpiceParser !== 'undefined')
        ? VXA.SpiceParser.parseSpiceNumber(m[3])
        : parseFloat(m[3]);
      conditions.push({ type: type, node: node, value: val });
      count++;
    }
    return count;
  }

  // Apply IC values to a nodeVoltages array + component state (L.iPrev, cap.vPrev).
  // nodeNameMap: optional { "out":3, "MID":5 } for net-label-to-index resolution.
  function apply(nodeVoltages, nodeNameMap, components) {
    if (!Array.isArray(conditions) || conditions.length === 0) return 0;
    var applied = 0;
    conditions.forEach(function(ic) {
      if (ic.type === 'V') {
        var idx = parseInt(ic.node, 10);
        if (isNaN(idx) && nodeNameMap) {
          if (nodeNameMap[ic.node] !== undefined) idx = nodeNameMap[ic.node];
          else if (nodeNameMap[ic.node.toUpperCase()] !== undefined) idx = nodeNameMap[ic.node.toUpperCase()];
        }
        if (Array.isArray(components) && isNaN(idx)) {
          // Try component-name match (e.g. V(C1) → C1's first node)
          for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var cn = c.part && c.part.name;
            if (cn && String(cn).toUpperCase() === ic.node.toUpperCase()) {
              if (typeof c.n1 === 'number') { idx = c.n1; break; }
            }
          }
        }
        if (typeof idx === 'number' && idx >= 0 && nodeVoltages && idx < nodeVoltages.length) {
          nodeVoltages[idx] = ic.value;
          applied++;
        }
      } else if (ic.type === 'I' && Array.isArray(components)) {
        for (var j = 0; j < components.length; j++) {
          var comp = components[j];
          var name = comp.part && comp.part.name;
          if (name && String(name).toUpperCase() === ic.node.toUpperCase() && comp.type === 'L') {
            comp.iPrev = ic.value;
            applied++;
            break;
          }
        }
      }
    });
    return applied;
  }

  // Apply V(<name>) entries to parts (capacitors) by writing part.icVoltage.
  function applyToCapacitors(parts) {
    if (!Array.isArray(parts)) return 0;
    var applied = 0;
    conditions.forEach(function(ic) {
      if (ic.type !== 'V') return;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p || !p.name) continue;
        if (String(p.name).toUpperCase() === ic.node.toUpperCase() &&
            (p.type === 'capacitor' || p.type === 'cap' || p.type === 'C')) {
          p.icVoltage = ic.value;
          applied++;
        }
      }
    });
    return applied;
  }

  function getAll() { return conditions.slice(); }
  function clear() { conditions = []; }
  function hasConditions() { return conditions.length > 0; }

  return {
    parse: parseICLine,
    parseICLine: parseICLine,
    apply: apply,
    applyToCapacitors: applyToCapacitors,
    getAll: getAll,
    clear: clear,
    hasConditions: hasConditions
  };
})();
