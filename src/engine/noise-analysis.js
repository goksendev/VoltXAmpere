VXA.NoiseAnalysis = (function() {
  var kB = 1.38e-23, q = 1.602e-19, T_NOM = 300;

  function collectNoiseSources() {
    if (!SIM || SIM.N <= 1) return [];
    var sources = [];
    var nodeV = S._nodeVoltages || new Float64Array(SIM.N);
    var VT = 0.026;
    SIM.comps.forEach(function(c) {
      if (c.type === 'R' && c.val < 1e8 && c.val > 0.01) {
        sources.push({ partId: c.part.id, partType: 'resistor', srcType: 'thermal',
          noiseKind: 'voltage', Sn: 4 * kB * T_NOM * c.val,
          n1: c.n1, n2: c.n2, impedance: c.val,
          name: (c.part.name || 'R') + ' thermal' });
      }
      if (c.type === 'D') {
        var Id = Math.abs(c.part._i || c.part._simI || 1e-9);
        if (Id > 1e-15) {
          sources.push({ partId: c.part.id, partType: c.part.type, srcType: 'shot',
            noiseKind: 'current', Sn: 2 * q * Id,
            n1: c.n1, n2: c.n2, name: (c.part.name || 'D') + ' shot' });
        }
      }
      if (c.type === 'BJT') {
        var pol = c.polarity;
        var vbe = pol * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0));
        var Ic = Math.abs(c.IS * (Math.exp(Math.min(vbe / (c.NF * VT), 40)) - 1));
        var beta = c.BF || 100;
        var Ib = Ic / beta;
        var mdl = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
        var Rb = mdl ? (mdl.RB || 0) : 0;
        // Base shot noise
        if (Ib > 1e-15) {
          sources.push({ partId: c.part.id, partType: c.part.type, srcType: 'base_shot',
            noiseKind: 'current', Sn: 2 * q * Ib,
            n1: c.n1, n2: c.n3, name: (c.part.name || 'Q') + ' base shot' });
        }
        // Collector shot noise
        if (Ic > 1e-15) {
          sources.push({ partId: c.part.id, partType: c.part.type, srcType: 'collector_shot',
            noiseKind: 'current', Sn: 2 * q * Ic,
            n1: c.n2, n2: c.n3, name: (c.part.name || 'Q') + ' coll shot' });
        }
        // Base resistance thermal
        if (Rb > 0) {
          sources.push({ partId: c.part.id, partType: c.part.type, srcType: 'rb_thermal',
            noiseKind: 'current', Sn: 4 * kB * T_NOM / Rb,
            n1: c.n1, n2: c.n3, name: (c.part.name || 'Q') + ' Rb thermal' });
        }
      }
      if (c.type === 'MOS') {
        var pol = c.polarity;
        var vgs = pol * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0));
        var Vov = Math.max(0, vgs - c.VTO);
        var gm = c.KP * Vov;
        if (gm > 1e-12) {
          sources.push({ partId: c.part.id, partType: c.part.type, srcType: 'channel',
            noiseKind: 'current', Sn: 4 * kB * T_NOM * (2 / 3) * gm,
            n1: c.n2, n2: c.n3, name: (c.part.name || 'M') + ' channel' });
        }
      }
    });
    return sources;
  }

  function buildACMatrix(omega) {
    var N = SIM.N, nv = SIM.vSrc.length, sz = N - 1 + nv;
    var nodeV = S._nodeVoltages || new Float64Array(N);
    var VT = 0.026;
    var Gr = [], Gi = [];
    for (var i = 0; i < sz; i++) { Gr[i] = new Float64Array(sz); Gi[i] = new Float64Array(sz); }
    function cS(r, c, re, im) { if (r >= 0 && r < sz && c >= 0 && c < sz) { Gr[r][c] += re; Gi[r][c] += im; } }
    function sR(n1, n2, R) { var g = 1 / R; if (n1 > 0) cS(n1-1,n1-1,g,0); if (n2 > 0) cS(n2-1,n2-1,g,0); if (n1>0&&n2>0){cS(n1-1,n2-1,-g,0);cS(n2-1,n1-1,-g,0);} }
    function sC(n1, n2, C) { var b = omega * C; if (n1 > 0) cS(n1-1,n1-1,0,b); if (n2 > 0) cS(n2-1,n2-1,0,b); if (n1>0&&n2>0){cS(n1-1,n2-1,0,-b);cS(n2-1,n1-1,0,-b);} }
    function sL(n1, n2, L) { if (omega < 1e-6) { sR(n1,n2,1e-6); return; } var b = -1/(omega*L); if (n1 > 0) cS(n1-1,n1-1,0,b); if (n2 > 0) cS(n2-1,n2-1,0,b); if (n1>0&&n2>0){cS(n1-1,n2-1,0,-b);cS(n2-1,n1-1,0,-b);} }
    function sVCCS(np, nn, cp, cn, gm) { if (np>0&&cp>0) cS(np-1,cp-1,gm,0); if (np>0&&cn>0) cS(np-1,cn-1,-gm,0); if (nn>0&&cp>0) cS(nn-1,cp-1,-gm,0); if (nn>0&&cn>0) cS(nn-1,cn-1,gm,0); }

    var vsIdx = 0;
    for (var ci = 0; ci < SIM.comps.length; ci++) {
      var c = SIM.comps[ci];
      if (c.type === 'R') { sR(c.n1, c.n2, c.val); }
      else if (c.type === 'C') { sC(c.n1, c.n2, c.val); }
      else if (c.type === 'L') { sL(c.n1, c.n2, c.val); }
      else if (c.type === 'V') {
        var row = N - 1 + vsIdx;
        if (c.n1 > 0) { cS(c.n1-1, row, 1, 0); cS(row, c.n1-1, 1, 0); }
        if (c.n2 > 0) { cS(c.n2-1, row, -1, 0); cS(row, c.n2-1, -1, 0); }
        vsIdx++;
      } else if (c.type === 'D') {
        var vd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
        var Is = c.IS || 1e-14, Nf = c.N || 1;
        var gd = Is / (Nf * VT) * Math.exp(Math.min(vd / (Nf * VT), 40)) + 1e-12;
        sR(c.n1, c.n2, 1 / gd);
        var mdl = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
        if (mdl && mdl.CJO > 0) { sC(c.n1, c.n2, mdl.CJO + (mdl.TT || 0) * gd); }
      } else if (c.type === 'BJT') {
        var pol = c.polarity, nB = c.n1, nC = c.n2, nE = c.n3;
        var vbe = pol * ((nodeV[nB] || 0) - (nodeV[nE] || 0));
        var Ic = c.IS * (Math.exp(Math.min(vbe / (c.NF * VT), 40)) - 1);
        var gm = Math.max(Math.abs(Ic) / VT, 1e-12);
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
        var gOut = 1 / c.Rout; var gm_oa = c.A / c.Rout;
        var mdl = c.part && c.part.model ? VXA.Models.getModel('opamp', c.part.model) : null;
        var GBW = (mdl && mdl.GBW) || 1e6;
        var wp1 = 2 * Math.PI * GBW / c.A;
        var wp2 = 2 * Math.PI * GBW * 3;
        var s1r = 1, s1i = omega / wp1, s2r = 1, s2i = omega / wp2;
        var dr = s1r * s2r - s1i * s2i, di = s1r * s2i + s1i * s2r;
        var mag2d = dr * dr + di * di;
        var Ar = c.A * dr / mag2d, Ai_v = -c.A * di / mag2d;
        var gm_r = Ar / c.Rout, gm_i = Ai_v / c.Rout;
        if (c.nO > 0) cS(c.nO-1, c.nO-1, gOut, 0);
        if (c.nO > 0 && c.nP > 0) cS(c.nO-1, c.nP-1, gm_r, gm_i);
        if (c.nO > 0 && c.nN > 0) cS(c.nO-1, c.nN-1, -gm_r, -gm_i);
      } else {
        sR(c.n1 || 0, c.n2 || 0, 1e9);
      }
    }
    // GMIN
    for (var i = 0; i < N - 1; i++) Gr[i][i] += 1e-12;
    return { Gr: Gr, Gi: Gi, sz: sz };
  }

  function solveWithSource(acMat, ns, outputNodeIdx) {
    var sz = acMat.sz;
    var Ir = new Float64Array(sz), Ii = new Float64Array(sz);
    // Inject unit noise source
    if (ns.noiseKind === 'voltage') {
      var Z = ns.impedance || 1;
      var Ieq = 1 / Z;
      var a = ns.n1 - 1, b2 = ns.n2 - 1;
      if (a >= 0 && a < sz) Ir[a] += Ieq;
      if (b2 >= 0 && b2 < sz) Ir[b2] -= Ieq;
    } else {
      var a = ns.n1 - 1, b2 = ns.n2 - 1;
      if (a >= 0 && a < sz) Ir[a] += 1;
      if (b2 >= 0 && b2 < sz) Ir[b2] -= 1;
    }
    var x = VXA.ACAnalysis.complexSolve(acMat.Gr, acMat.Gi, Ir, Ii, sz);
    var oi = outputNodeIdx - 1;
    if (oi >= 0 && oi < x.length) {
      return x[oi].r * x[oi].r + x[oi].i * x[oi].i;
    }
    return 0;
  }

  function run(fStart, fStop, ppd, outputNodeIdx) {
    if (!SIM || SIM.N <= 1) return { points: [], totalRms: 0, sources: [], dominantSources: [] };
    fStart = fStart || 1; fStop = fStop || 1e6; ppd = ppd || 10;
    if (!outputNodeIdx || outputNodeIdx <= 0) outputNodeIdx = SIM.N > 2 ? 2 : 1;
    buildCircuitFromCanvas();
    S._nodeVoltages = S._nodeVoltages || new Float64Array(SIM.N);
    for (var i = 0; i < 50; i++) { try { solveStep(1e-5); } catch(e) { break; } }

    var noiseSrc = collectNoiseSources();
    if (noiseSrc.length === 0) return { points: [], totalRms: 0, sources: noiseSrc, dominantSources: [] };

    var decades = Math.log10(fStop / fStart), total = Math.ceil(decades * ppd);
    var points = [];

    for (var k = 0; k <= total; k++) {
      var freq = fStart * Math.pow(10, k / ppd);
      var omega = 2 * Math.PI * freq;
      var acMat = buildACMatrix(omega);
      var totalNoise_V2Hz = 0;
      var contribs = [];

      for (var si = 0; si < noiseSrc.length; si++) {
        var ns = noiseSrc[si];
        var H2 = solveWithSource(acMat, ns, outputNodeIdx);
        var contrib = H2 * ns.Sn;
        totalNoise_V2Hz += contrib;
        contribs.push({ partId: ns.partId, name: ns.name, srcType: ns.srcType, contrib_V2Hz: contrib, pct: 0 });
      }

      contribs.forEach(function(c) { c.pct = totalNoise_V2Hz > 0 ? c.contrib_V2Hz / totalNoise_V2Hz * 100 : 0; });
      contribs.sort(function(a, b) { return b.contrib_V2Hz - a.contrib_V2Hz; });

      points.push({
        freq: freq,
        totalNoise_V2Hz: totalNoise_V2Hz,
        density: Math.sqrt(Math.max(totalNoise_V2Hz, 1e-40)),
        density_dB: 10 * Math.log10(Math.max(totalNoise_V2Hz, 1e-40)),
        contributions: contribs
      });
    }

    // Total RMS (trapezoidal)
    var totalRms2 = 0;
    for (var i = 1; i < points.length; i++) {
      var df = points[i].freq - points[i - 1].freq;
      totalRms2 += (points[i].totalNoise_V2Hz + points[i - 1].totalNoise_V2Hz) / 2 * df;
    }

    // Dominant sources at mid-frequency
    var midIdx = Math.floor(points.length / 2);
    var dominantSources = midIdx < points.length ? points[midIdx].contributions.slice(0, 5) : [];

    // Legacy compat
    var legacySources = noiseSrc.map(function(ns) { return { part: { id: ns.partId }, type: ns.srcType, name: ns.name, Sv: ns.noiseKind === 'voltage' ? ns.Sn : 0, Si: ns.noiseKind === 'current' ? ns.Sn : 0 }; });

    return { points: points, totalRms: Math.sqrt(totalRms2), sources: legacySources, dominantSources: dominantSources, perSourceTransfer: true };
  }

  return { run: run, collectNoiseSources: collectNoiseSources };
})();