VXA.SensitivityAnalysis = (function() {
  function getOutput() {
    var probe = S.parts.find(function(p) { return p.type === 'probe'; });
    if (probe) return probe._v || 0;
    var lastR = S.parts.filter(function(p) { return p.type === 'resistor'; });
    return lastR.length ? (lastR[lastR.length - 1]._v || 0) : 0;
  }
  function run() {
    buildCircuitFromCanvas();
    S.sim.t = 0; S._nodeVoltages = null;
    for (var i = 0; i < 100; i++) { S.sim.t += 1e-5; try { solveStep(1e-5); } catch(e) { break; } }
    var nominal = getOutput();
    var results = [];
    var parts = S.parts.filter(function(p) { return ['resistor', 'capacitor', 'inductor', 'vdc'].indexOf(p.type) >= 0 && !p.damaged; });
    parts.forEach(function(p) {
      var orig = p.val; var delta = orig * 0.01;
      p.val = orig + delta;
      buildCircuitFromCanvas(); S.sim.t = 0; S._nodeVoltages = null;
      for (var i = 0; i < 100; i++) { S.sim.t += 1e-5; try { solveStep(1e-5); } catch(e) { break; } }
      var val1 = getOutput();
      p.val = orig;
      var sens = Math.abs((val1 - nominal) / (Math.max(Math.abs(nominal), 1e-12) * 0.01));
      results.push({ id: p.id, name: p.name, type: p.type, val: orig, sens: sens, raw: (val1 - nominal) / (Math.max(Math.abs(nominal), 1e-12) * 0.01) });
    });
    buildCircuitFromCanvas();
    results.sort(function(a, b) { return b.sens - a.sens; });
    return { nominal: nominal, results: results };
  }
  return { run: run };
})();
// 8.7: MONTE CARLO İSTATİSTİKLER
function computeMonteCarloStats(values) {
  var n = values.length; if (n === 0) return null;
  var mean = 0; for (var i = 0; i < n; i++) mean += values[i]; mean /= n;
  var variance = 0; for (var i = 0; i < n; i++) variance += (values[i] - mean) * (values[i] - mean); variance /= Math.max(n - 1, 1);
  var stddev = Math.sqrt(variance);
  var min = values[0], max = values[0];
  for (var i = 1; i < n; i++) { if (values[i] < min) min = values[i]; if (values[i] > max) max = values[i]; }
  var bins = 20, binW = (max - min) / bins || 1, hist = [];
  for (var i = 0; i < bins; i++) hist[i] = 0;
  for (var i = 0; i < n; i++) { var idx = Math.min(bins - 1, Math.floor((values[i] - min) / binW)); hist[idx]++; }
  return { mean: mean, stddev: stddev, min: min, max: max, histogram: hist, binWidth: binW, binStart: min, n: n };
}
