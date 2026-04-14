// ──────── 3.2 + 3.6: SETTINGS MODAL + PERSISTENCE ────────
var _settingsTemp = {}; // temp copy while modal is open

function openSettings() {
  _settingsTemp = {
    bgStyle: S.bgStyle, wireStyle: S.wireStyle, symbolStd: S.symbolStd,
    currentDirection: S.currentDirection, realisticMode: S.realisticMode,
    ambientTemp: S.ambientTemp, soundOn: S.soundOn, soundVolume: S.soundVolume,
    showGrid: S.showGrid, autoSave: S.autoSave, animationsOn: S.animationsOn,
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    simMethod: S.simMethod || 'trap',
    maxNRIter: S.maxNRIter || 30,
    lteTol: S.lteTol || 1e-4
  };
  renderSettingsBody();
  document.getElementById('settings-modal').classList.add('show');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}

function renderSettingsBody() {
  var sb = document.getElementById('settings-body');
  var T = _settingsTemp;
  sb.innerHTML = ''
    // GÖRÜNÜM
    + '<div class="set-section"><h4>🎨 ' + (currentLang==='tr'?'Görünüm':'Appearance') + '</h4>'
    + _setSelect('theme', currentLang==='tr'?'Tema':'Theme', [['dark','Koyu'],['light','Açık']], T.theme)
    + _setSelect('bgStyle', currentLang==='tr'?'Arka Plan':'Background', [['techGrid','Tech Grid'],['engPaper','Engineering'],['blueprint','Blueprint'],['oscBg','Oscilloscope'],['whiteBg','White']], T.bgStyle)
    + _setSelect('symbolStd', currentLang==='tr'?'Sembol':'Symbol', [['IEC','IEC'],['ANSI','ANSI']], T.symbolStd)
    + _setSelect('wireStyle', currentLang==='tr'?'Kablo Stili':'Wire Style', [['catenary','Catenary'],['manhattan','Manhattan'],['straight','Straight'],['spline','Spline']], T.wireStyle)
    + _setToggle('animationsOn', currentLang==='tr'?'Animasyonlar':'Animations', T.animationsOn)
    + '</div>'
    // SİMÜLASYON
    + '<div class="set-section"><h4>⚡ ' + (currentLang==='tr'?'Simülasyon':'Simulation') + '</h4>'
    + _setSelect('currentDirection', currentLang==='tr'?'Akım Yönü':'Current Dir', [['conventional',currentLang==='tr'?'Konvansiyonel':'Conventional'],['electron',currentLang==='tr'?'Elektron':'Electron']], T.currentDirection)
    + _setToggle('realisticMode', currentLang==='tr'?'Gerçekçi Mod':'Realistic Mode', T.realisticMode)
    + '<div class="set-row"><label>' + (currentLang==='tr'?'Ortam Sıcaklığı':'Ambient Temp') + '</label><input type="number" value="' + T.ambientTemp + '" min="-40" max="125" onchange="_settingsTemp.ambientTemp=parseInt(this.value)"> °C</div>'
    + _setSelect('simMethod', currentLang==='tr'?'İntegrasyon Metodu':'Integration Method', [['trap','Trapezoidal'],['be','Backward Euler']], T.simMethod)
    + '<div class="set-row"><label>' + (currentLang==='tr'?'Max N-R İterasyon':'Max N-R Iterations') + '</label><input type="number" value="' + T.maxNRIter + '" min="5" max="100" onchange="_settingsTemp.maxNRIter=parseInt(this.value)"></div>'
    + '<div class="set-row"><label>' + (currentLang==='tr'?'LTE Toleransı':'LTE Tolerance') + '</label><input type="text" value="' + T.lteTol + '" onchange="_settingsTemp.lteTol=parseFloat(this.value)"></div>'
    + '</div>'
    // SES
    + '<div class="set-section"><h4>🔊 ' + (currentLang==='tr'?'Ses':'Sound') + '</h4>'
    + _setToggle('soundOn', currentLang==='tr'?'Ses Efektleri':'Sound Effects', T.soundOn)
    + '<div class="set-row"><label>' + (currentLang==='tr'?'Ses Seviyesi':'Volume') + '</label><input type="range" min="0" max="100" value="' + T.soundVolume + '" onchange="_settingsTemp.soundVolume=parseInt(this.value)"> <span style="font:11px var(--font-mono);color:var(--text-3);width:30px;text-align:right">' + T.soundVolume + '%</span></div>'
    + '</div>'
    // GRID & SNAP
    + '<div class="set-section"><h4>📐 Grid & Snap</h4>'
    + _setToggle('showGrid', 'Grid', T.showGrid)
    + '</div>'
    // VERİ
    + '<div class="set-section"><h4>💾 ' + (currentLang==='tr'?'Veri':'Data') + '</h4>'
    + _setToggle('autoSave', currentLang==='tr'?'Oto Kaydet':'Auto Save', T.autoSave)
    + '<div class="set-row"><button class="set-btn-danger" onclick="if(confirm(\'' + (currentLang==='tr'?'Tüm ayarlar sıfırlansın mı?':'Reset all settings?') + '\')){localStorage.removeItem(\'vxa_settings\');location.reload()}">' + (currentLang==='tr'?'Tüm Ayarları Sıfırla':'Reset All Settings') + '</button></div>'
    + '</div>';
}

