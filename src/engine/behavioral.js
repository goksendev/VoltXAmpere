// ──────── SPRINT 47: BEHAVIORAL SOURCE + LAPLACE (v9.0) ────────
// B element: arbitrary-expression voltage/current source.
// Supports V(node), I(src), time, pi, e, if/limit/uramp/u/table,
// Math.* functions, and Laplace(V(x), H(s)) for 1st/2nd order IIR filters.
// Evaluator is eval-free (new Function + whitelist regex).

VXA.Behavioral = (function() {
  'use strict';

  var MAX_EXPR_LEN = 1000;

  function createBehavioralSource(expression, outputType) {
    var expr = String(expression || '').replace(/^\{|\}$/g, '').trim();
    return {
      expression: expr,
      outputType: (outputType === 'I' ? 'I' : 'V'),
      _prevIntegrals: {},
      _prevDerivatives: {},
      _laplace: null
    };
  }

  // ── Expression preprocessing ────────────────────

  function replaceVI(expr, nodeVoltages, branchCurrents, nodeNameMap) {
    // V(name) → nodeVoltages[idx]. We substitute WITHOUT wrapping parens so
    // downstream regexes (if/limit/uramp/u) that use [^()]+ keep working.
    // A leading ' ' protects against '-V(1)' becoming '--3'.
    expr = expr.replace(/V\s*\(\s*([A-Za-z0-9_]+)\s*\)/gi, function(_m, name) {
      var idx = resolveNodeName(name, nodeNameMap);
      var v = (nodeVoltages && idx >= 0) ? (nodeVoltages[idx] || 0) : 0;
      return ' ' + (+v) + ' ';
    });
    // I(Vname) → branchCurrents[idx]
    expr = expr.replace(/I\s*\(\s*([A-Za-z0-9_]+)\s*\)/gi, function(_m, name) {
      var idx = resolveBranchName(name);
      var v = (branchCurrents && idx >= 0) ? (branchCurrents[idx] || 0) : 0;
      return ' ' + (+v) + ' ';
    });
    return expr;
  }

  function preprocessFunctions(expr) {
    // Strategy: emit sentinels (\u0001M_FN\u0001) instead of Math.fn(...), run
    // user-level rewrites (if/limit/uramp/u) WITHOUT competing with Math.*
    // regexes, then finally convert sentinels → Math.fn. This avoids the
    // Math.Math.max(...) explosion when limit/uramp produce Math.max.
    var SENT = '\u0001';

    // 1) Math function names → sentinel tokens first (protects user expressions)
    var mathFns = ['sin','cos','tan','asin','acos','atan2','atan','exp','log10','log',
                   'sqrt','abs','pow','floor','ceil','round','min','max'];
    for (var i = 0; i < mathFns.length; i++) {
      var re = new RegExp('\\b' + mathFns[i] + '\\s*\\(', 'g');
      expr = expr.replace(re, SENT + mathFns[i] + SENT + '(');
    }

    // 2) if(cond, a, b) → ((cond)?(a):(b))
    var guard = 0;
    while (/if\s*\(/i.test(expr) && guard < 10) {
      expr = expr.replace(/if\s*\(([^,()]+(?:\([^()]*\)[^,()]*)*),\s*([^,()]+(?:\([^()]*\)[^,()]*)*),\s*([^()]+(?:\([^()]*\)[^()]*)*)\)/gi,
        function(_m, c, t, f) { return '((' + c + ')?(' + t + '):(' + f + '))'; });
      guard++;
    }
    // 3) limit(val, min, max) — emitted Math calls use sentinels to stay inert
    expr = expr.replace(/limit\s*\(([^,()]+),\s*([^,()]+),\s*([^()]+)\)/gi,
      function(_m, v, mn, mx) {
        return SENT + 'max' + SENT + '(' + mn + ',' + SENT + 'min' + SENT + '(' + mx + ',' + v + '))';
      });
    // 4) uramp(x) → Math.max(0, x)
    expr = expr.replace(/\buramp\s*\(([^()]+)\)/gi,
      function(_m, x) { return SENT + 'max' + SENT + '(0,(' + x + '))'; });
    // 5) u(x) → step (must be AFTER uramp; \bu\b protects)
    expr = expr.replace(/\bu\s*\(([^()]+)\)/gi, '((($1))>0?1:0)');

    // 6) Constants (done before sentinel→Math so 'e' in 'exp' never leaks)
    expr = expr.replace(/\bpi\b/gi, '(' + Math.PI + ')');
    expr = expr.replace(/\be\b/g, '(' + Math.E + ')');

    // 7) Convert sentinels → Math.fn
    expr = expr.replace(new RegExp(SENT + '([a-z0-9]+)' + SENT, 'gi'), 'Math.$1');

    return expr;
  }

  function safeEvaluate(expr) {
    if (expr.length > MAX_EXPR_LEN * 2) return 0;
    // Whitelist: numbers, operators, parens, ternary, comparison, Math.*, whitespace
    var stripped = expr.replace(/Math\.[a-z0-9]+/gi, '');
    if (!/^[0-9.eE+\-*/()<>=!&|?:, \t]*$/.test(stripped)) return 0;
    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function('return (' + expr + ');');
      var r = fn();
      return (typeof r === 'number' && isFinite(r)) ? r : 0;
    } catch (e) { return 0; }
  }

  function resolveNodeName(name, nodeNameMap) {
    var n = parseInt(name, 10);
    if (!isNaN(n)) return n;
    if (nodeNameMap) {
      if (nodeNameMap[name] !== undefined) return nodeNameMap[name];
      if (nodeNameMap[name.toUpperCase()] !== undefined) return nodeNameMap[name.toUpperCase()];
    }
    return -1;
  }

  function resolveBranchName(name) {
    // V1 → 0, V2 → 1 — simplistic, matches main-engine branch ordering.
    var m = String(name).match(/(\d+)$/);
    return m ? (parseInt(m[1], 10) - 1) : -1;
  }

  function evaluate(bSrc, nodeVoltages, branchCurrents, time, dt, nodeNameMap) {
    if (!bSrc || !bSrc.expression) return 0;
    var e = bSrc.expression;
    if (e.length > MAX_EXPR_LEN) return 0;
    // Laplace shortcut — handled by filter, not safe eval.
    if (/^\s*Laplace\s*\(/i.test(e)) {
      if (!bSrc._laplace) {
        var spec = parseLaplace(e);
        if (!spec) return 0;
        bSrc._laplace = { spec: spec, filter: null };
      }
      var input = 0;
      if (bSrc._laplace.spec.inputNode) {
        var idx = resolveNodeName(bSrc._laplace.spec.inputNode, nodeNameMap);
        input = (idx >= 0) ? (nodeVoltages[idx] || 0) : 0;
      }
      if (!bSrc._laplace.filter) {
        var sr = dt > 0 ? (1 / dt) : 1e5;
        bSrc._laplace.filter = createLaplaceFilter(bSrc._laplace.spec, sr);
      }
      return processLaplaceFilter(bSrc._laplace.filter, input);
    }
    e = replaceVI(e, nodeVoltages, branchCurrents, nodeNameMap);
    e = e.replace(/\btime\b/gi, '(' + (+time || 0) + ')');
    e = preprocessFunctions(e);
    return safeEvaluate(e);
  }

  function stamp(matrix, rhs, bSrc, n1, n2, bi, nodeV, branchCurrents, time, dt, nodeNameMap, Sp) {
    var value = evaluate(bSrc, nodeV, branchCurrents, time, dt, nodeNameMap);
    if (bSrc.outputType === 'V') {
      if (n1 > 0) { Sp.stamp(matrix, n1 - 1, bi, 1); Sp.stamp(matrix, bi, n1 - 1, 1); }
      if (n2 > 0) { Sp.stamp(matrix, n2 - 1, bi, -1); Sp.stamp(matrix, bi, n2 - 1, -1); }
      rhs[bi] = value;
    } else {
      if (n1 > 0) rhs[n1 - 1] -= value;
      if (n2 > 0) rhs[n2 - 1] += value;
    }
    return value;
  }

  // ── Laplace parsing ────────────────────────────

  function parseLaplace(expr) {
    var m = String(expr).match(/Laplace\s*\(\s*V\s*\(\s*([A-Za-z0-9_]+)\s*\)\s*,\s*([\s\S]+)\)\s*$/i);
    if (!m) return null;
    var inputNode = m[1];
    var tf = m[2].trim();
    var parts = splitFraction(tf);
    var num = parsePolynomial(parts.num);
    var den = parsePolynomial(parts.den);
    return { inputNode: inputNode, transferFn: tf, numCoeffs: num, denCoeffs: den };
  }

  function splitFraction(expr) {
    var depth = 0;
    var slashPos = -1;
    for (var i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      else if (expr[i] === '/' && depth === 0) { slashPos = i; break; }
    }
    if (slashPos < 0) return { num: expr.trim(), den: '1' };
    var num = expr.substring(0, slashPos).trim();
    var den = expr.substring(slashPos + 1).trim();
    num = num.replace(/^\(|\)$/g, '').trim();
    den = den.replace(/^\(|\)$/g, '').trim();
    return { num: num, den: den };
  }

  function parsePolynomial(polyStr) {
    var s = String(polyStr).replace(/\s+/g, '');
    if (s === '') return [0];
    if (!/s/i.test(s)) { var n = parseFloat(s); return [isFinite(n) ? n : 0]; }
    // Split into signed terms at top-level +/- (outside parens)
    var terms = [];
    var depth = 0, start = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if ((ch === '+' || ch === '-') && depth === 0 && i > 0) {
        terms.push(s.substring(start, i));
        start = i;
      }
    }
    terms.push(s.substring(start));
    var coeffMap = {};
    var maxOrder = 0;
    for (var k = 0; k < terms.length; k++) {
      var t = terms[k].trim();
      if (!t) continue;
      var order = 0, coeff = 1;
      if (/s\^(\d+)/i.test(t)) { order = parseInt(t.match(/s\^(\d+)/i)[1], 10); t = t.replace(/s\^\d+/i, ''); }
      else if (/s/i.test(t))   { order = 1; t = t.replace(/s/i, ''); }
      t = t.replace(/\*/g, '').trim();
      if (t === '' || t === '+') coeff = 1;
      else if (t === '-')       coeff = -1;
      else                      coeff = parseFloat(t) || 0;
      coeffMap[order] = (coeffMap[order] || 0) + coeff;
      if (order > maxOrder) maxOrder = order;
    }
    var result = [];
    for (var i2 = 0; i2 <= maxOrder; i2++) result.push(coeffMap[i2] || 0);
    return result;
  }

  function parseTransferFunction(tfStr) {
    var parts = splitFraction(tfStr);
    return { num: parsePolynomial(parts.num), den: parsePolynomial(parts.den) };
  }

  // ── Bilinear transform (s → z) ─────────────────

  function createLaplaceFilter(spec, sampleRate) {
    var num = spec.numCoeffs || [0];
    var den = spec.denCoeffs || [1];
    var order = Math.max(num.length, den.length) - 1;
    var T = 1 / (sampleRate || 1e5);
    if (order <= 0) {
      var gain = (num[0] || 1) / (den[0] || 1);
      return { type: 'gain', gain: gain, xHistory: [], yHistory: [] };
    }
    if (order === 1) {
      var a0 = num[0] || 0, a1 = num[1] || 0;
      var b0 = den[0] || 0, b1 = den[1] || 0;
      var A0 = a0 * T + 2 * a1;
      var A1 = a0 * T - 2 * a1;
      var B0 = b0 * T + 2 * b1;
      var B1 = b0 * T - 2 * b1;
      if (Math.abs(B0) < 1e-30) B0 = 1e-30;
      return {
        type: 'iir1',
        b: [A0 / B0, A1 / B0],
        a: [1, B1 / B0],
        xHistory: [0], yHistory: [0]
      };
    }
    if (order === 2) {
      var T2 = T * T;
      var a0b = num[0] || 0, a1b = num[1] || 0, a2b = num[2] || 0;
      var b0b = den[0] || 0, b1b = den[1] || 0, b2b = den[2] || 0;
      var A0b = a0b * T2 + 2 * a1b * T + 4 * a2b;
      var A1b = 2 * a0b * T2 - 8 * a2b;
      var A2b = a0b * T2 - 2 * a1b * T + 4 * a2b;
      var B0b = b0b * T2 + 2 * b1b * T + 4 * b2b;
      var B1b = 2 * b0b * T2 - 8 * b2b;
      var B2b = b0b * T2 - 2 * b1b * T + 4 * b2b;
      if (Math.abs(B0b) < 1e-30) B0b = 1e-30;
      return {
        type: 'iir2',
        b: [A0b / B0b, A1b / B0b, A2b / B0b],
        a: [1, B1b / B0b, B2b / B0b],
        xHistory: [0, 0], yHistory: [0, 0]
      };
    }
    // Fallback for order > 2
    return { type: 'gain', gain: (num[0] || 1) / (den[0] || 1), xHistory: [], yHistory: [] };
  }

  function processLaplaceFilter(f, input) {
    if (!f) return input;
    if (f.type === 'gain') return input * f.gain;
    if (f.type === 'iir1') {
      var y = f.b[0] * input + f.b[1] * f.xHistory[0] - f.a[1] * f.yHistory[0];
      f.xHistory[0] = input;
      f.yHistory[0] = y;
      return y;
    }
    if (f.type === 'iir2') {
      var y2 = f.b[0] * input + f.b[1] * f.xHistory[0] + f.b[2] * f.xHistory[1]
             - f.a[1] * f.yHistory[0] - f.a[2] * f.yHistory[1];
      f.xHistory[1] = f.xHistory[0]; f.xHistory[0] = input;
      f.yHistory[1] = f.yHistory[0]; f.yHistory[0] = y2;
      return y2;
    }
    return input;
  }

  return {
    create: createBehavioralSource,
    evaluate: evaluate,
    stamp: stamp,
    parseLaplace: parseLaplace,
    parseTransferFunction: parseTransferFunction,
    parsePolynomial: parsePolynomial,
    splitFraction: splitFraction,
    createLaplaceFilter: createLaplaceFilter,
    processLaplaceFilter: processLaplaceFilter
  };
})();
