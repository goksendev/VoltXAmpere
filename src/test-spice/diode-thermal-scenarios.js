#!/usr/bin/env node
// Sprint 84: diode V_F temperature coefficient sanity.
//
// Force a range of junction temperatures on a forward-biased Si diode
// and observe V_F drop. Classic silicon result: slope ≈ −2 mV/°C, the
// bedrock of silicon-bandgap temperature sensors. We pin Tj by writing
// part._thermal.T directly so the measurement is independent of how
// fast the thermal model reaches that temperature in transient.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
const CIR = fs.readFileSync(path.join(__dirname, '23-diode-temp-coefficient.cir'), 'utf8');

const TEMPS_C = [25, 50, 75, 100];

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

  const results = [];
  for (const Tc of TEMPS_C) {
    const r = await page.evaluate(({ cir, Tc }) => {
      S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
      if (VXA.Thermal && VXA.Thermal.reset) VXA.Thermal.reset();
      VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
      buildCircuitFromCanvas();

      // Pin the diode junction temperature directly. ensureThermal()
      // lazily creates part._thermal on first Thermal.update(); we
      // pre-seed it here so the very first solve sees the target T.
      const d = S.parts.find(p => p.type === 'diode');
      if (!d._thermal) VXA.Thermal.ensureThermal(d);
      d._thermal.T = Tc;

      S.sim.t = 0; S.sim.running = false;
      if (S.sim.error) S.sim.error = null;

      // A handful of NR iterations to converge the DC operating point.
      // Thermal.update is NOT called — we want the temperature pinned.
      for (let i = 0; i < 200; i++) {
        VXA.SimV2.solve(1e-5);
        // Re-pin after each solve in case anything tried to nudge it.
        d._thermal.T = Tc;
      }

      const comp = SIM.comps.find(c => c.type === 'D');
      const n1 = comp ? comp.n1 : -1, n2 = comp ? comp.n2 : -1;
      const v1 = (n1 > 0 && S._nodeVoltages) ? (S._nodeVoltages[n1] || 0) : 0;
      const v2 = (n2 > 0 && S._nodeVoltages) ? (S._nodeVoltages[n2] || 0) : 0;
      return {
        Tj:   d._thermal.T,
        V_F:  v1 - v2,
        I_D:  Math.abs(d._i || 0),
        part_v: d._v || 0,
        part_i: d._i || 0
      };
    }, { cir: CIR, Tc });
    results.push({ Tc, ...r });
  }

  await browser.close();

  console.log('━'.repeat(64));
  console.log('Sprint 84 DIODE V_F TEMPERATURE COEFFICIENT');
  console.log('━'.repeat(64));
  console.log('\n Tj(°C) | V_F (V) |  I_D (mA) | ΔV_F vs 25°C');
  const ref = results[0];
  for (const r of results) {
    const dv = (r.V_F - ref.V_F) * 1000;
    console.log(
      '   ' + r.Tc.toString().padStart(3) +
      '  | ' + r.V_F.toFixed(4).padStart(7) +
      ' | ' + (r.I_D * 1000).toFixed(4).padStart(8) +
      '  | ' + (r.Tc === 25 ? '  —  ' : (dv >= 0 ? '+' : '') + dv.toFixed(1) + ' mV')
    );
  }

  // Slope ≈ (V_F[last] − V_F[first]) / (T[last] − T[first])
  const last = results[results.length - 1];
  const slope = (last.V_F - ref.V_F) / (last.Tc - ref.Tc) * 1000;
  console.log('\n slope (25 → ' + last.Tc + ' °C): ' + slope.toFixed(2) + ' mV/°C  (expect −1.9 to −2.2)');

  // Pass criteria
  const aPass = slope >= -2.3 && slope <= -1.7;   // within ±0.3 mV/°C of textbook
  // At V_F ≈ 0.66 V and R = 4.7 kΩ we expect I_D ≈ (5 − 0.66)/4.7k
  // ≈ 0.92 mA — NOT exactly 1 mA. Pass if we land between 0.85 and
  // 1.00 mA (any Si diode model whose V_F sits in 0 – 0.8 V at 1 mA
  // satisfies this).
  const bPass = results[0].I_D >= 0.85e-3 && results[0].I_D <= 1.00e-3;
  console.log('\n━'.repeat(64));
  console.log('A slope within [−2.3, −1.7] mV/°C : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B I_D ≈ 1 mA at 25 °C             : ' + (bPass ? '✓ PASS' : '✗ FAIL') +
              '  (measured ' + (results[0].I_D * 1000).toFixed(3) + ' mA)');
  process.exit((aPass && bPass) ? 0 : 1);
})();
