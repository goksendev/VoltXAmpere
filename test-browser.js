const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('=== VOLTXAMPERE v5.0 TARAYICI TESTİ ===\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Console mesajlarını yakala
  const consoleErrors = [];
  const consoleWarns = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarns.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // Sayfayı aç
  const filePath = 'file://' + path.resolve('index.html');
  await page.goto(filePath, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000)); // Splash + init bekle

  // === TEST 1: Splash geçti mi? ===
  const splashGone = await page.evaluate(() => {
    const s = document.getElementById('splash');
    return !s || s.style.display === 'none' || s.style.opacity === '0' || !document.body.contains(s);
  });
  console.log('[TEST 1] Splash:', splashGone ? 'PASS ✅' : 'FAIL ❌');

  // === TEST 2: Console hataları (sayfa yükleme) ===
  console.log('[TEST 2] Console errors at load:', consoleErrors.length === 0 ? 'PASS ✅ (0 errors)' : `FAIL ❌ (${consoleErrors.length} errors)`);
  consoleErrors.forEach(e => console.log('  ERROR:', e.substring(0, 120)));

  // === TEST 3: Temel yapı mevcut mu? ===
  const structure = await page.evaluate(() => {
    return {
      comp: typeof COMP !== 'undefined' ? Object.keys(COMP).length : 0,
      presets: typeof PRESETS !== 'undefined' ? PRESETS.length : 0,
      parts: typeof S !== 'undefined' ? S.parts.length : -1,
      hasBuildCircuit: typeof buildCircuitFromCanvas === 'function',
      hasSolveStep: typeof solveStep === 'function',
      hasToggleSim: typeof toggleSim === 'function',
      hasLoadPreset: typeof loadPreset === 'function',
      hasT: typeof t === 'function',
      hasVXA: typeof VXA !== 'undefined',
    };
  });
  console.log(`[TEST 3] Structure: COMP=${structure.comp}, PRESETS=${structure.presets}`);
  console.log(`  buildCircuit: ${structure.hasBuildCircuit ? '✅' : '❌'}, solveStep: ${structure.hasSolveStep ? '✅' : '❌'}, toggleSim: ${structure.hasToggleSim ? '✅' : '❌'}`);
  console.log(`  loadPreset: ${structure.hasLoadPreset ? '✅' : '❌'}, t(): ${structure.hasT ? '✅' : '❌'}, VXA: ${structure.hasVXA ? '✅' : '❌'}`);

  if (!structure.hasLoadPreset || !structure.hasSolveStep) {
    console.log('\n❌ CRITICAL: Core functions missing. Aborting preset tests.');
    await browser.close();
    return;
  }

  // === TEST 4: Her preset'i yükle ve simülasyonu test et ===
  console.log(`\n=== PRESET TESTLERİ (${structure.presets} adet) ===\n`);

  let pass = 0, fail = 0, partial = 0;

  for (let i = 0; i < structure.presets; i++) {
    const errBefore = consoleErrors.length;

    const result = await page.evaluate(async (idx) => {
      try {
        // Temizle
        if (S.sim.running) toggleSim();
        S.parts = []; S.wires = []; S.nextId = 1; S.sim.t = 0;
        S._nodeVoltages = null; S.sim.error = '';

        // Preset yükle
        loadPreset(PRESETS[idx].id);

        // Simülasyonu başlat
        toggleSim();

        // 200ms bekle (simülasyon çalışsın)
        await new Promise(r => setTimeout(r, 200));

        // Sonuçları topla
        const res = {
          id: PRESETS[idx].id,
          name: typeof PRESETS[idx].name === 'object' ? PRESETS[idx].name.tr || PRESETS[idx].name.en : PRESETS[idx].name,
          running: S.sim.running,
          error: S.sim.error || '',
          parts: S.parts.length,
          wires: S.wires.length,
          time: S.sim.t,
          hasNodeV: !!(S._nodeVoltages && S._nodeVoltages.length > 1),
          maxV: 0,
          partVals: 0,
        };

        if (S._nodeVoltages) {
          for (let n = 1; n < S._nodeVoltages.length; n++) {
            if (Math.abs(S._nodeVoltages[n] || 0) > res.maxV) res.maxV = Math.abs(S._nodeVoltages[n]);
          }
        }
        res.partVals = S.parts.filter(p => (p._v || 0) > 0.001 || (p._i || 0) > 0.00001).length;

        // Durdur
        if (S.sim.running) toggleSim();

        return res;
      } catch(e) {
        try { if (S.sim.running) toggleSim(); } catch(x) {}
        return { id: 'error', name: 'ERROR', error: e.message, parts: 0 };
      }
    }, i);

    const newErrors = consoleErrors.slice(errBefore);

    let status, detail;
    if (result.error && result.error.length > 0) {
      status = 'FAIL'; detail = result.error.substring(0, 80);
      fail++;
    } else if (!result.hasNodeV || result.maxV < 0.0001) {
      status = 'FAIL'; detail = 'No voltages produced';
      fail++;
    } else if (newErrors.length > 0) {
      status = 'PARTIAL'; detail = `Console error: ${newErrors[0].substring(0, 60)}`;
      partial++;
    } else if (result.partVals === 0) {
      status = 'PARTIAL'; detail = `Voltages OK (maxV=${result.maxV.toFixed(2)}V) but no part values`;
      partial++;
    } else {
      status = 'PASS'; detail = `maxV=${result.maxV.toFixed(2)}V, ${result.partVals} parts w/values, t=${(result.time*1000).toFixed(1)}ms`;
      pass++;
    }

    const icon = status === 'PASS' ? '✅' : status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`  ${icon} ${(i+1).toString().padStart(2)}. ${(result.name || result.id).padEnd(28)} ${status.padEnd(8)} ${detail}`);
  }

  console.log(`\n  TOPLAM: ${pass} PASS, ${partial} PARTIAL, ${fail} FAIL / ${structure.presets}`);

  // === TEST 5: i18n ===
  console.log('\n=== i18n TESTİ ===\n');
  const i18nResult = await page.evaluate(() => {
    try {
      const trLabel = t('undo');
      setLanguage('en');
      const enLabel = t('undo');
      setLanguage('tr');
      const trAgain = t('undo');
      return { tr: trLabel, en: enLabel, trAgain, pass: trLabel !== enLabel && trLabel === trAgain };
    } catch(e) { return { error: e.message }; }
  });
  if (i18nResult.error) {
    console.log(`  ❌ i18n: ERROR — ${i18nResult.error}`);
  } else {
    console.log(`  ${i18nResult.pass ? '✅' : '❌'} i18n: TR="${i18nResult.tr}" → EN="${i18nResult.en}" → TR="${i18nResult.trAgain}"`);
  }

  // === TEST 6: Analiz tab'ları ===
  console.log('\n=== ANALİZ TAB TESTİ ===\n');
  const tabResult = await page.evaluate(() => {
    const tabs = ['scope','bode','dcsweep','paramsweep','fft','montecarlo','tempsweep','noise','sensitivity','worstcase'];
    const results = {};
    tabs.forEach(t => {
      const panel = document.getElementById('tab-' + t);
      results[t] = panel ? 'EXISTS' : 'MISSING';
    });
    return results;
  });
  Object.entries(tabResult).forEach(([tab, status]) => {
    console.log(`  ${status === 'EXISTS' ? '✅' : '❌'} ${tab}: ${status}`);
  });

  // === TEST 7: Export fonksiyonları ===
  console.log('\n=== EXPORT FONKSİYONLARI ===\n');
  const exportResult = await page.evaluate(() => {
    const fns = ['exportJSON','importJSON','exportPNG','exportSVG','exportCSV','exportSPICE','shareURL','showBOM','generateReport','showGallery','toggleAI'];
    const res = {};
    fns.forEach(f => { res[f] = typeof window[f] === 'function' ? 'OK' : 'MISSING'; });
    return res;
  });
  Object.entries(exportResult).forEach(([fn, status]) => {
    console.log(`  ${status === 'OK' ? '✅' : '❌'} ${fn}: ${status}`);
  });

  // === TEST 8: VXA Scripting API ===
  console.log('\n=== SCRIPTING API ===\n');
  const vxaResult = await page.evaluate(() => {
    if (typeof VXA === 'undefined') return { error: 'VXA not defined' };
    return {
      hasParts: Array.isArray(VXA.parts),
      hasWires: Array.isArray(VXA.wires),
      hasAdd: typeof VXA.addComponent === 'function',
      hasRemove: typeof VXA.removeComponent === 'function',
      hasRun: typeof VXA.runSim === 'function',
      hasHelp: typeof VXA.help === 'function',
    };
  });
  if (vxaResult.error) {
    console.log(`  ❌ VXA: ${vxaResult.error}`);
  } else {
    Object.entries(vxaResult).forEach(([k, v]) => console.log(`  ${v ? '✅' : '❌'} ${k}`));
  }

  // === FINAL ÖZET ===
  console.log('\n' + '='.repeat(50));
  console.log('FINAL: Console errors toplam:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('İlk 5 hata:');
    consoleErrors.slice(0, 5).forEach(e => console.log('  ' + e.substring(0, 100)));
  }
  console.log('='.repeat(50));

  await browser.close();
})();
