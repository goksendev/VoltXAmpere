// ──────── 5.6: WELCOME — trigger after splash ────────
setTimeout(function() { showWelcome(); }, 2200);

// ──────── v6 SETTINGS KEYBOARD SHORTCUTS ────────
// B = cycle background, Shift+W = cycle wire style, Shift+S = toggle IEC/ANSI, Shift+D = toggle current direction
var _v6bgStyles = ['techGrid', 'engPaper', 'blueprint', 'oscBg', 'whiteBg'];
var _v6wireStyles = ['catenary', 'manhattan', 'straight', 'spline'];

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  // B = cycle background
  if (e.key === 'b' || e.key === 'B') {
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    var idx = _v6bgStyles.indexOf(S.bgStyle);
    S.bgStyle = _v6bgStyles[(idx + 1) % _v6bgStyles.length];
    needsRender = true;
    VXA.EventBus.emit('bgChange', S.bgStyle);
    return;
  }
  // Shift+W = cycle wire style
  if ((e.key === 'W') && e.shiftKey && !e.ctrlKey) {
    var wIdx = _v6wireStyles.indexOf(S.wireStyle);
    S.wireStyle = _v6wireStyles[(wIdx + 1) % _v6wireStyles.length];
    needsRender = true;
    VXA.EventBus.emit('wireStyleChange', S.wireStyle);
    return;
  }
  // Shift+S = toggle IEC/ANSI
  if ((e.key === 'S') && e.shiftKey && !e.ctrlKey) {
    S.symbolStd = S.symbolStd === 'IEC' ? 'ANSI' : 'IEC';
    needsRender = true;
    VXA.EventBus.emit('symbolStdChange', S.symbolStd);
    return;
  }
  // Shift+D = toggle current direction
  if ((e.key === 'D') && e.shiftKey && !e.ctrlKey) {
    S.currentDirection = S.currentDirection === 'conventional' ? 'electron' : 'conventional';
    needsRender = true;
    VXA.EventBus.emit('currentDirChange', S.currentDirection);
    return;
  }
  // Shift+R = toggle realistic mode
  if ((e.key === 'R') && e.shiftKey && !e.ctrlKey) {
    S.realisticMode = !S.realisticMode;
    needsRender = true;
    VXA.EventBus.emit('realisticModeChange', S.realisticMode);
    return;
  }
});

