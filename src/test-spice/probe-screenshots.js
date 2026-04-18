#!/usr/bin/env node
// Sprint 79: capture the four probe scenarios as PNGs via toDataURL.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const CIR_PAR = fs.readFileSync(path.join(__dirname, '02-parallel-r.cir'), 'utf8');
const CIR_RC  = fs.readFileSync(path.join(__dirname, '16-rc-lowpass.cir'), 'utf8');
const outDir  = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function save(dataUrl, name) {
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
    console.error('[' + name + '] empty dataUrl'); return;
  }
  const b64 = dataUrl.slice('data:image/png;base64,'.length);
  const out = path.join(outDir, name);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('Saved:', out);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof VXA !== 'undefined' && VXA.Probes, { timeout: 15000 });

  const shots = await page.evaluate(({ cirPar, cirRC }) => {
    function resetCanvas() {
      S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
      if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    }
    function attach(probeId, wx, wy) {
      VXA.Probes.startDrag(probeId);
      VXA.Probes.onDrag(wx, wy);
      VXA.Probes.onDrop(wx, wy);
    }
    function prime() {
      buildCircuitFromCanvas();
      if (VXA.SimV2 && VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint();
      VXA.SimV2.solve(1e-5);
    }
    function runSteps(dt, n) {
      for (let i = 0; i < n; i++) {
        VXA.SimV2.solve(dt);
        S.sim.t += dt;
        if (VXA.Probes.isActive()) {
          const sc = document.createElement('canvas').getContext('2d');
          VXA.Probes.draw(sc);
        }
      }
    }
    function paint() {
      const cvs = document.getElementById('C'); if (!cvs) return null;
      if (typeof redrawScene === 'function') redrawScene();
      else if (typeof render === 'function') render();
      // Also explicitly draw probes onto the main canvas
      try {
        const ctx = cvs.getContext('2d');
        const state = VXA.Probes.getState();
        // Let the normal render pipeline paint first, then overlay probes.
        if (typeof drawPart === 'function') {
          // full-scene refresh is non-trivial — rely on needsRender + event loop.
        }
      } catch (e) {}
      return cvs.toDataURL('image/png');
    }

    const shots = {};

    // A) Wire attach
    resetCanvas();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirPar));
    prime();
    if (!VXA.Probes.isActive()) VXA.Probes.toggle();
    // Find wire off V1 pin 0
    const V1 = S.parts.find(p => p.type === 'vdc');
    const v1Pin = getPartPins(V1)[0];
    const key = v1Pin.x + ',' + v1Pin.y;
    let dropX = 0, dropY = 0;
    for (const w of S.wires) {
      if (w.x1+','+w.y1 === key || w.x2+','+w.y2 === key) {
        dropX = (w.x1 + w.x2)/2; dropY = (w.y1 + w.y2)/2; break;
      }
    }
    const gnd = S.parts.find(p => p.type === 'ground');
    const gndPin = getPartPins(gnd)[0];
    attach('red',   dropX,    dropY);
    attach('black', gndPin.x, gndPin.y);
    shots.wire = paint();

    // B) AC RMS
    resetCanvas(); VXA.Probes.toggle();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirRC)); prime();
    VXA.Probes.toggle();
    const R1 = S.parts.find(p => p.type === 'resistor');
    const r1P = getPartPins(R1);
    const g2 = S.parts.find(p => p.type === 'ground');
    const g2P = getPartPins(g2)[0];
    attach('red', r1P[1].x, r1P[1].y);
    attach('black', g2P.x, g2P.y);
    const vac = SIM.comps.find(c => c.type === 'V' && c.isAC);
    if (vac) vac.freq = 100;
    S.sim.running = true;
    runSteps(1e-4, 2200);
    shots.acRms = paint();
    S.sim.running = false;

    // C) Ohmmeter
    resetCanvas(); VXA.Probes.toggle();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirPar)); prime();
    VXA.Probes.toggle(); VXA.Probes.setMode('R');
    const R0 = S.parts.filter(p => p.type === 'resistor')[0];
    const r0P = getPartPins(R0);
    attach('red',   r0P[0].x, r0P[0].y);
    attach('black', r0P[1].x, r0P[1].y);
    shots.ohmmeter = paint();
    VXA.Probes.setMode('auto');

    // D) Peak hold
    resetCanvas(); VXA.Probes.toggle();
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cirRC)); prime();
    VXA.Probes.toggle(); VXA.Probes.setHold('peak');
    const R1d = S.parts.find(p => p.type === 'resistor');
    const r1dP = getPartPins(R1d);
    const gD  = S.parts.find(p => p.type === 'ground');
    const gDP = getPartPins(gD)[0];
    attach('red',   r1dP[0].x, r1dP[0].y);
    attach('black', gDP.x,     gDP.y);
    const vac2 = SIM.comps.find(c => c.type === 'V' && c.isAC);
    if (vac2) vac2.freq = 100;
    S.sim.running = true;
    runSteps(1e-4, 2200);
    shots.peakHold = paint();
    S.sim.running = false;
    VXA.Probes.setHold('live');

    return shots;
  }, { cirPar: CIR_PAR, cirRC: CIR_RC });

  save(shots.wire,     'probe-A-wire-attach.png');
  save(shots.acRms,    'probe-B-ac-rms.png');
  save(shots.ohmmeter, 'probe-C-ohmmeter.png');
  save(shots.peakHold, 'probe-D-peak-hold.png');

  await browser.close();
})();
