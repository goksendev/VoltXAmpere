// ──────── DIGITAL SIMULATION ENGINE (v8.0 Sprint 17) ────────
VXA.Digital = (function() {
  'use strict';

  // ===== EVENT QUEUE =====
  var _eventQueue = [];
  var _currentTime = 0;
  var _nodeStates = {};
  var _componentStates = {};
  var _history = {};
  var _isRunning = false;
  var _maxHistory = 10000;

  // ===== GATE DEFINITIONS =====
  var GATE_DEFS = {
    and:    { inputs: 2, outputs: 1, delay: 10e-9, fn: function(a, b) { return a && b; } },
    or:     { inputs: 2, outputs: 1, delay: 10e-9, fn: function(a, b) { return a || b; } },
    not:    { inputs: 1, outputs: 1, delay: 5e-9,  fn: function(a) { return !a; } },
    nand:   { inputs: 2, outputs: 1, delay: 10e-9, fn: function(a, b) { return !(a && b); } },
    nor:    { inputs: 2, outputs: 1, delay: 10e-9, fn: function(a, b) { return !(a || b); } },
    xor:    { inputs: 2, outputs: 1, delay: 12e-9, fn: function(a, b) { return a !== b; } },
    xnor:   { inputs: 2, outputs: 1, delay: 12e-9, fn: function(a, b) { return a === b; } },
    buffer: { inputs: 1, outputs: 1, delay: 5e-9,  fn: function(a) { return a; } }
  };

  // ===== FLIP-FLOP DEFINITIONS =====
  var FF_DEFS = {
    dFlipFlop: {
      compType: 'dff',
      pins: ['D', 'CLK', 'Q', 'Qbar'],
      inputPins: [0, 1],
      outputPins: [2, 3],
      delay: 8e-9,
      init: function() { return { Q: false, prevCLK: false }; },
      evaluate: function(state, inputs) {
        var r = { Q: state.Q };
        if (inputs.CLK && !state.prevCLK) r.Q = inputs.D;
        r.prevCLK = inputs.CLK;
        return r;
      },
      getOutputs: function(state) { return { Q: state.Q, Qbar: !state.Q }; }
    },
    jkFlipFlop: {
      compType: 'jkff',
      pins: ['J', 'K', 'CLK', 'Q', 'Qbar'],
      inputPins: [0, 1, 2],
      outputPins: [3, 4],
      delay: 10e-9,
      init: function() { return { Q: false, prevCLK: false }; },
      evaluate: function(state, inputs) {
        var r = { Q: state.Q };
        if (inputs.CLK && !state.prevCLK) {
          if (inputs.J && inputs.K) r.Q = !state.Q;
          else if (inputs.J) r.Q = true;
          else if (inputs.K) r.Q = false;
        }
        r.prevCLK = inputs.CLK;
        return r;
      },
      getOutputs: function(state) { return { Q: state.Q, Qbar: !state.Q }; }
    },
    tFlipFlop: {
      compType: 'tff',
      pins: ['T', 'CLK', 'Q', 'Qbar'],
      inputPins: [0, 1],
      outputPins: [2, 3],
      delay: 8e-9,
      init: function() { return { Q: false, prevCLK: false }; },
      evaluate: function(state, inputs) {
        var r = { Q: state.Q };
        if (inputs.CLK && !state.prevCLK && inputs.T) r.Q = !state.Q;
        r.prevCLK = inputs.CLK;
        return r;
      },
      getOutputs: function(state) { return { Q: state.Q, Qbar: !state.Q }; }
    }
  };

  // ===== COMPLEX COMPONENT DEFINITIONS =====
  var COMPLEX_DEFS = {
    counter4bit: {
      compType: 'counter',
      pins: ['CLK', 'Q0', 'Q1', 'Q2', 'Q3'],
      inputPins: [0],
      outputPins: [1, 2, 3, 4],
      delay: 15e-9,
      init: function() { return { count: 0, prevCLK: false }; },
      evaluate: function(state, inputs) {
        var r = { count: state.count };
        if (inputs.CLK && !state.prevCLK) r.count = (state.count + 1) % 16;
        r.prevCLK = inputs.CLK;
        return r;
      },
      getOutputs: function(state) {
        return { Q0: !!(state.count & 1), Q1: !!(state.count & 2), Q2: !!(state.count & 4), Q3: !!(state.count & 8) };
      }
    },
    shiftReg: {
      compType: 'shiftreg',
      pins: ['DIN', 'CLK', 'Q'],
      inputPins: [0, 1],
      outputPins: [2],
      delay: 12e-9,
      init: function() { return { reg: 0, prevCLK: false }; },
      evaluate: function(state, inputs) {
        var r = { reg: state.reg };
        if (inputs.CLK && !state.prevCLK) r.reg = ((state.reg << 1) | (inputs.DIN ? 1 : 0)) & 0xFF;
        r.prevCLK = inputs.CLK;
        return r;
      },
      getOutputs: function(state) { return { Q: !!(state.reg & 0x80) }; }
    },
    mux2to1: {
      compType: 'mux',
      pins: ['A', 'B', 'SEL', 'Y'],
      inputPins: [0, 1, 2],
      outputPins: [3],
      delay: 8e-9,
      init: function() { return {}; },
      evaluate: function(state) { return state; },
      getOutputs: function(state, inputs) { return { Y: inputs.SEL ? inputs.B : inputs.A }; }
    },
    sevenSegment: {
      compType: '7seg',
      pins: ['A', 'B', 'C', 'D', 'sa', 'sb', 'sc', 'sd', 'se', 'sf', 'sg'],
      inputPins: [0, 1, 2, 3],
      outputPins: [4, 5, 6, 7, 8, 9, 10],
      delay: 5e-9,
      _table: [0x7E,0x30,0x6D,0x79,0x33,0x5B,0x5F,0x70,0x7F,0x7B,0x77,0x1F,0x4E,0x3D,0x4F,0x47],
      init: function() { return {}; },
      evaluate: function(state) { return state; },
      getOutputs: function(state, inputs) {
        var bcd = (inputs.A?1:0)|(inputs.B?2:0)|(inputs.C?4:0)|(inputs.D?8:0);
        var seg = this._table[bcd] || 0;
        return { sa:!!(seg&0x40), sb:!!(seg&0x20), sc:!!(seg&0x10), sd:!!(seg&0x08), se:!!(seg&0x04), sf:!!(seg&0x02), sg:!!(seg&0x01) };
      }
    }
  };

  // Map COMP type key → definition
  function getDigitalDef(compType) {
    if (GATE_DEFS[compType]) return { type: 'gate', def: GATE_DEFS[compType] };
    for (var k in FF_DEFS) { if (FF_DEFS[k].compType === compType) return { type: 'ff', def: FF_DEFS[k] }; }
    for (var c in COMPLEX_DEFS) { if (COMPLEX_DEFS[c].compType === compType) return { type: 'complex', def: COMPLEX_DEFS[c] }; }
    return null;
  }

  // ===== EVENT QUEUE OPS =====
  function insertEvent(time, nodeId, value, sourceId) {
    var ev = { time: time, nodeId: nodeId, value: value, sourceId: sourceId };
    var lo = 0, hi = _eventQueue.length;
    while (lo < hi) { var mid = (lo + hi) >>> 1; if (_eventQueue[mid].time < time) lo = mid + 1; else hi = mid; }
    _eventQueue.splice(lo, 0, ev);
  }

  function recordHistory(nodeId, time, value) {
    if (!_history[nodeId]) _history[nodeId] = [];
    var h = _history[nodeId];
    if (h.length > 0 && h[h.length - 1].value === value) return;
    h.push({ time: time, value: value });
    if (h.length > _maxHistory) h.shift();
  }

  // ===== PUBLIC API =====
  return {
    GATE_DEFS: GATE_DEFS,
    FF_DEFS: FF_DEFS,
    COMPLEX_DEFS: COMPLEX_DEFS,

    getComponentTypes: function() {
      var types = [];
      Object.keys(GATE_DEFS).forEach(function(k) { types.push({ id: k, category: 'gates', name: k.toUpperCase() }); });
      Object.keys(FF_DEFS).forEach(function(k) { types.push({ id: k, category: 'flipflops', name: FF_DEFS[k].compType }); });
      Object.keys(COMPLEX_DEFS).forEach(function(k) { types.push({ id: k, category: 'complex', name: COMPLEX_DEFS[k].compType }); });
      return types;
    },

    init: function(parts) {
      _eventQueue = [];
      _currentTime = 0;
      _nodeStates = {};
      _componentStates = {};
      _history = {};
      _isRunning = true;
      if (!parts) parts = S.parts;
      for (var i = 0; i < parts.length; i++) {
        var info = getDigitalDef(parts[i].type);
        if (info && info.def.init) _componentStates[parts[i].id] = info.def.init();
      }
    },

    step: function(targetTime, parts, wires) {
      if (!_isRunning) return 0;
      if (!parts) parts = S.parts;
      if (!wires) wires = S.wires;
      var processed = 0, maxEv = 1000;

      while (_eventQueue.length > 0 && _eventQueue[0].time <= targetTime && processed < maxEv) {
        var ev = _eventQueue.shift();
        _currentTime = ev.time;
        processed++;

        var old = _nodeStates[ev.nodeId] ? _nodeStates[ev.nodeId].value : false;
        if (old === ev.value) continue;
        _nodeStates[ev.nodeId] = { value: ev.value, lastChange: ev.time };
        recordHistory(ev.nodeId, ev.time, ev.value);
      }
      return processed;
    },

    injectEvent: function(nodeId, time, value) {
      insertEvent(time, nodeId, value, 'external');
      recordHistory(nodeId, time, value);
    },

    generateClock: function(nodeId, frequency, dutyCycle, startTime, endTime) {
      var period = 1 / frequency;
      var high = period * (dutyCycle || 0.5);
      var t = startTime || 0;
      var end = endTime || 0.001;
      while (t < end) {
        insertEvent(t, nodeId, true, 'clock');
        insertEvent(t + high, nodeId, false, 'clock');
        recordHistory(nodeId, t, true);
        recordHistory(nodeId, t + high, false);
        t += period;
      }
    },

    getTimingData: function(nodeIds, startTime, endTime) {
      var data = {};
      for (var i = 0; i < nodeIds.length; i++) {
        var h = _history[nodeIds[i]] || [];
        data[nodeIds[i]] = h.filter(function(e) {
          return e.time >= (startTime || 0) && e.time <= (endTime || Infinity);
        });
      }
      return data;
    },

    getNodeState: function(nodeId) { return _nodeStates[nodeId] || { value: false, lastChange: 0 }; },
    getStates: function() {
      var states = {};
      for (var k in _nodeStates) {
        if (_nodeStates.hasOwnProperty(k)) states[k] = _nodeStates[k].value;
      }
      return states;
    },
    getComponentState: function(id) { return _componentStates[id] || null; },
    getHistory: function() { return _history; },
    isRunning: function() { return _isRunning; },
    getCurrentTime: function() { return _currentTime; },
    getQueueLength: function() { return _eventQueue.length; },
    stop: function() { _isRunning = false; },
    reset: function() {
      _eventQueue = []; _currentTime = 0; _nodeStates = {};
      _componentStates = {}; _history = {}; _isRunning = false;
    }
  };
})();