function _setSelect(key, label, opts, cur) {
  var html = '<div class="set-row"><label>' + label + '</label><select onchange="_settingsTemp.' + key + '=this.value">';
  opts.forEach(function(o) { html += '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
  return html + '</select></div>';
}

function _setToggle(key, label, val) {
  return '<div class="set-row"><label>' + label + '</label><div class="set-toggle' + (val ? ' on' : '') + '" onclick="this.classList.toggle(\'on\');_settingsTemp.' + key + '=this.classList.contains(\'on\')"></div></div>';
}

function applySettings() {
  var T = _settingsTemp;
  S.bgStyle = T.bgStyle; S.wireStyle = T.wireStyle; S.symbolStd = T.symbolStd;
  S.currentDirection = T.currentDirection; S.realisticMode = T.realisticMode;
  S.ambientTemp = T.ambientTemp; S.soundOn = T.soundOn; S.soundVolume = T.soundVolume;
  if (!S.soundOn && VXA.SpatialAudio) VXA.SpatialAudio.stopAll();
  if (VXA.SpatialAudio) VXA.SpatialAudio.setVolume(S.soundVolume / 100);
  S.showGrid = T.showGrid; S.autoSave = T.autoSave; S.animationsOn = T.animationsOn;
  S.simMethod = T.simMethod; S.maxNRIter = T.maxNRIter; S.lteTol = T.lteTol;
  if (VXA.SimV2.setSimMethod) VXA.SimV2.setSimMethod(T.simMethod);
  // Theme
  if (T.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  saveSettingsToStorage();
  closeSettings();
  needsRender = true;
}

function saveSettingsToStorage() {
  var data = {
    bgStyle: S.bgStyle, wireStyle: S.wireStyle, symbolStd: S.symbolStd,
    currentDirection: S.currentDirection, realisticMode: S.realisticMode,
    ambientTemp: S.ambientTemp, soundOn: S.soundOn, soundVolume: S.soundVolume,
    showGrid: S.showGrid, autoSave: S.autoSave, animationsOn: S.animationsOn,
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    lang: currentLang,
    simMethod: S.simMethod, maxNRIter: S.maxNRIter, lteTol: S.lteTol
  };
  try { localStorage.setItem('vxa_settings', JSON.stringify(data)); } catch(e) {}
}

function loadSettingsFromStorage() {
  try {
    var raw = localStorage.getItem('vxa_settings');
    if (!raw) return;
    var d = JSON.parse(raw);
    if (d.bgStyle) S.bgStyle = d.bgStyle;
    if (d.wireStyle) S.wireStyle = d.wireStyle;
    if (d.symbolStd) S.symbolStd = d.symbolStd;
    if (d.currentDirection) S.currentDirection = d.currentDirection;
    if (typeof d.realisticMode === 'boolean') S.realisticMode = d.realisticMode;
    if (typeof d.ambientTemp === 'number') S.ambientTemp = d.ambientTemp;
    if (typeof d.soundOn === 'boolean') S.soundOn = d.soundOn;
    if (typeof d.soundVolume === 'number') S.soundVolume = d.soundVolume;
    if (typeof d.showGrid === 'boolean') S.showGrid = d.showGrid;
    if (typeof d.autoSave === 'boolean') S.autoSave = d.autoSave;
    if (typeof d.animationsOn === 'boolean') S.animationsOn = d.animationsOn;
    if (d.simMethod) S.simMethod = d.simMethod;
    if (typeof d.maxNRIter === 'number') S.maxNRIter = d.maxNRIter;
    if (typeof d.lteTol === 'number') S.lteTol = d.lteTol;
    if (d.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    if (d.lang) { currentLang = d.lang; setLanguage(d.lang); }
  } catch(e) {}
}
