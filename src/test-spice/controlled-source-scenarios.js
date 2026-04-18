#!/usr/bin/env node
// Sprint 92: CCVS (SPICE H) and CCCS (SPICE F) branch-variable MNA
// verification. Before Sprint 92 the solver modelled both as a
// parasitic 10 Ω conductance across the sense pins, which gave
// nearly-zero output for a V=0 dummy meter (the SPICE convention).
// This probe imports three netlists and checks the solver agrees
// with the analytic DC operating point.
//
//   30-cccs-current-mirror.cir  → expect V(3) =  10 V
//   31-ccvs-amplifier.cir       → expect V(3) =  10 V
//   32-cccs-bidirectional.cir   → expect V(3) = -10 V (sign flip)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';

// DC simulation: a short transient with a constant V source settles
// immediately.  Step for a handful of dt and read node voltages.
const DT   = 1e-7;
const STEPS = 200;  // 20 µs — plenty for a purely resistive network

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

    // Grab node voltages keyed by part terminal — the simulator stores
    // them in S._nodeVoltages indexed by canonical node id.
    const nv = S._nodeVoltages || [];
    // Find node 3 (output) — spice-import maps SPICE node names to
    // canonical ids via circuit.nodeMap, but after placeCircuit we
    // only need to read the output part's sensed voltage.
    const r2 = S.parts.find(p => p.id && (p.type === 'r' || p.type === 'R' || p.type === 'resistor') && (p.spiceName === 'R2' || p.name === 'R2'));
    let v3 = null;
    if (r2 && r2._v != null) v3 = r2._v;

    // Fallback: scan all V-displays for a ≈10 V (or -10 V) resistor reading
    const resistors = S.parts.filter(p => p.type === 'resistor' || p.type === 'r');
    const allV = resistors.map(r => ({ id: r.id, name: r.name, v: r._v, i: r._i }));

    return {
      v3,
      allV,
      nodeVoltages: Array.from(nv || []),
      partCount: S.parts.length,
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

  // Expected V(3) signs follow SPICE convention.  I(V1) is "current
  // into the + terminal from external", so a forward-biased V1 with a
  // resistive load has I(V1) < 0.  That makes:
  //   CCCS  V(3) = +|gain · I(V1)| · R2   when CCCS sources at noP
  //   CCVS  V(3) = rm · I(V1)             (sign carries through)
  //   CCCS  V(3) flips sign when V1's polarity flips because I(V1)
  //         then becomes positive.
  const tests = [
    { file: '30-cccs-current-mirror.cir', expected: { r2V:  10.0, r2I:  0.020, tol: 0.01 }, label: 'CCCS gain=2 mirror, V(3) = +10 V' },
    { file: '31-ccvs-amplifier.cir',      expected: { r2V: -10.0, r2I:  0.010, tol: 0.01 }, label: 'CCVS rm=1kΩ, V(3) = −10 V'         },
    { file: '32-cccs-bidirectional.cir',  expected: { r2V: -10.0, r2I:  0.020, tol: 0.01 }, label: 'CCCS with flipped V1, V(3) = −10 V'}
  ];

  console.log('━'.repeat(64));
  console.log('Sprint 92 CCVS / CCCS BRANCH-VARIABLE MNA VERIFICATION');
  console.log('━'.repeat(64));

  let allPass = true;

  for (const t of tests) {
    const cir = fs.readFileSync(path.join(__dirname, t.file), 'utf8');
    const r   = await solve(page, cir);

    const r2 = r.allV.find(v => v.name === 'R2') || r.allV.find(v => /r2/i.test(String(v.id))) || r.allV[r.allV.length - 1];
    const measV = r2 ? r2.v : NaN;
    const measI = r2 ? r2.i : NaN;

    // Sign reconstruction: resistors store |V|, but the node-voltage
    // vector remembers sign. Pull node 3 (highest positive index before
    // ground by parse order) from the raw nodeVoltages array.
    //   nodeVoltages[0] is typically the first non-ground canonical ID.
    //   The output node for all three test circuits is SPICE "3".
    // We print the raw vector so the harness shows the signed reading.
    const nv = r.nodeVoltages;
    const signedMaxV = nv.reduce((best, x) => Math.abs(x) > Math.abs(best) ? x : best, 0);

    const errV = Math.abs(Math.abs(measV) - Math.abs(t.expected.r2V)) / Math.abs(t.expected.r2V);
    const errI = Math.abs(measI - t.expected.r2I) / t.expected.r2I;
    const signOK =
      (t.expected.r2V > 0 ? signedMaxV > 0 : signedMaxV < 0) ||
      Math.abs(signedMaxV) < 0.05;  // tolerate sign for |V| near zero
    const ok = errV < t.expected.tol && errI < t.expected.tol && signOK;
    if (!ok) allPass = false;

    console.log('\n  [' + t.file + '] ' + t.label);
    console.log('    expected  V(3) = ' + t.expected.r2V.toFixed(3) + ' V   I(R2) = ' + (t.expected.r2I * 1000).toFixed(3) + ' mA');
    console.log('    measured |V(R2)| = ' + measV.toFixed(3) + ' V  |I(R2)| = ' + (measI * 1000).toFixed(3) + ' mA');
    console.log('    signed V(3) via node vector max-|.|: ' + signedMaxV.toFixed(3) + ' V');
    console.log('    errV = ' + (errV * 100).toFixed(2) + ' %   errI = ' + (errI * 100).toFixed(2) + ' %   sign ' + (signOK ? 'OK' : 'MISMATCH'));
    console.log('    ' + (ok ? '✓ PASS' : '✗ FAIL'));
    if (r.simError) console.log('    [sim error: ' + r.simError + ']');
  }

  await browser.close();

  console.log('\n' + '━'.repeat(64));
  console.log(allPass ? '✓ ALL PASS' : '✗ FAIL');
  console.log('━'.repeat(64));
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
