#!/usr/bin/env node
// Sprint 88: Curie-point derating of inductor Isat.
//
// The same circuit (Isat=2 A, T_curie=220 °C default β=2) is run at
// three ambient / pinned-Tj temperatures:
//   • 25 °C  → derate ≈ 0.987 → Sprint-82 baseline preserved
//   • 100 °C → derate ≈ 0.793 → knee rolls in ~20 % earlier
//   • 180 °C → derate ≈ 0.331 → knee rolls in much earlier
//
// We measure the current at which L_eff drops to 50 % of L_nom (the
// saturation "knee") in each run. The knee current should track
// Isat_eff(T) = Isat · (1 − (T/T_curie)^β).

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR = fs.readFileSync(path.join(__dirname, '28-inductor-tcurie.cir'), 'utf8');

async function runAtTemp(page, Tc_celsius, totalSteps, chunkSize, sampleEvery) {
  await page.evaluate(({ cir, Tc }) => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
    buildCircuitFromCanvas();
    // Pin the inductor temperature. ensureThermal lazily seeds; we
    // create the entry and fix it at Tc for the whole run.
    const L = S.parts.find(p => p.type === 'inductor');
    if (!L._thermal) VXA.Thermal.ensureThermal(L);
    L._thermal.T = Tc;
    if (SIM && SIM.comps) {
      for (const sc of SIM.comps) if (sc.type === 'L') { sc.iPrev = 0; sc.vPrev = 0; }
    }
    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;
    window.__cSamples = [];
  }, { cir: CIR, Tc: Tc_celsius });

  let step = 0;
  while (step < totalSteps) {
    const end = Math.min(step + chunkSize, totalSteps);
    await page.evaluate(({ start, end, dt, sampleEvery, Tc }) => {
      const L = S.parts.find(p => p.type === 'inductor');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        // Re-pin temperature in case thermal update nudges it.
        if (L && L._thermal) L._thermal.T = Tc;
        if (i % sampleEvery === 0) {
          const comp = SIM.comps.find(c => c.type === 'L');
          window.__cSamples.push({
            t: S.sim.t,
            iL: comp ? (comp.iPrev || 0) : 0,
            L_eff: L ? (L._L_eff || null) : null,
            IsatEff: L ? (L._IsatEff || null) : null
          });
        }
      }
    }, { start: step, end, dt: 1e-5, sampleEvery, Tc: Tc_celsius });
    step = end;
  }

  return await page.evaluate(() => window.__cSamples);
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

  // dt = 10 µs, 1000 steps = 10 ms sim per sweep. Sample EVERY step
  // (sampleEvery=1) so knee detection has 10 µs resolution — the 25
  // vs 100 °C knee delta is about 47 µs, which needs finer sampling
  // than the default 100 µs grid.
  const cold = await runAtTemp(page,  25, 1000, 100, 1);
  const warm = await runAtTemp(page, 100, 1000, 100, 1);
  const hot  = await runAtTemp(page, 180, 1000, 100, 1);

  await browser.close();

  function kneeTimeUs(samples, IsatEff) {
    // When the current first reaches IsatEff, L_eff has already
    // dropped by exactly 2× (the formula's 50 %-point). So the time
    // at which iL first crosses IsatEff is the cleanest
    // temperature-sensitive knee marker. Colder Isat → higher knee
    // current → later in the transient. Hotter → earlier.
    for (const s of samples) {
      if (Math.abs(s.iL) >= IsatEff) return s.t * 1e6;
    }
    return NaN;
  }

  const IsatEffCold = cold.length > 0 ? cold[cold.length - 1].IsatEff : null;
  const IsatEffWarm = warm.length > 0 ? warm[warm.length - 1].IsatEff : null;
  const IsatEffHot  = hot.length > 0  ? hot [hot.length  - 1].IsatEff : null;
  const tCold = kneeTimeUs(cold, IsatEffCold);
  const tWarm = kneeTimeUs(warm, IsatEffWarm);
  const tHot  = kneeTimeUs(hot,  IsatEffHot);

  console.log('━'.repeat(64));
  console.log('Sprint 88 INDUCTOR Isat(T) — CURIE DERATING');
  console.log('━'.repeat(64));
  console.log('\n  T (°C) | IsatEff (A) | knee_t (µs) | samples');
  console.log('   25     | ' + (IsatEffCold != null ? IsatEffCold.toFixed(3) : '—').padEnd(11) + ' | ' + tCold.toFixed(1).padStart(6) + '    | ' + cold.length);
  console.log('  100     | ' + (IsatEffWarm != null ? IsatEffWarm.toFixed(3) : '—').padEnd(11) + ' | ' + tWarm.toFixed(1).padStart(6) + '    | ' + warm.length);
  console.log('  180     | ' + (IsatEffHot != null ? IsatEffHot.toFixed(3) : '—').padEnd(11) + ' | ' + tHot.toFixed(1).padStart(6) + '    | ' + hot.length);

  // Analytic predictions at T_curie=220, β=2, Isat0=2:
  const pred = (T) => 2 * (1 - Math.pow(T / 220, 2));
  console.log('\n  analytic Isat_eff — 25 °C:', pred(25).toFixed(3), '  100 °C:', pred(100).toFixed(3), '  180 °C:', pred(180).toFixed(3));

  // Pass criteria
  // A cold IsatEff matches Sprint-82 baseline (derate ≈ 1.0)
  const aPass = IsatEffCold != null && Math.abs(IsatEffCold - pred(25)) < 0.1;
  // B hot IsatEff matches formula within 0.2 A
  const bPass = IsatEffHot != null && Math.abs(IsatEffHot - pred(180)) < 0.2;
  // C knee time monotonically DROPS as T rises — hotter core
  // saturates sooner in the step response.
  const cPass = tCold > tWarm + 1 && tWarm > tHot + 1;
  // D hot run doesn't diverge (peak current finite, sane)
  const hotPeakI = Math.max.apply(null, hot.map(s => Math.abs(s.iL)));
  const dPass = isFinite(hotPeakI) && hotPeakI > 0.5 && hotPeakI < 20;

  console.log('\n━'.repeat(64));
  console.log('A cold IsatEff ≈ baseline (|Δ|<0.1) : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B hot IsatEff ≈ analytic (|Δ|<0.2) : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C knee time drops with T            : ' + (cPass ? '✓ PASS' : '✗ FAIL') +
              '  (25°C=' + tCold.toFixed(1) + 'µs 100°C=' + tWarm.toFixed(1) + 'µs 180°C=' + tHot.toFixed(1) + 'µs)');
  console.log('D hot run bounded                    : ' + (dPass ? '✓ PASS' : '✗ FAIL') +
              '  (peak iL=' + hotPeakI.toFixed(2) + ' A)');
  process.exit((aPass && bPass && cPass && dPass) ? 0 : 1);
})();
