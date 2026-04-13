// ──────── i18n ────────
var currentLang = localStorage.getItem('vxa_lang') || (navigator.language && navigator.language.startsWith('tr') ? 'tr' : 'en');

var STR = {
  tr: {
    undo:'Geri Al', redo:'Yinele', wire:'Kablo', rotate:'Döndür', del:'Sil',
    save:'Kaydet', open:'Aç', png:'PNG', svg:'SVG', csv:'CSV', spiceModel:'.model',
    share:'Paylaş', colorMap:'Renk Haritası', start:'Başlat', stop:'Durdur',
    running:'ÇALIŞIYOR', stopped:'DURDURULDU', step:'Adım', bookmark:'İşaretle',
    goBack:'Geri', report:'Rapor', bom:'BOM', gallery:'Galeri',
    catPassive:'Pasif (Passive)', catSources:'Kaynaklar (Sources)',
    catSemi:'Yarıiletken (Semiconductor)', catICs:'Entegre (ICs)',
    catLogic:'Lojik (Logic)', catControl:'Kontrol (Control)',
    catBlocks:'Özel Bloklar', catBasic:'Temel (Basic)',
    noSel:'Eleman seçilmedi', value:'Değer', frequency:'Frekans',
    rotation:'Dönüş', position:'Pozisyon', model:'Model',
    voltage:'GERİLİM (V)', current:'AKIM (A)', power:'GÜÇ (W)', freq:'FREKANS',
    tabScope:'Osiloskop', tabBode:'Bode Plot', tabDCSweep:'DC Sweep',
    tabParam:'Param Sweep', tabFFT:'FFT', tabMC:'Monte Carlo',
    tabTemp:'Sıcaklık', tabNoise:'Gürültü', tabSens:'Duyarlılık', tabWC:'Worst Case',
    timeDiv:'Zaman/div', voltDiv:'V/div', trigAuto:'Oto', trigNormal:'Normal',
    trigSingle:'Tek Atış', edgeRise:'Yükselen', edgeFall:'Düşen', math:'Matematik',
    ctxEdit:'Değer Düzenle', ctxRotate:'Döndür', ctxFlipH:'Yatay Çevir',
    ctxCopy:'Kopyala', ctxDelete:'Sil', ctxProbe:'Scope\'a Gönder', ctxBlock:'Blok Kaydet',
    tutTitle:'Hoş Geldiniz!', tutDesc:'VoltXAmpere ile profesyonel devre simülasyonu.',
    tutStep2:'Sol panelden bir eleman seçin veya 1-9 tuşlarına basın.',
    tutStep3:'Canvas\'a tıklayıp yerleştirin, W tuşuyla kablo çizin.',
    tutStep4:'Space tuşuyla simülasyonu başlatın!',
    tutStep5:'Osiloskop ve ölçüm kartlarında sonuçları izleyin.',
    tutSkip:'Atla', tutNext:'İleri',
    errConv:'⚠ Yakınsama hatası', errFloat:'⚠ Bağlantısız düğüm',
    close:'Kapat', presets:'⚡ HAZIR DEVRELER',
    loading:'Yükleniyor...', parts:'eleman', wires:'kablo',
    shareTitle:'Devreyi Paylaş', shareURL:'Paylaşım Linki',
    shareEmbed:'Embed Kodu', shareQR:'QR Kod', shareSocial:'Sosyal Medya', copied:'Kopyalandı!',
    embedOpen:'VoltXAmpere\'da Aç',
    galleryTitle:'Devre Galerisi', gallerySearch:'Devre ara...',
    galleryLoad:'Yükle', galleryAll:'Tümü', galleryBasic:'Temel',
    galleryFilter:'Filtre', galleryAmp:'Yükselteç', galleryDigital:'Dijital',
    galleryPower:'Güç', gallerySensor:'Sensör', galleryAnalysis:'Analiz',
    diffEasy:'Kolay', diffMedium:'Orta', diffHard:'Zor',
    bomTitle:'Malzeme Listesi (BOM)', bomRef:'Referans', bomType:'Tip',
    bomValue:'Değer', bomCount:'Adet', bomTotal:'Toplam',
    reportTitle:'Devre Raporu', reportDate:'Tarih', reportSchema:'Devre Şeması',
    reportBOM:'Malzeme Listesi', reportDC:'DC Çalışma Noktası',
    reportMeas:'Ölçüm Sonuçları',
    runBode:'▶ Bode Analizi Başlat', runDCSweep:'▶ DC Sweep Başlat',
    runParam:'▶ Param Sweep Başlat', runFFT:'▶ FFT Hesapla',
    runMC:'▶ Monte Carlo', runTemp:'▶ Sıcaklık Taraması',
    runNoise:'▶ Gürültü Analizi', runSens:'▶ Duyarlılık Analizi',
    runWC:'▶ Worst-Case',
    aiTitle:'AI Asistan', aiPlaceholder:'Sorunuzu yazın...', aiSend:'Gönder',
    aiFindError:'Hata Bul', aiOptimize:'Optimize Et', aiExplain:'Açıkla',
    aiApiKey:'API Anahtarı', aiApiKeyPlaceholder:'Anthropic API key...',
    aiNoKey:'API anahtarı gerekli. Ayarlardan girin.',
    aiThinking:'Düşünüyor...',
    circuitDesc:'Devre Açıklaması', noCircuit:'Devre boş',
    scriptApi:'Scripting API: console\'da VXA.help() yazın',
    integrationMethod:'İntegrasyon Metodu', lteTolerance:'LTE Toleransı', maxNRIter:'Max N-R İterasyon',
    trapMethod:'Trapez', beMethod:'Geri Euler', gminStepping:'GMIN Kademeli',
    convergenceFailed:'Yakınsama başarısız', noiseDensity:'Gürültü Yoğunluğu',
    totalRmsNoise:'Toplam RMS Gürültü', noiseContrib:'Gürültü Katkısı',
    thermalNoise:'Termal Gürültü', shotNoise:'Atış Gürültüsü',
    slewRate:'Eğim Hızı', outputSat:'Çıkış Doyması',
    validationReport:'Doğrulama Raporu', allTestsPassed:'Tüm testler geçti!',
    testFailed:'Test başarısız', damageDisclaimer:'Hasar zamanlamaları eğitim amaçlı hızlandırılmıştır',
    energyDamage:'Enerji tabanlı hasar', evpMethod:'EVP (Pesimist)', rssMethod:'RSS (İstatistiksel)',
    bothMethods:'Her İkisi', quickStart:'Hızlı Başla', ledCircuit:'LED Yak',
    rcFilter:'RC Filtre', voltageDivider:'Gerilim Bölücü', zenerReg:'Zener Regülatör',
    storageFull:'Depolama alanı dolu. Devrenizi JSON olarak kaydedin.',
  },
  en: {
    undo:'Undo', redo:'Redo', wire:'Wire', rotate:'Rotate', del:'Delete',
    save:'Save', open:'Open', png:'PNG', svg:'SVG', csv:'CSV', spiceModel:'.model',
    share:'Share', colorMap:'Color Map', start:'Start', stop:'Stop',
    running:'RUNNING', stopped:'STOPPED', step:'Step', bookmark:'Bookmark',
    goBack:'Back', report:'Report', bom:'BOM', gallery:'Gallery',
    catPassive:'Passive', catSources:'Sources',
    catSemi:'Semiconductor', catICs:'Integrated (ICs)',
    catLogic:'Logic', catControl:'Control',
    catBlocks:'Custom Blocks', catBasic:'Basic',
    noSel:'No component selected', value:'Value', frequency:'Frequency',
    rotation:'Rotation', position:'Position', model:'Model',
    voltage:'VOLTAGE (V)', current:'CURRENT (A)', power:'POWER (W)', freq:'FREQUENCY',
    tabScope:'Oscilloscope', tabBode:'Bode Plot', tabDCSweep:'DC Sweep',
    tabParam:'Param Sweep', tabFFT:'FFT', tabMC:'Monte Carlo',
    tabTemp:'Temperature', tabNoise:'Noise', tabSens:'Sensitivity', tabWC:'Worst Case',
    timeDiv:'Time/div', voltDiv:'V/div', trigAuto:'Auto', trigNormal:'Normal',
    trigSingle:'Single', edgeRise:'Rising', edgeFall:'Falling', math:'Math',
    ctxEdit:'Edit Value', ctxRotate:'Rotate', ctxFlipH:'Flip H',
    ctxCopy:'Copy', ctxDelete:'Delete', ctxProbe:'Send to Scope', ctxBlock:'Save as Block',
    tutTitle:'Welcome!', tutDesc:'Professional circuit simulation with VoltXAmpere.',
    tutStep2:'Select a component from the left panel or press 1-9.',
    tutStep3:'Click canvas to place, press W to draw wires.',
    tutStep4:'Press Space to start simulation!',
    tutStep5:'Watch results in the oscilloscope and measurement cards.',
    tutSkip:'Skip', tutNext:'Next',
    errConv:'⚠ Convergence error', errFloat:'⚠ Floating node',
    close:'Close', presets:'⚡ EXAMPLE CIRCUITS',
    loading:'Loading...', parts:'parts', wires:'wires',
    shareTitle:'Share Circuit', shareURL:'Share Link',
    shareEmbed:'Embed Code', shareQR:'QR Code', shareSocial:'Social Media', copied:'Copied!',
    embedOpen:'Open in VoltXAmpere',
    galleryTitle:'Circuit Gallery', gallerySearch:'Search circuits...',
    galleryLoad:'Load', galleryAll:'All', galleryBasic:'Basic',
    galleryFilter:'Filter', galleryAmp:'Amplifier', galleryDigital:'Digital',
    galleryPower:'Power', gallerySensor:'Sensor', galleryAnalysis:'Analysis',
    diffEasy:'Easy', diffMedium:'Medium', diffHard:'Hard',
    bomTitle:'Bill of Materials', bomRef:'Reference', bomType:'Type',
    bomValue:'Value', bomCount:'Qty', bomTotal:'Total',
    reportTitle:'Circuit Report', reportDate:'Date', reportSchema:'Schematic',
    reportBOM:'Bill of Materials', reportDC:'DC Operating Point',
    reportMeas:'Measurements',
    runBode:'▶ Run Bode', runDCSweep:'▶ Run DC Sweep',
    runParam:'▶ Run Param Sweep', runFFT:'▶ Run FFT',
    runMC:'▶ Run Monte Carlo', runTemp:'▶ Run Temp Sweep',
    runNoise:'▶ Run Noise Analysis', runSens:'▶ Run Sensitivity',
    runWC:'▶ Run Worst-Case',
    aiTitle:'AI Assistant', aiPlaceholder:'Ask a question...', aiSend:'Send',
    aiFindError:'Find Errors', aiOptimize:'Optimize', aiExplain:'Explain',
    aiApiKey:'API Key', aiApiKeyPlaceholder:'Anthropic API key...',
    aiNoKey:'API key required. Enter in settings.',
    aiThinking:'Thinking...',
    circuitDesc:'Circuit Description', noCircuit:'Circuit is empty',
    scriptApi:'Scripting API: type VXA.help() in console',
    integrationMethod:'Integration Method', lteTolerance:'LTE Tolerance', maxNRIter:'Max N-R Iterations',
    trapMethod:'Trapezoidal', beMethod:'Backward Euler', gminStepping:'GMIN Stepping',
    convergenceFailed:'Convergence failed', noiseDensity:'Noise Density',
    totalRmsNoise:'Total RMS Noise', noiseContrib:'Noise Contribution',
    thermalNoise:'Thermal Noise', shotNoise:'Shot Noise',
    slewRate:'Slew Rate', outputSat:'Output Saturation',
    validationReport:'Validation Report', allTestsPassed:'All tests passed!',
    testFailed:'Test failed', damageDisclaimer:'Damage timing is accelerated for educational purposes',
    energyDamage:'Energy-based damage', evpMethod:'EVP (Pessimistic)', rssMethod:'RSS (Statistical)',
    bothMethods:'Both', quickStart:'Quick Start', ledCircuit:'Light an LED',
    rcFilter:'RC Filter', voltageDivider:'Voltage Divider', zenerReg:'Zener Regulator',
    storageFull:'Storage full. Please export your circuit as JSON.',
  }
};

