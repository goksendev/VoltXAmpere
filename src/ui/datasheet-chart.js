// ──────── SPRINT 104.3.6 — DATASHEET CHART RENDERER ────────
// Pure-function SVG builder. Each chart definition from DATASHEETS is turned
// into an inline <svg> string the panel can drop into innerHTML. No build
// dependencies, no external libraries.
//
// Chart types:
//   linear      — default V/I / R vs T / any xy plot
//   exp         — semilog y fits exp curves (Shockley diode, NTC)
//   log-log     — both axes log, used for impedance (C, L, LDR)
//   bode        — semilog x, linear y in dB (open-loop gain)
//   output-char — family of curves with different param (BJT/MOSFET)
//   transfer    — single transfer curve (comparator, op-amp)

var DatasheetChart = (function() {

  var W = 340, H = 120;
  var MARGIN = { l: 34, r: 10, t: 12, b: 22 };
  var PLOT_W = W - MARGIN.l - MARGIN.r;
  var PLOT_H = H - MARGIN.t - MARGIN.b;
  var GRID_X = 8, GRID_Y = 4;

  function _extent(curves, axis, useLog) {
    var lo = Infinity, hi = -Infinity;
    curves.forEach(function(c) {
      c.points.forEach(function(p) {
        var v = p[axis];
        if (useLog) { if (v <= 0) return; v = Math.log10(v); }
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      });
    });
    if (!isFinite(lo) || !isFinite(hi)) return { lo: 0, hi: 1 };
    if (lo === hi) { lo -= 1; hi += 1; }
    return { lo: lo, hi: hi };
  }

  function _escape(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _tickValues(lo, hi, n, useLog) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var v = lo + (hi - lo) * i / n;
      out.push(useLog ? Math.pow(10, v) : v);
    }
    return out;
  }

  function _fmt(v, useLog) {
    if (useLog) {
      if (v >= 1000000) return (v/1000000).toFixed(0) + 'M';
      if (v >= 1000)    return (v/1000).toFixed(0) + 'k';
      if (v >= 1)       return v.toFixed(0);
      if (v >= 0.001)   return (v*1000).toFixed(0) + 'm';
      if (v >= 0.000001) return (v*1000000).toFixed(0) + 'µ';
      return v.toExponential(0);
    }
    var a = Math.abs(v);
    if (a >= 100) return v.toFixed(0);
    if (a >= 10)  return v.toFixed(1);
    if (a >= 1)   return v.toFixed(1);
    if (a > 0)    return v.toFixed(2);
    return '0';
  }

  function render(def) {
    if (!def || !def.curves || !def.curves.length) return '';
    var type = def.type || 'linear';
    var xLog = (type === 'log-log' || type === 'bode' || type === 'exp');
    var yLog = (type === 'log-log');
    // exp: x linear, y log; actually: "exp" means curve is exponential, so
    // plotting with log y makes it straight. For us, R vs T (NTC) wants
    // log y + linear x.
    if (type === 'exp') { xLog = false; yLog = true; }

    var xExt = _extent(def.curves, 0, xLog);
    var yExt = _extent(def.curves, 1, yLog);

    function sx(v) {
      var lv = xLog ? Math.log10(Math.max(v, 1e-12)) : v;
      return MARGIN.l + PLOT_W * (lv - xExt.lo) / (xExt.hi - xExt.lo);
    }
    function sy(v) {
      var lv = yLog ? Math.log10(Math.max(v, 1e-12)) : v;
      return MARGIN.t + PLOT_H - PLOT_H * (lv - yExt.lo) / (yExt.hi - yExt.lo);
    }

    var axisStroke = 'rgba(255,255,255,0.14)';
    var axisLabel = 'rgba(255,255,255,0.45)';
    var curveStroke = 'var(--ds-accent, #4fc3f7)';

    var svg = '<svg class="ds-chart" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';

    // Grid lines
    for (var i = 0; i <= GRID_X; i++) {
      var x = MARGIN.l + PLOT_W * i / GRID_X;
      svg += '<line x1="'+x+'" y1="'+MARGIN.t+'" x2="'+x+'" y2="'+(MARGIN.t+PLOT_H)+'" stroke="'+axisStroke+'" stroke-width="0.5" />';
    }
    for (var j = 0; j <= GRID_Y; j++) {
      var y = MARGIN.t + PLOT_H * j / GRID_Y;
      svg += '<line x1="'+MARGIN.l+'" y1="'+y+'" x2="'+(MARGIN.l+PLOT_W)+'" y2="'+y+'" stroke="'+axisStroke+'" stroke-width="0.5" />';
    }

    // Axes
    svg += '<line x1="'+MARGIN.l+'" y1="'+(MARGIN.t+PLOT_H)+'" x2="'+(MARGIN.l+PLOT_W)+'" y2="'+(MARGIN.t+PLOT_H)+'" stroke="rgba(255,255,255,0.3)" stroke-width="1" />';
    svg += '<line x1="'+MARGIN.l+'" y1="'+MARGIN.t+'" x2="'+MARGIN.l+'" y2="'+(MARGIN.t+PLOT_H)+'" stroke="rgba(255,255,255,0.3)" stroke-width="1" />';

    // Tick labels (sparse — every 2nd x, every y)
    var xTicks = _tickValues(xExt.lo, xExt.hi, 4, xLog);
    xTicks.forEach(function(v, k) {
      var x = MARGIN.l + PLOT_W * k / 4;
      var y = MARGIN.t + PLOT_H + 12;
      svg += '<text x="'+x+'" y="'+y+'" fill="'+axisLabel+'" font-size="9" text-anchor="middle" font-family="\'JetBrains Mono\', ui-monospace, monospace">'+_escape(_fmt(v, xLog))+'</text>';
    });
    var yTicks = _tickValues(yExt.lo, yExt.hi, GRID_Y, yLog);
    yTicks.forEach(function(v, k) {
      var x = MARGIN.l - 4;
      var y = MARGIN.t + PLOT_H - PLOT_H * k / GRID_Y + 3;
      svg += '<text x="'+x+'" y="'+y+'" fill="'+axisLabel+'" font-size="9" text-anchor="end" font-family="\'JetBrains Mono\', ui-monospace, monospace">'+_escape(_fmt(v, yLog))+'</text>';
    });

    // Axis labels
    if (def.xLabel) svg += '<text x="'+(W-MARGIN.r-2)+'" y="'+(H-4)+'" fill="'+axisLabel+'" font-size="9" text-anchor="end">'+_escape(def.xLabel)+'</text>';
    if (def.yLabel) svg += '<text x="6" y="'+(MARGIN.t+4)+'" fill="'+axisLabel+'" font-size="9" text-anchor="start">'+_escape(def.yLabel)+'</text>';

    // Curves
    def.curves.forEach(function(c, idx) {
      if (!c.points.length) return;
      var d = '';
      c.points.forEach(function(p, i) {
        var X = sx(p[0]);
        var Y = sy(p[1]);
        if (!isFinite(X) || !isFinite(Y)) return;
        d += (i === 0 ? 'M' : 'L') + X.toFixed(1) + ',' + Y.toFixed(1);
      });
      svg += '<path d="'+d+'" fill="none" stroke="'+curveStroke+'" stroke-width="2" opacity="'+(0.6 + 0.4*(idx+1)/def.curves.length)+'" />';
      // Inline label at the last point if multiple curves
      if (def.curves.length > 1 && c.label) {
        var last = c.points[c.points.length-1];
        var lx = sx(last[0]);
        var ly = sy(last[1]);
        svg += '<text x="'+(lx+2)+'" y="'+ly+'" fill="'+axisLabel+'" font-size="8" text-anchor="start">'+_escape(c.label)+'</text>';
      }
    });

    // Annotation
    if (def.annotation) {
      svg += '<text x="'+(MARGIN.l+4)+'" y="'+(MARGIN.t+10)+'" fill="'+axisLabel+'" font-size="9" font-style="italic">'+_escape(def.annotation)+'</text>';
    }

    svg += '</svg>';
    return svg;
  }

  return { render: render };
})();

if (typeof window !== 'undefined') window.DatasheetChart = DatasheetChart;
