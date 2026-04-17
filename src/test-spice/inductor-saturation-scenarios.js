#!/usr/bin/env node
// Sprint 82: RL step response — ideal L vs saturating L (Isat=2 A).
//
// Same topology, same supply, only the inductor's Isat attribute
// differs. Expected with L(I) modelling active:
//   • ideal: I(1 ms) ≈ 6.32 A, I(5 ms) ≈ 9.93 A   (τ = 1 ms)
//   • saturating: current crosses 2 A around t ≈ 223 µs (that part
//     matches analytic), then core gives up and I slews toward 10 A
//     distinctly faster than the ideal trajectory.
//
// Pass criteria encoded below: at a comparison instant t=500 µs the
// saturated current must lead the ideal current by at least 10 %;
// part._saturated flag must flip to true on the saturating inductor
// and stay false on the ideal one.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
const CIR_SAT = fs.readFileSync(path.join(__dirname, '19-inductor-saturation.cir'), 'utf8');
const CIR_ID  = fs.readFileSync(path.join(__dirname, '20-inductor-ideal.cir'),       'utf8');

async function simulate(page, cir, totalSteps, chunkSize, sampleEvery) {
  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    // Clean L starting state
    if (SIM && SIM.comps) {
      for (const sc of SIM.comps) if (sc.type === 'L') { sc.iPrev = 0; sc.vPrev = 0; }
    }
    // Keep S.sim.running = false so the app's render-loop
    // simulationStep doesn't also advance S.sim.t in parallel with
    // our manual chunked driver — that double-stepping is what made
    // the sample timestamps drift away from integer multiples of dt.
    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;
    window.__lSamples = [];
  }, cir);

  let step = 0;
  while (step < totalSteps) {
    const end = Math.min(step + chunkSize, totalSteps);
    await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const lPart = S.parts.find(p => p.type === 'inductor');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        if (i % sampleEvery === 0) {
          const comp = SIM.comps.find(c => c.type === 'L');
          window.__lSamples.push({
            t:        S.sim.t,
            iL:       comp ? (comp.iPrev || 0) : 0,
            L_eff:    lPart ? (lPart._L_eff || null) : null,
            saturated: !!(lPart && lPart._saturated),
            Isat:     lPart && lPart.Isat,
            satExp:   lPart && lPart.satExp
          });
        }
      }
    }, { start: step, end, dt: 1e-5, sampleEvery });
    step = end;
  }

  return await page.evaluate(() => {
    S.sim.running = false;
    return window.__lSamples;
  });
}

function analyticI(t) { return 10 * (1 - Math.exp(-t / 1e-3)); }

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

  // dt = 10 µs, 1000 steps → 10 ms sim. Sample every 10 steps (= every 100 µs).
  const idealSamples   = await simulate(page, CIR_ID,  1000, 100, 10);
  const saturatedSamples = await simulate(page, CIR_SAT, 1000, 100, 10);

  await browser.close();

  function at(ms, samples) {
    const tgt = ms * 1e-3;
    let best = samples[0], bd = Infinity;
    for (const s of samples) {
      const d = Math.abs(s.t - tgt);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  console.log('━'.repeat(60));
  console.log('Sprint 82 INDUCTOR SATURATION SCENARIOS');
  console.log('━'.repeat(60));

  const CMP_MS = [0.1, 0.2, 0.3, 0.5, 1.0, 2.0, 5.0];
  console.log('\n t(ms) |  I_ideal  I_analyt |  I_sat   L_eff (H)    sat?');
  for (const ms of CMP_MS) {
    const ai = at(ms, idealSamples), as = at(ms, saturatedSamples);
    const analy = analyticI(ms * 1e-3);
    console.log(
      '  ' + ms.toFixed(2).padStart(4) + ' | ' +
      ai.iL.toFixed(3).padStart(6) + '   ' + analy.toFixed(3).padStart(6) + ' | ' +
      as.iL.toFixed(3).padStart(6) + '  ' +
      (as.L_eff !== null ? as.L_eff.toExponential(2) : '—').padStart(11) + '   ' +
      (as.saturated ? 'YES' : ' no')
    );
  }

  // Pass criteria
  // 1) Ideal matches analytic within 2 % at t=1 ms
  const idAt1  = at(1.0, idealSamples).iL;
  const analAt1 = analyticI(1e-3);
  const idealOK = Math.abs(idAt1 - analAt1) / analAt1 < 0.02;

  // 2) Saturated current is strictly higher than ideal at t=500 µs (past the knee)
  const idAt05  = at(0.5, idealSamples).iL;
  const satAt05 = at(0.5, saturatedSamples).iL;
  const satLead = (satAt05 - idAt05) / Math.max(idAt05, 1e-9);

  // 3) Saturation flag flips true somewhere in the saturating run, stays false in ideal
  const satFlag = saturatedSamples.some(s => s.saturated);
  const noIdealFlag = idealSamples.every(s => !s.saturated);

  // 4) L_eff on the saturating part dropped noticeably at the knee
  const peakLeff = saturatedSamples.reduce((m, s) => s.L_eff !== null && s.L_eff > m ? s.L_eff : m, 0);
  const minLeff  = saturatedSamples.reduce((m, s) => s.L_eff !== null && s.L_eff < m ? s.L_eff : m, peakLeff);
  const lRatio   = minLeff / Math.max(peakLeff, 1e-30);

  console.log('\n───');
  console.log(' ideal @ 1 ms         : ' + idAt1.toFixed(3) + ' A  (analytic ' + analAt1.toFixed(3) + ')');
  console.log(' saturated @ 500 µs   : ' + satAt05.toFixed(3) + ' A  (ideal ' + idAt05.toFixed(3) + ', lead ' + (satLead * 100).toFixed(1) + '%)');
  console.log(' saturated L_eff range: ' + peakLeff.toExponential(2) + ' → ' + minLeff.toExponential(2) + '  (' + (lRatio * 100).toFixed(1) + '%)');
  console.log(' flag set (sat/ideal) : ' + satFlag + ' / ' + (noIdealFlag ? 'no-false-positive' : 'FLAGGED (bug)'));

  const aPass = idealOK;
  const bPass = satLead > 0.10;
  const cPass = satFlag && noIdealFlag;
  const dPass = lRatio < 0.5;

  console.log('\n━'.repeat(60));
  console.log('A ideal matches analytic (±2%)   : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B saturated leads ideal (>10%)   : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C _saturated flag discrimination : ' + (cPass ? '✓ PASS' : '✗ FAIL'));
  console.log('D L_eff collapses (< 50% of nom) : ' + (dPass ? '✓ PASS' : '✗ FAIL'));
  process.exit((aPass && bPass && cPass && dPass) ? 0 : 1);
})();
