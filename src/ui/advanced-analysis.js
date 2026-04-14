// ══════════════════════════════════════════════════════════════
// Sprint 21: Advanced Analysis UI — Pole-Zero, Contour Sweep, Transfer Function
// ══════════════════════════════════════════════════════════════

// ── VXA.ContourSweep ──
VXA.ContourSweep = (function() {
  'use strict';

  function generateRange(min, max, steps, scale) {
    var vals = new Float64Array(steps);
    if (scale === 'log') {
      var lMin = Math.log10(Math.max(min, 1e-15)), lMax = Math.log10(Math.max(max, 1e-15));
      for (var i = 0; i < steps; i++) vals[i] = Math.pow(10, lMin + (lMax - lMin) * i / (steps - 1));
    } else {
      for (var i = 0; i < steps; i++) vals[i] = min + (max - min) * i / (steps - 1);
    }
    return vals;
  }

  function sweep(options) {
    var p1 = options.param1, p2 = options.param2, out = options.output;
    var s1 = p1.steps || 15, s2 = p2.steps || 15;
    var v1 = generateRange(p1.min, p1.max, s1, p1.scale || 'linear');
    var v2 = generateRange(p2.min, p2.max, s2, p2.scale || 'linear');
    var results = [];
    for (var j = 0; j < s2; j++) results[j] = new Float64Array(s1);
    var minVal = Infinity, maxVal = -Infinity;

    var part1 = S.parts.find(function(p) { return p.id === p1.partId; });
    var part2 = S.parts.find(function(p) { return p.id === p2.partId; });
    if (!part1 || !part2) return { error: 'Parts not found' };
    var orig1 = part1.val, orig2 = part2.val;

    for (var j = 0; j < s2; j++) {
      part2.val = v2[j];
      for (var i = 0; i < s1; i++) {
        part1.val = v1[i];
        var m = measureDC(out);
        results[j][i] = m;
        if (!isNaN(m) && m < minVal) minVal = m;
        if (!isNaN(m) && m > maxVal) maxVal = m;
      }
    }

    part1.val = orig1; part2.val = orig2;
    if (typeof buildCircuitFromCanvas === 'function') buildCircuitFromCanvas();

    return {
      param1: { label: part1.name || 'P1', values: v1 },
      param2: { label: part2.name || 'P2', values: v2 },
      results: results, minVal: minVal, maxVal: maxVal,
      totalSimulations: s1 * s2
    };
  }

  function measureDC(output) {
    try {
      if (typeof buildCircuitFromCanvas === 'function') buildCircuitFromCanvas();
      S.sim.t = 0; S._nodeVoltages = null;
      var dt = typeof SIM_DT !== 'undefined' ? SIM_DT : 1e-5;
      for (var i = 0; i < 100; i++) {
        S.sim.t += dt;
        if (typeof solveStep === 'function') solveStep(dt);
      }
      if (output && output.type === 'voltage' && S._nodeVoltages) {
        var ni = output.nodeIdx || 1;
        return S._nodeVoltages[ni] || 0;
      }
      // Default: read node 1 voltage
      return S._nodeVoltages ? (S._nodeVoltages[1] || 0) : 0;
    } catch (e) { return NaN; }
  }

  function generateViridis(n) {
    var pal = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      // Approximate viridis: dark purple → teal → yellow
      var r, g, b;
      if (t < 0.25) {
        r = 68 + t * 4 * (33 - 68); g = 1 + t * 4 * 65; b = 84 + t * 4 * (133 - 84);
      } else if (t < 0.5) {
        var u = (t - 0.25) * 4;
        r = 33 + u * (20 - 33); g = 65 + u * (130 - 65); b = 133 + u * (108 - 133);
      } else if (t < 0.75) {
        var u = (t - 0.5) * 4;
        r = 20 + u * (120 - 20); g = 130 + u * (190 - 130); b = 108 + u * (55 - 108);
      } else {
        var u = (t - 0.75) * 4;
        r = 120 + u * (253 - 120); g = 190 + u * (231 - 190); b = 55 + u * (37 - 55);
      }
      pal.push('rgb(' + Math.round(Math.max(0, Math.min(255, r))) + ',' + Math.round(Math.max(0, Math.min(255, g))) + ',' + Math.round(Math.max(0, Math.min(255, b))) + ')');
    }
    return pal;
  }

  function drawContourPlot(ctx, sr, x, y, w, h) {
    if (!sr || !sr.results) return;
    var PAL = generateViridis(64);
    var s1 = sr.param1.values.length, s2 = sr.param2.values.length;
    var cw = w / s1, ch = h / s2;
    var minV = sr.minVal, maxV = sr.maxVal;
    var range = maxV - minV;
    if (range < 1e-15) range = 1;

    // Cells
    for (var j = 0; j < s2; j++) {
      for (var i = 0; i < s1; i++) {
        var val = sr.results[j][i];
        if (isNaN(val)) {
          ctx.fillStyle = '#333';
        } else {
          var norm = (val - minV) / range;
          ctx.fillStyle = PAL[Math.floor(Math.max(0, Math.min(63, norm * 63)))];
        }
        ctx.fillRect(x + i * cw, y + (s2 - 1 - j) * ch, cw + 0.5, ch + 0.5);
      }
    }

    // Iso-lines (marching squares simplified)
    var levels = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.5;
    for (var lv = 1; lv < levels; lv++) {
      var threshold = minV + range * lv / levels;
      for (var j = 0; j < s2 - 1; j++) {
        for (var i = 0; i < s1 - 1; i++) {
          var v00 = sr.results[j][i], v10 = sr.results[j][i + 1];
          var v01 = sr.results[j + 1][i], v11 = sr.results[j + 1][i + 1];
          if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) continue;
          var ci = 0;
          if (v00 >= threshold) ci |= 1;
          if (v10 >= threshold) ci |= 2;
          if (v11 >= threshold) ci |= 4;
          if (v01 >= threshold) ci |= 8;
          if (ci === 0 || ci === 15) continue;
          // Simplified: draw line from interpolated edge crossings
          var cx = x + (i + 0.5) * cw, cy = y + (s2 - 1.5 - j) * ch;
          ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // Axes labels
    ctx.fillStyle = '#8899aa'; ctx.font = '9px "JetBrains Mono",monospace';
    // X axis (param1)
    ctx.textAlign = 'center';
    for (var i = 0; i < s1; i += Math.max(1, Math.floor(s1 / 5))) {
      ctx.fillText(fmtEng(sr.param1.values[i]), x + (i + 0.5) * cw, y + h + 12);
    }
    ctx.fillText(sr.param1.label, x + w / 2, y + h + 24);
    // Y axis (param2)
    ctx.textAlign = 'right';
    for (var j = 0; j < s2; j += Math.max(1, Math.floor(s2 / 5))) {
      ctx.fillText(fmtEng(sr.param2.values[j]), x - 4, y + (s2 - 0.5 - j) * ch + 3);
    }
    ctx.save(); ctx.translate(x - 30, y + h / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText(sr.param2.label, 0, 0); ctx.restore();

    // Color bar
    var bx = x + w + 12, bw = 14;
    for (var i = 0; i < 64; i++) {
      ctx.fillStyle = PAL[63 - i];
      ctx.fillRect(bx, y + h * i / 64, bw, h / 64 + 1);
    }
    ctx.fillStyle = '#8899aa'; ctx.textAlign = 'left'; ctx.font = '9px monospace';
    ctx.fillText(fmtEng(maxV), bx + bw + 4, y + 8);
    ctx.fillText(fmtEng(minV), bx + bw + 4, y + h);
    ctx.fillText(fmtEng((minV + maxV) / 2), bx + bw + 4, y + h / 2 + 3);

    // Min/Max markers
    var minI = 0, minJ = 0, maxI = 0, maxJ = 0;
    for (var j = 0; j < s2; j++) {
      for (var i = 0; i < s1; i++) {
        if (sr.results[j][i] <= minV) { minI = i; minJ = j; }
        if (sr.results[j][i] >= maxV) { maxI = i; maxJ = j; }
      }
    }
    ctx.fillStyle = '#4488ff'; ctx.font = '14px sans-serif';
    ctx.fillText('\u2605', x + (minI + 0.2) * cw, y + (s2 - 0.3 - minJ) * ch);
    ctx.fillStyle = '#ff4444';
    ctx.fillText('\u2605', x + (maxI + 0.2) * cw, y + (s2 - 0.3 - maxJ) * ch);
  }

  function fmtEng(v) {
    if (Math.abs(v) < 1e-12) return '0';
    var av = Math.abs(v);
    if (av >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (av >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    if (av >= 1) return v.toFixed(av >= 100 ? 0 : 1);
    if (av >= 1e-3) return (v * 1e3).toFixed(1) + 'm';
    if (av >= 1e-6) return (v * 1e6).toFixed(1) + '\u00B5';
    if (av >= 1e-9) return (v * 1e9).toFixed(1) + 'n';
    return (v * 1e12).toFixed(1) + 'p';
  }

  return { sweep: sweep, drawContourPlot: drawContourPlot, generateRange: generateRange, generateViridis: generateViridis };
})();

// ── VXA.TransferFunc ──
VXA.TransferFunc = (function() {
  'use strict';
  var SUPER = '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079';

  function toSuper(n) {
    return String(n).split('').map(function(d) { return SUPER[parseInt(d)] || d; }).join('');
  }

  function formatCoefficient(c) {
    var ac = Math.abs(c);
    if (ac < 1e-15) return '0';
    if (ac >= 1e6 || ac < 0.001) {
      var exp = Math.floor(Math.log10(ac));
      var man = ac / Math.pow(10, exp);
      return man.toFixed(2) + '\u00D710' + toSuper(exp);
    }
    return ac >= 100 ? ac.toFixed(0) : ac >= 1 ? ac.toFixed(2) : ac.toFixed(3);
  }

  function formatPolynomial(coeffs, variable) {
    if (!coeffs || coeffs.length === 0) return '0';
    var v = variable || 's';
    var terms = [];
    for (var i = coeffs.length - 1; i >= 0; i--) {
      var c = coeffs[i];
      if (Math.abs(c) < 1e-15) continue;
      var cs = formatCoefficient(c);
      var vs = '';
      if (i === 0) vs = '';
      else if (i === 1) vs = v;
      else vs = v + toSuper(i);

      if (Math.abs(Math.abs(c) - 1) < 1e-10 && i > 0) cs = '';
      var term = cs + vs;
      if (terms.length > 0 && c > 0) term = '+ ' + term;
      else if (c < 0 && terms.length > 0) term = '\u2212 ' + formatCoefficient(Math.abs(c)) + vs;
      else if (c < 0) term = '\u2212' + formatCoefficient(Math.abs(c)) + vs;
      terms.push(term);
    }
    return terms.join(' ') || '0';
  }

  function formatFactored(poles, zeros, dcGain) {
    var numParts = [], denParts = [];
    var usedZ = {}, usedP = {};

    for (var i = 0; i < zeros.length; i++) {
      if (usedZ[i]) continue;
      if (Math.abs(zeros[i].im) < 1e-10) {
        numParts.push(formatRealFactor(zeros[i].re));
      } else {
        for (var j = i + 1; j < zeros.length; j++) {
          if (!usedZ[j] && Math.abs(zeros[i].re - zeros[j].re) < 1e-6 && Math.abs(zeros[i].im + zeros[j].im) < 1e-6) {
            numParts.push(formatComplexPair(zeros[i]));
            usedZ[j] = true; break;
          }
        }
      }
      usedZ[i] = true;
    }
    for (var i = 0; i < poles.length; i++) {
      if (usedP[i]) continue;
      if (Math.abs(poles[i].im) < 1e-10) {
        denParts.push(formatRealFactor(poles[i].re));
      } else {
        for (var j = i + 1; j < poles.length; j++) {
          if (!usedP[j] && Math.abs(poles[i].re - poles[j].re) < 1e-6 && Math.abs(poles[i].im + poles[j].im) < 1e-6) {
            denParts.push(formatComplexPair(poles[i]));
            usedP[j] = true; break;
          }
        }
      }
      usedP[i] = true;
    }

    return {
      gain: formatCoefficient(dcGain),
      numerator: numParts.length > 0 ? numParts.join(' \u00B7 ') : '1',
      denominator: denParts.length > 0 ? denParts.join(' \u00B7 ') : '1'
    };
  }

  function formatRealFactor(sigma) {
    if (Math.abs(sigma) < 1e-10) return 's';
    var sign = sigma < 0 ? '+ ' : '\u2212 ';
    return '(s ' + sign + formatCoefficient(Math.abs(sigma)) + ')';
  }

  function formatComplexPair(root) {
    var wn = Math.sqrt(root.re * root.re + root.im * root.im);
    var zeta = -root.re / wn;
    return '(s\u00B2 + ' + formatCoefficient(2 * zeta * wn) + 's + ' + formatCoefficient(wn * wn) + ')';
  }

  function drawTransferFunction(ctx, pzResult, x, y, maxWidth) {
    if (!pzResult || !pzResult.numerCoeffs) return;
    ctx.font = '13px "Courier New",monospace';
    ctx.fillStyle = '#e0e0e0';
    var numStr = formatPolynomial(pzResult.numerCoeffs, 's');
    var denStr = formatPolynomial(pzResult.denomCoeffs, 's');
    var numW = ctx.measureText(numStr).width;
    var denW = ctx.measureText(denStr).width;
    var fracW = Math.max(numW, denW) + 20;
    var hsW = ctx.measureText('H(s) = ').width;

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('H(s) = ', x, y + 10);
    ctx.fillText(numStr, x + hsW + (fracW - numW) / 2, y - 4);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + hsW, y + 5); ctx.lineTo(x + hsW + fracW, y + 5); ctx.stroke();
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(denStr, x + hsW + (fracW - denW) / 2, y + 22);

    if (pzResult.poles && pzResult.zeros) {
      var fac = formatFactored(pzResult.poles, pzResult.zeros, pzResult.dcGain);
      ctx.font = '11px "Courier New",monospace'; ctx.fillStyle = '#999';
      ctx.fillText('= ' + fac.gain + ' \u00D7 ' + fac.numerator + ' / ' + fac.denominator, x, y + 48);
    }
  }

  return {
    formatPolynomial: formatPolynomial, formatCoefficient: formatCoefficient,
    formatFactored: formatFactored, formatRealFactor: formatRealFactor,
    formatComplexPair: formatComplexPair, drawTransferFunction: drawTransferFunction
  };
})();

// ── Tab Data + Draw Functions ──
var poleZeroData = null;
var contourSweepData = null;

function formatComplexNumber(c) {
  var re = c.re.toExponential(1);
  if (Math.abs(c.im) < 1e-10) return re;
  var sign = c.im >= 0 ? '+' : '-';
  return re + ' ' + sign + ' j' + Math.abs(c.im).toExponential(1);
}

// ── s-Plane Drawing ──
function drawSPlane(ctx, poles, zeros, x, y, w, h) {
  var cx = x + w / 2, cy = y + h / 2;
  var maxAbs = 1;
  var all = (poles || []).concat(zeros || []);
  for (var i = 0; i < all.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(all[i].re) * 1.3, Math.abs(all[i].im) * 1.3);
  }
  var sc = (Math.min(w, h) / 2 - 20) / maxAbs;

  // Background: stable (left) vs unstable (right)
  ctx.fillStyle = 'rgba(0,80,0,0.06)';
  ctx.fillRect(x, y, w / 2, h);
  ctx.fillStyle = 'rgba(80,0,0,0.06)';
  ctx.fillRect(x + w / 2, y, w / 2, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
  var gridStep = maxAbs / 3;
  for (var g = -3; g <= 3; g++) {
    var gx = cx + g * gridStep * sc;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    var gy = cy + g * gridStep * sc;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();

  ctx.font = '10px monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'left';
  ctx.fillText('Re', x + w - 18, cy - 5);
  ctx.fillText('j\u03C9', cx + 4, y + 12);

  // Poles: x marks
  for (var i = 0; i < (poles || []).length; i++) {
    var px = cx + poles[i].re * sc, py = cy - poles[i].im * sc;
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px - 5, py - 5); ctx.lineTo(px + 5, py + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 5, py - 5); ctx.lineTo(px - 5, py + 5); ctx.stroke();
  }

  // Zeros: circles
  for (var i = 0; i < (zeros || []).length; i++) {
    var zx = cx + zeros[i].re * sc, zy = cy - zeros[i].im * sc;
    ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(zx, zy, 5, 0, Math.PI * 2); ctx.stroke();
  }

  // Labels
  ctx.font = '8px monospace';
  for (var i = 0; i < (poles || []).length; i++) {
    var px = cx + poles[i].re * sc, py = cy - poles[i].im * sc;
    ctx.fillStyle = '#ff6666';
    ctx.fillText(formatComplexNumber(poles[i]), px + 8, py - 4);
  }
  for (var i = 0; i < (zeros || []).length; i++) {
    var zx = cx + zeros[i].re * sc, zy = cy - zeros[i].im * sc;
    ctx.fillStyle = '#6688ff';
    ctx.fillText(formatComplexNumber(zeros[i]), zx + 8, zy - 4);
  }
}

// ── Tab Draw Functions ──
function drawPoleZero() {
  var cvs = document.getElementById('PZC');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width + 'px'; cvs.style.height = r.height + 'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);

  if (!poleZeroData || poleZeroData.error) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText(poleZeroData ? poleZeroData.error : 'Click "Run" to analyze poles & zeros.', w / 2, h / 2);
    return;
  }

  var d = poleZeroData;
  // s-plane on left
  var sPlaneSize = Math.min(h - 80, w * 0.5 - 20);
  drawSPlane(c, d.poles, d.zeros, 10, 10, sPlaneSize, sPlaneSize);

  // Info panel on right
  var ix = sPlaneSize + 30, iy = 14;
  c.font = '12px "JetBrains Mono",monospace'; c.textAlign = 'left';
  c.fillStyle = d.isStable ? '#22cc44' : '#ff4444';
  c.fillText(d.isStable ? '\u2705 Stable' : '\u274C Unstable', ix, iy); iy += 18;
  c.fillStyle = '#aaa';
  c.fillText('DC Gain: ' + d.dcGainDB.toFixed(1) + ' dB', ix, iy); iy += 16;
  c.fillText('Fit Error: ' + d.fittingError.toFixed(1) + ' dB RMS', ix, iy); iy += 16;
  c.fillText('Order: N=' + d.numerOrder + ' / D=' + d.denomOrder, ix, iy); iy += 22;

  // Poles table
  c.fillStyle = '#ff6666'; c.fillText('Poles (\u00D7):', ix, iy); iy += 14;
  c.font = '10px monospace'; c.fillStyle = '#ccc';
  for (var i = 0; i < d.poles.length; i++) {
    var p = d.poles[i];
    var line = formatComplexNumber(p);
    if (Math.abs(p.im) > 0.01) {
      var wn = Math.sqrt(p.re * p.re + p.im * p.im);
      line += '  f=' + (wn / (2 * Math.PI)).toExponential(1) + 'Hz';
    }
    c.fillText(line, ix + 6, iy); iy += 13;
    if (iy > h - 80) break;
  }
  iy += 8;
  // Zeros table
  c.fillStyle = '#6688ff'; c.font = '12px "JetBrains Mono",monospace';
  c.fillText('Zeros (\u25CB):', ix, iy); iy += 14;
  c.font = '10px monospace'; c.fillStyle = '#ccc';
  for (var i = 0; i < d.zeros.length; i++) {
    c.fillText(formatComplexNumber(d.zeros[i]), ix + 6, iy); iy += 13;
    if (iy > h - 80) break;
  }

  // Transfer function at bottom
  iy = Math.max(iy + 10, h - 65);
  VXA.TransferFunc.drawTransferFunction(c, d, 10, iy, w - 20);
}

function runPoleZero() {
  if (!S.parts.length) return;
  poleZeroData = VXA.PoleZero.analyze(1, 2);
  var ov = document.getElementById('ov-polezero');
  if (ov) ov.style.display = 'none';
  switchTab('polezero');
}

function drawContour2D() {
  var cvs = document.getElementById('CONTOUR2D');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width + 'px'; cvs.style.height = r.height + 'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);

  if (!contourSweepData || contourSweepData.error) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText(contourSweepData ? contourSweepData.error : 'Select two parameters and click "Run".', w / 2, h / 2);
    return;
  }

  VXA.ContourSweep.drawContourPlot(c, contourSweepData, 50, 10, w - 110, h - 50);
}

function runContour2D() {
  if (S.sel.length < 1) return;
  var part1 = S.parts.find(function(p) { return p.id === S.sel[0]; });
  if (!part1) return;
  // Find a second passive
  var part2 = null;
  for (var i = 0; i < S.parts.length; i++) {
    if (S.parts[i].id !== part1.id && ['resistor', 'capacitor', 'inductor'].indexOf(S.parts[i].type) >= 0) {
      part2 = S.parts[i]; break;
    }
  }
  if (!part2) { contourSweepData = { error: 'Need 2+ passive components.' }; switchTab('contour2d'); return; }

  var v1 = part1.val || 1000, v2 = part2.val || 1000;
  contourSweepData = VXA.ContourSweep.sweep({
    param1: { partId: part1.id, min: v1 * 0.1, max: v1 * 10, steps: 15, scale: 'log' },
    param2: { partId: part2.id, min: v2 * 0.1, max: v2 * 10, steps: 15, scale: 'log' },
    output: { type: 'voltage', nodeIdx: 1 }
  });
  contourSweepData.param1.label = part1.name;
  contourSweepData.param2.label = part2.name;
  var ov = document.getElementById('ov-contour2d');
  if (ov) ov.style.display = 'none';
  switchTab('contour2d');
}

function drawTransferFunc() {
  var cvs = document.getElementById('TFUNC');
  if (!cvs) return;
  var r = cvs.parentElement.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  cvs.width = r.width * DPR; cvs.height = r.height * DPR;
  cvs.style.width = r.width + 'px'; cvs.style.height = r.height + 'px';
  var c = cvs.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  var w = r.width, h = r.height;
  c.fillStyle = '#080c14'; c.fillRect(0, 0, w, h);

  if (!poleZeroData || poleZeroData.error || !poleZeroData.numerCoeffs) {
    c.fillStyle = '#5a6a7a'; c.font = '13px Outfit'; c.textAlign = 'center';
    c.fillText('Run Pole-Zero analysis first.', w / 2, h / 2);
    return;
  }

  // H(s) display
  VXA.TransferFunc.drawTransferFunction(c, poleZeroData, 20, 20, w - 40);

  // Bode overlay: measured vs fitted
  if (poleZeroData.acData && poleZeroData.acData.length > 2) {
    var mx = 60, my = 90, pw = w - mx - 20, ph = h - my - 30;
    // Axes
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.5;
    for (var gi = 0; gi <= 5; gi++) {
      var gy = my + ph * gi / 5;
      c.beginPath(); c.moveTo(mx, gy); c.lineTo(mx + pw, gy); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(mx, my + ph); c.lineTo(mx + pw, my + ph); ctx.stroke && c.stroke();
    c.beginPath(); c.moveTo(mx, my); c.lineTo(mx, my + ph); c.stroke();

    var acD = poleZeroData.acData;
    var fMin = Math.log10(acD[0].freq), fMax = Math.log10(acD[acD.length - 1].freq);
    var gMin = -40, gMax = 20;
    for (var i = 0; i < acD.length; i++) {
      if (acD[i].gain_dB < gMin) gMin = acD[i].gain_dB - 5;
      if (acD[i].gain_dB > gMax) gMax = acD[i].gain_dB + 5;
    }

    // Measured (blue solid)
    c.strokeStyle = '#3b82f6'; c.lineWidth = 2;
    c.beginPath();
    for (var i = 0; i < acD.length; i++) {
      var fx = mx + (Math.log10(acD[i].freq) - fMin) / (fMax - fMin) * pw;
      var fy = my + (1 - (acD[i].gain_dB - gMin) / (gMax - gMin)) * ph;
      if (i === 0) c.moveTo(fx, fy); else c.lineTo(fx, fy);
    }
    c.stroke();

    // Fitted (red dashed)
    c.strokeStyle = '#ff4444'; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.beginPath();
    var numC = poleZeroData.numerCoeffs, denC = poleZeroData.denomCoeffs;
    for (var i = 0; i < acD.length; i++) {
      var w2 = acD[i].freq * 2 * Math.PI;
      var Nr = 0, Ni = 0, Dr = 0, Di = 0;
      for (var p = 0; p < numC.length; p++) {
        var wp = Math.pow(w2, p), ang = p * Math.PI / 2;
        Nr += numC[p] * wp * Math.cos(ang); Ni += numC[p] * wp * Math.sin(ang);
      }
      for (var p = 0; p < denC.length; p++) {
        var wp = Math.pow(w2, p), ang = p * Math.PI / 2;
        Dr += denC[p] * wp * Math.cos(ang); Di += denC[p] * wp * Math.sin(ang);
      }
      var dMag = Dr * Dr + Di * Di;
      var fMag = dMag > 1e-30 ? Math.sqrt((Nr * Dr + Ni * Di) * (Nr * Dr + Ni * Di) + (Ni * Dr - Nr * Di) * (Ni * Dr - Nr * Di)) / Math.sqrt(dMag) : 1e-15;
      var fDB = 20 * Math.log10(Math.max(fMag, 1e-15));
      var fx = mx + (Math.log10(acD[i].freq) - fMin) / (fMax - fMin) * pw;
      var fy = my + (1 - (fDB - gMin) / (gMax - gMin)) * ph;
      if (i === 0) c.moveTo(fx, fy); else c.lineTo(fx, fy);
    }
    c.stroke(); c.setLineDash([]);

    // Legend
    c.font = '10px monospace';
    c.fillStyle = '#3b82f6'; c.fillText('\u2500\u2500 Measured', mx + 10, my + 14);
    c.fillStyle = '#ff4444'; c.fillText('- - Fitted H(s)', mx + 10, my + 28);

    // Axis labels
    c.fillStyle = '#666'; c.font = '9px monospace'; c.textAlign = 'center';
    c.fillText('Frequency (Hz)', mx + pw / 2, my + ph + 18);
    c.textAlign = 'right';
    c.fillText(gMax.toFixed(0) + ' dB', mx - 4, my + 8);
    c.fillText(gMin.toFixed(0) + ' dB', mx - 4, my + ph);
  }
}

function runTransferFunc() {
  // Reuses pole-zero data
  if (!poleZeroData) runPoleZero();
  var ov = document.getElementById('ov-transferfunc');
  if (ov) ov.style.display = 'none';
  switchTab('transferfunc');
}