// ===== TIMING DIAGRAM DRAWING =====
function drawTimingDiagram(ctx, width, height, signals, startTime, endTime) {
  var padL = 80, padT = 20, padR = 20, padB = 30;
  var plotW = width - padL - padR;
  var plotH = height - padT - padB;
  if (signals.length === 0 || plotW < 10 || plotH < 10) return;

  var sigH = Math.min(40, plotH / signals.length);
  var gap = 4;

  ctx.save();
  ctx.translate(padL, padT);

  for (var si = 0; si < signals.length; si++) {
    var sig = signals[si];
    var data = sig.data;
    var sy = si * (sigH + gap);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(sig.name, -8, sy + sigH / 2);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, sy + sigH); ctx.lineTo(plotW, sy + sigH); ctx.stroke();

    ctx.strokeStyle = sig.color || '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();

    var prevVal = false, highY = sy + 4, lowY = sy + sigH - 4;

    for (var di = 0; di < data.length; di++) {
      var d = data[di];
      var x = ((d.time - startTime) / (endTime - startTime)) * plotW;
      if (di === 0) {
        ctx.moveTo(0, d.value ? highY : lowY);
        if (x > 0) ctx.lineTo(x, d.value ? highY : lowY);
      }
      if (d.value !== prevVal && di > 0) {
        ctx.lineTo(x, prevVal ? highY : lowY);
        ctx.lineTo(x, d.value ? highY : lowY);
      }
      prevVal = d.value;
    }
    ctx.lineTo(plotW, prevVal ? highY : lowY);
    ctx.stroke();
  }

  // Time axis
  ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
  ctx.font = '9px monospace'; ctx.fillStyle = '#666';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  var range = endTime - startTime;
  for (var t = 0; t <= 10; t++) {
    var tx = (t / 10) * plotW;
    var tVal = startTime + t * range / 10;
    ctx.beginPath(); ctx.moveTo(tx, signals.length * (sigH + gap)); ctx.lineTo(tx, signals.length * (sigH + gap) + 5); ctx.stroke();
    var lbl = tVal < 1e-6 ? (tVal*1e9).toFixed(0)+'ns' : tVal < 1e-3 ? (tVal*1e6).toFixed(0)+'\u00B5s' : (tVal*1e3).toFixed(1)+'ms';
    ctx.fillText(lbl, tx, signals.length * (sigH + gap) + 8);
  }
  ctx.restore();
}
