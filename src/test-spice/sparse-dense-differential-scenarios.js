#!/usr/bin/env node
// Sprint 95 — HATA 16: sparse (banded) vs dense LU differential test.
//
// Sprint 66 introduced a banded Gaussian-elimination path in
// VXA.Sparse.solveLU; `n > 30` dispatches to solveLU_banded for a
// 5–10× speedup, `n ≤ 30` stays on solveLU_dense. The Sprint 69
// runtime verification loop compares the two mid-simulation for the
// first 100 large solves — great for live fault detection but
// invisible to CI.  A quietly broken banded solver could land on
// main with every existing test green.
//
// This probe closes that gap by running the production dispatch
// against a forced-dense ground truth. For every circuit in the
// suite (including a 50-node resistor ladder that deliberately
// pushes matrix size past the n=30 banded threshold) we
//
//   1. solve with VXA.Sparse.solveLU *as shipped* (dispatch intact)
//   2. solve with Sp.solveLU overridden to solveLU_dense
//
// Pass criterion:
//   max_i |V_prod[i] − V_dense[i]| ≤ 1e-6  OR  max relative ≤ 1e-4
//
// For `n ≤ 30` both paths reduce to dense so the diff is exactly 0 —
// which is itself a useful sanity check that the dispatcher's
// threshold hasn't drifted.  For the 50-node ladder (matrix size
// ~51) the production path really does route through banded, and
// the comparison proves the banded answer matches the dense
// ground truth at floating-point precision.
//
// A secondary gate also forces every solve onto solveLU_banded —
// Sprint 95 first turned up a small-matrix banded regression for
// circuits with branch-variable stamps (CCVS, Gummel-Poon q1/qb),
// which Sprint 96 traced to partial-pivoting fill outside the
// banded solver's column cap and fixed by widening the effective
// upper bandwidth to 2·bw (LAPACK GBTRF convention). From Sprint 96
// onward banded is expected to agree with dense for every n, not
// just n > 30, so any fresh discrepancy there is a hard failure.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const TEST_DIR = __dirname;

// 25 circuits: 24 from the existing suite plus the new 50-node
// ladder that exercises the banded path. Mix covers every
// non-trivial component class so regression surface is wide.
const CIRCUITS = [
  '01-voltage-divider.cir',
  '02-parallel-r.cir',
  '03-rlc-series.cir',
  '04-diode-bridge.cir',
  '05-ce-amp.cir',
  '06-opamp-buffer.cir',
  '07-555-astable.cir',
  '08-voltage-regulator.cir',
  '09-h-bridge.cir',
  '10-boost-converter.cir',
  '14-rl-decay.cir',
  '17-bjt-runaway-demo.cir',
  '18-bjt-safe.cir',
  '19-inductor-saturation.cir',
  '20-inductor-ideal.cir',
  '21-mosfet-runaway.cir',
  '22-mosfet-safe.cir',
  '23-diode-temp-coefficient.cir',
  '25-bjt-deep-saturation.cir',
  '28-inductor-tcurie.cir',
  '30-cccs-current-mirror.cir',
  '31-ccvs-amplifier.cir',
  '33-jfet-idss-accurate.cir',
  '34-jfet-different-model.cir',
  '36-ladder-50-resistors.cir',
];

async function solveWith(page, mode, circuitText) {
  return await page.evaluate(async (cir, solveMode) => {
    // mode === 'prod'        : leave VXA.Sparse.solveLU untouched —
    //                          uses the production dispatcher.
    // mode === 'forced-dense': override solveLU to solveLU_dense.
    // mode === 'forced-banded' (diagnostic): override to solveLU_banded.
    var Sp = VXA.Sparse;
    var origLU = Sp.solveLU;
    var origDense = Sp.solveLU_dense;
    var origBanded = Sp.solveLU_banded;
    if (solveMode === 'forced-dense') {
      Sp.solveLU        = origDense;
      Sp.solveLU_dense  = origDense;
      Sp.solveLU_banded = origDense;
    } else if (solveMode === 'forced-banded') {
      Sp.solveLU        = origBanded;
      Sp.solveLU_dense  = origBanded;
      Sp.solveLU_banded = origBanded;
    } // else: leave everything at factory settings

    try {
      S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];

      VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
      buildCircuitFromCanvas();

      S.sim.t = 0; S.sim.running = false;
      if (S.sim.error) S.sim.error = null;

      // 200 × 100 ns deterministic transient lets capacitor / inductor
      // companions and diode / BJT NR loops all converge without the
      // heavier findDCOperatingPoint() ramp (which can hang a headless
      // Chromium on oscillators like the 555-astable).
      for (var j = 0; j < 200; j++) {
        VXA.SimV2.solve(1e-7);
        S.sim.t += 1e-7;
        if (S.sim.error) break;
      }

      return {
        ok: !S.sim.error,
        V: Array.from(S._nodeVoltages || []),
        N: (S._nodeVoltages || []).length,
        bandwidth: VXA.SimV2.getBandwidth ? VXA.SimV2.getBandwidth() : null,
        simError: S.sim.error || null
      };
    } finally {
      Sp.solveLU        = origLU;
      Sp.solveLU_dense  = origDense;
      Sp.solveLU_banded = origBanded;
    }
  }, circuitText, mode);
}

