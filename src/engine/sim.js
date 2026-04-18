VXA.SimV2 = (function() {
  var Sp = VXA.Sparse, St = VXA.Stamps;
  // Sprint 86: headroom for saturation-region NR. 30 was tight once Tj
  // coupling (Sprints 81/83/84) started moving the operating point
  // between outer solver calls; 60 gives NR a fighting chance before
  // the divergence-guard fires. Pure-resistive circuits still converge
  // in 1 iteration — the ceiling is hit only in hot BJT / MOS / diode
  // setups where NR legitimately needs more room.
  var NR_MAX_ITER = 60;
  var V_TOL = 1e-4;
  var GMIN_VAL = 1e-12;
  var VT_VAL = 0.026;
  // Sprint 86: oscillation detector state. When the per-iteration max
  // |ΔV| fails to shrink twice in a row we treat the NR loop as
  // oscillating and apply under-relaxation to nodeV before the next
  // iteration. Damping ramps down 1.0 → 0.5 → 0.25 on successive
  // non-convergent rounds and resets when delta starts to shrink.
  var _lastNRIter = 0;
  var _lastConverged = true;
  var _lastNodeCount = 0;
  var _lastBandwidth = 0;
  var _lastMaxDamping = 1;     // diagnostic: smallest damping used last step
  var _lastPTCActivatedAtIter = -1;  // Sprint 97 diagnostic: -1 = PTC stayed dormant
  var _simMethod = 'trap'; // 'trap' or 'be'
  var _currentGMIN = 1e-12;
  var _dtJustChanged = false;
  // Sprint 86: last successfully-solved node voltages for divergence
  // recovery. When a step diverges we roll back to this snapshot and
  // retry with dt/2 instead of zero-wiping — that wipe was the root
  // cause of the Sprint-81 runaway "collapse" artefact.
  var _lastGoodV = null;
  var _recoveryRetriesLeft = 0;

  function getNRIter() { return _lastNRIter; }
  function getConverged() { return _lastConverged; }
  function getPTCActivatedAt() { return _lastPTCActivatedAtIter; }
  function getNodeCount() { return _lastNodeCount; }
  function getBandwidth() { return _lastBandwidth; }
  function getSimMethod() { return _simMethod; }
  function setSimMethod(m) { _simMethod = m; }
  function getCurrentGMIN() { return _currentGMIN; }

  // Main solver — replaces old solveStep() internals
  // Sprint 74: adaptive substepping wrapper. Stiff circuits (fast L,
  // small C, high-Q RLC) diverge under forward-Euler companions when
  // the outer dt is larger than the circuit's smallest time constant.
  // Compute required substeps from L and C values, then call the
  // actual NR step N times with dt/N. Uniform-integer substepping
  // keeps the existing iPrev/vPrev bookkeeping intact and adds zero
  // overhead when the circuit is purely resistive.
  function _computeSubsteps(dt) {
    if (!SIM || !SIM.comps) return 1;
    var minTau = Infinity;
    for (var i = 0; i < SIM.comps.length; i++) {
      var c = SIM.comps[i];
      if (c.type === 'L' && c.val > 0) {
        // L/R: assume R ≈ 100 Ω typical; τ = L / R. With L=1 mH → τ=10 µs.
        var tauL = c.val / 100;
        if (tauL < minTau) minTau = tauL;
      } else if (c.type === 'C' && c.val > 0) {
        // RC: τ = R · C; with R ≈ 100 Ω, C=100 nF → τ=10 µs.
        var tauC = c.val * 100;
        if (tauC < minTau) minTau = tauC;
      }
    }
    if (!isFinite(minTau)) return 1;
    // Want dt_sub ≤ τ/10. Required substeps = ceil(dt / (τ/10)) = ceil(10 dt/τ).
    // Clamp at 64 substeps so a 1 ms outer step on a 1 nF cap (τ ≈ 100 ns)
    // doesn't explode compute.
    var required = Math.ceil((dt * 10) / minTau);
    if (required <= 1) return 1;
    return Math.min(64, required);
  }
  function solve(dt) {
    if (!SIM || SIM.N <= 1) return;
    var nSub = _computeSubsteps(dt);
    var subDt = nSub > 1 ? dt / nSub : dt;
    var steps = nSub > 1 ? nSub : 1;
    for (var s = 0; s < steps; s++) {
      _solveStepWithRecovery(subDt);
      if (S.sim && S.sim.error) return;
    }
  }

  // Sprint 86: divergence recovery wrapper. Runs _solveStep; if it
  // trips the divergence guard AND we have a last-known-good snapshot,
  // restores from that snapshot and retries with dt/2 up to 2 times.
  // Only if the retries also fail do we surface the divergence error
  // (and zero-clamp, matching the Sprint-71 behaviour as a last
  // resort). Purely resistive circuits never invoke recovery.
  function _solveStepWithRecovery(dt) {
    // Snapshot BEFORE the step so we always have "last good" to roll
    // back to. This costs one Float64Array copy per step.
    var snapshot = null;
    if (S._nodeVoltages) {
      snapshot = new Float64Array(S._nodeVoltages.length);
      snapshot.set(S._nodeVoltages);
    }

    // Sprint 97: snapshot BJT / MOS collector/drain currents so we can
    // detect a post-step collapse (pre-step |Ic| > 10 mA, post-step
    // |Ic| < 10 µA while the thermal sink is still hot). That's the
    // Sprint 81 failure mode: NR appears to converge in a single
    // iteration but jumps to the Ic = 0 trivial equilibrium because
    // the Jacobian flips condition. The only reliable trigger is to
    // check for the implausible current drop AFTER the step.
    var runawayPrev = null;
    if (SIM && SIM.comps) {
      runawayPrev = [];
      for (var _rpj = 0; _rpj < SIM.comps.length; _rpj++) {
        var _rpck = SIM.comps[_rpj];
        if (_rpck.type === 'BJT' || _rpck.type === 'MOS') {
          runawayPrev.push({
            comp: _rpck,
            iPrev: Math.abs((_rpck.part && _rpck.part._i) || 0),
            TjPrev: (_rpck.part && _rpck.part._thermal && _rpck.part._thermal.T) || 25
          });
        }
      }
    }

    _solveStep(dt);

    // Collapse detection: if any runaway-prone device was passing
    // double-digit milliamps and is now effectively off despite the
    // junction still hot, reject the step. The retry loop below
    // halves dt and enables PTC from iteration 0 to steer Newton
    // back onto the physical runaway branch.
    function _ptcCollapseDetected() {
      if (!runawayPrev) return false;
      for (var _rpk = 0; _rpk < runawayPrev.length; _rpk++) {
        var _prev = runawayPrev[_rpk];
        var _iNow = Math.abs((_prev.comp.part && _prev.comp.part._i) || 0);
        if (_prev.iPrev > 10e-3 && _iNow < 10e-6 && _prev.TjPrev > 40) {
          return true;
        }
      }
      return false;
    }
    // Sprint 97: collapse detection runs regardless of whether the
    // existing divergence guard already set sim.error, because a
    // "clean" post-step where NR reports converged in a single
    // iteration can still hide a non-physical Ic = 0 collapse. The
    // retry loop below uses _ptcCollapseFlag to decide whether to
    // force PTC on the replay. Diagnostic telemetry is opt-in — set
    // `window.__ptcDebugEnabled = true` before running a sim to
    // start filling window.__ptcDebug with per-step records.
    var _ptcDbg = (typeof window !== 'undefined' && window.__ptcDebugEnabled);
    if (_ptcDbg) {
      window.__ptcDebug = window.__ptcDebug || [];
      window.__ptcDebug.push({ event: 'post-step', t: S && S.sim ? S.sim.t : 0,
        dt: dt, hasErr: !!(S && S.sim && S.sim.error),
        hasSnap: !!snapshot, collapse: _ptcCollapseDetected(),
        prev: runawayPrev ? runawayPrev.map(function(p) {
          return { iPrev: p.iPrev, iNow: Math.abs((p.comp.part && p.comp.part._i) || 0), TjPrev: p.TjPrev };
        }) : [] });
    }
    var _ptcCollapseFlag = false;
    if (_ptcCollapseDetected() && snapshot) {
      _ptcCollapseFlag = true;
      if (S.sim) S.sim.error = 'ptc-collapse';
      if (_ptcDbg) {
        window.__ptcDebug.push({ event: 'detect', t: S.sim.t, dt: dt });
      }
    }

    // If the guard fired, S.sim.error is set. Retry with a smaller
    // step from the snapshot, arming PTC when the cause was a
    // thermal-runaway collapse.
    var retryLeft = 3;
    while (S.sim && S.sim.error && snapshot && retryLeft > 0) {
      S.sim.error = '';                      // clear so next attempt can run
      S._nodeVoltages = snapshot;
      // Also roll back any iPrev / vPrev state the previous step
      // already wrote. We can't restore component-level history
      // perfectly (too many fields), but the snapshot of nodeV is
      // enough for the dominant transient channels.
      dt = dt / 2;
      retryLeft--;
      _solveStep(dt, _ptcCollapseFlag /* force PTC on collapse retry */);
      if (_ptcCollapseFlag) {
        var _stillCollapsed = _ptcCollapseDetected();
        if (_ptcDbg) {
          window.__ptcDebug.push({ event: 'retry', t: S.sim.t, dt: dt, stillCollapsed: _stillCollapsed, retryLeft: retryLeft });
        }
        if (!_stillCollapsed) break;
        if (retryLeft > 0 && S.sim) S.sim.error = 'ptc-collapse';
      }
    }
    // If still failing after retries, the guard's zero-clamp runs
    // (already done inside _solveStep) and S.sim.error stays set.
    if (!(S.sim && S.sim.error) && S._nodeVoltages) {
      // Step succeeded — update last-good reference for the next
      // round.
      if (!_lastGoodV || _lastGoodV.length !== S._nodeVoltages.length) {
        _lastGoodV = new Float64Array(S._nodeVoltages.length);
      }
      _lastGoodV.set(S._nodeVoltages);
    }
  }
  function _solveStep(dt, ptcForced) {
    if (!SIM || SIM.N <= 1) return;
    var N = SIM.N, nv = SIM.vSrc.length;

    // Sprint 92: pre-pass indexing for branch-variable MNA stamps.
    // Every V source claims a row at (N-1 + _vsIdx). Every CCVS claims
    // its own row at (N-1 + nv + _ccvsBranchOfs) because its output is a
    // voltage constraint that needs an auxiliary equation. CCCS does not
    // get its own branch row (its output is a current, injected via the
    // sense V source's branch variable). Done once per _solveStep and
    // reused across every Newton-Raphson iteration — _vsIdx can't change
    // between iterations on a fixed netlist.
    var _vsCount = 0, _ccvsCount = 0;
    for (var _pi = 0; _pi < SIM.comps.length; _pi++) {
      var _pc = SIM.comps[_pi];
      if (_pc.type === 'V') { _pc._vsIdx = _vsCount++; }
    }
    for (var _pi2 = 0; _pi2 < SIM.comps.length; _pi2++) {
      var _pc2 = SIM.comps[_pi2];
      if (_pc2.type === 'CCVS') {
        _pc2._ccvsBranch = N - 1 + _vsCount + _ccvsCount;
        _ccvsCount++;
      }
    }

    var sz = N - 1 + nv + _ccvsCount;
    _lastNodeCount = sz;

    var nodeV = S._nodeVoltages || new Float64Array(N);
    var converged = false;
    var iter = 0;
    // Sprint 86: global under-relaxation state. Starts at 1.0 (full
    // Newton step), drops when successive iterations fail to reduce
    // maxDelta. Resets toward 1.0 as the residual falls.
    var _damping = 1.0;
    var _prevMaxDelta = Infinity;
    var _stallCount = 0;
    _lastMaxDamping = 1.0;

    // Sprint 97 — pseudo-transient continuation (PTC) for thermal-
    // runaway circuits. The Sprint 81 BJT runaway collapse at
    // t ≈ 0.1 s is the classic NR failure mode: the Jacobian is ill-
    // conditioned once positive thermal feedback pushes Ic past the
    // stable branch, and pure NR lands on the trivial Ic = 0 equi-
    // librium instead of the physical runaway trajectory. PTC augments
    // the linear solve with a diagonal 1/τ pullback toward the current
    // iterate, bounded step size without changing the fixed point:
    //
    //   (J + I/τ) · x_new = rhs + x/τ
    //
    // At convergence x_new = x so the 1/τ term cancels — the physical
    // operating point is preserved. When NR wants a too-large step
    // (collapse to Ic = 0 from Ic = 100 mA in one iteration) the
    // pullback keeps x_new close to x, giving the thermally-coupled
    // solver a chance to find the non-trivial equilibrium.
    //
    // Gated: stays off for the first PTC_KICK_IN iterations so
    // well-conditioned circuits pay no overhead. τ adapts per SER
    // (Switched Evolution Relaxation) — shrink on stall, grow on
    // progress. Never grows past a cap so PTC stays in control
    // even after a few successful iterations.
    // PTC is restricted to runaway-prone topologies — Sprint 81-class
    // thermal coupling only matters when there's a BJT, MOSFET or
    // diode in the netlist to drive positive feedback. Pure resistive
    // / RLC circuits stay on classic one-shot NR so harness runtime
    // doesn't regress.
    var _hasRunawayProne = false;
    for (var _rpi = 0; _rpi < SIM.comps.length; _rpi++) {
      var _rpc = SIM.comps[_rpi].type;
      if (_rpc === 'BJT' || _rpc === 'MOS' || _rpc === 'D') {
        _hasRunawayProne = true;
        break;
      }
    }
    var _usePTC = !!ptcForced && _hasRunawayProne;
    // Sprint 97 tune: on forced-PTC retries, τ starts 100× smaller
    // than the real-time step so the diagonal 1/τ dominates even the
    // Gummel-Poon transconductance (which hits ~10 S per milliamp at
    // high temperature). SER can grow it back toward dt as iterations
    // succeed.
    var _ptcTau = _usePTC ? Math.max(dt * 0.01, 1e-9) : Infinity;
    var _ptcTau0 = Math.max(dt * 0.01, 1e-9);
    var _ptcResPrev = Infinity;
    var _ptcActivatedAtIter = _usePTC ? 0 : -1;
    var PTC_KICK_IN = 5;
    if (_usePTC && typeof window !== 'undefined' && window.__ptcDebugEnabled) {
      window.__ptcDebug = window.__ptcDebug || [];
      window.__ptcDebug.push({ event: 'ptc-start', dt: dt, tau: _ptcTau });
    }

    // N-R loop
    while (!converged && iter < NR_MAX_ITER) {
      var matrix = Sp.create(sz);
      var rhs = new Float64Array(sz);

      // GMIN on every node
      for (var gi = 0; gi < N - 1; gi++) {
        Sp.stamp(matrix, gi, gi, _currentGMIN);
      }

      // Sprint 97: PTC diagonal pullback. Only after 5 iterations of
      // classic NR have failed to converge. Applied ONLY to node rows
      // (0 … N-2) — branch-variable rows (V source, CCVS) are linear
      // and don't need pseudo-time damping.
      if (_usePTC) {
        var _ptcG = 1.0 / _ptcTau;
        for (var _pj = 0; _pj < N - 1; _pj++) {
          Sp.stamp(matrix, _pj, _pj, _ptcG);
          rhs[_pj] += (nodeV[_pj + 1] || 0) * _ptcG;
        }
      }

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
          // Sprint 82: inductor core saturation. When the part carries an
          // Isat attribute (from SPICE `Isat=…` or a UI input), drop the
          // effective inductance as current climbs past the knee:
          //   L_eff(I) = L_nom / (1 + |I/Isat|^n)
          // With n≈4 this matches the soft-shoulder datasheet curves of
          // typical drum/toroid cores. A hard floor at L_nom × 1e-3 stops
          // geq from diverging when the core is driven deep into the
          // saturated region (L_eff → 0 would give an infinite Norton
          // conductance).
          var _L_eff = c.val;
          var _Isat = (c.part && isFinite(c.part.Isat) && c.part.Isat > 0)
                        ? c.part.Isat : 0;
          if (_Isat > 0) {
            // Sprint 88: Curie-derating. Real ferrite loses Isat as T
            // approaches the Curie point:
            //   Isat(T) = Isat0 · (1 − (T / T_curie)^β)   with β ≈ 2.
            // Temperature comes from Sprint 70f's part._thermal.T (°C).
            // Floor at 5 % of nominal so the saturation model stays
            // well-defined past T_curie (a collapsed-core device is
            // still a device, not a divide-by-zero). At 25 °C and the
            // default T_curie = 220 °C the derate factor is 0.987 —
            // Sprint 82 ambient behaviour is preserved within 1 %.
            var _Tc_part = 25;
            if (c.part && c.part._thermal && isFinite(c.part._thermal.T)) {
              _Tc_part = c.part._thermal.T;
            }
            var _TCurie = (c.part && isFinite(c.part.T_curie) && c.part.T_curie > 50)
                            ? c.part.T_curie : 220;
            var _curieB = (c.part && isFinite(c.part.curie_exp) && c.part.curie_exp >= 1)
                            ? c.part.curie_exp : 2;
            var _Trat = Math.max(0, _Tc_part) / _TCurie;
            var _derate = 1 - Math.pow(_Trat, _curieB);
            if (_derate < 0.05) _derate = 0.05;
            if (_derate > 1.0) _derate = 1.0;
            var _IsatT = _Isat * _derate;

            var _satN = (c.part && isFinite(c.part.satExp) && c.part.satExp >= 2)
                          ? c.part.satExp : 4;
            var _ratio = Math.abs(c.iPrev || 0) / _IsatT;
            _L_eff = c.val / (1 + Math.pow(_ratio, _satN));
            var _Lmin = c.val * 1e-3;
            if (_L_eff < _Lmin) _L_eff = _Lmin;
            if (c.part) {
              c.part._saturated = _ratio > 0.7;
              c.part._IsatEff = _IsatT;
            }
          } else if (c.part) {
            c.part._saturated = false;
          }

          if (_simMethod === 'trap' && !_dtJustChanged) {
            St.inductorTRAP(matrix, rhs, c.n1, c.n2, _L_eff, dt, c.iPrev, c.vPrev || 0);
          } else {
            // Sprint 77: BE inductor Norton companion. Sign convention must
            // match stamps.js currentSource/diode: for historic current I
            // flowing n1→n2, inject (-I, +I) at (n1, n2). The old
            // (+iPrev, -iPrev) placement was the wrong sign and caused the
            // Norton source to pump energy INTO the inductor every step,
            // yielding exponential growth (RL τ=1µs blew up within 12 µs).
            var req = _L_eff / dt;
            var geq = 1 / (req + _currentGMIN);
            St.stampG(matrix, c.n1, c.n2, geq);
            St.stampI(rhs, c.n1, -c.iPrev);
            St.stampI(rhs, c.n2, c.iPrev);
          }
        } else if (c.type === 'I') {
          var current = c.val;
          if (c.isAC) current = c.val * Math.sin(2 * Math.PI * c.freq * S.sim.t);
          St.currentSource(rhs, c.n1, c.n2, current);
        } else if (c.type === 'V') {
          // Sprint 92: branch row now lives in _vsIdx (set by the
          // _solveStep pre-pass). CCVS/CCCS reference this directly.
          var row = N - 1 + c._vsIdx;
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
        } else if (c.type === 'D') {
          var vd = (nodeV[c.n1] || 0) - (nodeV[c.n2] || 0);
          var dModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          // Sprint 84: feed junction temperature into the stamp. LEDs
          // are intentionally NOT coupled — their V_F(T) obeys
          // material-specific laws that the silicon bandgap model
          // can't fake; deferred to a future LED-thermal sprint.
          var _dTjK = 300;
          if (c.part && c.part.type !== 'led'
              && c.part._thermal && isFinite(c.part._thermal.T)) {
            _dTjK = c.part._thermal.T + 273.15;
          }
          // Sprint 24: LEDs use basic stamp with model IS/N for better convergence
          // diode_spice RS handling causes convergence issues with high-N LED models
          if (dModel && c.part && c.part.type !== 'led' && (dModel.RS > 0 || dModel.CJO > 0 || dModel.BV)) {
            // Shallow-clone so VXA.Models entries stay pristine.
            var _dParams = dModel;
            if (dModel.TjK !== _dTjK) {
              _dParams = {};
              for (var _dk in dModel) _dParams[_dk] = dModel[_dk];
              _dParams.TjK = _dTjK;
            }
            St.diode_spice(matrix, rhs, c.n1, c.n2, _dParams, vd, dt);
          } else {
            var dIS = dModel ? (dModel.IS || DIODE_IS) : (c.IS || DIODE_IS);
            var dN = dModel ? (dModel.N || DIODE_N) : (c.N || DIODE_N);
            var dEg = dModel && isFinite(dModel.Eg) ? dModel.Eg : 1.12;
            // LEDs: pass TjK = 300 → stamp's internal branch becomes a
            // no-op and we retain the Sprint 25 isothermal behaviour.
            var dTjPass = (c.part && c.part.type === 'led') ? 300 : _dTjK;
            St.diode(matrix, rhs, c.n1, c.n2, dIS, dN, vd, VT_VAL, dTjPass, dEg);
          }
        } else if (c.type === 'BJT') {
          // Always use Gummel-Poon when model available (more accurate convergence)
          var bjtModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
          if (!bjtModel) bjtModel = { IS: c.IS, BF: c.BF, NF: c.NF, VAF: c.VAF, BR: 1, NR: 1, IKF: 1000 };
          // Sprint 81: feed the junction temperature in so the Vt / IS(T)
          // terms in the stamp can close the thermal-runaway feedback.
          // thermal.T is in °C; convert to Kelvin. Clone params to avoid
          // mutating a shared model entry in VXA.Models.
          var bjtTjK = 300;
          if (c.part && c.part._thermal && isFinite(c.part._thermal.T)) {
            bjtTjK = c.part._thermal.T + 273.15;
          }
          var bjtParams = bjtModel;
          if (bjtModel.TjK !== bjtTjK) {
            bjtParams = {};
            for (var _bk in bjtModel) bjtParams[_bk] = bjtModel[_bk];
            bjtParams.TjK = bjtTjK;
          }
          St.bjt_gp(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, bjtParams, nodeV, dt);
        } else if (c.type === 'MOS') {
          // Sprint 83: compute junction temperature once, pass to whichever
          // path handles this device. thermal.T is in °C → Kelvin. For
          // BSIM3 devices TNOM stays dominant (static-bias model); only
          // Level-1 paths use TjK for live coupling, matching the BJT
          // (Sprint 81) pattern.
          var _mosTjK = 300;
          if (c.part && c.part._thermal && isFinite(c.part._thermal.T)) {
            _mosTjK = c.part._thermal.T + 273.15;
          }
          // Sprint 41: BSIM3 takes precedence when model is marked BSIM3-class.
          if (c.isBSIM3 && c.bsim3 && VXA.BSIM3) {
            try {
              // BSIM3.stamp signature: (matrix, rhs, nD, nG, nS, nB, params, nodeV, Sp)
              // Our MOS pin mapping is n1=D, n2=G, n3=S; bulk defaults to 0 (ground).
              VXA.BSIM3.stamp(matrix, rhs, c.n1, c.n2, c.n3, 0, c.bsim3, nodeV, Sp);
            } catch (e) {
              // Fallback to Level 1 if BSIM3 stamp throws (safety net)
              St.mosfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.VTO || 2, c.KP || 110e-6, c.LAMBDA || 0.04, nodeV, _mosTjK);
            }
          } else {
            var mosModel = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
            if (mosModel && (mosModel.CGS > 0 || mosModel.CBD > 0)) {
              // Shallow-clone the model so we don't mutate a shared
              // VXA.Models entry (identical strategy to the BJT branch).
              var _mosParams = mosModel;
              if (mosModel.TjK !== _mosTjK) {
                _mosParams = {};
                for (var _mk in mosModel) _mosParams[_mk] = mosModel[_mk];
                _mosParams.TjK = _mosTjK;
              }
              St.nmos_spice(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, _mosParams, nodeV, dt);
            } else {
              St.mosfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.VTO, c.KP, c.LAMBDA, nodeV, _mosTjK);
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
          St.jfet(matrix, rhs, c.n1, c.n2, c.n3, c.polarity, c.Idss, c.Vp, c.LAMBDA || 0, nodeV);
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
          // Sprint 92: real branch-variable MNA for SPICE H element.
          // CCVS output is itself a voltage source, so it needs its own
          // branch row (claimed in the pre-pass via c._ccvsBranch). The
          // constraint is V(noP) − V(noN) − rm·I(sense) = 0, where the
          // sense current is read from the linked V source's branch var.
          // When no V source spans the sense pins we fall back to the
          // pre-Sprint-92 parasitic approximation.
          var rm = c.rm || 1000;
          if (c._senseV && typeof c._senseV._vsIdx === 'number') {
            var senseRow = N - 1 + c._senseV._vsIdx;
            var ccvsRow = c._ccvsBranch;
            if (c.noP > 0) {
              Sp.stamp(matrix, c.noP - 1, ccvsRow, 1);
              Sp.stamp(matrix, ccvsRow, c.noP - 1, 1);
            }
            if (c.noN > 0) {
              Sp.stamp(matrix, c.noN - 1, ccvsRow, -1);
              Sp.stamp(matrix, ccvsRow, c.noN - 1, -1);
            }
            Sp.stamp(matrix, ccvsRow, senseRow, -rm);
          } else {
            var _gMeasH = 0.1, _gOutH = 0.1;
            St.stampG(matrix, c.ncP, c.ncN, _gMeasH);
            St.stampG(matrix, c.noP, c.noN, _gOutH);
            var _vCtrlH = (nodeV[c.ncP] || 0) - (nodeV[c.ncN] || 0);
            var _iCtrlH = _vCtrlH * _gMeasH, _vTargetH = rm * _iCtrlH;
            St.stampI(rhs, c.noP, _gOutH * _vTargetH);
            St.stampI(rhs, c.noN, -_gOutH * _vTargetH);
          }
        } else if (c.type === 'CCCS') {
          // Sprint 92: real branch-variable MNA for SPICE F element.
          // I_out = gain · I(sense). In the code's "Σ currents leaving
          // node = 0" convention (same one used by the V source stamp
          // — Matrix[n1-1][bi] = +1 is the + terminal), the + output
          // terminal sees +gain · I_sense worth of current leaving. The
          // − output terminal sees the opposite. Fallback to the
          // pre-Sprint-92 parasitic path when no sense V is linked.
          var alpha = c.alpha || 10;
          if (c._senseV && typeof c._senseV._vsIdx === 'number') {
            var _senseRowF = N - 1 + c._senseV._vsIdx;
            if (c.noP > 0) Sp.stamp(matrix, c.noP - 1, _senseRowF, alpha);
            if (c.noN > 0) Sp.stamp(matrix, c.noN - 1, _senseRowF, -alpha);
          } else {
            var _gMeasF = 0.1;
            St.stampG(matrix, c.ncP, c.ncN, _gMeasF);
            var _vCtrlF = (nodeV[c.ncP] || 0) - (nodeV[c.ncN] || 0);
            var _iOutF = alpha * _vCtrlF * _gMeasF;
            St.stampI(rhs, c.noP, -_iOutF);
            St.stampI(rhs, c.noN, _iOutF);
          }
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

      // Sprint 86: global delta tracking + adaptive under-relaxation.
      // Measure the largest voltage step the Newton update wants us to
      // take. If it fails to shrink versus the previous iteration we
      // damp the update; if it keeps falling we relax the damping back
      // toward 1.0 so we don't pay a perpetual speed penalty.
      var _maxDelta = 0;
      for (var _di = 1; _di < N; _di++) {
        var _d = Math.abs(newV[_di] - (nodeV[_di] || 0));
        if (_d > _maxDelta) _maxDelta = _d;
      }
      if (_maxDelta > _prevMaxDelta * 0.9 && iter > 1) {
        // Not making progress; stall detected.
        _stallCount++;
        if (_stallCount >= 2) _damping = Math.max(0.1, _damping * 0.5);
      } else if (_maxDelta < _prevMaxDelta * 0.5) {
        // Good progress; let damping relax.
        _damping = Math.min(1.0, _damping * 1.25);
        _stallCount = 0;
      }
      _prevMaxDelta = _maxDelta;
      if (_damping < _lastMaxDamping) _lastMaxDamping = _damping;

      // Apply damped update (α = 1 is identical to the pre-Sprint-86
      // direct assignment, so pure-resistive circuits see no change).
      if (_damping >= 0.999) {
        nodeV = newV;
      } else {
        var blended = new Float64Array(N);
        blended[0] = 0;
        for (var _bi = 1; _bi < N; _bi++) {
          var _old = nodeV[_bi] || 0;
          blended[_bi] = _old + _damping * (newV[_bi] - _old);
        }
        nodeV = blended;
      }
      S._nodeVoltages = nodeV;

      // Sprint 97: when PTC is forced on for collapse recovery, the
      // first iteration's small delta is usually the pullback pinning
      // x_new ≈ x_snap — not a real convergence. Require at least 3
      // PTC iterations so τ can grow (SER) and the solver gets a
      // chance to evolve out of the previous state into the correct
      // runaway branch. Classic NR path (unforced) is unchanged.
      var _allowExit = true;
      if (_usePTC && ptcForced && iter < 2) _allowExit = false;

      // If no nonlinear components, one iteration is enough
      if (SIM.comps.every(function(c) { return c.type !== 'D' && c.type !== 'BJT' && c.type !== 'MOS' && c.type !== 'Z' && c.type !== 'JFET'; }) || (converged && _allowExit)) break;

      // Sprint 97: PTC activation + SER τ adaptation.
      // Kick in after PTC_KICK_IN iterations of classic NR couldn't
      // converge. From then on, use _maxDelta as the residual proxy:
      // shrinking → grow τ (approach classic NR), growing → shrink τ
      // (more aggressive pullback). Bounded in [1e-10, 1e3] so the
      // diagonal boost never goes off the edge in either direction.
      if (!_usePTC && _hasRunawayProne && iter + 1 >= PTC_KICK_IN) {
        _usePTC = true;
        _ptcTau = _ptcTau0;
        _ptcResPrev = _maxDelta;
        _ptcActivatedAtIter = iter + 1;
      } else if (_usePTC) {
        if (_maxDelta < _ptcResPrev * 0.7) {
          _ptcTau = Math.min(_ptcTau * 1.5, 1e3);
        } else if (_maxDelta > _ptcResPrev * 1.1) {
          _ptcTau = Math.max(_ptcTau * 0.5, 1e-10);
        }
        _ptcResPrev = _maxDelta;
      }

      iter++;
    }
    _lastPTCActivatedAtIter = _ptcActivatedAtIter;

    _lastNRIter = iter + 1;
    _lastConverged = converged;

    // Sprint 71: surface divergence to the UI/harness. Node voltages
    // above 1 MV or non-finite indicate the time step is too large for
    // the switching rate (boost-converter class) or an uncontrolled
    // positive-feedback loop. Without this guard the bad nodeV
    // cascades into part._i/_v/_p and colour/inspector display garbage.
    var _divIdx = -1, _divVal = 0;
    for (var _nvi = 0; _nvi < nodeV.length; _nvi++) {
      var _v = nodeV[_nvi];
      if (!isFinite(_v) || Math.abs(_v) > 1e6) { _divIdx = _nvi; _divVal = _v; break; }
    }
    if (_divIdx >= 0) {
      S.sim.error = 'Simülasyon ıraksadı: node ' + _divIdx + ' = ' +
                     (isFinite(_divVal) ? _divVal.toExponential(2) : String(_divVal)) +
                     ' (dt çok büyük veya devre kararsız)';
      // Clamp so downstream readouts stay finite instead of amplifying.
      for (var _nvj = 0; _nvj < nodeV.length; _nvj++) {
        if (!isFinite(nodeV[_nvj]) || Math.abs(nodeV[_nvj]) > 1e6) nodeV[_nvj] = 0;
      }
      S._nodeVoltages = nodeV;
      return;
    }

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
        // Sprint 82: use the SAME L_eff that was stamped this step,
        // otherwise the iPrev integrator drifts away from what the
        // solver actually saw. When no saturation is configured the
        // formula collapses to L_eff = L_nom (unchanged from Sprint 77).
        var _L_update = c.val;
        var _Isat_u = (c.part && isFinite(c.part.Isat) && c.part.Isat > 0)
                        ? c.part.Isat : 0;
        if (_Isat_u > 0) {
          // Sprint 88: same Curie derating as the stamp-time branch so
          // the post-solve integrator sees the same L_eff the matrix
          // was built against (otherwise iPrev drifts on hot cores).
          var _Tcu = 25;
          if (c.part && c.part._thermal && isFinite(c.part._thermal.T)) {
            _Tcu = c.part._thermal.T;
          }
          var _TCu = (c.part && isFinite(c.part.T_curie) && c.part.T_curie > 50)
                       ? c.part.T_curie : 220;
          var _cEu = (c.part && isFinite(c.part.curie_exp) && c.part.curie_exp >= 1)
                       ? c.part.curie_exp : 2;
          var _der_u = 1 - Math.pow(Math.max(0, _Tcu) / _TCu, _cEu);
          if (_der_u < 0.05) _der_u = 0.05;
          if (_der_u > 1.0)  _der_u = 1.0;
          var _IsatU_T = _Isat_u * _der_u;
          var _nU = (c.part && isFinite(c.part.satExp) && c.part.satExp >= 2)
                      ? c.part.satExp : 4;
          var _rU = Math.abs(c.iPrev || 0) / _IsatU_T;
          _L_update = c.val / (1 + Math.pow(_rU, _nU));
          var _LminU = c.val * 1e-3;
          if (_L_update < _LminU) _L_update = _LminU;
        }
        var cur = c.iPrev + (dt / _L_update) * vd;
        c.iPrev = cur;
        c.vPrev = vd;
        // Sprint 87: simplified hysteresis / core-loss channel. A
        // proper B-H loop needs N·A·H geometry that the lumped
        // inductor doesn't carry, so we reinterpret Hc as the
        // coercive-current equivalent (A) and pay out energy at
        //   P_core ≈ Hc · |di/dt| · L     (linear in f — hysteresis)
        // Sprint 89: eddy-current companion — energy dissipated by
        // induced currents in the core, derived in the lumped model as
        //   P_eddy ≈ Ke · (di/dt)² · L    (quadratic in f)
        // Both loops compute di/dt the same way; both feed part._p so
        // VXA.Thermal picks them up as dissipation. Absent Hc and Ke
        // the inductor is bit-identical to Sprint 82/86.
        var _Hc_l = (c.part && isFinite(c.part.Hc) && c.part.Hc > 0) ? c.part.Hc : 0;
        var _Ke_l = (c.part && isFinite(c.part.Ke) && c.part.Ke > 0) ? c.part.Ke : 0;
        var _core_loss = 0;
        var _eddy_loss = 0;
        if ((_Hc_l > 0 || _Ke_l > 0) && dt > 0) {
          var _iOld = (c.part && isFinite(c.part._iHystPrev)) ? c.part._iHystPrev : 0;
          var _dIdt_signed = (cur - _iOld) / dt;
          var _absDIdt = Math.abs(_dIdt_signed);
          if (_Hc_l > 0) _core_loss = _Hc_l * _absDIdt * c.val;
          if (_Ke_l > 0) _eddy_loss = _Ke_l * _dIdt_signed * _dIdt_signed * c.val;
          c.part._iHystPrev = cur;
          c.part._core_loss_W = _core_loss;
          c.part._eddy_loss_W = _eddy_loss;
        }
        c.part._v = Math.abs(vd);
        c.part._i = Math.abs(cur);
        c.part._p = Math.abs(vd * cur) + _core_loss + _eddy_loss;
        c.part._L_eff = _L_update;
      } else if (c.type === 'V') {
        // Sprint 69 FIX: Proper KCL — sum ALL branch currents leaving node n1
        // (through every adjacent branch: R, C, L, D, BJT coll/emit, MOSFET drain/source).
        // Then V source current = net current OUT of its positive node.
        // Sprint 70d: keep the sign. Convention: V+ pin is c.n1, so
        // _vI > 0 ⇒ current leaves V+ into the external circuit =
        // source is DELIVERING. _vI < 0 ⇒ current is forced INTO V+ =
        // source is SINKING (anomalous for an ideal DC source;
        // meaningful for batteries in charge mode or regen loads).
        var _vnode = c.n1;
        var _vI = 0;
        for (var _vk = 0; _vk < SIM.comps.length; _vk++) {
          var _vc = SIM.comps[_vk];
          if (_vc === c || _vc.type === 'V') continue;
          if (_vc.type === 'R') {
            if (_vc.n1 === _vnode) _vI += ((nodeV[_vc.n1] || 0) - (nodeV[_vc.n2] || 0)) / _vc.val;
            else if (_vc.n2 === _vnode) _vI += ((nodeV[_vc.n2] || 0) - (nodeV[_vc.n1] || 0)) / _vc.val;
          } else if (_vc.type === 'L') {
            if (_vc.n1 === _vnode) _vI += _vc.iPrev || 0;
            else if (_vc.n2 === _vnode) _vI -= _vc.iPrev || 0;
          } else if (_vc.type === 'C') {
            var _cCur = _vc.iPrev || 0;
            if (_vc.n1 === _vnode) _vI += _cCur;
            else if (_vc.n2 === _vnode) _vI -= _cCur;
          } else if (_vc.type === 'I') {
            if (_vc.n1 === _vnode) _vI += _vc.val;
            else if (_vc.n2 === _vnode) _vI -= _vc.val;
          } else if (_vc.type === 'D' || _vc.type === 'Z') {
            var _diI = _vc.part && _vc.part._i ? _vc.part._i : 0;
            if (_vc.n1 === _vnode) _vI += _diI;
            else if (_vc.n2 === _vnode) _vI -= _diI;
          } else if (_vc.type === 'BJT' || _vc.type === 'MOS') {
            // Approximate: when V+ sits on the collector/drain we add the
            // device's magnitude current; on the emitter/source we subtract
            // (current leaves the device back through the emitter/source).
            var _actI = Math.abs(_vc.part && _vc.part._i ? _vc.part._i : 0);
            if (_vc.n2 === _vnode) _vI += _actI;
            else if (_vc.n3 === _vnode) _vI -= _actI;
          }
        }
        c.part._v = vd;          // SIGNED: V(V+) - V(V-)
        c.part._i = _vI;         // SIGNED: +ve = delivering, -ve = sinking
        c.part._p = vd * _vI;    // SIGNED: +ve = sourcing power into circuit
      } else if (c.type === 'D') {
        // Sprint 69 FIX: Primary readout via Shockley equation (physically correct),
        // then compare with KCL from anode — if KCL gives finite non-zero, prefer it
        // (more robust for multi-resistor parallel LED configurations).
        // Sprint 84: apply the same Tj-coupled IS/VT the stamp used above
        // so this fallback stays consistent with the electrical solve.
        var dMdl2 = c.part && c.part.model ? VXA.Models.getModel(c.part.type, c.part.model) : null;
        var dIS2 = dMdl2 ? (dMdl2.IS || DIODE_IS) : (c.IS || DIODE_IS);
        var dN2 = dMdl2 ? (dMdl2.N || DIODE_N) : (c.N || DIODE_N);
        var _vtRead = VT_VAL;
        if (c.part && c.part.type !== 'led'
            && c.part._thermal && isFinite(c.part._thermal.T)) {
          var _TjR = c.part._thermal.T + 273.15;
          if (_TjR < 150) _TjR = 150; else if (_TjR > 500) _TjR = 500;
          _vtRead = 8.617333e-5 * _TjR;
          var _egR = (dMdl2 && isFinite(dMdl2.Eg)) ? dMdl2.Eg : 1.12;
          var _xpR = _egR / 8.617333e-5 * (1 / 300 - 1 / _TjR);
          if (_xpR > 80) _xpR = 80;
          dIS2 = dIS2 * Math.pow(_TjR / 300, 3) * Math.exp(_xpR);
        }
        var eArg = Math.min(vd / (dN2 * _vtRead), 500);
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
        // Sprint 72: history tracking is now unified in a single loop
        // at the end of the solve pass — handles diode / LED / zener
        // along with every other AC-capable component type.
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
        // Sprint 93: readout mirrors the stamp's LAMBDA-aware saturation
        // formula — without this the UI would report the pre-Sprint-93
        // (1+λ·vds) = 1 current even though the solver is now using
        // the modulated value.
        var pol = c.polarity, vgs = pol * ((nodeV[c.n1] || 0) - (nodeV[c.n3] || 0)), vds = pol * ((nodeV[c.n2] || 0) - (nodeV[c.n3] || 0));
        var _jfetLam = c.LAMBDA || 0;
        var _normVgs = Math.max(0, 1 - vgs / c.Vp);
        var id = c.Idss * _normVgs * _normVgs * (1 + _jfetLam * Math.abs(vds));
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

    // Sprint 72: per-component sample history for RMS readouts. Sprint
    // 70h already tracked diode/LED/zener current so the Inspector could
    // average over a rectifier's off-phase. Extend to every part that
    // can carry AC (passives, sources, active devices), and store
    // voltage alongside current so RMS also works on the V card.
    // Ring-buffered to 2000 samples (matches Sprint 70h cap).
    var _TRACKED_TYPES = { resistor:1, capacitor:1, inductor:1,
      diode:1, led:1, zener:1,
      vdc:1, vac:1, pulse:1, pwl:1, idc:1, iac:1, noise:1,
      npn:1, pnp:1, nmos:1, pmos:1, njfet:1, pjfet:1, opamp:1 };
    for (var _hi = 0; _hi < S.parts.length; _hi++) {
      var _hp = S.parts[_hi];
      if (!_TRACKED_TYPES[_hp.type]) continue;
      if (!_hp._vHistory) _hp._vHistory = [];
      if (!_hp._iHistory) _hp._iHistory = [];
      _hp._vHistory.push(_hp._v || 0);
      _hp._iHistory.push(_hp._i || 0);
      if (_hp._vHistory.length > 2000) _hp._vHistory.shift();
      if (_hp._iHistory.length > 2000) _hp._iHistory.shift();
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

    // Sprint 70a-fix-5: propagate wire currents through T-junctions.
    // After Sprint 70a the router emits GND buses and trunks as MULTIPLE
    // short segments whose interior endpoints touch only other wires
    // (not component pins). The electrical solver already unions these
    // correctly (src/engine/sim-legacy.js getNode does 25-px snap), but
    // the rendering layer's w._current assignment above only fires when
    // an endpoint is within 8 px of a component pin — so those interior
    // segments render idle while the rest of the net animates. A fixed-
    // point propagation over 8 passes fills them in via shared endpoints
    // and colinear T-junctions. O(passes × wires²) but wires are small.
    function _segTouchesPoint(w, px, py) {
      if (Math.abs(w.x1 - px) <= 1 && Math.abs(w.y1 - py) <= 1) return true;
      if (Math.abs(w.x2 - px) <= 1 && Math.abs(w.y2 - py) <= 1) return true;
      if (w.x1 === w.x2 && px === w.x1) {
        var miY = Math.min(w.y1, w.y2), maY = Math.max(w.y1, w.y2);
        if (py > miY + 1 && py < maY - 1) return true;
      } else if (w.y1 === w.y2 && py === w.y1) {
        var miX = Math.min(w.x1, w.x2), maX = Math.max(w.x1, w.x2);
        if (px > miX + 1 && px < maX - 1) return true;
      }
      return false;
    }
    for (var _pass = 0; _pass < 8; _pass++) {
      var _changed = false;
      for (var _wi = 0; _wi < S.wires.length; _wi++) {
        var _w = S.wires[_wi];
        if (Math.abs(_w._current || 0) > 1e-9) continue;
        for (var _wj = 0; _wj < S.wires.length; _wj++) {
          if (_wi === _wj) continue;
          var _w2 = S.wires[_wj];
          if (Math.abs(_w2._current || 0) < 1e-9) continue;
          if (_segTouchesPoint(_w2, _w.x1, _w.y1)
           || _segTouchesPoint(_w2, _w.x2, _w.y2)
           || _segTouchesPoint(_w, _w2.x1, _w2.y1)
           || _segTouchesPoint(_w, _w2.x2, _w2.y2)) {
            _w._current = _w2._current;
            _changed = true;
            break;
          }
        }
      }
      if (!_changed) break;
    }

    // Sprint 70c: Ground pin-current readout. The solver doesn't model
    // ground as a dissipative component — it is a node-0 reference — so
    // part._i stays 0 for ground symbols even when real current is
    // returning through them. Populate it here by summing |current|
    // over wires touching the ground pin, so the Inspector can display
    // the physically-meaningful KCL current. V and P remain 0 by
    // definition (reference potential, ideal conductor).
    for (var _gi = 0; _gi < S.parts.length; _gi++) {
      var _gp = S.parts[_gi];
      if (_gp.type !== 'ground') continue;
      var _gr = (_gp.rot || 0) * Math.PI / 2;
      var _gco = Math.cos(_gr), _gsi = Math.sin(_gr);
      var _pX = _gp.x + 0 * _gco - (-20) * _gsi;
      var _pY = _gp.y + 0 * _gsi + (-20) * _gco;
      var _gMaxCur = 0;
      for (var _gwi = 0; _gwi < S.wires.length; _gwi++) {
        var _gww = S.wires[_gwi];
        if (_segTouchesPoint(_gww, _pX, _pY)) {
          var _gc = Math.abs(_gww._current || 0);
          if (_gc > _gMaxCur) _gMaxCur = _gc;
        }
      }
      _gp._i = _gMaxCur;
      _gp._v = 0;
      _gp._p = 0;
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
    // Sprint 103 (F-005): wall-clock + iteration budget so a non-converging
    // circuit (e.g. npn-sw feedback loop with a deep hysteresis) can't hang
    // the browser. The NR algorithm below is unchanged; we simply bail
    // out of the outer stepping loops when either budget is exhausted and
    // return false with a clear error. Root cause (why npn-sw does not
    // converge) is deferred to Sprint 104 under the no-silent-scope rule.
    var _dcopStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var _dcopBudgetMs = 5000;  // 5 s wall-clock budget
    var _dcopMaxOuter = 500;    // safety on any outer loop count
    var _dcopOuterCount = 0;
    function _dcopTimedOut() {
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - _dcopStart > _dcopBudgetMs) return true;
      if (_dcopOuterCount++ > _dcopMaxOuter) return true;
      return false;
    }

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
        if (_dcopTimedOut()) { success = false; break; }
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
        if (_dcopTimedOut()) { success = false; break; }
        _currentGMIN = GMIN_STEPS[g];
        solve(1e-5);
        if (_lastConverged) {
          if (g === GMIN_STEPS.length - 1) { success = true; break; }
          continue;
        } else {
          if (g === 0) break;
        }
      }
      if (!success && !_dcopTimedOut()) {
        _currentGMIN = 1e-12;
        var sources2 = SIM.comps.filter(function(c) { return c.type === 'V'; });
        var origVals2 = sources2.map(function(s) { return s.val; });
        var steps2 = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
        for (var si2 = 0; si2 < steps2.length; si2++) {
          if (_dcopTimedOut()) break;
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

    if (!success) {
      var _elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - _dcopStart;
      if (_elapsed > _dcopBudgetMs || _dcopOuterCount > _dcopMaxOuter) {
        console.warn('DC operating point timeout after ' + _elapsed.toFixed(0) + 'ms — aborting to keep UI responsive');
        if (S && S.sim) S.sim.error = 'DC OP timeout (' + _elapsed.toFixed(0) + 'ms)';
      } else {
        console.warn('DC operating point bulunamadı');
      }
    }
    return success;
  }

  return {
    solve: solve, findDCOperatingPoint: findDCOperatingPoint,
    getNRIter: getNRIter, getConverged: getConverged, getNodeCount: getNodeCount,
    getBandwidth: getBandwidth, getSimMethod: getSimMethod, setSimMethod: setSimMethod,
    getCurrentGMIN: getCurrentGMIN,
    getPTCActivatedAt: getPTCActivatedAt
  };
})();