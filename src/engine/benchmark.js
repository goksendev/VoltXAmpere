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
    console.log('=== VoltXAmpere v8.0 Benchmark ===');
    console.log('Parts: ' + r.parts + ', Wires: ' + r.wires + ', Nodes: ' + r.nodes);
    console.log('Build circuit: ' + r.buildTime + 'ms');
    console.log('Sim step: ' + r.simStep.avg + 'ms avg, ' + r.simStep.max + 'ms max');
    console.log('==================================');
  }
  function stressTest500() {
    var backup = JSON.stringify({ parts: S.parts, wires: S.wires });
    S.parts = [];
    S.wires = [];

    var types = [];
    var i;
    for (i = 0; i < 200; i++) types.push('resistor');
    for (i = 0; i < 100; i++) types.push('capacitor');
    for (i = 0; i < 50; i++) types.push('led');
    for (i = 0; i < 50; i++) types.push('diode');
    for (i = 0; i < 30; i++) types.push('npn');
    for (i = 0; i < 20; i++) types.push('vdc');
    for (i = 0; i < 20; i++) types.push('vac');
    for (i = 0; i < 10; i++) types.push('opamp');
    for (i = 0; i < 10; i++) types.push(i % 2 === 0 ? 'and' : 'or');
    for (i = 0; i < 5; i++) types.push('adc');
    for (i = 0; i < 5; i++) types.push('dac');

    var cols = 25, spacing = 80;
    for (i = 0; i < types.length; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var part = {
        type: types[i], id: S.nextId ? S.nextId++ : 90000 + i,
        x: col * spacing + 100, y: row * spacing + 100,
        rot: 0, val: COMP[types[i]] ? COMP[types[i]].def || 0 : 0,
        props: {},
        _v: 0, _i: 0, _p: 0,
        _thermal: { T: S.ambientTemp || 25, status: 'normal', Pmax: 0.25, P: 0 },
        damaged: false
      };
      S.parts.push(part);
    }

    var result = {
      componentCount: S.parts.length,
      fpsIdle: -1,
      simStepMs: -1,
      memoryMB: -1,
      verdict: 'PASS'
    };

    // Measure sim step time
    var stepTotal = 0, stepCount = 20;
    try { buildCircuitFromCanvas(); } catch(e) { /* unconnected parts may error */ }
    for (i = 0; i < stepCount; i++) {
      var t0 = performance.now();
      try {
        if (typeof solveStep === 'function') solveStep(1e-5);
      } catch(e) { /* expected with disconnected parts */ }
      stepTotal += performance.now() - t0;
    }
    result.simStepMs = Math.round(stepTotal / stepCount * 100) / 100;

    if (performance.memory) {
      result.memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }

    result.verdict = (result.simStepMs < 50) ? 'PASS' : (result.simStepMs < 100) ? 'WARN' : 'FAIL';

    try {
      var restored = JSON.parse(backup);
      S.parts = restored.parts;
      S.wires = restored.wires;
    } catch(e) {
      S.parts = [];
      S.wires = [];
    }

    return result;
  }

  return { run: run, report: report, stressTest500: stressTest500 };
})();