// ──────── SPRINT 41: BSIM3v3 MOSFET MODEL (v9.0) ────────
// Berkeley Short-channel IGFET Model, version 3.3.
// Compact, numerically-stable subset: Vth(body+DIBL+SCE) → μ_eff →
// velocity-saturation Ids → CLM + subthreshold smooth merge.
// Meyer-style terminal capacitances. 4-terminal (D/G/S/B).
//
// Not a full LTspice clone — educational/engineering fidelity suitable for
// CMOS inverter, common-source amp, DC sweeps. Convergence-friendly.

VXA.BSIM3 = (function() {
  'use strict';

  var q = 1.602e-19;
  var kB = 1.381e-23;
  var eps_ox = 3.453e-11;   // SiO2 dielectric
  var eps_si = 1.035e-10;   // Silicon dielectric

  var DEFAULTS = {
    TNOM: 300.15,
    TOX: 9e-9,
    VTH0: 0.5,
    K1: 0.5, K2: -0.1, K3: 80, K3B: 0,
    DVT0: 2.2, DVT1: 0.53, DVT2: -0.032,
    NLX: 1.74e-7, W0: 0,
    U0: 400,                 // NMOS default cm²/Vs (PMOS overridden)
    UA: -1.4e-9, UB: 2.3e-18, UC: -4.6e-11,
    VSAT: 1.5e5,
    A0: 1.0, AGS: 0.2, A1: 0, A2: 1.0, B0: 0, B1: 0,
    VOFF: -0.08, NFACTOR: 1.5,
    CDSC: 2.4e-4, CDSCB: 0, CDSCD: 0, CIT: 0,
    ETA0: 0.08, ETAB: -0.07, DSUB: 0.56,
    PCLM: 1.3, PDIBLC1: 0.39, PDIBLC2: 0.0086, PDIBLCB: -0.1, DROUT: 0.56, PVAG: 0,
    PSCBE1: 4.24e8, PSCBE2: 1e-5, DELTA: 0.01,
    WINT: 0, LINT: 0, DWG: 0, DWB: 0,
    W: 10e-6, L: 1e-6,
    TYPE: 1,                 // 1=NMOS, -1=PMOS
    LEVEL: 49,
    VERSION: 3.3,
    PHI: 0.8,                // 2*φF surface potential (typical)
    CBS: 1e-15, CBD: 1e-15
  };

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function safeExp(x) {
    if (x > 80) return Math.exp(80);
    if (x < -80) return 0;
    return Math.exp(x);
  }

  // Evaluate Ids and small-signal derivatives for given terminal biases.
  // Inputs Vgs, Vds, Vbs must already be in the "effective NMOS" convention
  // (caller handles PMOS polarity flip).
  function evaluate(params, Vgs, Vds, Vbs) {
    var p = params || DEFAULTS;
    var T = p.TNOM || 300.15;
    var Vt = kB * T / q;                                  // ≈ 26 mV @ 300 K

    var Weff = Math.max((p.W || 10e-6) - 2 * (p.WINT || 0), 1e-7);
    var Leff = Math.max((p.L || 1e-6) - 2 * (p.LINT || 0), 1e-8);
    var Cox = eps_ox / (p.TOX || 9e-9);
    var PHI = p.PHI || 0.8;

    // ── Vth: body + DIBL + simplified SCE ─────────────
    var absVbs = Math.max(-Vbs, 0);                        // clamp Vbs ≤ 0 for NMOS
    var sqrtPhis = Math.sqrt(PHI + absVbs);
    var sqrtPhis0 = Math.sqrt(PHI);
    var dVth_body = (p.K1 || 0) * (sqrtPhis - sqrtPhis0) - (p.K2 || 0) * Vbs;
    var lt = Math.sqrt(eps_si * (p.TOX || 9e-9) / Cox);
    // Sprint 41 fix: DIBL attenuates exponentially with channel length (BSIM3 spec).
    // Long-channel devices (L≫lt) have negligible DIBL → high output resistance.
    var theta_dibl = safeExp(-(p.DSUB || 0.56) * Leff / (2 * Math.max(lt, 1e-12)));
    var dVth_dibl = -((p.ETA0 || 0) + (p.ETAB || 0) * Vbs) * Vds * theta_dibl;
    var theta_sce = safeExp(-(p.DVT0 || 0) * Leff / (2 * Math.max(lt, 1e-12)));
    var dVth_sce = -2 * (p.DVT1 || 0) * Vt * theta_sce;

    var Vth = (p.VTH0 || 0.5) + dVth_body + dVth_dibl + dVth_sce;

    // ── Vgst_eff smooth (weak ↔ strong inversion) ────
    var Vgst = Vgs - Vth;
    var n = 1 + (p.NFACTOR || 1.5) * (p.CDSC || 2.4e-4) / Math.max(Cox, 1e-12);
    if (n < 1) n = 1;
    var vtm = n * Vt;

    var Vgst_eff;
    if (Vgst / vtm > 40) Vgst_eff = Vgst;
    else if (Vgst / vtm < -40) Vgst_eff = vtm * safeExp(Vgst / vtm);
    else Vgst_eff = vtm * Math.log(1 + safeExp(Vgst / vtm));
    if (Vgst_eff < 1e-12) Vgst_eff = 1e-12;

    // ── μ_eff ─────────────────────────────────────────
    var U0_SI = (p.U0 || 400) * 1e-4;                      // cm²/V·s → m²/V·s
    var Eeff = (Vgst_eff + 2 * PHI) / (6 * (p.TOX || 9e-9));
    var mu_den = 1 + ((p.UA || 0) + (p.UC || 0) * Vbs) * Eeff +
                 (p.UB || 0) * Eeff * Eeff;
    var mu_eff = U0_SI / Math.max(mu_den, 0.1);

    // ── Abulk + Vdsat + Vds_eff smooth ───────────────
    var Abulk_ags = Math.max(1 - (p.AGS || 0) * Vgst_eff / (Leff * 1e6), 0.1);
    var Abulk = 1 + (p.K1 || 0) / (2 * sqrtPhis) * Abulk_ags;
    if (!isFinite(Abulk) || Abulk < 0.1) Abulk = 1.0;

    var Esat = 2 * (p.VSAT || 1.5e5) / mu_eff;
    var EsatL = Esat * Leff;
    var Vdsat = EsatL * Vgst_eff / (EsatL + Vgst_eff * Abulk);
    Vdsat = Math.max(Vdsat, 1e-9);

    var delta = Math.max(p.DELTA || 0.01, 1e-6);
    var Vdiff = Vds - Vdsat;
    var Vds_eff = Vdsat - 0.5 * (Vdiff - Math.sqrt(Vdiff * Vdiff + 4 * delta * Vdsat));
    Vds_eff = clamp(Vds_eff, 0, Math.max(Vds, 0) + 0.01);

    // ── Drain current (strong inv) ───────────────────
    var beta = mu_eff * Cox * Weff / Leff;
    var T0 = 1 + Vds_eff / EsatL;
    var Ids_strong = beta * Vgst_eff * Vds_eff / T0;

    // ── CLM: Early voltage ───────────────────────────
    var VaCLM = Math.max(Vdsat * (p.PCLM || 1.3), 5);
    var Ids = Ids_strong * (1 + Math.max(Vds - Vds_eff, 0) / VaCLM);

    // ── Subthreshold leakage (explicit, merged for Vgs < Vth) ──
    if (Vgst < 0) {
      var Isub = beta * vtm * vtm *
                 safeExp((Vgst - (p.VOFF || -0.08)) / vtm) *
                 (1 - safeExp(-Math.max(Vds, 0) / Vt));
      Isub = Math.max(Isub, 0);
      // Use subthreshold directly (Ids_strong underflows anyway)
      Ids = Math.max(Ids, Isub);
      // Clamp so cutoff stays small
      var cutoff_cap = Math.abs(beta * vtm * vtm * safeExp(-Vth / vtm)) + 1e-20;
      if (Ids > cutoff_cap + Isub) Ids = Isub;
    }

    if (!isFinite(Ids) || Ids < 0) Ids = 0;

    // ── Small-signal derivatives ─────────────────────
    var gm, gds, gmb;
    if (Vgst < 0) {
      gm = Math.max(Ids / vtm, 1e-15);
    } else {
      gm = beta * Vds_eff / T0;
    }
    gds = Math.max(Ids / Math.max(VaCLM, 5) + beta * Vgst_eff / (EsatL * T0 * T0), 1e-15);
    gmb = gm * (p.K1 || 0) / (2 * sqrtPhis) * Abulk;

    // ── Meyer capacitances ───────────────────────────
    var Cox_total = Cox * Weff * Leff;
    var Cgs, Cgd;
    if (Vgst_eff <= 1e-10) {
      Cgs = Cox_total * 0.5; Cgd = Cox_total * 0.5;
    } else if (Vds_eff < Vdsat * 0.98) {
      var ratio = Vds_eff / (2 * Vdsat);
      Cgs = Cox_total * (2/3) * (1 - ratio * ratio);
      Cgd = Cox_total * (2/3) * (1 - ratio) * (1 - ratio);
    } else {
      Cgs = Cox_total * (2/3);
      Cgd = 0;
    }

    var region = 'cutoff';
    if (Vgst >= 0) region = (Vds_eff < Vdsat * 0.98) ? 'linear' : 'saturation';

    return {
      Ids: Ids, gm: gm, gds: gds, gmb: gmb,
      Vth: Vth, Vdsat: Vdsat,
      Cgs: Cgs, Cgd: Cgd, Csb: p.CBS || 1e-15, Cdb: p.CBD || 1e-15,
      mu_eff: mu_eff * 1e4, region: region
    };
  }

  // MNA stamp helper. Expects polarity-aware node mapping from caller.
  // Sp = VXA.Sparse shim (stamp(matrix,i,j,val) + rhs write).
  function stamp(matrix, rhs, nD, nG, nS, nB, params, nodeV, Sp) {
    var pol = params.TYPE === -1 ? -1 : 1;
    var vG = nodeV[nG] || 0, vD = nodeV[nD] || 0, vS = nodeV[nS] || 0, vB = nodeV[nB || 0] || 0;
    // Work in NMOS-effective coords
    var Vgs = pol === 1 ? (vG - vS) : (vS - vG);
    var Vds = pol === 1 ? (vD - vS) : (vS - vD);
    var Vbs = pol === 1 ? (vB - vS) : (vS - vB);

    var swapped = false;
    if (Vds < 0) { swapped = true; var t = nD; nD = nS; nS = t; Vds = -Vds; Vgs -= Vds; }

    var r = evaluate(params, Vgs, Vds, Vbs);
    var Ids = r.Ids;
    if (swapped) Ids = -Ids;
    var Isign = (pol === 1) ? 1 : -1;
    var gm = r.gm, gds = r.gds, gmb = r.gmb;

    var Ieq = Isign * (Ids - gm * Vgs - gds * Vds - gmb * Vbs);

    function st(r, c, v) { if (r > 0 && c > 0) Sp.stamp(matrix, r - 1, c - 1, v); }

    st(nD, nG,  Isign * gm);  st(nS, nG, -Isign * gm);
    st(nD, nD,  Isign * gds); st(nS, nS,  Isign * gds);
    st(nD, nS, -Isign * gds); st(nS, nD, -Isign * gds);
    st(nD, nB,  Isign * gmb); st(nS, nB, -Isign * gmb);

    if (nD > 0 && rhs) rhs[nD - 1] -= Ieq;
    if (nS > 0 && rhs) rhs[nS - 1] += Ieq;

    // Convergence helper
    var gmin = 1e-12;
    if (nD > 0) Sp.stamp(matrix, nD - 1, nD - 1, gmin);
    if (nS > 0) Sp.stamp(matrix, nS - 1, nS - 1, gmin);

    return r;
  }

  function parseModelParams(paramObj) {
    var merged = {};
    for (var k in DEFAULTS) merged[k] = DEFAULTS[k];
    if (paramObj) {
      for (var key in paramObj) merged[key.toUpperCase()] = paramObj[key];
    }
    // Normalize TYPE
    if (merged.TYPE === -1 || String(merged.TYPE).toUpperCase() === 'PMOS') {
      merged.TYPE = -1;
      // PMOS default mobility if not user-overridden
      if (!paramObj || paramObj.U0 === undefined) merged.U0 = 150;
      // NOTE: VTH0 sign convention stays user-defined. If user passed a positive VTH0
      // for a PMOS card (as some foundry cards do), we keep it — evaluate() works
      // in NMOS-effective coords where Vth is always positive.
    } else {
      merged.TYPE = 1;
    }
    return merged;
  }

  // Detect if a raw SPICE model is BSIM3-class (LEVEL=49 or VERSION≥3).
  function isBSIM3Model(raw) {
    if (!raw) return false;
    if (raw.LEVEL === 49 || raw.LEVEL === '49') return true;
    var v = raw.VERSION;
    if (typeof v === 'number' && v >= 3) return true;
    if (typeof v === 'string' && parseFloat(v) >= 3) return true;
    return false;
  }

  return {
    evaluate: evaluate,
    stamp: stamp,
    parseModelParams: parseModelParams,
    isBSIM3Model: isBSIM3Model,
    DEFAULTS: DEFAULTS
  };
})();
