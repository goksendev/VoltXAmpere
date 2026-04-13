// ──────── SPRINT 8: PROFESYONEL ANALİZ SÜİTİ ────────

// 8.1: AC SMALL-SIGNAL ANALİZ MOTORU
VXA.ACAnalysis = (function() {
  var VT_VAL = 0.026;

  // Kompleks Gaussian elimination
  function complexSolve(Ar, Ai, br, bi, n) {
    var A = [], b = [];
    for (var i = 0; i < n; i++) {
      A[i] = [];
      for (var j = 0; j < n; j++) A[i][j] = { r: Ar[i][j], i: Ai[i][j] };
      b[i] = { r: br[i], i: bi[i] };
    }
    for (var k = 0; k < n; k++) {
      var maxMag = A[k][k].r * A[k][k].r + A[k][k].i * A[k][k].i, maxRow = k;
      for (var i = k + 1; i < n; i++) {
        var mag = A[i][k].r * A[i][k].r + A[i][k].i * A[i][k].i;
        if (mag > maxMag) { maxMag = mag; maxRow = i; }
      }
      if (maxMag < 1e-30) continue;
      if (maxRow !== k) { var tmp = A[k]; A[k] = A[maxRow]; A[maxRow] = tmp; var tb = b[k]; b[k] = b[maxRow]; b[maxRow] = tb; }
      for (var i = k + 1; i < n; i++) {
        var dn = A[k][k].r * A[k][k].r + A[k][k].i * A[k][k].i;
        if (dn < 1e-30) continue;
        var fr = (A[i][k].r * A[k][k].r + A[i][k].i * A[k][k].i) / dn;
        var fi = (A[i][k].i * A[k][k].r - A[i][k].r * A[k][k].i) / dn;
        for (var j = k + 1; j < n; j++) {
          A[i][j].r -= fr * A[k][j].r - fi * A[k][j].i;
          A[i][j].i -= fr * A[k][j].i + fi * A[k][j].r;
        }
        b[i].r -= fr * b[k].r - fi * b[k].i;
        b[i].i -= fr * b[k].i + fi * b[k].r;
        A[i][k].r = 0; A[i][k].i = 0;
      }
    }
    var x = [];
    for (var i = 0; i < n; i++) x[i] = { r: 0, i: 0 };
    for (var i = n - 1; i >= 0; i--) {
      var sr = b[i].r, si = b[i].i;
      for (var j = i + 1; j < n; j++) {
        sr -= A[i][j].r * x[j].r - A[i][j].i * x[j].i;
        si -= A[i][j].i * x[j].r + A[i][j].r * x[j].i;
      }
      var dn = A[i][i].r * A[i][i].r + A[i][i].i * A[i][i].i;
      if (dn > 1e-30) { x[i].r = (sr * A[i][i].r + si * A[i][i].i) / dn; x[i].i = (si * A[i][i].r - sr * A[i][i].i) / dn; }
    }
    return x;
  }

  // AC analiz — frekans taraması
  function run(fStart, fStop, ppd, outNodeIdx) {
    if (!SIM || SIM.N <= 1) return [];
    // DC operating point (mevcut nodeV kullan)
    buildCircuitFromCanvas();
    S._nodeVoltages = S._nodeVoltages || new Float64Array(SIM.N);
    for (var i = 0; i < 50; i++) { try { solveStep(1e-5); } catch(e) { break; } }
    var nodeV = S._nodeVoltages;
    var N = SIM.N, nv = SIM.vSrc.length, sz = N - 1 + nv;
    if (sz <= 0) return [];
    fStart = fStart || 10; fStop = fStop || 1e5; ppd = ppd || 20;
    if (!outNodeIdx || outNodeIdx <= 0) outNodeIdx = N > 2 ? 2 : 1;
    var decades = Math.log10(fStop / fStart);
    var total = Math.ceil(decades * ppd);
    var results = [];
    for (var k = 0; k <= total; k++) {
      var freq = fStart * Math.pow(10, k / ppd);
      var omega = 2 * Math.PI * freq;
      // Build complex admittance matrix
      var Gr = [], Gi = [];
      for (var i = 0; i < sz; i++) { Gr[i] = new Float64Array(sz); Gi[i] = new Float64Array(sz); }
      var Ir = new Float64Array(sz), Ii = new Float64Array(sz);
      function cS(r, c, re, im) { if (r >= 0 && r < sz && c >= 0 && c < sz) { Gr[r][c] += re; Gi[r][c] += im; } }
      function sR(n1, n2, R) { var g = 1 / R; if (n1 > 0) cS(n1 - 1, n1 - 1, g, 0); if (n2 > 0) cS(n2 - 1, n2 - 1, g, 0); if (n1 > 0 && n2 > 0) { cS(n1 - 1, n2 - 1, -g, 0); cS(n2 - 1, n1 - 1, -g, 0); } }
      function sC(n1, n2, C) { var b = omega * C; if (n1 > 0) cS(n1 - 1, n1 - 1, 0, b); if (n2 > 0) cS(n2 - 1, n2 - 1, 0, b); if (n1 > 0 && n2 > 0) { cS(n1 - 1, n2 - 1, 0, -b); cS(n2 - 1, n1 - 1, 0, -b); } }
      function sL(n1, n2, L) { if (omega < 1e-6) { sR(n1, n2, 1e-6); return; } var b = -1 / (omega * L); if (n1 > 0) cS(n1 - 1, n1 - 1, 0, b); if (n2 > 0) cS(n2 - 1, n2 - 1, 0, b); if (n1 > 0 && n2 > 0) { cS(n1 - 1, n2 - 1, 0, -b); cS(n2 - 1, n1 - 1, 0, -b); } }
      function sVCCS(np, nn, cp, cn, gm) { if (np > 0 && cp > 0) cS(np - 1, cp - 1, gm, 0); if (np > 0 && cn > 0) cS(np - 1, cn - 1, -gm, 0); if (nn > 0 && cp > 0) cS(nn - 1, cp - 1, -gm, 0); if (nn > 0 && cn > 0) cS(nn - 1, cn - 1, gm, 0); }

      var vsIdx = 0;
      for (var ci = 0; ci < SIM.comps.length; ci++) {
        var c = SIM.comps[ci];
        if (c.type === 'R') { sR(c.n1, c.n2, c.val); }
        else if (c.type === 'C') { sC(c.n1, c.n2, c.val); }
        else if (c.type === 'L') { sL(c.n1, c.n2, c.val); }
        else if (c.type === 'V') {
          var row = N - 1 + vsIdx;
          if (c.n1 > 0) { cS(c.n1 - 1, row, 1, 0); cS(row, c.n1 - 1, 1, 0); }
          if (c.n2 > 0) { cS(c.n2 - 1, row, -1, 0); cS(row, c.n2 - 1, -1, 0); }
          Ir[row] = c.isAC ? (c.val || 1) : 0; // AC source = amplitude, DC = short
          vsIdx++;
        } else if (c.type === 'D') {
          var vd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var Is = c.IS || DIODE_IS, Nf = c.N || DIODE_N;
          var gd = Is / (Nf * VT_VAL) * Math.exp(Math.min(vd / (Nf * VT_VAL), 40)) + 1e-12;
          sR(c.n1, c.n2, 1 / gd);
          var mdl = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (mdl && mdl.CJO > 0) { var Cj = mdl.CJO; var Cd = (mdl.TT || 0) * gd; sC(c.n1, c.n2, Cj + Cd); }
        } else if (c.type === 'BJT') {
          var pol = c.polarity, nB = c.n1, nC = c.n2, nE = c.n3;
          var vbe = pol * ((nodeV[nB] || 0) - (nodeV[nE] || 0));
          var Ic = c.IS * (Math.exp(Math.min(vbe / (c.NF * VT_VAL), 40)) - 1);
          var gm = Math.max(Math.abs(Ic) / VT_VAL, 1e-12);
          var rpi = c.BF / gm, ro = (c.VAF || 100) / Math.max(Math.abs(Ic), 1e-12);
          sR(nB, nE, rpi); sR(nC, nE, ro);
          sVCCS(nC, nE, nB, nE, gm * pol);
          var mdl = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (mdl) { if (mdl.CJE > 0) sC(nB, nE, mdl.CJE + (mdl.TF || 0) * gm); if (mdl.CJC > 0) sC(nB, nC, mdl.CJC); }
        } else if (c.type === 'MOS') {
          var pol = c.polarity, nG = c.n1, nD = c.n2, nS = c.n3;
          var vgs = pol * ((nodeV[nG] || 0) - (nodeV[nS] || 0));
          var Vov = Math.max(0, vgs - c.VTO);
          var gm = c.KP * Vov; var gds = 0.5 * c.KP * Vov * Vov * c.LAMBDA + 1e-12;
          sR(nD, nS, 1 / gds); sVCCS(nD, nS, nG, nS, gm * pol);
          var mdl = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (mdl) { if (mdl.CGS > 0) sC(nG, nS, mdl.CGS); if (mdl.CGDO > 0) sC(nG, nD, mdl.CGDO); }
        } else if (c.type === 'OA') {
          sR(c.nP, c.nN, c.Rin);
          var gOut = 1 / c.Rout;
          var mdl = c.part && c.part.model ? VXA.Models.getModel('opamp', c.part.model) : null;
          var GBW = (mdl && mdl.GBW) || 1e6;
          var wp1 = 2 * Math.PI * GBW / c.A;
          var wp2 = 2 * Math.PI * GBW * 3; // 2nd pole ~3×GBW
          // A(jw) = Aol / ((1+jw/wp1)(1+jw/wp2))
          var s1r = 1, s1i = omega / wp1, s2r = 1, s2i = omega / wp2;
          var dr = s1r * s2r - s1i * s2i, di = s1r * s2i + s1i * s2r;
          var mag2d = dr * dr + di * di;
          var Ar = c.A * dr / mag2d, Ai_v = -c.A * di / mag2d;
          var gm_r = Ar / c.Rout, gm_i = Ai_v / c.Rout;
          if (c.nO > 0) cS(c.nO - 1, c.nO - 1, gOut, 0);
          if (c.nO > 0 && c.nP > 0) cS(c.nO - 1, c.nP - 1, gm_r, gm_i);
          if (c.nO > 0 && c.nN > 0) cS(c.nO - 1, c.nN - 1, -gm_r, -gm_i);
        } else if (c.type === 'I') {
          if (c.isAC) { if (c.n1 > 0) Ir[c.n1 - 1] -= c.val; if (c.n2 > 0) Ir[c.n2 - 1] += c.val; }
        } else {
          sR(c.n1 || 0, c.n2 || 0, 1e9);
        }
      }
      // GMIN
      for (var i = 0; i < N - 1; i++) Gr[i][i] += 1e-12;
      // Solve
      var x = complexSolve(Gr, Gi, Ir, Ii, sz);
      var oi = outNodeIdx - 1;
      if (oi >= 0 && oi < x.length) {
        var Vout = x[oi];
        var mag = Math.sqrt(Vout.r * Vout.r + Vout.i * Vout.i);
        var phase = Math.atan2(Vout.i, Vout.r) * 180 / Math.PI;
        var gain_dB = 20 * Math.log10(Math.max(mag, 1e-15));
        results.push({ freq: freq, magnitude: mag, gain_dB: gain_dB, phase: phase });
      }
    }
    return results;
  }

  // Bode metrikleri
  function computeMetrics(results) {
    if (results.length < 2) return {};
    var dcGain = results[0].gain_dB, f3dB = null, fUnity = null, phaseMargin = null, gainMargin = null;
    for (var i = 1; i < results.length; i++) {
      if (!f3dB && results[i].gain_dB <= dcGain - 3 && results[i - 1].gain_dB > dcGain - 3) {
        var r = (dcGain - 3 - results[i - 1].gain_dB) / (results[i].gain_dB - results[i - 1].gain_dB);
        f3dB = results[i - 1].freq * Math.pow(results[i].freq / results[i - 1].freq, r);
      }
      if (!fUnity && results[i].gain_dB <= 0 && results[i - 1].gain_dB > 0) {
        var r = (0 - results[i - 1].gain_dB) / (results[i].gain_dB - results[i - 1].gain_dB);
        fUnity = results[i - 1].freq * Math.pow(results[i].freq / results[i - 1].freq, r);
      }
    }
    if (fUnity) {
      var closest = results[0];
      for (var i = 0; i < results.length; i++) {
        if (Math.abs(Math.log10(results[i].freq) - Math.log10(fUnity)) < Math.abs(Math.log10(closest.freq) - Math.log10(fUnity))) closest = results[i];
      }
      phaseMargin = 180 + closest.phase;
    }
    for (var i = 1; i < results.length; i++) {
      if (results[i].phase <= -180 && results[i - 1].phase > -180) { gainMargin = -results[i].gain_dB; break; }
    }
    return { dcGain: dcGain, f3dB: f3dB, fUnity: fUnity, phaseMargin: phaseMargin, gainMargin: gainMargin, bandwidth: f3dB };
  }

  return { run: run, complexSolve: complexSolve, computeMetrics: computeMetrics };
})();