#!/usr/bin/env node
// Sprint 79: probe behaviour scenarios.
// Scenario A — wire attach (parallel-R)
// Scenario B — AC RMS       (16-rc-lowpass)
// Scenario C — Ohmmeter     (parallel-R, probes on one R)
// Scenario D — Peak hold    (16-rc-lowpass, capture absolute peak)

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR_PAR = fs.readFileSync(path.join(__dirname, '02-parallel-r.cir'), 'utf8');
const CIR_RC  = fs.readFileSync(path.join(__dirname, '16-rc-lowpass.cir'), 'utf8');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof VXA !== 'undefined' && VXA.Probes && typeof VXA.Probes.toggle === 'function',
    { timeout: 15000 }
  );

  const results = await page.evaluate(({ cirPar, cirRC }) => {
    function resetCanvas() {
      S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    }
    function attach(probeId, wx, wy) {
      VXA.Probes.startDrag(probeId);
      VXA.Probes.onDrag(wx, wy);
      VXA.Probes.onDrop(wx, wy);
    }
    function runSteps(dt, n) {
      for (let i = 0; i < n; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        // Trigger draw() history tick by calling the probe draw with a scratch ctx.
        // We just need _tickHistory side effect — cheapest path is to
        // call getMeasurement AFTER we call the probe's internal tick,
        // which is encapsulated in draw(). Simulate by calling draw on
        // an off-screen canvas.
        if (VXA.Probes && VXA.Probes.isActive()) {
          const scratch = document.createElement('canvas').getContext('2d');
          VXA.Probes.draw(scratch);
        }
      }
    }
    function simpleDC() {
      buildCircuitFromCanvas();
      if (VXA.SimV2 && VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint();
      VXA.SimV2.solve(1e-5);
    }

    const out = {};

    // ─── Scenario A: wire attach, parallel-R ───
    resetCanvas();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirPar));
    simpleDC();
    // Enable probe mode
    if (!VXA.Probes.isActive()) VXA.Probes.toggle();

    // Find a wire that connects the V+ rail (node 1). Any wire whose
    // endpoint coincides with V1's positive pin (pin 0).
    const V1 = S.parts.find(p => p.type === 'vdc');
    const v1Pin0 = getPartPins(V1)[0];
    const v1PinKey = v1Pin0.x + ',' + v1Pin0.y;
    // Find a wire that has one endpoint at V1 pin 0 → attach red to
    // the OTHER endpoint of that wire (to stress wire attach logic,
    // not pin attach).
    let wireIdx = -1, dropX = 0, dropY = 0;
    for (let wi = 0; wi < S.wires.length; wi++) {
      const w = S.wires[wi];
      const k1 = w.x1 + ',' + w.y1, k2 = w.x2 + ',' + w.y2;
      if (k1 === v1PinKey) { wireIdx = wi; dropX = (w.x1 + w.x2)/2; dropY = (w.y1 + w.y2)/2; break; }
      if (k2 === v1PinKey) { wireIdx = wi; dropX = (w.x1 + w.x2)/2; dropY = (w.y1 + w.y2)/2; break; }
    }
    // Attach red at wire midpoint, black on GND pin.
    const gnd = S.parts.find(p => p.type === 'ground');
    const gndPin = getPartPins(gnd)[0];
    attach('red', dropX, dropY);
    attach('black', gndPin.x, gndPin.y);
    const mA = VXA.Probes.getMeasurement();
    out.scenarioA = {
      wireIdx, dropX, dropY,
      redOnWire: mA && mA.redOnWire,
      voltage:   mA ? mA.voltage : null,
      hasNode:   mA ? mA.voltage !== null : false
    };

    // ─── Scenario B: AC RMS, RC low-pass ───
    resetCanvas();
    VXA.Probes.toggle(); // disable
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirRC));
    simpleDC();
    VXA.Probes.toggle(); // re-enable fresh
    // Red probe on R1 pin 1 (output side → node 2); black on GND.
    const R1 = S.parts.find(p => p.type === 'resistor');
    const r1Pins = getPartPins(R1);
    const gnd2 = S.parts.find(p => p.type === 'ground');
    const gnd2Pin = getPartPins(gnd2)[0];
    attach('red',   r1Pins[1].x, r1Pins[1].y);
    attach('black', gnd2Pin.x,   gnd2Pin.y);
    // Drive the sine for ~20 periods well below f_c so the output
    // tracks the input: pick 100 Hz (f_c = 1.59 kHz).
    const vac = SIM.comps.find(c => c.type === 'V' && c.isAC);
    if (vac) vac.freq = 100;
    S.sim.running = true;
    // 100 Hz → T = 10 ms. Run 20 periods = 200 ms. dt = 100 µs → 2000 steps.
    runSteps(1e-4, 2200);
    const mB = VXA.Probes.getMeasurement();
    out.scenarioB = {
      vDiffIsAC: mB ? mB.vDiffIsAC : false,
      vDiffRMS:  mB ? mB.vDiffRMS  : null,
      voltage:   mB ? mB.voltage   : null
    };
    S.sim.running = false;

    // ─── Scenario C: Ohmmeter ───
    resetCanvas();
    VXA.Probes.toggle();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirPar));
    simpleDC();
    VXA.Probes.toggle();
    VXA.Probes.setMode('R');
    const Rs = S.parts.filter(p => p.type === 'resistor');
    const R0 = Rs[0];
    const r0Pins = getPartPins(R0);
    attach('red',   r0Pins[0].x, r0Pins[0].y);
    attach('black', r0Pins[1].x, r0Pins[1].y);
    const mC = VXA.Probes.getMeasurement();
    out.scenarioC = {
      rVal:        R0.val,
      resistance:  mC ? mC.resistance : null,
      voltage:     mC ? mC.voltage    : null,
      current:     mC ? mC.current    : null
    };
    VXA.Probes.setMode('auto');

    // ─── Scenario D: peak hold, RC low-pass ───
    resetCanvas();
    VXA.Probes.toggle();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirRC));
    simpleDC();
    VXA.Probes.toggle();
    VXA.Probes.setHold('peak');
    const R1d = S.parts.find(p => p.type === 'resistor');
    const r1dPins = getPartPins(R1d);
    const gndD = S.parts.find(p => p.type === 'ground');
    const gndDPin = getPartPins(gndD)[0];
    attach('red',   r1dPins[0].x, r1dPins[0].y); // INPUT side → node 1 (V source)
    attach('black', gndDPin.x,     gndDPin.y);
    const vacD = SIM.comps.find(c => c.type === 'V' && c.isAC);
    if (vacD) vacD.freq = 100;
    S.sim.running = true;
    runSteps(1e-4, 2200);
    const mD = VXA.Probes.getMeasurement();
    out.scenarioD = {
      hold:        mD ? mD.hold : null,
      holdVDiff:   mD ? mD.holdVDiff : null,
      voltageLive: mD ? mD.voltage   : null
    };
    VXA.Probes.setHold('live');
    S.sim.running = false;

    return out;
  }, { cirPar: CIR_PAR, cirRC: CIR_RC });

  await browser.close();

  // Reporting + asserts
  const A = results.scenarioA, B = results.scenarioB, C = results.scenarioC, D = results.scenarioD;
  console.log('━'.repeat(60));
  console.log('Sprint 79 PROBE SCENARIOS');
  console.log('━'.repeat(60));

  console.log('\n[A] Wire attach — parallel-R');
  console.log(`    wireIdx=${A.wireIdx}  redOnWire=${A.redOnWire}`);
  console.log(`    ΔV (red-on-wire − black-on-GND) = ${A.voltage !== null ? A.voltage.toFixed(4) + ' V' : 'null'}  (expect ≈ 10.0 V)`);
  const aPass = A.redOnWire === true && Math.abs(A.voltage - 10) < 0.1;

  console.log('\n[B] AC RMS — RC low-pass, 100 Hz stimulus');
  console.log(`    vDiffIsAC = ${B.vDiffIsAC}`);
  console.log(`    vDiffRMS  = ${B.vDiffRMS !== null ? B.vDiffRMS.toFixed(4) + ' V' : 'null'}  (1 V pk → 0.707 V RMS)`);
  console.log(`    instant   = ${B.voltage !== null ? B.voltage.toFixed(4) + ' V' : 'null'}`);
  const bPass = B.vDiffIsAC === true && B.vDiffRMS !== null
             && Math.abs(B.vDiffRMS - 0.707) < 0.15;

  console.log('\n[C] Ohmmeter — R1 (expect ' + (C.rVal !== undefined ? C.rVal : '?') + ' Ω)');
  console.log(`    R_measured = ${C.resistance !== null ? C.resistance.toFixed(2) + ' Ω' : 'null'}`);
  console.log(`    ΔV=${C.voltage !== null ? C.voltage.toFixed(3) : '?' } V   I=${C.current !== null ? (C.current*1000).toFixed(3) : '?'} mA`);
  const cPass = C.resistance !== null && Math.abs(C.resistance - C.rVal) / C.rVal < 0.05;

  console.log('\n[D] Peak hold — AC input, 1 V pk');
  console.log(`    hold=${D.hold}`);
  console.log(`    holdVDiff = ${D.holdVDiff !== null ? D.holdVDiff.toFixed(4) + ' V' : 'null'}  (expect ≈ ±1 V)`);
  console.log(`    live now  = ${D.voltageLive !== null ? D.voltageLive.toFixed(4) + ' V' : 'null'}`);
  const dPass = D.hold === 'peak' && D.holdVDiff !== null
             && Math.abs(D.holdVDiff) > 0.9 && Math.abs(D.holdVDiff) < 1.2;

  console.log('\n━'.repeat(60));
  console.log(`A wire attach  : ${aPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`B AC RMS       : ${bPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`C Ohmmeter     : ${cPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`D Peak hold    : ${dPass ? '✓ PASS' : '✗ FAIL'}`);
  process.exit((aPass && bPass && cPass && dPass) ? 0 : 1);
})();
