#!/usr/bin/env node
// Sprint 70a-fix: REAL canvas-based verification via Puppeteer.
// Loads dist/index.html, feeds each .cir through VXA.SpiceImport live,
// then queries S.parts/S.wires and screenshots the canvas.

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const TEST_DIR = __dirname;
const OUT_DIR = path.join(TEST_DIR, 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CIRCUITS = [
  '01-voltage-divider.cir', '02-parallel-r.cir', '03-rlc-series.cir',
  '04-diode-bridge.cir', '05-ce-amp.cir', '06-opamp-buffer.cir',
  '07-555-astable.cir', '08-voltage-regulator.cir', '09-h-bridge.cir',
  '10-boost-converter.cir'
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') pageErrors.push('[console] ' + msg.text()); });

  const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  // Diagnostic: dump initial globals to catch init failures
  const initial = await page.evaluate(() => ({
    hasVXA: typeof VXA !== 'undefined',
    hasSpiceImport: typeof VXA !== 'undefined' && typeof VXA.SpiceImport !== 'undefined',
    hasS: typeof S !== 'undefined',
    hasCOMP: typeof COMP !== 'undefined',
    hasGetPartPins: typeof getPartPins !== 'undefined',
    hasSpiceLayout: typeof VXA !== 'undefined' && typeof VXA.SpiceLayout !== 'undefined',
    hasSpiceRouter: typeof VXA !== 'undefined' && typeof VXA.SpiceRouter !== 'undefined'
  }));
  console.log('[init]', JSON.stringify(initial));

  // Wait for VXA + globals to initialize
  await page.waitForFunction(
    () => typeof VXA !== 'undefined'
       && typeof VXA.SpiceImport !== 'undefined'
       && typeof VXA.SpiceImport.parse === 'function'
       && typeof VXA.SpiceImport.placeCircuit === 'function'
       && typeof S !== 'undefined'
       && typeof COMP !== 'undefined'
       && typeof getPartPins === 'function',
    { timeout: 15000 }
  );

  const results = [];
  let anyFail = false;

  for (const cirFile of CIRCUITS) {
    const text = fs.readFileSync(path.join(TEST_DIR, cirFile), 'utf8');

    // Run import live in-page
    const snapshot = await page.evaluate((spiceText) => {
      // Fresh state
      S.parts = [];
      S.wires = [];
      S.nextId = 1;
      S.sel = [];
      if (_nc) for (const k in _nc) delete _nc[k];

      let parseErr = null, placeErr = null;
      let circuit;
      try { circuit = VXA.SpiceImport.parse(spiceText); }
      catch (e) { parseErr = e.message || String(e); }

      try { if (circuit && circuit.parts) VXA.SpiceImport.placeCircuit(circuit); }
      catch (e) { placeErr = e.message || String(e); }

      // Compute part axis-aligned bounding boxes (body only, excluding pin leads).
      // Body ≈ 32px across, centered on part. Use ±20 around part center for
      // rectangular body, extended to ±28 for 3-pin active devices.
      function partBBox(p) {
        const def = COMP[p.type]; if (!def) return null;
        const bodySize = ({
          resistor:20, capacitor:20, inductor:20, diode:20, led:20,
          vdc:22, vac:22, idc:22, iac:22, pulse:22, pwl:22, noise:22,
          npn:28, pnp:28, nmos:28, pmos:28, njfet:28, pjfet:28,
          vcvs:24, vccs:24, ccvs:24, cccs:24,
          ground:14, switch:18, opamp:24, behavioral:22
        })[p.type] || 20;
        return { minX: p.x - bodySize, maxX: p.x + bodySize,
                 minY: p.y - bodySize, maxY: p.y + bodySize,
                 type: p.type, x: p.x, y: p.y };
      }

      const bboxes = S.parts.map(partBBox).filter(b => b !== null);

      // Wire passes THROUGH a part body when it traverses the interior
      // of the bbox without matching a pin endpoint of that part.
      function wireThroughPart(w, b) {
        const SHRINK = 6; // exclude pin-edge grazing
        const x1 = Math.min(w.x1, w.x2), x2 = Math.max(w.x1, w.x2);
        const y1 = Math.min(w.y1, w.y2), y2 = Math.max(w.y1, w.y2);
        if (w.x1 === w.x2) {
          // vertical segment
          if (w.x1 <= b.minX + SHRINK || w.x1 >= b.maxX - SHRINK) return false;
          if (y2 <= b.minY + SHRINK || y1 >= b.maxY - SHRINK) return false;
          return true;
        } else {
          if (w.y1 <= b.minY + SHRINK || w.y1 >= b.maxY - SHRINK) return false;
          if (x2 <= b.minX + SHRINK || x1 >= b.maxX - SHRINK) return false;
          return true;
        }
      }

      const violations = [];
      S.wires.forEach((w, wi) => {
        bboxes.forEach(b => {
          if (wireThroughPart(w, b)) {
            violations.push({
              wireIdx: wi, partType: b.type, partX: b.x, partY: b.y,
              wire: { x1:w.x1, y1:w.y1, x2:w.x2, y2:w.y2 }
            });
          }
        });
      });

      // Sprint 70a-fix-2 rules ────────────────────────────────
      // A. Rotation check — 2-pin passives should be rot=0 (horizontal).
      const TWO_PIN = ['resistor','capacitor','inductor','diode','led','zener','fuse'];
      const nonHorizontalPassives = S.parts.filter(p =>
        TWO_PIN.indexOf(p.type) >= 0 && p.rot !== 0
      ).map(p => ({ type:p.type, name:p.name, rot:p.rot }));

      // B. Compactness score — totalBoxArea / (partCount * minPartArea).
      // minPartArea = 60 × 60 = 3600 (a generous per-part body+margin budget).
      let compactness = 0;
      if (S.parts.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        S.parts.forEach(p => {
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
        const w = Math.max(60, maxX - minX);
        const h = Math.max(60, maxY - minY);
        compactness = (w * h) / (S.parts.length * 3600);
      }

      // C. Scope buffer — first sample of channel 0 must be exactly 0 after import.
      let scopeFirstSample = null;
      if (S.scope && S.scope.ch && S.scope.ch[0] && S.scope.ch[0].buf) {
        scopeFirstSample = S.scope.ch[0].buf[0];
      }

      // D. GND connectivity — every SPICE part referencing node 0 must have at
      // least one of its pins transitively wire-connected to the ground symbol.
      // E. Ground-drop integrity — every wire endpoint that sits at busY must
      // have its OTHER end exactly on a part pin coordinate.
      function partPinPositions(p) {
        const def = COMP[p.type]; if (!def) return [];
        const src = (p.pins && p.pins.length > 0) ? p.pins : def.pins;
        const a = (p.rot || 0) * Math.PI / 2;
        const c = Math.cos(a), s = Math.sin(a);
        return src.map(pin => ({
          x: Math.round(p.x + pin.dx * c - pin.dy * s),
          y: Math.round(p.y + pin.dx * s + pin.dy * c)
        }));
      }

      const allPinList = []; // [{x,y,partIdx,pinIdx}]
      S.parts.forEach((p, pi) => {
        partPinPositions(p).forEach((pt, idx) => {
          allPinList.push({ x: pt.x, y: pt.y, partIdx: pi, pinIdx: idx });
        });
      });

      // Union-find on wire endpoints + pins with 1px tolerance (all on 20-grid
      // so 1px is ample to absorb any float rounding).
      const keyOf = (x, y) => x + ',' + y;
      const parent = {};
      function find(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
      function ensure(k) { if (!(k in parent)) parent[k] = k; }
      function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

      S.wires.forEach(w => {
        const ka = keyOf(w.x1, w.y1), kb = keyOf(w.x2, w.y2);
        ensure(ka); ensure(kb); union(ka, kb);
      });
      allPinList.forEach(pin => {
        const k = keyOf(pin.x, pin.y); ensure(k);
      });
      // T-junction union — a pin lying on the interior of a wire must be
      // merged into that wire's net (schematic convention). Also unions
      // wire midpoints where another wire's endpoint lands.
      S.wires.forEach(w => {
        const ka = keyOf(w.x1, w.y1);
        const minX = Math.min(w.x1, w.x2), maxX = Math.max(w.x1, w.x2);
        const minY = Math.min(w.y1, w.y2), maxY = Math.max(w.y1, w.y2);
        allPinList.forEach(pin => {
          let onWire = false;
          if (w.x1 === w.x2) {
            onWire = (pin.x === w.x1 && pin.y >= minY && pin.y <= maxY);
          } else if (w.y1 === w.y2) {
            onWire = (pin.y === w.y1 && pin.x >= minX && pin.x <= maxX);
          }
          if (onWire) {
            const pk = keyOf(pin.x, pin.y);
            ensure(pk); union(pk, ka);
          }
        });
        // wire-on-wire T-junctions: endpoint of any other wire on this wire
        S.wires.forEach(w2 => {
          if (w2 === w) return;
          [[w2.x1, w2.y1], [w2.x2, w2.y2]].forEach(pt => {
            let onW = false;
            if (w.x1 === w.x2) onW = (pt[0] === w.x1 && pt[1] >= minY && pt[1] <= maxY);
            else if (w.y1 === w.y2) onW = (pt[1] === w.y1 && pt[0] >= minX && pt[0] <= maxX);
            if (onW) {
              const k = keyOf(pt[0], pt[1]);
              ensure(k); union(k, ka);
            }
          });
        });
      });

      // Find the ground symbol's pin and its connected-component root.
      const gndSym = S.parts.find(p => p.type === 'ground');
      let gndNode = null;
      if (gndSym) {
        const gp = partPinPositions(gndSym)[0];
        if (gp) { const gk = keyOf(gp.x, gp.y); ensure(gk); gndNode = find(gk); }
      }

      const gndFloatingParts = [];
      if (gndNode != null) {
        circuit.parts.forEach((cp, idx) => {
          if (!(cp.nodes || []).includes(0)) return;
          const sp = S.parts[idx];
          if (!sp || sp.type === 'ground') return;
          const pins = partPinPositions(sp);
          // For each SPICE pin that maps to node 0, verify that actual pin
          // coordinate shares a union-find root with the ground symbol.
          const connected = cp.nodes.some((n, pi) => {
            if (n !== 0) return false;
            if (pi >= pins.length) return false;
            const k = keyOf(pins[pi].x, pins[pi].y);
            ensure(k);
            return find(k) === gndNode;
          });
          if (!connected) gndFloatingParts.push({ type: sp.type, name: sp.name, x: sp.x, y: sp.y });
        });
      }

      // Ground-drop integrity: find the bus Y (the horizontal wire with the
      // largest y that passes through the ground symbol X, or just the
      // largest horizontal-wire Y).
      let busY = null;
      const horizWires = S.wires.filter(w => w.y1 === w.y2);
      if (horizWires.length) {
        busY = Math.max(...horizWires.map(w => w.y1));
      }
      const dropIntegrityViolations = [];
      if (busY != null) {
        S.wires.forEach((w, wi) => {
          if (w.x1 !== w.x2) return; // only vertical
          const maxY = Math.max(w.y1, w.y2);
          if (maxY !== busY) return; // not a bus drop
          const topEnd = (w.y1 < w.y2) ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
          const matches = allPinList.some(pin =>
            pin.x === topEnd.x && pin.y === topEnd.y
          );
          if (!matches) {
            dropIntegrityViolations.push({ wireIdx: wi, topEnd });
          }
        });
      }

      // F. Simulator node-count check — build the netlist only (skip the
      // full DC NR solve which can loop on unconverged active circuits).
      // buildCircuitFromCanvas populates S._pinToNode and SIM.N, which is
      // what we need to count unique nets.
      let simNodes = 0, simError = null;
      let orphanWires = 0;  // wires with zero current while others are non-zero
      let groundPinCurrent = null;  // Sprint 70c: |I| at ground pin in a live net
      try {
        buildCircuitFromCanvas();
        simNodes = (typeof SIM !== 'undefined' && SIM && SIM.N) ? SIM.N : 0;
        simError = S.sim && S.sim.error ? S.sim.error : null;
        const simpleTypes = ['resistor','capacitor','inductor','vdc','ground'];
        const isSimple = S.parts.every(p => simpleTypes.includes(p.type));
        if (isSimple && S.parts.some(p => p.type === 'vdc') && S.parts.length >= 3) {
          S.sim.running = true;
          if (VXA.SimV2 && VXA.SimV2.findDCOperatingPoint) VXA.SimV2.findDCOperatingPoint();
          if (VXA.SimV2 && VXA.SimV2.solve) VXA.SimV2.solve(1e-5);
          const anyCur = S.wires.some(w => Math.abs(w._current || 0) > 1e-9);
          if (anyCur) {
            orphanWires = S.wires.filter(w => Math.abs(w._current || 0) < 1e-9).length;
          }
          const gnd = S.parts.find(pp => pp.type === 'ground');
          if (gnd) groundPinCurrent = Math.abs(gnd._i || 0);
          S.sim.running = false;
        }
      } catch (e) { simError = e.message || String(e); }

      return {
        parseErr, placeErr,
        partCount: S.parts.length,
        wireCount: S.wires.length,
        partTypes: S.parts.map(p => p.type),
        parts: S.parts.map(p => ({ type:p.type, name:p.name, x:p.x, y:p.y, rot:p.rot })),
        groundCount: S.parts.filter(p => p.type === 'ground').length,
        wiresInParts: violations,
        circuitNodeCount: circuit ? circuit.nodeCount : 0,
        circuitPartCount: circuit ? (circuit.parts || []).length : 0,
        diagonalWires: S.wires.filter(w => w.x1 !== w.x2 && w.y1 !== w.y2).length,
        nonHorizontalPassives, compactness, scopeFirstSample,
        gndFloatingParts, dropIntegrityViolations, busY,
        simNodes, simError, orphanWires, groundPinCurrent
      };
    }, text);

    // Screenshot the canvas (v2 suffix — Sprint 70a-fix-2)
    const shotPath = path.join(OUT_DIR, cirFile.replace('.cir', '-v2.png'));
    try {
      const canvasEl = await page.$('#C');
      if (canvasEl) await canvasEl.screenshot({ path: shotPath });
    } catch (e) { /* ignore screenshot errors */ }

    // Evaluate pass/fail
    const usesGnd = snapshot.partTypes.some(t => t !== 'ground') && snapshot.circuitPartCount > 0;
    // Look for node-0 reference in circuit — we'll infer from original .cir text
    const hasGndRef = /\b0\b/.test(text.replace(/^\*.*$/mg, ''));
    const groundExpected = hasGndRef;

    const checks = [
      { rule: 'parse no error', ok: !snapshot.parseErr, detail: snapshot.parseErr || 'OK' },
      { rule: 'place no error', ok: !snapshot.placeErr, detail: snapshot.placeErr || 'OK' },
      { rule: 'parts placed', ok: snapshot.partCount >= snapshot.circuitPartCount, detail: snapshot.partCount + ' / ' + snapshot.circuitPartCount + ' expected' },
      { rule: 'ground symbol present', ok: !groundExpected || snapshot.groundCount >= 1, detail: 'ground symbols=' + snapshot.groundCount + (groundExpected?' (GND referenced)':' (no GND in netlist)') },
      { rule: 'no diagonal wires', ok: snapshot.diagonalWires === 0, detail: snapshot.diagonalWires + ' diagonal' },
      { rule: 'no wires through parts', ok: snapshot.wiresInParts.length === 0, detail: snapshot.wiresInParts.length + ' violations' },
      // Sprint 70a-fix-2 rules
      { rule: 'default rotation (2-pin passives rot=0)', ok: snapshot.nonHorizontalPassives.length === 0,
        detail: snapshot.nonHorizontalPassives.length === 0 ? 'all horizontal'
                : snapshot.nonHorizontalPassives.map(p => p.name+'.rot='+p.rot).join(', ') },
      { rule: 'compactness score < 5.0', ok: snapshot.compactness < 5.0,
        detail: 'compactness=' + snapshot.compactness.toFixed(2) },
      { rule: 'scope buffer zero after import', ok: snapshot.scopeFirstSample === 0,
        detail: 'ch0.buf[0]=' + snapshot.scopeFirstSample },
      // Sprint 70a-fix-3 rules
      { rule: 'every node-0 part connects to ground', ok: snapshot.gndFloatingParts.length === 0,
        detail: snapshot.gndFloatingParts.length === 0 ? 'all connected'
                : snapshot.gndFloatingParts.map(x => x.name).join(', ') + ' floating' },
      { rule: 'simulator preserves all SPICE nets', ok: snapshot.simNodes >= snapshot.circuitNodeCount,
        detail: 'sim nets=' + snapshot.simNodes + ' / SPICE nets=' + snapshot.circuitNodeCount + (snapshot.simError ? ' [' + snapshot.simError + ']' : '') },
      { rule: 'no orphan wires when sim is live', ok: snapshot.orphanWires === 0,
        detail: snapshot.orphanWires === 0 ? 'all wires animate'
                : snapshot.orphanWires + ' wires stuck at _current=0' },
      { rule: 'ground pin current readout when sim live',
        ok: snapshot.groundPinCurrent === null || snapshot.groundPinCurrent > 1e-6,
        detail: snapshot.groundPinCurrent === null
                ? 'N/A (sim skipped for this circuit)'
                : 'gnd._i = ' + (snapshot.groundPinCurrent * 1000).toFixed(3) + ' mA' },
    ];
    const pass = checks.every(c => c.ok);
    if (!pass) anyFail = true;

    results.push({ file: cirFile, pass, checks, snapshot, shotPath });
  }

  await browser.close();

  // Emit report
  console.log('━'.repeat(60));
  console.log('PUPPETEER LIVE VERIFICATION — Sprint 70a');
  console.log('━'.repeat(60));
  if (pageErrors.length) {
    console.log('\n⚠️ Page errors captured:');
    pageErrors.slice(0, 20).forEach(e => console.log('  • ' + e));
    console.log('');
  }

  results.forEach(r => {
    console.log('\nTEST: ' + r.file + ' — ' + (r.pass ? '✓ PASS' : '✗ FAIL'));
    console.log('  parts=' + r.snapshot.partCount + ' wires=' + r.snapshot.wireCount
      + ' ground=' + r.snapshot.groundCount + ' types=[' + r.snapshot.partTypes.join(',') + ']');
    r.checks.forEach(c => {
      console.log('  ' + (c.ok?'✓':'✗') + ' ' + c.rule.padEnd(28) + ' — ' + c.detail);
    });
    if (r.snapshot.wiresInParts.length > 0) {
      console.log('  Wires-through-part samples:');
      r.snapshot.wiresInParts.slice(0, 4).forEach(v => {
        console.log('    wire #' + v.wireIdx + ' through ' + v.partType + '@(' + v.partX + ',' + v.partY + ') wire=(' + v.wire.x1 + ',' + v.wire.y1 + ')-(' + v.wire.x2 + ',' + v.wire.y2 + ')');
      });
    }
    console.log('  Screenshot: ' + r.shotPath.replace(ROOT + '/', ''));
  });

  console.log('\n' + '━'.repeat(60));
  console.log(anyFail ? '✗ FAILURES FOUND — deploy BLOCKED' : '✓ ALL PASS');
  console.log('━'.repeat(60));
  process.exit(anyFail ? 1 : 0);
})().catch(err => { console.error('HARNESS CRASH:', err); process.exit(2); });
