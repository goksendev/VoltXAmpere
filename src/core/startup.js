// ──────── STARTUP ────────
loadFromURL();

// Embed mode detection
if (location.search.includes('embed=1') || location.hash.includes('embed=1')) {
  document.body.classList.add('embed-mode');
  var eb = document.getElementById('embed-badge');
  if (eb) eb.textContent = t('embedOpen');
}

// Initialize language
(function() {
  var lb = document.getElementById('lang-btn');
  if (lb) lb.textContent = '\uD83C\uDF10 ' + currentLang.toUpperCase();
  updateTopbarLabels();
  updateTabLabels();
  updateMeasLabels();
  updateOverlays();
  document.getElementById('sim-label').textContent = S.sim.running ? t('running') : t('stopped');
  document.getElementById('btn-sim').innerHTML = (S.sim.running ? '&#9646;&#9646; ' + t('stop') : '&#9654; ' + t('start'));
})();

// Splash is dismissed by the failsafe script at the bottom of <body>

// Tutorial on first visit
if (!localStorage.getItem('vxa_tutorial_done')) {
  setTimeout(startTutorial, 1200);
}

// ──────── ACCESSIBILITY & UI ENHANCEMENTS ────────
function changeFontSize(delta) {
  var current = parseFloat(getComputedStyle(document.documentElement).fontSize) || 13;
  var newSize = Math.max(10, Math.min(20, current + delta));
  document.documentElement.style.fontSize = newSize + 'px';
  localStorage.setItem('vxa_fontSize', newSize);
}
(function() {
  var saved = localStorage.getItem('vxa_fontSize');
  if (saved) document.documentElement.style.fontSize = saved + 'px';
})();

function toggleHighContrast() {
  document.body.classList.toggle('high-contrast');
  localStorage.setItem('vxa_hc', document.body.classList.contains('high-contrast') ? '1' : '0');
}
(function() { if (localStorage.getItem('vxa_hc') === '1') document.body.classList.add('high-contrast'); })();

function setAriaLabels() {
  document.querySelectorAll('#topbar .tb-btn').forEach(function(btn) {
    if (btn.title) btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('tabindex', '0');
  });
  document.querySelectorAll('#topbar button').forEach(function(btn) {
    if (!btn.getAttribute('aria-label') && btn.title) btn.setAttribute('aria-label', btn.title);
  });
}
setAriaLabels();

// Console banner
console.log('%c\u26A1 VoltXAmpere v9.0', 'color:#00e09e;font-size:18px;font-weight:bold');
console.log('%cFree Circuit Simulator with AI \u2014 voltxampere.com', 'color:#8899aa;font-size:12px');
console.log('%c' + t('scriptApi'), 'color:#f59e0b;font-size:11px');

// ──────── AI ASSISTANT ────────
var aiVisible = false;
function toggleAI() {
  aiVisible = !aiVisible;
  document.getElementById('ai-panel').classList.toggle('show', aiVisible);
  var fab = document.getElementById('ai-fab');
  if (fab) fab.classList.remove('pulse');
  if (aiVisible) { updateAILabels(); localStorage.setItem('vxa_ai_seen', '1'); }
}
// AI FAB pulse on first visit
(function() {
  var fab = document.getElementById('ai-fab');
  if (fab && !localStorage.getItem('vxa_ai_seen')) fab.classList.add('pulse');
})();

function updateAILabels() {
  document.getElementById('ai-title-text').textContent = t('aiTitle');
  document.getElementById('ai-input').placeholder = t('aiPlaceholder');
  document.getElementById('ai-send').textContent = t('aiSend');
  document.getElementById('ai-key-input').placeholder = t('aiApiKeyPlaceholder');
  var qBtns = document.querySelectorAll('.ai-quick-btn');
  if (qBtns[0]) qBtns[0].textContent = '\uD83D\uDD0D ' + t('aiFindError');
  if (qBtns[1]) qBtns[1].textContent = '\u26A1 ' + t('aiOptimize');
  if (qBtns[2]) qBtns[2].textContent = '\uD83D\uDCD6 ' + t('aiExplain');
  var saved = localStorage.getItem('vxa_ai_key');
  if (saved) document.getElementById('ai-key-input').value = saved;
}

function saveAIKey() {
  var key = document.getElementById('ai-key-input').value.trim();
  if (key) { localStorage.setItem('vxa_ai_key', key); showInfoCard('API Key', 'Saved!', ''); }
}

function getAIKey() { return localStorage.getItem('vxa_ai_key') || ''; }

