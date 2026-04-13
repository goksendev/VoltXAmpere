// ──────── INSPECTOR ────────
function updateInspector() {
  const el = document.getElementById('inspector');
  if (!S.sel.length) { el.innerHTML = '<div class="insp-empty">'+t('noSel')+'</div>'; return; }
  const p = S.parts.find(pp => pp.id === S.sel[0]); if (!p) { el.innerHTML = ''; return; }
  const def = COMP[p.type];
  el.innerHTML = `
    <div class="insp-type" style="background:${def.color}22;color:${def.color}">${def.name}</div>
    <div class="insp-row"><label>Name</label><span style="font-family:var(--font-mono)">${p.name}</span></div>
    ${def.unit ? `<div class="insp-row"><label>Value</label><span style="display:flex;align-items:center;gap:4px"><input id="insp-val" value="${p.val}" style="width:80px;text-align:right" onchange="inspValChange(this.value)"><span style="color:var(--text-3)">${def.unit}</span></span></div>` : ''}
    ${p.type === 'vac' ? `<div class="insp-row"><label>Frekans</label><span style="display:flex;align-items:center;gap:4px"><input id="insp-freq" value="${p.freq || 1000}" style="width:80px;text-align:right" onchange="inspFreqChange(this.value)"><span style="color:var(--text-3)">Hz</span></span></div>` : ''}
    <div class="insp-row"><label>Rotation</label><span style="font-family:var(--font-mono)">${(p.rot || 0) * 90}\u00B0</span></div>
    <div class="insp-row"><label>Position</label><span style="font-family:var(--font-mono)">${p.x}, ${p.y}</span></div>`;
  if (p.type === 'npn' || p.type === 'pnp') {
    el.innerHTML += `
      <div class="insp-row"><label>Model</label><select onchange="setModel(this.value)" style="background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 6px;font:11px var(--font-mono)">
        ${Object.keys(BJT_MODELS).map(k => `<option${(p.model||'Generic')===k?' selected':''}>${k}</option>`).join('')}
      </select></div>
      <div class="insp-row"><label>\u03B2 (BF)</label><span style="font-family:var(--font-mono)">${(BJT_MODELS[p.model||'Generic']||{}).BF||100}</span></div>
      <div class="insp-row"><label>Vbe</label><span style="font-family:var(--font-mono);color:var(--accent)">${fmtVal(p._vbe||0,'V')}</span></div>
      <div class="insp-row"><label>Vce</label><span style="font-family:var(--font-mono);color:var(--blue)">${fmtVal(p._vce||0,'V')}</span></div>
      <div class="insp-row"><label>Ic</label><span style="font-family:var(--font-mono);color:var(--orange)">${fmtVal(p._ic||0,'A')}</span></div>
      <div class="insp-row"><label>Bölge</label><span style="font-family:var(--font-mono);color:${p._region==='Aktif'?'var(--green)':p._region==='Doyma'?'var(--orange)':'var(--red)'}">${p._region||'\u2014'}</span></div>`;
  }
  if (p.type === 'nmos' || p.type === 'pmos') {
    el.innerHTML += `
      <div class="insp-row"><label>Model</label><select onchange="setModel(this.value)" style="background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 6px;font:11px var(--font-mono)">
        ${Object.keys(MOSFET_MODELS).map(k => '<option'+(((p.model||'Generic')===k)?' selected':'')+'>'+k+'</option>').join('')}
      </select></div>
      <div class="insp-row"><label>Vgs</label><span style="font-family:var(--font-mono);color:var(--accent)">${fmtVal(p._vgs||0,'V')}</span></div>
      <div class="insp-row"><label>Vds</label><span style="font-family:var(--font-mono);color:var(--blue)">${fmtVal(p._vds||0,'V')}</span></div>
      <div class="insp-row"><label>Id</label><span style="font-family:var(--font-mono);color:var(--orange)">${fmtVal(p._id||0,'A')}</span></div>
      <div class="insp-row"><label>Bölge</label><span style="font-family:var(--font-mono);color:${p._region==='Doyma'?'var(--green)':p._region==='Lineer'?'var(--orange)':'var(--red)'}">${p._region||'\u2014'}</span></div>`;
  }
  if (p.type === 'opamp') {
    el.innerHTML += `
      <div class="insp-row"><label>Model</label><select onchange="setModel(this.value)" style="background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 6px;font:11px var(--font-mono)">
        ${Object.keys(OPAMP_MODELS).map(k => '<option'+(((p.model||'Ideal')===k)?' selected':'')+'>'+k+'</option>').join('')}
      </select></div>
      <div class="insp-row"><label>V(+)</label><span style="font-family:var(--font-mono);color:var(--accent)">${fmtVal(p._vinP||0,'V')}</span></div>
      <div class="insp-row"><label>V(\u2212)</label><span style="font-family:var(--font-mono);color:var(--blue)">${fmtVal(p._vinN||0,'V')}</span></div>
      <div class="insp-row"><label>Vout</label><span style="font-family:var(--font-mono);color:var(--orange)">${fmtVal(p._vout||0,'V')}</span></div>
      <div class="insp-row"><label>Av</label><span style="font-family:var(--font-mono);color:var(--purple)">${(p._av||0).toFixed(1)}</span></div>`;
  }
  if (p.type === 'potentiometer') {
    el.innerHTML += '<div class="insp-row"><label>Wiper</label><input type="range" min="0" max="100" value="'+(Math.round((p.wiper||0.5)*100))+'" oninput="setPotWiper(this.value)" style="width:100px"></div>';
    el.innerHTML += '<div class="insp-row"><label>Pozisyon</label><span style="font-family:var(--font-mono)">'+Math.round((p.wiper||0.5)*100)+'%</span></div>';
  }
  if (p.type === 'ntc' || p.type === 'ptc') {
    el.innerHTML += '<div class="insp-row"><label>S\u0131cakl\u0131k</label><input type="range" min="-40" max="125" value="'+(p.temperature||25)+'" oninput="setSensorTemp(this.value)" style="width:100px"><span style="font-family:var(--font-mono);margin-left:4px">'+(p.temperature||25)+'\u00B0C</span></div>';
  }
  if (p.type === 'ldr') {
    el.innerHTML += '<div class="insp-row"><label>I\u015f\u0131k</label><input type="range" min="0" max="100" value="'+(Math.round((p.light||0.5)*100))+'" oninput="setLDRLight(this.value)" style="width:100px"><span style="font-family:var(--font-mono);margin-left:4px">'+Math.round((p.light||0.5)*100)+'%</span></div>';
  }
  // Thermal & damage info (Sprint 2)
  var th = p._thermal;
  if (th) {
    var tempColor = th.T < 40 ? 'var(--text-3)' : th.T < 60 ? 'var(--green)' : th.T < 85 ? 'var(--yellow)' : th.T < 120 ? 'var(--orange)' : 'var(--red)';
    var statusEmoji = th.status === 'normal' ? '\uD83D\uDFE2' : th.status === 'warm' ? '\uD83D\uDFE1' : th.status === 'hot' ? '\uD83D\uDFE0' : th.status === 'critical' ? '\uD83D\uDD34' : '\u26A0\uFE0F';
    el.innerHTML += '<div class="mcard" style="margin-top:8px">'
      + '<div class="mcard-label">\uD83C\uDF21\uFE0F TERMAL</div>'
      + '<div class="insp-row"><label>S\u0131cakl\u0131k</label><span style="font-family:var(--font-mono);color:' + tempColor + '">' + th.T.toFixed(1) + '\u00B0C</span></div>'
      + '<div class="insp-row"><label>G\u00FC\u00E7</label><span style="font-family:var(--font-mono)">' + fmtVal(th.P, 'W') + '</span></div>'
      + '<div class="insp-row"><label>Durum</label><span style="font-family:var(--font-mono)">' + statusEmoji + ' ' + th.status + '</span></div>'
      + (th.P > th.Pmax && !p.damaged ? '<div style="color:var(--orange);font-size:11px;margin-top:4px">\u26A0 G\u00FC\u00E7 limiti a\u015F\u0131ld\u0131! P=' + fmtVal(th.P,'W') + ' > P_max=' + fmtVal(th.Pmax,'W') + '</div>' : '')
      + (p._damageEnergy > 0 ? '<div class="insp-row"><label>Hasar Enerjisi</label><span style="font-family:var(--font-mono);color:var(--orange)">' + (p._damageEnergy).toFixed(4) + ' J</span></div>' : '')
      + '<div style="color:var(--text-3);font-size:9px;margin-top:4px;font-style:italic">\u26A0 Termal sim\u00FClasyon e\u011Fitim ama\u00E7l\u0131d\u0131r, ger\u00E7ek devre davran\u0131\u015F\u0131ndan farkl\u0131l\u0131k g\u00F6sterebilir.</div>'
      + '</div>';
  }
  if (p.damaged) {
    el.innerHTML += '<div class="mcard" style="margin-top:8px;border-color:var(--red);background:rgba(240,69,74,0.1)">'
      + '<div class="mcard-label" style="color:var(--red)">\u26A0\uFE0F HASAR</div>'
      + '<div style="font-size:12px;color:var(--red);margin-bottom:4px">' + (p.damageCause || 'bilinmeyen') + '</div>'
      + '<div class="insp-row"><label>Sonu\u00E7</label><span style="font-family:var(--font-mono);color:var(--red)">' + (p.damageResult === 'open' ? 'A\u00E7\u0131k Devre' : 'K\u0131sa Devre') + '</span></div>'
      + '<button onclick="VXA.Damage.repair(S.parts.find(function(pp){return pp.id===' + p.id + '}))" style="margin-top:6px;padding:4px 12px;border-radius:6px;background:var(--accent);color:var(--bg);border:none;cursor:pointer;font:600 11px var(--font-ui)">\uD83D\uDD28 Onar</button>'
      + ' <button onclick="VXA.Damage.repairAll()" style="margin-top:6px;padding:4px 12px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:11px var(--font-ui)">T\u00FCm\u00FCn\u00FC Onar</button>'
      + '</div>';
  }
}
function inspValChange(v) {
  if (!S.sel.length) return;
  const p = S.parts.find(pp => pp.id === S.sel[0]); if (!p) return;
  saveUndo();
  p.val = parseEngVal(v);
  needsRender = true; updateInspector();
}

