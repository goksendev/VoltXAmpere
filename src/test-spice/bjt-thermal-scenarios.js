#!/usr/bin/env node
// Sprint 81: BJT thermal-runaway vs thermal-safe sanity runs.
//
// Puppeteer's per-call Runtime.callFunctionOn protocolTimeout is the
// bottleneck when the sim loop is large. We drive the simulation in
// ~250-step chunks from the Node side so each evaluate() stays short
// enough (well under 1 s) regardless of total simulated time.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR_RUN  = fs.readFileSync(path.join(__dirname, '17-bjt-runaway-demo.cir'), 'utf8');
const CIR_SAFE = fs.readFileSync(path.join(__dirname, '18-bjt-safe.cir'),         'utf8');

async function simulateCircuit(page, cir, totalSteps, chunkSize, sampleEvery) {
  // Set up circuit + starting state inside the browser.
  // Skip findDCOperatingPoint — it's optional warmup and the first
  // few solve() calls establish the operating point on their own.
  // More importantly, hard-limit the setup work in this evaluate so
  // puppeteer's protocolTimeout never trips here.
  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    S.sim.t = 0;
    S.sim.running = true;
    window.__bjtSamples = [];
  }, cir);

  let done  = false;
  let step  = 0;
  while (step < totalSteps && !done) {
    const end = Math.min(step + chunkSize, totalSteps);
    done = await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const bjt = S.parts.find(p => p.type === 'npn' || p.type === 'pnp');
      if (!bjt) return true;
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        VXA.Thermal.update(dt * 50);     // match sim-legacy.js 50× accel
        if (VXA.Damage) VXA.Damage.check(bjt);
        S.sim.t += dt;
        if (i % sampleEvery === 0) {
          const th = bjt._thermal || {};
          window.__bjtSamples.push({
            t:       S.sim.t,
            Tj:      th.T || 0,
            P:       Math.abs(bjt._p || 0),
            Ic:      Math.abs(bjt._i || 0),
            status:  th.status || 'normal',
            damaged: !!bjt.damaged
          });
          if (bjt.damaged) return true;
        }
      }
      return false;
    }, { start: step, end, dt: 1e-4, sampleEvery });
    step = end;
  }

  return await page.evaluate(() => {
    const bjt = S.parts.find(p => p.type === 'npn' || p.type === 'pnp');
    const th  = bjt && bjt._thermal ? bjt._thermal : {};
    const samples = window.__bjtSamples;
    S.sim.running = false;
    return {
      Tmax:        th.Tmax || 150,
      samples:     samples,
      final:       samples[samples.length - 1] || null,
      damaged:     !!(bjt && bjt.damaged),
      damageCause: (bjt && bjt.damageCause) || null
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.Thermal,
    { timeout: 15000 }
  );

  // 5000 steps × 1e-4 s electrical = 0.5 s; thermal accel ×50 = 25 s.
  // 250-step chunks keep each evaluate() under ~50 ms.
  const runaway = await simulateCircuit(page, CIR_RUN,  5000, 250, 100);
  const safe    = await simulateCircuit(page, CIR_SAFE, 5000, 250, 100);

  await browser.close();

  console.log('━'.repeat(64));
  console.log('Sprint 81 BJT THERMAL-COUPLING SCENARIOS');
  console.log('━'.repeat(64));

  function dump(name, r) {
    console.log('\n[' + name + '] Tmax = ' + r.Tmax + ' °C');
    console.log('   t(s)  |  Tj(°C) |   P(W)   |  Ic(mA) | status');
    const keyIdx = [0, Math.floor(r.samples.length/4), Math.floor(r.samples.length/2),
                    Math.floor(3*r.samples.length/4), r.samples.length - 1]
                    .filter((v,i,a) => a.indexOf(v) === i && v >= 0 && v < r.samples.length);
    for (const i of keyIdx) {
      const s = r.samples[i];
      if (!s) continue;
      console.log(
        '   ' + s.t.toFixed(3).padStart(5) +
        '  | ' + s.Tj.toFixed(1).padStart(6) +
        ' | ' + s.P.toExponential(2).padStart(8) +
        ' | ' + (s.Ic * 1000).toFixed(2).padStart(7) +
        ' | ' + s.status + (s.damaged ? ' DAMAGED' : '')
      );
    }
    console.log('  → final Tj:', r.final && r.final.Tj.toFixed(1) + '°C',
                ' damaged:', r.damaged, ' cause:', r.damageCause);
  }
  dump('RUNAWAY', runaway);
  dump('SAFE',    safe);

  // Pass criteria: the whole point of Sprint 81 is "junction temperature
  // feeds back into the electrical model". A pure-electrical run would
  // heat both circuits identically (there's no current dependence on T).
  // With the coupling active we expect the runaway-prone topology to
  // reach substantially higher Tj than the degenerated one.
  //
  // • runaway: peak Tj > 50 °C  (doubled over ambient; the old static
  //   model would only heat to ~ambient+P×Rth, which for this circuit
  //   is ~55°C peak either way, but *maintaining* that level requires
  //   the coupling — without it NR just lands at Ic≈39 mA once).
  // • runaway peak Tj > safe peak Tj + 15 °C  (unambiguous separation)
  // • safe: peak Tj < 60 °C, no damage
  function peakTj(r) {
    var mx = 0;
    for (var i = 0; i < r.samples.length; i++) {
      if (r.samples[i].Tj > mx) mx = r.samples[i].Tj;
    }
    return mx;
  }
  var runPeak = peakTj(runaway), safePeak = peakTj(safe);
  const aPass = runPeak > 50 && (runPeak - safePeak) > 15;
  const bPass = !safe.damaged && safePeak < 60;

  console.log('\n━'.repeat(64));
  console.log('  peak Tj — runaway: ' + runPeak.toFixed(1) + '°C   safe: ' + safePeak.toFixed(1) + '°C   Δ: ' + (runPeak - safePeak).toFixed(1) + '°C');
  console.log('A runaway drives hotter    : ' + (aPass ? '✓ PASS' : '✗ FAIL') +
              '  (peak Tj=' + runPeak.toFixed(1) + '°C, damaged=' + runaway.damaged + ')');
  console.log('B safe stays cool          : ' + (bPass ? '✓ PASS' : '✗ FAIL') +
              '  (peak Tj=' + safePeak.toFixed(1) + '°C, damaged=' + safe.damaged + ')');
  process.exit((aPass && bPass) ? 0 : 1);
})();
