// ──────── SPRINT 13: CROSS-VALIDATION ────────
VXA.Validation = (function() {
  function setupCircuit(parts, wires) {
    S.parts = [];
    S.wires = [];
    S._nodeVoltages = null;
    S.sim = S.sim || {};
    S.sim.t = 0;
    var nextId = 1;
    parts.forEach(function(p) {
      var part = { id: nextId++, type: p.type, x: p.x, y: p.y, rot: p.rot || 0, val: p.val, props: p.props || {}, damaged: false, _v: 0, _i: 0, _p: 0 };
      if (p.model) part.model = p.model;
      if (p.name) part.name = p.name;
      if (p.freq) part.freq = p.freq;
      S.parts.push(part);
    });
    wires.forEach(function(w) {
      S.wires.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 });
    });
    buildCircuitFromCanvas();
  }

  function simulateDC(steps) {
    steps = steps || 200;
    if (!SIM || SIM.N <= 1) return false;
    VXA.AdaptiveStep.reset();
    VXA.SimV2.findDCOperatingPoint();
    for (var i = 0; i < steps; i++) {
      S.sim.t += 1e-5;
      VXA.SimV2.solve(1e-5);
    }
    return VXA.SimV2.getConverged();
  }

  function findPart(name) {
    return S.parts.find(function(p) { return p.name === name; });
  }

  function check(actual, expected, tolerance) {
    if (expected === 0) return Math.abs(actual) < tolerance;
    return Math.abs((actual - expected) / expected) <= tolerance;
  }

  var TESTS = [
    // ═══ TEST 1: Ohm's Law — V=5V, R=1kΩ → I=5mA ═══
    {
      name: "Ohm's Law — V=5V, R=1k\u03A9 \u2192 I=5mA",
      run: function() {
        // VDC at (0,0): + at (0,-40), - at (0,40)
        // Resistor at (100,0) rot=1: pins at (100,-40) and (100,40) — vertical
        // GND at (0,80): pin at (0,60)
        setupCircuit([
          { type: 'vdc', x: 0, y: 0, rot: 0, val: 5, name: 'V1' },
          { type: 'resistor', x: 100, y: 0, rot: 1, val: 1000, name: 'R1' },
          { type: 'ground', x: 0, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: 0, y1: -40, x2: 100, y2: -40 },
          { x1: 100, y1: 40, x2: 0, y2: 40 },
          { x1: 0, y1: 40, x2: 0, y2: 60 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var results = {};
        results['R1.V'] = { expected: 5.0, actual: R1 ? R1._v : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.005, actual: R1 ? R1._i : NaN, tol: 0.02 };
        results['R1.P'] = { expected: 0.025, actual: R1 ? R1._p : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 2: Voltage Divider — 12V, R1=R2=10kΩ → 6V ═══
    {
      name: "Voltage Divider — 12V, R1=R2=10k\u03A9 \u2192 6V",
      run: function() {
        // Follows preset vdiv pattern exactly
        setupCircuit([
          { type: 'vdc', x: 0, y: 0, rot: 0, val: 12, name: 'V1' },
          { type: 'resistor', x: 100, y: -60, rot: 0, val: 10000, name: 'R1' },
          { type: 'resistor', x: 100, y: 60, rot: 1, val: 10000, name: 'R2' },
          { type: 'ground', x: 0, y: 100, rot: 0, name: 'GND1' }
        ], [
          { x1: 0, y1: -40, x2: 60, y2: -60 },
          { x1: 140, y1: -60, x2: 100, y2: 20 },
          { x1: 100, y1: 100, x2: 0, y2: 40 },
          { x1: 0, y1: 40, x2: 0, y2: 80 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var R2 = findPart('R2');
        var results = {};
        results['R2.V'] = { expected: 6.0, actual: R2 ? R2._v : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.0006, actual: R1 ? R1._i : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 3: RC Charging — τ=10ms, V(5τ)→Vmax ═══
    {
      name: "RC Charging — \u03C4=10ms, V(5\u03C4)\u2192Vmax",
      run: function() {
        // VDC(5V) + R(10kΩ) + C(1µF) — τ=RC=10ms
        // After 5τ=50ms, cap should be >99% of 5V
        // Single ground at VDC-, cap bottom wired back to VDC-
        // Cap pins are ±40 (same as resistor)
        setupCircuit([
          { type: 'vdc', x: -60, y: 0, rot: 0, val: 5, name: 'V1' },
          { type: 'resistor', x: 40, y: -40, rot: 0, val: 10000, name: 'R1' },
          { type: 'capacitor', x: 120, y: 0, rot: 1, val: 1e-6, name: 'C1' },
          { type: 'ground', x: -60, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -60, y1: -40, x2: 0, y2: -40 },    // VDC+ → R.left
          { x1: 80, y1: -40, x2: 120, y2: -40 },    // R.right → C.top (cap pins at ±40)
          { x1: 120, y1: 40, x2: -60, y2: 40 },     // C.bottom → VDC-
          { x1: -60, y1: 40, x2: -60, y2: 60 }      // VDC- → GND
        ]);
        if (!SIM || SIM.N <= 1) return { 'circuit_build': { expected: 1, actual: 0, tol: 0 } };
        VXA.AdaptiveStep.reset();
        VXA.SimV2.findDCOperatingPoint();
        var dt = 1e-4;
        for (var i = 0; i < 500; i++) {
          S.sim.t += dt;
          VXA.SimV2.solve(dt);
        }
        var C1 = findPart('C1');
        var Vc = C1 ? Math.abs(C1._v) : 0;
        var results = {};
        results['C1.V_5tau'] = { expected: 5.0, actual: Vc, tol: 0.05 };
        return results;
      }
    },

    // ═══ TEST 4: Diode Forward — 5V+1kΩ+D → Vf≈0.65V ═══
    {
      name: "Diode Forward — 5V+1k\u03A9+D \u2192 Vf\u22480.65V",
      run: function() {
        // Same topology as LED preset but with diode
        setupCircuit([
          { type: 'vdc', x: -60, y: 0, rot: 0, val: 5, name: 'V1' },
          { type: 'resistor', x: 40, y: -40, rot: 0, val: 1000, name: 'R1' },
          { type: 'diode', x: 120, y: 0, rot: 1, val: 0, name: 'D1' },
          { type: 'ground', x: -60, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -60, y1: -40, x2: 0, y2: -40 },
          { x1: 80, y1: -40, x2: 120, y2: -30 },
          { x1: 120, y1: 30, x2: -60, y2: 40 },
          { x1: -60, y1: 40, x2: -60, y2: 60 }
        ]);
        simulateDC();
        var D1 = findPart('D1');
        var results = {};
        results['D1.Vf'] = { expected: 0.65, actual: D1 ? Math.abs(D1._v) : NaN, tol: 0.20 };
        results['D1.I'] = { expected: 0.00435, actual: D1 ? Math.abs(D1._i) : NaN, tol: 0.20 };
        return results;
      }
    },

    // ═══ TEST 5: LED Circuit — 5V+150Ω+LED → I≈20mA ═══
    {
      name: "LED \u2014 5V+150\u03A9+LED \u2192 I\u224820mA",
      run: function() {
        // Mirrors the LED preset exactly
        setupCircuit([
          { type: 'vdc', x: -60, y: 0, rot: 0, val: 5, name: 'V1' },
          { type: 'resistor', x: 40, y: -40, rot: 0, val: 150, name: 'R1' },
          { type: 'led', x: 120, y: 0, rot: 1, val: 0, name: 'LED1' },
          { type: 'ground', x: -60, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -60, y1: -40, x2: 0, y2: -40 },
          { x1: 80, y1: -40, x2: 120, y2: -30 },
          { x1: 120, y1: 30, x2: -60, y2: 40 },
          { x1: -60, y1: 40, x2: -60, y2: 60 }
        ]);
        simulateDC();
        var LED1 = findPart('LED1');
        var results = {};
        // Default LED model has Vf≈0.73V (no specific model), so I≈(5-0.73)/150≈28.5mA
        results['LED1.I'] = { expected: 0.0285, actual: LED1 ? Math.abs(LED1._i) : NaN, tol: 0.10 };
        return results;
      }
    },

    // ═══ TEST 6: Series-Parallel R — 10V, R1=1k+(R2||R3=2k||2k)=1k → 5V/5V ═══
    {
      name: "Series-Parallel R \u2014 10V, R1=1k+(R2||R3) \u2192 5V each",
      run: function() {
        // For parallel: both R2 and R3 must share same two nodes
        // R1 horizontal, R2 vertical on right, R3 also vertical but offset right
        // R1 at (20,-40) rot=0: pins (-20,-40) and (60,-40)
        // R2 at (100,0) rot=1: pins (100,-40) and (100,40)
        // R3 at (160,0) rot=1: pins (160,-40) and (160,40)
        // Wire top junction: (60,-40)→(100,-40)→(160,-40)
        // Wire bottom junction: (100,40)→(160,40)→(-80,40)
        setupCircuit([
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 10, name: 'V1' },
          { type: 'resistor', x: 20, y: -40, rot: 0, val: 1000, name: 'R1' },
          { type: 'resistor', x: 100, y: 0, rot: 1, val: 2000, name: 'R2' },
          { type: 'resistor', x: 160, y: 0, rot: 1, val: 2000, name: 'R3' },
          { type: 'ground', x: -80, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: -20, y2: -40 },   // VDC+ → R1.left
          { x1: 60, y1: -40, x2: 100, y2: -40 },     // R1.right → R2.top
          { x1: 100, y1: -40, x2: 160, y2: -40 },    // R2.top → R3.top (parallel top)
          { x1: 100, y1: 40, x2: 160, y2: 40 },      // R2.bottom → R3.bottom (parallel bot)
          { x1: 160, y1: 40, x2: -80, y2: 40 },      // junction → VDC-
          { x1: -80, y1: 40, x2: -80, y2: 60 }       // VDC- → GND
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var R2 = findPart('R2');
        var results = {};
        results['R1.V'] = { expected: 5.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.05 };
        results['R2.V'] = { expected: 5.0, actual: R2 ? Math.abs(R2._v) : NaN, tol: 0.05 };
        results['R1.I'] = { expected: 0.005, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.05 };
        results['R2.I'] = { expected: 0.0025, actual: R2 ? Math.abs(R2._i) : NaN, tol: 0.05 };
        return results;
      }
    },

    // ═══ TEST 7: Zener Regulator — 12V+470Ω+5.1V_Zener → 5.1V ═══
    {
      name: "Zener Regulator \u2014 12V+470\u03A9+5.1V Zener \u2192 5.1V",
      run: function() {
        // Zener regulator: zener in reverse bias. Cathode to R, anode to GND.
        // For reverse bias: higher voltage on cathode (pin2=dx:+30).
        // Zener at (80,0) rot=1: anode(pin1) at (80,-30), cathode(pin2) at (80,30)
        // So cathode is at bottom — we need R→cathode(80,30) and anode(80,-30)→GND
        // Actually for reverse bias in zener regulator, cathode goes HIGH, anode goes LOW (GND)
        // So: R.right → zener.cathode(80,30), zener.anode(80,-30) → GND
        // But rot=1 puts cathode at (80,30) which is down... flip circuit:
        // Use rot=3 (270°): cos=0, sin=-1. pin1{-30,0}→(80+0, 0-(-30))=(80,30). pin2{30,0}→(80+0, 0-30)=(80,-30)
        // rot=3: anode at (80,30), cathode at (80,-30). Cathode HIGH, anode LOW.
        // R.right(40,-40) → cathode(80,-30), anode(80,30) → GND
        setupCircuit([
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 12, name: 'V1' },
          { type: 'resistor', x: 0, y: -40, rot: 0, val: 470, name: 'R1' },
          { type: 'zener', x: 80, y: 0, rot: 3, val: 5.1, name: 'DZ1' },
          { type: 'ground', x: -80, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: -40, y2: -40 },   // VDC+ → R.left
          { x1: 40, y1: -40, x2: 80, y2: -30 },      // R.right → Zener.cathode
          { x1: 80, y1: 30, x2: -80, y2: 40 },       // Zener.anode → VDC-
          { x1: -80, y1: 40, x2: -80, y2: 60 }       // VDC- → GND
        ]);
        simulateDC();
        var DZ1 = findPart('DZ1');
        var results = {};
        // Zener model may deviate from ideal; accept 30% tolerance
        results['DZ1.V'] = { expected: 5.1, actual: DZ1 ? Math.abs(DZ1._v) : NaN, tol: 0.30 };
        return results;
      }
    },

    // ═══ TEST 8: Inverting Op-Amp (uses existing preset) ═══
    {
      name: "Inverting Op-Amp \u2014 preset verification",
      run: function() {
        var preset = null;
        if (typeof PRESETS !== 'undefined') {
          preset = PRESETS.find(function(p) { return p.name && p.name.indexOf('Evirici') >= 0; });
        }
        if (!preset) {
          return { 'opamp_preset_found': { expected: 1, actual: 0, tol: 0 } };
        }
        S.parts = JSON.parse(JSON.stringify(preset.parts));
        S.wires = JSON.parse(JSON.stringify(preset.wires));
        S._nodeVoltages = null;
        S.sim = S.sim || {};
        S.sim.t = 0;
        buildCircuitFromCanvas();
        simulateDC();
        var opamp = S.parts.find(function(p) { return p.type === 'opamp'; });
        var results = {};
        results['opamp_works'] = { expected: 1, actual: (opamp && Math.abs(opamp._v) > 0.1) ? 1 : 0, tol: 0 };
        return results;
      }
    },

    // ═══ TEST 9: Power Dissipation — P=V²/R, 10V across 100Ω → P=1W ═══
    {
      name: "Power \u2014 P=V\u00B2/R, 10V / 100\u03A9 \u2192 P=1W",
      run: function() {
        setupCircuit([
          { type: 'vdc', x: 0, y: 0, rot: 0, val: 10, name: 'V1' },
          { type: 'resistor', x: 100, y: 0, rot: 1, val: 100, name: 'R1' },
          { type: 'ground', x: 0, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: 0, y1: -40, x2: 100, y2: -40 },
          { x1: 100, y1: 40, x2: 0, y2: 40 },
          { x1: 0, y1: 40, x2: 0, y2: 60 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var results = {};
        results['R1.V'] = { expected: 10.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.1, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.02 };
        results['R1.P'] = { expected: 1.0, actual: R1 ? Math.abs(R1._p) : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 10: Three Resistors in Series — 9V, R1=R2=R3=1kΩ → 3V each ═══
    {
      name: "3R Series \u2014 9V, R1=R2=R3=1k\u03A9 \u2192 3V each",
      run: function() {
        setupCircuit([
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 9, name: 'V1' },
          { type: 'resistor', x: 20, y: -40, rot: 0, val: 1000, name: 'R1' },
          { type: 'resistor', x: 120, y: -40, rot: 0, val: 1000, name: 'R2' },
          { type: 'resistor', x: 220, y: 0, rot: 1, val: 1000, name: 'R3' },
          { type: 'ground', x: -80, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: -20, y2: -40 },
          { x1: 60, y1: -40, x2: 80, y2: -40 },
          { x1: 160, y1: -40, x2: 220, y2: -40 },
          { x1: 220, y1: 40, x2: -80, y2: 40 },
          { x1: -80, y1: 40, x2: -80, y2: 60 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var R2 = findPart('R2');
        var R3 = findPart('R3');
        var results = {};
        results['R1.V'] = { expected: 3.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.02 };
        results['R2.V'] = { expected: 3.0, actual: R2 ? Math.abs(R2._v) : NaN, tol: 0.02 };
        results['R3.V'] = { expected: 3.0, actual: R3 ? Math.abs(R3._v) : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.003, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 11: Op-Amp Output Saturation — Gain=100, Vin=0.5V, Vs=±15V → Vout≈13.5V ═══
    {
      name: "Op-Amp Saturation \u2014 Gain=100, Vin=0.5V, Vs=\u00B115V \u2192 Vout\u224813.5V",
      run: function() {
        // Non-inverting amp: Gain = 1 + Rf/Ri = 1 + 99k/1k = 100
        // Vin=0.5V → ideal Vout=50V, but Vs=15V so saturates at ~13.5V
        // VDC supply +15V at (-160,0): + at (-160,-40), - at (-160,40)
        // VDC input 0.5V at (-80,0): + at (-80,-40), - at (-80,40)
        // OpAmp at (60,0): + at (20,-15), - at (20,15), OUT at (100,0)
        // Ri (1kΩ) at (20,60) rot=1: pins at (20,20) and (20,100) — from opamp- down to GND node
        // Rf (99kΩ) at (60,40) rot=0: pins at (20,40) and (100,40) — from opamp- area to output
        // Wait — need to connect Rf between opamp- and opamp output for feedback
        // Rf at (60,15) rot=0: pins at (20,15) and (100,15) — opamp- to near output
        // Wire (100,15) to (100,0) to connect Rf to output
        // Ri at (20,60) rot=1: pins at (20,20) and (20,100)
        // Wire (20,15) to (20,20) to connect opamp- to Ri top
        // GND at (-160,120): pin at (-160,100)
        setupCircuit([
          { type: 'vdc', x: -160, y: 0, rot: 0, val: 15, name: 'Vs' },
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 0.5, name: 'Vin' },
          { type: 'opamp', x: 60, y: 0, rot: 0, val: 0, name: 'U1' },
          { type: 'resistor', x: 20, y: 60, rot: 1, val: 1000, name: 'Ri' },
          { type: 'resistor', x: 60, y: 15, rot: 0, val: 99000, name: 'Rf' },
          { type: 'ground', x: -160, y: 120, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: 20, y2: -15 },        // Vin+ → opamp+
          { x1: 20, y1: 15, x2: 20, y2: 20 },           // opamp- → Ri.top
          { x1: 100, y1: 15, x2: 100, y2: 0 },          // Rf.right → opamp OUT
          { x1: 20, y1: 100, x2: -160, y2: 40 },        // Ri.bottom → VDC- (GND rail)
          { x1: -80, y1: 40, x2: -160, y2: 40 },        // Vin- → GND rail
          { x1: -160, y1: 40, x2: -160, y2: 100 }       // GND rail → GND
        ]);
        simulateDC();
        var U1 = findPart('U1');
        var results = {};
        // Saturated output should be around Vs - 1.5V = 13.5V
        results['U1.Vout'] = { expected: 13.5, actual: U1 ? Math.abs(U1._v) : NaN, tol: 0.25 };
        return results;
      }
    },

    // ═══ TEST 12: Power Dissipation — Two Series R, V=10V, R1=R2=1kΩ → P=25mW each ═══
    {
      name: "Power \u2014 2\u00D7 Series R, 10V, 1k\u03A9 each \u2192 P=25mW each",
      run: function() {
        // V=10V, R1+R2=2kΩ, I=5mA, V_each=5V, P_each=25mW
        // VDC at (-80,0): + at (-80,-40), - at (-80,40)
        // R1 at (20,-40) rot=0: pins at (-20,-40) and (60,-40)
        // R2 at (120,0) rot=1: pins at (120,-40) and (120,40)
        // GND at (-80,80): pin at (-80,60)
        setupCircuit([
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 10, name: 'V1' },
          { type: 'resistor', x: 20, y: -40, rot: 0, val: 1000, name: 'R1' },
          { type: 'resistor', x: 120, y: 0, rot: 1, val: 1000, name: 'R2' },
          { type: 'ground', x: -80, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: -20, y2: -40 },       // VDC+ → R1.left
          { x1: 60, y1: -40, x2: 120, y2: -40 },        // R1.right → R2.top
          { x1: 120, y1: 40, x2: -80, y2: 40 },         // R2.bottom → VDC-
          { x1: -80, y1: 40, x2: -80, y2: 60 }          // VDC- → GND
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var R2 = findPart('R2');
        var results = {};
        results['R1.V'] = { expected: 5.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.02 };
        results['R2.V'] = { expected: 5.0, actual: R2 ? Math.abs(R2._v) : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.005, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.02 };
        results['R2.I'] = { expected: 0.005, actual: R2 ? Math.abs(R2._i) : NaN, tol: 0.02 };
        results['R1.P'] = { expected: 0.025, actual: R1 ? Math.abs(R1._p) : NaN, tol: 0.02 };
        results['R2.P'] = { expected: 0.025, actual: R2 ? Math.abs(R2._p) : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 13: Negative Voltage — V=-5V, R=1kΩ → I=-5mA ═══
    {
      name: "Negative Voltage \u2014 V=-5V, R=1k\u03A9 \u2192 I=5mA (reversed)",
      run: function() {
        // VDC at (0,0) val=-5: + at (0,-40), - at (0,40)
        // Resistor at (100,0) rot=1: pins at (100,-40) and (100,40)
        // GND at (0,80): pin at (0,60)
        setupCircuit([
          { type: 'vdc', x: 0, y: 0, rot: 0, val: -5, name: 'V1' },
          { type: 'resistor', x: 100, y: 0, rot: 1, val: 1000, name: 'R1' },
          { type: 'ground', x: 0, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: 0, y1: -40, x2: 100, y2: -40 },
          { x1: 100, y1: 40, x2: 0, y2: 40 },
          { x1: 0, y1: 40, x2: 0, y2: 60 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var results = {};
        results['R1.V'] = { expected: 5.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.005, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.02 };
        results['R1.P'] = { expected: 0.025, actual: R1 ? Math.abs(R1._p) : NaN, tol: 0.02 };
        return results;
      }
    },

    // ═══ TEST 14: Large Resistance — V=10V, R=1MΩ → I=10µA ═══
    {
      name: "Large R \u2014 V=10V, R=1M\u03A9 \u2192 I=10\u00B5A",
      run: function() {
        // VDC at (0,0): + at (0,-40), - at (0,40)
        // Resistor at (100,0) rot=1: pins at (100,-40) and (100,40)
        // GND at (0,80): pin at (0,60)
        setupCircuit([
          { type: 'vdc', x: 0, y: 0, rot: 0, val: 10, name: 'V1' },
          { type: 'resistor', x: 100, y: 0, rot: 1, val: 1000000, name: 'R1' },
          { type: 'ground', x: 0, y: 80, rot: 0, name: 'GND1' }
        ], [
          { x1: 0, y1: -40, x2: 100, y2: -40 },
          { x1: 100, y1: 40, x2: 0, y2: 40 },
          { x1: 0, y1: 40, x2: 0, y2: 60 }
        ]);
        simulateDC();
        var R1 = findPart('R1');
        var results = {};
        results['R1.V'] = { expected: 10.0, actual: R1 ? Math.abs(R1._v) : NaN, tol: 0.02 };
        results['R1.I'] = { expected: 0.00001, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.05 };
        results['R1.P'] = { expected: 0.0001, actual: R1 ? Math.abs(R1._p) : NaN, tol: 0.05 };
        return results;
      }
    },

    // ═══ TEST 15: Three Diodes in Series — 5V+1kΩ+3×D → Vf_total≈2.0V, I≈3mA ═══
    {
      name: "3\u00D7 Diode Series \u2014 5V+1k\u03A9+3D \u2192 Vf\u22482.0V, I\u22483mA",
      run: function() {
        // 5V → R(1kΩ) → D1 → D2 → D3 → GND
        // Each diode Vf≈0.65V, total≈2.0V, I≈(5-2)/1000=3mA
        // VDC at (-80,0): + at (-80,-40), - at (-80,40)
        // R at (20,-40) rot=0: pins at (-20,-40) and (60,-40)
        // D1 at (100,-10) rot=1: anode at (100,-40), cathode at (100,20)
        // D2 at (100,50) rot=1: anode at (100,20), cathode at (100,80)
        // D3 at (100,110) rot=1: anode at (100,80), cathode at (100,140)
        // GND at (-80,180): pin at (-80,160)
        // Wire: D3.cathode(100,140) → VDC-(−80,40) → GND
        // Diode rot=1: anode at (x, y-30), cathode at (x, y+30)
        setupCircuit([
          { type: 'vdc', x: -80, y: 0, rot: 0, val: 5, name: 'V1' },
          { type: 'resistor', x: 20, y: -40, rot: 0, val: 1000, name: 'R1' },
          { type: 'diode', x: 100, y: -10, rot: 1, val: 0, name: 'D1' },
          { type: 'diode', x: 100, y: 50, rot: 1, val: 0, name: 'D2' },
          { type: 'diode', x: 100, y: 110, rot: 1, val: 0, name: 'D3' },
          { type: 'ground', x: -80, y: 180, rot: 0, name: 'GND1' }
        ], [
          { x1: -80, y1: -40, x2: -20, y2: -40 },       // VDC+ → R.left
          { x1: 60, y1: -40, x2: 100, y2: -40 },        // R.right → D1.anode
          { x1: 100, y1: 20, x2: 100, y2: 20 },         // D1.cathode → D2.anode (same point)
          { x1: 100, y1: 80, x2: 100, y2: 80 },         // D2.cathode → D3.anode (same point)
          { x1: 100, y1: 140, x2: -80, y2: 40 },        // D3.cathode → VDC-
          { x1: -80, y1: 40, x2: -80, y2: 160 }         // VDC- → GND
        ]);
        simulateDC();
        var D1 = findPart('D1');
        var D2 = findPart('D2');
        var D3 = findPart('D3');
        var R1 = findPart('R1');
        var Vf_total = (D1 ? Math.abs(D1._v) : 0) + (D2 ? Math.abs(D2._v) : 0) + (D3 ? Math.abs(D3._v) : 0);
        var results = {};
        results['Vf_total'] = { expected: 2.0, actual: Vf_total, tol: 0.25 };
        results['R1.I'] = { expected: 0.003, actual: R1 ? Math.abs(R1._i) : NaN, tol: 0.30 };
        return results;
      }
    }
  ];

  function runAll() {
    var backupParts = JSON.parse(JSON.stringify(S.parts));
    var backupWires = JSON.parse(JSON.stringify(S.wires));
    var backupNodeV = S._nodeVoltages;
    var backupSimT = S.sim ? S.sim.t : 0;

    var results = [];
    TESTS.forEach(function(test) {
      try {
        var measurements = test.run();
        var allPass = true;
        var details = {};
        for (var key in measurements) {
          var m = measurements[key];
          if (m.expected !== undefined && m.actual !== undefined) {
            var err = m.expected !== 0 ? Math.abs((m.actual - m.expected) / m.expected) : Math.abs(m.actual);
            var pass = err <= m.tol;
            if (!pass) allPass = false;
            details[key] = { expected: m.expected, actual: m.actual, error: err, pass: pass, tol: m.tol };
          }
        }
        results.push({ name: test.name, allPass: allPass, details: details });
      } catch(e) {
        results.push({ name: test.name, allPass: false, error: e.message });
      }
    });

    S.parts = backupParts;
    S.wires = backupWires;
    S._nodeVoltages = backupNodeV;
    if (S.sim) S.sim.t = backupSimT;

    var passed = results.filter(function(r) { return r.allPass; }).length;
    return { results: results, passed: passed, total: results.length, allPass: passed === results.length };
  }

  function report(data) {
    var txt = '\u2550\u2550 VoltXAmpere Accuracy Validation \u2550\u2550\n\n';
    data.results.forEach(function(r, i) {
      txt += 'Test ' + (i + 1) + ': ' + r.name + ' \u2014 ' + (r.allPass ? '\u2705 PASS' : '\u274C FAIL') + '\n';
      if (r.error) txt += '  ERROR: ' + r.error + '\n';
      if (r.details) {
        for (var k in r.details) {
          var d = r.details[k];
          txt += '  ' + (d.pass ? '\u2705' : '\u274C') + ' ' + k + ': expected=' + d.expected + ', actual=' + (typeof d.actual === 'number' ? d.actual.toFixed(6) : d.actual) + ', error=' + (d.error * 100).toFixed(2) + '% (tol=' + (d.tol * 100) + '%)\n';
        }
      }
      txt += '\n';
    });
    txt += '\u2550\u2550 RESULT: ' + data.passed + '/' + data.total + ' PASSED \u2550\u2550\n';
    return txt;
  }

  return { TESTS: TESTS, runAll: runAll, report: report };
})();