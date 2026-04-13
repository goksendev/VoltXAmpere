VXA.Benchmark = (function() {
  function measureSimStep(count) {
    if (!SIM || SIM.N <= 1) return { avg: 0, max: 0 };
    var times = [];
    for (var i = 0; i < (count || 50); i++) {
      var start = performance.now();
      try { solveStep(1e-5); } catch(e) { break; }
      times.push(performance.now() - start);
    }
    if (times.length === 0) return { avg: 0, max: 0 };
    var sum = 0; for (var i = 0; i < times.length; i++) sum += times[i];
    return { avg: Math.round(sum / times.length * 100) / 100, max: Math.round(Math.max.apply(null, times) * 100) / 100 };
  }
  function run() {
    var results = {};
    results.parts = S.parts.length;
    results.wires = S.wires.length;
    results.nodes = SIM ? SIM.N : 0;
    buildCircuitFromCanvas();
    results.simStep = measureSimStep(50);
    var t0 = performance.now();
    buildCircuitFromCanvas();
    results.buildTime = Math.round((performance.now() - t0) * 100) / 100;
    return results;
  }
  function report(r) {
    console.log('=== VoltXAmpere v7.1 Benchmark ===');
    console.log('Parts: ' + r.parts + ', Wires: ' + r.wires + ', Nodes: ' + r.nodes);
    console.log('Build circuit: ' + r.buildTime + 'ms');
    console.log('Sim step: ' + r.simStep.avg + 'ms avg, ' + r.simStep.max + 'ms max');
    console.log('==================================');
  }
  return { run: run, report: report };
})();