function describeCircuit() {
  if (!S.parts.length) return t('noCircuit');
  var desc = 'Circuit with ' + S.parts.length + ' components and ' + S.wires.length + ' wires:\n';
  S.parts.forEach(function(p) {
    var def = COMP[p.type];
    var name = p.name || (p.type.charAt(0).toUpperCase() + p.id);
    desc += '- ' + name + ': ' + (def ? def.en || def.name : p.type);
    if (def && def.unit && p.val) desc += ' = ' + fmtVal(p.val, def.unit);
    if (p.freq) desc += ', freq=' + p.freq + 'Hz';
    desc += ' at (' + p.x + ',' + p.y + ')';
    if (p._v) desc += ' [V=' + p._v.toFixed(3) + 'V, I=' + (p._i||0).toFixed(4) + 'A]';
    desc += '\n';
  });
  desc += 'Connections: ' + S.wires.length + ' wires connecting components.\n';
  if (S._nodeVoltages) {
    desc += 'Node voltages: ';
    for (var i = 1; i < Math.min(S._nodeVoltages.length, 10); i++) {
      if (S._nodeVoltages[i] !== undefined) desc += 'N' + i + '=' + S._nodeVoltages[i].toFixed(3) + 'V ';
    }
  }
  return desc;
}

function addAIMessage(text, role) {
  var msgs = document.getElementById('ai-messages');
  var div = document.createElement('div');
  div.className = 'ai-msg ' + role;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function aiAsk(type) {
  var prompts = {
    findError: 'Analyze this circuit and find any errors, issues, or potential problems. Check for: missing ground, floating nodes, incorrect component values, short circuits, and design issues.',
    optimize: 'Suggest optimizations for this circuit. Consider: component values, power efficiency, signal quality, and cost reduction.',
    explain: 'Explain what this circuit does, how it works, and what each component\'s role is. Include key formulas and expected behavior.'
  };
  var q = prompts[type] || type;
  aiSendMessage(q);
}

function aiSend() {
  var input = document.getElementById('ai-input');
  var q = input.value.trim();
  if (!q) return;
  input.value = '';
  aiSendMessage(q);
}

function aiSendMessage(question) {
  if (!VXA.AI) {
    // Fallback: eski yöntem
    var key = getAIKey();
    if (!key) { addAIMessage(t('aiNoKey'), 'ai'); return; }
    addAIMessage(question, 'user');
    addAIMessage(t('aiThinking'), 'ai');
    return;
  }

  // Sprint 15: VXA.AI ile tool-use destekli gönder
  addAIMessage(question, 'user');

  // Quick command kontrolü
  var quick = VXA.AI.quickCommand(question.trim().toLowerCase());
  if (quick) { addAIMessage(quick, 'ai'); return; }

  if (!VXA.AI.hasApiKey()) {
    var key = getAIKey();
    if (key) VXA.AI.setApiKey(key);
    else { addAIMessage(t('aiNoKey'), 'ai'); return; }
  }

  // "Thinking" göstergesi
  var thinkDiv = document.createElement('div');
  thinkDiv.className = 'ai-msg ai';
  thinkDiv.id = 'ai-thinking-indicator';
  thinkDiv.textContent = t('aiThinking');
  document.getElementById('ai-messages').appendChild(thinkDiv);
  document.getElementById('ai-messages').scrollTop = document.getElementById('ai-messages').scrollHeight;

  VXA.AI.send(question).then(function() {
    // thinking göstergesini kaldır
    var th = document.getElementById('ai-thinking-indicator');
    if (th && th.parentNode) th.parentNode.removeChild(th);
  });
}

// Sprint 15: VXA.AI callback'lerini bağla
(function _setupAICallbacks() {
  if (!VXA.AI) return;
  VXA.AI.onMessage(function(msg) {
    addAIMessage(msg.content, 'ai');
  });
  VXA.AI.onToolUse(function(name, input, result) {
    var icon = '\uD83D\uDD27'; // 🔧
    if (name === 'addComponent') icon = '\u2795'; // ➕
    else if (name === 'addWire') icon = '\uD83D\uDD17'; // 🔗
    else if (name === 'removeComponent') icon = '\uD83D\uDDD1'; // 🗑
    else if (name === 'startSimulation') icon = '\u25B6'; // ▶
    else if (name === 'getCircuitState') icon = '\uD83D\uDCCB'; // 📋
    else if (name === 'clearCircuit') icon = '\uD83E\uDDF9'; // 🧹
    else if (name === 'loadPreset') icon = '\uD83D\uDCE5'; // 📥
    else if (name === 'saveUndo') icon = '\uD83D\uDCBE'; // 💾
    else if (name === 'setComponentValue') icon = '\u270F'; // ✏

    var summary = icon + ' ' + name;
    if (name === 'addComponent' && input.type) summary += ': ' + input.type + (input.value ? ' (' + input.value + ')' : '');
    if (name === 'addWire') summary += ': (' + input.x1 + ',' + input.y1 + ') \u2192 (' + input.x2 + ',' + input.y2 + ')';
    if (result && result.error) summary += ' \u274C ' + result.error;
    else summary += ' \u2705';

    var div = document.createElement('div');
    div.className = 'ai-msg ai-tool';
    div.style.cssText = 'font-size:10px;color:#888;background:rgba(255,255,255,0.03);border-radius:6px;padding:3px 8px;margin:2px 0;border-left:2px solid #4a9eff;align-self:flex-start;max-width:95%';
    div.textContent = summary;
    document.getElementById('ai-messages').appendChild(div);
    document.getElementById('ai-messages').scrollTop = document.getElementById('ai-messages').scrollHeight;
  });
  VXA.AI.onError(function(err) {
    addAIMessage('\u274C ' + err.message, 'ai');
  });
  VXA.AI.onProcessing(function(isProc) {
    var btn = document.getElementById('ai-send');
    if (btn) btn.disabled = isProc;
  });
  // Sync API key
  var existingKey = getAIKey();
  if (existingKey) VXA.AI.setApiKey(existingKey);
})();

// ──────── SCRIPTING API ────────
// Extend VXA namespace (don't overwrite Config/EventBus/AutoSave)
Object.defineProperty(VXA, 'parts', { get: function() { return S.parts; } });
Object.defineProperty(VXA, 'wires', { get: function() { return S.wires; } });
VXA.addComponent = function(type, x, y, opts) {
  opts = opts || {};
  var def = COMP[type]; if (!def) { console.error('Unknown type: '+type); return null; }
  var p = { id:S.nextId++, type:type, name:nextName(type), x:snap(x||0), y:snap(y||0),
    rot:opts.rot||0, val:opts.val||def.def, freq:opts.freq||0, flipH:false, flipV:false, closed:false };
  S.parts.push(p); needsRender=true; return p;
};
VXA.removeComponent = function(id) { S.parts = S.parts.filter(function(p){return p.id !== id;}); needsRender = true; };
VXA.addWire = function(x1,y1,x2,y2) { S.wires.push({x1:snap(x1),y1:snap(y1),x2:snap(x2),y2:snap(y2)}); needsRender = true; };
VXA.runSim = function() { if(!S.sim.running) toggleSim(); };
VXA.stopSim = function() { if(S.sim.running) toggleSim(); };
VXA.getVoltage = function(nodeIdx) { return S._nodeVoltages ? S._nodeVoltages[nodeIdx] || 0 : 0; };
VXA.getCurrent = function(partId) { var p=S.parts.find(function(pp){return pp.id===partId;}); return p?p._i||0:0; };
VXA.exportJSON = function() { exportJSON(); };
VXA.loadPreset = function(id) { loadPreset(id); };
VXA.describe = function() { return describeCircuit(); };
// v6.0 settings API
VXA.setBackground = function(style) { S.bgStyle = style; needsRender = true; };
VXA.setWireStyle = function(style) { S.wireStyle = style; needsRender = true; };
VXA.setSymbolStd = function(std) { S.symbolStd = std; needsRender = true; };
VXA.setCurrentDir = function(dir) { S.currentDirection = dir; needsRender = true; };
VXA.setRealisticMode = function(on) { S.realisticMode = !!on; needsRender = true; };
VXA.repairAll = function() { VXA.Damage.repairAll(); };
VXA.help = function() {
  console.log('%cVoltXAmpere v9.0 Scripting API', 'color:#00e09e;font-weight:bold;font-size:14px');
  console.log('VXA.parts \u2014 all circuit components');
  console.log('VXA.wires \u2014 all wires');
  console.log('VXA.addComponent(type, x, y, {val, rot, freq}) \u2014 add component');
  console.log('VXA.removeComponent(id) \u2014 remove by id');
  console.log('VXA.addWire(x1,y1,x2,y2) \u2014 add wire');
  console.log('VXA.runSim() / VXA.stopSim() \u2014 simulation control');
  console.log('VXA.getVoltage(nodeIdx) \u2014 node voltage');
  console.log('VXA.getCurrent(partId) \u2014 component current');
  console.log('VXA.loadPreset(id) \u2014 load preset circuit');
  console.log('VXA.describe() \u2014 circuit description text');
  console.log('VXA.exportJSON() \u2014 download circuit JSON');
  console.log('%cv6.0 Settings:', 'color:#f59e0b;font-weight:bold');
  console.log('VXA.setBackground(style) \u2014 techGrid|engPaper|blueprint|oscBg|whiteBg');
  console.log('VXA.setWireStyle(style) \u2014 catenary|manhattan|straight|spline');
  console.log('VXA.setSymbolStd(std) \u2014 IEC|ANSI');
  console.log('VXA.setCurrentDir(dir) \u2014 conventional|electron');
  console.log('%cv6.0 Sprint 2 — Thermal & Damage:', 'color:#f0454a;font-weight:bold');
  console.log('VXA.Thermal.getTemperature(part) \u2014 component temperature');
  console.log('VXA.Thermal.reset() \u2014 reset all temperatures');
  console.log('VXA.Damage.repair(part) \u2014 repair a damaged part');
  console.log('VXA.Damage.repairAll() \u2014 repair all damaged parts');
  console.log('VXA.Damage.getLog() \u2014 damage history');
  console.log('VXA.Particles.explode(x,y,type,color) \u2014 trigger explosion effect');
  console.log('VXA.setRealisticMode(true/false) \u2014 toggle realistic damage');
  console.log('%cShortcuts: B=bg, Shift+W=wire, Shift+S=symbol, Shift+D=current, Shift+R=realistic', 'color:#3b82f6');
  return 'Type any command above to use it.';
};
window.VXA = VXA;

// ──────── CIRCUIT DESCRIPTION (pattern matching) ────────
function getCircuitDescription() {
  if (!S.parts.length) return t('noCircuit');
  var types = {};
  S.parts.forEach(function(p){ types[p.type] = (types[p.type]||0)+1; });
  var desc = '';
  if (types.vdc && types.resistor >= 2 && !types.capacitor && !types.inductor) {
    desc = currentLang==='tr' ? 'Bu devre bir gerilim b\u00F6l\u00FCc\u00FCd\u00FCr.' : 'This is a voltage divider circuit.';
    desc += ' Vout = Vin \u00D7 R2/(R1+R2)';
  } else if (types.vac && types.resistor && types.capacitor && !types.inductor) {
    desc = currentLang==='tr' ? 'Bu devre bir RC filtredir.' : 'This is an RC filter circuit.';
    desc += ' fc = 1/(2\u03C0RC)';
  } else if (types.vac && types.diode) {
    desc = currentLang==='tr' ? 'Bu devre bir do\u011Frultucu devresidir.' : 'This is a rectifier circuit.';
  } else if (types.opamp) {
    desc = currentLang==='tr' ? 'Bu devre bir op-amp konfig\u00FCrasyonudur.' : 'This is an op-amp configuration.';
  } else if (types.npn || types.pnp) {
    desc = currentLang==='tr' ? 'Bu devre bir BJT transist\u00F6r devresidir.' : 'This is a BJT transistor circuit.';
  } else if (types.nmos || types.pmos) {
    desc = currentLang==='tr' ? 'Bu devre bir MOSFET devresidir.' : 'This is a MOSFET circuit.';
  } else {
    desc = currentLang==='tr' ?
      S.parts.length + ' bile\u015Fenli ve ' + S.wires.length + ' kablolu bir devre.' :
      'A circuit with ' + S.parts.length + ' components and ' + S.wires.length + ' wires.';
  }
  return desc;
}

// ──────── RENDER LOOP ────────
// ──────── MINIMAP ────────
function drawMinimap() {
  var mc = document.getElementById('minimap');
  if (!mc || !S.parts.length) return;
  var mctx = mc.getContext('2d');
  var mw = 200, mh = 130; // 50% bigger
  mc.width = mw; mc.height = mh;
  mc.style.width = mw + 'px'; mc.style.height = mh + 'px';
  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = '#1a1a30'; // slightly brighter bg
  mctx.fillRect(0, 0, mw, mh);
  mctx.strokeStyle = '#333'; mctx.lineWidth = 1;
  mctx.strokeRect(0, 0, mw, mh);
  var mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  S.parts.forEach(function(p){mnx=Math.min(mnx,p.x-60);mny=Math.min(mny,p.y-60);mxx=Math.max(mxx,p.x+60);mxy=Math.max(mxy,p.y+60);});
  var bw=mxx-mnx||200, bh=mxy-mny||200;
  var scale = Math.min(mw/bw, mh/bh) * 0.85;
  var ox = mw/2 - (mnx+bw/2)*scale, oy = mh/2 - (mny+bh/2)*scale;
  // Wires
  mctx.strokeStyle = '#3a4a5a'; mctx.lineWidth = 0.5;
  S.wires.forEach(function(w) {
    mctx.beginPath();
    mctx.moveTo(w.x1*scale+ox, w.y1*scale+oy);
    mctx.lineTo(w.x2*scale+ox, w.y2*scale+oy);
    mctx.stroke();
  });
  // Parts as colored dots (bigger)
  S.parts.forEach(function(p) {
    var def = COMP[p.type];
    mctx.fillStyle = def ? def.color : '#888';
    mctx.fillRect(p.x*scale+ox-2, p.y*scale+oy-2, 4, 4);
  });
  // Viewport rectangle — filled + strong border
  var cw = cvs.width/DPR, ch = cvs.height/DPR;
  var vx1 = (-S.view.ox/S.view.zoom)*scale+ox;
  var vy1 = (-S.view.oy/S.view.zoom)*scale+oy;
  var vw = (cw/S.view.zoom)*scale, vh = (ch/S.view.zoom)*scale;
  mctx.fillStyle = 'rgba(0,224,158,0.06)';
  mctx.fillRect(vx1, vy1, vw, vh);
  mctx.strokeStyle = '#00e09e'; mctx.lineWidth = 2;
  mctx.strokeRect(vx1, vy1, vw, vh);
}
document.getElementById('minimap').addEventListener('click', function(e) {
  if (!S.parts.length) return;
  var rect = this.getBoundingClientRect();
  var mx = e.clientX - rect.left, my = e.clientY - rect.top;
  var mw = 160, mh = 100;
  var mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  S.parts.forEach(function(p){mnx=Math.min(mnx,p.x-60);mny=Math.min(mny,p.y-60);mxx=Math.max(mxx,p.x+60);mxy=Math.max(mxy,p.y+60);});
  var bw=mxx-mnx||200, bh=mxy-mny||200;
  var scale = Math.min(mw/bw, mh/bh) * 0.85;
  var ox = mw/2 - (mnx+bw/2)*scale, oy = mh/2 - (mny+bh/2)*scale;
  var wx = (mx - ox) / scale, wy = (my - oy) / scale;
  var cw = cvs.width/DPR, ch = cvs.height/DPR;
  S.view.ox = cw/2 - wx * S.view.zoom;
  S.view.oy = ch/2 - wy * S.view.zoom;
  needsRender = true;
});

// ──────── SUBCIRCUIT / BLOCK ────────
function ctxSaveBlock() {
  hideCtx();
  if (S.sel.length < 2) { alert('En az 2 bileşen seçin.'); return; }
  var name = prompt('Blok adı:', 'MyBlock');
  if (!name) return;
  var selParts = S.parts.filter(function(p){ return S.sel.includes(p.id); });
  var cx = selParts.reduce(function(a,p){return a+p.x;},0) / selParts.length;
  var cy = selParts.reduce(function(a,p){return a+p.y;},0) / selParts.length;
  var blockPins = [];
  selParts.forEach(function(p) {
    var pins = getPartPins(p);
    pins.forEach(function(pin, pi) {
      S.wires.forEach(function(w) {
        var wx1 = Math.round(w.x1), wy1 = Math.round(w.y1);
        var wx2 = Math.round(w.x2), wy2 = Math.round(w.y2);
        var px = Math.round(pin.x), py = Math.round(pin.y);
        if ((wx1===px&&wy1===py)||(wx2===px&&wy2===py)) {
          var otherX = (wx1===px&&wy1===py) ? wx2 : wx1;
          var otherY = (wx1===px&&wy1===py) ? wy2 : wy1;
          var isExternal = !selParts.some(function(sp) {
            return getPartPins(sp).some(function(spp) { return Math.round(spp.x)===otherX && Math.round(spp.y)===otherY; });
          });
          if (isExternal) blockPins.push({x: pin.x - cx, y: pin.y - cy, label: 'P'+(blockPins.length+1)});
        }
      });
    });
  });
  var relParts = selParts.map(function(p){ return {type:p.type,x:p.x-cx,y:p.y-cy,rot:p.rot||0,val:p.val,freq:p.freq||0}; });
  var relWires = S.wires.filter(function(w) {
    return selParts.some(function(p){ var pins=getPartPins(p); return pins.some(function(pin){return (Math.round(pin.x)===Math.round(w.x1)&&Math.round(pin.y)===Math.round(w.y1))||(Math.round(pin.x)===Math.round(w.x2)&&Math.round(pin.y)===Math.round(w.y2));}); });
  }).map(function(w){ return {x1:w.x1-cx,y1:w.y1-cy,x2:w.x2-cx,y2:w.y2-cy}; });
  S.subcircuits[name] = { parts: relParts, wires: relWires, pins: blockPins.length ? blockPins : [{x:-30,y:0,label:'IN'},{x:30,y:0,label:'OUT'}] };
  COMP['block_'+name] = {
    name: name, en: name, color: '#ec4899', unit: '', def: 0, cat: 'Blocks',
    pins: S.subcircuits[name].pins.map(function(bp){ return {dx:bp.x, dy:bp.y}; }),
    draw: function(c) {
      c.strokeStyle = '#ec4899'; c.lineWidth = 2;
      c.strokeRect(-30, -20, 60, 40);
      c.font = '600 9px Outfit'; c.fillStyle = '#ec4899'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(name, 0, 0);
      S.subcircuits[name].pins.forEach(function(bp) {
        c.beginPath(); c.moveTo(bp.x, bp.y); c.lineTo(bp.x > 0 ? bp.x+10 : bp.x-10, bp.y); c.stroke();
        c.font = '7px "JetBrains Mono"'; c.fillText(bp.label, bp.x, bp.y-8);
      });
    }
  };
  rebuildPalette();
  showInfoCard('Blok Kaydedildi', name + ' bloğu oluşturuldu.', blockPins.length + ' pin tespit edildi.');
}

function rebuildPalette() {
  // Sprint 27a: Render into #comp-panel-body (keeps search input at top)
  var el = document.getElementById('comp-panel-body') || document.getElementById('left');
  el.innerHTML = '';
  var cats = { Passive:t('catPassive'), Sources:t('catSources'), Semi:t('catSemi'), ICs:t('catICs'), Logic:t('catLogic'), Mixed:t('catMixed'), Control:t('catControl'), Blocks:t('catBlocks'), Basic:t('catBasic') };
  for (var ck in cats) {
    var cl = cats[ck];
    var items = Object.entries(COMP).filter(function(e){ return e[1].cat === ck; });
    if (!items.length) continue;
    var hdr = document.createElement('div'); hdr.className = 'cat-header open';
    hdr.innerHTML = '<span>'+cl+'</span><span class="arrow">&#9654;</span>';
    var body = document.createElement('div'); body.className = 'cat-body'; body.style.maxHeight = '600px';
    items.forEach(function(e) {
      var k = e[0], v = e[1];
      var d = document.createElement('div'); d.className = 'comp-item';
      // Mini canvas thumbnail (24×18px) — deferred draw for DOM readiness
      var mc = document.createElement('canvas');
      mc.width = 24; mc.height = 18; mc.style.cssText = 'width:24px;height:18px;margin-right:6px;vertical-align:middle;flex-shrink:0';
      (function(canvas, drawFn) {
        requestAnimationFrame(function() {
          try {
            var ctx2 = canvas.getContext('2d');
            ctx2.save(); ctx2.translate(12, 9); ctx2.scale(0.27, 0.27);
            drawFn(ctx2, 20, { val: 0, type: '' });
            ctx2.restore();
          } catch(err) {}
        });
      })(mc, v.draw.bind(v));
      var span = document.createElement('span');
      span.style.cssText = 'display:flex;align-items:center';
      span.appendChild(mc);
      span.appendChild(document.createTextNode(v.name));
      d.appendChild(span);
      if (v.key) { var ks = document.createElement('span'); ks.className = 'key'; ks.textContent = v.key; d.appendChild(ks); }
      d.addEventListener('click', function(){ startPlace(k); });
      body.appendChild(d);
    });
    hdr.addEventListener('click', function(){ this.classList.toggle('open'); this.nextSibling.classList.toggle('closed'); });
    el.appendChild(hdr); el.appendChild(body);
  }
  var psec = document.createElement('div');
  psec.innerHTML = '<div style="margin-top:16px;padding:8px;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;border-top:2px solid var(--accent)">'+t('presets')+'</div>';
  el.appendChild(psec);
  PRESETS.forEach(function(pr) {
    var d = document.createElement('div'); d.className = 'comp-item';
    d.innerHTML = '<span style="display:flex;align-items:center"><span class="dot" style="background:'+pr.color+'"></span>'+pr.name+'</span>';
    d.addEventListener('click', function(){ loadPreset(pr.id); });
    el.appendChild(d);
  });
}

// ──────── TIME CONTROL ────────
var simBookmarkState = null;
function simStep() {
  if (!S.sim.running) { buildCircuitFromCanvas(); S.sim.running = false; }
  S.sim.t += SIM_DT;
  try { solveStep(SIM_DT); } catch(e) { S.sim.error = e.message; }
  needsRender = true;
  document.getElementById('sb-time').textContent = 't='+(S.sim.t*1000).toFixed(3)+'ms';
}
function simBookmark() {
  simBookmarkState = { t: S.sim.t, nodeV: S._nodeVoltages ? Array.from(S._nodeVoltages) : null };
  showInfoCard('Yer İmi', 't = '+(S.sim.t*1000).toFixed(3)+' ms işaretlendi.', 'Geri dönmek için ↩ butonunu kullanın.');
}
function simGotoBookmark() {
  if (!simBookmarkState) return;
  S.sim.t = simBookmarkState.t;
  if (simBookmarkState.nodeV) S._nodeVoltages = new Float64Array(simBookmarkState.nodeV);
  needsRender = true;
  document.getElementById('sb-time').textContent = 't='+(S.sim.t*1000).toFixed(3)+'ms';
}

// ──────── SPRINT 27a: COMPONENT SEARCH ────────
var COMP_SEARCH_ALIASES = {
  resistor: ['resistor','direnç','direnc','r','ohm','rezistör'],
  capacitor: ['capacitor','kapasitör','kapasitor','kondansatör','kondansator','c','cap','farad'],
  inductor: ['inductor','bobin','indüktör','induktor','l','henry','coil'],
  vdc: ['vdc','dc','dc source','pil','battery','batarya','kaynak'],
  vac: ['vac','ac','ac source','alternatif'],
  pulse: ['pulse','darbe','kare dalga','square'],
  potentiometer: ['potentiometer','pot','potansiyometre','trimpot','ayarlı direnç','ayarli direnc'],
  ntc: ['ntc','thermistor','termistör','termistor','sıcaklık sensörü'],
  ptc: ['ptc','positive thermistor'],
  ldr: ['ldr','photoresistor','fotorezistör','ışık sensörü','isik sensoru'],
  diode: ['diode','diyot','d','1n4148','1n4007','rectifier'],
  led: ['led','light emitting','ışık','isik'],
  zener: ['zener','regulator diode','zener diyot'],
  npn: ['npn','transistor','transistör','bjt','2n2222','2n3904','bc547'],
  pnp: ['pnp','transistor','transistör','bjt','2n3906'],
  nmos: ['nmos','mosfet','n-channel','2n7000','irf540'],
  pmos: ['pmos','mosfet','p-channel','irf9540'],
  opamp: ['opamp','op-amp','işlemsel yükselteç','operational amplifier','lm741','tl072'],
  timer555: ['timer555','555','ne555','timer','zamanlayıcı','zamanlayici'],
  vreg: ['vreg','regulator','regülatör','7805','7812','lm317'],
  switch: ['switch','anahtar','toggle','sw'],
  pushButton: ['pushbutton','buton','button','push','anlık anahtar','anlik anahtar','pb'],
  buzzer: ['buzzer','piezo','ses','zil','beeper'],
  ground: ['ground','toprak','gnd','şase'],
  vcvs: ['vcvs','voltage controlled voltage','bağımlı kaynak'],
  vccs: ['vccs','voltage controlled current','transkonduktans'],
  ccvs: ['ccvs','current controlled voltage','transimpedans'],
  cccs: ['cccs','current controlled current','akım aynası'],
  fuse: ['fuse','sigorta'],
  relay: ['relay','röle','kontaktör'],
  crystal: ['crystal','kristal','osilatör','xtal','quartz'],
  and: ['and','ve','kapı','gate'],
  or: ['or','veya','kapı'],
  not: ['not','değil','inverter'],
  nand: ['nand','ve-değil'],
  nor: ['nor','veya-değil'],
  xor: ['xor','özel-veya','exclusive'],
  schottky: ['schottky','1n5819','bat54'],
  njfet: ['njfet','jfet','j-fet'],
  pjfet: ['pjfet','jfet p-channel'],
  transformer: ['transformer','trafo','dönüştürücü'],
  dcmotor: ['dcmotor','dc motor','motor']
};

function _matchComp(compKey, def, query) {
  var q = query.toLowerCase().trim();
  if (!q) return true;
  if (compKey.toLowerCase().indexOf(q) >= 0) return true;
  if (def.name && def.name.toLowerCase().indexOf(q) >= 0) return true;
  if (def.en && def.en.toLowerCase().indexOf(q) >= 0) return true;
  var aliases = COMP_SEARCH_ALIASES[compKey] || [];
  for (var i = 0; i < aliases.length; i++) {
    if (aliases[i].indexOf(q) >= 0) return true;
  }
  return false;
}

var _compSearchDebounce = null;
function filterComponents(query) {
  if (_compSearchDebounce) clearTimeout(_compSearchDebounce);
  _compSearchDebounce = setTimeout(function() { _doFilterComponents(query); }, 150);
}

function _doFilterComponents(query) {
  var el = document.getElementById('comp-panel-body');
  if (!el) return;
  query = (query || '').trim();

  if (!query) {
    // Restore normal category view
    rebuildPalette();
    return;
  }

  // Flat search results
  el.innerHTML = '';
  var matches = [];
  for (var k in COMP) {
    if (_matchComp(k, COMP[k], query)) matches.push([k, COMP[k]]);
  }

  if (matches.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'padding:20px 12px;text-align:center;color:var(--text-3);font-size:12px';
    empty.textContent = (typeof currentLang !== 'undefined' && currentLang === 'tr') ? 'Sonuç bulunamadı' : 'No results found';
    el.appendChild(empty);
    return;
  }

  var hdr = document.createElement('div');
  hdr.className = 'cat-header open';
  hdr.innerHTML = '<span>' + matches.length + ' sonuç / results</span>';
  el.appendChild(hdr);

  var body = document.createElement('div');
  body.className = 'cat-body';
  body.style.maxHeight = '80vh';
  matches.forEach(function(entry) {
    var k = entry[0], v = entry[1];
    var d = document.createElement('div'); d.className = 'comp-item';
    var mc = document.createElement('canvas');
    mc.width = 24; mc.height = 18; mc.style.cssText = 'width:24px;height:18px;margin-right:6px;vertical-align:middle;flex-shrink:0';
    (function(canvas, drawFn) {
      requestAnimationFrame(function() {
        try {
          var ctx2 = canvas.getContext('2d');
          ctx2.save(); ctx2.translate(12, 9); ctx2.scale(0.27, 0.27);
          drawFn(ctx2, 20, { val: 0, type: '' });
          ctx2.restore();
        } catch(err) {}
      });
    })(mc, v.draw.bind(v));
    var span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center';
    span.appendChild(mc);
    span.appendChild(document.createTextNode(v.name));
    d.appendChild(span);
    d.addEventListener('click', function() { startPlace(k); });
    body.appendChild(d);
  });
  el.appendChild(body);
}

// Keyboard shortcut: "/" to focus search
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      var inp = document.getElementById('comp-search-input');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
    }
  });
}

