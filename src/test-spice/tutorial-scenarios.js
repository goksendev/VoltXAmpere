#!/usr/bin/env node
// Sprint 80: tutorial scenarios + screenshots.
// A — auto-start on fresh localStorage
// B — Esc dismiss + completion flag
// C — step advance via event (drop a resistor into S.parts → step 1 → 2)
// D — F1 restart

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.env.VXA_URL || 'http://localhost:8765/simulator.html';
const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function save(dataUrl, name) {
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) return;
  const b64 = dataUrl.slice('data:image/png;base64,'.length);
  const out = path.join(outDir, name);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('Saved:', out);
}

async function newFreshPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'], protocolTimeout: 60000
  });
  const results = {};

  // ──────── SCENARIO A: fresh launch → overlay visible ────────
  {
    const page = await newFreshPage(browser);
    // Clear localStorage BEFORE navigation using about:blank (otherwise the
    // origin isn't granted yet). We navigate twice: first to the app URL so
    // we have the origin, clear storage, then reload.
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    // Wait for the 1.2s deferred startTutorial call.
    await new Promise(r => setTimeout(r, 2000));
    const a = await page.evaluate(() => {
      const ov = document.getElementById('tutorial-overlay');
      const title = document.getElementById('tut-title');
      return {
        overlayDisplayed: !!ov && getComputedStyle(ov).display !== 'none',
        titleText: title ? title.textContent.trim() : null,
        step: (VXA.Tutorial && VXA.Tutorial.currentStep) ? VXA.Tutorial.currentStep() : null,
        totalSteps: (VXA.Tutorial && VXA.Tutorial.totalSteps) ? VXA.Tutorial.totalSteps() : null,
        tutorialActive: !!(VXA.Tutorial && VXA.Tutorial.isActive && VXA.Tutorial.isActive())
      };
    });
    // Capture the intro card
    const shot = await page.evaluate(() => {
      // Screenshot the full viewport via canvas trick — we use PAGE-level
      // screenshot instead of element.screenshot because the overlay is
      // a DIV, not a canvas.
      return null;
    });
    const pageShot = await page.screenshot({ fullPage: false, encoding: 'base64' });
    save('data:image/png;base64,' + pageShot, 'tutorial-A-welcome.png');
    results.A = a;
    await page.close();
  }

  // ──────── SCENARIO B: Esc dismisses + sets flag ────────
  {
    const page = await newFreshPage(browser);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    // Assert overlay visible, then press Esc
    const before = await page.evaluate(() => {
      const ov = document.getElementById('tutorial-overlay');
      return ov && getComputedStyle(ov).display !== 'none';
    });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));
    const after = await page.evaluate(() => {
      const ov = document.getElementById('tutorial-overlay');
      return {
        hidden: !ov || getComputedStyle(ov).display === 'none',
        flag:   localStorage.getItem('vxa_tutorial_completed'),
        legacy: localStorage.getItem('vxa_tutorial_done')
      };
    });
    results.B = { before, after };
    await page.close();
  }

  // ──────── SCENARIO C: step advances when resistor is placed ────────
  {
    const page = await newFreshPage(browser);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    // Step 0 is welcome — click Next to reach step 1 (placeResistor)
    const step0 = await page.evaluate(() => VXA.Tutorial.currentStep());
    await page.evaluate(() => window.nextTutStep());
    const step1 = await page.evaluate(() => VXA.Tutorial.currentStep());
    // Simulate part placement by directly mutating S.parts and waiting for
    // the poll (250ms) to see it advance.
    await page.evaluate(() => {
      if (!S.parts) S.parts = [];
      S.parts.push({ type: 'resistor', id: 999, x: 0, y: 0, rot: 0, val: 1000 });
    });
    await new Promise(r => setTimeout(r, 500));
    const step2 = await page.evaluate(() => VXA.Tutorial.currentStep());
    results.C = { step0, afterNext: step1, afterResistorDrop: step2 };
    await page.close();
  }

  // ──────── SCENARIO D: F1 restarts after completion ────────
  {
    const page = await newFreshPage(browser);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // Pretend user has completed before
    await page.evaluate(() => {
      localStorage.setItem('vxa_tutorial_completed', '1');
      localStorage.setItem('vxa_tutorial_done', '1');
    });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    const beforeF1 = await page.evaluate(() => VXA.Tutorial.isActive());
    await page.keyboard.press('F1');
    await new Promise(r => setTimeout(r, 300));
    const afterF1 = await page.evaluate(() => ({
      active: VXA.Tutorial.isActive(),
      step:   VXA.Tutorial.currentStep()
    }));
    results.D = { beforeF1, afterF1 };
    await page.close();
  }

  await browser.close();

  console.log('━'.repeat(60));
  console.log('Sprint 80 TUTORIAL SCENARIOS');
  console.log('━'.repeat(60));

  const A = results.A;
  console.log('\n[A] Fresh launch');
  console.log('    overlayDisplayed=' + A.overlayDisplayed);
  console.log('    title=' + JSON.stringify(A.titleText));
  console.log('    step=' + A.step + '/' + A.totalSteps);
  const aPass = A.overlayDisplayed && A.step === 0 && A.totalSteps === 8;

  const B = results.B;
  console.log('\n[B] Esc dismiss');
  console.log('    beforeEsc: overlay shown = ' + B.before);
  console.log('    afterEsc:  hidden = ' + B.after.hidden + '  flag = ' + B.after.flag + '  legacy = ' + B.after.legacy);
  const bPass = B.before === true && B.after.hidden && B.after.flag === '1';

  const C = results.C;
  console.log('\n[C] Event-triggered step advance');
  console.log('    step0(welcome) = ' + C.step0);
  console.log('    after Next     = ' + C.afterNext + '  (expect 1 = placeResistor)');
  console.log('    after resistor = ' + C.afterResistorDrop + '  (expect 2 = wire)');
  const cPass = C.step0 === 0 && C.afterNext === 1 && C.afterResistorDrop === 2;

  const D = results.D;
  console.log('\n[D] F1 restart');
  console.log('    before F1: active = ' + D.beforeF1);
  console.log('    after  F1: active = ' + D.afterF1.active + '  step = ' + D.afterF1.step);
  const dPass = D.beforeF1 === false && D.afterF1.active === true && D.afterF1.step === 0;

  console.log('\n━'.repeat(60));
  console.log('A fresh launch       : ' + (aPass ? '✓ PASS' : '✗ FAIL'));
  console.log('B Esc dismiss        : ' + (bPass ? '✓ PASS' : '✗ FAIL'));
  console.log('C event advance      : ' + (cPass ? '✓ PASS' : '✗ FAIL'));
  console.log('D F1 restart         : ' + (dPass ? '✓ PASS' : '✗ FAIL'));
  process.exit((aPass && bPass && cPass && dPass) ? 0 : 1);
})();
