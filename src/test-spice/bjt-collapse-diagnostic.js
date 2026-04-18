#!/usr/bin/env node
// Sprint 97 diagnostic: run 17-bjt-runaway-demo.cir to t = 0.5 s with
// dense Ic(t) sampling (every 1 ms) and find any NR collapse where
// collector current drops to near-zero despite the transistor being
// forward-biased. Sprint 81 documented this at t ≈ 0.26 s — this
// probe confirms whether it still exists after Sprints 85, 86, 96
// and gives the exact collapse signature PTC has to defeat.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR  = fs.readFileSync(path.join(__dirname, '17-bjt-runaway-demo.cir'), 'utf8');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.Thermal, { timeout: 15000 });

  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    S.sim.t = 0;
    S.sim.running = true;
    window.__diag = [];
  }, CIR);

  const DT = 1e-4;
  const TOTAL = 5000;   // 0.5 s electrical (×50 thermal accel = 25 s)
  const SAMPLE_EVERY = 10;   // every 10 × 1e-4 = 1 ms
  const CHUNK = 500;

  let step = 0;
  while (step < TOTAL) {
    const end = Math.min(step + CHUNK, TOTAL);
    await page.evaluate(({ start, end, dt, sampleEvery }) => {
      const bjt = S.parts.find(p => p.type === 'npn' || p.type === 'pnp');
      for (let i = start; i < end; i++) {
        VXA.SimV2.solve(dt);
        VXA.Thermal.update(dt * 50);
        S.sim.t += dt;
        if (i % sampleEvery === 0 && bjt) {
          const th = bjt._thermal || {};
          window.__diag.push({
            t: S.sim.t,
            Tj: th.T || 0,
            Ic: bjt._i || 0,
            Vce: bjt._v || 0,
            P: bjt._p || 0,
            nrIter: VXA.SimV2.getNRIter ? VXA.SimV2.getNRIter() : 0,
            converged: VXA.SimV2.getConverged ? VXA.SimV2.getConverged() : true,
            simError: S.sim.error || null
          });
        }
      }
    }, { start: step, end, dt: DT, sampleEvery: SAMPLE_EVERY });
    step = end;
  }

  const samples = await page.evaluate(() => window.__diag);
  const ptcDebug = await page.evaluate(() => window.__ptcDebug || []);
  await browser.close();

  console.log('━'.repeat(78));
  console.log('Sprint 97 BJT COLLAPSE DIAGNOSTIC');
  console.log('━'.repeat(78));
  console.log('   t(s)   |  Tj(°C) |  Ic(mA) | Vce(V)  |  P(W)  | NRit | conv');
  console.log('  ' + '-'.repeat(72));

  // Print key samples + scan for any collapse (Ic drops below 50 % of
  // the previous sample while Tj still hot).
  let collapseTime = null, prevIc = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const showRow = (i % 50 === 0) || (prevIc > 1e-3 && s.Ic < 0.5 * prevIc && s.Tj > 40);
    if (prevIc > 1e-3 && s.Ic < 0.5 * prevIc && s.Tj > 40 && collapseTime === null) {
      collapseTime = s.t;
    }
    if (showRow) {
      const tag = (collapseTime && Math.abs(s.t - collapseTime) < 0.002) ? ' ← COLLAPSE' : '';
      console.log(
        '  ' + s.t.toFixed(4).padStart(7) +
        ' | ' + s.Tj.toFixed(1).padStart(6) +
        ' | ' + (Math.abs(s.Ic) * 1000).toFixed(3).padStart(7) +
        ' | ' + s.Vce.toFixed(3).padStart(6) +
        ' | ' + s.P.toExponential(2).padStart(7) +
        ' | ' + String(s.nrIter).padStart(4) +
        ' | ' + (s.converged ? 'yes' : ' NO') +
        tag
      );
    }
    prevIc = Math.abs(s.Ic);
  }

  console.log('  ' + '-'.repeat(72));
  console.log('  samples        : ' + samples.length);
  console.log('  peak Ic        : ' + (Math.max.apply(null, samples.map(s => Math.abs(s.Ic))) * 1000).toFixed(3) + ' mA');
  console.log('  peak Tj        : ' + Math.max.apply(null, samples.map(s => s.Tj)).toFixed(1) + ' °C');
  console.log('  final Ic       : ' + (Math.abs(samples[samples.length - 1].Ic) * 1000).toFixed(3) + ' mA');
  console.log('  final Tj       : ' + samples[samples.length - 1].Tj.toFixed(1) + ' °C');
  console.log('  max NR iter    : ' + Math.max.apply(null, samples.map(s => s.nrIter)));
  const divergences = samples.filter(s => !s.converged).length;
  console.log('  non-converged  : ' + divergences + ' / ' + samples.length);
  console.log('  collapse event : ' + (collapseTime !== null ? ('t = ' + collapseTime.toFixed(4) + ' s') : 'NONE DETECTED'));
  if (ptcDebug.length > 0) {
    console.log('  PTC events     : ' + ptcDebug.length);
    ptcDebug.slice(0, 10).forEach(function(d) {
      console.log('    ' + JSON.stringify(d));
    });
    if (ptcDebug.length > 10) console.log('    ... (' + (ptcDebug.length - 10) + ' more)');
  } else {
    console.log('  PTC events     : none fired');
  }
  console.log('━'.repeat(78));
})().catch(e => { console.error(e); process.exit(1); });
