#!/usr/bin/env node
// Sprint 94 HATA 15: preset geometry audit. Loads each entry in
// VXA.PRESETS, traverses its wires array, and asserts nothing has
// collapsed to a zero-length segment. The build-time validator
// (build.js validatePresetGeometry) catches source-level mistakes,
// but this probe catches anything that might be introduced at
// runtime — a cloned preset, an accidental mutation during
// serialisation, or a bug in loadPreset that duplicates a pin.
//
// Pass criterion: zero degenerate wires across all shipped presets.

const puppeteer = require('puppeteer');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof PRESETS !== 'undefined' && Array.isArray(PRESETS) && PRESETS.length > 0,
    { timeout: 15000 }
  );

  const report = await page.evaluate(() => {
    const totals = { presets: PRESETS.length, wires: 0, bad: 0 };
    const issues = [];
    PRESETS.forEach(function(pr) {
      if (!pr.wires) return;
      pr.wires.forEach(function(w, i) {
        totals.wires++;
        if (w.x1 === w.x2 && w.y1 === w.y2) {
          totals.bad++;
          issues.push({
            preset: pr.id,
            name: pr.name,
            index: i,
            coords: '(' + w.x1 + ',' + w.y1 + ')→(' + w.x2 + ',' + w.y2 + ')'
          });
        }
      });
    });
    return { totals, issues };
  });

  // Also cross-check: load each preset through the real loadPreset()
  // path and confirm S.wires never carries a zero-length wire either.
  // This exercises the Sprint-69 runtime filter (belt-and-braces).
  const loadReport = await page.evaluate(async () => {
    const out = [];
    for (var i = 0; i < PRESETS.length; i++) {
      var pr = PRESETS[i];
      try {
        loadPreset(pr.id);
        var degenerate = 0;
        S.wires.forEach(function(w) {
          if (w.x1 === w.x2 && w.y1 === w.y2) degenerate++;
        });
        out.push({ id: pr.id, wires: S.wires.length, degenerate });
      } catch (e) {
        out.push({ id: pr.id, error: e.message });
      }
    }
    return out;
  });

  await browser.close();

  console.log('━'.repeat(64));
  console.log('Sprint 94 PRESET GEOMETRY AUDIT');
  console.log('━'.repeat(64));
  console.log('  presets scanned  : ' + report.totals.presets);
  console.log('  wires scanned    : ' + report.totals.wires);
  console.log('  zero-length wires: ' + report.totals.bad);

  if (report.issues.length > 0) {
    console.log('\n  Offenders:');
    report.issues.forEach(function(it) {
      console.log('    ' + it.preset.padEnd(14) + ' [' + it.index + '] ' + it.coords + '  ' + it.name);
    });
  }

  var runtimeDegen = loadReport.filter(function(r) { return r.degenerate > 0; });
  console.log('\n  runtime-loaded presets : ' + loadReport.length);
  console.log('  runtime degenerates    : ' + runtimeDegen.length);
  if (runtimeDegen.length > 0) {
    runtimeDegen.forEach(function(r) {
      console.log('    ' + r.id + ' still has ' + r.degenerate + ' degenerate after loadPreset');
    });
  }

  const errored = loadReport.filter(function(r) { return r.error; });
  if (errored.length > 0) {
    console.log('\n  load errors:');
    errored.forEach(function(r) { console.log('    ' + r.id + ': ' + r.error); });
  }

  // Pass criteria:
  //   A — source tree: no zero-length wires
  //   B — runtime: no zero-length wires after loadPreset
  //   C — every preset loaded without a throw
  const aPass = report.totals.bad === 0;
  const bPass = runtimeDegen.length === 0;
  const cPass = errored.length === 0;

  console.log('\n━'.repeat(64));
  console.log('A source zero-length wires == 0   : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B runtime zero-length wires == 0  : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C every preset loads cleanly       : ' + (cPass ? '✓ PASS' : '✗ FAIL'));

  process.exit((aPass && bPass && cPass) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
