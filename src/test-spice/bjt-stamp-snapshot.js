#!/usr/bin/env node
// Sprint 98 diagnostic: dump the Gummel-Poon stamp state around
// the Sprint 81 collapse (t ≈ 0.257 s) so we can tell whether
// Is(T) is overflowing (Hypothesis A), the stamp's hard Vbe
// clamp is creating rhs/Jacobian inconsistency (new hypothesis
// from code walk-through), or something else entirely.
//
// Strategy:
//   1. Run the circuit to t = 0.255 s (just before collapse).
//   2. Snapshot nodeV, Tj, Is(T), Vt(T), vbe pre-clamp, vbe post-
//      clamp, Icc, gm_f, qb.
//   3. Advance 5 more timesteps (0.5 ms) with the same snapshots
//      at every step. One of these is the collapse step.
//   4. Print the evolution — the step where Icc drops from ~138 mA
//      to ~0 is the one we care about, and the delta on each
//      stamp variable tells us which one triggered it.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR = fs.readFileSync(path.join(__dirname, '17-bjt-runaway-demo.cir'), 'utf8');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.Thermal, { timeout: 15000 });

  // Set up circuit + run to t ≈ 0.253 s (a hair before the known
  // collapse so we can watch the transition).
  await page.evaluate(c => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(c));
    buildCircuitFromCanvas();
    S.sim.t = 0;
    S.sim.running = false;
  }, CIR);

  const DT = 1e-4;
  // 2530 steps @ 1e-4 s = 0.253 s electrical, ×50 thermal accel.
  await page.evaluate(function(dt) {
    for (let i = 0; i < 2530; i++) {
      VXA.SimV2.solve(dt);
      VXA.Thermal.update(dt * 50);
      S.sim.t += dt;
    }
  }, DT);

  // Now step one at a time with full snapshots for 60 ms (600 steps).
  // That covers the collapse window (typically t = 0.253 → 0.26 s).
  const snapshots = [];
  for (let k = 0; k < 600; k++) {
    const snap = await page.evaluate(function(dt) {
      const bjt = S.parts.find(p => p.type === 'npn' || p.type === 'pnp');
      if (!bjt) return null;

      // Pre-step diagnostic capture via the stamp's own math.
      const Tj = (bjt._thermal && bjt._thermal.T) || 25;
      const TjK = Tj + 273.15;
      const BOLTZMANN_eV = 8.617333e-5;
      const Eg = 1.12;
      const Tref = 300;
      const TjK_clamped = Math.max(150, Math.min(500, TjK));
      const VT = BOLTZMANN_eV * TjK_clamped;
      const model = bjt.model ? VXA.Models.getModel(bjt.type, bjt.model) : null;
      const IS0 = (model && model.IS) || 1e-14;
      const Tr = TjK_clamped / Tref;
      const expArg = Math.min(80, Eg / BOLTZMANN_eV * (1 / Tref - 1 / TjK_clamped));
      const IS = IS0 * Math.pow(Tr, 3) * Math.exp(expArg);
      const NF = (model && model.NF) || 1;
      const nVt = NF * VT;

      // Actual node voltages.
      const comp = SIM.comps.find(c => c.type === 'BJT');
      const pol = comp ? comp.polarity : 1;
      const vB = S._nodeVoltages[comp ? comp.n1 : 0] || 0;
      const vC = S._nodeVoltages[comp ? comp.n2 : 0] || 0;
      const vE = S._nodeVoltages[comp ? comp.n3 : 0] || 0;
      const vbe_raw = pol * (vB - vE);
      const vbe_clamped = Math.min(vbe_raw, 0.80);
      const vce = pol * (vC - vE);

      // Stamp-time Icc estimate (approximate, ignoring qb):
      const eVbe = Math.exp(Math.min(vbe_clamped / nVt, 500));
      const Ic_est = IS / 1.0 * (eVbe - 1);  // qb ≈ 1 in active region

      VXA.SimV2.solve(dt);
      VXA.Thermal.update(dt * 50);
      S.sim.t += dt;

      return {
        t: S.sim.t,
        Tj, IS: IS, Vt: nVt,
        vbe_raw, vbe_clamped, vbe_was_clamped: vbe_raw > 0.80,
        vce,
        Ic_pre_stamp_est: Ic_est,
        Ic_post_step: bjt._i || 0,
        nrIter: VXA.SimV2.getNRIter ? VXA.SimV2.getNRIter() : 0,
        converged: VXA.SimV2.getConverged ? VXA.SimV2.getConverged() : true,
        simErr: S.sim.error || null,
        ptcAt: VXA.SimV2.getPTCActivatedAt ? VXA.SimV2.getPTCActivatedAt() : -1
      };
    }, DT);
    snapshots.push(snap);
    if (!snap) break;
  }

  await browser.close();

  console.log('━'.repeat(92));
  console.log('Sprint 98 GUMMEL-POON STAMP SNAPSHOT  (around collapse time)');
  console.log('━'.repeat(92));
  console.log('  t(s)    Tj(°C)   Vt(mV)    Is          vbeRaw  clamped? Ic_est    Ic_post   NRit  cnv  ptc');
  console.log('  ' + '-'.repeat(90));

  // Print 1 in 10 rows normally, plus every row within 5 ms of a collapse
  let collapseIdx = -1;
  for (let i = 1; i < snapshots.length; i++) {
    const s = snapshots[i], prev = snapshots[i - 1];
    if (prev.Ic_post_step > 10e-3 && Math.abs(s.Ic_post_step) < 1e-5) { collapseIdx = i; break; }
  }

  snapshots.forEach((s, i) => {
    if (!s) return;
    const nearCollapse = collapseIdx !== -1 && Math.abs(i - collapseIdx) <= 5;
    if (!nearCollapse && i % 50 !== 0) return;
    console.log(
      '  ' + s.t.toFixed(4).padStart(7) +
      '  ' + s.Tj.toFixed(1).padStart(6) +
      '  ' + (s.Vt * 1000).toFixed(2).padStart(6) +
      '  ' + s.IS.toExponential(2).padStart(9) +
      '  ' + s.vbe_raw.toFixed(4).padStart(7) +
      '  ' + (s.vbe_was_clamped ? ' YES' : ' no ').padStart(7) +
      '  ' + (s.Ic_pre_stamp_est * 1000).toFixed(2).padStart(8) +
      '  ' + (Math.abs(s.Ic_post_step) * 1000).toFixed(2).padStart(8) +
      '  ' + String(s.nrIter).padStart(3) +
      '  ' + (s.converged ? ' y ' : ' N ') +
      '  ' + String(s.ptcAt).padStart(3) +
      (i === collapseIdx ? '  ← COLLAPSE' : '')
    );
  });

  console.log('  ' + '-'.repeat(90));
  console.log('  Total samples   : ' + snapshots.length);
  console.log('  Collapse at idx : ' + (collapseIdx === -1 ? 'none' : collapseIdx + ' (t = ' + snapshots[collapseIdx].t.toFixed(4) + ' s)'));
  const preCollapse = collapseIdx > 0 ? snapshots[collapseIdx - 1] : null;
  const atCollapse = collapseIdx >= 0 ? snapshots[collapseIdx] : null;
  if (preCollapse && atCollapse) {
    console.log('  Pre-collapse    : Tj=' + preCollapse.Tj.toFixed(1) + '°C  Is=' + preCollapse.IS.toExponential(2) +
                '  vbeRaw=' + preCollapse.vbe_raw.toFixed(4) + '  Ic=' + (preCollapse.Ic_post_step * 1000).toFixed(2) + 'mA');
    console.log('  At collapse     : Tj=' + atCollapse.Tj.toFixed(1) + '°C  Is=' + atCollapse.IS.toExponential(2) +
                '  vbeRaw=' + atCollapse.vbe_raw.toFixed(4) + '  Ic=' + (atCollapse.Ic_post_step * 1000).toFixed(2) + 'mA');
    console.log('  Is ratio        : ' + (atCollapse.IS / preCollapse.IS).toFixed(4));
  }
  console.log('━'.repeat(92));
})().catch(e => { console.error(e); process.exit(1); });
