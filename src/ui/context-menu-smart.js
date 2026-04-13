// ──────── 3.3: SMART CONTEXT MENU ────────
S.recentComponents = [];
var MAX_RECENT = 4;

function _trackRecent(type) {
  var idx = S.recentComponents.indexOf(type);
  if (idx >= 0) S.recentComponents.splice(idx, 1);
  S.recentComponents.unshift(type);
  if (S.recentComponents.length > MAX_RECENT) S.recentComponents.length = MAX_RECENT;
}

// ──────── SPRINT 15: QUICK START TEMPLATES ────────
var QUICK_START = [
  { name: {tr:'🔴 LED Yak',en:'🔴 Light an LED'},
    parts:[{type:'vdc',x:0,y:0,rot:0,val:5},{type:'resistor',x:100,y:-60,rot:0,val:220},{type:'led',x:120,y:0,rot:1,val:0},{type:'ground',x:0,y:80,rot:0,val:0}],
    wires:[{x1:0,y1:-40,x2:60,y2:-60},{x1:140,y1:-60,x2:120,y2:-30},{x1:120,y1:30,x2:0,y2:40},{x1:0,y1:40,x2:0,y2:60}] },
  { name: {tr:'🔵 RC Filtre',en:'🔵 RC Filter'},
    parts:[{type:'vac',x:-60,y:0,rot:0,val:1,freq:1000},{type:'resistor',x:40,y:-40,rot:0,val:1000},{type:'capacitor',x:120,y:0,rot:1,val:100e-9},{type:'ground',x:-60,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:120,y2:-40},{x1:120,y1:40,x2:120,y2:60},{x1:-60,y1:40,x2:-60,y2:60}] },
  { name: {tr:'🟢 Gerilim Bölücü',en:'🟢 Voltage Divider'},
    parts:[{type:'vdc',x:0,y:0,rot:0,val:12},{type:'resistor',x:100,y:-60,rot:0,val:10000},{type:'resistor',x:100,y:60,rot:1,val:10000},{type:'ground',x:0,y:100,rot:0,val:0}],
    wires:[{x1:0,y1:-40,x2:60,y2:-60},{x1:140,y1:-60,x2:100,y2:-20},{x1:100,y1:100,x2:0,y2:100},{x1:0,y1:40,x2:0,y2:80}] },
  { name: {tr:'🟡 Zener Regülatör',en:'🟡 Zener Regulator'},
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'resistor',x:0,y:-40,rot:0,val:470},{type:'zener',x:80,y:0,rot:1,val:5.1},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:80,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-40,y2:-40},{x1:40,y1:-40,x2:80,y2:-30},{x1:80,y1:30,x2:80,y2:40},{x1:-80,y1:40,x2:-80,y2:40}] },
];
function loadQuickStart(idx) {
  var qs = QUICK_START[idx]; if (!qs) return;
  saveUndo();
  S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
  if (S.sim.running) toggleSim();
  qs.parts.forEach(function(p) {
    S.parts.push({ id: S.nextId++, type: p.type, name: nextName(p.type), x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0, flipH: false, flipV: false, closed: false });
  });
  qs.wires.forEach(function(w) { S.wires.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }); });
  if (typeof fitToScreen === 'function') fitToScreen();
  needsRender = true; updateInspector();
  if (typeof announce === 'function') announce(t('quickStart'));
}

