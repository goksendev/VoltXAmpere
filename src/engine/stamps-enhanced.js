VXA.Stamps.diode_spice = function(matrix, rhs, n1, n2, params, Vd_prev, dt) {
  var Sp = VXA.Sparse, VT = 0.026;
  var IS = params.IS || 1e-14, N = params.N || 1, RS = params.RS || 0;
  var BV = params.BV || 100, CJO = params.CJO || 0, VJ = params.VJ || 0.7, M = params.M || 0.5, TT = params.TT || 0;
  var Vd = Math.max(-BV - 5, Math.min(Vd_prev, 0.8));
  var nVt = N * VT;
  var vcrit = nVt * Math.log(nVt / (Math.sqrt(2) * IS));
  if (Vd > vcrit) Vd = vcrit + nVt * Math.log(Math.max(1, 1 + (Vd - vcrit) / nVt));
  var Id, gd;
  if (Vd >= -5 * nVt) {
    var eArg = Math.min(Vd / nVt, 500);
    var expV = Math.exp(eArg);
    Id = IS * (expV - 1);
    gd = IS / nVt * expV;
  } else { Id = -IS; gd = IS / nVt * Math.exp(-5); }
  // Reverse breakdown
  if (Vd_prev < -BV) {
    var Vbr = Vd_prev + BV;
    var Ibr = -IS * Math.exp(Math.min(-Vbr / VT, 500));
    var gbr = IS / VT * Math.exp(Math.min(-Vbr / VT, 500));
    Id += Ibr; gd += gbr;
  }
  gd += 1e-12;
  var Ieq = Id - gd * Vd;
  // Series resistance approximation
  if (RS > 0.01) {
    var g_total = 1 / (1 / gd + RS);
    VXA.Stamps.stampG(matrix, n1, n2, g_total);
    VXA.Stamps.stampI(rhs, n1, -Ieq * g_total / gd);
    VXA.Stamps.stampI(rhs, n2, Ieq * g_total / gd);
  } else {
    VXA.Stamps.stampG(matrix, n1, n2, gd);
    VXA.Stamps.stampI(rhs, n1, -Ieq); VXA.Stamps.stampI(rhs, n2, Ieq);
  }
  // Junction capacitance (transient)
  if (dt > 0 && (CJO > 0 || TT > 0)) {
    var Cj = 0;
    if (CJO > 0) { Cj = Vd < 0.5 * VJ ? CJO / Math.pow(Math.max(0.01, 1 - Vd / VJ), M) : CJO / Math.pow(0.5, M) * (1 + M * (Vd / VJ - 0.5) / 0.5); }
    var Cd = TT * gd;
    var Ct = Cj + Cd;
    if (Ct > 0) VXA.Stamps.capacitorBE(matrix, rhs, n1, n2, Ct, dt, Vd_prev);
  }
};

