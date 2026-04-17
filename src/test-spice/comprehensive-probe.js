#!/usr/bin/env node
// Sprint 71 comprehensive audit. For every .cir in src/test-spice
// this probe loads the circuit live in a headless browser, runs the
// DC solver + several transient steps, then collects solver /
// inspector-ready / thermal / render-ready numbers in one pass. The
// output is a single JSON blob the audit script consumes to emit
// the final markdown table.
//
// Measurements gathered per circuit:
//   solver      : simNodes, parts[{name,type,v,i,p,finite}]
//   inspector   : what the Inspector would display for V1 / GND
//   thermal     : max T across parts, any unexpected damage
//   render      : wires with I > 0, circuitMaxI, palette bucket counts
//   anomaly     : NaN/Inf, |I| > 100, |V| > 10000, unexpected damage

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function probeOne(page, circuitFile) {
  const text = fs.readFileSync(circuitFile, 'utf8');
  return page.evaluate(async (t, circuitName) => {
    // Reset state
    S.parts = []; S.wires = []; S.nextId = 1;
    if (typeof _nc !== 'undefined') Object.keys(_nc).forEach(k => delete _nc[k]);
    S.realisticMode = false; // thermal/damage quiet unless asked
    S.sel = [];

    const cir = VXA.SpiceImport.parse(t);
    VXA.SpiceImport.placeCircuit(cir);
    S.sim.running = true;

    let buildErr = null, dcErr = null;
    try { buildCircuitFromCanvas(); } catch(e) { buildErr = e.message; }
    try { if (VXA.SimV2 && VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint(); } catch(e) { dcErr = e.message; }
    // Use the app's own adaptive step detection — matches the user's
    // real simulator experience instead of a fixed 100 µs sample that
    // misses switching events on boost-converter-class circuits.
    if (typeof autoDetectDt === 'function') { try { autoDetectDt(); } catch(_) {} }
    const dt = (typeof S !== 'undefined' && S.sim && S.sim.dt) ? S.sim.dt : 1e-5;
    const steps = Math.min(2000, Math.max(200, Math.floor(0.1 / dt)));
    for (let i = 0; i < steps; i++) {
      try { if (VXA.SimV2 && VXA.SimV2.solve) VXA.SimV2.solve(dt); } catch(e) { break; }
      if (VXA.Thermal) VXA.Thermal.update(dt);
    }

    // --- SOLVER ---
    const simNodes = (typeof SIM !== 'undefined' && SIM) ? SIM.N : 0;
    const spiceNodes = cir.nodeCount;
    const parts = S.parts.map(p => ({
      name: p.name, type: p.type,
      v: p._v == null ? null : +p._v.toFixed(6),
      i: p._i == null ? null : +p._i.toFixed(9),
      p: p._p == null ? null : +p._p.toFixed(6),
      finite: [p._v, p._i, p._p].every(x => x == null || (isFinite(x) && !isNaN(x))),
      thermalT: p._thermal ? +p._thermal.T.toFixed(2) : null,
      thermalTmax: p._thermal ? p._thermal.Tmax : null,
      damaged: !!p.damaged, damageCause: p.damageCause || null
    }));

    // --- INSPECTOR READOUTS ---
    const V1 = S.parts.find(p => p.type === 'vdc' || p.type === 'vac');
    const gnd = S.parts.find(p => p.type === 'ground');
    const inspector = {
      vSource: V1 ? {
        name: V1.name,
        v: V1._v,
        i: V1._i,
        p: V1._p,
        delivering: V1._v != null && V1._i != null && V1._v * V1._i > 0
      } : null,
      ground: gnd ? { name: gnd.name, v: gnd._v, i: gnd._i, p: gnd._p } : null
    };

    // --- THERMAL ---
    let maxT = 25, hotPart = null;
    parts.forEach(p => { if (p.thermalT && p.thermalT > maxT) { maxT = p.thermalT; hotPart = p.name; } });
    const unexpectedDamage = parts.filter(p => p.damaged);
    const thermal = { maxT, hotPart, unexpectedDamage: unexpectedDamage.map(p => p.name + '(' + p.damageCause + ')') };

    // --- RENDER / WIRES ---
    if (typeof _updateCircuitMaxI === 'function') _updateCircuitMaxI();
    const wires = S.wires.map(w => Math.abs(w._current || 0));
    const activeWires = wires.filter(x => x > 1e-9).length;
    const orphanWires = wires.filter((x, i) =>
      x < 1e-9 && Math.abs(S.wires[i].x2 - S.wires[i].x1) + Math.abs(S.wires[i].y2 - S.wires[i].y1) > 5).length;
    const maxI = typeof _circuitMaxI !== 'undefined' ? _circuitMaxI : Math.max.apply(null, wires.concat([0]));
    const render = { totalWires: S.wires.length, activeWires, orphanWires, maxI_mA: +(maxI * 1000).toFixed(4) };

    // --- ANOMALIES ---
    const anomaly = {
      buildErr, dcErr,
      nanParts: parts.filter(p => !p.finite).map(p => p.name),
      extremeI: parts.filter(p => p.i != null && Math.abs(p.i) > 100).map(p => p.name + '=' + p.i + 'A'),
      extremeV: parts.filter(p => p.v != null && Math.abs(p.v) > 10000).map(p => p.name + '=' + p.v + 'V'),
      unexpectedDamage: unexpectedDamage.map(p => p.name),
      nodeCountDelta: spiceNodes - simNodes
    };

    // --- KIRCHHOFF: KCL on V+ and KVL on simple loops (resistive only) ---
    let kcl = null;
    if (V1 && V1._i != null && S.parts.every(p => ['resistor','vdc','ground','capacitor','inductor'].includes(p.type))) {
      const Rs = S.parts.filter(p => p.type === 'resistor');
      const sumR = Rs.reduce((a, r) => a + Math.abs(r._i || 0), 0);
      kcl = { vsrc_mA: +(V1._i*1000).toFixed(4), sumR_mA: +(sumR*1000).toFixed(4) };
    }

    return { circuit: circuitName, spiceNodes, simNodes, parts, inspector, thermal, render, anomaly, kcl };
  }, text, path.basename(circuitFile));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.SpiceImport && typeof buildCircuitFromCanvas === 'function');

  const dir = path.join(path.dirname(process.argv[1]), '.');
  const circuits = fs.readdirSync(dir).filter(f => f.endsWith('.cir')).sort();
  const results = [];
  for (const c of circuits) {
    try {
      const r = await probeOne(page, path.join(dir, c));
      results.push(r);
    } catch (e) {
      results.push({ circuit: c, crash: e.message });
    }
  }

  await browser.close();

  const report = { generatedAt: new Date().toISOString(), pageErrors: errors, circuits: results };
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('CRASH', e); process.exit(1); });