function parseEngVal(s) {
  if (typeof s === 'number') return s;
  s = s.trim().toLowerCase().replace(/\s/g, '');
  s = s.replace(/(ohm|ohms|farad|henry|volt|amp|hz|ω|Ω)$/i, '');
  const suffixes = { p: 1e-12, n: 1e-9, u: 1e-6, '\u00b5': 1e-6, m: 1e-3, k: 1e3, meg: 1e6, g: 1e9 };
  for (const [suf, mul] of Object.entries(suffixes)) {
    if (s.endsWith(suf)) {
      const num = parseFloat(s.slice(0, -suf.length));
      if (!isNaN(num)) return num * mul;
    }
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function inspFreqChange(v) {
  if (!S.sel.length) return;
  const p = S.parts.find(pp => pp.id === S.sel[0]); if (!p) return;
  saveUndo();
  p.freq = parseEngVal(v);
  needsRender = true;
}

function setModel(m) {
  if (!S.sel.length) return;
  const p = S.parts.find(pp => pp.id === S.sel[0]); if (!p) return;
  saveUndo(); applyModel(p, m); needsRender = true; updateInspector();
  if (S.sim.running) buildCircuitFromCanvas();
}
function setPotWiper(v) {
  if (!S.sel.length) return;
  var p = S.parts.find(function(pp){ return pp.id === S.sel[0]; }); if (!p) return;
  p.wiper = parseInt(v) / 100;
  if (S.sim.running) buildCircuitFromCanvas();
  needsRender = true; updateInspector();
}
function setSensorTemp(v) {
  if (!S.sel.length) return;
  var p = S.parts.find(function(pp){ return pp.id === S.sel[0]; }); if (!p) return;
  p.temperature = parseInt(v);
  if (S.sim.running) buildCircuitFromCanvas();
  needsRender = true; updateInspector();
}
function setLDRLight(v) {
  if (!S.sel.length) return;
  var p = S.parts.find(function(pp){ return pp.id === S.sel[0]; }); if (!p) return;
  p.light = parseInt(v) / 100;
  if (S.sim.running) buildCircuitFromCanvas();
  needsRender = true; updateInspector();
}