// 7.3: GUMMEL-POON BJT STAMP
VXA.Stamps.bjt_gp = function(matrix, rhs, nB, nC, nE, pol, params, nodeV, dt) {
  var Sp = VXA.Sparse, VT = 0.026;
  var IS = params.IS || 1e-14, BF = params.BF || 100, NF = params.NF || 1;
  var BR = params.BR || 1, NR = params.NR || 1;
  var VAF = params.VAF || 1000, VAR = params.VAR || 1000, IKF = params.IKF || 1000;
  var ISE = params.ISE || 0, NE = params.NE || 1.5;
  var ISC = params.ISC || 0, NC = params.NC || 2;
  var vB = nodeV[nB] || 0, vC = nodeV[nC] || 0, vE = nodeV[nE] || 0;
  var vbe = pol * (vB - vE), vbc = pol * (vB - vC);
  var nVtF = NF * VT, nVtR = NR * VT;
  var vcrit = nVtF * Math.log(nVtF / (Math.sqrt(2) * IS));
  // SPICE3 junction limiting
  if (vbe > vcrit) vbe = vcrit + nVtF * Math.log(Math.max(1, 1 + (vbe - vcrit) / nVtF));
  if (vbc > vcrit) vbc = vcrit + nVtR * Math.log(Math.max(1, 1 + (vbc - vcrit) / nVtR));
  // Hard physical clamp: silicon VBE forward bias limit
  if (vbe > 0.80) vbe = 0.80;
  if (vbc > 0.80) vbc = 0.80;
  var eVbe = Math.exp(Math.min(vbe / nVtF, 500));
  var eVbc = Math.exp(Math.min(vbc / nVtR, 500));
  // Base charge factor (Early + high-current)
  var q1 = 1 / Math.max(0.01, 1 - vbc / VAF - vbe / VAR);
  var Iff = IS * (eVbe - 1);
  var q2 = IKF > 0 ? Iff / IKF : 0;
  var qb = q1 * (1 + Math.sqrt(1 + 4 * q2)) / 2;
  // Currents
  var Icc = IS / qb * (eVbe - eVbc);
  var Ibe = IS / BF * (eVbe - 1) + (ISE > 0 ? ISE * (Math.exp(Math.min(vbe / (NE * VT), 500)) - 1) : 0);
  var Ibc = IS / BR * (eVbc - 1) + (ISC > 0 ? ISC * (Math.exp(Math.min(vbc / (NC * VT), 500)) - 1) : 0);
  // Conductances
  var gm_f = IS / (qb * nVtF) * eVbe;
  var gm_r = IS / (qb * nVtR) * eVbc;
  var gbe = IS / (BF * nVtF) * eVbe + (ISE > 0 ? ISE / (NE * VT) * Math.exp(Math.min(vbe / (NE * VT), 500)) : 0) + 1e-12;
  var gbc = IS / (BR * nVtR) * eVbc + (ISC > 0 ? ISC / (NC * VT) * Math.exp(Math.min(vbc / (NC * VT), 500)) : 0) + 1e-12;
  // B-E junction
  VXA.Stamps.stampG(matrix, pol > 0 ? nB : nE, pol > 0 ? nE : nB, gbe);
  var ieqBE = (Ibe - gbe * vbe) * pol;
  VXA.Stamps.stampI(rhs, nB, -ieqBE); VXA.Stamps.stampI(rhs, nE, ieqBE);
  // B-C junction
  VXA.Stamps.stampG(matrix, pol > 0 ? nB : nC, pol > 0 ? nC : nB, gbc);
  var ieqBC = (Ibc - gbc * vbc) * pol;
  VXA.Stamps.stampI(rhs, nB, -ieqBC); VXA.Stamps.stampI(rhs, nC, ieqBC);
  // Transport current VCCS
  if (nC > 0 && nB > 0) Sp.stamp(matrix, nC - 1, nB - 1, gm_f * pol);
  if (nC > 0 && nE > 0) Sp.stamp(matrix, nC - 1, nE - 1, -gm_f * pol);
  if (nE > 0 && nB > 0) Sp.stamp(matrix, nE - 1, nB - 1, -(gm_f - gm_r) * pol);
  if (nE > 0 && nC > 0) Sp.stamp(matrix, nE - 1, nC - 1, gm_r * pol);
  if (nE > 0) Sp.stamp(matrix, nE - 1, nE - 1, (gm_f - gm_r) * pol);
  if (nC > 0) Sp.stamp(matrix, nC - 1, nC - 1, -gm_r * pol);
  var Ieq_cc = (Icc - gm_f * vbe + gm_r * vbc) * pol;
  VXA.Stamps.stampI(rhs, nC, -Ieq_cc); VXA.Stamps.stampI(rhs, nE, Ieq_cc);
  // Junction capacitances (transient)
  if (dt > 0) {
    var CJE = params.CJE || 0, VJE = params.VJE || 0.75, MJE = params.MJE || 0.33;
    var CJC = params.CJC || 0, VJC = params.VJC || 0.75, MJC = params.MJC || 0.33;
    var TF = params.TF || 0, TR = params.TR || 0;
    if (CJE > 0 || TF > 0) {
      var Cbe = CJE > 0 ? (vbe < 0.5 * VJE ? CJE / Math.pow(Math.max(0.01, 1 - vbe / VJE), MJE) : CJE / Math.pow(0.5, MJE)) : 0;
      Cbe += TF * gm_f;
      if (Cbe > 0) VXA.Stamps.capacitorBE(matrix, rhs, nB, nE, Cbe, dt, pol * ((nodeV[nB] || 0) - (nodeV[nE] || 0)));
    }
    if (CJC > 0 || TR > 0) {
      var Cbc = CJC > 0 ? (vbc < 0.5 * VJC ? CJC / Math.pow(Math.max(0.01, 1 - vbc / VJC), MJC) : CJC / Math.pow(0.5, MJC)) : 0;
      Cbc += TR * gm_r;
      if (Cbc > 0) VXA.Stamps.capacitorBE(matrix, rhs, nB, nC, Cbc, dt, pol * ((nodeV[nB] || 0) - (nodeV[nC] || 0)));
    }
  }
};

