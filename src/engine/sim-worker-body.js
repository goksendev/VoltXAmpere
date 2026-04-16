// Sprint 67: Full NR worker — R/C/L/V/I + Diode/BJT/MOS/OpAmp
(function() {
  'use strict';
  var running = false, speed = 1, batchId = 0;
  var circuit = null, nodeV = null, simTime = 0, dt = 1e-5;
  var timer = null, stepsPerTick = 10;
  var GMIN = 1e-12, NR_MAX = 30, V_TOL = 1e-4;

  function stampG(A, M, n1, n2, g) {
    if (n1 > 0) A[(n1-1)*M+(n1-1)] += g;
    if (n2 > 0) A[(n2-1)*M+(n2-1)] += g;
    if (n1 > 0 && n2 > 0) { A[(n1-1)*M+(n2-1)] -= g; A[(n2-1)*M+(n1-1)] -= g; }
  }

  function stampAndSolve() {
    if (!circuit || !circuit.comps || !circuit.N) return;
    var N = circuit.N, bc = circuit.branchCount || 0;
    var M = N + bc;
    if (!nodeV || nodeV.length < M) nodeV = new Float64Array(M);

    var converged = false, iter = 0;
    while (!converged && iter < NR_MAX) {
      var A = new Float64Array(M * M);
      var rhs = new Float64Array(M);
      var brIdx = N;

      for (var gi = 0; gi < N; gi++) A[gi * M + gi] += GMIN;

      for (var i = 0; i < circuit.comps.length; i++) {
        var c = circuit.comps[i];
        var n1 = c.n1 | 0, n2 = c.n2 | 0;

        if (c.type === 'R' && c.val) {
          stampG(A, M, n1, n2, 1 / c.val);
        } else if (c.type === 'C' && c.val) {
          var geqC = 2 * c.val / dt;
          var vPrevC = (c._vPrev || 0);
          stampG(A, M, n1, n2, geqC);
          var ieqC = geqC * vPrevC;
          if (n1 > 0) rhs[n1-1] += ieqC;
          if (n2 > 0) rhs[n2-1] -= ieqC;
        } else if (c.type === 'L' && c.val) {
          var geqL = dt / (2 * c.val);
          stampG(A, M, n1, n2, geqL);
          if (n1 > 0) rhs[n1-1] += (c._iPrev || 0);
          if (n2 > 0) rhs[n2-1] -= (c._iPrev || 0);
        } else if (c.type === 'V') {
          var row = brIdx++;
          var v = c.val || 0;
          if (c.isAC && c.freq) v = (c.val || 0) * Math.sin(2 * Math.PI * c.freq * simTime);
          if (n1 > 0) { A[(n1-1)*M+row] += 1; A[row*M+(n1-1)] += 1; }
          if (n2 > 0) { A[(n2-1)*M+row] -= 1; A[row*M+(n2-1)] -= 1; }
          rhs[row] = v;
        } else if (c.type === 'I') {
          if (n1 > 0) rhs[n1-1] -= (c.val || 0);
          if (n2 > 0) rhs[n2-1] += (c.val || 0);
        } else if (c.type === 'D' || c.type === 'Z') {
          var vd = (nodeV[n1] || 0) - (nodeV[n2] || 0);
          var Is = c.Is || 1e-14, Nv = c.Nval || 1, Vt = 0.026 * Nv;
          if (vd > 0.7) vd = 0.7 + Vt * Math.log(1 + (vd - 0.7) / Vt);
          if (vd < -10) vd = -10;
          var eVd = Math.exp(Math.min(vd / Vt, 40));
          var Id = Is * (eVd - 1);
          var gd = (Is / Vt) * eVd + GMIN;
          var Ieq = Id - gd * vd;
          stampG(A, M, n1, n2, gd);
          if (n1 > 0) rhs[n1-1] -= Ieq;
          if (n2 > 0) rhs[n2-1] += Ieq;
        } else if (c.type === 'BJT') {
          var nB = n1, nC = n2, nE = c.n3 | 0;
          var pol = c.polarity || 1, beta = c.beta || 100;
          var Vbe = pol * ((nodeV[nB] || 0) - (nodeV[nE] || 0));
          var IsB = 1e-14, VtB = 0.026;
          if (Vbe > 0.7) Vbe = 0.7 + VtB * Math.log(1 + (Vbe - 0.7) / VtB);
          var eBE = Math.exp(Math.min(Vbe / VtB, 40));
          var Ibe = IsB * (eBE - 1), gbe = (IsB / VtB) * eBE + GMIN;
          var gm = beta * gbe, IbeEq = Ibe - gbe * Vbe, IcEq = beta * Ibe - gm * Vbe;
          stampG(A, M, nB, nE, gbe);
          if (nC > 0 && nB > 0) A[(nC-1)*M+(nB-1)] += gm * pol;
          if (nC > 0 && nE > 0) A[(nC-1)*M+(nE-1)] -= gm * pol;
          if (nC > 0) A[(nC-1)*M+(nC-1)] += GMIN;
          if (nB > 0) rhs[nB-1] -= IbeEq * pol;
          if (nE > 0) rhs[nE-1] += IbeEq * pol;
          if (nC > 0) rhs[nC-1] -= IcEq * pol;
          if (nE > 0) rhs[nE-1] += IcEq * pol;
        } else if (c.type === 'MOS') {
          var nG = n2, nD = n1, nS = c.n3 | 0;
          var polM = c.polarity || 1;
          var Vgs = polM * ((nodeV[nG] || 0) - (nodeV[nS] || 0));
          var Vds = polM * ((nodeV[nD] || 0) - (nodeV[nS] || 0));
          var VthM = c.VTO || 2, KpM = c.KP || 110e-6, lamM = c.LAMBDA || 0.04;
          var IdM = 0, gmM = 0, gdsM = GMIN;
          if (Vgs > VthM) {
            if (Vds < Vgs - VthM) {
              IdM = KpM * ((Vgs - VthM) * Vds - 0.5 * Vds * Vds) * (1 + lamM * Vds);
              gmM = KpM * Vds; gdsM = KpM * ((Vgs - VthM) - Vds) + lamM * IdM + GMIN;
            } else {
              var Vov = Vgs - VthM;
              IdM = 0.5 * KpM * Vov * Vov * (1 + lamM * Vds);
              gmM = KpM * Vov; gdsM = lamM * 0.5 * KpM * Vov * Vov + GMIN;
            }
          }
          var IeqM = IdM - gmM * Vgs - gdsM * Vds;
          if (nD > 0) A[(nD-1)*M+(nD-1)] += gdsM;
          if (nS > 0) A[(nS-1)*M+(nS-1)] += gdsM + gmM;
          if (nD > 0 && nS > 0) { A[(nD-1)*M+(nS-1)] -= gdsM + gmM; A[(nS-1)*M+(nD-1)] -= gdsM; }
          if (nD > 0 && nG > 0) A[(nD-1)*M+(nG-1)] += gmM;
          if (nS > 0 && nG > 0) A[(nS-1)*M+(nG-1)] -= gmM;
          if (nD > 0) rhs[nD-1] -= IeqM * polM;
          if (nS > 0) rhs[nS-1] += IeqM * polM;
        } else if (c.type === 'OA') {
          var nP = c.nP | 0, nN = c.nN | 0, nO = c.nO | 0;
          var Aol = c.A || 100000, Rout = c.Rout || 75;
          stampG(A, M, nP, nN, 1 / (c.Rin || 1e12));
          if (nO > 0) A[(nO-1)*M+(nO-1)] += 1 / Rout;
          var gmOA = Aol / Rout;
          if (nO > 0 && nP > 0) A[(nO-1)*M+(nP-1)] += gmOA;
          if (nO > 0 && nN > 0) A[(nO-1)*M+(nN-1)] -= gmOA;
        }
      }

      // LU solve
      var piv = new Int32Array(M);
      for (var p = 0; p < M; p++) piv[p] = p;
      for (var k = 0; k < M; k++) {
        var maxVal = 0, maxRow = k;
        for (var rr = k; rr < M; rr++) {
          var av = Math.abs(A[piv[rr]*M+k]);
          if (av > maxVal) { maxVal = av; maxRow = rr; }
        }
        if (maxVal < 1e-18) continue;
        if (maxRow !== k) { var t = piv[k]; piv[k] = piv[maxRow]; piv[maxRow] = t; }
        var pR = piv[k], pivVal = A[pR*M+k];
        for (var ii = k+1; ii < M; ii++) {
          var ro = piv[ii], f = A[ro*M+k] / pivVal;
          A[ro*M+k] = f;
          for (var jj = k+1; jj < M; jj++) A[ro*M+jj] -= f * A[pR*M+jj];
        }
      }
      var y = new Float64Array(M);
      for (var i2 = 0; i2 < M; i2++) {
        var s = rhs[piv[i2]];
        for (var j2 = 0; j2 < i2; j2++) s -= A[piv[i2]*M+j2] * y[j2];
        y[i2] = s;
      }
      var xNew = new Float64Array(M);
      for (var i3 = M-1; i3 >= 0; i3--) {
        var s2 = y[i3];
        for (var j3 = i3+1; j3 < M; j3++) s2 -= A[piv[i3]*M+j3] * xNew[j3];
        var d = A[piv[i3]*M+i3];
        xNew[i3] = Math.abs(d) > 1e-30 ? s2 / d : 0;
      }

      converged = true;
      for (var ci = 0; ci < M; ci++) {
        if (Math.abs(xNew[ci] - (nodeV[ci] || 0)) > V_TOL) converged = false;
        nodeV[ci] = xNew[ci];
      }
      iter++;
    }

    // Update reactive element state
    for (var ui = 0; ui < circuit.comps.length; ui++) {
      var uc = circuit.comps[ui];
      if (uc.type === 'C') uc._vPrev = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
      if (uc.type === 'L') {
        var vL = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
        uc._iPrev = (uc._iPrev || 0) + (dt / uc.val) * vL;
      }
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
      type: 'tick', time: simTime, batch: batchId, batchSize: batchSize,
      scopeChannels: scopeChannels, nodeVoltages: nvCopy.buffer, scopeBuffer: scopeBuf.buffer
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
          if (circuit && circuit.N) nodeV = new Float64Array(circuit.N + (circuit.branchCount || 0));
          else nodeV = null;
          self.postMessage({ type: 'ready', nodeCount: circuit ? (circuit.N || 0) : 0 });
          break;
        case 'start':
          running = true; speed = msg.speed || 1;
          if (timer) clearTimeout(timer);
          tick();
          break;
        case 'stop':
          running = false;
          if (timer) { clearTimeout(timer); timer = null; }
          break;
        case 'setSpeed': speed = msg.speed || 1; break;
        case 'updateComponent':
          if (circuit && typeof msg.compIndex === 'number' && circuit.comps) {
            var cc = circuit.comps[msg.compIndex];
            if (cc && msg.updates) for (var k in msg.updates) cc[k] = msg.updates[k];
          }
          break;
        case 'dcOP':
          stampAndSolve();
          var snap = nodeV ? new Float64Array(nodeV) : new Float64Array(0);
          self.postMessage({ type: 'dcOP', success: true, nodeVoltages: snap.buffer }, [snap.buffer]);
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
