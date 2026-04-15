// ──────── SPRINT 40: PWL / EXP / SFFM SOURCES (v9.0) ────────
// Time-domain source evaluators + SPICE-format parsers.

VXA.Sources = (function() {
  'use strict';

  var MAX_PWL_POINTS = 100;

  function pv(s) {
    if (typeof VXA.SpiceParser !== 'undefined') return VXA.SpiceParser.parseSpiceNumber(String(s));
    return parseFloat(s);
  }

  // ── PWL: piecewise linear ─────────────────────
  function pwl(t, points) {
    if (!points || points.length === 0) return 0;
    if (t <= points[0][0]) return points[0][1];
    if (t >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (var i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        var t0 = points[i-1][0], v0 = points[i-1][1];
        var t1 = points[i][0], v1 = points[i][1];
        if (t1 === t0) return v1;
        var frac = (t - t0) / (t1 - t0);
        return v0 + frac * (v1 - v0);
      }
    }
    return points[points.length - 1][1];
  }

  function parsePWL(text) {
    var content = String(text).replace(/^PWL\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
    content = content.replace(/,/g, ' ');
    var tokens = content.trim().split(/\s+/).filter(function(x) { return x.length > 0; });
    var points = [];
    for (var i = 0; i + 1 < tokens.length; i += 2) {
      var time = pv(tokens[i]);
      var val = pv(tokens[i + 1]);
      if (isFinite(time) && isFinite(val)) points.push([time, val]);
    }
    points.sort(function(a, b) { return a[0] - b[0]; });
    if (points.length > MAX_PWL_POINTS) {
      console.warn('[PWL] truncated to ' + MAX_PWL_POINTS + ' points');
      points = points.slice(0, MAX_PWL_POINTS);
    }
    return points;
  }

  // ── EXP: double-exponential ────────────────────
  //  t < td1:           V1
  //  td1 ≤ t < td2:    V1 + (V2-V1)(1 - e^(-(t-td1)/tau1))
  //  t ≥ td2:           + (V1-V2)(1 - e^(-(t-td2)/tau2))
  function expFn(t, params) {
    var V1 = params.v1 || 0;
    var V2 = (params.v2 !== undefined) ? params.v2 : 0;
    var td1 = params.td1 || 0;
    var tau1 = params.tau1 || 1e-6;
    var td2 = (params.td2 !== undefined) ? params.td2 : (td1 + 5 * tau1);
    var tau2 = params.tau2 || tau1;
    if (t < td1) return V1;
    var rise = (V2 - V1) * (1 - Math.exp(-(t - td1) / tau1));
    if (t < td2) return V1 + rise;
    var fall = (V1 - V2) * (1 - Math.exp(-(t - td2) / tau2));
    return V1 + rise + fall;
  }

  function parseEXP(text) {
    var content = String(text).replace(/^EXP\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
    var tokens = content.trim().split(/[\s,]+/).filter(function(x) { return x.length > 0; });
    return {
      v1: pv(tokens[0] || '0'),
      v2: pv(tokens[1] || '5'),
      td1: pv(tokens[2] || '0'),
      tau1: pv(tokens[3] || '1m'),
      td2: pv(tokens[4] || '0'),
      tau2: pv(tokens[5] || '1m')
    };
  }

  // ── SFFM: single-frequency FM ─────────────────
  function sffm(t, params) {
    var Voff = params.voff || 0;
    var Vamp = (params.vamp !== undefined) ? params.vamp : 1;
    var Fcar = params.fcar || 1e3;
    var MDI = (params.mdi !== undefined) ? params.mdi : 0;
    var Fsig = params.fsig || 100;
    var mod = MDI * Math.sin(2 * Math.PI * Fsig * t);
    return Voff + Vamp * Math.sin(2 * Math.PI * Fcar * t + mod);
  }

  function parseSFFM(text) {
    var content = String(text).replace(/^SFFM\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
    var tokens = content.trim().split(/[\s,]+/).filter(function(x) { return x.length > 0; });
    return {
      voff: pv(tokens[0] || '0'),
      vamp: pv(tokens[1] || '1'),
      fcar: pv(tokens[2] || '1k'),
      mdi: pv(tokens[3] || '0'),
      fsig: pv(tokens[4] || '100')
    };
  }

  return {
    pwl: pwl,
    exp: expFn,
    sffm: sffm,
    parsePWL: parsePWL,
    parseEXP: parseEXP,
    parseSFFM: parseSFFM,
    MAX_PWL_POINTS: MAX_PWL_POINTS
  };
})();
