#!/usr/bin/env node
// Sprint 78: grab Nyquist + Bode PNGs via toDataURL (bypasses puppeteer
// element.screenshot() protocol hang on this build of chromium).
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const CIR = fs.readFileSync(path.join(__dirname, '16-rc-lowpass.cir'), 'utf8');
  const url = process.env.VXA_URL || 'http://localhost:8765/index.html';
  const outDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox'],
    protocolTimeout: 60000
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof runNyquist === 'function' && typeof runBode === 'function',
    { timeout: 15000 });

  // Run Bode first
  const bodeDataUrl = await page.evaluate(cir => {
    S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
    if (typeof _nc !== 'undefined' && _nc) for (const k in _nc) delete _nc[k];
    VXA.SpiceImport.placeCircuit(VXA.SpiceImport.parse(cir));
    runBode(10, 1e6, 20);
    // Force a repaint (switchTab already calls drawBode, but give layout a tick)
    drawBode();
    const cvs = document.getElementById('BODE');
    return cvs ? cvs.toDataURL('image/png') : null;
  }, CIR);

  if (bodeDataUrl && bodeDataUrl.startsWith('data:image/png;base64,')) {
    const b64 = bodeDataUrl.slice('data:image/png;base64,'.length);
    const out = path.join(outDir, 'bode-rc-lowpass.png');
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('Saved:', out);
  } else {
    console.error('Bode canvas empty');
  }

  // Now Nyquist
  const nyqDataUrl = await page.evaluate(() => {
    runNyquist(10, 1e6, 20);
    drawNyquist();
    const cvs = document.getElementById('NYQUIST');
    return cvs ? cvs.toDataURL('image/png') : null;
  });

  if (nyqDataUrl && nyqDataUrl.startsWith('data:image/png;base64,')) {
    const b64 = nyqDataUrl.slice('data:image/png;base64,'.length);
    const out = path.join(outDir, 'nyquist-rc-lowpass.png');
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('Saved:', out);
  } else {
    console.error('Nyquist canvas empty');
  }

  await browser.close();
})();