// ──────── CIRCUIT REPORT ────────
function generateReport() {
  var reportHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VoltXAmpere Devre Raporu</title>';
  reportHTML += '<style>body{font-family:Outfit,sans-serif;max-width:800px;margin:40px auto;color:#333;line-height:1.6}';
  reportHTML += 'h1{color:#00e09e;border-bottom:2px solid #00e09e;padding-bottom:8px}';
  reportHTML += 'h2{color:#3b82f6;margin-top:24px}table{width:100%;border-collapse:collapse;margin:12px 0}';
  reportHTML += 'th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}';
  reportHTML += '.stat{display:inline-block;padding:4px 12px;margin:4px;background:#f0f9ff;border-radius:6px;font-family:"JetBrains Mono",monospace}</style></head><body>';
  reportHTML += '<h1>&#9889; VoltXAmpere Devre Raporu</h1>';
  reportHTML += '<p><strong>Tarih:</strong> '+ new Date().toLocaleDateString('tr-TR') +'</p>';
  reportHTML += '<p><strong>Bileşen Sayısı:</strong> '+S.parts.length+' | <strong>Kablo Sayısı:</strong> '+S.wires.length+'</p>';
  reportHTML += '<h2>Devre Şeması</h2>';
  reportHTML += '<img src="'+cvs.toDataURL('image/png')+'" style="width:100%;border:1px solid #ddd;border-radius:8px">';
  reportHTML += '<h2>Malzeme Listesi (BOM)</h2><table><tr><th>Referans</th><th>Tip</th><th>Değer</th></tr>';
  S.parts.forEach(function(p) {
    if (p.type === 'ground') return;
    var def = COMP[p.type];
    reportHTML += '<tr><td>'+(p.name||(p.type.charAt(0).toUpperCase()+p.id))+'</td><td>'+(def?def.name:p.type)+'</td><td>'+(def&&def.unit?fmtVal(p.val,def.unit):'\u2014')+'</td></tr>';
  });
  reportHTML += '</table>';
  if (S._nodeVoltages && S._nodeVoltages.length > 1) {
    reportHTML += '<h2>DC Çalışma Noktası</h2>';
    for (var ni = 1; ni < S._nodeVoltages.length; ni++) {
      if (S._nodeVoltages[ni] !== undefined) {
        reportHTML += '<span class="stat">Node '+ni+': '+S._nodeVoltages[ni].toFixed(4)+' V</span> ';
      }
    }
  }
  reportHTML += '<h2>Ölçüm Sonuçları</h2>';
  reportHTML += '<span class="stat">Simülasyon Zamanı: '+(S.sim.t*1000).toFixed(3)+' ms</span>';
  if (S.sel.length) {
    var p = S.parts.find(function(pp){return pp.id===S.sel[0];});
    if (p) {
      reportHTML += '<span class="stat">V: '+fmtVal(p._v||0,'V')+'</span>';
      reportHTML += '<span class="stat">I: '+fmtVal(p._i||0,'A')+'</span>';
      reportHTML += '<span class="stat">P: '+fmtVal(p._p||0,'W')+'</span>';
    }
  }
  reportHTML += '<hr><p style="color:#999;font-size:12px">VoltXAmpere v9.0 \u2014 voltxampere.com tarafından oluşturuldu</p>';
  reportHTML += '</body></html>';
  var win = window.open('', '_blank');
  win.document.write(reportHTML);
  win.document.close();
}

