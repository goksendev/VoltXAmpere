// ──────── SPRINT 43: SIM WORKER BODY (v9.0) ────────
// This file's text is captured at build-time and embedded as VXA._workerCode.
// It runs inside a Web Worker (no DOM, no window). The main thread owns the
// heavy MNA pipeline (sim.js + sim-legacy.js) because it is deeply DOM-coupled.
// The worker here implements the postMessage PROTOCOL so Sprint 43 ships an
// honest worker round-trip; full NR offload is scheduled for Sprint 44.
//
// Protocol:
//   main → worker: {command:'init', circuit:{N, scopeNodes}}
//   main → worker: {command:'start', speed}
//   main → worker: {command:'stop'}
//   main → worker: {command:'setSpeed', speed}
//   main → worker: {command:'updateComponent', compIndex, updates}
//   main → worker: {command:'dcOP'}
//   main → worker: {command:'ping'}
//   worker → main: {type:'ready', nodeCount}
//   worker → main: {type:'tick', time, batch}   (scope streaming)
//   worker → main: {type:'dcOP', success, nodeVoltages}
//   worker → main: {type:'pong'}
//   worker → main: {type:'error', message}
(function() {
  'use strict';
  var running = false;
  var speed = 1;
  var batchId = 0;
  var circuit = null;
  var stepsPerTick = 10;
  var timer = null;

  function tick() {
    if (!running) return;
    var now = Date.now();
    var steps = [];
    // Synthetic timebase — main thread still drives the real solver and will
    // correlate with these ticks when Sprint 44 lands the full offload.
    for (var i = 0; i < stepsPerTick * speed; i++) {
      steps.push({ t: now + i, ack: batchId });
    }
    batchId++;
    self.postMessage({ type: 'tick', time: now, batch: batchId, steps: steps });
    timer = setTimeout(tick, 16);
  }

  self.onmessage = function(e) {
    var msg = e.data || {};
    try {
      switch (msg.command) {
        case 'init':
          circuit = msg.circuit || null;
          self.postMessage({ type: 'ready', nodeCount: circuit ? (circuit.N || 0) : 0 });
          break;
        case 'start':
          running = true;
          speed = msg.speed || 1;
          if (timer) clearTimeout(timer);
          tick();
          break;
        case 'stop':
          running = false;
          if (timer) { clearTimeout(timer); timer = null; }
          break;
        case 'setSpeed':
          speed = msg.speed || 1;
          break;
        case 'updateComponent':
          if (circuit && typeof msg.compIndex === 'number' && circuit.comps) {
            var c = circuit.comps[msg.compIndex];
            if (c && msg.updates) for (var k in msg.updates) c[k] = msg.updates[k];
          }
          break;
        case 'dcOP':
          // Placeholder — real DC solve handled by main thread (Sprint 44 moves it here).
          self.postMessage({ type: 'dcOP', success: true, nodeVoltages: [] });
          break;
        case 'ping':
          self.postMessage({ type: 'pong', echo: msg.echo || null });
          break;
      }
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.message || err) });
    }
  };
})();
