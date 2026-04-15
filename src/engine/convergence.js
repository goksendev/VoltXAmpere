// ──────── SPRINT 48: CONVERGENCE ULTIMATE (v9.0) ────────
// Standalone convergence toolkit: pseudo-transient, 4-tier DC OP, adaptive
// NR damping, diagnostic. API-first — the main sim.js pipeline is NOT
// mutated to preserve the 55-preset motor regression. Opt-in usage only.

VXA.Convergence = (function() {
  'use strict';

  // Solve function contract:
  //   solveFunc(dtPT, Cpt, gmin?) → boolean (converged?)
  // Writes its result into the shared nodeV Float64Array (passed in externally).

  function pseudoTransient(solveFunc, N, nodeV, comps, options) {
    if (!solveFunc || typeof solveFunc !== 'function') return false;
    var opts = options || {};
    var Cpt0 = opts.Cpt || 1e-9;
    var dtPT = opts.dtPT || 1e-6;
    var maxSteps = opts.maxSteps || 50;
    var reduction = opts.reduction || 0.5;
    var phases = opts.phases || 6;
    var phaseTrace = [];

    var prev = new Float64Array(N);
    var success = false;

    for (var phase = 0; phase < phases; phase++) {
      var Cpt = Cpt0 * Math.pow(reduction, phase);
      var phaseConverged = false;
      var stepsInPhase = 0;

      for (var step = 0; step < maxSteps; step++) {
        for (var i = 0; i < N; i++) prev[i] = nodeV[i] || 0;
        var ok = !!solveFunc(dtPT, Cpt);
        stepsInPhase++;
        if (ok) {
          var maxDiff = 0;
          for (var j = 0; j < N; j++) {
            var d = Math.abs((nodeV[j] || 0) - prev[j]);
            if (d > maxDiff) maxDiff = d;
          }
          if (maxDiff < 1e-6) { phaseConverged = true; break; }
        }
      }
      phaseTrace.push({ phase: phase, Cpt: Cpt, steps: stepsInPhase, converged: phaseConverged });
    }

    // Final solve at Cpt=0
    var final = !!solveFunc(0, 0);
    success = final;
    return { success: success, phases: phaseTrace };
  }

  function gminStepping(solveFunc) {
    var GMIN_STEPS = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12];
    var lastOk = false;
    for (var g = 0; g < GMIN_STEPS.length; g++) {
      var ok = !!solveFunc(0, 0, GMIN_STEPS[g]);
      if (!ok && g === 0) return false;
      lastOk = ok;
    }
    return lastOk;
  }

  function sourceSteppingRollback(solveFunc, N, nodeV, comps) {
    var sources = (comps || []).filter(function(c) { return c && c.type === 'V'; });
    if (sources.length === 0) return false;
    var origVals = sources.map(function(s) { return s.val; });
    var goodNodeV = new Float64Array(N);
    var lastGoodFactor = 0;

    var factors = [0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3,
                   0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];
    var fi = 0, stuck = 0, iterations = 0, rollbacks = 0;

    while (fi < factors.length && iterations < 200) {
      iterations++;
      var f = factors[fi];
      for (var j = 0; j < sources.length; j++) sources[j].val = origVals[j] * f;
      var ok = !!solveFunc(0, 0);
      if (ok) {
        for (var k = 0; k < N; k++) goodNodeV[k] = nodeV[k] || 0;
        lastGoodFactor = f; fi++; stuck = 0;
      } else {
        rollbacks++;
        for (var k2 = 0; k2 < N; k2++) nodeV[k2] = goodNodeV[k2] || 0;
        var midF = (lastGoodFactor + f) / 2;
        if (midF - lastGoodFactor < 0.003 || stuck > 15) { fi++; stuck = 0; }
        else { factors.splice(fi, 0, midF); stuck++; }
      }
    }
    // Restore sources
    for (var r = 0; r < sources.length; r++) sources[r].val = origVals[r];
    // Final polish
    var finalOk = false;
    for (var rep = 0; rep < 5; rep++) finalOk = !!solveFunc(0, 0);
    return { success: finalOk, iterations: iterations, rollbacks: rollbacks };
  }

  function findDCOP_enhanced(solveFunc, N, nodeV, comps) {
    var result = { success: false, method: 'all_failed', trace: [] };
    var hasBJT = false, hasMOS = false, hasNL = false;
    for (var i = 0; i < (comps || []).length; i++) {
      var c = comps[i];
      if (!c) continue;
      if (c.type === 'BJT') hasBJT = true;
      if (c.type === 'MOS') hasMOS = true;
      if (c.type === 'D' || c.type === 'Z' || c.type === 'BJT' || c.type === 'MOS') hasNL = true;
    }

    // 1. Direct NR
    if (!!solveFunc(0, 0)) {
      result.success = true; result.method = 'direct';
      result.trace.push({ step: 'direct', ok: true });
      return result;
    }
    result.trace.push({ step: 'direct', ok: false });

    // 2. GMIN stepping (no BJT — BJT needs source stepping)
    if (!hasBJT) {
      if (gminStepping(solveFunc)) {
        result.success = true; result.method = 'gmin';
        result.trace.push({ step: 'gmin', ok: true });
        return result;
      }
      result.trace.push({ step: 'gmin', ok: false });
    }

    // 3. Source stepping with rollback
    if (hasNL) {
      var ss = sourceSteppingRollback(solveFunc, N, nodeV, comps);
      if (ss && ss.success) {
        result.success = true; result.method = 'source_stepping';
        result.trace.push({ step: 'source_stepping', ok: true, iter: ss.iterations, rollbacks: ss.rollbacks });
        return result;
      }
      result.trace.push({ step: 'source_stepping', ok: false });
    }

    // 4. Pseudo-transient (last resort)
    var pt = pseudoTransient(solveFunc, N, nodeV, comps);
    if (pt && pt.success) {
      result.success = true; result.method = 'pseudo_transient';
      result.trace.push({ step: 'pseudo_transient', ok: true, phases: pt.phases.length });
      return result;
    }
    result.trace.push({ step: 'pseudo_transient', ok: false });
    return result;
  }

  // NR damping — returns the DAMPED delta applied in place.
  function applyDamping(newV, oldV, N, comps, iter) {
    var dampFactor;
    if (iter < 3)       dampFactor = 0.3;
    else if (iter < 10) dampFactor = 0.6;
    else if (iter < 20) dampFactor = 0.8;
    else                dampFactor = 1.0;
    var MAX_STEP = 5.0;
    for (var i = 0; i < N; i++) {
      var d = (newV[i] || 0) - (oldV[i] || 0);
      if (d > MAX_STEP) d = MAX_STEP;
      else if (d < -MAX_STEP) d = -MAX_STEP;
      newV[i] = (oldV[i] || 0) + d * dampFactor;
    }
    return { dampFactor: dampFactor, maxStep: MAX_STEP };
  }

  // Diagnose convergence problems.
  function diagnose(nodeV, prevNodeV, comps, N, tolerance) {
    var tol = (typeof tolerance === 'number') ? tolerance : 1e-6;
    if (!nodeV || !prevNodeV) return { converged: true, problemCount: 0 };
    var problems = [];
    for (var i = 0; i < N; i++) {
      var diff = Math.abs((nodeV[i] || 0) - (prevNodeV[i] || 0));
      if (diff > tol) {
        problems.push({
          node: i + 1, diff: diff,
          voltage: nodeV[i] || 0,
          prevVoltage: prevNodeV[i] || 0
        });
      }
    }
    if (problems.length === 0) return { converged: true, problemCount: 0 };
    problems.sort(function(a, b) { return b.diff - a.diff; });
    problems.forEach(function(p) {
      p.connectedComps = (comps || []).filter(function(c) {
        if (!c) return false;
        var nodes = [c.n1, c.n2, c.n3, c.n4, c.nP, c.nN, c.nO, c.nA, c.nK, c.nG];
        return nodes.indexOf(p.node) >= 0;
      }).map(function(c) {
        return { type: c.type, name: (c.part && c.part.name) || c.name || c.type };
      });
    });
    var worst = problems[0];
    var types = (worst.connectedComps || []).map(function(c) { return c.type; });
    var suggestions = [];
    if (types.indexOf('D') >= 0 || types.indexOf('Z') >= 0) {
      suggestions.push('Diyot/zener bağlantısını kontrol edin — ters bağlı olabilir.');
    }
    if (types.indexOf('BJT') >= 0) {
      suggestions.push('BJT bias ağını kontrol edin — base voltajı uygunsuz olabilir.');
      suggestions.push('Küçük bir base direnci (10kΩ) eklemeyi deneyin.');
    }
    if (types.indexOf('MOS') >= 0) {
      suggestions.push('MOSFET gate voltajını kontrol edin — Vth civarında sorun olabilir.');
    }
    if (worst.diff > 100) {
      suggestions.push('Açık devre düğüm olabilir — bağlantıları kontrol edin.');
      suggestions.push('Küçük bir direnç (1MΩ) ile GND\'ye bağlamayı deneyin.');
    }
    if (suggestions.length === 0) {
      suggestions.push('NR damping veya GMIN stepping denenebilir.');
    }
    return {
      converged: false,
      worstNode: worst.node,
      worstDiff: worst.diff,
      problemCount: problems.length,
      problems: problems.slice(0, 5),
      suggestions: suggestions
    };
  }

  // Diagnostic event + status-bar hook (opt-in wrapper for UI).
  var _lastDiag = null;
  function setLastDiagnostic(d) { _lastDiag = d; }
  function getLastDiagnostic() { return _lastDiag; }

  return {
    pseudoTransient: pseudoTransient,
    findDCOP: findDCOP_enhanced,
    gminStepping: gminStepping,
    sourceSteppingRollback: sourceSteppingRollback,
    applyDamping: applyDamping,
    diagnose: diagnose,
    setLastDiagnostic: setLastDiagnostic,
    getLastDiagnostic: getLastDiagnostic
  };
})();
