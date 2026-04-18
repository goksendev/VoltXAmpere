#!/usr/bin/env node
// Sprint 93: verify JFET Level-1 reads IDSS / VTO / LAMBDA from the
// user-supplied .MODEL card rather than the legacy hard-coded
// Idss = 10 mA, Vp = ±2 V defaults.
//
// Three probes:
//   33-jfet-idss-accurate.cir  → 2N3819, IDSS=10m  → V(2) ≈ 9 V
//   34-jfet-different-model.cir → J310,   IDSS=60m  → V(2) ≈ 4 V
//   35-jfet-pinch-off.cir       → 2N5457, VTO=-1.5 → V(2) ≈ 10 V (cutoff)
//
// The third case is the critical one: with the pre-Sprint-93 code
// Vp was hard-coded at −2 V, so a V_GS of −2 V would actually SIT
// AT pinch-off instead of a hair below it — the previous solver
// would have read I_D = 0 by coincidence. With Sprint 93, the real
// −1.5 V VTO is used and the cutoff boundary moves, yet the
// applied V_GS = −2 V still stays below VTO so cutoff still holds.
// To distinguish: we also verify V_GS above VTO pulls the drain
// down (test cases 33/34 do this).

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const DT    = 1e-7;
const STEPS = 200;

async function solve(page, cir) {
  return await page.evaluate(({ cir, dt, steps }) => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];

    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
    buildCircuitFromCanvas();
    if (VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint();

    S.sim.t = 0; S.sim.running = false;
    if (S.sim.error) S.sim.error = null;

    for (let i = 0; i < steps; i++) {
      VXA.SimV2.solve(dt);
      S.sim.t += dt;
    }

    // Find the JFET part and the load resistor R1 to compute V(drain).
    const jfet = S.parts.find(p => p.type === 'njfet' || p.type === 'pjfet');
    const r1   = S.parts.find(p => p.name === 'R1');

    return {
      jfet: jfet ? {
        name: jfet.name, id: jfet.id, model: jfet.model,
        i: jfet._i, v: jfet._v, p: jfet._p, region: jfet._region
      } : null,
      r1: r1 ? { v: r1._v, i: r1._i } : null,
      // Node-voltage vector max |.| with sign — useful for cutoff
      // where the JFET drain essentially tracks the V1 rail.
      signedMaxV: (S._nodeVoltages || []).reduce((b, x) => Math.abs(x) > Math.abs(b) ? x : b, 0),
      simError: S.sim.error || null
    };
  }, { cir, dt: DT, steps: STEPS });
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.SimV2 && VXA.SpiceImport, { timeout: 15000 });

  const tests = [
    {
      file: '33-jfet-idss-accurate.cir',
      label: '2N3819 (IDSS=10 mA, VTO=-3)',
      // V(2) = V1 − I_D · R1 with I_D ≈ IDSS · (1 + λ·V_DS); at the
      // operating point the +1 % LAMBDA bump puts I_D ≈ 10.01 mA.
      // Accept ±5 % on I_D and ±10 % on V(2) to allow for NR residual.
      expectedId: 0.01, tolId: 0.05,
      expectedRail: 9.0, tolRail: 0.1
    },
    {
      file: '34-jfet-different-model.cir',
      label: 'J310 (IDSS=60 mA, VTO=-6)',
      expectedId: 0.06, tolId: 0.05,
      expectedRail: 4.0, tolRail: 0.15
    },
    {
      file: '35-jfet-pinch-off.cir',
      label: '2N5457 cutoff (V_GS=-2 below VTO=-1.5)',
      expectedId: 0,  tolId: 0.001,   // |I| < 1 mA (effectively zero)
      expectedRail: 10.0, tolRail: 0.05
    }
  ];

  console.log('━'.repeat(64));
  console.log('Sprint 93  JFET .MODEL BINDING VERIFICATION');
  console.log('━'.repeat(64));

  let allPass = true;
  for (const t of tests) {
    const cir = fs.readFileSync(path.join(__dirname, t.file), 'utf8');
    const r   = await solve(page, cir);

    const measId   = r.jfet ? r.jfet.i : NaN;
    const measV2   = r.r1 && r.r1.v != null ? (10 - r.r1.v) : NaN; // V(2) = V1 − |V(R1)|
    const region   = r.jfet ? r.jfet.region : '??';
    const modelTag = r.jfet ? r.jfet.model : '??';

    const errI = t.expectedId > 0
      ? Math.abs(measId - t.expectedId) / t.expectedId
      : Math.abs(measId);  // absolute near zero for cutoff
    const errV = Math.abs(measV2 - t.expectedRail) / Math.max(1, Math.abs(t.expectedRail));

    const idOK   = errI < t.tolId;
    const railOK = errV < t.tolRail;
    const ok = idOK && railOK;
    if (!ok) allPass = false;

    console.log('\n  [' + t.file + '] ' + t.label);
    console.log('    model loaded      : ' + modelTag);
    console.log('    I_D measured      : ' + (measId * 1000).toFixed(3) + ' mA   expected ' + (t.expectedId * 1000).toFixed(3) + ' mA');
    console.log('    V(2) measured     : ' + measV2.toFixed(3) + ' V     expected ' + t.expectedRail.toFixed(3) + ' V');
    console.log('    region            : ' + region);
    console.log('    errI ' + (errI * 100).toFixed(2) + ' %   errV ' + (errV * 100).toFixed(2) + ' %   ' + (ok ? '✓ PASS' : '✗ FAIL'));
    if (r.simError) console.log('    [sim error: ' + r.simError + ']');
  }

  await browser.close();

  console.log('\n' + '━'.repeat(64));
  console.log(allPass ? '✓ ALL PASS' : '✗ FAIL');
  console.log('━'.repeat(64));
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
