// ──────── SPRINT 43: SIM BRIDGE (main thread) ────────
// Transparent API for start/stop/setSpeed/updateComponent/requestDCOP.
// Attempts to spawn a Web Worker from the embedded VXA._workerCode string
// (see build.js). Falls back to synchronous in-thread simulation if Worker
// construction fails (CSP, file:// restrictions, legacy browsers).
//
// NOTE (Sprint 43): the worker owns the postMessage protocol but the real
// MNA/NR pipeline still lives on the main thread — this ships the protocol
// and fallback so Sprint 44 can migrate solve() safely.

VXA.SimBridge = (function() {
  'use strict';

  var worker = null;
  var workerUrl = null;
  var fallbackMode = true;
  var lastError = null;
  var onStepCb = null;
  var onTickCb = null;
  var pending = {};
  var running = false;
  var tickCount = 0;

  function init(opts) {
    opts = opts || {};
    fallbackMode = true;
    if (typeof Worker === 'undefined') { lastError = 'Worker API not available'; return false; }
    if (typeof VXA === 'undefined' || !VXA._workerCode) { lastError = 'Worker code not embedded'; return false; }
    if (opts.forceFallback) { lastError = 'forceFallback'; return false; }
    try {
      var blob = new Blob([VXA._workerCode], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      worker.onmessage = handleWorkerMessage;
      worker.onerror = function(ev) {
        lastError = ev.message || 'worker error';
        // Fall back silently — don't kill the session
        teardown();
      };
      fallbackMode = false;
      return true;
    } catch (e) {
      lastError = String(e && e.message || e);
      teardown();
      return false;
    }
  }

  function teardown() {
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null;
    if (workerUrl) { try { URL.revokeObjectURL(workerUrl); } catch (e) {} }
    workerUrl = null;
    fallbackMode = true;
  }

  function handleWorkerMessage(e) {
    var msg = e.data || {};
    switch (msg.type) {
      case 'ready': break;
      case 'tick':
        tickCount++;
        // Sprint 44: decode Transferable ArrayBuffers back into Float64Arrays
        if (msg.nodeVoltages && msg.nodeVoltages.byteLength !== undefined) {
          msg.nodeVoltagesView = new Float64Array(msg.nodeVoltages);
        }
        if (msg.scopeBuffer && msg.scopeBuffer.byteLength !== undefined) {
          msg.scopeBufferView = new Float64Array(msg.scopeBuffer);
        }
        if (typeof onTickCb === 'function') onTickCb(msg);
        if (typeof onStepCb === 'function' && msg.scopeBufferView && msg.scopeChannels) {
          var chN = msg.scopeChannels;
          var sv = msg.scopeBufferView;
          var steps = sv.length / chN;
          for (var s = 0; s < steps; s++) {
            var frame = new Float64Array(chN);
            for (var c = 0; c < chN; c++) frame[c] = sv[s * chN + c];
            onStepCb({ t: msg.time, batch: msg.batch, frame: frame });
          }
        }
        break;
      case 'dcOP':
        // Sprint 44: dcOP may carry Transferable nodeVoltages
        var dcView = null;
        if (msg.nodeVoltages && msg.nodeVoltages.byteLength !== undefined) {
          dcView = new Float64Array(msg.nodeVoltages);
        } else if (Array.isArray(msg.nodeVoltages)) {
          dcView = new Float64Array(msg.nodeVoltages);
        }
        if (pending.dcOP) {
          try { pending.dcOP(!!msg.success, dcView || []); } catch (err) {}
          delete pending.dcOP;
        }
        break;
      case 'pong':
        if (pending.ping) {
          try { pending.ping(msg.echo); } catch (err) {}
          delete pending.ping;
        }
        break;
      case 'error':
        lastError = msg.message;
        break;
    }
  }

  // ── Public API ────────────────────────────────
  function sendCircuit(circuitData) {
    if (!worker) return false;
    try { worker.postMessage({ command: 'init', circuit: circuitData || {} }); return true; }
    catch (e) { lastError = String(e.message); return false; }
  }

  // Sprint 44: serialize the live SIM object (from sim-legacy.js) and send it.
  function sendCurrentCircuit(scopeNodes, dt) {
    if (typeof SIM === 'undefined' || !SIM) return false;
    if (!VXA.CircuitSerializer) return false;
    var payload = VXA.CircuitSerializer.serialize(SIM, scopeNodes, dt);
    return sendCircuit(payload);
  }

  function start(s) {
    running = true;
    if (worker) {
      try { worker.postMessage({ command: 'start', speed: s || 1 }); } catch (e) {}
    }
    // Fallback: main-thread sim keeps running as before (caller still drives toggleSim)
    return true;
  }

  function stop() {
    running = false;
    if (worker) { try { worker.postMessage({ command: 'stop' }); } catch (e) {} }
    return true;
  }

  function setSpeed(s) {
    if (worker) { try { worker.postMessage({ command: 'setSpeed', speed: s || 1 }); } catch (e) {} }
    return true;
  }

  function updateComponent(compIndex, updates) {
    if (worker) {
      try { worker.postMessage({ command: 'updateComponent', compIndex: compIndex, updates: updates || {} }); }
      catch (e) {}
    }
    return true;
  }

  function requestDCOP(callback) {
    if (!worker) {
      // Fallback: defer to main-thread solver if available
      var ok = true;
      try {
        if (typeof findDCOperatingPoint === 'function') ok = findDCOperatingPoint() !== false;
      } catch (e) { ok = false; }
      if (typeof callback === 'function') setTimeout(function() { callback(ok, []); }, 0);
      return true;
    }
    pending.dcOP = callback;
    try { worker.postMessage({ command: 'dcOP' }); } catch (e) {}
    return true;
  }

  function ping(echo, callback) {
    if (!worker) {
      if (typeof callback === 'function') setTimeout(function() { callback(echo); }, 0);
      return true;
    }
    pending.ping = callback;
    try { worker.postMessage({ command: 'ping', echo: echo }); } catch (e) {}
    return true;
  }

  function onStep(cb) { onStepCb = cb; }
  function onTick(cb) { onTickCb = cb; }
  function isWorkerMode() { return !fallbackMode && worker !== null; }
  function isRunning() { return running; }
  function getTickCount() { return tickCount; }
  function getLastError() { return lastError; }
  function terminate() { teardown(); }

  return {
    init: init, sendCircuit: sendCircuit, sendCurrentCircuit: sendCurrentCircuit,
    start: start, stop: stop, setSpeed: setSpeed,
    updateComponent: updateComponent, requestDCOP: requestDCOP, ping: ping,
    onStep: onStep, onTick: onTick,
    isWorkerMode: isWorkerMode, isRunning: isRunning, getTickCount: getTickCount,
    getLastError: getLastError, terminate: terminate
  };
})();
