// ──────── SPRINT 39: .STEP ANALYSIS (v9.0) ────────
// SPICE-compatible parametric step (LIN/DEC/OCT/LIST).

VXA.StepAnalysis = (function() {
  'use strict';

  var MAX_POINTS = 1000;

  function pv(s) {
    if (typeof VXA.SpiceParser !== 'undefined') return VXA.SpiceParser.parseSpiceNumber(String(s));
    return parseFloat(s);
  }

  function parseStepLine(line) {
    var tokens = String(line).replace(/^\.STEP\s+/i, '').trim().split(/\s+/);
    var result = { type: 'LIN', paramName: '', values: [], truncated: false };
    var i = 0;

    if (i < tokens.length && /^(LIN|DEC|OCT)$/i.test(tokens[i])) {
      result.type = tokens[i].toUpperCase(); i++;
    }
    if (i < tokens.length && /^PARAM$/i.test(tokens[i])) i++;

    result.paramName = (tokens[i++] || '').toUpperCase();

    if (i < tokens.length && /^LIST$/i.test(tokens[i])) {
      i++;
      while (i < tokens.length) {
        var n = pv(tokens[i++]);
        if (isFinite(n)) result.values.push(n);
      }
    } else {
      var start = pv(tokens[i++] || '0');
      var stop = pv(tokens[i++] || '1');
      var stepOrPoints = pv(tokens[i++] || '1');

      if (result.type === 'LIN') {
        if (stepOrPoints <= 0) stepOrPoints = (stop - start) / 10 || 1;
        var v = start;
        var guard = 0;
        while (v <= stop * 1.0000001 && guard < MAX_POINTS + 1) {
          result.values.push(Math.round(v * 1e12) / 1e12);
          v += stepOrPoints;
          guard++;
        }
      } else if (result.type === 'DEC') {
        if (start <= 0 || stop <= 0) return result;
        var ppd = stepOrPoints || 10;
        var decs = Math.log10(stop / start);
        var npts = Math.round(decs * ppd);
        for (var k = 0; k <= npts; k++) {
          result.values.push(start * Math.pow(10, k / ppd));
        }
      } else if (result.type === 'OCT') {
        if (start <= 0 || stop <= 0) return result;
        var ppo = stepOrPoints || 10;
        var octs = Math.log2(stop / start);
        var npts2 = Math.round(octs * ppo);
        for (var j = 0; j <= npts2; j++) {
          result.values.push(start * Math.pow(2, j / ppo));
        }
      }
    }

    if (result.values.length > MAX_POINTS) {
      result.values = result.values.slice(0, MAX_POINTS);
      result.truncated = true;
      console.warn('[.STEP] truncated to ' + MAX_POINTS + ' points');
    }
    return result;
  }

  function applyParamsToCircuit() {
    if (typeof S === 'undefined' || !S || !S.parts) return;
    S.parts.forEach(function(p) {
      if (p.paramExpr) {
        var resolved = VXA.Params.resolve(p.paramExpr);
        if (typeof resolved === 'number' && isFinite(resolved)) p.val = resolved;
      }
    });
  }

  function runStep(stepConfig, simCallback) {
    var results = [];
    if (!stepConfig || !stepConfig.values) return results;
    var pname = String(stepConfig.paramName).toUpperCase();
    stepConfig.values.forEach(function(val, idx) {
      VXA.Params.define(pname, val);
      applyParamsToCircuit();
      var r = (typeof simCallback === 'function') ? (simCallback(val, idx) || {}) : {};
      r.paramValue = val;
      r.paramName = pname;
      r.index = idx;
      results.push(r);
    });
    return results;
  }

  return {
    parseStepLine: parseStepLine,
    runStep: runStep,
    applyParamsToCircuit: applyParamsToCircuit,
    MAX_POINTS: MAX_POINTS
  };
})();
