// ──────── SPRINT 46: NETLIST EDITOR (v9.0) ────────
// Live bidirectional SPICE netlist editor.
// API:
//   VXA.NetlistEditor.generate()                → canonical netlist text
//   VXA.NetlistEditor.highlight(text)           → HTML with syntax classes
//   VXA.NetlistEditor.apply(oldText, newText)   → propagate edits to S.parts
//   VXA.NetlistEditor.parseNetlistLine(line)    → {name, type, value, model}
//   VXA.NetlistEditor.formatSpiceValue(n)       → "1k" / "100n" / etc.
//   VXA.NetlistEditor.autocomplete(prefix)      → suggestion list
//   VXA.NetlistEditor.validate(text)            → [{line, col, message}]

VXA.NetlistEditor = (function() {
  'use strict';

  function formatSpiceValue(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    var av = Math.abs(val);
    if (av === 0) return '0';
    if (av >= 1e6)    return (val / 1e6).toString() + 'MEG';
    if (av >= 1e3)    return (val / 1e3).toString() + 'k';
    if (av >= 1)      return val.toString();
    if (av >= 1e-3)   return (val * 1e3).toString() + 'm';
    if (av >= 1e-6)   return (val * 1e6).toString() + 'u';
    if (av >= 1e-9)   return (val * 1e9).toString() + 'n';
    if (av >= 1e-12)  return (val * 1e12).toString() + 'p';
    return val.toExponential(3);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Build a map from internal node index → textual name. Uses buildCircuit's
  // pin-to-node snapshot (populated after any sim step / buildCircuitFromCanvas).
  function refreshNodeMap() {
    if (typeof buildCircuitFromCanvas === 'function') {
      try { buildCircuitFromCanvas(); } catch (e) { /* ignore */ }
    }
  }

  function nodesForPart(part) {
    if (!part) return [0, 0, 0, 0];
    var nodes = [];
    if (typeof getPartPins !== 'function' || typeof S === 'undefined' || !S || !S._pinToNode) {
      return [0, 0, 0, 0];
    }
    var pins;
    try { pins = getPartPins(part); } catch (e) { return [0, 0, 0, 0]; }
    for (var i = 0; i < pins.length; i++) {
      var key = Math.round(pins[i].x) + ',' + Math.round(pins[i].y);
      nodes.push(S._pinToNode[key] || 0);
    }
    while (nodes.length < 4) nodes.push(0);
    return nodes;
  }

  function nodeName(n, labelMap) {
    if (!n) return '0';
    if (labelMap && labelMap[n]) return labelMap[n];
    return String(n);
  }

  function buildLabelMap() {
    var map = {};
    if (typeof S === 'undefined' || !Array.isArray(S.parts)) return map;
    // Give net-labels priority over numeric indices
    for (var i = 0; i < S.parts.length; i++) {
      var p = S.parts[i];
      if (p.type === 'netLabel' || p.type === 'netlabel' || p.type === 'vccLabel' || p.type === 'gndLabel') {
        var nodes = nodesForPart(p);
        if (nodes[0]) {
          var lbl = p.type === 'vccLabel' ? 'VCC'
                  : p.type === 'gndLabel' ? 'GND'
                  : (p.label || p.val || ('NET' + nodes[0]));
          map[nodes[0]] = String(lbl).toUpperCase();
        }
      }
    }
    return map;
  }

  function partToSpiceLine(part, idx, labelMap) {
    if (!part) return null;
    var type = part.type;
    if (type === 'ground' || type === 'netLabel' || type === 'netlabel' ||
        type === 'vccLabel' || type === 'gndLabel') return null;

    var name = part.name ? String(part.name).replace(/[^A-Za-z0-9_]/g, '') : '';
    var nodes = nodesForPart(part);
    var n1 = nodeName(nodes[0], labelMap);
    var n2 = nodeName(nodes[1], labelMap);
    var n3 = nodeName(nodes[2], labelMap);

    function prefix(letter) {
      if (name && name.charAt(0).toUpperCase() === letter) return name;
      return letter + (name || (idx + 1));
    }

    switch (type) {
      case 'resistor':
        return prefix('R') + ' ' + n1 + ' ' + n2 + ' ' + formatSpiceValue(part.val || 0);
      case 'capacitor':
        var ic = (typeof part.icVoltage === 'number' && part.icVoltage !== 0) ? (' IC=' + part.icVoltage) : '';
        return prefix('C') + ' ' + n1 + ' ' + n2 + ' ' + formatSpiceValue(part.val || 0) + ic;
      case 'inductor':
        return prefix('L') + ' ' + n1 + ' ' + n2 + ' ' + formatSpiceValue(part.val || 0);
      case 'vdc':
        var vline = prefix('V') + ' ' + n1 + ' ' + n2 + ' DC ' + (part.val || 0);
        if (part.srcType === 'SIN') vline += ' SIN(' + (part.dcOffset || 0) + ' ' + (part.amplitude || 1) + ' ' + (part.freq || 1000) + ')';
        else if (part.srcType === 'PULSE') vline += ' PULSE(0 ' + (part.val || 5) + ' 0 1n 1n ' + ((part.duty || 0.5) / (part.freq || 1000)) + ' ' + (1 / (part.freq || 1000)) + ')';
        else if (part.srcType === 'PWL' && Array.isArray(part.pwlPoints)) vline += ' PWL(' + part.pwlPoints.map(function(p) { return p[0] + ' ' + p[1]; }).join(' ') + ')';
        return vline;
      case 'vac':
        return prefix('V') + ' ' + n1 + ' ' + n2 + ' SIN(' + (part.dcOffset || 0) + ' ' + (part.amplitude || part.val || 1) + ' ' + (part.freq || 1000) + ')';
      case 'pulse':
        return prefix('V') + ' ' + n1 + ' ' + n2 + ' PULSE(0 ' + (part.val || 5) + ' 0 1n 1n ' + (0.5 / (part.freq || 1000)) + ' ' + (1 / (part.freq || 1000)) + ')';
      case 'pwl':
        var pts = Array.isArray(part.pwlPoints) ? part.pwlPoints : [[0, 0], [1e-3, part.val || 5]];
        return prefix('V') + ' ' + n1 + ' ' + n2 + ' PWL(' + pts.map(function(p) { return p[0] + ' ' + p[1]; }).join(' ') + ')';
      case 'idc':
        return prefix('I') + ' ' + n1 + ' ' + n2 + ' ' + formatSpiceValue(part.val || 0);
      case 'diode':
        return prefix('D') + ' ' + n1 + ' ' + n2 + ' ' + (part.model || '1N4148');
      case 'led':
        return prefix('D') + ' ' + n1 + ' ' + n2 + ' ' + (part.model || 'RED_5MM');
      case 'zener':
        return prefix('D') + ' ' + n1 + ' ' + n2 + ' ' + (part.model || '1N4733');
      case 'schottky':
        return prefix('D') + ' ' + n1 + ' ' + n2 + ' ' + (part.model || '1N5819');
      case 'npn':
        return prefix('Q') + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + (part.model || '2N2222');
      case 'pnp':
        return prefix('Q') + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + (part.model || '2N3906');
      case 'nmos':
        return prefix('M') + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + n3 + ' ' + (part.model || 'Generic');
      case 'pmos':
        return prefix('M') + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + n3 + ' ' + (part.model || 'Generic');
      case 'opamp':
        return '* ' + prefix('X') + ' op-amp (' + (part.model || 'LM741') + ', macro model)';
      case 'subcircuit':
        var nList = nodes.slice(0, part.pins ? part.pins.length : nodes.length).map(function(n) { return nodeName(n, labelMap); }).join(' ');
        return prefix('X') + ' ' + nList + ' ' + (part.subcktName || 'UNKNOWN');
      default:
        return '* ' + prefix('X') + ' (' + type + ') = ' + (part.val || 0);
    }
  }

  function generate() {
    refreshNodeMap();
    var lines = [];
    lines.push('* VoltXAmpere v9.0 — Live Netlist');
    lines.push('* ' + new Date().toISOString().slice(0, 19));
    lines.push('');
    var labelMap = buildLabelMap();
    if (typeof S !== 'undefined' && Array.isArray(S.parts)) {
      for (var i = 0; i < S.parts.length; i++) {
        var line = partToSpiceLine(S.parts[i], i, labelMap);
        if (line) lines.push(line);
      }
    }
    var cmdArea = (typeof document !== 'undefined') ? document.getElementById('cmd-input') : null;
    if (cmdArea && cmdArea.value && cmdArea.value.trim().length > 0) {
      lines.push('');
      lines.push('* ── Commands tab ──');
      cmdArea.value.split('\n').forEach(function(l) { if (l.trim()) lines.push(l); });
    }
    lines.push('');
    lines.push('.END');
    return lines.join('\n');
  }

  function highlight(text) {
    return String(text).split('\n').map(function(line) {
      var trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.charAt(0) === '*' || trimmed.charAt(0) === ';') {
        return '<span class="nl-comment">' + escapeHtml(line) + '</span>';
      }
      if (trimmed.charAt(0) === '.') {
        var cmd = trimmed.split(/\s+/)[0];
        var pre = line.substring(0, line.indexOf(cmd));
        var rest = line.substring(line.indexOf(cmd) + cmd.length);
        return escapeHtml(pre) +
               '<span class="nl-command">' + escapeHtml(cmd) + '</span>' +
               escapeHtml(rest);
      }
      if (/^[RCLVIDEQMXJKSGFHB]/i.test(trimmed)) {
        // Number of pin-node tokens depends on element type.
        //   R/C/L/V/I/D : 2 nodes
        //   Q/J         : 3 nodes
        //   M           : 4 nodes (D G S B)
        //   X           : variable — treat anything but last token as node
        var firstChar = trimmed.charAt(0).toUpperCase();
        var nodeTokenCount = ({R:2, C:2, L:2, V:2, I:2, D:2, Q:3, J:3, M:4}[firstChar]) || 2;
        var tokens = line.match(/\S+|\s+/g) || [];
        var out = '';
        var wordIdx = 0;
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          if (/^\s+$/.test(t)) { out += t; continue; }
          if (wordIdx === 0) out += '<span class="nl-component">' + escapeHtml(t) + '</span>';
          else if (wordIdx <= nodeTokenCount) out += '<span class="nl-node">' + escapeHtml(t) + '</span>';
          else out += '<span class="nl-value">' + escapeHtml(t) + '</span>';
          wordIdx++;
        }
        return out;
      }
      return escapeHtml(line);
    }).join('\n');
  }

  function parseNetlistLine(line) {
    var trimmed = String(line || '').trim();
    if (!trimmed || trimmed.charAt(0) === '*' || trimmed.charAt(0) === ';' || trimmed.charAt(0) === '.') return null;
    var tokens = trimmed.split(/\s+/);
    if (tokens.length < 3) return null;
    var name = tokens[0];
    var type = name.charAt(0).toUpperCase();
    var result = { name: name, type: type };
    if (/^[RCL]$/.test(type)) {
      result.value = VXA.SpiceParser ? VXA.SpiceParser.parseSpiceNumber(tokens[3] || '0') : parseFloat(tokens[3]);
    } else if (type === 'V' || type === 'I') {
      var valTok = (tokens[3] && tokens[3].toUpperCase() === 'DC') ? tokens[4] : tokens[3];
      result.value = parseFloat(valTok);
    } else if (type === 'D' || type === 'Q' || type === 'M') {
      result.model = tokens[tokens.length - 1];
    }
    return result;
  }

  function apply(oldText, newText) {
    if (typeof S === 'undefined' || !Array.isArray(S.parts)) return 0;
    var oldLines = String(oldText).split('\n');
    var newLines = String(newText).split('\n');
    var n = Math.min(oldLines.length, newLines.length);
    var applied = 0;
    for (var i = 0; i < n; i++) {
      if (oldLines[i] === newLines[i]) continue;
      var oldP = parseNetlistLine(oldLines[i]);
      var newP = parseNetlistLine(newLines[i]);
      if (!oldP || !newP || oldP.name !== newP.name) continue;
      var part = S.parts.find(function(p) { return p.name === newP.name; });
      if (!part) continue;
      if (typeof newP.value === 'number' && isFinite(newP.value) && newP.value !== oldP.value) {
        part.val = newP.value;
        applied++;
      }
      if (newP.model && newP.model !== oldP.model) {
        part.model = newP.model;
        if (typeof applyModel === 'function') applyModel(part, newP.model);
        applied++;
      }
    }
    if (applied > 0 && typeof needsRender !== 'undefined') needsRender = true;
    return applied;
  }

  // ── AUTOCOMPLETE ─────────────────────────────
  var COMMANDS = ['.TRAN','.AC','.DC','.PARAM','.STEP','.MEAS','.IC','.MODEL','.SUBCKT','.ENDS','.END','.LIB','.OP','.INCLUDE','.PRINT','.PLOT'];
  var ELEMENTS = [
    { tok: 'R', desc: 'Resistor' },
    { tok: 'C', desc: 'Capacitor' },
    { tok: 'L', desc: 'Inductor' },
    { tok: 'V', desc: 'Voltage source' },
    { tok: 'I', desc: 'Current source' },
    { tok: 'D', desc: 'Diode' },
    { tok: 'Q', desc: 'BJT' },
    { tok: 'M', desc: 'MOSFET' },
    { tok: 'X', desc: 'Subcircuit instance' },
    { tok: 'J', desc: 'JFET' },
    { tok: 'K', desc: 'Coupled inductor' }
  ];

  function autocomplete(prefix) {
    var p = String(prefix || '').trim();
    if (!p) return [];
    var up = p.toUpperCase();
    var out = [];
    if (up.charAt(0) === '.') {
      for (var i = 0; i < COMMANDS.length; i++) {
        if (COMMANDS[i].indexOf(up) === 0) out.push({ text: COMMANDS[i], kind: 'command' });
      }
    } else {
      for (var j = 0; j < ELEMENTS.length; j++) {
        if (ELEMENTS[j].tok.indexOf(up) === 0) out.push({ text: ELEMENTS[j].tok, kind: 'element', desc: ELEMENTS[j].desc });
      }
      // Model names
      if (VXA.Models && VXA.Models.listModels) {
        var cats = ['npn','pnp','nmos','pmos','diode','led','zener','opamp','vreg'];
        for (var k = 0; k < cats.length; k++) {
          var ms = VXA.Models.listModels(cats[k]);
          for (var m = 0; m < ms.length; m++) {
            if (ms[m].name.toUpperCase().indexOf(up) === 0) {
              out.push({ text: ms[m].name, kind: 'model', desc: ms[m].desc });
            }
          }
        }
      }
    }
    return out.slice(0, 20);
  }

  // ── VALIDATE ─────────────────────────────────
  function validate(text) {
    var errors = [];
    var lines = String(text).split('\n');
    var known = 'RCLVIDEQMXJKSGFHB';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '*' || line.charAt(0) === ';' || line.charAt(0) === '.') continue;
      var firstChar = line.charAt(0).toUpperCase();
      if (known.indexOf(firstChar) < 0) {
        errors.push({ line: i + 1, col: 1, message: 'Unknown element prefix: ' + firstChar });
        continue;
      }
      var tokens = line.split(/\s+/);
      if (tokens.length < 3) {
        errors.push({ line: i + 1, col: 1, message: 'Too few tokens — expected at least name n1 n2' });
      }
    }
    return errors;
  }

  return {
    generate: generate,
    highlight: highlight,
    apply: apply,
    parseNetlistLine: parseNetlistLine,
    formatSpiceValue: formatSpiceValue,
    escapeHtml: escapeHtml,
    autocomplete: autocomplete,
    validate: validate,
    COMMANDS: COMMANDS,
    ELEMENTS: ELEMENTS
  };
})();
