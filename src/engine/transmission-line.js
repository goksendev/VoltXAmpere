// ──────── SPRINT 50: TRANSMISSION LINE + S-PARAMETER (v9.0) ────────
// Analytic ABCD matrix → S-parameter conversion + Touchstone parser.
// Delay-based transient stamp optional (MNA integration in Sprint 50b).
// The S-parameter path is fully analytic (no NR), works standalone.

VXA.TransmissionLine = (function() {
  'use strict';

  var DEFAULTS = { Z0: 50, TD: 1e-9, R: 0, G: 0, length: 1 };

  // ── Complex arithmetic helpers ─────────────────
  function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
  function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
  function cMul(a, b) { return { re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re }; }
  function cDiv(a, b) {
    var d = b.re*b.re + b.im*b.im;
    if (d < 1e-40) return { re: 0, im: 0 };
    return { re: (a.re*b.re + a.im*b.im) / d, im: (a.im*b.re - a.re*b.im) / d };
  }
  function cScale(a, s) { return { re: a.re * s, im: a.im * s }; }
  function cMag(a) { return Math.sqrt(a.re*a.re + a.im*a.im); }
  function cPhase(a) { return Math.atan2(a.im, a.re) * 180 / Math.PI; }

  // ── History buffer (transient TL stamp) ────────
  function createHistory(maxDelay, dt) {
    var bufSize = Math.max(16, Math.ceil(maxDelay / Math.max(dt, 1e-12)) + 10);
    return {
      times: new Float64Array(bufSize),
      V1: new Float64Array(bufSize), I1: new Float64Array(bufSize),
      V2: new Float64Array(bufSize), I2: new Float64Array(bufSize),
      ptr: 0, size: bufSize
    };
  }
  function recordHistory(history, time, V1, I1, V2, I2) {
    if (!history) return;
    var idx = history.ptr % history.size;
    history.times[idx] = time;
    history.V1[idx] = V1; history.I1[idx] = I1;
    history.V2[idx] = V2; history.I2[idx] = I2;
    history.ptr++;
  }
  function getDelayedValues(history, targetTime) {
    if (!history || history.ptr === 0) return { V1:0, I1:0, V2:0, I2:0 };
    var best = 0, minDiff = Infinity;
    var start = Math.max(0, history.ptr - history.size);
    for (var i = start; i < history.ptr; i++) {
      var idx = i % history.size;
      var diff = Math.abs(history.times[idx] - targetTime);
      if (diff < minDiff) { minDiff = diff; best = idx; }
    }
    return {
      V1: history.V1[best], I1: history.I1[best],
      V2: history.V2[best], I2: history.I2[best]
    };
  }

  // ── Transient stamp (Norton equivalent, delay-driven) ──
  function stamp(matrix, rhs, n1p, n1n, n2p, n2n, bi1, bi2, params, nodeV, history, time, Sp) {
    if (!Sp) return;
    var Z0 = (params && params.Z0) || 50;
    var TD = (params && params.TD) || 1e-9;
    var G0 = 1 / Z0;
    var delayed = getDelayedValues(history, time - TD);
    var Ieq1 = G0 * (delayed.V2 || 0) + (delayed.I2 || 0);
    var Ieq2 = G0 * (delayed.V1 || 0) + (delayed.I1 || 0);
    // Port 1 conductance (G0 between n1p-n1n)
    if (n1p > 0) Sp.stamp(matrix, n1p - 1, n1p - 1, G0);
    if (n1n > 0) Sp.stamp(matrix, n1n - 1, n1n - 1, G0);
    if (n1p > 0 && n1n > 0) {
      Sp.stamp(matrix, n1p - 1, n1n - 1, -G0);
      Sp.stamp(matrix, n1n - 1, n1p - 1, -G0);
    }
    if (n1p > 0) rhs[n1p - 1] += Ieq1;
    if (n1n > 0) rhs[n1n - 1] -= Ieq1;
    // Port 2 conductance
    if (n2p > 0) Sp.stamp(matrix, n2p - 1, n2p - 1, G0);
    if (n2n > 0) Sp.stamp(matrix, n2n - 1, n2n - 1, G0);
    if (n2p > 0 && n2n > 0) {
      Sp.stamp(matrix, n2p - 1, n2n - 1, -G0);
      Sp.stamp(matrix, n2n - 1, n2p - 1, -G0);
    }
    if (n2p > 0) rhs[n2p - 1] += Ieq2;
    if (n2n > 0) rhs[n2n - 1] -= Ieq2;
  }

  // ── ABCD matrix (lossless TL) ──────────────────
  function abcdMatrix(Z0, beta_l) {
    var cosG = Math.cos(beta_l);
    var sinG = Math.sin(beta_l);
    return {
      A: { re: cosG,    im: 0 },
      B: { re: 0,       im: Z0 * sinG },
      C: { re: 0,       im: sinG / Z0 },
      D: { re: cosG,    im: 0 }
    };
  }

  // ── ABCD → S-parameters ────────────────────────
  function abcdToSparams(abcd, Z0ref) {
    Z0ref = Z0ref || 50;
    var A = abcd.A, B = abcd.B, C = abcd.C, D = abcd.D;
    var BdZ = cScale(B, 1 / Z0ref);
    var CxZ = cScale(C, Z0ref);
    // denom = A + B/Z0 + C*Z0 + D
    var denom = cAdd(cAdd(A, BdZ), cAdd(CxZ, D));
    // S11 = (A + B/Z0 - C*Z0 - D) / denom
    var s11Num = cSub(cSub(cAdd(A, BdZ), CxZ), D);
    var S11 = cDiv(s11Num, denom);
    // S21 = 2 / denom
    var S21 = cDiv({ re: 2, im: 0 }, denom);
    // S12 = 2*(AD - BC) / denom — for reciprocal (lossless) equals S21
    var AD = cMul(A, D), BC = cMul(B, C);
    var S12 = cDiv(cScale(cSub(AD, BC), 2), denom);
    // S22 = (-A + B/Z0 - C*Z0 + D) / denom
    var s22Num = cAdd(cSub(cAdd(cScale(A, -1), BdZ), CxZ), D);
    var S22 = cDiv(s22Num, denom);
    return {
      S11: S11, S21: S21, S12: S12, S22: S22,
      S11_dB: 20 * Math.log10(Math.max(cMag(S11), 1e-30)),
      S21_dB: 20 * Math.log10(Math.max(cMag(S21), 1e-30)),
      S11_phase: cPhase(S11),
      S21_phase: cPhase(S21),
      VSWR: (function() {
        var g = cMag(S11);
        return g >= 1 ? Infinity : (1 + g) / (1 - g);
      })()
    };
  }

  // ── Frequency sweep ────────────────────────────
  function sparamSweep(Z0, TD, fStart, fStop, numPoints, Z0ref) {
    Z0ref = Z0ref || 50;
    var N = Math.max(1, numPoints | 0);
    var results = [];
    var logStart = Math.log10(Math.max(fStart, 1));
    var logStop = Math.log10(Math.max(fStop, fStart * 10));
    for (var i = 0; i <= N; i++) {
      var f = Math.pow(10, logStart + (logStop - logStart) * i / N);
      var beta_l = 2 * Math.PI * f * TD;
      var abcd = abcdMatrix(Z0, beta_l);
      var sp = abcdToSparams(abcd, Z0ref);
      sp.freq = f;
      results.push(sp);
    }
    return results;
  }

  // ── Touchstone (.sNp) parser ───────────────────
  function parseTouchstone(text) {
    var lines = String(text).split('\n');
    var format = { freqUnit: 1e9, paramType: 'S', dataFormat: 'MA', Z0: 50 };
    var data = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '!') continue;
      if (line.charAt(0) === '#') {
        var toks = line.substring(1).trim().toUpperCase().split(/\s+/);
        for (var t = 0; t < toks.length; t++) {
          var tok = toks[t];
          if (tok === 'GHZ') format.freqUnit = 1e9;
          else if (tok === 'MHZ') format.freqUnit = 1e6;
          else if (tok === 'KHZ') format.freqUnit = 1e3;
          else if (tok === 'HZ') format.freqUnit = 1;
          else if (tok === 'MA') format.dataFormat = 'MA';
          else if (tok === 'DB') format.dataFormat = 'DB';
          else if (tok === 'RI') format.dataFormat = 'RI';
          else if (tok === 'S' || tok === 'Y' || tok === 'Z') format.paramType = tok;
          else if (tok === 'R' && toks[t + 1]) { var v = parseFloat(toks[t + 1]); if (isFinite(v)) format.Z0 = v; t++; }
        }
        continue;
      }
      var vals = line.split(/\s+/).map(parseFloat);
      if (vals.length < 3) continue;
      var entry = { freq: vals[0] * format.freqUnit };
      function toComplex(m, a, fmt) {
        if (fmt === 'MA') { var r = a * Math.PI / 180; return { re: m * Math.cos(r), im: m * Math.sin(r) }; }
        if (fmt === 'DB') { var lin = Math.pow(10, m / 20); var r2 = a * Math.PI / 180; return { re: lin * Math.cos(r2), im: lin * Math.sin(r2) }; }
        return { re: m, im: a };
      }
      entry.S11 = toComplex(vals[1], vals[2], format.dataFormat);
      if (vals.length >= 5) entry.S21 = toComplex(vals[3], vals[4], format.dataFormat);
      if (vals.length >= 7) entry.S12 = toComplex(vals[5], vals[6], format.dataFormat);
      if (vals.length >= 9) entry.S22 = toComplex(vals[7], vals[8], format.dataFormat);
      data.push(entry);
    }
    return { format: format, data: data };
  }

  return {
    DEFAULTS: DEFAULTS,
    createHistory: createHistory,
    recordHistory: recordHistory,
    getDelayedValues: getDelayedValues,
    stamp: stamp,
    abcdMatrix: abcdMatrix,
    abcdToSparams: abcdToSparams,
    sparamSweep: sparamSweep,
    parseTouchstone: parseTouchstone,
    // Utility exports for Smith chart / UI
    cMag: cMag, cPhase: cPhase
  };
})();
