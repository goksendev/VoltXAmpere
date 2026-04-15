// ──────── SPRINT 49: WAVEFORM VIEWER PRO (v9.0) ────────
// Standalone pro-scope toolkit. Main drawScope() is NOT mutated (breadboard
// / preset regression protection). Sprint 50+ wires this into the scope tab.

VXA.ScopePro = (function() {
  'use strict';

  var MAX_PANELS = 4;
  var panels = [{ channels: [0], yMin: -10, yMax: 10, label: 'Voltaj (V)' }];
  var mathTraces = [];
  var cursors = {
    c1: { enabled: false, time: 0 },
    c2: { enabled: false, time: 0 }
  };

  function addPanel(config) {
    if (panels.length >= MAX_PANELS) return false;
    panels.push({
      channels: (config && config.channels) || [],
      yMin: (config && typeof config.yMin === 'number') ? config.yMin : -10,
      yMax: (config && typeof config.yMax === 'number') ? config.yMax : 10,
      label: (config && config.label) || ('Panel ' + (panels.length + 1))
    });
    return true;
  }

  function removePanel(index) {
    if (panels.length <= 1) return false;
    if (index < 0 || index >= panels.length) return false;
    panels.splice(index, 1);
    return true;
  }

  function getMathColor(i) {
    var colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    return colors[i % colors.length];
  }

  function addMathTrace(expression, label) {
    mathTraces.push({
      expression: String(expression || ''),
      label: label || expression,
      color: getMathColor(mathTraces.length),
      data: []
    });
    return mathTraces.length;
  }

  // Balanced-paren matcher for dB(...) — emits sentinel tokens so the later
  // Math-function regex doesn't re-wrap them into Math.Math.log10(...).
  var SENT = '\u0001';
  function resolveDB(expr) {
    var out = '';
    var i = 0;
    while (i < expr.length) {
      var rest = expr.substring(i);
      var m = rest.match(/^dB\s*\(/i);
      if (!m) { out += expr[i]; i++; continue; }
      i += m[0].length;
      var depth = 1, start = i;
      while (i < expr.length && depth > 0) {
        if (expr[i] === '(') depth++;
        else if (expr[i] === ')') depth--;
        if (depth > 0) i++;
      }
      var inner = expr.substring(start, i);
      i++; // skip ')'
      out += '(20*' + SENT + 'log10' + SENT + '(' + SENT + 'abs' + SENT + '(' + inner + ')+1e-30))';
    }
    return out;
  }

  function evaluateMathTrace(trace, scopeData, time) {
    if (!trace || !trace.expression) return 0;
    var expr = trace.expression;
    // dB(...) FIRST — before V() substitution injects parens that would break [^)]+.
    // Use a balanced-paren finder so expressions like dB(V(0)/V(1)) survive.
    expr = resolveDB(expr);
    // V(ch) → scopeData[ch] (unwrapped; upstream ops pad with spaces)
    expr = expr.replace(/V\s*\(\s*(\d+)\s*\)/gi, function(_m, ch) {
      var idx = parseInt(ch, 10);
      return ' ' + (+((scopeData && scopeData[idx]) || 0)) + ' ';
    });
    // time
    expr = expr.replace(/\btime\b/gi, '(' + (+time || 0) + ')');
    // Math funcs (user-level names) — skip sentinel-wrapped tokens
    var mfs = ['sin','cos','tan','exp','log10','log','sqrt','abs','pow','min','max','floor','ceil'];
    for (var i = 0; i < mfs.length; i++) {
      expr = expr.replace(new RegExp('\\b' + mfs[i] + '\\s*\\(', 'g'), 'Math.' + mfs[i] + '(');
    }
    // Convert sentinel tokens to Math.xxx (from resolveDB)
    expr = expr.replace(new RegExp(SENT + '([a-z0-9]+)' + SENT, 'gi'), 'Math.$1');
    // Safety whitelist
    var stripped = expr.replace(/Math\.[a-z0-9]+/gi, '');
    if (!/^[0-9.eE+\-*/()<>=!&|?:, \t]*$/.test(stripped)) return 0;
    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function('return (' + expr + ');');
      var v = fn();
      return (typeof v === 'number' && isFinite(v)) ? v : 0;
    } catch (e) { return 0; }
  }

  function getValueAtTime(buf, time, timeBase) {
    if (!buf || buf.length === 0) return 0;
    var idx = (time / timeBase) * buf.length;
    var i0 = Math.floor(idx);
    var i1 = Math.min(i0 + 1, buf.length - 1);
    if (i0 < 0) return buf[0] || 0;
    if (i0 >= buf.length) return buf[buf.length - 1] || 0;
    var frac = idx - i0;
    return (buf[i0] || 0) * (1 - frac) + (buf[i1] || 0) * frac;
  }

  function getCursorMeasurements(scopeBuffer, timeBase) {
    if (!cursors.c1.enabled || !cursors.c2.enabled) return null;
    var t1 = cursors.c1.time, t2 = cursors.c2.time;
    var v1 = getValueAtTime(scopeBuffer, t1, timeBase);
    var v2 = getValueAtTime(scopeBuffer, t2, timeBase);
    var dt = Math.abs(t2 - t1);
    return {
      t1: t1, t2: t2, v1: v1, v2: v2,
      deltaT: dt,
      deltaV: Math.abs(v2 - v1),
      frequency: dt > 0 ? 1 / dt : 0,
      slope: (t2 - t1) !== 0 ? (v2 - v1) / (t2 - t1) : 0
    };
  }

  function autoMeasure(data) {
    if (!data || data.length === 0) return null;
    var n = data.length;
    var max = -Infinity, min = Infinity, sum = 0, sumSq = 0;
    for (var i = 0; i < n; i++) {
      var v = data[i];
      if (v > max) max = v;
      if (v < min) min = v;
      sum += v;
      sumSq += v * v;
    }
    var avg = sum / n;
    var rms = Math.sqrt(sumSq / n);
    var pp = max - min;

    // Frequency via mid-level zero crossings (avg-based)
    var crossings = 0;
    var prev = data[0] >= avg;
    for (var j = 1; j < n; j++) {
      var cur = data[j] >= avg;
      if (cur !== prev) crossings++;
      prev = cur;
    }
    var freq = (n > 1 && crossings > 1) ? (crossings / (2 * n)) : 0;

    // Rise time (10% → 90%, sample-count units)
    var t10 = min + pp * 0.1, t90 = min + pp * 0.9;
    var riseStart = -1, riseEnd = -1;
    for (var k = 0; k < n - 1; k++) {
      if (riseStart < 0 && data[k] <= t10 && data[k + 1] > t10) riseStart = k;
      if (riseStart >= 0 && data[k] <= t90 && data[k + 1] > t90) { riseEnd = k; break; }
    }
    var riseTime = (riseStart >= 0 && riseEnd >= 0) ? (riseEnd - riseStart) : null;

    return { max: max, min: min, pp: pp, avg: avg, rms: rms, frequency: freq, riseTime: riseTime };
  }

  function fmtV(v) {
    if (!isFinite(v)) return '—';
    return Math.abs(v) < 0.01 ? (v * 1e3).toFixed(1) + 'mV' : v.toFixed(2) + 'V';
  }
  function fmtFreq(f) {
    if (!isFinite(f) || f === 0) return '—';
    return f >= 1e6 ? (f / 1e6).toFixed(1) + 'MHz'
         : f >= 1e3 ? (f / 1e3).toFixed(1) + 'kHz'
         : f.toFixed(0) + 'Hz';
  }
  function getChannelColor(ch) {
    var colors = ['#4ade80', '#60a5fa', '#f59e0b', '#ec4899'];
    return colors[ch] || '#888';
  }

  function renderMeasurementTable(measurements) {
    if (!measurements || measurements.length === 0) return '';
    var html = '<div class="meas-table" style="font:10px var(--font-mono,monospace);' +
               'color:var(--text-3,#999);padding:4px 8px;' +
               'display:grid;grid-template-columns:auto repeat(6,1fr);gap:2px 8px">';
    measurements.forEach(function(m, ch) {
      if (!m) return;
      html += '<span style="color:' + getChannelColor(ch) + '">CH' + (ch + 1) + '</span>';
      html += '<span>Max=' + fmtV(m.max) + '</span>';
      html += '<span>Min=' + fmtV(m.min) + '</span>';
      html += '<span>Vpp=' + fmtV(m.pp) + '</span>';
      html += '<span>Avg=' + fmtV(m.avg) + '</span>';
      html += '<span>RMS=' + fmtV(m.rms) + '</span>';
      html += '<span>f=' + fmtFreq(m.frequency) + '</span>';
    });
    html += '</div>';
    return html;
  }

  return {
    MAX_PANELS: MAX_PANELS,
    panels: panels, addPanel: addPanel, removePanel: removePanel,
    mathTraces: mathTraces, addMathTrace: addMathTrace, evaluateMathTrace: evaluateMathTrace,
    cursors: cursors, getCursorMeasurements: getCursorMeasurements, getValueAtTime: getValueAtTime,
    autoMeasure: autoMeasure,
    renderMeasurementTable: renderMeasurementTable,
    fmtV: fmtV, fmtFreq: fmtFreq, getChannelColor: getChannelColor
  };
})();
