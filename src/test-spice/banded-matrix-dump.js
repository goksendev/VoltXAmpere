#!/usr/bin/env node
// Sprint 96 diagnostic: dump the linearized MNA matrix for the three
// branch-variable circuits that failed the Sprint 95 forced-banded
// probe. Confirms the partial-pivoting fill hypothesis by showing
// (a) the reordered matrix after Cuthill-McKee, (b) the bandwidth
// scalar the banded solver uses, (c) the solution both solvers
// produce. When the hand trace is right we expect the dense result
// to match analytic, and the banded result to miss exactly the
// coefficients that partial pivoting pushed past the `bw` column cap.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CASES = [
  '31-ccvs-amplifier.cir',
  '17-bjt-runaway-demo.cir',
  '25-bjt-deep-saturation.cir',
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  for (const file of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.Sparse && VXA.SimV2);

    const cir = fs.readFileSync(path.join(__dirname, file), 'utf8');

    // We can't easily reach into _solveStep's inner matrix. Instead
    // we build one small matrix ourselves that reproduces the CCVS
    // case exactly, and also intercept VXA.Sparse.solveLU to capture
    // the live matrix on the first call during a real simulation.
    const snap = await page.evaluate(async (cir) => {
      var captured = null;
      var Sp = VXA.Sparse;
      var origCompile = Sp.compile;
      Sp.compile = function(m) {
        var out = origCompile.apply(this, arguments);
        if (!captured && m.n <= 30) {
          // snapshot
          var A = [];
          for (var i = 0; i < m.n; i++) A[i] = new Float64Array(m.n);
          for (var c = 0; c < m.n; c++) {
            for (var k = m.colPtr[c]; k < m.colPtr[c + 1]; k++) {
              A[m.rowIdx[k]][c] = m.values[k];
            }
          }
          captured = { n: m.n, A: A.map(r => Array.from(r)) };
        }
        return out;
      };

      S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
      VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
      buildCircuitFromCanvas();
      S.sim.t = 0; S.sim.running = false;
      if (S.sim.error) S.sim.error = null;
      VXA.SimV2.solve(1e-7);

      Sp.compile = origCompile;

      if (!captured) return { err: 'no-matrix' };

      // For the captured matrix, construct an rhs by scanning a second
      // live solve and trapping the rhs that was passed to solveLU.
      var rhs = null;
      var origSolve = Sp.solveLU;
      Sp.solveLU = function(matrix, b) {
        if (!rhs && matrix.n === captured.n) rhs = Array.from(b);
        return origSolve.call(this, matrix, b);
      };
      // Fresh state then re-simulate one step to trap rhs
      S.parts = []; S.wires = []; S.nextId = 1;
      VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
      buildCircuitFromCanvas();
      S.sim.t = 0; S.sim.running = false;
      VXA.SimV2.solve(1e-7);
      Sp.solveLU = origSolve;

      // Re-solve explicitly on the captured matrix with each backend
      // and measure bandwidth. Re-compile from the captured dense form.
      var n = captured.n;
      var m2 = Sp.create(n);
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (captured.A[r][c] !== 0) Sp.stamp(m2, r, c, captured.A[r][c]);
        }
      }
      Sp.compile(m2);

      var xDense  = Array.from(Sp.solveLU_dense(m2, rhs || new Array(n).fill(0)));
      var xBanded = Array.from(Sp.solveLU_banded(m2, rhs || new Array(n).fill(0)));
      var bw = m2._bandwidth;

      return { n, A: captured.A, rhs: rhs || [], xDense, xBanded, bw };
    }, cir);

    console.log('━'.repeat(72));
    console.log('Matrix dump — ' + file);
    console.log('━'.repeat(72));
    if (snap.err) { console.log('  ' + snap.err); await page.close(); continue; }
    console.log('  n = ' + snap.n + '   bandwidth bw = ' + snap.bw);
    console.log('  A =');
    for (var i = 0; i < snap.n; i++) {
      var row = snap.A[i].map(v => {
        if (v === 0) return '       .';
        var abs = Math.abs(v);
        if (abs >= 1 || abs < 1e-6) return v.toExponential(2).padStart(8);
        return v.toFixed(4).padStart(8);
      }).join(' ');
      console.log('     [' + row + ']');
    }
    console.log('  b     = [' + snap.rhs.map(v => v.toExponential(2).padStart(9)).join(', ') + ']');
    console.log('  xDense  = [' + snap.xDense.map(v => v.toFixed(4).padStart(9)).join(', ') + ']');
    console.log('  xBanded = [' + snap.xBanded.map(v => v.toFixed(4).padStart(9)).join(', ') + ']');
    var diff = snap.xDense.map((v, i) => Math.abs(v - snap.xBanded[i]));
    console.log('  |Δ|     = [' + diff.map(v => v.toExponential(2).padStart(9)).join(', ') + ']');

    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
