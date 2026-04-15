// ──────── SPRINT 39: .MEAS MEASUREMENT (v9.0) ────────
// SPICE-compatible waveform measurements (AVG/MAX/MIN/PP/RMS/INTEG/FIND/WHEN).

VXA.Measure = (function() {
  'use strict';

  function pv(s) {
    if (typeof VXA.SpiceParser !== 'undefined') return VXA.SpiceParser.parseSpiceNumber(String(s));
    return parseFloat(s);
  }

  function parseMeasLine(line) {
    var tokens = String(line).replace(/^\.MEAS(URE)?\s+/i, '').trim().split(/\s+/);
    var result = {
      analysisType: (tokens[0] || 'TRAN').toUpperCase(),
      measName: tokens[1] || 'meas1',
      measType: (tokens[2] || 'AVG').toUpperCase(),
      expression: '',
      from: null, to: null, at: null,
      trigVal: null, crossNum: null, riseNum: null, fallNum: null
    };

    var rest = tokens.slice(3);
    function readKv(name) {
      for (var i = 0; i < rest.length; i++) {
        var kv = rest[i].split('=');
        if (kv.length === 2 && kv[0].toUpperCase() === name) return kv[1];
      }
      return null;
    }

    if (/^(AVG|MAX|MIN|PP|RMS|INTEG)$/.test(result.measType)) {
      result.expression = rest[0] || 'V(out)';
      var f = readKv('FROM'); if (f !== null) result.from = pv(f);
      var to = readKv('TO'); if (to !== null) result.to = pv(to);
    } else if (result.measType === 'FIND') {
      result.expression = rest[0] || 'V(out)';
      var at = readKv('AT'); if (at !== null) result.at = pv(at);
    } else if (result.measType === 'WHEN') {
      var whenExpr = rest[0] || 'V(out)=0';
      var eq = whenExpr.indexOf('=');
      if (eq >= 0) {
        result.expression = whenExpr.substring(0, eq);
        result.trigVal = parseFloat(whenExpr.substring(eq + 1));
      }
      var cr = readKv('CROSS'); if (cr !== null) result.crossNum = parseInt(cr, 10);
      var ri = readKv('RISE');  if (ri !== null) result.riseNum = parseInt(ri, 10);
      var fa = readKv('FALL');  if (fa !== null) result.fallNum = parseInt(fa, 10);
    }
    return result;
  }

  function execute(measConfig, waveformData) {
    var times = waveformData ? waveformData.times : null;
    var values = waveformData ? waveformData.values : null;
    if (!times || !values || times.length === 0 || times.length !== values.length) {
      return { name: measConfig.measName, value: NaN, error: 'No data' };
    }

    var startIdx = 0, endIdx = times.length - 1;
    if (measConfig.from !== null) {
      while (startIdx < times.length && times[startIdx] < measConfig.from) startIdx++;
    }
    if (measConfig.to !== null) {
      while (endIdx > 0 && times[endIdx] > measConfig.to) endIdx--;
    }
    if (startIdx > endIdx) startIdx = endIdx;

    var sV = values.slice(startIdx, endIdx + 1);
    var sT = times.slice(startIdx, endIdx + 1);
    var out = { name: measConfig.measName, value: NaN };
    if (sV.length === 0) return out;

    switch (measConfig.measType) {
      case 'AVG':
        var sum = 0; for (var a = 0; a < sV.length; a++) sum += sV[a];
        out.value = sum / sV.length; break;
      case 'MAX':
        out.value = Math.max.apply(null, sV); break;
      case 'MIN':
        out.value = Math.min.apply(null, sV); break;
      case 'PP':
        out.value = Math.max.apply(null, sV) - Math.min.apply(null, sV); break;
      case 'RMS':
        var ss = 0; for (var b = 0; b < sV.length; b++) ss += sV[b] * sV[b];
        out.value = Math.sqrt(ss / sV.length); break;
      case 'INTEG':
        var integ = 0;
        for (var c = 1; c < sV.length; c++) integ += (sV[c] + sV[c-1]) / 2 * (sT[c] - sT[c-1]);
        out.value = integ; break;
      case 'FIND':
        if (measConfig.at !== null) {
          var closest = 0, minD = Infinity;
          for (var d = 0; d < times.length; d++) {
            var diff = Math.abs(times[d] - measConfig.at);
            if (diff < minD) { minD = diff; closest = d; }
          }
          out.value = values[closest];
        }
        break;
      case 'WHEN':
        if (measConfig.trigVal !== null) {
          var crossN = 0, riseN = 0, fallN = 0;
          for (var i = 1; i < values.length; i++) {
            var pp = values[i-1], cc = values[i];
            var crossUp = (pp < measConfig.trigVal && cc >= measConfig.trigVal);
            var crossDn = (pp > measConfig.trigVal && cc <= measConfig.trigVal);
            if (crossUp || crossDn) {
              crossN++;
              if (crossUp) riseN++; else fallN++;
              var okC = !measConfig.crossNum || crossN === measConfig.crossNum;
              var okR = !measConfig.riseNum  || riseN  === measConfig.riseNum;
              var okF = !measConfig.fallNum  || fallN  === measConfig.fallNum;
              if (okC && okR && okF) {
                var frac = (measConfig.trigVal - pp) / (cc - pp);
                out.value = times[i-1] + frac * (times[i] - times[i-1]);
                break;
              }
            }
          }
        }
        break;
    }
    return out;
  }

  return { parseMeasLine: parseMeasLine, execute: execute };
})();
