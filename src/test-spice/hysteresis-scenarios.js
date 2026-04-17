#!/usr/bin/env node
// Sprint 87: inductor hysteresis / core-loss probe.
//
// Same pulse drive on both circuits; only the hysteresis flag (Hc)
// differs. We expect:
//   • The Hc=0.05 A inductor to report a non-zero accumulated
//     core-loss energy ∑ P_core × dt across the run.
//   • The ideal inductor to remain at P_core = 0 throughout.
//   • Both runs to preserve the Sprint-82 solver behaviour: no
//     runaway, no NaN, no zero-clamp from the divergence guard.
//
// Driven at 10 kHz, dt = 1 µs. We integrate over ~3 ms = 30 cycles.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
const CIR_H = fs.readFileSync(path.join(__dirname, '26-hysteresis-square-wave.cir'), 'utf8');
const CIR_I = fs.readFileSync(path.join(__dirname, '27-hysteresis-ideal.cir'),       'utf8');

async function simulate(page, cir, totalSteps, chunkSize, sampleEvery) {
  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    if (SIM && SIM.comps) {
      for (const sc of SIM.comps) if (sc.type === 'L') { sc.iPrev = 0; sc.vPrev = 0; }
    }
    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;
    window.__hSamples = [];
    window.__hEnergy = 0;
  }, cir);

  let step = 0;
  while (step < totalSteps) {
    const end = Math.min(step + chunkSize, totalSteps);
    await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const lPart = S.parts.find(p => p.type === 'inductor');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        if (lPart) {
          window.__hEnergy += (lPart._core_loss_W || 0) * dt;
        }
        if (i % sampleEvery === 0) {
          window.__hSamples.push({
            t:   S.sim.t,
            iL:  lPart ? Math.abs(lPart._i || 0) : 0,
            P:   lPart ? (lPart._p || 0) : 0,
            P_core: lPart ? (lPart._core_loss_W || 0) : 0,
            Hc:  lPart && lPart.Hc
          });
        }
      }
    }, { start: step, end, dt: 1e-6, sampleEvery });
    step = end;
  }

  return await page.evaluate(() => ({
    samples: window.__hSamples,
    energy:  window.__hEnergy
  }));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined' && VXA.SimV2,
    { timeout: 15000 }
  );

  // dt = 1 µs, 3000 steps = 3 ms = 30 cycles of 10 kHz drive.
  const hyst  = await simulate(page, CIR_H, 3000, 300, 50);
  const ideal = await simulate(page, CIR_I, 3000, 300, 50);

  await browser.close();

  console.log('━'.repeat(64));
  console.log('Sprint 87 INDUCTOR HYSTERESIS / CORE LOSS');
  console.log('━'.repeat(64));

  function dump(name, r) {
    console.log('\n[' + name + '] samples: ' + r.samples.length + '   integrated core-loss energy: ' + (r.energy * 1e6).toFixed(3) + ' µJ');
    console.log('   t(ms)   |  |iL|(A)  |  P_total (W)  | P_core (W)');
    const idxs = [0, Math.floor(r.samples.length/4), Math.floor(r.samples.length/2),
                  Math.floor(3*r.samples.length/4), r.samples.length - 1]
                 .filter((v,i,a) => a.indexOf(v) === i && v >= 0 && v < r.samples.length);
    for (const i of idxs) {
      const s = r.samples[i];
      console.log(
        '   ' + (s.t * 1000).toFixed(3).padStart(5) +
        '   | ' + s.iL.toFixed(3).padStart(6) +
        '   | ' + s.P.toExponential(2).padStart(9) +
        '   | ' + s.P_core.toExponential(2).padStart(9)
      );
    }
  }
  dump('HYSTERESIS (Hc=0.05)', hyst);
  dump('IDEAL',                 ideal);

  // Pass criteria
  const aPass = hyst.energy > 0;                         // hysteresis dissipated something
  const bPass = ideal.energy === 0;                      // ideal did not
  const cPass = hyst.energy > ideal.energy;              // A/B clearly distinguishable
  // Sanity: |i| still well-bounded on both (no runaway / collapse)
  const hystPeakI  = Math.max.apply(null, hyst.samples.map(s => s.iL));
  const idealPeakI = Math.max.apply(null, ideal.samples.map(s => s.iL));
  const dPass = hystPeakI > 0.5 && hystPeakI < 20;        // in sane range
  const ePass = idealPeakI > 0.5 && idealPeakI < 20;

  console.log('\n━'.repeat(64));
  console.log('A hysteresis dissipates (∫P_core > 0) : ' + (aPass ? '✓ PASS' : '✗ FAIL') +
              '  (' + (hyst.energy * 1e6).toFixed(3) + ' µJ)');
  console.log('B ideal has zero core-loss            : ' + (bPass ? '✓ PASS' : '✗ FAIL') +
              '  (' + (ideal.energy * 1e6).toFixed(3) + ' µJ)');
  console.log('C hysteresis > ideal                  : ' + (cPass ? '✓ PASS' : '✗ FAIL'));
  console.log('D hysteresis peak iL sane (0.5-20 A)  : ' + (dPass ? '✓ PASS' : '✗ FAIL') +
              '  (' + hystPeakI.toFixed(2) + ' A)');
  console.log('E ideal peak iL sane                  : ' + (ePass ? '✓ PASS' : '✗ FAIL') +
              '  (' + idealPeakI.toFixed(2) + ' A)');
  process.exit((aPass && bPass && cPass && dPass && ePass) ? 0 : 1);
})();
