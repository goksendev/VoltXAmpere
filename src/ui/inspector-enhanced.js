// ──────── 3.5: ENHANCED INSPECTOR ────────
var _inspLiveInterval = null;

function updateInspector() {
  var el = document.getElementById('inspector');
  if (_inspLiveInterval) { clearInterval(_inspLiveInterval); _inspLiveInterval = null; }

  if (!S.sel.length) {
    el.innerHTML = '<div class="insp-empty">' + t('noSel') + '</div>';
    return;
  }
  var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; });
  if (!p) { el.innerHTML = ''; return; }
  var def = COMP[p.type];
  var html = '';

  // 1. Badge
  html += '<div class="insp-badge" style="background:' + def.color + '22;color:' + def.color + '">' + (def.en || p.type) + ' — ' + (p.name || '') + '</div>';

  // 2. Editable params
  var params = getEditableParams(p);
  if (params.length) {
    params.forEach(function(param) {
      var val = param.key === 'freq' ? (p.freq || 1000) : p.val;
      html += '<div class="insp-param"><label>' + param.label + '</label>'
        + '<input value="' + _fmtEng(val) + '" onchange="inspParamChange(\'' + param.key + '\',this.value)" onfocus="this.select()">'
        + '<span class="ip-unit">' + param.unit + '</span></div>';
    });
  }

  // Model selector for BJT/MOSFET/OpAmp
  if (p.type === 'npn' || p.type === 'pnp') {
    html += '<div class="insp-param"><label>Model</label><select onchange="setModel(this.value)" style="flex:1;background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)">'
      + Object.keys(BJT_MODELS).map(function(k){ return '<option' + ((p.model||'Generic')===k?' selected':'') + '>' + k + '</option>'; }).join('') + '</select></div>';
  }
  if (p.type === 'nmos' || p.type === 'pmos') {
    html += '<div class="insp-param"><label>Model</label><select onchange="setModel(this.value)" style="flex:1;background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)">'
      + Object.keys(MOSFET_MODELS).map(function(k){ return '<option' + ((p.model||'Generic')===k?' selected':'') + '>' + k + '</option>'; }).join('') + '</select></div>';
  }
  if (p.type === 'opamp') {
    html += '<div class="insp-param"><label>Model</label><select onchange="setModel(this.value)" style="flex:1;background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)">'
      + Object.keys(OPAMP_MODELS).map(function(k){ return '<option' + ((p.model||'Ideal')===k?' selected':'') + '>' + k + '</option>'; }).join('') + '</select></div>';
  }

  // Comparator params
  if (p.type === 'comparator') {
    if (!p.props) p.props = {};
    if (p.props.hysteresis === undefined) p.props.hysteresis = 0.01;
    if (p.props.responseTime === undefined) p.props.responseTime = 100e-9;
    if (p.props.model === undefined) p.props.model = 'IDEAL';
    html += '<div class="insp-param"><label>' + t('hysteresis') + '</label>'
      + '<input value="' + (p.props.hysteresis * 1000).toFixed(1) + '" onchange="inspCompParam(\'hysteresis\',this.value)" onfocus="this.select()">'
      + '<span class="ip-unit">mV</span></div>';
    html += '<div class="insp-param"><label>Model</label><select onchange="inspCompParam(\'model\',this.value)" style="flex:1;background:var(--surface-3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)">'
      + ['IDEAL','LM311','LM393'].map(function(k){ return '<option' + (p.props.model===k?' selected':'') + '>' + k + '</option>'; }).join('') + '</select></div>';
    if (S.sim.running) {
      html += '<div class="insp-param"><label>V+</label><span style="font:11px var(--font-mono);color:var(--accent)">' + (p._compVp !== undefined ? p._compVp.toFixed(3) + ' V' : '—') + '</span></div>';
      html += '<div class="insp-param"><label>V\u2212</label><span style="font:11px var(--font-mono);color:var(--blue)">' + (p._compVn !== undefined ? p._compVn.toFixed(3) + ' V' : '—') + '</span></div>';
      html += '<div class="insp-param"><label>OUT</label><span style="font:11px var(--font-mono);color:' + (p._compOutput ? 'var(--green)' : 'var(--text-3)') + '">' + (p._compOutput ? '🟢 HIGH' : '⚫ LOW') + '</span></div>';
    }
  }

  // Potentiometer wiper
  if (p.type === 'potentiometer') {
    html += '<div class="insp-param"><label>Wiper</label><input type="range" min="0" max="100" value="' + Math.round((p.wiper||0.5)*100) + '" oninput="setPotWiper(this.value)" style="flex:1"><span class="ip-unit">' + Math.round((p.wiper||0.5)*100) + '%</span></div>';
  }
  if (p.type === 'ntc' || p.type === 'ptc') {
    html += '<div class="insp-param"><label>T°</label><input type="range" min="-40" max="125" value="' + (p.temperature||25) + '" oninput="setSensorTemp(this.value)" style="flex:1"><span class="ip-unit">' + (p.temperature||25) + '°C</span></div>';
  }
  if (p.type === 'ldr') {
    html += '<div class="insp-param"><label>Işık</label><input type="range" min="0" max="100" value="' + Math.round((p.light||0.5)*100) + '" oninput="setLDRLight(this.value)" style="flex:1"><span class="ip-unit">' + Math.round((p.light||0.5)*100) + '%</span></div>';
  }

  // 7. Resistor color bands
  if (p.type === 'resistor' && p.val > 0) {
    var bands = getColorBands(p.val);
    var tol = TOLERANCE_COLORS[p.tolerance || 5];
    if (tol) bands.push(tol);
    html += '<div class="insp-bands">';
    bands.forEach(function(c) {
      if (c) html += '<div class="insp-band" style="background:' + c + '"></div>';
    });
    html += ' <span style="font:10px var(--font-mono);color:var(--text-4)">' + fmtVal(p.val, 'Ω') + '</span></div>';
  }

  // 3. Live measurements (2x2 grid)
  html += '<div class="insp-meas-grid">'
    + '<div class="insp-meas" id="im-v"><div class="im-label">V</div><div class="im-val" style="color:var(--accent)" id="imv-val">—</div></div>'
    + '<div class="insp-meas" id="im-i"><div class="im-label">I</div><div class="im-val" style="color:var(--blue)" id="imi-val">—</div></div>'
    + '<div class="insp-meas" id="im-p"><div class="im-label">P</div><div class="im-val" style="color:var(--orange)" id="imp-val">—</div></div>'
    + '<div class="insp-meas" id="im-t"><div class="im-label">T°</div><div class="im-val" style="color:var(--text-3)" id="imt-val">—</div></div>'
    + '</div>';

  // Status chip
  var th = p._thermal;
  var status = th ? th.status : 'normal';
  var statusColors = {normal:'var(--green)',warm:'var(--yellow)',hot:'var(--orange)',critical:'var(--red)',damaged:'var(--red)'};
  var statusLabel = p.damaged ? '⚠ HASAR' : (status === 'normal' ? '🟢 Normal' : status === 'warm' ? '🟡 Sıcak' : status === 'hot' ? '🟠 Kritik' : status === 'critical' ? '🔴 TEHLİKE' : '🟢 Normal');
  html += '<div style="margin-top:6px;text-align:center"><span class="insp-chip" style="background:' + (statusColors[p.damaged ? 'damaged' : status] || 'var(--green)') + '22;color:' + (statusColors[p.damaged ? 'damaged' : status] || 'var(--green)') + '">' + statusLabel + '</span></div>';

  // 4. Damage card
  if (p.damaged) {
    html += '<div class="mcard" style="margin-top:8px;border-color:var(--red);background:rgba(240,69,74,0.1)">'
      + '<div class="mcard-label" style="color:var(--red)">⚠️ HASAR</div>'
      + '<div style="font-size:11px;color:var(--red);margin-bottom:4px">' + (p.damageCause || 'bilinmeyen') + '</div>'
      + '<div class="insp-row"><label>Sonuç</label><span style="font-family:var(--font-mono);color:var(--red)">' + (p.damageResult === 'open' ? 'Açık Devre' : 'Kısa Devre') + '</span></div>'
      + '<button onclick="VXA.Damage.repair(S.parts.find(function(pp){return pp.id===' + p.id + '}))" style="margin-top:6px;padding:4px 12px;border-radius:6px;background:var(--accent);color:var(--bg);border:none;cursor:pointer;font:600 11px var(--font-ui)">🔨 Onar</button>'
      + '</div>';
  } else if (th && th.P > th.Pmax) {
    html += '<div class="mcard" style="margin-top:8px;border-color:var(--orange);background:rgba(245,158,11,0.08)">'
      + '<div style="font-size:11px;color:var(--orange)">⚠ Güç limiti aşıldı! P=' + fmtVal(th.P,'W') + ' > P_max=' + fmtVal(th.Pmax,'W') + '</div></div>';
  }

  // 5. Position
  html += '<div style="margin-top:8px;font:10px var(--font-ui);color:var(--text-4)">'
    + 'X: ' + p.x + '  Y: ' + p.y + '  ' + ((p.rot||0)*90) + '°'
    + '</div>';

  // 6. Actions
  html += '<div class="insp-actions">'
    + '<button onclick="rotateSelected()" title="Döndür">↻ R</button>'
    + '<button onclick="ctxFlipH()" title="Çevir">⇄ H</button>'
    + '<button onclick="doDuplicate()" title="Çoğalt">⊞ D</button>'
    + '<button onclick="deleteSelected()" title="Sil" style="color:var(--red)">✕</button>';
  if (p.damaged) {
    html += '<button onclick="VXA.Damage.repair(S.parts.find(function(pp){return pp.id===' + p.id + '}))" title="Onar" style="color:var(--accent)">🔨</button>';
  }
  html += '</div>';

  el.innerHTML = html;

  // Live measurement update interval
  _inspLiveInterval = setInterval(function() {
    var pp = S.parts.find(function(x) { return S.sel.length && x.id === S.sel[0]; });
    if (!pp) { clearInterval(_inspLiveInterval); _inspLiveInterval = null; return; }
    var vEl = document.getElementById('imv-val');
    var iEl = document.getElementById('imi-val');
    var pEl = document.getElementById('imp-val');
    var tEl = document.getElementById('imt-val');
    if (vEl) vEl.textContent = fmtVal(pp._v || 0, 'V');
    if (iEl) iEl.textContent = fmtVal(pp._i || 0, 'A');
    if (pEl) pEl.textContent = fmtVal(pp._p || 0, 'W');
    var pth = pp._thermal;
    if (tEl) {
      if (pth) {
        tEl.textContent = pth.T.toFixed(1) + '°C';
        var tc = pth.T < 40 ? 'var(--text-3)' : pth.T < 60 ? 'var(--green)' : pth.T < 85 ? 'var(--yellow)' : pth.T < 120 ? 'var(--orange)' : 'var(--red)';
        tEl.style.color = tc;
        // Update measurement card border
        var tCard = document.getElementById('im-t');
        if (tCard) tCard.style.borderColor = tc;
      } else { tEl.textContent = '—'; }
    }
  }, 100);
}

function inspParamChange(key, val) {
  if (!S.sel.length) return;
  var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
  saveUndo();
  var v = parseEngVal(val);
  if (key === 'freq') p.freq = v;
  else {
    // Minimum value clamp for resistive components
    if (p.type === 'potentiometer' || p.type === 'resistor' || p.type === 'ntc' || p.type === 'ptc' || p.type === 'ldr') {
      v = Math.max(1, v);
    }
    p.val = v;
  }
  needsRender = true;
  if (S.sim.running) buildCircuitFromCanvas();
}

function inspCompParam(key, val) {
  if (!S.sel.length) return;
  var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
  if (!p.props) p.props = {};
  saveUndo();
  if (key === 'hysteresis') p.props.hysteresis = parseFloat(val) / 1000; // mV → V
  else if (key === 'model') p.props.model = val;
  else if (key === 'responseTime') p.props.responseTime = parseFloat(val) * 1e-9; // ns → s
  needsRender = true;
  if (S.sim.running) buildCircuitFromCanvas();
  updateInspector();
}