// Restore autosave on load
(function() {
  var saved = VXA.AutoSave.restore();
  if (saved && saved.parts && saved.parts.length > 0) {
    // Apply saved settings
    if (saved.settings) {
      if (saved.settings.bgStyle) S.bgStyle = saved.settings.bgStyle;
      if (saved.settings.wireStyle) S.wireStyle = saved.settings.wireStyle;
      if (saved.settings.symbolStd) S.symbolStd = saved.settings.symbolStd;
      if (saved.settings.currentDirection) S.currentDirection = saved.settings.currentDirection;
    }
    // Show restore prompt (non-blocking, auto-dismiss)
    var rDiv = document.createElement('div');
    rDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface-2);border:1px solid var(--border-2);border-radius:12px;padding:20px 28px;z-index:150;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6)';
    rDiv.innerHTML = '<div style="font:600 14px var(--font-ui);color:var(--accent);margin-bottom:8px">' + (currentLang==='tr'?'Son devreniz kurtarılsın mı?':'Restore last circuit?') + '</div>'
      + '<div style="font:11px var(--font-mono);color:var(--text-3);margin-bottom:12px">' + saved.parts.length + ' parts &middot; ' + new Date(saved.timestamp).toLocaleString() + '</div>'
      + '<button id="_vxa_restore_yes" style="padding:6px 16px;border-radius:6px;background:var(--accent);color:var(--bg);border:none;cursor:pointer;font:600 12px var(--font-ui);margin-right:8px">' + (currentLang==='tr'?'Evet':'Yes') + '</button>'
      + '<button id="_vxa_restore_no" style="padding:6px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)">' + (currentLang==='tr'?'Hayır':'No') + '</button>';
    document.body.appendChild(rDiv);
    document.getElementById('_vxa_restore_yes').onclick = function() {
      saved.parts.forEach(function(p) {
        // Sprint 53: tüm kritik alanları taşı + model uygula
        var np = { id: S.nextId++, type: p.type, name: p.name || nextName(p.type),
          x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0,
          flipH: p.flipH||false, flipV: p.flipV||false, closed: p.closed||false };
        if (p.model) np.model = p.model;
        if (p.ledColor) np.ledColor = p.ledColor;
        if (p.wiper !== undefined) np.wiper = p.wiper;
        if (p.label) np.label = p.label;
        if (p.coupling) np.coupling = p.coupling;
        if (p.L1) np.L1 = p.L1;
        if (p.L2) np.L2 = p.L2;
        if (p.phase) np.phase = p.phase;
        if (p.duty) np.duty = p.duty;
        if (p.dcOffset) np.dcOffset = p.dcOffset;
        if (p.impedance) np.impedance = p.impedance;
        if (p.srcType) np.srcType = p.srcType;
        if (p.amplitude) np.amplitude = p.amplitude;
        if (Array.isArray(p.pwlPoints)) np.pwlPoints = p.pwlPoints;
        if (p.expParams) np.expParams = p.expParams;
        if (p.sffmParams) np.sffmParams = p.sffmParams;
        if (typeof p.icVoltage === 'number') np.icVoltage = p.icVoltage;
        if (p.subcktName) np.subcktName = p.subcktName;
        if (p.subcktParams) np.subcktParams = p.subcktParams;
        if (p.beta) np.beta = p.beta;
        if (Array.isArray(p.pins)) np.pins = p.pins;
        S.parts.push(np);
      });
      // Sprint 53: restore sonrası model'leri uygula (eski save'lerde default atanır)
      if (VXA.AutoSave.applyModelsToParts) VXA.AutoSave.applyModelsToParts(S.parts);
      saved.wires.forEach(function(w) { S.wires.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }); });
      if (saved.netNames) S.netNames = saved.netNames;
      needsRender = true;
      rDiv.remove();
    };
    document.getElementById('_vxa_restore_no').onclick = function() { rDiv.remove(); VXA.AutoSave.clear(); };
    setTimeout(function() { if (rDiv.parentNode) rDiv.remove(); }, 10000);
  }
  VXA.AutoSave.start();
})();

function loop() {
  var tmPlayback = VXA.TimeMachine && VXA.TimeMachine.isPlayback();
  if (needsRender || S.sim.running || tmPlayback || S.mode !== 'select' || S.hoveredPin || S.particles.length > 0) {
    render(); needsRender = false;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Sprint 10: Init a11y labels + restore high contrast
S.highContrast = false;
setTimeout(function() {
  if (typeof setupA11yLabels === 'function') setupA11yLabels();
  if (typeof localStorage !== 'undefined' && localStorage.getItem('vxa_high_contrast') === '1') {
    S.highContrast = true; document.documentElement.setAttribute('data-contrast', 'high');
  }
  // Sprint 42: restore user-imported .LIB models + wire up canvas drop zone
  try {
    if (typeof VXA !== 'undefined' && VXA.LibImport) {
      VXA.LibImport.loadFromStorage();
      var dropZone = document.getElementById('canvas-wrap') || document.body;
      if (dropZone) VXA.LibImport.setupFileDrop(dropZone);
    }
  } catch (e) { /* non-fatal */ }
  // Sprint 43: spin up sim worker if supported (silent fallback otherwise)
  try {
    if (typeof VXA !== 'undefined' && VXA.SimBridge) VXA.SimBridge.init();
  } catch (e) { /* non-fatal */ }
}, 500);
// Sprint 43: stray closing script tag removed (legacy template artifact) — bundle now closes cleanly via src/index.html.