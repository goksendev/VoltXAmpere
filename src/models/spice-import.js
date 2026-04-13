VXA.SpiceImport = (function() {
  // XSS sanitization for user-supplied SPICE text
  function sanitizeId(id) { return String(id).replace(/[^a-zA-Z0-9_.\-]/g, '_'); }
  function sanitizeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function preprocessLines(text) {
    var raw = text.split('\n'), merged = [];
    raw.forEach(function(line) {
      var t = line.trim(); if (t === '') return;
      if (t.charAt(0) === '+' && merged.length > 0) { merged[merged.length - 1] += ' ' + t.slice(1).trim(); }
      else { merged.push(t); }
    });
    return merged;
  }
  function parse(text) {
    var lines = preprocessLines(text);
    var circuit = { parts: [], models: {} };
    var nodeMap = {}, nextN = 1;
    function gn(name) { if (name === '0' || name.toLowerCase() === 'gnd') return 0; if (!nodeMap[name]) nodeMap[name] = nextN++; return nodeMap[name]; }
    var pv = VXA.SpiceParser.parseSpiceNumber;
    var warnings = [];
    lines.forEach(function(line) {
      if (line.charAt(0) === '*' || line.charAt(0) === ';') return; // comment lines
      if (line.charAt(0) === '.') {
        if (line.match(/^\.(end|title|lib|include|option|param|global|subckt|ends)/i)) return; // known directives — skip silently
        var parsed = VXA.SpiceParser.parseModelLine(line);
        if (parsed) { circuit.models[parsed.name] = parsed; VXA.Models.addCustomModel(parsed.category, parsed.name, parsed.params); }
        return;
      }
      var tk = line.split(/\s+/);
      if (tk.length < 3) return;
      var ch = tk[0].charAt(0).toUpperCase();
      try {
      if (ch === 'R') circuit.parts.push({ type: 'resistor', nodes: [gn(tk[1]), gn(tk[2])], val: pv(tk[3] || '1000') });
      else if (ch === 'C') circuit.parts.push({ type: 'capacitor', nodes: [gn(tk[1]), gn(tk[2])], val: pv(tk[3] || '1u') });
      else if (ch === 'L') circuit.parts.push({ type: 'inductor', nodes: [gn(tk[1]), gn(tk[2])], val: pv(tk[3] || '1m') });
      else if (ch === 'V') {
        var spec = tk.slice(3).join(' ').toUpperCase();
        if (spec.indexOf('SIN') >= 0) {
          var m = spec.match(/SIN\(\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)/);
          if (m) circuit.parts.push({ type: 'vac', nodes: [gn(tk[1]), gn(tk[2])], val: pv(m[2]), freq: pv(m[3]) });
        } else if (spec.indexOf('PULSE') >= 0) {
          var m = spec.match(/PULSE\(\s*([^\s]+)\s+([^\s]+)/);
          if (m) circuit.parts.push({ type: 'pulse', nodes: [gn(tk[1]), gn(tk[2])], val: pv(m[2]) });
        } else {
          // Handle "DC 3.3 AC 1" combined format — extract DC value, ignore AC for DC import
          var dcMatch = spec.match(/DC\s+([^\s]+)/i);
          var dcVal = dcMatch ? pv(dcMatch[1]) : pv(spec.replace(/^DC\s*/i, '').replace(/\s*AC\s+.*/i, '') || '5');
          circuit.parts.push({ type: 'vdc', nodes: [gn(tk[1]), gn(tk[2])], val: dcVal });
        }
      } else if (ch === 'I') {
        circuit.parts.push({ type: 'idc', nodes: [gn(tk[1]), gn(tk[2])], val: pv(tk[3] || '1m') });
      } else if (ch === 'D') {
        circuit.parts.push({ type: 'diode', nodes: [gn(tk[1]), gn(tk[2])], model: tk[3] });
      } else if (ch === 'Q') {
        var bjtModel = circuit.models[tk[4]]; var btype = (bjtModel && bjtModel.type === 'PNP') ? 'pnp' : 'npn';
        circuit.parts.push({ type: btype, nodes: [gn(tk[2]), gn(tk[1]), gn(tk[3])], model: tk[4] }); // B,C,E → VXA order
      } else if (ch === 'M') {
        var mosModel = circuit.models[tk[5]]; var mtype = (mosModel && mosModel.type === 'PMOS') ? 'pmos' : 'nmos';
        circuit.parts.push({ type: mtype, nodes: [gn(tk[2]), gn(tk[1]), gn(tk[3])], model: tk[5] }); // G,D,S → VXA order
      } else {
        warnings.push('Skipped unknown line: ' + sanitizeHTML(line.substring(0, 60)));
      }
      } catch(e) { warnings.push('Error parsing: ' + sanitizeHTML(line.substring(0, 40)) + ' — ' + sanitizeHTML(e.message)); }
    });
    circuit.warnings = warnings;
    circuit.nodeCount = nextN;
    return circuit;
  }
  function placeCircuit(circuit) {
    saveUndo();
    var cols = Math.max(1, Math.ceil(Math.sqrt(circuit.parts.length))), sp = 80;
    var idMap = {};
    circuit.parts.forEach(function(cp, idx) {
      var col = idx % cols, row = Math.floor(idx / cols);
      var p = { id: S.nextId++, type: cp.type, name: nextName(cp.type), x: snap(200 + col * sp), y: snap(100 + row * sp), rot: 0, val: cp.val || COMP[cp.type].def, flipH: false, flipV: false };
      if (cp.model) { p.model = cp.model; applyModel(p, cp.model); }
      if (cp.freq) p.freq = cp.freq;
      S.parts.push(p);
      idMap[idx] = p;
    });
    // Auto-connect by SPICE nodes
    var nodePositions = {};
    circuit.parts.forEach(function(cp, idx) {
      var part = idMap[idx]; if (!part) return;
      var pins = getPartPins(part);
      cp.nodes.forEach(function(nodeIdx, pinIdx) {
        if (pinIdx >= pins.length) return;
        if (!nodePositions[nodeIdx]) nodePositions[nodeIdx] = [];
        nodePositions[nodeIdx].push({ x: pins[pinIdx].x, y: pins[pinIdx].y });
      });
    });
    Object.keys(nodePositions).forEach(function(nodeIdx) {
      var positions = nodePositions[nodeIdx]; if (positions.length < 2) return;
      for (var i = 0; i < positions.length - 1; i++) {
        S.wires.push({ x1: snap(positions[i].x), y1: snap(positions[i].y), x2: snap(positions[i + 1].x), y2: snap(positions[i + 1].y) });
      }
    });
    // Add ground for node 0
    if (nodePositions[0] && nodePositions[0].length > 0) {
      var gp = nodePositions[0][0];
      S.parts.push({ id: S.nextId++, type: 'ground', name: 'GND', x: snap(gp.x), y: snap(gp.y + 40), rot: 0, val: 0, flipH: false, flipV: false });
      S.wires.push({ x1: snap(gp.x), y1: snap(gp.y), x2: snap(gp.x), y2: snap(gp.y + 20) });
    }
    fitToScreen();
    needsRender = true; updateInspector();
  }
  return { parse: parse, placeCircuit: placeCircuit };
})();
function importSPICENetlist() {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.cir,.spice,.net,.sp,.txt';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var circuit = VXA.SpiceImport.parse(ev.target.result);
      if (circuit.parts.length > 0) {
        VXA.SpiceImport.placeCircuit(circuit);
        showInfoCard('SPICE Import', circuit.parts.length + ' bileşen yüklendi.', '');
      } else {
        showInfoCard('SPICE Import', 'Geçerli bileşen bulunamadı.', '');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