// ──────── BOM ────────
function showBOM() {
  var counts = {};
  S.parts.forEach(function(p) {
    if (p.type === 'ground') return;
    var def = COMP[p.type];
    var key = p.type + '|' + (p.val||0) + '|' + (def ? def.unit : '');
    if (!counts[key]) counts[key] = { type: p.type, name: def ? def.name : p.type, val: p.val, unit: def ? def.unit : '', count: 0, refs: [] };
    counts[key].count++;
    counts[key].refs.push(p.name || (p.type.charAt(0).toUpperCase() + p.id));
  });
  var html = '<table style="width:100%;border-collapse:collapse;font:12px var(--font-mono)">';
  html += '<tr style="border-bottom:2px solid var(--border);color:var(--text-2)"><th style="text-align:left;padding:6px">Referans</th><th style="text-align:left;padding:6px">Tip</th><th style="text-align:right;padding:6px">De\u011fer</th><th style="text-align:center;padding:6px">Adet</th></tr>';
  Object.values(counts).forEach(function(c) {
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:4px 6px;color:var(--text)">' + c.refs.join(', ') + '</td>';
    html += '<td style="padding:4px 6px;color:var(--text-2)">' + c.name + '</td>';
    html += '<td style="padding:4px 6px;text-align:right;color:var(--accent)">' + (c.val ? fmtVal(c.val, c.unit) : '\u2014') + '</td>';
    html += '<td style="padding:4px 6px;text-align:center;color:var(--text)">' + c.count + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '<div style="margin-top:8px;color:var(--text-3);font:11px var(--font-ui)">Toplam: ' + S.parts.filter(function(p){return p.type!=='ground';}).length + ' bile\u015fen</div>';
  document.getElementById('bom-table').innerHTML = html;
  document.getElementById('bom-modal').style.display = 'flex';
}
function exportBOMCSV() {
  var lines = ['Referans,Tip,Deger,Birim,Adet\n'];
  var counts = {};
  S.parts.forEach(function(p) {
    if (p.type === 'ground') return;
    var def = COMP[p.type];
    var key = p.type + '|' + (p.val||0);
    if (!counts[key]) counts[key] = { refs: [], type: def?def.name:p.type, val: p.val||0, unit: def?def.unit:'', count: 0 };
    counts[key].count++;
    counts[key].refs.push(p.name || (p.type.charAt(0).toUpperCase() + p.id));
  });
  Object.values(counts).forEach(function(c) {
    lines.push(c.refs.join(';') + ',' + c.type + ',' + c.val + ',' + c.unit + ',' + c.count + '\n');
  });
  var blob = new Blob(lines, {type:'text/csv'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voltxampere-bom.csv'; a.click();
}
