// ──────── SPRINT 38: .SUBCKT FULL SUPPORT (v9.0) ────────
// LTspice-compatible subcircuit parser + instantiator + simulator integration.
// Opens the door to BSIM3, complex op-amp models, vendor SPICE libraries.

VXA.Subcircuit = (function() {
  'use strict';

  // Library: name (UPPERCASE) → subckt definition
  var library = {};
  var MAX_DEPTH = 5; // recursion guard

  // ── PARSER ──────────────────────────────────

  function preprocessLines(text) {
    var raw = String(text || '').split('\n');
    var merged = [];
    var current = '';
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i];
      var trimmed = line.replace(/\r$/, '').trim();
      if (trimmed.length === 0 || trimmed.charAt(0) === '*' || trimmed.charAt(0) === ';') {
        if (current) { merged.push(current); current = ''; }
        continue;
      }
      if (trimmed.charAt(0) === '+') {
        current += ' ' + trimmed.substring(1).trim();
      } else {
        if (current) merged.push(current);
        current = trimmed;
      }
    }
    if (current) merged.push(current);
    return merged;
  }

  function pv(s) {
    return VXA.SpiceParser.parseSpiceNumber(String(s));
  }

  function parseSubcircuit(text) {
    var lines = preprocessLines(text);
    var subcircuits = [];
    var models = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var upper = line.toUpperCase();
      if (upper.indexOf('.SUBCKT') === 0) {
        var result = parseOneSubckt(lines, i);
        if (result.subckt) subcircuits.push(result.subckt);
        i = result.endIndex + 1;
      } else if (upper.indexOf('.MODEL') === 0) {
        var m = VXA.SpiceParser.parseModelLine(line);
        if (m) models.push(m);
        i++;
      } else {
        i++;
      }
    }
    subcircuits.forEach(function(sc) {
      library[sc.name.toUpperCase()] = sc;
    });
    models.forEach(function(m) {
      VXA.Models.addCustomModel(m.category, m.name, m.params);
    });
    return { subcircuits: subcircuits, models: models };
  }

  function parseOneSubckt(lines, startIdx) {
    var headerLine = lines[startIdx];
    var paramsStart = headerLine.toUpperCase().indexOf('PARAMS:');
    var pinPart = paramsStart >= 0 ? headerLine.substring(0, paramsStart) : headerLine;
    var tokens = pinPart.trim().split(/\s+/);
    // tokens[0] = .SUBCKT, tokens[1] = name, rest = pins
    var name = tokens[1] || 'UNNAMED';
    var pins = tokens.slice(2);
    var params = {};
    if (paramsStart >= 0) {
      var paramStr = headerLine.substring(paramsStart + 7).trim();
      paramStr.split(/\s+/).forEach(function(p) {
        var kv = p.split('=');
        if (kv.length === 2) params[kv[0]] = pv(kv[1]);
      });
    }

    var components = [];
    var internalModels = [];
    var endIdx = lines.length - 1;
    for (var i = startIdx + 1; i < lines.length; i++) {
      var line = lines[i];
      var upper = line.toUpperCase();
      if (upper.indexOf('.ENDS') === 0) { endIdx = i; break; }
      if (upper.indexOf('.MODEL') === 0) {
        var m = VXA.SpiceParser.parseModelLine(line);
        if (m) internalModels.push(m);
        continue;
      }
      var comp = parseComponentLine(line);
      if (comp) components.push(comp);
    }

    return {
      subckt: { name: name, pins: pins, params: params, components: components, models: internalModels },
      endIndex: endIdx
    };
  }

  function parseSourceLine(tokens, type) {
    var src = { type: type, name: tokens[0], nodes: [tokens[1], tokens[2]], value: 0 };
    var rest = tokens.slice(3).join(' ');
    var dcMatch = rest.match(/DC\s+([\d.eE+\-]+)/i);
    if (dcMatch) src.value = parseFloat(dcMatch[1]);
    else if (tokens[3] && !isNaN(parseFloat(tokens[3]))) src.value = pv(tokens[3]);
    var sinMatch = rest.match(/SIN\s*\(([^)]+)\)/i);
    if (sinMatch) {
      var sp = sinMatch[1].trim().split(/\s+/);
      src.srcType = 'SIN';
      src.offset = parseFloat(sp[0]) || 0;
      src.amplitude = parseFloat(sp[1]) || 1;
      src.freq = parseFloat(sp[2]) || 1000;
    }
    var pulseMatch = rest.match(/PULSE\s*\(([^)]+)\)/i);
    if (pulseMatch) {
      var pp = pulseMatch[1].trim().split(/\s+/);
      src.srcType = 'PULSE';
      src.v1 = parseFloat(pp[0]) || 0;
      src.v2 = parseFloat(pp[1]) || 5;
    }
    return src;
  }

  function parseComponentLine(line) {
    var tokens = line.split(/\s+/);
    if (tokens.length < 3) return null;
    var name = tokens[0];
    var type = name.charAt(0).toUpperCase();
    function rawOrNum(s, fallback) {
      if (s == null) return fallback;
      // Keep as string to allow parameter substitution; paramVal() resolves at instantiation.
      return s;
    }
    switch (type) {
      case 'R':
        return { type: 'R', name: name, nodes: [tokens[1], tokens[2]], value: rawOrNum(tokens[3], '1k') };
      case 'C':
        var cap = { type: 'C', name: name, nodes: [tokens[1], tokens[2]], value: rawOrNum(tokens[3], '1u') };
        for (var t = 4; t < tokens.length; t++) {
          if (tokens[t].toUpperCase().indexOf('IC=') === 0) cap.ic = parseFloat(tokens[t].substring(3));
        }
        return cap;
      case 'L':
        return { type: 'L', name: name, nodes: [tokens[1], tokens[2]], value: rawOrNum(tokens[3], '1m') };
      case 'D':
        return { type: 'D', name: name, nodes: [tokens[1], tokens[2]], model: tokens[3] || 'D' };
      case 'Q':
        return { type: 'Q', name: name, nodes: [tokens[1], tokens[2], tokens[3]], model: tokens[4] || 'NPN' };
      case 'M':
        var mos = { type: 'M', name: name,
          nodes: [tokens[1], tokens[2], tokens[3], tokens[4] || tokens[3]],
          model: tokens[5] || 'NMOS' };
        return mos;
      case 'V': return parseSourceLine(tokens, 'V');
      case 'I': return parseSourceLine(tokens, 'I');
      case 'E':
        return { type: 'E', name: name, nodes: [tokens[1], tokens[2], tokens[3], tokens[4]],
          gain: pv(tokens[5] || '1') };
      case 'G':
        return { type: 'G', name: name, nodes: [tokens[1], tokens[2], tokens[3], tokens[4]],
          gain: pv(tokens[5] || '1e-3') };
      case 'F':
        return { type: 'F', name: name, nodes: [tokens[1], tokens[2]],
          controlSource: tokens[3], gain: pv(tokens[4] || '1') };
      case 'H':
        return { type: 'H', name: name, nodes: [tokens[1], tokens[2]],
          controlSource: tokens[3], gain: pv(tokens[4] || '1k') };
      case 'X':
        var xParams = {};
        var paramsIdx = line.toUpperCase().indexOf('PARAMS:');
        var headPart = paramsIdx >= 0 ? line.substring(0, paramsIdx).trim() : line;
        if (paramsIdx >= 0) {
          var paramStr = line.substring(paramsIdx + 7).trim();
          paramStr.split(/\s+/).forEach(function(p) {
            var kv = p.split('='); if (kv.length === 2) xParams[kv[0]] = pv(kv[1]);
          });
        }
        var headTokens = headPart.split(/\s+/);
        // last token = subcircuit name, middle tokens = nodes
        var xName = headTokens[headTokens.length - 1];
        var xNodes = headTokens.slice(1, headTokens.length - 1);
        return { type: 'X', name: name, nodes: xNodes, subcktName: xName, params: xParams };
      default:
        return null;
    }
  }

  // ── INSTANTIATION FOR MNA ───────────────────
  // instantiateForMNA(subcktName, externalNodes, instanceName, params, allocNode)
  //   externalNodes: integer array — already-resolved node indices for each pin
  //   allocNode: function that returns a new node index when called
  //   Returns: { comps: [...] } where comps are MNA-ready (matches sim-legacy.js format)

  function instantiateForMNA(subcktName, externalNodes, instanceName, params, allocNode, depth) {
    if (depth === undefined) depth = 0;
    if (depth > MAX_DEPTH) {
      console.warn('[Subcircuit] Max recursion depth exceeded for ' + subcktName);
      return { comps: [] };
    }
    var sc = library[String(subcktName).toUpperCase()];
    if (!sc) {
      console.warn('[Subcircuit] Not found: ' + subcktName);
      return null;
    }
    var mergedParams = {};
    var k;
    for (k in sc.params) mergedParams[k] = sc.params[k];
    if (params) for (k in params) mergedParams[k] = params[k];

    // Pin map: subcircuit pin name → external node index
    var nodeMap = {};
    for (var i = 0; i < sc.pins.length; i++) {
      nodeMap[sc.pins[i]] = (i < externalNodes.length) ? externalNodes[i] : 0;
    }
    nodeMap['0'] = 0;
    nodeMap['GND'] = 0;
    nodeMap['gnd'] = 0;

    // Internal node cache (per instance)
    var internalCache = {};
    function resolve(n) {
      var key = String(n);
      if (nodeMap.hasOwnProperty(key)) return nodeMap[key];
      if (nodeMap.hasOwnProperty(key.toUpperCase())) return nodeMap[key.toUpperCase()];
      if (internalCache.hasOwnProperty(key)) return internalCache[key];
      var newIdx = allocNode();
      internalCache[key] = newIdx;
      return newIdx;
    }

    function paramVal(v) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        var match = v.match(/^\{(\w+)\}$/);
        if (match && mergedParams.hasOwnProperty(match[1])) return mergedParams[match[1]];
        if (mergedParams.hasOwnProperty(v)) return mergedParams[v];
        return pv(v);
      }
      return v;
    }

    // Register internal models
    sc.models.forEach(function(m) {
      VXA.Models.addCustomModel(m.category, m.name, m.params);
    });

    var outComps = [];
    sc.components.forEach(function(comp) {
      var resolved = comp.nodes.map(resolve);
      switch (comp.type) {
        case 'R':
          outComps.push({ type: 'R', n1: resolved[0], n2: resolved[1], val: paramVal(comp.value), _sc: instanceName });
          break;
        case 'C':
          outComps.push({ type: 'C', n1: resolved[0], n2: resolved[1], val: paramVal(comp.value), vPrev: comp.ic || 0, _sc: instanceName });
          break;
        case 'L':
          outComps.push({ type: 'L', n1: resolved[0], n2: resolved[1], val: paramVal(comp.value), iPrev: 0, _sc: instanceName });
          break;
        case 'D':
          var dMdl = VXA.Models.getModel('diode', comp.model);
          var initVd = (dMdl && dMdl.Vf_typ) ? dMdl.Vf_typ * 0.8 : 0.6;
          outComps.push({ type: 'D', n1: resolved[0], n2: resolved[1], part: { type: 'diode', model: comp.model }, vPrev: initVd, _sc: instanceName });
          break;
        case 'Q':
          var bm = VXA.Models.getModel('npn', comp.model) || { BF: 100, IS: 1e-14, NF: 1, VAF: 100 };
          var pol = (bm.type === 'PNP') ? -1 : 1;
          outComps.push({ type: 'BJT', polarity: pol, n1: resolved[0], n2: resolved[1], n3: resolved[2],
            BF: bm.BF || 100, IS: bm.IS || 1e-14, NF: bm.NF || 1, VAF: bm.VAF || 100,
            part: { type: pol === 1 ? 'npn' : 'pnp', model: comp.model }, vbePrev: pol * 0.6, vbcPrev: 0, _sc: instanceName });
          break;
        case 'M':
          var mm = VXA.Models.getModel('nmos', comp.model) || { VTO: 2, KP: 110e-6, LAMBDA: 0.04 };
          var mpol = (mm.type === 'PMOS') ? -1 : 1;
          outComps.push({ type: 'MOS', polarity: mpol, n1: resolved[0], n2: resolved[1], n3: resolved[2],
            VTO: mm.VTO, KP: mm.KP, LAMBDA: mm.LAMBDA,
            part: { type: mpol === 1 ? 'nmos' : 'pmos', model: comp.model }, _sc: instanceName });
          break;
        case 'V':
          outComps.push({ type: 'V', n1: resolved[0], n2: resolved[1], val: comp.value || 0,
            isAC: comp.srcType === 'SIN', freq: comp.freq, _sc: instanceName });
          break;
        case 'I':
          outComps.push({ type: 'I', n1: resolved[0], n2: resolved[1], val: comp.value || 0, _sc: instanceName });
          break;
        case 'E':
          outComps.push({ type: 'VCVS', noP: resolved[0], noN: resolved[1], ncP: resolved[2], ncN: resolved[3],
            gain: comp.gain, _sc: instanceName });
          break;
        case 'G':
          outComps.push({ type: 'VCCS', noP: resolved[0], noN: resolved[1], ncP: resolved[2], ncN: resolved[3],
            gm: comp.gain, _sc: instanceName });
          break;
        case 'F':
          outComps.push({ type: 'CCCS', noP: resolved[0], noN: resolved[1], ncP: 0, ncN: 0,
            alpha: comp.gain, _sc: instanceName });
          break;
        case 'H':
          outComps.push({ type: 'CCVS', noP: resolved[0], noN: resolved[1], ncP: 0, ncN: 0,
            rm: comp.gain, _sc: instanceName });
          break;
        case 'X':
          // Recursive: X uses the resolved node array for its external pins
          var inner = instantiateForMNA(comp.subcktName, resolved,
            instanceName + '.' + comp.name, comp.params, allocNode, depth + 1);
          if (inner && inner.comps) outComps = outComps.concat(inner.comps);
          break;
      }
    });

    return { comps: outComps };
  }

  // ── BUILT-IN SUBCIRCUIT LIBRARY ─────────────
  var BUILT_IN = [
    // Simple op-amp: 5 pins (INP, INN, OUT, VCC, VEE) — ideal-ish VCVS model
    '.SUBCKT SIMPLE_OPAMP INP INN OUT VCC VEE\n' +
    'RIN INP INN 2MEG\n' +
    'E1 MID 0 INP INN 200000\n' +
    'ROUT MID OUT 75\n' +
    '.ENDS SIMPLE_OPAMP',
    // Ideal op-amp: 3 pins (INP, INN, OUT)
    '.SUBCKT IDEAL_OPAMP INP INN OUT\n' +
    'RIN INP INN 1G\n' +
    'E1 MID 0 INP INN 1000000\n' +
    'ROUT MID OUT 1\n' +
    '.ENDS IDEAL_OPAMP',
    // Darlington pair: 3 pins (B, C, E)
    '.SUBCKT DARLINGTON B C E\n' +
    'Q1 C B M1 QNL\n' +
    'Q2 C M1 E QNL\n' +
    '.MODEL QNL NPN(IS=1E-14 BF=200)\n' +
    '.ENDS DARLINGTON',
    // Sziklai pair: 3 pins (B, C, E) — NPN+PNP complementary
    '.SUBCKT SZIKLAI B C E\n' +
    'Q1 M1 B E QNL\n' +
    'Q2 C M1 E QPL\n' +
    'R1 B E 10K\n' +
    '.MODEL QNL NPN(IS=1E-14 BF=200)\n' +
    '.MODEL QPL PNP(IS=1E-14 BF=200)\n' +
    '.ENDS SZIKLAI',
    // Current mirror: 3 pins (IN, OUT, GND)
    '.SUBCKT CURRENT_MIRROR IN OUT GND\n' +
    'Q1 IN IN GND QM\n' +
    'Q2 OUT IN GND QM\n' +
    '.MODEL QM NPN(IS=1E-14 BF=200)\n' +
    '.ENDS CURRENT_MIRROR'
  ];

  function loadBuiltins() {
    BUILT_IN.forEach(function(text) { parseSubcircuit(text); });
  }

  // Auto-load on definition
  loadBuiltins();

  return {
    parse: parseSubcircuit,
    instantiate: instantiateForMNA,
    instantiateForMNA: instantiateForMNA,
    getLibrary: function() { return library; },
    getSubcircuit: function(name) { return library[String(name).toUpperCase()] || null; },
    listNames: function() { return Object.keys(library); },
    clearLibrary: function() { library = {}; loadBuiltins(); },
    getCount: function() { return Object.keys(library).length; },
    BUILT_IN: BUILT_IN
  };
})();