function showSmartCtxMenu(e) {
  e.preventDefault();
  var w = s2w(S.mouse.x, S.mouse.y);
  var hitPart = hitTestPart(w.x, w.y);
  var hitWire = _hitTestWire(w.x, w.y);
  var menu = document.getElementById('ctx-menu');
  menu.innerHTML = '';

  if (hitPart) {
    // PART context menu
    if (!S.sel.includes(hitPart.id)) { S.sel = [hitPart.id]; updateInspector(); }
    _ctxItem('✏ ' + t('ctxEdit'), 'E', function() { hideCtx(); openInlineEdit(hitPart); });
    _ctxItem('↻ ' + t('ctxRotate'), 'R', function() { hideCtx(); rotateSelected(); });
    _ctxItem('⇄ ' + t('ctxFlipH'), 'H', function() { ctxFlipH(); });
    menu.appendChild(_ctxSep());
    _ctxItem('⎘ ' + t('ctxCopy'), 'Ctrl+C', function() { hideCtx(); doCopy(); });
    _ctxItem('⊞ ' + (currentLang==='tr'?'Çoğalt':'Duplicate'), 'Ctrl+D', function() { hideCtx(); doDuplicate(); });
    _ctxItem('✕ ' + t('ctxDelete'), 'Del', function() { hideCtx(); deleteSelected(); }, true);
    menu.appendChild(_ctxSep());
    _ctxItem('⚆ ' + t('ctxProbe'), 'P', function() { ctxProbe(); });
    _ctxItem('ℹ ' + (currentLang==='tr'?'Bilgi':'Info'), '', function() { hideCtx(); showEncyclopedia(hitPart.type); });
    if (hitPart.damaged) {
      _ctxItem('🔨 ' + (currentLang==='tr'?'Onar':'Repair'), '', function() { hideCtx(); VXA.Damage.repair(hitPart); needsRender = true; });
    }
  } else if (hitWire !== null) {
    // WIRE context menu
    _ctxItem('✕ ' + (currentLang==='tr'?'Kabloyu Sil':'Delete Wire'), 'Del', function() { hideCtx(); saveUndo(); S.wires.splice(hitWire, 1); needsRender = true; }, true);
    _ctxItem('⚆ ' + t('ctxProbe'), 'P', function() { hideCtx(); });
  } else {
    // EMPTY AREA context menu
    var hdr = document.createElement('div'); hdr.className = 'cm-header';
    hdr.textContent = currentLang==='tr'?'⚡ Hızlı Ekle':'⚡ Quick Add';
    menu.appendChild(hdr);
    // Recent components
    if (S.recentComponents.length > 0) {
      S.recentComponents.forEach(function(type) {
        var def = COMP[type]; if (!def) return;
        _ctxItem(def.name, def.key || '', function() { hideCtx(); startPlace(type); });
      });
      menu.appendChild(_ctxSep());
    }
    // Quick Start templates
    var qsHdr = document.createElement('div'); qsHdr.className = 'cm-header';
    qsHdr.textContent = t('quickStart');
    menu.appendChild(qsHdr);
    QUICK_START.forEach(function(qs, qi) {
      _ctxItem(qs.name[currentLang] || qs.name.en, '', (function(i) { return function() { hideCtx(); loadQuickStart(i); }; })(qi));
    });
    menu.appendChild(_ctxSep());
    _ctxItem('📋 ' + (currentLang==='tr'?'Yapıştır':'Paste'), 'Ctrl+V', function() { hideCtx(); doPaste(); });
    _ctxItem('📐 ' + (currentLang==='tr'?'Sığdır':'Fit'), 'Ctrl+Shift+F', function() { hideCtx(); fitToScreen(); });
    menu.appendChild(_ctxSep());
    _ctxItem('⚙ ' + (currentLang==='tr'?'Ayarlar':'Settings'), '', function() { hideCtx(); openSettings(); });
  }

  // Position & show
  var mx = e.clientX, my = e.clientY;
  menu.style.display = 'block'; menu.style.left = mx + 'px'; menu.style.top = my + 'px';
  // Clamp to viewport
  requestAnimationFrame(function() {
    var r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = (mx - r.width) + 'px';
    if (r.bottom > window.innerHeight) menu.style.top = (my - r.height) + 'px';
  });
}

function _ctxItem(label, shortcut, fn, danger) {
  var d = document.createElement('div'); d.className = 'cm-item';
  if (danger) d.style.color = 'var(--red)';
  d.innerHTML = label + (shortcut ? '<span class="cm-key">' + shortcut + '</span>' : '');
  d.addEventListener('click', fn);
  document.getElementById('ctx-menu').appendChild(d);
}

function _ctxSep() { var d = document.createElement('div'); d.className = 'cm-sep'; return d; }

function _hitTestWire(wx, wy) {
  for (var i = 0; i < S.wires.length; i++) {
    var w = S.wires[i];
    var dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    var len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1) continue;
    var t2 = Math.max(0, Math.min(1, ((wx - w.x1)*dx + (wy - w.y1)*dy) / (len*len)));
    var px = w.x1 + t2*dx, py = w.y1 + t2*dy;
    var dist = Math.sqrt((wx-px)*(wx-px) + (wy-py)*(wy-py));
    if (dist < 8) return i;
  }
  return null;
}

// ──────── 3.4: RECENT COMPONENTS IN LEFT PANEL ────────
function _buildRecentSection(container) {
  // Remove existing recent section
  var existing = container.querySelector('.recent-section');
  if (existing) existing.remove();

  if (!S.recentComponents.length) return;

  var sec = document.createElement('div'); sec.className = 'recent-section';
  var hdr = document.createElement('div'); hdr.className = 'recent-header';
  hdr.textContent = '⏱ ' + (currentLang === 'tr' ? 'Son Kullanılanlar' : 'Recent');
  sec.appendChild(hdr);

  S.recentComponents.forEach(function(type) {
    var def = COMP[type]; if (!def) return;
    var d = document.createElement('div'); d.className = 'comp-item';
    d.innerHTML = '<span style="display:flex;align-items:center"><span class="dot" style="background:' + def.color + '"></span>' + def.name + '</span>' + (def.key ? '<span class="key">' + def.key + '</span>' : '');
    d.addEventListener('click', function() { startPlace(type); });
    sec.appendChild(d);
  });

  // Insert after search or at top
  var firstChild = container.firstChild;
  container.insertBefore(sec, firstChild);
}
