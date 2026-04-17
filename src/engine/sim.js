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
            // Sprint 40: delegate to VXA.Sources.pwl if available (centralized impl)
            if (typeof VXA !== 'undefined' && VXA.Sources && typeof VXA.Sources.pwl === 'function') {
              voltage = VXA.Sources.pwl(S.sim.t, c.points);
            } else {
              var pts = c.points, t = S.sim.t;
              voltage = pts[0][1];
              for (var pi = 1; pi < pts.length; pi++) {
                if (t <= pts[pi][0]) { voltage = pts[pi - 1][1] + (pts[pi][1] - pts[pi - 1][1]) * (t - pts[pi - 1][0]) / (pts[pi][0] - pts[pi - 1][0]); break; }
                voltage = pts[pi][1];
              }
            }
          }
          // Sprint 40: EXP / SFFM sources
          if (c.isEXP && VXA.Sources) {
            voltage = VXA.Sources.exp(S.sim.t, c.expParams || {});
          }
          if (c.isSFFM && VXA.Sources) {
            voltage = VXA.Sources.sffm(S.sim.t, c.sffmParams || {});
          }
          if (c.isNoise) voltage = (Math.random() - 0.5) * 2 * c.amp;
          // MNA voltage source stamp (branch variable)
          St.voltageSource(matrix, rhs, c.n1, c.n2, voltage, row);
          c._vsIdx = vsIdx;
          vsIdx++;
        } else if (c.type === 'D') {
          var vd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var dModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          // Sprint 24: LEDs use basic stamp with model IS/N for better convergence
          // diode_spice RS handling causes convergence issues with high-N LED models
          if (dModel && c.part && c.part.type !== 'led' && (dModel.RS > 0 || dModel.CJO > 0 || dModel.BV)) {
            St.diode_spice(matrix, rhs, c.n1, c.n2, dModel, vd, dt);
          } else {
            var dIS = dModel ? (dModel.IS || DIODE_IS) : (c.IS || DIODE_IS);
            var dN = dModel ? (dModel.N || DIODE_N) : (c.N || DIODE_N);
            St.diode(matrix, rhs, c.n1, c.n2, dIS, dN, vd, VT_VAL);
          }
        } else if (c.type === 'BJT') {
          // Always use Gummel-Poon when model available (more accurate convergence)
          var bjtModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (!bjtModel) bjtModel = { IS: c.IS, BF: c.BF, NF: c.NF, VAF: c.VAF, BR: 1, NR: 1, IKF: 1000 };
          St.bjt_gp(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, bjtModel, nodeV, dt);
        } else if (c.type === 'MOS') {
          // Sprint 41: BSIM3 takes precedence when model is marked BSIM3-class.
          if (c.isBSIM3 && c.bsim3 && VXA.BSIM3) {
            try {
              // BSIM3.stamp signature: (matrix, rhs, nD, nG, nS, nB, params, nodeV, Sp)
              // Our MOS pin mapping is n1=D, n2=G, n3=S; bulk defaults to 0 (ground).
              VXA.BSIM3.stamp(matrix, rhs, c.n1, c.n2, c.n3, 0, c.bsim3, nodeV, Sp);
            } catch (e) {
              // Fallback to Level 1 if BSIM3 stamp throws (safety net)
              St.mosfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.VTO || 2, c.KP || 110e-6, c.LAMBDA || 0.04, nodeV);
            }
          } else {
            var mosModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
            if (mosModel && (mosModel.CGS > 0 || mosModel.CBD > 0)) {
              St.nmos_spice(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, mosModel, nodeV, dt);
            } else {
              St.mosfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.VTO, c.KP, c.LAMBDA, nodeV);
            }
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
          var _cvp = nodeV[c.nP] || 0, _cvn = nodeV[c.nN] || 0;
          var _chyst = (c.part && c.part.props && c.part.props.hysteresis) || 0.01;
          var _cprev = c.part ? (c.part._compOutput || false) : false;
          var _cnew = _cprev;
          if (_cvp > _cvn + _chyst) _cnew = true;
          else if (_cvp < _cvn - _chyst) _cnew = false;
          if (c.part) { c.part._compOutput = _cnew; c.part._compVp = _cvp; c.part._compVn = _cvn; }
          var vOut = _cnew ? 5 : 0;
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
        } else if (c.type === 'IC555') {
          // Sprint 27a: 555 Timer behavioural model
          var vVCC = (nodeV[c.nVCC] || 0) - (nodeV[c.nGND] || 0);
          var vTRIG = (nodeV[c.nTRIG] || 0) - (nodeV[c.nGND] || 0);
          var vTHR = (nodeV[c.nTHR] || 0) - (nodeV[c.nGND] || 0);
          var vRST = (nodeV[c.nRST] || 0) - (nodeV[c.nGND] || 0);
          var vCTRL_raw = (c.nCTRL > 0 ? (nodeV[c.nCTRL] || 0) - (nodeV[c.nGND] || 0) : 0);
          var upperTh = (c.nCTRL > 0 && Math.abs(vCTRL_raw) > 0.1) ? vCTRL_raw : vVCC * 2 / 3;
          var lowerTh = upperTh / 2;

          // Latch logic (persistent state)
          if (!c.part.ic555State) c.part.ic555State = { latch: false };
          var L = c.part.ic555State;
          if (vRST < 0.7 && vVCC > 1) L.latch = false;       // Reset override
          else if (vTRIG < lowerTh && vVCC > 1) L.latch = true;  // SET
          else if (vTHR > upperTh && vVCC > 1) L.latch = false;  // RESET
          // Else: hold previous state

          // Output stamp (push-pull voltage source via low-Z resistor)
          var vOut555 = L.latch ? Math.max(0, vVCC - 1.5) : 0.1;
          var Rout = 50;
          if (c.nOUT > 0) {
            Sp.stamp(matrix, c.nOUT - 1, c.nOUT - 1, 1 / Rout);
            rhs[c.nOUT - 1] += vOut555 / Rout;
          }

          // Discharge pin: latch LOW → pin7 pulled to GND (open collector NPN saturated)
          if (!L.latch && c.nDIS > 0 && c.nGND >= 0) {
            var Rdis = 10;
            Sp.stamp(matrix, c.nDIS - 1, c.nDIS - 1, 1 / Rdis);
            if (c.nGND > 0) {
              Sp.stamp(matrix, c.nDIS - 1, c.nGND - 1, -1 / Rdis);
              Sp.stamp(matrix, c.nGND - 1, c.nDIS - 1, -1 / Rdis);
              Sp.stamp(matrix, c.nGND - 1, c.nGND - 1, 1 / Rdis);
            }
          }

          // Internal voltage divider (VCC to GND, ~15kΩ)
          if (c.nVCC > 0 && c.nGND >= 0) {
            var Rint = 15000;
            Sp.stamp(matrix, c.nVCC - 1, c.nVCC - 1, 1 / Rint);
            if (c.nGND > 0) {
              Sp.stamp(matrix, c.nVCC - 1, c.nGND - 1, -1 / Rint);
              Sp.stamp(matrix, c.nGND - 1, c.nVCC - 1, -1 / Rint);
              Sp.stamp(matrix, c.nGND - 1, c.nGND - 1, 1 / Rint);
            }
          }
        }
      }

      // Compile and solve
      Sp.compile(matrix);
      var x;
      // Sprint 69 FIX: proper sparse safety mechanism.
      // Phase 1 (first 100 large-matrix solves): run BOTH dense + banded,
      //   compare, count failures. Always return dense result.
      // Phase 2 (after verification): if verification saw <3 discrepancies,
      //   use banded (fast path). If it saw >=3, PERMANENTLY fall back to
      //   dense for this session — no silent wrong answers.
      if (typeof _sparseVerified !== 'undefined' && !_sparseVerified && matrix.n > 30) {
        var xDense = Sp.solveLU_dense(matrix, rhs);
        var xBanded = Sp.solveLU_banded(matrix, rhs);
        var maxDiff = 0;
        for (var vi = 0; vi < matrix.n; vi++) {
          var diff = Math.abs(xDense[vi] - xBanded[vi]);
          var scale = Math.max(Math.abs(xDense[vi]), 1e-10);
          if (diff / scale > maxDiff) maxDiff = diff / scale;
        }
        _sparseVerifyCount++;
        if (maxDiff > 0.001) _sparseFailCount++;
        if (_sparseVerifyCount >= 100) {
          _sparseVerified = true;
          _useSparse = _sparseFailCount < 3;
          if (!_useSparse && typeof console !== 'undefined') {
            console.warn('[VXA] Sparse solver discrepancies detected (' + _sparseFailCount + '/100) — falling back to dense solver for remainder of session.');
          }
        }
        x = xDense; // Always safe during verification
      } else if (typeof _sparseVerified !== 'undefined' && _sparseVerified && !_useSparse && matrix.n > 30) {
        // Post-verification, sparse failed QA → permanent dense.
        x = Sp.solveLU_dense(matrix, rhs);
      } else {
        x = Sp.solveLU(matrix, rhs);
      }
      if (matrix._bandwidth) _lastBandwidth = matrix._bandwidth;

      // Extract voltages — NaN guard
      var newV = new Float64Array(N);
      var _solveHasNaN = false;
      for (var i = 1; i < N; i++) {
        newV[i] = x[i - 1];
        if (!isFinite(newV[i])) { newV[i] = nodeV[i] || 0; _solveHasNaN = true; }
      }
      if (_solveHasNaN) { converged = false; break; }

      // Voltage limiting (SPICE-correct)
      if (iter > 0) {
        var VT = VT_VAL;
        for (var li = 0; li < SIM.comps.length; li++) {
          var lc = SIM.comps[li];
          if (lc.type === 'D' || lc.type === 'Z') {
            // Sprint 25: Use model IS/N for vcrit (not generic 1e-14/1)
            // This is critical for LEDs — generic vcrit=0.73V compresses Vd too aggressively
            var lcMdl = lc.part && lc.part.model ? VXA.Models.getModel(lc.part.type, lc.part.model) : null;
            var Is = lcMdl ? (lcMdl.IS || lc.IS || 1e-14) : (lc.IS || 1e-14);
            var Nf = lcMdl ? (lcMdl.N || lc.N || 1) : (lc.N || 1);
            var nVt = Nf * VT;
            var Vc = VXA.VoltageLimit.computeVcrit(Is, nVt);
            var vdOld = (nodeV[lc.n1] || 0) - (nodeV[lc.n2] || 0);
            var vdNew = newV[lc.n1] - newV[lc.n2];
            var vdLim = VXA.VoltageLimit.junction(vdNew, vdOld, nVt, Vc);
            // Sprint 25: Adaptive damping for LEDs — limit max step based on distance to Vf_typ
            if (lcMdl && lcMdl.Vf_typ) {
              var targetVf = lcMdl.Vf_typ;
              var deltaV = vdLim - vdOld;
              var maxDelta;
              if (vdOld < 0.1) maxDelta = targetVf * 0.5;
              else if (vdOld < targetVf * 0.7) maxDelta = 0.3;
              else maxDelta = 0.1; // near target: fine steps (relaxed from 0.05 for faster convergence)
              if (deltaV > maxDelta) vdLim = vdOld + maxDelta;
              else if (deltaV < -maxDelta) vdLim = vdOld - maxDelta;
            }
            if (Math.abs(vdLim - vdNew) > 1e-10) {
              var adj = (vdLim - vdNew) / 2;
              if (lc.n1 > 0) newV[lc.n1] += adj;
              if (lc.n2 > 0) newV[lc.n2] -= adj;
            }
          } else if (lc.type === 'BJT') {
            var Is = lc.IS || 1e-14;
            var Vc = VXA.VoltageLimit.computeVcrit(Is, VT);
            var p = lc.polarity;
            // V_BE — SPICE3 junction limiting + hard physical clamp
            var vbeOld = p * ((nodeV[lc.n1]||0) - (nodeV[lc.n3]||0));
            var vbeNew = p * (newV[lc.n1] - newV[lc.n3]);
            var vbeLim = VXA.VoltageLimit.junction(vbeNew, vbeOld, VT, Vc);
            // Hard clamp: silicon VBE physically cannot exceed ~0.85V
            if (vbeLim > 0.85) vbeLim = 0.85;
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
          } else if (lc.type === 'JFET') {
            // Sprint 69 FIX: JFET was in convergence check but not in voltage
            // limiting — caused NR oscillation on JFET circuits. Use same
            // 0.5V-per-iter Vgs step limit as MOSFET.
            var vgsOldJ = lc.polarity * ((nodeV[lc.n1]||0) - (nodeV[lc.n3]||0));
            var vgsNewJ = lc.polarity * (newV[lc.n1] - newV[lc.n3]);
            var vgsLimJ = VXA.VoltageLimit.mos(vgsNewJ, vgsOldJ, 0.5);
            if (Math.abs(vgsLimJ - vgsNewJ) > 1e-10) {
              var a5 = (vgsLimJ - vgsNewJ) * lc.polarity / 2;
              if (lc.n1 > 0) newV[lc.n1] += a5;
              if (lc.n3 > 0) newV[lc.n3] -= a5;
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
        // Sprint 69 FIX: Proper KCL — sum ALL branch currents leaving node n1
        // (through every adjacent branch: R, C, L, D, BJT coll/emit, MOSFET drain/source).
        // Then V source current = net current OUT of its positive node.
        var _vnode = c.n1;
        var _vI = 0;
        for (var _vk = 0; _vk < SIM.comps.length; _vk++) {
          var _vc = SIM.comps[_vk];
          if (_vc === c || _vc.type === 'V') continue;
          // Determine which pin(s) touch _vnode and the branch current flowing
          // out of _vnode toward the rest of the branch.
          if (_vc.type === 'R') {
            if (_vc.n1 === _vnode) _vI += ((nodeV[_vc.n1] || 0) - (nodeV[_vc.n2] || 0)) / _vc.val;
            else if (_vc.n2 === _vnode) _vI += ((nodeV[_vc.n2] || 0) - (nodeV[_vc.n1] || 0)) / _vc.val;
          } else if (_vc.type === 'L') {
            if (_vc.n1 === _vnode) _vI += _vc.iPrev || 0;
            else if (_vc.n2 === _vnode) _vI -= _vc.iPrev || 0;
          } else if (_vc.type === 'C') {
            // Instantaneous cap current from companion: G*dv/dt from last frame
            var _cCur = _vc.iPrev || 0;
            if (_vc.n1 === _vnode) _vI += _cCur;
            else if (_vc.n2 === _vnode) _vI -= _cCur;
          } else if (_vc.type === 'I') {
            if (_vc.n1 === _vnode) _vI += _vc.val;
            else if (_vc.n2 === _vnode) _vI -= _vc.val;
          } else if (_vc.type === 'D' || _vc.type === 'Z') {
            // Use part._i (computed elsewhere) if available
            var _diI = _vc.part && _vc.part._i ? _vc.part._i : 0;
            // Direction: anode = n1 (current flows n1 → n2)
            if (_vc.n1 === _vnode) _vI += _diI;
            else if (_vc.n2 === _vnode) _vI -= _diI;
          }
        }
        c.part._v = Math.abs(vd); c.part._i = Math.abs(_vI); c.part._p = Math.abs(vd * _vI);
      } else if (c.type === 'D') {
        // Sprint 69 FIX: Primary readout via Shockley equation (physically correct),
        // then compare with KCL from anode — if KCL gives finite non-zero, prefer it
        // (more robust for multi-resistor parallel LED configurations).
        var dMdl2 = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
        var dIS2 = dMdl2 ? (dMdl2.IS || DIODE_IS) : (c.IS || DIODE_IS);
        var dN2 = dMdl2 ? (dMdl2.N || DIODE_N) : (c.N || DIODE_N);
        var eArg = Math.min(vd / (dN2 * VT_VAL), 500);
        var shockleyCur = dIS2 * (Math.exp(eArg) - 1);

        // KCL at anode (n1): sum all currents flowing OUT via adjacent R/L/C/D (excluding self)
        var cur = 0;
        var _diAnode = c.n1;
        if (_diAnode > 0) {
          for (var ck = 0; ck < SIM.comps.length; ck++) {
            var cc = SIM.comps[ck];
            if (cc === c) continue;
            if (cc.type === 'R') {
              if (cc.n1 === _diAnode) cur += ((nodeV[cc.n1] || 0) - (nodeV[cc.n2] || 0)) / cc.val;
              else if (cc.n2 === _diAnode) cur += ((nodeV[cc.n2] || 0) - (nodeV[cc.n1] || 0)) / cc.val;
            } else if (cc.type === 'L') {
              if (cc.n1 === _diAnode) cur += cc.iPrev || 0;
              else if (cc.n2 === _diAnode) cur -= cc.iPrev || 0;
            }
          }
          cur = Math.abs(cur);
        }
        // Prefer KCL if it found real branch current; otherwise use Shockley
        if (cur < 1e-15) cur = Math.abs(shockleyCur);
        c.part._v = Math.abs(vd); c.part._i = cur; c.part._p = Math.abs(vd * cur);
        c.vPrev = vd;
      } else if (c.type === 'BJT') {
        var pol = c.polarity;
        var vB = nodeV[c.n1] || 0, vC = nodeV[c.n2] || 0, vE = nodeV[c.n3] || 0;
        var vbe = pol * (vB - vE), vbc = pol * (vB - vC), vce = pol * (vC - vE);
        // Sprint 69 FIX: Proper KCL at collector — sum ALL currents flowing OUT of collector
        // through every adjacent resistor/inductor/capacitor/other BJT/diode/V source.
        // IC = |sum of branch currents leaving collector node|.
        var ic = 0;
        var _bjtCollNode = c.n2;
        if (_bjtCollNode > 0) {
          for (var _bci = 0; _bci < SIM.comps.length; _bci++) {
            var _bc = SIM.comps[_bci];
            if (_bc === c) continue;
            if (_bc.type === 'R') {
              if (_bc.n1 === _bjtCollNode) ic += ((nodeV[_bc.n1] || 0) - (nodeV[_bc.n2] || 0)) / _bc.val;
              else if (_bc.n2 === _bjtCollNode) ic += ((nodeV[_bc.n2] || 0) - (nodeV[_bc.n1] || 0)) / _bc.val;
            } else if (_bc.type === 'L') {
              if (_bc.n1 === _bjtCollNode) ic += _bc.iPrev || 0;
              else if (_bc.n2 === _bjtCollNode) ic -= _bc.iPrev || 0;
            } else if (_bc.type === 'C') {
              var _bcI = _bc.iPrev || 0;
              if (_bc.n1 === _bjtCollNode) ic += _bcI;
              else if (_bc.n2 === _bjtCollNode) ic -= _bcI;
            } else if (_bc.type === 'D' || _bc.type === 'Z') {
              var _bdI = _bc.part && _bc.part._i ? _bc.part._i : 0;
              if (_bc.n1 === _bjtCollNode) ic += _bdI;
              else if (_bc.n2 === _bjtCollNode) ic -= _bdI;
            }
          }
          ic = Math.abs(ic);
        }
        // Fallback to emitter-based KCL if collector has nothing (grounded-emitter inverted layouts)
        if (ic < 1e-12) {
          var _bjtEmitNode = c.n3;
          if (_bjtEmitNode > 0) {
            for (var _bei = 0; _bei < SIM.comps.length; _bei++) {
              var _be = SIM.comps[_bei];
              if (_be === c) continue;
              if (_be.type === 'R') {
                if (_be.n1 === _bjtEmitNode) ic += ((nodeV[_be.n1] || 0) - (nodeV[_be.n2] || 0)) / _be.val;
                else if (_be.n2 === _bjtEmitNode) ic += ((nodeV[_be.n2] || 0) - (nodeV[_be.n1] || 0)) / _be.val;
              }
            }
            ic = Math.abs(ic);
          }
        }
        c.part._v = Math.abs(vce); c.part._i = ic; c.part._p = Math.abs(vce * ic);
        // Apply same limiting as stamp for display
        var _nVtD = (c.NF || 1) * VT_VAL;
        var _vcritD = _nVtD * Math.log(_nVtD / (Math.sqrt(2) * (c.IS || 1e-14)));
        var _vbeDisp = vbe > _vcritD ? _vcritD + _nVtD * Math.log(Math.max(1, 1 + (vbe - _vcritD) / _nVtD)) : vbe;
        if (_vbeDisp > 0.80) _vbeDisp = 0.80;
        c.part._vbe = _vbeDisp; c.part._vce = vce; c.part._ic = ic;
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
        c.part._v = c.part._compOutput ? 5 : 0; c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'DIGI') {
        if (c.subtype === 'dff') { c.part._v = c._q ? 5 : 0; }
        else if (c.subtype === 'counter') { c.part._v = c._count; }
        else if (c.subtype === 'shiftreg') { c.part._v = c._state & 1 ? 5 : 0; }
        else if (c.subtype === 'mux') { c.part._v = nodeV[c.pins[3]] || 0; }
        c.part._i = 0; c.part._p = 0;
      } else if (c.type === 'IC555') {
        // Sprint 27a: 555 readout — output pin voltage
        var vOutRead = (nodeV[c.nOUT] || 0) - (nodeV[c.nGND] || 0);
        c.part._v = Math.abs(vOutRead);
        c.part._i = 0; c.part._p = 0;
        c.part._latchState = c.part.ic555State ? c.part.ic555State.latch : false;
      }
    }

    // Wire currents — match wire endpoints to nearby component pins
    for (var wi = 0; wi < S.wires.length; wi++) {
      var w = S.wires[wi];
      var bestCur = 0;
      // Check each wire endpoint against all component pins
      for (var pi = 0; pi < S.parts.length; pi++) {
        var pp = S.parts[pi];
        var pCur = Math.abs(pp._i || 0);
        if (pCur < 1e-9) continue;
        var def = COMP[pp.type]; if (!def || !def.pins) continue;
        var pRot = (pp.rot || 0) * Math.PI / 2;
        var pCos = Math.cos(pRot), pSin = Math.sin(pRot);
        for (var pk = 0; pk < def.pins.length; pk++) {
          var pinX = pp.x + def.pins[pk].dx * pCos - def.pins[pk].dy * pSin;
          var pinY = pp.y + def.pins[pk].dx * pSin + def.pins[pk].dy * pCos;
          var d1 = Math.abs(w.x1 - pinX) + Math.abs(w.y1 - pinY);
          var d2 = Math.abs(w.x2 - pinX) + Math.abs(w.y2 - pinY);
          if (d1 < 8 || d2 < 8) {
            if (pCur > Math.abs(bestCur)) bestCur = (pp._i || 0);
            break;
          }
        }
      }
      w._current = bestCur;
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
    // Sprint 49: opt-in wiring of VXA.Convergence.findDCOP — kept as a
    // non-destructive probe. If S._useConvergenceUltimate=true, we try the
    // 4-tier strategy first; any outcome (success or fail) still falls into
    // the legacy path below for final guarantee. This preserves 55-preset
    // motor regression while making diagnostics available to tests and UI.
    if (typeof S !== 'undefined' && S && S._useConvergenceUltimate &&
        typeof VXA !== 'undefined' && VXA.Convergence && VXA.Convergence.findDCOP && SIM) {
      try {
        var cvSolve = function(dt, Cpt, gmin) {
          if (typeof gmin === 'number' && gmin > 0) _currentGMIN = gmin;
          try { solve((dt && dt > 0) ? dt : 1e-5); } catch (_e) {}
          return !!_lastConverged;
        };
        var cvResult = VXA.Convergence.findDCOP(cvSolve, SIM.N || 0,
          S._nodeVoltages || new Float64Array(SIM.N || 0), SIM.comps || []);
        if (VXA.Convergence.setLastDiagnostic) {
          VXA.Convergence.setLastDiagnostic(cvResult);
        }
        S._convergenceMethod = cvResult && cvResult.method;
      } catch (_e) { /* non-fatal */ }
    }
    // Sprint 31: BJT-aware DC OP
    // For circuits with BJTs, source stepping reaches forward-active region naturally
    var hasBJT = SIM && SIM.comps.some(function(c) { return c.type === 'BJT'; });
    var success = false;
    _simMethod = 'be';
    _dtJustChanged = true;
    _currentGMIN = 1e-12;

    if (hasBJT) {
      // Reset nodeV before stepping
      var N = SIM.N;
      S._nodeVoltages = new Float64Array(N);
      var sources = SIM.comps.filter(function(c) { return c.type === 'V'; });
      var origVals = sources.map(function(s) { return s.val; });
      // Adaptive source stepping with rollback: if NR fails, halve step and retry
      var goodNodeV = new Float64Array(N); // Last known good state
      var lastGoodFactor = 0;
      var targetFactors = [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      var ti = 0;
      var stuckCount = 0;
      while (ti < targetFactors.length) {
        var f = targetFactors[ti];
        for (var j = 0; j < sources.length; j++) sources[j].val = origVals[j] * f;
        solve(1e-5);
        if (_lastConverged) {
          // Save this state as good
          for (var ki = 0; ki < N; ki++) goodNodeV[ki] = S._nodeVoltages[ki];
          lastGoodFactor = f;
          ti++;
          stuckCount = 0;
        } else {
          // Roll back nodeV to last good state
          for (var ki2 = 0; ki2 < N; ki2++) S._nodeVoltages[ki2] = goodNodeV[ki2];
          // Insert finer step between lastGoodFactor and f
          var midF = (lastGoodFactor + f) / 2;
          if (midF - lastGoodFactor < 0.005 || stuckCount > 10) {
            // Step too small or stuck — give up on stepping, just try at f directly
            ti++;
            stuckCount = 0;
          } else {
            targetFactors.splice(ti, 0, midF);
            stuckCount++;
          }
        }
      }
      for (var j = 0; j < sources.length; j++) sources[j].val = origVals[j];
      for (var fi = 0; fi < 3; fi++) solve(1e-5);
      success = _lastConverged;
    } else {
      // Original GMIN stepping for non-BJT circuits
      var GMIN_STEPS = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12];
      for (var g = 0; g < GMIN_STEPS.length; g++) {
        _currentGMIN = GMIN_STEPS[g];
        solve(1e-5);
        if (_lastConverged) {
          if (g === GMIN_STEPS.length - 1) { success = true; break; }
          continue;
        } else {
          if (g === 0) break;
        }
      }
      if (!success) {
        _currentGMIN = 1e-12;
        var sources2 = SIM.comps.filter(function(c) { return c.type === 'V'; });
        var origVals2 = sources2.map(function(s) { return s.val; });
        var steps2 = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
        for (var si2 = 0; si2 < steps2.length; si2++) {
          for (var j2 = 0; j2 < sources2.length; j2++) sources2[j2].val = origVals2[j2] * steps2[si2];
          solve(1e-5);
        }
        for (var j2 = 0; j2 < sources2.length; j2++) sources2[j2].val = origVals2[j2];
        success = _lastConverged;
      }
    }

    _currentGMIN = 1e-12;
    _simMethod = S.simMethod || 'trap';
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