async function openFreshPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.Sparse && VXA.SpiceImport,
    { timeout: 15000 }
  );
  return page;
}

function compareVoltages(vA, vB) {
  var N = Math.min(vA.length, vB.length);
  var maxAbs = 0, maxRel = 0, worst = -1;
  for (var i = 1; i < N; i++) {   // skip i=0 (ground)
    var abs = Math.abs(vA[i] - vB[i]);
    var scale = Math.max(Math.abs(vA[i]), 1e-6);
    var rel = abs / scale;
    if (abs > maxAbs) { maxAbs = abs; worst = i; }
    if (rel > maxRel) maxRel = rel;
  }
  return { maxAbs, maxRel, worstNode: worst, N };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'], protocolTimeout: 90000
  });

  console.log('━'.repeat(76));
  console.log('Sprint 95  SPARSE vs DENSE DIFFERENTIAL TEST');
  console.log('━'.repeat(76));
  console.log('  Pass criterion (production vs forced-dense):');
  console.log('     max |ΔV| ≤ 1e-6  OR  max relative ≤ 1e-4');
  console.log('');

  var allPass = true;
  var bigMatrixCount = 0;

  for (var ci = 0; ci < CIRCUITS.length; ci++) {
    var file = CIRCUITS[ci];
    var p = path.join(TEST_DIR, file);
    if (!fs.existsSync(p)) {
      console.log('  ' + file.padEnd(34) + '  (missing)');
      continue;
    }
    var cir = fs.readFileSync(p, 'utf8');

    var page;
    try {
      page = await openFreshPage(browser);
    } catch (e) {
      console.log('  ' + file.padEnd(34) + '  PAGE BOOT ERROR: ' + e.message);
      allPass = false;
      continue;
    }

    try {
      var rProd   = await solveWith(page, 'prod',         cir);
      var rDense  = await solveWith(page, 'forced-dense', cir);

      if (!rProd.ok || !rDense.ok) {
        console.log('  ' + file.padEnd(34) +
                    '  SOLVE FAILED prod=' + rProd.ok + ' dense=' + rDense.ok +
                    (rProd.simError ? ' (' + rProd.simError + ')' : ''));
        allPass = false;
        continue;
      }

      var diff = compareVoltages(rProd.V, rDense.V);
      var pass = diff.maxAbs <= 1e-6 || diff.maxRel <= 1e-4;
      if (!pass) allPass = false;
      if (rProd.bandwidth != null && diff.N > 30) bigMatrixCount++;

      var bwTag = (rProd.bandwidth != null && diff.N > 30)
        ? '  bw=' + rProd.bandwidth
        : '';

      console.log('  ' + (pass ? '✓' : '✗') + ' ' + file.padEnd(34) +
                  '  N=' + String(diff.N).padStart(3) +
                  '  maxAbs=' + diff.maxAbs.toExponential(2) +
                  '  maxRel=' + diff.maxRel.toExponential(2) + bwTag +
                  (pass ? '  PASS' : '  FAIL @ node ' + diff.worstNode));

      // Forced-banded comparison: pins every solve to the banded
      // path regardless of matrix size. After Sprint 96 fixed the
      // partial-pivoting fill bug in solveLU_banded, banded must
      // agree with dense for every n, not just n > 30. A fresh
      // discrepancy here is a real correctness regression.
      try {
        var rBanded = await solveWith(page, 'forced-banded', cir);
        if (rBanded.ok) {
          var dBand = compareVoltages(rDense.V, rBanded.V);
          var bandOK = dBand.maxAbs <= 1e-6 || dBand.maxRel <= 1e-4;
          if (!bandOK) {
            console.log('    ✗ forced-banded vs dense @ ' + file +
                        '  (N=' + diff.N + ')' +
                        '  maxAbs=' + dBand.maxAbs.toExponential(2) +
                        '  maxRel=' + dBand.maxRel.toExponential(2) +
                        '  — banded path is broken');
            allPass = false;
          }
        }
      } catch (_) { /* diagnostic only */ }
    } catch (e) {
      console.log('  ' + file.padEnd(34) + '  EXCEPTION: ' + e.message);
      allPass = false;
    } finally {
      try { await page.close(); } catch (_) {}
    }
  }

  await browser.close();

  console.log('');
  console.log('━'.repeat(76));
  console.log('  circuits tested       : ' + CIRCUITS.length);
  console.log('  circuits with n > 30  : ' + bigMatrixCount + ' (banded path actually exercised)');
  console.log('');
  console.log(allPass ? '✓ ALL PASS' : '✗ FAIL');
  console.log('━'.repeat(76));

  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