function t(k) { return (STR[currentLang] && STR[currentLang][k]) || (STR.en && STR.en[k]) || k; }

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('vxa_lang', lang);
  var lb = document.getElementById('lang-btn');
  if (lb) lb.textContent = '\uD83C\uDF10 ' + lang.toUpperCase();
  rebuildPalette();
  updateInspector();
  updateTopbarLabels();
  updateTabLabels();
  updateOverlays();
  updateCtxMenuLabels();
  document.getElementById('sim-label').textContent = S.sim.running ? t('running') : t('stopped');
  document.getElementById('btn-sim').innerHTML = (S.sim.running ? '&#9646;&#9646; ' + t('stop') : '&#9654; ' + t('start'));
  updateMeasLabels();
  // Update gallery button label
  var gbl = document.querySelector('.tb-gallery-label');
  if (gbl) gbl.textContent = t('gallery');
  // Update embed badge
  var eb = document.getElementById('embed-badge');
  if (eb) eb.textContent = t('embedOpen');
  if (aiVisible) updateAILabels();
  needsRender = true;
}

function updateTopbarLabels() {
  var btns = document.querySelectorAll('#topbar .tb-btn');
  btns.forEach(function(b) {
    var oc = b.getAttribute('onclick') || '';
    if (oc.indexOf('undo') !== -1 && oc.indexOf('simGoto') === -1) b.innerHTML = '&#8630; ' + t('undo');
    else if (oc.indexOf('redo') !== -1) b.innerHTML = '&#8631; ' + t('redo');
    else if (oc.indexOf('toggleWire') !== -1) b.innerHTML = '&#9866; ' + t('wire');
    else if (oc.indexOf('rotateSelected') !== -1) b.innerHTML = '&#8635; ' + t('rotate');
    else if (oc.indexOf('deleteSelected') !== -1) b.innerHTML = '&#10005; ' + t('del');
    else if (oc.indexOf('exportJSON') !== -1) b.innerHTML = '&#128190; ' + t('save');
    else if (oc.indexOf('importJSON') !== -1) b.innerHTML = '&#128194; ' + t('open');
    else if (oc.indexOf('shareURL') !== -1) b.innerHTML = '&#128279; ' + t('share');
    else if (oc.indexOf('showBOM') !== -1) b.innerHTML = '&#128203; ' + t('bom');
    else if (oc.indexOf('generateReport') !== -1) b.innerHTML = '&#128196; ' + t('report');
    else if (oc.indexOf('voltageMap') !== -1) b.innerHTML = '&#9889; ' + t('colorMap');
    else if (oc.indexOf('simStep') !== -1) b.innerHTML = '&#9197; ' + t('step');
    else if (oc.indexOf('simBookmark()') !== -1) b.innerHTML = '&#128278; ' + t('bookmark');
    else if (oc.indexOf('simGotoBookmark') !== -1) b.innerHTML = '&#8617; ' + t('goBack');
  });
}

