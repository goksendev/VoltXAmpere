#!/usr/bin/env node
// Sprint 78: timing benchmark + correctness spot-check for Bode/Nyquist.
// Loads 16-rc-lowpass.cir, runs runBode() (new AC-MNA backend), samples
// key points, then repeats with a simulated transient-mimic for comparison.
// The old transient sweep is preserved as a reference implementation inline
// so the regression comparison is apples-to-apples.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CIR = fs.readFileSync(path.join(__dirname, '16-rc-lowpass.cir'), 'utf8');
const url = process.env.VXA_URL || 'http://localhost:8765/index.html';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console',   m => { if (m.type() === 'error') console.error('[page.err]', m.text()); });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined'
       && typeof VXA.ACAnalysis !== 'undefined'
       && typeof runBode === 'function'
       && typeof runNyquist === 'function',
    { timeout: 15000 }
  );

  const report = await page.evaluate((cir) => {
    // Fresh state
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];

    const circuit = VXA.SpiceImport.parse(cir);
    VXA.SpiceImport.placeCircuit(circuit);

    // 1) New AC-MNA backend benchmark
    runBode(10, 1e6, 20);
    const newMs = bodeData && bodeData._elapsedMs ? bodeData._elapsedMs : null;

    // Extract key points: DC gain, gain at f_c=1591 Hz, gain at 10× f_c.
    function gainAt(freqTarget) {
      let best = null, bestDist = Infinity;
      for (let i = 0; i < bodeData.f.length; i++) {
        const d = Math.abs(Math.log10(bodeData.f[i] / freqTarget));
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best !== null ? { f: bodeData.f[best], mag: bodeData.mag[best], phase: bodeData.phase[best] } : null;
    }
    const dcPt      = gainAt(10);
    const fcPt      = gainAt(1591.5);   // analytic f_c
    const tenFcPt   = gainAt(15915);    // a decade above f_c

    // 2) Old transient-sweep reference (inline copy) — same stimulus,
    // identical loop to the pre-Sprint-78 runBode, so we can compare
    // wall time honestly. We do NOT mutate bodeData here.
    function transientSweep() {
      const fStart = 10, fStop = 1e6, ppd = 20;
      const decades = Math.log10(fStop / fStart);
      const total = Math.ceil(decades * ppd);
      buildCircuitFromCanvas();
      const acSrc = SIM.comps.find(c => c.type === 'V' && c.isAC);
      if (!acSrc) return { elapsed: null };
      const origFreq = acSrc.freq;
      const results = [];
      const t0 = performance.now();
      for (let i = 0; i <= total; i++) {
        const f = fStart * Math.pow(10, i / ppd);
        acSrc.freq = f;
        S.sim.t = 0; S._nodeVoltages = null;
        const periods = 5, dt = 1 / (f * 40), stepsPerPeriod = 40;
        const totalSteps = periods * stepsPerPeriod;
        let maxOut = 0, minOut = 1e30;
        for (let s = 0; s < totalSteps; s++) {
          S.sim.t += dt;
          try { solveStep(dt); } catch (e) { break; }
          if (s >= (periods - 2) * stepsPerPeriod && S._nodeVoltages) {
            const vOut = Math.abs(S._nodeVoltages.length > 2
                ? (S._nodeVoltages[2] || 0)
                : (S._nodeVoltages[1] || 0));
            if (vOut > maxOut) maxOut = vOut;
            if (vOut < minOut) minOut = vOut;
          }
        }
        const vpp = maxOut - minOut;
        const gain = acSrc.val > 0 ? (vpp / 2) / acSrc.val : 0;
        const mag = gain > 1e-10 ? 20 * Math.log10(gain) : -100;
        results.push({ f, mag });
      }
      acSrc.freq = origFreq;
      return { elapsed: performance.now() - t0, results };
    }
    const oldBench = transientSweep();

    // 3) Nyquist correctness — run it so the canvas is populated, then
    // confirm first point near (1, 0) (DC pass-through) and last point
    // near (0, 0) (high-freq → infinite attenuation).
    runNyquist(10, 1e6, 20);
    const nyqFirst = nyquistData && nyquistData.re.length > 0
      ? { re: nyquistData.re[0], im: nyquistData.im[0], f: nyquistData.f[0] } : null;
    const nyqLast  = nyquistData && nyquistData.re.length > 0
      ? { re: nyquistData.re[nyquistData.re.length - 1],
          im: nyquistData.im[nyquistData.im.length - 1],
          f:  nyquistData.f[nyquistData.f.length - 1] } : null;
    const nyqMs = nyquistData && nyquistData._elapsedMs ? nyquistData._elapsedMs : null;

    return {
      newMs, oldMs: oldBench.elapsed,
      points: bodeData ? bodeData.f.length : 0,
      dcPt, fcPt, tenFcPt,
      nyqFirst, nyqLast, nyqMs
    };
  }, CIR);

  await browser.close();

  console.log('━'.repeat(64));
  console.log('Sprint 78 BODE / NYQUIST BENCHMARK — 16-rc-lowpass.cir');
  console.log('━'.repeat(64));
  console.log('Sweep points        :', report.points, '(10 Hz → 1 MHz, 20 pts/decade)');
  console.log();
  console.log('Bode backend — new (AC-MNA)    :', report.newMs.toFixed(1), 'ms');
  console.log('Bode backend — old (transient) :', report.oldMs.toFixed(1), 'ms');
  const speedup = report.oldMs / report.newMs;
  console.log('Speedup                        :', speedup.toFixed(1) + '×');
  console.log();
  console.log('── Key Bode points (RC f_c = 1591.5 Hz) ──');
  const p = report.dcPt;
  console.log(`  DC      (f=${p.f.toFixed(1)} Hz)  mag=${p.mag.toFixed(2)} dB   phase=${p.phase.toFixed(1)}°   (exp ~0 dB, 0°)`);
  const q = report.fcPt;
  console.log(`  ≈ f_c   (f=${q.f.toFixed(1)} Hz)  mag=${q.mag.toFixed(2)} dB   phase=${q.phase.toFixed(1)}°   (exp −3 dB, −45°)`);
  const r = report.tenFcPt;
  console.log(`  10·f_c  (f=${r.f.toFixed(1)} Hz)  mag=${r.mag.toFixed(2)} dB   phase=${r.phase.toFixed(1)}°   (exp −20 dB, −84°)`);
  console.log();
  console.log('── Nyquist endpoints ──');
  if (report.nyqFirst)
    console.log(`  ω→0 : Re=${report.nyqFirst.re.toFixed(4)}  Im=${report.nyqFirst.im.toFixed(4)}   (exp ≈ 1, 0)`);
  if (report.nyqLast)
    console.log(`  ω→∞ : Re=${report.nyqLast.re.toFixed(4)}  Im=${report.nyqLast.im.toFixed(4)}   (exp ≈ 0, 0)`);
  if (report.nyqMs !== null) console.log(`  elapsed: ${report.nyqMs.toFixed(1)} ms`);

  console.log();
  // Simple pass criteria
  const dcOk  = Math.abs(report.dcPt.mag)      < 1.0;       // < 1 dB off 0
  const fcOk  = Math.abs(report.fcPt.mag + 3)  < 1.0;       // within 1 dB of −3 dB
  const decOk = Math.abs(report.tenFcPt.mag + 20) < 3.0;    // within 3 dB of −20 dB
  const nyqOk = report.nyqFirst && Math.abs(report.nyqFirst.re - 1) < 0.05 &&
                Math.abs(report.nyqFirst.im) < 0.05 &&
                report.nyqLast  && Math.abs(report.nyqLast.re)  < 0.05 &&
                Math.abs(report.nyqLast.im)  < 0.05;
  console.log('Correctness:', dcOk && fcOk && decOk && nyqOk ? '✓ PASS' : '✗ FAIL',
              '(DC:', dcOk ? '✓' : '✗',
              ' f_c:', fcOk ? '✓' : '✗',
              ' 10f_c:', decOk ? '✓' : '✗',
              ' Nyq:', nyqOk ? '✓' : '✗', ')');
})();
