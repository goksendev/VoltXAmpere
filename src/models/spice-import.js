VXA.SpiceImport = (function() {
  // XSS sanitization for user-supplied SPICE text
  function sanitizeId(id) { return String(id).replace(/[^a-zA-Z0-9_.\-]/g, '_'); }
  function sanitizeHTML(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function stripInlineComment(line) {
    var si = line.indexOf(';');
    if (si > 0) line = line.substring(0, si);
    var di = line.indexOf('$');
    if (di > 0) line = line.substring(0, di);
    return line.trimEnd();
  }
  function preprocessLines(text) {
    var raw = text.split('\n'), merged = [];
    raw.forEach(function(line) {
      var t = line.trim(); if (t === '') return;
      if (t.charAt(0) === '+' && merged.length > 0) { merged[merged.length - 1] += ' ' + t.slice(1).trim(); }
      else { merged.push(t); }
    });
    return merged;
  }
  function extractValueAndIC(tokens, startIdx) {
    var val = null, ic = null;
    for (var i = startIdx; i < tokens.length; i++) {
      var tu = tokens[i].toUpperCase();
      if (tu.indexOf('IC=') === 0) { ic = pv(tokens[i].substring(3)); }
      else if (val === null) { var v = pv(tokens[i]); if (!isNaN(v)) val = v; }
    }
    return { val: val, ic: ic };
  }
  var pv; // set in parse()
  function parse(text) {
    // Sprint 38: extract .SUBCKT blocks first (load into VXA.Subcircuit library)
    var subcktCount = 0;
    if (typeof VXA !== 'undefined' && VXA.Subcircuit && /\.subckt/i.test(text)) {
      try {
        var scResult = VXA.Subcircuit.parse(text);
        subcktCount = scResult.subcircuits.length;
      } catch (e) { /* ignore subckt parse errors, continue */ }
    }
    var lines = preprocessLines(text);
    var circuit = { parts: [], models: {}, subcircuits: subcktCount };
    var nodeMap = {}, nextN = 1;
    function gn(name) {
      name = String(name).toUpperCase();
      if (name === '0' || name === 'GND') return 0;
      if (!nodeMap[name]) nodeMap[name] = nextN++;
      return nodeMap[name];
    }
    pv = VXA.SpiceParser.parseSpiceNumber;
    var warnings = [];
    var inSubckt = false;
    lines.forEach(function(rawLine) {
      var line = stripInlineComment(rawLine);
      if (!line || line.charAt(0) === '*' || line.charAt(0) === ';') return;
      if (line.charAt(0) === '.') {
        if (/^\.subckt/i.test(line)) { inSubckt = true; return; }
        if (/^\.ends/i.test(line)) { inSubckt = false; return; }
        if (line.match(/^\.(end|title|lib|include|option|param|global)/i)) return;
        if (inSubckt) return;
        var parsed = VXA.SpiceParser.parseModelLine(line);
        if (parsed) { circuit.models[parsed.name] = parsed; VXA.Models.addCustomModel(parsed.category, parsed.name, parsed.params); }
        return;
      }
      if (inSubckt) return;
      var tk = line.split(/\s+/);
      if (tk.length < 3) return;
      var ch = tk[0].charAt(0).toUpperCase();
      try {
      if (ch === 'R') {
        var rCV = extractValueAndIC(tk, 3);
        circuit.parts.push({ type: 'resistor', nodes: [gn(tk[1]), gn(tk[2])], val: rCV.val != null ? rCV.val : 1000 });
      }
      else if (ch === 'C') {
        var cCV = extractValueAndIC(tk, 3);
        var cPart = { type: 'capacitor', nodes: [gn(tk[1]), gn(tk[2])], val: cCV.val != null ? cCV.val : 1e-6 };
        if (cCV.ic != null) cPart.ic = cCV.ic;
        circuit.parts.push(cPart);
      }
      else if (ch === 'L') {
        var lCV = extractValueAndIC(tk, 3);
        var lPart = { type: 'inductor', nodes: [gn(tk[1]), gn(tk[2])], val: lCV.val != null ? lCV.val : 1e-3 };
        if (lCV.ic != null) lPart.ic = lCV.ic;
        circuit.parts.push(lPart);
      }
      else if (ch === 'V') {
        var spec = tk.slice(3).join(' ').toUpperCase();
        if (spec.indexOf('SIN') >= 0) {
          var m = spec.match(/SIN\(\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)/);
          if (m) circuit.parts.push({ type: 'vac', nodes: [gn(tk[1]), gn(tk[2])], val: pv(m[2]), freq: pv(m[3]) });
        } else if (spec.indexOf('PULSE') >= 0) {
          var m = spec.match(/PULSE\(\s*([^\s]+)\s+([^\s]+)/);
          if (m) circuit.parts.push({ type: 'pulse', nodes: [gn(tk[1]), gn(tk[2])], val: pv(m[2]) });
        } else {
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
        circuit.parts.push({ type: btype, nodes: [gn(tk[2]), gn(tk[1]), gn(tk[3])], model: tk[4] });
      } else if (ch === 'M') {
        var mosModel = circuit.models[tk[5]]; var mtype = (mosModel && mosModel.type === 'PMOS') ? 'pmos' : 'nmos';
        circuit.parts.push({ type: mtype, nodes: [gn(tk[2]), gn(tk[1]), gn(tk[3])], model: tk[5] });
      } else if (ch === 'J') {
        var jModel = circuit.models[tk[4]]; var jtype = (jModel && jModel.type === 'PJF') ? 'pjfet' : 'njfet';
        circuit.parts.push({ type: jtype, nodes: [gn(tk[2]), gn(tk[1]), gn(tk[3])], model: tk[4] });
      } else if (ch === 'X') {
        var subName = tk[tk.length - 1];
        var subNodes = [];
        for (var ti = 1; ti < tk.length - 1; ti++) subNodes.push(gn(tk[ti]));
        circuit.parts.push({ type: 'subcircuit', nodes: subNodes, subcktName: subName });
      }
      // Sprint 60: 8 new SPICE elements — S/B/E/F/G/H/K/T
      else if (ch === 'S') {
        circuit.parts.push({ type: 'switch', nodes: [gn(tk[1]), gn(tk[2])], model: tk[5] || '', closed: true });
      }
      else if (ch === 'B') {
        // Sprint 61: robust B-source — handles V=, V =, V={}, I=, curly braces
        var bRest = line.replace(/^B\S*\s+\S+\s+\S+\s*/i, '').trim();
        var bIsV = true;
        bRest = bRest.replace(/^V\s*=\s*/i, '');
        if (/^I\s*=/i.test(bRest)) { bIsV = false; bRest = bRest.replace(/^I\s*=\s*/i, ''); }
        bRest = bRest.replace(/^\{/, '').replace(/\}\s*$/, '').trim();
        if (!bRest) bRest = '0';
        circuit.parts.push({ type: 'behavioral', nodes: [gn(tk[1]), gn(tk[2])], expression: bRest, srcType: bIsV ? 'V' : 'I' });
      }
      else if (ch === 'E') {
        circuit.parts.push({ type: 'vcvs', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[3]), gn(tk[4])], val: pv(tk[5] || '1') });
      }
      else if (ch === 'G') {
        circuit.parts.push({ type: 'vccs', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[3]), gn(tk[4])], val: pv(tk[5] || '0.001') });
      }
      else if (ch === 'F') {
        circuit.parts.push({ type: 'cccs', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[1]), gn(tk[2])], val: pv(tk[4] || '1') });
      }
      else if (ch === 'H') {
        circuit.parts.push({ type: 'ccvs', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[1]), gn(tk[2])], val: pv(tk[4] || '1000') });
      }
      else if (ch === 'K') {
        circuit.parts.push({ type: 'coupled_l', nodes: [], val: pv(tk[3] || '1'), ref1: tk[1], ref2: tk[2] });
      }
      else if (ch === 'T') {
        var tlZ0 = 50, tlTD = 1e-9;
        for (var tpi = 5; tpi < tk.length; tpi++) {
          var tpu = tk[tpi].toUpperCase();
          if (tpu.indexOf('Z0=') === 0) tlZ0 = pv(tpu.substring(3));
          if (tpu.indexOf('TD=') === 0) tlTD = pv(tpu.substring(3));
        }
        circuit.parts.push({ type: 'tline', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[3]), gn(tk[4])], val: tlZ0, td: tlTD });
      }
      else {
        warnings.push('Unsupported element: ' + sanitizeHTML(tk[0]));
      }
      } catch(e) { warnings.push('Error parsing: ' + sanitizeHTML(line.substring(0, 40)) + ' \u2014 ' + sanitizeHTML(e.message)); }
    });
    circuit.warnings = warnings;
    circuit.nodeCount = nextN;
    return circuit;
  }
  function placeCircuit(circuit) {
    saveUndo();
    var n = circuit.parts.length;
    var cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    var spX = 160, spY = 120;
    var idMap = {};
    circuit.parts.forEach(function(cp, idx) {
      var col = idx % cols, row = Math.floor(idx / cols);
      var def = COMP[cp.type];
      var p = { id: S.nextId++, type: cp.type, name: nextName(cp.type), x: snap(200 + col * spX), y: snap(100 + row * spY), rot: 0, val: cp.val || (def ? def.def : 0), flipH: false, flipV: false };
      if (cp.model) { p.model = cp.model; if (typeof applyModel === 'function') applyModel(p, cp.model); }
      if (cp.freq) p.freq = cp.freq;
      if (cp.ic != null) p.ic = cp.ic;
      if (cp.expression) p.expression = cp.expression;
      if (cp.srcType) p.srcType = cp.srcType;
      if (cp.type === 'subcircuit' && cp.subcktName) {
        p.subcktName = cp.subcktName;
        var sc = (typeof VXA !== 'undefined' && VXA.Subcircuit) ? VXA.Subcircuit.getSubcircuit(cp.subcktName) : null;
        var pinCount = sc ? sc.pins.length : (cp.nodes ? cp.nodes.length : 3);
        var step = 20;
        var leftN = Math.ceil(pinCount / 2), rightN = pinCount - leftN;
        var pins = [];
        for (var li = 0; li < leftN; li++) pins.push({ dx: -40, dy: -((leftN - 1) * step / 2) + li * step });
        for (var ri = 0; ri < rightN; ri++) pins.push({ dx: 40, dy: -((rightN - 1) * step / 2) + ri * step });
        p.pins = pins;
      }
      S.parts.push(p);
      idMap[idx] = p;
    });
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
        var ax = Math.round(positions[i].x), ay = Math.round(positions[i].y);
        var bx = Math.round(positions[i+1].x), by = Math.round(positions[i+1].y);
        if (ax === bx && ay === by) continue;
        S.wires.push({ x1: ax, y1: ay, x2: bx, y2: by });
      }
    });
    if (nodePositions[0] && nodePositions[0].length > 0) {
      var gp = nodePositions[0][0];
      var gy = snap(gp.y + 60);
      S.parts.push({ id: S.nextId++, type: 'ground', name: 'GND', x: snap(gp.x), y: gy, rot: 0, val: 0, flipH: false, flipV: false });
      S.wires.push({ x1: snap(gp.x), y1: snap(gp.y), x2: snap(gp.x), y2: gy - 20 });
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
        var msg = circuit.parts.length + ' bile\u015fen y\u00fcklendi.';
        if (circuit.subcircuits) msg += ' ' + circuit.subcircuits + ' subcircuit k\u00fct\u00fcphaneye eklendi.';
        showInfoCard('SPICE Import', msg, '');
      } else if (circuit.subcircuits) {
        showInfoCard('SPICE Import', circuit.subcircuits + ' subcircuit k\u00fct\u00fcphaneye eklendi.', '');
      } else {
        showInfoCard('SPICE Import', 'Ge\u00e7erli bile\u015fen bulunamad\u0131.', '');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
