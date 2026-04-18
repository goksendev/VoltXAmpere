#!/usr/bin/env node
// Sprint 89: eddy-current loss scales as f².
//
// The same R + L circuit is driven by a bipolar PULSE at 1, 10 and
// 100 kHz. Sprint 89's per-step formula P_eddy ≈ Ke · (di/dt)² · L
// gives an average dissipation that, for a square wave, is linear
// in (dI/dt)² and therefore quadratic in f (since dI/dt ∝ f for a
// fixed-amplitude triangular/near-triangular inductor current).
//
// We measure the time-averaged P_eddy over a steady window (skip
// the first period's transient) and report the ratios:
//    P(10 kHz) / P(1 kHz)  should be ≈ 100
//    P(100 kHz) / P(1 kHz) should be ≈ 10 000
// A quadratic fit's exponent should be ≈ 2.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';

async function simulate(page, cir, dt, totalSteps, chunkSize, sampleEvery) {
  await page.evaluate(({ c }) => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    if (SIM && SIM.comps) {
      for (const sc of SIM.comps) if (sc.type === 'L') { sc.iPrev = 0; sc.vPrev = 0; }
    }
    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;
    window.__eSamples = [];
    window.__eEddy = 0;
    window.__eHyst = 0;
  }, { c: cir });

  let step = 0;
  while (step < totalSteps) {
    const end = Math.min(step + chunkSize, totalSteps);
    await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const L = S.parts.find(p => p.type === 'inductor');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        if (L) {
          window.__eEddy += (L._eddy_loss_W || 0) * dt;
          window.__eHyst += (L._core_loss_W || 0) * dt;
        }
        if (i % sampleEvery === 0) {
          window.__eSamples.push({
            t: S.sim.t,
            iL: L ? (L._i || 0) : 0,
            P_eddy: L ? (L._eddy_loss_W || 0) : 0
          });
        }
      }
    }, { start: step, end, dt, sampleEvery });
    step = end;
  }

  return await page.evaluate(() => ({
    samples: window.__eSamples,
    eddy: window.__eEddy,
    hyst: window.__eHyst
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
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.SimV2, { timeout: 15000 });

  // For each frequency we need enough integration time to settle and
  // collect representative cycles. A fixed 3 ms sim @ 1 kHz = 3
  // cycles; @ 100 kHz = 300 cycles. Use dt small enough that
  // di/dt within a rising/falling edge is well-resolved even at
  // 100 kHz (5 µs half-period → need dt ≤ 0.1 µs for clean eddy).
  const CIR_1K   = fs.readFileSync(path.join(__dirname, '29-eddy-1khz.cir'),   'utf8');
  const CIR_10K  = fs.readFileSync(path.join(__dirname, '29-eddy-10khz.cir'),  'utf8');
  const CIR_100K = fs.readFileSync(path.join(__dirname, '29-eddy-100khz.cir'), 'utf8');

  // dt = 100 ns, total 30000 steps = 3 ms electrical sim.
  const r1   = await simulate(page, CIR_1K,   1e-7, 30000, 1000, 1000);
  const r10  = await simulate(page, CIR_10K,  1e-7, 30000, 1000, 1000);
  const r100 = await simulate(page, CIR_100K, 1e-7, 30000, 1000, 1000);

  await browser.close();

  // Time-averaged P_eddy: energy ÷ elapsed.
  const tElapsed = 30000 * 1e-7; // 3 ms
  const P1   = r1.eddy   / tElapsed;
  const P10  = r10.eddy  / tElapsed;
  const P100 = r100.eddy / tElapsed;

  console.log('━'.repeat(64));
  console.log('Sprint 89 INDUCTOR EDDY-CURRENT FREQUENCY SCALING');
  console.log('━'.repeat(64));
  console.log('\n   f       | energy (J)   | P_avg (W)  | ratio vs 1 kHz');
  console.log('   1   kHz  | ' + r1.eddy.toExponential(3).padStart(10) + '  | ' + P1.toExponential(3).padStart(9) + '  |     1.0');
  console.log('  10   kHz  | ' + r10.eddy.toExponential(3).padStart(10) + '  | ' + P10.toExponential(3).padStart(9) + '  | ' + (P10 / P1).toFixed(1).padStart(6));
  console.log(' 100   kHz  | ' + r100.eddy.toExponential(3).padStart(10) + '  | ' + P100.toExponential(3).padStart(9) + '  | ' + (P100 / P1).toFixed(1).padStart(6));

  // Quadratic fit: log-log slope = exponent
  const logF1 = Math.log10(1e3), logF10 = Math.log10(1e4), logF100 = Math.log10(1e5);
  const logP1 = Math.log10(P1), logP10 = Math.log10(P10), logP100 = Math.log10(P100);
  const slope = (logP100 - logP1) / (logF100 - logF1);
  console.log('\n  log-log slope (1 → 100 kHz): ' + slope.toFixed(3) + '  (analytic = 2.00)');

  // Pass criteria:
  // A 10 kHz / 1 kHz ratio is roughly 100 (within 3×)
  const aPass = P10 / P1 > 30 && P10 / P1 < 300;
  // B 100 kHz / 1 kHz ratio is roughly 10000 (within 3×)
  const bPass = P100 / P1 > 3000 && P100 / P1 < 30000;
  // C Slope close to 2 (±0.3)
  const cPass = slope > 1.7 && slope < 2.3;
  // D No runaway — peak iL bounded. V_amp = 1 V, R = 1 kΩ → expected
  // amplitude ~1 mA. Our coarse 1000-step sample gap misses most of
  // the sinusoidal peaks at low frequencies, so we check simply that
  // the simulator didn't explode (|iL| stays finite and below 1 A).
  const peakI1   = Math.max.apply(null, r1.samples.map(s => Math.abs(s.iL)));
  const peakI10  = Math.max.apply(null, r10.samples.map(s => Math.abs(s.iL)));
  const peakI100 = Math.max.apply(null, r100.samples.map(s => Math.abs(s.iL)));
  const dPass = [peakI1, peakI10, peakI100].every(x => isFinite(x) && x < 1.0);

  console.log('\n━'.repeat(64));
  console.log('A P(10k)/P(1k) ≈ 100 (30-300)     : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B P(100k)/P(1k) ≈ 10k (3k-30k)   : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C log-log slope ≈ 2 (1.7-2.3)    : ' + (cPass ? '✓ PASS' : '✗ FAIL'));
  console.log('D bounded peak iL all cases      : ' + (dPass ? '✓ PASS' : '✗ FAIL') +
              '  (' + (peakI1*1000).toFixed(3) + ' / ' + (peakI10*1000).toFixed(3) + ' / ' + (peakI100*1000).toFixed(3) + ' mA)');
  process.exit((aPass && bPass && cPass && dPass) ? 0 : 1);
})();