// 7.4: ENHANCED MOSFET STAMP (Parasitic Capacitances)
VXA.Stamps.nmos_spice = function(matrix, rhs, nG, nD, nS, pol, params, nodeV, dt) {
  var Sp = VXA.Sparse;
  var VTO = params.VTO || 2, KP = params.KP || 110e-6, LAMBDA = params.LAMBDA || 0.04;
  var vgs = pol * ((nodeV[nG] || 0) - (nodeV[nS] || 0));
  var vds = pol * ((nodeV[nD] || 0) - (nodeV[nS] || 0));
  var id = 0, gm = 0, gds = 1e-12;
  if (vgs <= VTO) { id = 0; gm = 0; gds = 1e-12; }
  else if (vds < vgs - VTO) {
    id = KP * ((vgs - VTO) * vds - vds * vds / 2) * (1 + LAMBDA * vds);
    gm = KP * vds * (1 + LAMBDA * vds);
    gds = KP * ((vgs - VTO) - vds) * (1 + LAMBDA * vds) + KP * ((vgs - VTO) * vds - vds * vds / 2) * LAMBDA + 1e-12;
  } else {
    var Vov = vgs - VTO;
    id = KP / 2 * Vov * Vov * (1 + LAMBDA * vds);
    gm = KP * Vov * (1 + LAMBDA * vds);
    gds = KP / 2 * Vov * Vov * LAMBDA + 1e-12;
  }
  var ieq = id - gm * vgs - gds * vds;
  if (nD > 0 && nG > 0) Sp.stamp(matrix, nD - 1, nG - 1, gm * pol);
  if (nD > 0 && nS > 0) Sp.stamp(matrix, nD - 1, nS - 1, -gm * pol);
  if (nS > 0 && nG > 0) Sp.stamp(matrix, nS - 1, nG - 1, -gm * pol);
  if (nS > 0) Sp.stamp(matrix, nS - 1, nS - 1, gm * pol);
  VXA.Stamps.stampG(matrix, pol > 0 ? nD : nS, pol > 0 ? nS : nD, gds);
  VXA.Stamps.stampI(rhs, nD, -ieq * pol); VXA.Stamps.stampI(rhs, nS, ieq * pol);
  // Gate capacitances (transient)
  if (dt > 0) {
    var CGS = params.CGS || params.CGSO || 0;
    var CGD = params.CGDO || 0, CBD = params.CBD || 0;
    if (CGS > 0) VXA.Stamps.capacitorBE(matrix, rhs, nG, nS, CGS, dt, pol * ((nodeV[nG] || 0) - (nodeV[nS] || 0)));
    if (CGD > 0) VXA.Stamps.capacitorBE(matrix, rhs, nG, nD, CGD, dt, pol * ((nodeV[nG] || 0) - (nodeV[nD] || 0)));
    if (CBD > 0) VXA.Stamps.capacitorBE(matrix, rhs, nD, nS, CBD, dt, pol * ((nodeV[nD] || 0) - (nodeV[nS] || 0)));
  }
};