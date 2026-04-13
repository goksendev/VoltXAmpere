VXA.SimV2 = (function() {
  var Sp = VXA.Sparse, St = VXA.Stamps;
  var NR_MAX_ITER = 30;
  var V_TOL = 1e-4;
  var GMIN_VAL = 1e-12;
  var VT_VAL = 0.026;
  var _lastNRIter = 0;
  var _lastConverged = true;
  var _lastNodeCount = 0;
  var _lastBandwidth = 0;
  var _simMethod = 'trap'; // 'trap' or 'be'
  var _currentGMIN = 1e-12;
  var _dtJustChanged = false;

  function getNRIter() { return _lastNRIter; }
  function getConverged() { return _lastConverged; }
  function getNodeCount() { return _lastNodeCount; }
  function getBandwidth() { return _lastBandwidth; }
  function getSimMethod() { return _simMethod; }
  function setSimMethod(m) { _simMethod = m; }
  function getCurrentGMIN() { return _currentGMIN; }

  // Main solver — replaces old solveStep() internals
  function solve(dt) {
    if (!SIM || SIM.N <= 1) return;
    var N = SIM.N, nv = SIM.vSrc.length;
    var sz = N - 1 + nv;
    _lastNodeCount = sz;

    var nodeV = S._nodeVoltages || new Float64Array(N);
    var converged = false;
    var iter = 0;

    // N-R loop
    while (!converged && iter < NR_MAX_ITER) {
      var matrix = Sp.create(sz);
      var rhs = new Float64Array(sz);

      // GMIN on every node
      for (var gi = 0; gi < N - 1; gi++) {
        Sp.stamp(matrix, gi, gi, _currentGMIN);
      }

      var vsIdx = 0;

      for (var ci = 0; ci < SIM.comps.length; ci++) {
        var c = SIM.comps[ci];

        if (c.type === 'R') {
          St.resistor(matrix, rhs, c.n1, c.n2, c.val);
          Sp.stamp(matrix, c.n1 > 0 ? c.n1 - 1 : -1, c.n1 > 0 ? c.n1 - 1 : -1, GMIN_VAL);
        } else if (c.type === 'C') {
          if (_simMethod === 'trap' && !_dtJustChanged) {
            St.capacitorTRAP(matrix, rhs, c.n1, c.n2, c.val, dt, c.vPrev, c.iPrev || 0);
          } else {
            St.capacitorBE(matrix, rhs, c.n1, c.n2, c.val, dt, c.vPrev);
          }
        } else if (c.type === 'L') {
          if (_simMethod === 'trap' && !_dtJustChanged) {
            St.inductorTRAP(matrix, rhs, c.n1, c.n2, c.val, dt, c.iPrev, c.vPrev || 0);
          } else {
            var req = c.val / dt;
            var geq = 1 / (req + _currentGMIN);
            St.stampG(matrix, c.n1, c.n2, geq);
            St.stampI(rhs, c.n1, c.iPrev);
            St.stampI(rhs, c.n2, -c.iPrev);
          }
        } else if (c.type === 'I') {
          var current = c.val;
          if (c.isAC) current = c.val * Math.sin(2 * Math.PI * c.freq * S.sim.t);
          St.currentSource(rhs, c.n1, c.n2, current);
        } else if (c.type === 'V') {
          var row = N - 1 + vsIdx;
          var voltage = c.val;
          if (c.isAC) voltage = c.val * Math.sin(2 * Math.PI * c.freq * S.sim.t);
          if (c.isPulse) {
            var tp = ((S.sim.t - c.td) % c.per + c.per) % c.per;
            if (tp < c.tr) voltage = c.v1 + (c.v2 - c.v1) * tp / c.tr;
            else if (tp < c.tr + c.pw) voltage = c.v2;
            else if (tp < c.tr + c.pw + c.tf) voltage = c.v2 + (c.v1 - c.v2) * (tp - c.tr - c.pw) / c.tf;
            else voltage = c.v1;
          }
          if (c.isPWL) {
            var pts = c.points, t = S.sim.t;
            voltage = pts[0][1];
            for (var pi = 1; pi < pts.length; pi++) {
              if (t <= pts[pi][0]) { voltage = pts[pi - 1][1] + (pts[pi][1] - pts[pi - 1][1]) * (t - pts[pi - 1][0]) / (pts[pi][0] - pts[pi - 1][0]); break; }
              voltage = pts[pi][1];
            }
          }
          if (c.isNoise) voltage = (Math.random() - 0.5) * 2 * c.amp;
          // MNA voltage source stamp (branch variable)
          St.voltageSource(matrix, rhs, c.n1, c.n2, voltage, row);
          c._vsIdx = vsIdx;
          vsIdx++;
        } else if (c.type === 'D') {
          var vd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var dModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (dModel && (dModel.RS > 0 || dModel.CJO > 0 || dModel.BV)) {
            St.diode_spice(matrix, rhs, c.n1, c.n2, dModel, vd, dt);
          } else {
            St.diode(matrix, rhs, c.n1, c.n2, c.IS || DIODE_IS, c.N || DIODE_N, vd, VT_VAL);
          }
        } else if (c.type === 'BJT') {
          var bjtModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (bjtModel && (bjtModel.CJE > 0 || bjtModel.ISE > 0 || bjtModel.IKF < 500)) {
            St.bjt_gp(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, bjtModel, nodeV, dt);
          } else {
            St.bjt(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.BF, c.IS, c.NF, c.VAF, nodeV, VT_VAL);
          }
        } else if (c.type === 'MOS') {
          var mosModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (mosModel && (mosModel.CGS > 0 || mosModel.CBD > 0)) {
            St.nmos_spice(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, mosModel, nodeV, dt);
          } else {
            St.mosfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.VTO, c.KP, c.LAMBDA, nodeV);
          }
        } else if (c.type === 'OA') {
          var oaMdl = c.part && c.part.model ? VXA.Models.getModel('opamp', c.part.model) : null;
          if (!c.part._opampState) c.part._opampState = { V_int: 0 };
          var oaParams = oaMdl ? { SR: oaMdl.SR || 0, GBW: oaMdl.GBW || 1e6, Vs_max: 15, Vs_min: -15, _state: c.part._opampState } : null;
          St.opamp(matrix, rhs, c.nP, c.nN, c.nO, c.A, c.Rin, c.Rout, nodeV, oaParams, dt);
        } else if (c.type === 'Z') {
          var zvd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          St.zener(matrix, rhs, c.n1, c.n2, DIODE_IS, DIODE_N, zvd, c.vz, VT_VAL);
        } else if (c.type === 'JFET') {
          St.jfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.Idss, c.Vp, nodeV);
        } else if (c.type === 'VREG') {
          var vIn = nodeV[c.nIn] || 0, vGnd = nodeV[c.nGnd] || 0;
          var target = Math.min(c.vreg, vIn - vGnd - 2);
          if (target < 0) target = 0;
          var gBig = 0.1;
          St.stampG(matrix, c.nOut, c.nGnd, gBig);
          St.stampI(rhs, c.nOut, gBig * target);
          St.stampI(rhs, c.nGnd, -gBig * target);
          St.stampG(matrix, c.nIn, c.nOut, GMIN_VAL);
        } else if (c.type === 'GATE') {
          var pins = c.pins, thresh = 2.5, vH = 5, vL = 0, out = vL;
          if (c.gate === 'not') {
            out = (nodeV[pins[0]] || 0) > thresh ? vL : vH;
          } else {
            var a = (nodeV[pins[0]] || 0) > thresh, b2 = (nodeV[pins[1]] || 0) > thresh;
            if (c.gate === 'and') out = (a && b2) ? vH : vL;
            else if (c.gate === 'or') out = (a || b2) ? vH : vL;
            else if (c.gate === 'nand') out = (a && b2) ? vL : vH;
            else if (c.gate === 'nor') out = (a || b2) ? vL : vH;
            else if (c.gate === 'xor') out = (a !== b2) ? vH : vL;
          }
          c._out = out;
          var outPin = (c.gate === 'not') ? pins[1] : pins[2];
          if (outPin > 0) { Sp.stamp(matrix, outPin - 1, outPin - 1, 1); rhs[outPin - 1] += out; }
        } else if (c.type === 'XFMR') {
          var gCoup = 0.01, ratio = c.ratio || 10;
          St.stampG(matrix, c.n1a, c.n1b, gCoup);
          var vPri = (nodeV[c.n1a] || 0) - (nodeV[c.n1b] || 0);
          var vSecTarget = vPri / ratio;
          St.stampG(matrix, c.n2a, c.n2b, gCoup * ratio * ratio);
          St.stampI(rhs, c.n2a, gCoup * ratio * vSecTarget);
          St.stampI(rhs, c.n2b, -gCoup * ratio * vSecTarget);
        } else if (c.type === 'VCVS') {
          var gain = c.gain || 10, gB = 0.1;
          St.stampG(matrix, c.noP, c.noN, gB);
          var gm = gain * gB;
          if (c.noP > 0 && c.ncP > 0) Sp.stamp(matrix, c.noP - 1, c.ncP - 1, gm);
          if (c.noP > 0 && c.ncN > 0) Sp.stamp(matrix, c.noP - 1, c.ncN - 1, -gm);
          if (c.noN > 0 && c.ncP > 0) Sp.stamp(matrix, c.noN - 1, c.ncP - 1, -gm);
          if (c.noN > 0 && c.ncN > 0) Sp.stamp(matrix, c.noN - 1, c.ncN - 1, gm);
        } else if (c.type === 'VCCS') {
          var gm = c.gm || 0.001;
          if (c.noP > 0 && c.ncP > 0) Sp.stamp(matrix, c.noP - 1, c.ncP - 1, gm);
          if (c.noP > 0 && c.ncN > 0) Sp.stamp(matrix, c.noP - 1, c.ncN - 1, -gm);
          if (c.noN > 0 && c.ncP > 0) Sp.stamp(matrix, c.noN - 1, c.ncP - 1, -gm);
          if (c.noN > 0 && c.ncN > 0) Sp.stamp(matrix, c.noN - 1, c.ncN - 1, gm);
        } else if (c.type === 'CCVS') {
          var rm = c.rm || 1000, gMeas = 0.1;
          St.stampG(matrix, c.ncP, c.ncN, gMeas);
          var gOut = 0.1;
          St.stampG(matrix, c.noP, c.noN, gOut);
          var vCtrl = (nodeV[c.ncP] || 0) - (nodeV[c.ncN] || 0);
          var iCtrl = vCtrl * gMeas, vTarget = rm * iCtrl;
          St.stampI(rhs, c.noP, gOut * vTarget); St.stampI(rhs, c.noN, -gOut * vTarget);
        } else if (c.type === 'CCCS') {
          var alpha = c.alpha || 10, gMeas = 0.1;
          St.stampG(matrix, c.ncP, c.ncN, gMeas);
          var vCtrl = (nodeV[c.ncP] || 0) - (nodeV[c.ncN] || 0);
          var iOut = alpha * vCtrl * gMeas;
          St.stampI(rhs, c.noP, -iOut); St.stampI(rhs, c.noN, iOut);
        } else if (c.type === 'SCR') {
          var vAK = (nodeV[c.nA] || 0) - (nodeV[c.nK] || 0);
          var vGK = (nodeV[c.nG] || 0) - (nodeV[c.nK] || 0);
          if (!c.latched && vGK > 0.7 && vAK > 0.7) c.latched = true;
          if (c.latched && vAK < 0.1) c.latched = false;
          St.stampG(matrix, c.nA, c.nK, 1 / (c.latched ? 0.01 : 1e8));
          St.stampG(matrix, c.nG, c.nK, GMIN_VAL);
        } else if (c.type === 'TRIAC') {
          var v12 = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var vGK = (nodeV[c.nG] || 0) - (nodeV[c.n2] || 0);
          if (!c.active && Math.abs(vGK) > 0.7 && Math.abs(v12) > 0.7) c.active = true;
          if (c.active && Math.abs(v12) < 0.1) c.active = false;
          St.stampG(matrix, c.n1, c.n2, c.active ? 100 : GMIN_VAL);
        } else if (c.type === 'DIAC') {
          var vd = Math.abs((nodeV[c.n1] || 0) - (nodeV[c.n2] || 0));
          St.stampG(matrix, c.n1, c.n2, 1 / (vd > c.vbo ? 0.1 : 1e8));
        } else if (c.type === 'COMP') {
          var vOut = (nodeV[c.nP] || 0) > (nodeV[c.nN] || 0) ? 5 : 0;
          if (c.nO > 0) { Sp.stamp(matrix, c.nO - 1, c.nO - 1, 1); rhs[c.nO - 1] += vOut; }
        } else if (c.type === 'DIGI') {
          var pins = c.pins, thresh = 2.5, vH = 5, vL = 0;
          if (c.subtype === 'dff') {
            var clk = (nodeV[pins[1]] || 0) > thresh;
            if (clk && !c._prevClk) c._q = (nodeV[pins[0]] || 0) > thresh ? 1 : 0;
            c._prevClk = clk;
            if (pins[2] > 0) { Sp.stamp(matrix, pins[2] - 1, pins[2] - 1, 1); rhs[pins[2] - 1] += c._q ? vH : vL; }
            if (pins[3] > 0) { Sp.stamp(matrix, pins[3] - 1, pins[3] - 1, 1); rhs[pins[3] - 1] += c._q ? vL : vH; }
          } else if (c.subtype === 'counter') {
            var clk = (nodeV[pins[0]] || 0) > thresh;
            if (clk && !c._prevClk) c._count = (c._count + 1) % 16;
            c._prevClk = clk;
            for (var bit = 0; bit < 4; bit++) {
              var qp = pins[1 + bit];
              if (qp > 0) { Sp.stamp(matrix, qp - 1, qp - 1, 1); rhs[qp - 1] += (c._count >> bit) & 1 ? vH : vL; }
            }
          } else if (c.subtype === 'shiftreg') {
            var clk = (nodeV[pins[1]] || 0) > thresh;
            if (clk && !c._prevClk) c._state = ((c._state << 1) | ((nodeV[pins[0]] || 0) > thresh ? 1 : 0)) & 0xFF;
            c._prevClk = clk;
            if (pins[2] > 0) { Sp.stamp(matrix, pins[2] - 1, pins[2] - 1, 1); rhs[pins[2] - 1] += (c._state & 1) ? vH : vL; }
          } else if (c.subtype === 'mux') {
            var sel = (nodeV[pins[2]] || 0) > thresh;
            var vOut = sel ? (nodeV[pins[1]] || 0) : (nodeV[pins[0]] || 0);
            if (pins[3] > 0) { Sp.stamp(matrix, pins[3] - 1, pins[3] - 1, 1); rhs[pins[3] - 1] += vOut; }
          }
        }
      }

      // Compile and solve
      Sp.compile(matrix);
      var x = Sp.solveLU(matrix, rhs);
      if (matrix._bandwidth) _lastBandwidth = matrix._bandwidth;

      // Extract voltages
      var newV = new Float64Array(N);
      for (var i = 1; i < N; i++) newV[i] = x[i - 1];

      // Voltage limiting (SPICE-correct)
      if (iter > 0) {
        var VT = VT_VAL;
        for (var li = 0; li < SIM.comps.length; li++) {
          var lc = SIM.comps[li];
          if (lc.type === 'D' || lc.type === 'Z') {
            var Is = lc.IS || 1e-14;
            var Vc = VXA.VoltageLimit.computeVcrit(Is, VT);
            var vdOld = (nodeV[lc.n1] || 0) - (nodeV[lc.n2] || 0);
            var vdNew = newV[lc.n1] - newV[lc.n2];
            var vdLim = VXA.VoltageLimit.junction(vdNew, vdOld, VT, Vc);
            if (Math.abs(vdLim - vdNew) > 1e-10) {
              var adj = (vdLim - vdNew) / 2;
              if (lc.n1 > 0) newV[lc.n1] += adj;
              if (lc.n2 > 0) newV[lc.n2] -= adj;
            }
          } else if (lc.type === 'BJT') {
            var Is = lc.IS || 1e-14;
            var Vc = VXA.VoltageLimit.computeVcrit(Is, VT);
            var p = lc.polarity;
            // V_BE
            var vbeOld = p * ((nodeV[lc.n1]||0) - (nodeV[lc.n3]||0));
            var vbeNew = p * (newV[lc.n1] - newV[lc.n3]);
            var vbeLim = VXA.VoltageLimit.junction(vbeNew, vbeOld, VT, Vc);
            if (Math.abs(vbeLim - vbeNew) > 1e-10) {
              var a2 = (vbeLim - vbeNew) * p / 2;
              if (lc.n1 > 0) newV[lc.n1] += a2;
              if (lc.n3 > 0) newV[lc.n3] -= a2;
            }
            // V_BC
            var vbcOld = p * ((nodeV[lc.n1]||0) - (nodeV[lc.n2]||0));
            var vbcNew = p * (newV[lc.n1] - newV[lc.n2]);
            var vbcLim = VXA.VoltageLimit.junction(vbcNew, vbcOld, VT, Vc);
            if (Math.abs(vbcLim - vbcNew) > 1e-10) {
              var a3 = (vbcLim - vbcNew) * p / 2;
              if (lc.n1 > 0) newV[lc.n1] += a3;
              if (lc.n2 > 0) newV[lc.n2] -= a3;
            }
          } else if (lc.type === 'MOS') {
            var vgsOld = lc.polarity * ((nodeV[lc.n1]||0) - (nodeV[lc.n3]||0));
            var vgsNew = lc.polarity * (newV[lc.n1] - newV[lc.n3]);
            var vgsLim = VXA.VoltageLimit.mos(vgsNew, vgsOld, 0.5);
            if (Math.abs(vgsLim - vgsNew) > 1e-10) {
              var a4 = (vgsLim - vgsNew) * lc.polarity / 2;
              if (lc.n1 > 0) newV[lc.n1] += a4;
              if (lc.n3 > 0) newV[lc.n3] -= a4;
            }
          }
        }
      }

      // Convergence check
      converged = true;
      for (var ci = 0; ci < SIM.comps.length; ci++) {
        var c = SIM.comps[ci];
        if (c.type === 'D' || c.type === 'Z') {
          var vdOld = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var vdNew = newV[c.n1] - newV[c.n2];
          if (Math.abs(vdNew - vdOld) > V_TOL) { converged = false; break; }
        } else if (c.type === 'BJT') {
          var vbeOld = c.polarity * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0));
          var vbeNew = c.polarity * (newV[c.n1] - newV[c.n3]);
          if (Math.abs(vbeNew - vbeOld) > V_TOL) { converged = false; break; }
        } else if (c.type === 'MOS' || c.type === 'JFET') {
          var vgsOld = c.polarity * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0));
          var vgsNew = c.polarity * (newV[c.n1] - newV[c.n3]);
          if (Math.abs(vgsNew - vgsOld) > V_TOL) { converged = false; break; }
        }
      }

      nodeV = newV;
      S._nodeVoltages = nodeV;

      // If no nonlinear components, one iteration is enough
      if (SIM.comps.every(function(c) { return c.type !== 'D' && c.type !== 'BJT' && c.type !== 'MOS' && c.type !== 'Z' && c.type !== 'JFET'; }) || converged) break;
      iter++;
    }

    _lastNRIter = iter + 1;
    _lastConverged = converged;

    // Write results back (identical to old engine)
    S._nodeVoltages = nodeV;
    for (var ci = 0; ci < SIM.comps.length; ci++) {
      var c = SIM.comps[ci];
      var v1 = nodeV[c.n1] || 0, v2 = nodeV[c.n2] || 0, vd = v1 - v2;
      if (c.type === 'R') {
        var cur = vd / c.val;
        c.part._v = Math.abs(vd); c.part._i = Math.abs(cur); c.part._p = Math.abs(vd * cur);
      } else if (c.type === 'C') {
        var geq = c.val / dt, cur = geq * (vd - c.vPrev);
        c.vPrev = vd;
        c.iPrev = cur;
        c.part._v = Math.abs(vd); c.part._i = Math.abs(cur); c.part._p = Math.abs(vd * cur);
      } else if (c.type === 'L') {
        var cur = c.iPrev + (dt / c.val) * vd;
        c.iPrev = cur;
        c.vPrev = vd;
        c.part._v = Math.abs(vd); c.part._i = Math.abs(cur); c.part._p = Math.abs(vd * cur);
      } else if (c.type === 'V') {
        c.part._v = Math.abs(vd); c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'D') {
        var eArg = Math.min(vd / (DIODE_N * VT_VAL), 500);
        var cur = DIODE_IS * (Math.exp(eArg) - 1);
        c.part._v = Math.abs(vd); c.part._i = Math.abs(cur); c.part._p = Math.abs(vd * cur);
        c.vPrev = vd;
      } else if (c.type === 'BJT') {
        var pol = c.polarity;
        var vB = nodeV[c.n1] || 0, vC = nodeV[c.n2] || 0, vE = nodeV[c.n3] || 0;
        var vbe = pol * (vB - vE), vbc = pol * (vB - vC), vce = pol * (vC - vE);
        var eVbe = Math.exp(Math.min(vbe / (c.NF * VT_VAL), 500));
        var ic = c.IS * c.BF / (c.BF + 1) * (eVbe - 1);
        c.part._v = Math.abs(vce); c.part._i = Math.abs(ic); c.part._p = Math.abs(vce * ic);
        c.part._vbe = vbe; c.part._vce = vce; c.part._ic = ic;
        c.part._region = (vbe > 0.5 && vbc < 0) ? 'Aktif' : (vbe > 0.5 && vbc > 0) ? 'Doyma' : 'Kesim';
      } else if (c.type === 'MOS') {
        var pol = c.polarity;
        var vG = nodeV[c.n1] || 0, vD = nodeV[c.n2] || 0, vS = nodeV[c.n3] || 0;
        var vgs = pol * (vG - vS), vds = pol * (vD - vS), vth = c.VTO;
        var id = 0;
        if (vgs > vth) {
          if (vds < vgs - vth) id = c.KP * ((vgs - vth) * vds - vds * vds / 2);
          else id = c.KP / 2 * (vgs - vth) * (vgs - vth) * (1 + c.LAMBDA * vds);
        }
        c.part._v = Math.abs(vds); c.part._i = Math.abs(id); c.part._p = Math.abs(vds * id);
        c.part._vgs = vgs; c.part._vds = vds; c.part._id = id;
        c.part._region = vgs < vth ? 'Kesim' : (vds < vgs - vth ? 'Lineer' : 'Doyma');
      } else if (c.type === 'OA') {
        var vP = nodeV[c.nP] || 0, vN = nodeV[c.nN] || 0, vO = nodeV[c.nO] || 0;
        c.part._v = Math.abs(vO); c.part._i = 0; c.part._p = 0;
        c.part._vinP = vP; c.part._vinN = vN; c.part._vout = vO;
        c.part._av = (Math.abs(vP - vN) > 1e-9) ? (vO / (vP - vN)) : 0;
      } else if (c.type === 'Z') {
        var zVd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
        var zEa = Math.min(Math.abs(zVd) / (DIODE_N * VT_VAL), 500);
        var zCur = zVd >= 0 ? DIODE_IS * (Math.exp(zEa) - 1) : (Math.abs(zVd) > c.vz ? -DIODE_IS * (Math.exp(Math.min((Math.abs(zVd) - c.vz) / (DIODE_N * VT_VAL), 500)) - 1) : 0);
        c.part._v = Math.abs(zVd); c.part._i = Math.abs(zCur); c.part._p = Math.abs(zVd * zCur);
      } else if (c.type === 'VREG') {
        c.part._v = Math.abs((nodeV[c.nOut] || 0) - (nodeV[c.nGnd] || 0));
        c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'GATE') {
        var gOutPin = (c.gate === 'not') ? c.pins[1] : c.pins[2];
        c.part._v = nodeV[gOutPin] || 0; c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'XFMR') {
        c.part._v = Math.abs((nodeV[c.n2a] || 0) - (nodeV[c.n2b] || 0));
        c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'I') {
        c.part._v = Math.abs((nodeV[c.n1] || 0) - (nodeV[c.n2] || 0));
        c.part._i = Math.abs(c.val); c.part._p = c.part._v * c.part._i;
      } else if (c.type === 'VCVS' || c.type === 'VCCS' || c.type === 'CCVS' || c.type === 'CCCS') {
        c.part._v = Math.abs((nodeV[c.noP] || 0) - (nodeV[c.noN] || 0));
        c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'JFET') {
        var pol = c.polarity, vgs = pol * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0)), vds = pol * ((nodeV[c.n2] || 0) - (nodeV[c.n3] || 0));
        var id = c.Idss * Math.pow(Math.max(0, 1 - vgs / c.Vp), 2);
        c.part._v = Math.abs(vds); c.part._i = Math.abs(id); c.part._p = Math.abs(vds * id);
        c.part._region = (pol > 0 ? vgs <= c.Vp : vgs >= c.Vp) ? 'Kesim' : (Math.abs(vds) < Math.abs(vgs - c.Vp) ? 'Lineer' : 'Doyma');
      } else if (c.type === 'SCR') {
        c.part._v = Math.abs((nodeV[c.nA] || 0) - (nodeV[c.nK] || 0)); c.part._i = c.latched ? c.part._v / 0.01 : 0; c.part._p = c.part._v * c.part._i;
      } else if (c.type === 'TRIAC') {
        c.part._v = Math.abs((nodeV[c.n1] || 0) - (nodeV[c.n2] || 0)); c.part._i = c.active ? c.part._v * 100 : 0; c.part._p = c.part._v * c.part._i;
      } else if (c.type === 'DIAC') {
        var vdiac = Math.abs((nodeV[c.n1] || 0) - (nodeV[c.n2] || 0)); c.part._v = vdiac; c.part._i = vdiac > c.vbo ? vdiac / 0.1 : 0; c.part._p = vdiac * c.part._i;
      } else if (c.type === 'COMP') {
        c.part._v = (nodeV[c.nP] || 0) > (nodeV[c.nN] || 0) ? 5 : 0; c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'DIGI') {
        if (c.subtype === 'dff') { c.part._v = c._q ? 5 : 0; }
        else if (c.subtype === 'counter') { c.part._v = c._count; }
        else if (c.subtype === 'shiftreg') { c.part._v = c._state & 1 ? 5 : 0; }
        else if (c.subtype === 'mux') { c.part._v = nodeV[c.pins[3]] || 0; }
        c.part._i = 0; c.part._p = 0;
      }
    }

    // Wire currents
    for (var wi = 0; wi < S.wires.length; wi++) {
      var w = S.wires[wi];
      var wv1 = nodeV[w._n1] || 0, wv2 = nodeV[w._n2] || 0;
      var cur = 0;
      if (w._n1 !== undefined && w._n2 !== undefined && w._n1 !== w._n2) {
        for (var ci = 0; ci < SIM.comps.length; ci++) {
          var c = SIM.comps[ci];
          if ((c.n1 === w._n1 && c.n2 === w._n2) || (c.n1 === w._n2 && c.n2 === w._n1)) {
            if (c.part && c.part._i) { cur = c.part._i * ((wv1 > wv2) ? 1 : -1); break; }
            if (c.type === 'R') { cur = (wv1 - wv2) / c.val; break; }
          }
        }
        if (cur === 0 && Math.abs(wv1 - wv2) > 0.001) cur = (wv1 - wv2) / 1000;
      }
      w._current = cur;
    }

    // Scope
    var scopeNodes = [];
    for (var ni = 1; ni < nodeV.length; ni++) { if (nodeV[ni] !== undefined) scopeNodes.push(ni); }
    for (var ch = 0; ch < 4; ch++) {
      var sch = S.scope.ch[ch];
      if (!sch.on) continue;
      var v = 0;
      if (sch.src !== null) {
        var p = S.parts.find(function(pp) { return pp.id === sch.src; });
        if (p) v = p._v || 0;
      } else if (ch < scopeNodes.length) {
        v = nodeV[scopeNodes[ch]] || 0;
      }
      sch.buf[S.scope.ptr] = v;
    }
    S.scope.ptr = (S.scope.ptr + 1) % 600;
  }

  function findDCOperatingPoint() {
    // Method 1: GMIN stepping
    var GMIN_STEPS = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12];
    var success = false;
    _simMethod = 'be'; // DC OP always uses BE
    _dtJustChanged = true;

    for (var g = 0; g < GMIN_STEPS.length; g++) {
      _currentGMIN = GMIN_STEPS[g];
      solve(1e-5);
      if (_lastConverged) {
        if (g === GMIN_STEPS.length - 1) { success = true; break; }
        continue; // Try smaller GMIN
      } else {
        if (g === 0) break; // Even largest GMIN failed
      }
    }

    if (!success) {
      // Method 2: Source stepping fallback
      _currentGMIN = 1e-12;
      var sources = SIM.comps.filter(function(c) { return c.type === 'V'; });
      var origVals = sources.map(function(s) { return s.val; });
      var steps = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
      for (var si = 0; si < steps.length; si++) {
        for (var j = 0; j < sources.length; j++) sources[j].val = origVals[j] * steps[si];
        solve(1e-5);
      }
      for (var j = 0; j < sources.length; j++) sources[j].val = origVals[j];
      success = _lastConverged;
    }

    _currentGMIN = 1e-12;
    _simMethod = S.simMethod || 'trap'; // Restore to user setting
    _dtJustChanged = false;

    if (!success) console.warn('DC operating point bulunamadı');
    return success;
  }

  return {
    solve: solve, findDCOperatingPoint: findDCOperatingPoint,
    getNRIter: getNRIter, getConverged: getConverged, getNodeCount: getNodeCount,
    getBandwidth: getBandwidth, getSimMethod: getSimMethod, setSimMethod: setSimMethod,
    getCurrentGMIN: getCurrentGMIN
  };
})();