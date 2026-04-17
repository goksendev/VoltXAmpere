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
    // Sprint 69 FIX: First pass — collect V source name → {n1, n2} for F/H references.
    // SPICE Fxxx/Hxxx format: "Fname out+ out- vname gain"
    // vname refers to an already-defined V source; control current = current
    // through that V source (direction: n1 → n2).
    var vNameMap = {};
    {
      var inSubPre = false;
      var linesPre = lines;
      for (var _li = 0; _li < linesPre.length; _li++) {
        var _pLine = stripInlineComment(linesPre[_li]);
        if (!_pLine || _pLine.charAt(0) === '*' || _pLine.charAt(0) === ';') continue;
        if (_pLine.charAt(0) === '.') {
          if (/^\.subckt/i.test(_pLine)) inSubPre = true;
          else if (/^\.ends/i.test(_pLine)) inSubPre = false;
          continue;
        }
        if (inSubPre) continue;
        var _pTk = _pLine.split(/\s+/);
        if (_pTk.length < 3) continue;
        var _pCh = _pTk[0].charAt(0).toUpperCase();
        if (_pCh === 'V') {
          vNameMap[_pTk[0].toUpperCase()] = { n1: _pTk[1], n2: _pTk[2] };
        }
      }
    }
    lines.forEach(function(rawLine) {
      var line = stripInlineComment(rawLine);
      if (!line || line.charAt(0) === '*' || line.charAt(0) === ';') return;
      if (line.charAt(0) === '.') {
        if (/^\.subckt/i.test(line)) { inSubckt = true; return; }
        if (/^\.ends/i.test(line)) { inSubckt = false; return; }
        if (/^\.tran\s/i.test(line)) {
          var tranTk = line.replace(/\.tran\s+/i, '').split(/\s+/);
          circuit.tran = { dt: pv(tranTk[0]) || 1e-5, tstop: pv(tranTk[1]) || 0.01 };
          if (tranTk[2]) circuit.tran.tstart = pv(tranTk[2]);
          if (tranTk[3]) circuit.tran.dtmax = pv(tranTk[3]);
          return;
        }
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
        // SPICE format: Ename out+ out- ctrl+ ctrl- gain
        // Sprint 69 FIX: sim-legacy VCVS expects [ncP, ncN, noP, noN] — control first.
        circuit.parts.push({ type: 'vcvs', nodes: [gn(tk[3]), gn(tk[4]), gn(tk[1]), gn(tk[2])], val: pv(tk[5] || '1') });
      }
      else if (ch === 'G') {
        // SPICE format: Gname out+ out- ctrl+ ctrl- gm
        // Sprint 69 FIX: sim-legacy VCCS expects [ncP, ncN, noP, noN] — control first.
        circuit.parts.push({ type: 'vccs', nodes: [gn(tk[3]), gn(tk[4]), gn(tk[1]), gn(tk[2])], val: pv(tk[5] || '0.001') });
      }
      else if (ch === 'F') {
        // Fname out+ out- vname gain — current-controlled current source
        // Control current flows through V source "vname" (n1→n2 direction)
        // Sprint 69 FIX v2: Sim-legacy builds CCCS as
        //   {ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3]}
        // i.e. control pins FIRST, output pins SECOND. Order nodes accordingly.
        var _fVn = (tk[3] || '').toUpperCase();
        var _fVnode = vNameMap[_fVn];
        var _fGain = pv(tk[4] || '1');
        if (_fVnode) {
          circuit.parts.push({ type: 'cccs', nodes: [gn(_fVnode.n1), gn(_fVnode.n2), gn(tk[1]), gn(tk[2])], val: _fGain });
        } else {
          warnings.push('F' + sanitizeHTML(tk[0].substring(1)) + ': V source "' + sanitizeHTML(tk[3] || '') + '" not found');
        }
      }
      else if (ch === 'H') {
        // Hname out+ out- vname transresistance — current-controlled voltage source
        // Sprint 69 FIX v2: same node ordering as F — control first, output second.
        var _hVn = (tk[3] || '').toUpperCase();
        var _hVnode = vNameMap[_hVn];
        var _hRm = pv(tk[4] || '1000');
        if (_hVnode) {
          circuit.parts.push({ type: 'ccvs', nodes: [gn(_hVnode.n1), gn(_hVnode.n2), gn(tk[1]), gn(tk[2])], val: _hRm });
        } else {
          warnings.push('H' + sanitizeHTML(tk[0].substring(1)) + ': V source "' + sanitizeHTML(tk[3] || '') + '" not found');
        }
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
      else if (ch === 'W') {
        // Current-controlled switch: W<name> n+ n- vname modelname
        // Control current flows through V source "vname". Store vname as metadata;
        // runtime switch is open/closed based on whether control current > threshold.
        var _wVname = (tk[3] || '').toUpperCase();
        var _wVnode = vNameMap[_wVname];
        var _wPart = { type: 'switch', nodes: [gn(tk[1]), gn(tk[2])], model: tk[4] || '', closed: true };
        if (_wVnode) { _wPart.vctrl = _wVname; _wPart.vctrlN1 = gn(_wVnode.n1); _wPart.vctrlN2 = gn(_wVnode.n2); }
        else warnings.push('W' + sanitizeHTML(tk[0].substring(1)) + ': V source "' + sanitizeHTML(tk[3] || '') + '" not found — treated as simple switch');
        circuit.parts.push(_wPart);
      }
      else if (ch === 'O') {
        // Lossy transmission line: O<name> n1+ n1- n2+ n2- modelname
        // Kept as a warning because full lossy TL requires the RLGC model parsed
        // from .model, which is currently not implemented — treat as lossless.
        circuit.parts.push({ type: 'tline', nodes: [gn(tk[1]), gn(tk[2]), gn(tk[3]), gn(tk[4])], model: tk[5] || '', val: 50, td: 1e-9 });
        warnings.push('O' + sanitizeHTML(tk[0].substring(1)) + ': lossy transmission line treated as lossless (Z0=50\u03a9, TD=1ns)');
      }
      else if (ch === 'Y') {
        // Sprint 75: SCR thyristor.
        // Format: Y<name> <anode> <gate> <cathode> [model]
        // (sim-legacy.js builds comps with nodes = [A, K, G]; we push
        // in that order so the downstream latch engine sees the right
        // pins.)
        circuit.parts.push({
          type: 'scr',
          nodes: [gn(tk[1]), gn(tk[3]), gn(tk[2])],
          model: tk[4] || ''
        });
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
  // Sprint 70a: Professional schematic layout — topology-sorted columns,
  // Manhattan routing, single consolidated ground bus. Replaces naive sqrt grid.
  function placeCircuit(circuit) {
    saveUndo();

    // Sprint 70a-fix-2: reset scope traces and sim clock on fresh import.
    // Scope buffers persist across imports; without zeroing, a ghost trace
    // from a previous circuit paints the new canvas before simulation starts.
    if (S.scope && S.scope.ch) {
      S.scope.ch.forEach(function(ch) { if (ch.buf) ch.buf.fill(0); });
      S.scope.ptr = 0;
    }
    if (S.sim) S.sim.t = 0;
    // Clear residual thermal / damage state on any carryover parts.
    S.parts.forEach(function(pp) {
      if (pp._thermal) pp._thermal = null;
      if (pp._damage) pp._damage = null;
    });

    var layout = (VXA.SpiceLayout && VXA.SpiceLayout.computeLayout)
      ? VXA.SpiceLayout.computeLayout(circuit)
      : null;
    var idMap = {};

    if (layout && layout.placements.length === circuit.parts.length) {
      // New engine path
      layout.placements.forEach(function(pl) {
        var cp = circuit.parts[pl.partIdx];
        var def = COMP[cp.type];
        var p = {
          id: S.nextId++, type: cp.type, name: nextName(cp.type),
          x: pl.x, y: pl.y, rot: pl.rot,
          val: cp.val != null ? cp.val : (def ? def.def : 0),
          flipH: false, flipV: false
        };
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
          var sPins = [];
          for (var li = 0; li < leftN; li++) sPins.push({ dx: -40, dy: -((leftN - 1) * step / 2) + li * step });
          for (var ri = 0; ri < rightN; ri++) sPins.push({ dx: 40, dy: -((rightN - 1) * step / 2) + ri * step });
          p.pins = sPins;
        }
        S.parts.push(p);
        idMap[pl.partIdx] = p;
      });
    } else {
      // Legacy fallback (shouldn't happen, but defensive)
      var n = circuit.parts.length;
      var cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      circuit.parts.forEach(function(cp, idx) {
        var col = idx % cols, row = Math.floor(idx / cols);
        var def = COMP[cp.type];
        var p = { id: S.nextId++, type: cp.type, name: nextName(cp.type), x: snap(200 + col * 160), y: snap(100 + row * 120), rot: 0, val: cp.val || (def ? def.def : 0), flipH: false, flipV: false };
        if (cp.model) { p.model = cp.model; if (typeof applyModel === 'function') applyModel(p, cp.model); }
        if (cp.freq) p.freq = cp.freq;
        if (cp.ic != null) p.ic = cp.ic;
        S.parts.push(p);
        idMap[idx] = p;
      });
    }

    // Collect pin positions per node
    var nodePins = {};
    circuit.parts.forEach(function(cp, idx) {
      var part = idMap[idx]; if (!part) return;
      var pins = getPartPins(part);
      (cp.nodes || []).forEach(function(nodeIdx, pinIdx) {
        if (nodeIdx == null || pinIdx >= pins.length) return;
        if (!nodePins[nodeIdx]) nodePins[nodeIdx] = [];
        nodePins[nodeIdx].push({
          x: Math.round(pins[pinIdx].x),
          y: Math.round(pins[pinIdx].y)
        });
      });
    });

    // Compute axis-aligned body bounding boxes for obstacle-aware routing.
    // Body radius chosen per part family; pins extend beyond body (±40 typ.),
    // so wires may legally terminate AT pins but not pass THROUGH the body.
    var BODY_R = {
      resistor:20, capacitor:20, inductor:20, diode:20, led:20,
      vdc:22, vac:22, idc:22, iac:22, pulse:22, pwl:22, noise:22,
      npn:28, pnp:28, nmos:28, pmos:28, njfet:28, pjfet:28,
      vcvs:24, vccs:24, ccvs:24, cccs:24,
      ground:14, switch:18, opamp:24, behavioral:22
    };
    var boxes = S.parts.map(function(pp) {
      var r = BODY_R[pp.type] || 20;
      return { minX: pp.x - r, maxX: pp.x + r, minY: pp.y - r, maxY: pp.y + r,
               type: pp.type, x: pp.x, y: pp.y };
    });

    // Build a map of all part pin coordinates so the router can avoid
    // ending a wire endpoint within the simulator's 25px snap radius of
    // a foreign pin (which would merge two otherwise-separate nodes).
    var allPinKeys = new Set();
    var allPinArr = [];
    circuit.parts.forEach(function(cp, idx) {
      var part = idMap[idx]; if (!part) return;
      getPartPins(part).forEach(function(pt) {
        var x = Math.round(pt.x), y = Math.round(pt.y);
        var k = x + ',' + y;
        if (!allPinKeys.has(k)) { allPinKeys.add(k); allPinArr.push({x:x, y:y}); }
      });
    });

    // Manhattan routing for non-GND nodes (obstacle-aware).
    // Sprint 70a-fix-3: reserve each node's trunk axis-values so the next
    // node's router avoids overlapping the same Y/X line — otherwise two
    // nodes' trunks collide at the crossing coordinate and the simulator
    // unions them into a single net. Longer trunks (spanning 3+ pins) are
    // the ones that materially compete for grid lines, so we reserve Y/X
    // only for trunk segments ≥ 60px.
    var router = VXA.SpiceRouter;
    var reservedY = new Set();
    var reservedX = new Set();
    // Array of {x,y} coordinates — the simulator treats each prior wire
    // endpoint as a snap target, so a new endpoint within 25 Chebyshev
    // of any prior endpoint gets merged. Store coordinates, not strings,
    // so the router can run proximity checks without parsing.
    var reservedEndpointArr = [];
    var reservedEndpointSet = new Set();
    function reserveEndpoint(x, y) {
      var k = x + ',' + y;
      if (reservedEndpointSet.has(k)) return;
      reservedEndpointSet.add(k);
      reservedEndpointArr.push({ x: x, y: y });
    }
    Object.keys(nodePins).forEach(function(nodeIdx) {
      if (+nodeIdx === 0) return;
      var pins = nodePins[nodeIdx];
      if (!pins || pins.length < 2) return;
      if (router && router.connectNode) {
        var nodeKeys = new Set(pins.map(function(p) { return p.x+','+p.y; }));
        var foreignArr = allPinArr.filter(function(pp) {
          return !nodeKeys.has(pp.x + ',' + pp.y);
        });
        var segs = router.connectNode(pins, {
          boxes: boxes, nodePinSet: nodeKeys, foreignPinArr: foreignArr,
          reservedY: reservedY, reservedX: reservedX,
          reservedEndpointArr: reservedEndpointArr
        });
        segs.forEach(function(w) {
          S.wires.push(w);
          reserveEndpoint(w.x1, w.y1);
          reserveEndpoint(w.x2, w.y2);
        });
        segs.forEach(function(w) {
          var len = Math.max(Math.abs(w.x2 - w.x1), Math.abs(w.y2 - w.y1));
          if (len < 40) return;
          if (w.y1 === w.y2) reservedY.add(w.y1);
          else if (w.x1 === w.x2) reservedX.add(w.x1);
        });
      } else {
        for (var i = 0; i < pins.length - 1; i++) {
          S.wires.push({ x1: pins[i].x, y1: pins[i].y, x2: pins[i+1].x, y2: pins[i+1].y });
        }
      }
    });

    // Ground bus consolidation — single horizontal rail + one ground symbol.
    // Sprint 70a-fix-4: busY must also clear reservedY (trunks already
    // routed by prior nodes) otherwise the bus wire endpoints coincide
    // with a non-GND node's trunk endpoints and the two nets merge in
    // the simulator. Bump busY downwards until it is not reserved.
    if (nodePins[0] && nodePins[0].length > 0) {
      var maxPinY = -Infinity;
      S.parts.forEach(function(pp) {
        getPartPins(pp).forEach(function(pin) { if (pin.y > maxPinY) maxPinY = pin.y; });
      });
      var busY = snap(maxPinY + 40);
      // Keep busY at least SIM_SNAP_TOL+1 (=26) away from every reserved
      // trunk Y, so wire endpoints on the bus cannot snap into a prior
      // node's trunk endpoints.
      function tooCloseToReserved(y) {
        var arr = Array.from(reservedY);
        for (var i = 0; i < arr.length; i++) if (Math.abs(y - arr[i]) <= 25) return true;
        return false;
      }
      var guard = 0;
      while (tooCloseToReserved(busY) && guard++ < 50) busY = snap(busY + 20);
      if (router && router.groundBus) {
        var gb = router.groundBus(nodePins[0], busY, boxes, allPinArr, reservedEndpointArr);
        gb.wires.forEach(function(w) { S.wires.push(w); });
        S.parts.push({
          id: S.nextId++, type: 'ground', name: 'GND',
          x: gb.groundX, y: snap(busY + 20),
          rot: 0, val: 0, flipH: false, flipV: false
        });
      } else {
        var gp = nodePins[0][0];
        S.parts.push({ id: S.nextId++, type: 'ground', name: 'GND', x: snap(gp.x), y: snap(gp.y + 60), rot: 0, val: 0, flipH: false, flipV: false });
      }
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
