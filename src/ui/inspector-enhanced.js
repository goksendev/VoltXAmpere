// ──────── 3.5: ENHANCED INSPECTOR ────────
var _inspLiveInterval = null;

// Sprint 70h / 72: per-component sample history fuels RMS readouts.
// Sprint 70h seeded this for diode/LED/zener so the Inspector tick
// stopped landing on a rectifier's reverse phase and reading pA.
// Sprint 72 generalises: any component whose sign flips across the
// buffered window is deemed AC and its Inspector card switches to
// RMS (with an "RMS" suffix). DC components keep the instantaneous
// value so resistor dividers still read "12.00 V" not an RMS
// approximation of zero-variance samples.
function getRMS(history) {
  if (!history || history.length < 2) return 0;
  var sum = 0;
  for (var i = 0; i < history.length; i++) sum += history[i] * history[i];
  return Math.sqrt(sum / history.length);
}
function isACSignal(history) {
  if (!history || history.length < 10) return false;
  var hasPos = false, hasNeg = false;
  for (var i = 0; i < history.length; i++) {
    if (history[i] >  1e-9) hasPos = true;
    if (history[i] < -1e-9) hasNeg = true;
    if (hasPos && hasNeg) return true;
  }
  return false;
}
function getRMSCurrent(part) {
  var h = part && part._iHistory;
  if (!h || h.length < 2) return Math.abs(part && part._i ? part._i : 0);
  return getRMS(h);
}

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

  // 3. Live measurements (2x2 grid). Sprint 70c+70d: ground is a
  // reference node (relabelled below); V/I sources report signed
  // current so "Çıkış" (delivering) vs "Emme" (sinking) reflects
  // whether the source is actually sourcing or absorbing power.
  var _SOURCE_KIND = { vdc:1, vac:1, pulse:1, pwl:1, idc:1, iac:1, noise:1 };
  if (_SOURCE_KIND[p.type]) {
    var _srcI = p._i || 0;
    var _srcV = p._v || 0;
    // Sprint 70d: sinking = V·I < 0, i.e. power flowing BACK INTO the
    // source. Sign of I alone is polarity-dependent; P keeps the
    // physical meaning regardless of whether the battery is wired
    // "backward" (V<0, I<0 still delivers: P = (-V)(-I) > 0).
    var _srcSink = (_srcV * _srcI) < -1e-9;
    var _srcLabel = _srcSink ? 'I (Emme &#9888;)' : 'I (&#199;&#305;k&#305;&#351;)';
    var _srcColor = _srcSink ? 'var(--orange)' : 'var(--blue)';
    html += '<div class="insp-meas-grid">'
      + '<div class="insp-meas" id="im-v"><div class="im-label">V</div><div class="im-val" style="color:var(--accent)" id="imv-val">&mdash;</div></div>'
      + '<div class="insp-meas" id="im-i"><div class="im-label">' + _srcLabel + '</div><div class="im-val" style="color:' + _srcColor + '" id="imi-val">&mdash;</div></div>'
      + '<div class="insp-meas" id="im-p"><div class="im-label">P</div><div class="im-val" style="color:var(--orange)" id="imp-val">&mdash;</div></div>'
      + '<div class="insp-meas" id="im-t"><div class="im-label">T&deg;</div><div class="im-val" style="color:var(--text-3)" id="imt-val">&mdash;</div></div>'
      + '</div>';
    if (_srcSink && S.sim && S.sim.running) {
      html += '<div style="margin-top:6px;padding:5px 8px;background:rgba(245,158,11,0.08);'
        + 'border-left:2px solid var(--orange);border-radius:3px;font-size:11px;'
        + 'color:var(--orange);line-height:1.4">'
        + '&#9888; Ak&#305;m kayna&#287;a geri d&ouml;n&uuml;yor (emme modu). '
        + '&#304;deal DC kayna&#287;&#305; i&ccedil;in anormal; ger&ccedil;ek pillerde &#351;arj olay&#305;.'
        + '</div>';
    }
  } else if (p.type === 'ground') {
    html += '<div class="insp-meas-grid">'
      + '<div class="insp-meas" id="im-v"><div class="im-label">V (Referans)</div><div class="im-val" style="color:var(--text-3)" id="imv-val">0.00 V</div></div>'
      + '<div class="insp-meas" id="im-i"><div class="im-label">I (Pin akımı)</div><div class="im-val" style="color:var(--blue)" id="imi-val">—</div></div>'
      + '<div class="insp-meas" id="im-p"><div class="im-label">P</div><div class="im-val" style="color:var(--text-4);font-size:10px" id="imp-val">— ideal iletken</div></div>'
      + '<div class="insp-meas" id="im-t"><div class="im-label">T°</div><div class="im-val" style="color:var(--text-4);font-size:10px" id="imt-val">— disipasyon yok</div></div>'
      + '</div>';
    html += '<div style="margin-top:8px;padding:6px 8px;background:rgba(0,224,158,0.05);'
      + 'border-left:2px solid #00e09e;border-radius:3px;font-size:11px;'
      + 'color:#8899aa;line-height:1.45">'
      + '<span style="color:#00e09e">&#8505; GND referans noktasıdır</span> — '
      + 'tüm gerilimler buna göre ölçülür (tanım gereği V = 0). İdeal iletken '
      + 'olduğu için üzerinde güç disipe olmaz ve ısınmaz; ancak pin\'den geçen '
      + 'akım (KCL) okunur.'
      + '</div>';
  } else {
    html += '<div class="insp-meas-grid">'
      + '<div class="insp-meas" id="im-v"><div class="im-label">V</div><div class="im-val" style="color:var(--accent)" id="imv-val">—</div></div>'
      + '<div class="insp-meas" id="im-i"><div class="im-label">I</div><div class="im-val" style="color:var(--blue)" id="imi-val">—</div></div>'
      + '<div class="insp-meas" id="im-p"><div class="im-label">P</div><div class="im-val" style="color:var(--orange)" id="imp-val">—</div></div>'
      + '<div class="insp-meas" id="im-t"><div class="im-label">T°</div><div class="im-val" style="color:var(--text-3)" id="imt-val">—</div></div>'
      + '</div>';
  }

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
    // Sprint 70c: ground cards are static by definition — only refresh
    // the pin-entering current; leave V, P and T as-rendered.
    if (pp.type === 'ground') {
      if (iEl) iEl.textContent = fmtVal(pp._i || 0, 'A');
      return;
    }
    // Sprint 70d: V/I sources display |I| next to a directional label
    // ("Çıkış" vs "Emme"). The label is driven by sign — re-render it
    // each tick so polarity reversals (e.g. during AC cycles) update
    // without reopening the Inspector.
    var _SRC_T = { vdc:1, vac:1, pulse:1, pwl:1, idc:1, iac:1, noise:1 };
    if (_SRC_T[pp.type]) {
      var _sI = pp._i || 0;
      var _sV = pp._v || 0;
      var _sSink = (_sV * _sI) < -1e-9;
      var _lblEl = document.querySelector('#im-i .im-label');
      if (_lblEl) _lblEl.innerHTML = _sSink ? 'I (Emme &#9888;)' : 'I (&#199;&#305;k&#305;&#351;)';
      if (iEl) {
        iEl.textContent = fmtVal(Math.abs(_sI), 'A');
        iEl.style.color = _sSink ? 'var(--orange)' : 'var(--blue)';
      }
      if (vEl) vEl.textContent = fmtVal(_sV, 'V');
      if (pEl) pEl.textContent = fmtVal(pp._p || 0, 'W');
      return;
    }
    // Sprint 72: generic AC detection. If the buffered samples cross
    // zero we report RMS on the corresponding card and append "RMS"
    // to the label (unless the label is a custom one from Sprint 70c
    // ground framing or Sprint 70d source direction — those branches
    // return early above this block, so we're safe).
    var vAC = isACSignal(pp._vHistory);
    var iAC = isACSignal(pp._iHistory);
    if (vEl) {
      var vVal = vAC ? getRMS(pp._vHistory) : (pp._v || 0);
      vEl.textContent = fmtVal(vVal, 'V') + (vAC ? ' RMS' : '');
    }
    var vLbl = document.querySelector('#im-v .im-label');
    if (vLbl && !vLbl.dataset.custom) vLbl.textContent = vAC ? 'V (RMS)' : 'V';
    if (iEl) {
      var iVal = iAC ? getRMS(pp._iHistory) : (pp._i || 0);
      iEl.textContent = fmtVal(iVal, 'A') + (iAC ? ' RMS' : '');
    }
    var iLbl = document.querySelector('#im-i .im-label');
    if (iLbl && !iLbl.dataset.custom) iLbl.textContent = iAC ? 'I (RMS)' : 'I';
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
