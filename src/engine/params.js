// ──────── SPRINT 39: .PARAM SYSTEM (v9.0) ────────
// SPICE-compatible parameter store + safe expression evaluator.
// No eval() — Function() with strict whitelist + length cap.

VXA.Params = (function() {
  'use strict';

  var params = {};

  function define(name, value) {
    params[String(name).toUpperCase()] = value;
  }

  function get(name) {
    return params[String(name).toUpperCase()];
  }

  function getAll() {
    var out = {}; for (var k in params) out[k] = params[k]; return out;
  }

  function clear() { params = {}; }
  function remove(name) { delete params[String(name).toUpperCase()]; }

  // Safe character set: digits, dot, e/E, +-*/(), space, comma, letters (for Math + params)
  var SAFE_RE = /^[0-9.eE+\-*/(), \tA-Z_]+$/;

  function evaluateExpression(expr) {
    if (typeof expr !== 'string') return Number(expr);
    var src = expr.toUpperCase().trim();
    if (src.length === 0 || src.length > 500) return NaN;

    // Substitute parameters (whole-word match)
    for (var key in params) {
      var v = params[key];
      // Recursive resolve if value itself is an expression
      if (typeof v === 'string' && v.charAt(0) === '{') {
        v = evaluateExpression(v.replace(/^\{|\}$/g, ''));
      }
      var re = new RegExp('\\b' + key + '\\b', 'g');
      src = src.replace(re, '(' + Number(v) + ')');
    }

    // Constants
    src = src.replace(/\bPI\b/g, '(' + Math.PI + ')');
    src = src.replace(/\bE\b/g, '(' + Math.E + ')');

    // Allowed math functions → __M.fn
    var FUNCS = ['SQRT','SIN','COS','TAN','EXP','LOG','LOG10','ABS','POW',
                 'ASIN','ACOS','ATAN','ATAN2','MIN','MAX','FLOOR','CEIL','ROUND'];
    FUNCS.forEach(function(f) {
      src = src.replace(new RegExp('\\b' + f + '\\b', 'g'), '__M.' + f.toLowerCase());
    });

    // Whitelist check: only digits/operators/parentheses/__M.x.y allowed
    var stripped = src.replace(/__M\.[a-z0-9]+/g, '');
    if (!/^[0-9.eE+\-*/(), \t]*$/.test(stripped)) {
      return NaN;
    }

    try {
      // eslint-disable-next-line no-new-func
      var fn = new Function('__M', 'return (' + src + ');');
      var r = fn(Math);
      return (typeof r === 'number' && isFinite(r)) ? r : NaN;
    } catch (e) {
      return NaN;
    }
  }

  function resolve(value) {
    if (typeof value !== 'string') return value;
    var m = String(value).match(/^\{(.+)\}$/);
    if (!m) {
      // Bare param name? (no braces) — try direct lookup
      var key = value.toUpperCase();
      if (params.hasOwnProperty(key)) {
        var v = params[key];
        return (typeof v === 'string') ? evaluateExpression(v.replace(/^\{|\}$/g, '')) : v;
      }
      return value;
    }
    return evaluateExpression(m[1]);
  }

  function parseParamLine(line) {
    var content = String(line).replace(/^\.PARAM\s+/i, '').trim();
    // Match: NAME = {expr}  OR  NAME = number(suffix)
    var re = /(\w+)\s*=\s*(\{[^}]+\}|[\d.eE+\-]+\w*)/g;
    var match, count = 0;
    while ((match = re.exec(content)) !== null) {
      var name = match[1];
      var val = match[2];
      if (val.charAt(0) === '{') {
        define(name, val); // expression — resolved on demand
      } else {
        var n = (typeof VXA.SpiceParser !== 'undefined') ?
          VXA.SpiceParser.parseSpiceNumber(val) : parseFloat(val);
        define(name, n);
      }
      count++;
    }
    return count;
  }

  return {
    define: define,
    get: get,
    getAll: getAll,
    clear: clear,
    remove: remove,
    resolve: resolve,
    evaluate: evaluateExpression,
    parseParamLine: parseParamLine
  };
})();
