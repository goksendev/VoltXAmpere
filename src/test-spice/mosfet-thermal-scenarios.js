#!/usr/bin/env node
// Sprint 83: MOSFET thermal-coupling sanity.
//
// Two circuits, identical MOSFET + load, differing only in gate drive
// (Vgs). The runaway topology sits at Vov≈1 V where Vth drift dominates
// (positive TC); the safe topology sits at Vov≈2 V where the resistor
// pulls the device into triode and mobility loss dominates (negative
// TC). With coupling active we expect a clean separation in peak Tj.
//
// Chunked evaluate() strategy matches Sprint 82 — keeps each call
// short enough for puppeteer's protocolTimeout, and critically the
// driver keeps S.sim.running = false so the app's render-loop does
// NOT compete with us for S.sim.t increments.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
const CIR_RUN  = fs.readFileSync(path.join(__dirname, '21-mosfet-runaway.cir'), 'utf8');
const CIR_SAFE = fs.readFileSync(path.join(__dirname, '22-mosfet-safe.cir'),    'utf8');

async function simulate(page, cir, totalSteps, chunkSize, sampleEvery) {
  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;
    window.__mosSamples = [];
  }, cir);

  let step = 0;
  while (step < totalSteps) {
    const end = Math.min(step + chunkSize, totalSteps);
    await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const mos = S.parts.find(p => p.type === 'nmos' || p.type === 'pmos');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        // Sprint 83: TO-220 has RthCth τ ≈ 31 s, so at the standard
        // ×50 thermal accel a ~30 ms electrical run buys only ~1.5 s
        // of thermal integration — not long enough to see the coupling
        // pull the two circuits apart. Bump the acceleration 10× for
        // this probe so we reach ~15 s thermal time from the same
        // electrical dt; damage still respects Tmax so nothing unsafe
        // slips through.
        VXA.Thermal.update(dt * 500);
        if (VXA.Damage) VXA.Damage.check(mos);
        S.sim.t += dt;
        if (i % sampleEvery === 0) {
          const th = (mos && mos._thermal) || {};
          window.__mosSamples.push({
            t: S.sim.t,
            Tj: th.T || 0,
            Id: mos ? Math.abs(mos._i || 0) : 0,
            P:  mos ? Math.abs(mos._p || 0) : 0,
            status: th.status || 'normal',
            damaged: !!(mos && mos.damaged)
          });
          if (mos && mos.damaged) return;
        }
      }
    }, { start: step, end, dt: 1e-5, sampleEvery });
    step = end;
  }

  return await page.evaluate(() => {
    S.sim.running = false;
    return { samples: window.__mosSamples };
  });
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
    () => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.Thermal,
    { timeout: 15000 }
  );

  // dt = 10 µs, 3000 steps = 30 ms electrical; thermal ×50 = 1.5 s.
  const runaway = await simulate(page, CIR_RUN,  3000, 250, 50);
  const safe    = await simulate(page, CIR_SAFE, 3000, 250, 50);

  await browser.close();

  function peak(r) {
    var m = 0;
    for (const s of r.samples) if (s.Tj > m) m = s.Tj;
    return m;
  }

  console.log('━'.repeat(64));
  console.log('Sprint 83 MOSFET THERMAL-COUPLING SCENARIOS');
  console.log('━'.repeat(64));

  function dump(name, r) {
    console.log('\n[' + name + ']');
    console.log('   t(s) |  Tj(°C) |  Id(mA) |  P(W)   | status');
    const idxs = [0, Math.floor(r.samples.length/4), Math.floor(r.samples.length/2),
                  Math.floor(3*r.samples.length/4), r.samples.length - 1]
                 .filter((v,i,a) => a.indexOf(v) === i && v >= 0 && v < r.samples.length);
    for (const i of idxs) {
      const s = r.samples[i];
      console.log(
        '   ' + s.t.toFixed(3).padStart(5) +
        ' | ' + s.Tj.toFixed(1).padStart(6) +
        ' | ' + (s.Id * 1000).toFixed(1).padStart(6) +
        ' | ' + s.P.toExponential(2).padStart(8) +
        ' | ' + s.status + (s.damaged ? ' DAMAGED' : '')
      );
    }
  }
  dump('RUNAWAY', runaway);
  dump('SAFE',    safe);

  const runPeak  = peak(runaway);
  const safePeak = peak(safe);
  const delta    = runPeak - safePeak;

  console.log('\n───');
  console.log(' runaway peak Tj : ' + runPeak.toFixed(1) + ' °C');
  console.log(' safe    peak Tj : ' + safePeak.toFixed(1) + ' °C');
  console.log(' Δ               : ' + delta.toFixed(1) + ' °C');

  const aPass = delta >= 10;
  const bPass = !runaway.samples.some(s => s.damaged);
  const cPass = !safe.samples.some(s => s.damaged);

  console.log('\n━'.repeat(64));
  console.log('A runaway leads safe by ≥ 10 °C : ' + (aPass ? '✓ PASS' : '✗ FAIL') +
              '  (Δ = ' + delta.toFixed(1) + ' °C)');
  console.log('B runaway did not hit damage    : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C safe    did not hit damage    : ' + (cPass ? '✓ PASS' : '✗ FAIL'));
  process.exit((aPass && bPass && cPass) ? 0 : 1);
})();
