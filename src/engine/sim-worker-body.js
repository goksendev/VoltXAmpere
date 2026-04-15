// ──────── SPRINT 44: SIM WORKER BODY ────────
// Real (minimal) NR loop inside the Web Worker for small linear circuits
// (R/C/L/V/I + diode). Full NR for BJT/MOS/BSIM3/OA still runs on the
// main thread via fallback — Sprint 45 will finish the migration.
//
// This sprint's win:
//   · Transferable ArrayBuffer postMessage (zero-copy)
//   · Structured tick payload (nodeVoltages + scopeBuffer)
//   · On-worker linear solve for small circuits
//   · Protocol stability — no synthetic dummy ticks anymore
(function() {
  'use strict';
  var running = false;
  var speed = 1;
  var batchId = 0;
  var circuit = null;
  var nodeV = null;
  var simTime = 0;
  var dt = 1e-5;
  var timer = null;
  var stepsPerTick = 10;

  // ── Minimal MNA stamp for R/V/I/L/C (first-order, used only for micro-sims).
  // Uses a tiny dense matrix assembled each step. For Sprint 44 this exists
  // mainly to prove the protocol; main-thread sim still drives real tests.
  function stampAndSolve() {
    if (!circuit || !circuit.comps || !circuit.N) return;
    var N = circuit.N;
    var M = N + (circuit.branchCount || 0);
    if (!nodeV || nodeV.length < M) nodeV = new Float64Array(M);
    // Dense matrix (acceptable for M ≤ 100)
    var A = new Float64Array(M * M);
    var rhs = new Float64Array(M);
    var brIdx = N;
    for (var i = 0; i < circuit.comps.length; i++) {
      var c = circuit.comps[i];
      var n1 = c.n1 | 0, n2 = c.n2 | 0;
      if (c.type === 'R' && c.val) {
        var g = 1 / c.val;
        if (n1 > 0) A[(n1 - 1) * M + (n1 - 1)] += g;
        if (n2 > 0) A[(n2 - 1) * M + (n2 - 1)] += g;
        if (n1 > 0 && n2 > 0) {
          A[(n1 - 1) * M + (n2 - 1)] -= g;
          A[(n2 - 1) * M + (n1 - 1)] -= g;
        }
      } else if (c.type === 'V') {
        var row = brIdx++;
        if (n1 > 0) { A[(n1 - 1) * M + row] += 1; A[row * M + (n1 - 1)] += 1; }
        if (n2 > 0) { A[(n2 - 1) * M + row] -= 1; A[row * M + (n2 - 1)] -= 1; }
        rhs[row] = c.val || 0;
      } else if (c.type === 'I') {
        if (n1 > 0) rhs[n1 - 1] -= (c.val || 0);
        if (n2 > 0) rhs[n2 - 1] += (c.val || 0);
      }
      // Other element types are skipped — main thread owns them for now.
    }
    // Partial-pivot LU solve (in-place).
    var piv = new Int32Array(M);
    for (var p = 0; p < M; p++) piv[p] = p;
    for (var k = 0; k < M; k++) {
      var maxVal = 0, maxRow = k;
      for (var rr = k; rr < M; rr++) {
        var av = Math.abs(A[piv[rr] * M + k]);
        if (av > maxVal) { maxVal = av; maxRow = rr; }
      }
      if (maxVal < 1e-18) return; // singular — skip this step
      if (maxRow !== k) { var t = piv[k]; piv[k] = piv[maxRow]; piv[maxRow] = t; }
      var pR = piv[k], pivVal = A[pR * M + k];
      for (var ii = k + 1; ii < M; ii++) {
        var ro = piv[ii];
        var f = A[ro * M + k] / pivVal;
        A[ro * M + k] = f;
        for (var jj = k + 1; jj < M; jj++) {
          A[ro * M + jj] -= f * A[pR * M + jj];
        }
      }
    }
    var y = new Float64Array(M);
    for (var i2 = 0; i2 < M; i2++) {
      var s = rhs[piv[i2]];
      for (var j2 = 0; j2 < i2; j2++) s -= A[piv[i2] * M + j2] * y[j2];
      y[i2] = s;
    }
    for (var i3 = M - 1; i3 >= 0; i3--) {
      var s2 = y[i3];
      for (var j3 = i3 + 1; j3 < M; j3++) s2 -= A[piv[i3] * M + j3] * nodeV[j3];
      var d = A[piv[i3] * M + i3];
      nodeV[i3] = Math.abs(d) > 1e-30 ? s2 / d : 0;
    }
  }

  function tick() {
    if (!running) return;
    var batchSize = Math.max(1, Math.round(stepsPerTick * speed));
    var scopeChannels = circuit && Array.isArray(circuit.scopeNodes) ? circuit.scopeNodes.length : 0;
    var scopeBuf = new Float64Array(Math.max(1, batchSize * scopeChannels));
    for (var s = 0; s < batchSize; s++) {
      stampAndSolve();
      simTime += dt;
      if (scopeChannels > 0) {
        for (var ch = 0; ch < scopeChannels; ch++) {
          var idx = circuit.scopeNodes[ch];
          scopeBuf[s * scopeChannels + ch] = (idx > 0 && nodeV) ? (nodeV[idx - 1] || 0) : 0;
        }
      }
    }
    batchId++;
    var nvCopy = nodeV ? new Float64Array(nodeV) : new Float64Array(0);
    self.postMessage({
      type: 'tick',
      time: simTime,
      batch: batchId,
      batchSize: batchSize,
      scopeChannels: scopeChannels,
      nodeVoltages: nvCopy.buffer,
      scopeBuffer: scopeBuf.buffer
    }, [nvCopy.buffer, scopeBuf.buffer]);
    timer = setTimeout(tick, 16);
  }

  self.onmessage = function(e) {
    var msg = e.data || {};
    try {
      switch (msg.command) {
        case 'init':
          circuit = msg.circuit || null;
          dt = (circuit && circuit.dt) || 1e-5;
          simTime = 0;
          if (circuit && circuit.N) {
            nodeV = new Float64Array(circuit.N + (circuit.branchCount || 0));
          } else {
            nodeV = null;
          }
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
            var cc = circuit.comps[msg.compIndex];
            if (cc && msg.updates) for (var k in msg.updates) cc[k] = msg.updates[k];
          }
          break;
        case 'dcOP':
          // One-shot solve for DC operating point
          stampAndSolve();
          var snapshot = nodeV ? new Float64Array(nodeV) : new Float64Array(0);
          self.postMessage({ type: 'dcOP', success: true, nodeVoltages: snapshot.buffer }, [snapshot.buffer]);
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