function updateTabLabels() {
  var tabs = document.querySelectorAll('.btab');
  var map = {scope:'tabScope',bode:'tabBode',dcsweep:'tabDCSweep',paramsweep:'tabParam',
    fft:'tabFFT',montecarlo:'tabMC',tempsweep:'tabTemp',noise:'tabNoise',
    sensitivity:'tabSens',worstcase:'tabWC'};
  tabs.forEach(function(tb) {
    var dt = tb.getAttribute('data-tab');
    if (dt && map[dt]) tb.textContent = t(map[dt]);
  });
}

function updateMeasLabels() {
  var cards = document.querySelectorAll('.mcard-label');
  var labels = ['voltage','current','power','freq'];
  cards.forEach(function(c, i) { if (labels[i]) c.textContent = t(labels[i]); });
}

function updateOverlays() {
  var ovMap = {
    'ov-bode': 'runBode', 'ov-dcsweep': 'runDCSweep', 'ov-paramsweep': 'runParam',
    'ov-fft': 'runFFT', 'ov-montecarlo': 'runMC', 'ov-tempsweep': 'runTemp',
    'ov-noise': 'runNoise', 'ov-sensitivity': 'runSens', 'ov-worstcase': 'runWC'
  };
  for (var id in ovMap) {
    var ov = document.getElementById(id);
    if (ov) {
      var btn = ov.querySelector('.run-btn');
      if (btn) btn.textContent = t(ovMap[id]);
    }
  }
}

function updateCtxMenuLabels() {
  var items = document.querySelectorAll('#ctx-menu .cm-item');
  var keys = ['ctxEdit','ctxRotate','ctxFlipH',null,'ctxProbe','ctxCopy','ctxDelete','ctxBlock'];
  var icons = {'ctxEdit':'&#9998; ','ctxRotate':'&#8635; ','ctxFlipH':'&#8644; ','ctxProbe':'&#9906; ','ctxCopy':'&#9112; ','ctxDelete':'&#10005; ','ctxBlock':'&#9635; '};
  var ki = 0;
  items.forEach(function(item) {
    if (ki < keys.length && keys[ki] !== null) {
      var keySpan = item.querySelector('.cm-key');
      var keyHTML = keySpan ? keySpan.outerHTML : '';
      item.innerHTML = (icons[keys[ki]] || '') + t(keys[ki]) + keyHTML;
    }
    ki++;
  });
}
