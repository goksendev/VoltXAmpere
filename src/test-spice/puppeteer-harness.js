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
      };
    }, text);

    // Screenshot the canvas
    const shotPath = path.join(OUT_DIR, cirFile.replace('.cir', '.png'));
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
