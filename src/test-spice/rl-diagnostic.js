#!/usr/bin/env node
// Sprint 77 diagnostic: feed a minimal RL decay circuit into the live sim
// and sample I(L1) at t=1µs, 5µs, 10µs, 50µs. Compare against analytic
//   I(t) = I_ss × (1 - exp(-t/τ)),  τ = L/R = 1µs, I_ss = 10 mA.
//
// Expected — correct BE/TRAP sign:
//   t=1µs    I≈6.32 mA
//   t=5µs    I≈9.93 mA
//   t=10µs   I≈9.9995 mA
//   t=50µs   I≈10.0 mA (saturated)
//
// Symptom if sign flipped on inductor historic-source stamp:
//   I grows exponentially and either blows up or gets clamped by gmin.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CIR = fs.readFileSync(path.join(__dirname, '14-rl-decay.cir'), 'utf8');
const url = process.env.VXA_URL || 'http://localhost:8765/index.html';

// Sample times (seconds).  τ = 1µs.
const SAMPLES_S = [1e-6, 5e-6, 1e-5, 5e-5, 1e-4];
const DT        = 1e-7;   // 100 ns — comfortably below τ/10

function analyticI(t) {
  return 10e-3 * (1 - Math.exp(-t / 1e-6));
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console',   m => { if (m.type() === 'error') console.error('[page.err]', m.text()); });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined'
       && typeof VXA.SpiceImport !== 'undefined'
       && typeof VXA.SimV2 !== 'undefined'
       && typeof S !== 'undefined',
    { timeout: 15000 }
  );

  const report = await page.evaluate(
    ({ cir, dt, sampleTimes }) => {
      // --- Fresh state ---
      S.parts = [];
      S.wires = [];
      S.nextId = 1;
      S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];

      const circuit = VXA.SpiceImport.parse(cir);
      VXA.SpiceImport.placeCircuit(circuit);

      // Build netlist, establish DC operating point (I_L should be 0 at t=0)
      buildCircuitFromCanvas();
      if (VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint();

      // Force iPrev = 0 for clean startup (DC op point may have pre-converged it)
      if (typeof SIM !== 'undefined' && SIM && SIM.comps) {
        for (const c of SIM.comps) {
          if (c.type === 'L') { c.iPrev = 0; c.vPrev = 0; }
          if (c.type === 'C') { c.vPrev = 0; c.iPrev = 0; }
        }
      }

      // Reset sim clock
      S.sim.t = 0;
      S.sim.running = true;
      if (S.sim.error) S.sim.error = null;

      // Identify the L1 component in SIM.comps
      let lIdx = -1;
      if (SIM && SIM.comps) {
        for (let i = 0; i < SIM.comps.length; i++) {
          if (SIM.comps[i].type === 'L') { lIdx = i; break; }
        }
      }

      const samples = [];
      let nextSampleIdx = 0;
      const maxT = Math.max(...sampleTimes) + dt;
      const maxSteps = Math.ceil(maxT / dt) + 10;

      for (let step = 0; step < maxSteps; step++) {
        VXA.SimV2.solve(dt);
        if (S.sim.error) {
          samples.push({ t: S.sim.t, i: null, err: S.sim.error });
          break;
        }
        S.sim.t += dt;
        // Log sample if we've crossed the next sample time
        while (nextSampleIdx < sampleTimes.length
               && S.sim.t >= sampleTimes[nextSampleIdx] - dt * 0.5) {
          const iL = (lIdx >= 0 && SIM.comps[lIdx])
                     ? (SIM.comps[lIdx].iPrev || 0)
                     : null;
          samples.push({ t: S.sim.t, i: iL, err: null });
          nextSampleIdx++;
        }
        if (nextSampleIdx >= sampleTimes.length) break;
      }

      // Dump the raw stamp code path being exercised (TRAP vs BE)
      const method = VXA.SimV2.getSimMethod ? VXA.SimV2.getSimMethod() : 'unknown';

      return {
        parts: S.parts.map(p => p.type),
        simComps: (SIM && SIM.comps) ? SIM.comps.map(c => ({
          type: c.type, val: c.val, n1: c.n1, n2: c.n2
        })) : [],
        method: method,
        samples: samples,
        finalError: S.sim.error || null
      };
    },
    { cir: CIR, dt: DT, sampleTimes: SAMPLES_S }
  );

  await browser.close();

  console.log('━'.repeat(60));
  console.log('Sprint 77 RL DIAGNOSTIC');
  console.log('━'.repeat(60));
  console.log('Parts         :', report.parts.join(', '));
  console.log('SIM comps     :', JSON.stringify(report.simComps, null, 2));
  console.log('Sim method    :', report.method);
  console.log('Final error   :', report.finalError);
  console.log('');
  console.log('┌────────────┬───────────────┬───────────────┬──────────────┐');
  console.log('│    t (s)   │   I_meas (A)  │  I_analyt (A) │   |ratio|    │');
  console.log('├────────────┼───────────────┼───────────────┼──────────────┤');
  for (const s of report.samples) {
    const analy = analyticI(s.t);
    const ratio = s.i !== null && analy !== 0 ? s.i / analy : NaN;
    console.log(
      '│ ' + s.t.toExponential(3).padStart(10) +
      ' │ ' + (s.i === null ? 'null'.padStart(13) : s.i.toExponential(4).padStart(13)) +
      ' │ ' + analy.toExponential(4).padStart(13) +
      ' │ ' + (isFinite(ratio) ? ratio.toFixed(4).padStart(12) : ' — '.padStart(12)) +
      ' │'
    );
    if (s.err) console.log('  err:', s.err);
  }
  console.log('└────────────┴───────────────┴───────────────┴──────────────┘');

  // Diagnosis
  console.log('');
  let verdict;
  const first = report.samples[0];
  const last  = report.samples[report.samples.length - 1];
  if (report.finalError) {
    verdict = 'DIVERGENCE (error surfaced) — sign hypothesis SUPPORTED';
  } else if (!first || first.i === null) {
    verdict = 'UNKNOWN — no sample';
  } else if (!isFinite(first.i) || Math.abs(first.i) > 1) {
    verdict = 'EXPLOSIVE GROWTH — sign CONFIRMED';
  } else if (first.i < 0 && Math.abs(first.i) > 1e-4) {
    verdict = 'NEGATIVE CURRENT (wrong direction) — sign CONFIRMED';
  } else if (last && isFinite(last.i) && Math.abs(last.i - 10e-3) < 1e-4) {
    verdict = 'SETTLES TO 10 mA — sign HYPOTHESIS REFUTED (other bug)';
  } else if (last && isFinite(last.i) && last.i > 0.1) {
    verdict = 'CURRENT DRIFTS HIGH — sign suspected';
  } else {
    verdict = 'PARTIAL — compare analytic column above';
  }
  console.log('VERDICT:', verdict);
})();
