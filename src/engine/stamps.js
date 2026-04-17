VXA.Stamps = (function() {
  var Sp = VXA.Sparse;
  // Sprint 25: safeExp prevents overflow for very small IS values (e.g. BLUE LED IS=3.7e-29)
  function safeExp(x) {
    if (x > 500) return 1.4e217;  // ~exp(500)
    if (x < -500) return 0;
    return Math.exp(x);
  }
  function stampG(matrix, n1, n2, g) {
    if (n1 > 0) Sp.stamp(matrix, n1 - 1, n1 - 1, g);
    if (n2 > 0) Sp.stamp(matrix, n2 - 1, n2 - 1, g);
    if (n1 > 0 && n2 > 0) { Sp.stamp(matrix, n1 - 1, n2 - 1, -g); Sp.stamp(matrix, n2 - 1, n1 - 1, -g); }
  }
  function stampI(rhs, n, i) { if (n > 0) rhs[n - 1] += i; }
  function resistor(matrix, rhs, n1, n2, R) { stampG(matrix, n1, n2, 1 / R); }
  function voltageSource(matrix, rhs, n1, n2, V, bi) {
    if (n1 > 0) { Sp.stamp(matrix, n1 - 1, bi, 1); Sp.stamp(matrix, bi, n1 - 1, 1); }
    if (n2 > 0) { Sp.stamp(matrix, n2 - 1, bi, -1); Sp.stamp(matrix, bi, n2 - 1, -1); }
    rhs[bi] = V;
  }
  function currentSource(rhs, n1, n2, I) { stampI(rhs, n1, -I); stampI(rhs, n2, I); }
  function capacitorBE(matrix, rhs, n1, n2, C, dt, Vprev) {
    var Geq = C / dt, Ieq = Geq * Vprev;
    stampG(matrix, n1, n2, Geq);
    stampI(rhs, n1, Ieq); stampI(rhs, n2, -Ieq);
  }
  function inductorBE(matrix, rhs, n1, n2, L, dt, Iprev, bi) {
    if (n1 > 0) { Sp.stamp(matrix, n1 - 1, bi, 1); Sp.stamp(matrix, bi, n1 - 1, 1); }
    if (n2 > 0) { Sp.stamp(matrix, n2 - 1, bi, -1); Sp.stamp(matrix, bi, n2 - 1, -1); }
    Sp.stamp(matrix, bi, bi, -L / dt);
    rhs[bi] = -L / dt * Iprev;
  }
  function diode(matrix, rhs, n1, n2, Is, Nf, Vd, VT) {
    var nVt = Nf * VT;
    // Sprint 25: vcrit calculation with safe bounds for tiny IS
    var logArg = nVt / (Math.sqrt(2) * Math.max(Is, 1e-40));
    var vcrit = nVt * Math.log(logArg);
    var vdLim = Vd;
    if (Vd > vcrit) vdLim = vcrit + nVt * Math.log(Math.max(1, 1 + (Vd - vcrit) / nVt));
    var eArg = vdLim / nVt;
    var expV = safeExp(eArg);
    var id = Is * (expV - 1);
    var gd = Is / nVt * expV + 1e-12;
    var ieq = id - gd * vdLim;
    stampG(matrix, n1, n2, gd);
    stampI(rhs, n1, -ieq); stampI(rhs, n2, ieq);
  }
  function zener(matrix, rhs, n1, n2, Is, Nf, Vd, vz, VT) {
    // Sprint 30: SPICE 3 continuous zener model
    // Forward and reverse breakdown BOTH stamped every iteration (no if/else)
    // Forward: I_fwd = Is * (exp(Vd/(N*VT)) - 1)
    // Reverse: I_rev = -IBV * exp(-(Vd+BV)/(N*VT))  where BV=vz
    // Total: I = I_fwd + I_rev
    // This eliminates NR discontinuity at vr=vz boundary
    var nVt = Nf * VT;
    var IBV = 1e-3; // breakdown current at BV (1mA standard)

    // --- Forward component with voltage limiting (Shockley) ---
    var vcrit = nVt * Math.log(nVt / (Math.sqrt(2) * Math.max(Is, 1e-40)));
    var vdLim = Vd;
    if (Vd > vcrit) vdLim = vcrit + nVt * Math.log(Math.max(1, 1 + (Vd - vcrit) / nVt));
    var eArgF = Math.min(vdLim / nVt, 500);
    var expF = safeExp(eArgF);
    var Id_fwd = Is * (expF - 1);
    var gd_fwd = Is / nVt * expF;

    // --- Reverse breakdown component (SPICE 3 model) ---
    // I_rev = -IBV * exp(-(Vd + BV) / (N*VT))
    // At Vd = -BV: I_rev = -IBV (breakdown onset)
    // At Vd = -BV - δ: I_rev = -IBV * exp(δ/nVt) (rapid conduction)
    // At Vd > -BV (forward region): I_rev → 0 (negligible)
    var eArgR = Math.min(-(Vd + vz) / nVt, 500);
    var expR = safeExp(eArgR);
    var Id_rev = -IBV * expR;
    var gd_rev = IBV / nVt * expR; // |dI_rev/dVd| positive

    // Total current and conductance
    var Id = Id_fwd + Id_rev;
    var gd = gd_fwd + gd_rev + 1e-12;

    // MNA stamp (standard diode Norton)
    var Ieq = Id - gd * vdLim;
    stampG(matrix, n1, n2, gd);
    stampI(rhs, n1, -Ieq);
    stampI(rhs, n2, Ieq);
  }
  function bjt(matrix, rhs, nB, nC, nE, pol, BF, Is, NF, VAF, nodeV, VT) {
    var vB = nodeV[nB] || 0, vC = nodeV[nC] || 0, vE = nodeV[nE] || 0;
    var vbe = pol * (vB - vE), vbc = pol * (vB - vC);
    var nVt = NF * VT;
    var BR = 1; // reverse beta
    var vcrit = nVt * Math.log(nVt / (Math.sqrt(2) * Is));
    if (vbe > vcrit) vbe = vcrit + nVt * Math.log(Math.max(1, 1 + (vbe - vcrit) / nVt));
    if (vbc > vcrit) vbc = vcrit + nVt * Math.log(Math.max(1, 1 + (vbc - vcrit) / nVt));
    var eVbe = Math.exp(Math.min(vbe / nVt, 500));
    var eVbc = Math.exp(Math.min(vbc / nVt, 500));
    var iF = Is * (eVbe - 1), iR = Is * (eVbc - 1);
    var gF = Is / nVt * eVbe + 1e-12, gR = Is / nVt * eVbc + 1e-12;
    // Ebers-Moll: Ib = IF/BF + IR/BR, Ic = IF - IR/BR
    // B-E junction: linearized base current fraction gbe = gF/BF
    var gbe = gF / BF + 1e-12;
    var ibe = iF / BF;
    var ibe_eq = (ibe - gbe * vbe) * pol;
    stampG(matrix, pol > 0 ? nB : nE, pol > 0 ? nE : nB, gbe);
    stampI(rhs, nB, -ibe_eq); stampI(rhs, nE, ibe_eq);
    // B-C junction: linearized gbc = gR/BR
    var gbc = gR / BR + 1e-12;
    var ibc = iR / BR;
    var ibc_eq = (ibc - gbc * vbc) * pol;
    stampG(matrix, pol > 0 ? nB : nC, pol > 0 ? nC : nB, gbc);
    stampI(rhs, nB, -ibc_eq); stampI(rhs, nC, ibc_eq);
    // Collector VCCS: Ic = IF - IR/BR, linearized gm = gF
    var gm = gF;
    var ic = iF - iR / BR;
    var ic_eq = (ic - gm * vbe + gbc * vbc) * pol;
    if (nC > 0 && nB > 0) Sp.stamp(matrix, nC - 1, nB - 1, gm * pol);
    if (nC > 0 && nE > 0) Sp.stamp(matrix, nC - 1, nE - 1, -gm * pol);
    if (nE > 0 && nB > 0) Sp.stamp(matrix, nE - 1, nB - 1, -gm * pol);
    if (nE > 0) Sp.stamp(matrix, nE - 1, nE - 1, gm * pol);
    stampI(rhs, nC, -ic_eq); stampI(rhs, nE, ic_eq);
    // Early effect (output conductance)
    if (VAF > 0 && VAF < 1e6) {
      var vce = pol * (vC - vE);
      var go = Math.abs(ic) / VAF + 1e-12;
      stampG(matrix, nC, nE, go);
    }
  }
  function mosfet(matrix, rhs, nG, nD, nS, pol, VTO, KP, LAMBDA, nodeV) {
    var vgs = pol * ((nodeV[nG] || 0) - (nodeV[nS] || 0));
    var vds = pol * ((nodeV[nD] || 0) - (nodeV[nS] || 0));
    var id = 0, gm = 0, gds = 1e-12;
    if (vgs <= VTO) {
      id = 0; gm = 0; gds = 1e-12;
    } else if (vds < vgs - VTO) {
      id = KP * ((vgs - VTO) * vds - vds * vds / 2) * (1 + LAMBDA * vds);
      gm = KP * vds * (1 + LAMBDA * vds);
      gds = KP * ((vgs - VTO) - vds) * (1 + LAMBDA * vds) + KP * ((vgs - VTO) * vds - vds * vds / 2) * LAMBDA + 1e-12;
    } else {
      id = KP / 2 * (vgs - VTO) * (vgs - VTO) * (1 + LAMBDA * vds);
      gm = KP * (vgs - VTO) * (1 + LAMBDA * vds);
      gds = KP / 2 * (vgs - VTO) * (vgs - VTO) * LAMBDA + 1e-12;
    }
    var ieq = id - gm * vgs - gds * vds;
    if (nD > 0 && nG > 0) Sp.stamp(matrix, nD - 1, nG - 1, gm * pol);
    if (nD > 0 && nS > 0) Sp.stamp(matrix, nD - 1, nS - 1, -gm * pol);
    if (nS > 0 && nG > 0) Sp.stamp(matrix, nS - 1, nG - 1, -gm * pol);
    if (nS > 0) Sp.stamp(matrix, nS - 1, nS - 1, gm * pol);
    stampG(matrix, pol > 0 ? nD : nS, pol > 0 ? nS : nD, gds);
    var ieqPol = ieq * pol;
    stampI(rhs, nD, -ieqPol); stampI(rhs, nS, ieqPol);
  }
  function jfet(matrix, rhs, nG, nD, nS, pol, Idss, Vp, nodeV) {
    var vgs = pol * ((nodeV[nG] || 0) - (nodeV[nS] || 0));
    var vds = pol * ((nodeV[nD] || 0) - (nodeV[nS] || 0));
    var id = 0, gm = 0, gds = 1e-12;
    if (pol > 0 ? (vgs <= Vp) : (vgs >= Vp)) { id = 0; }
    else if (Math.abs(vds) < Math.abs(vgs - Vp)) {
      id = Idss * (2 * (vgs / Vp - 1) * vds / Vp - (vds / Vp) * (vds / Vp));
      gm = 2 * Idss / Math.abs(Vp) * Math.abs(vds / Vp);
      gds = 2 * Idss / Math.abs(Vp) * Math.abs(vgs / Vp - 1 - vds / Vp) + 1e-12;
    } else {
      id = Idss * Math.pow(Math.max(0, 1 - vgs / Vp), 2);
      gm = -2 * Idss / Vp * (1 - vgs / Vp);
      gds = 1e-12;
    }
    var ieq = id * pol - gm * vgs - gds * vds;
    if (nD > 0 && nG > 0) Sp.stamp(matrix, nD - 1, nG - 1, gm * pol);
    if (nD > 0 && nS > 0) Sp.stamp(matrix, nD - 1, nS - 1, -gm * pol);
    if (nS > 0 && nG > 0) Sp.stamp(matrix, nS - 1, nG - 1, -gm * pol);
    if (nS > 0) Sp.stamp(matrix, nS - 1, nS - 1, gm * pol);
    stampG(matrix, pol > 0 ? nD : nS, pol > 0 ? nS : nD, gds);
    stampI(rhs, nD, -ieq * pol); stampI(rhs, nS, ieq * pol);
  }
  function opamp(matrix, rhs, nP, nN, nO, A_ol, Rin, Rout, nodeV, modelParams, dt) {
    stampG(matrix, nP, nN, 1 / Rin);
    var gOut = 1 / Rout;
    var Vplus = nodeV[nP] || 0, Vminus = nodeV[nN] || 0;
    var Vdiff = Vplus - Vminus;

    // Get model params
    var SR = (modelParams && modelParams.SR) || 0;
    var GBW = (modelParams && modelParams.GBW) || 1e6;
    var Vs_max = (modelParams && modelParams.Vs_max) || 15;
    var Vs_min = (modelParams && modelParams.Vs_min) || -15;
    var Vsat_pos = Vs_max - 1.5;
    var Vsat_neg = Vs_min + 1.5;

    // Frequency-dependent gain via dominant pole
    var tau = A_ol / (2 * Math.PI * GBW);

    // State: use part._opampState
    var state = modelParams && modelParams._state;
    if (state && dt > 0 && tau > 0) {
      var alpha = dt / (dt + tau);
      var target = A_ol * Vdiff;
      target = Math.max(Vsat_neg, Math.min(Vsat_pos, target));
      var V_int_new = state.V_int + alpha * (target - state.V_int);

      // Slew rate limiting
      if (SR > 0) {
        var maxDV = SR * dt;
        var dV = V_int_new - state.V_int;
        if (Math.abs(dV) > maxDV) {
          V_int_new = state.V_int + (dV > 0 ? maxDV : -maxDV);
        }
      }

      // Output saturation
      V_int_new = Math.max(Vsat_neg, Math.min(Vsat_pos, V_int_new));

      // Stamp as voltage-controlled voltage source
      if (nO > 0) {
        Sp.stamp(matrix, nO - 1, nO - 1, gOut + 1);
        rhs[nO - 1] += V_int_new;
      }
      state.V_int = V_int_new;
    } else {
      // Simple model (backward compat / DC)
      var gm_oa = A_ol / Rout;
      var Vout_target = A_ol * Vdiff;
      Vout_target = Math.max(Vsat_neg, Math.min(Vsat_pos, Vout_target));

      if (nO > 0) Sp.stamp(matrix, nO - 1, nO - 1, gOut);
      if (Math.abs(Vout_target) < Vsat_pos) {
        // Linear region — use gm stamp
        if (nO > 0 && nP > 0) Sp.stamp(matrix, nO - 1, nP - 1, gm_oa);
        if (nO > 0 && nN > 0) Sp.stamp(matrix, nO - 1, nN - 1, -gm_oa);
      } else {
        // Saturated — stamp as fixed voltage
        if (nO > 0) rhs[nO - 1] += gOut * Vout_target;
      }
    }
  }
  function capacitorTRAP(matrix, rhs, n1, n2, C, dt, Vprev, Iprev) {
    var Geq = 2 * C / dt;
    var Ieq = Geq * Vprev + (Iprev || 0);
    stampG(matrix, n1, n2, Geq);
    stampI(rhs, n1, Ieq); stampI(rhs, n2, -Ieq);
  }
  function inductorTRAP(matrix, rhs, n1, n2, L, dt, Iprev, Vprev) {
    // Sprint 77: sign fix. Historic current I_hist = Iprev + Geq·Vprev is
    // the current the inductor is "trying to maintain" in the n1→n2
    // direction. Per the codebase convention (see currentSource/diode),
    // a historic source with that direction stamps (-I, +I) at (n1, n2).
    // The old (+Ieq, -Ieq) was inverted and caused RL circuits to diverge.
    var Geq = dt / (2 * L);
    var Ieq = Iprev + Geq * (Vprev || 0);
    stampG(matrix, n1, n2, Geq);
    stampI(rhs, n1, -Ieq); stampI(rhs, n2, Ieq);
  }
  return {
    stampG: stampG, stampI: stampI,
    resistor: resistor, voltageSource: voltageSource, currentSource: currentSource,
    capacitorBE: capacitorBE, inductorBE: inductorBE,
    capacitorTRAP: capacitorTRAP, inductorTRAP: inductorTRAP,
    diode: diode, zener: zener, bjt: bjt, mosfet: mosfet, jfet: jfet, opamp: opamp
  };
})();