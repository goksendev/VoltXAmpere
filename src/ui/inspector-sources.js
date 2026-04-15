// ──────── SPRINT 40: Inspector Source/IC Add-ons ────────
// Post-processes the inspector DOM after updateInspector() to add:
//   - Source type dropdown (DC/SIN/PULSE/PWL/EXP/SFFM) for V/I sources
//   - Capacitor IC (initial voltage) field
//   - Minimal PWL point editor (textarea)

(function() {
  if (typeof updateInspector !== 'function') return;
  var _orig = updateInspector;

  window.updateInspector = function() {
    _orig.apply(this, arguments);
    try { injectSourceControls(); } catch (e) { /* non-fatal */ }
  };

  function injectSourceControls() {
    var el = document.getElementById('inspector');
    if (!el || !S || !S.sel || !S.sel.length) return;
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; });
    if (!p) return;

    var isSource = (p.type === 'vdc' || p.type === 'vac' || p.type === 'pulse' || p.type === 'pwl' ||
                    p.type === 'idc' || p.type === 'iac');
    var isCap = (p.type === 'capacitor' || p.type === 'cap');
    var isMOS = (p.type === 'nmos' || p.type === 'pmos');
    if (!isSource && !isCap && !isMOS) return;

    var container = document.createElement('div');
    container.style.borderTop = '1px solid var(--border)';
    container.style.marginTop = '6px';
    container.style.paddingTop = '6px';

    if (isSource) {
      var types = ['DC', 'SIN', 'PULSE', 'PWL', 'EXP', 'SFFM'];
      var current = deriveSrcType(p);
      var sel = '<select id="srcTypeSel" onchange="setSrcType(this.value)" ' +
                'style="flex:1;background:var(--surface-3);border:1px solid var(--border);' +
                'color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)">' +
        types.map(function(tp) {
          return '<option value="' + tp + '"' + (tp === current ? ' selected' : '') + '>' + tp + '</option>';
        }).join('') + '</select>';
      container.innerHTML = '<div class="insp-param"><label>Kaynak Tipi</label>' + sel + '</div>';

      if (current === 'PWL') {
        var pts = p.pwlPoints || [[0, 0], [1e-3, 5]];
        var ptsText = pts.map(function(pt) { return pt[0] + ' ' + pt[1]; }).join('\n');
        container.innerHTML +=
          '<div class="insp-param" style="flex-direction:column;align-items:stretch">' +
          '<label style="margin-bottom:3px">PWL noktaları (t v)</label>' +
          '<textarea id="pwlEditor" rows="4" ' +
          'onchange="setPwlPoints(this.value)" ' +
          'style="width:100%;background:var(--surface-3);border:1px solid var(--border);' +
          'color:var(--text);border-radius:4px;padding:4px;font:11px var(--font-mono);resize:vertical">' +
          escHtml(ptsText) + '</textarea></div>';
      } else if (current === 'EXP') {
        var ep = p.expParams || { v1:0, v2:5, td1:0, tau1:1e-3, td2:3e-3, tau2:1e-3 };
        container.innerHTML +=
          '<div class="insp-param" style="flex-direction:column;align-items:stretch">' +
          '<label style="margin-bottom:3px">EXP (V1 V2 Td1 τ1 Td2 τ2)</label>' +
          '<input id="expEditor" value="' + [ep.v1, ep.v2, ep.td1, ep.tau1, ep.td2, ep.tau2].join(' ') +
          '" onchange="setExpParams(this.value)" ' +
          'style="width:100%;background:var(--surface-3);border:1px solid var(--border);' +
          'color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)"></div>';
      } else if (current === 'SFFM') {
        var sp = p.sffmParams || { voff:0, vamp:1, fcar:1000, mdi:5, fsig:100 };
        container.innerHTML +=
          '<div class="insp-param" style="flex-direction:column;align-items:stretch">' +
          '<label style="margin-bottom:3px">SFFM (Voff Vamp Fcar MDI Fsig)</label>' +
          '<input id="sffmEditor" value="' + [sp.voff, sp.vamp, sp.fcar, sp.mdi, sp.fsig].join(' ') +
          '" onchange="setSffmParams(this.value)" ' +
          'style="width:100%;background:var(--surface-3);border:1px solid var(--border);' +
          'color:var(--text);border-radius:4px;padding:3px 6px;font:11px var(--font-mono)"></div>';
      }
    } else if (isCap) {
      container.innerHTML =
        '<div class="insp-param"><label>IC (V<sub>0</sub>)</label>' +
        '<input id="cap-ic" value="' + (p.icVoltage != null ? p.icVoltage : 0) + '" ' +
        'onchange="setCapIC(this.value)" style="flex:1"> ' +
        '<span class="ip-unit">V</span></div>';
    }

    // Sprint 41: BSIM3 MOSFET readout
    if (p.type === 'nmos' || p.type === 'pmos') {
      var mm = (typeof VXA !== 'undefined' && VXA.Models && p.model) ? VXA.Models.getModel(p.type, p.model) : null;
      if (mm && VXA.BSIM3 && VXA.BSIM3.isBSIM3Model(mm)) {
        var params = VXA.BSIM3.parseModelParams(Object.assign({}, mm, { TYPE: p.type === 'nmos' ? 1 : -1 }));
        // Evaluate at a representative bias point (Vgs=Vdd/2, Vds=Vdd/2, Vbs=0) to show region.
        var vgs = 1.0, vds = 1.0;
        var r;
        try { r = VXA.BSIM3.evaluate(params, vgs, vds, 0); } catch (e) { r = null; }
        if (r) {
          var readoutHtml =
            '<div id="bsim3-readout" style="font:11px var(--font-mono);padding:6px;background:var(--surface-2);border-radius:4px;margin-top:4px">' +
            '<div style="color:var(--accent);font-weight:600;margin-bottom:2px">BSIM3 ' +
            (p.type === 'nmos' ? 'NMOS' : 'PMOS') + ' — ' + (mm.L ? ((mm.L * 1e9).toFixed(0) + 'nm') : '—') + '</div>' +
            '<div>Vth: ' + r.Vth.toFixed(3) + ' V</div>' +
            '<div>Ids (Vgs=1, Vds=1): ' + (r.Ids * 1e6).toPrecision(3) + ' μA</div>' +
            '<div>region: <span data-region>' + r.region + '</span></div>' +
            '<div>gm: ' + (r.gm * 1e6).toPrecision(3) + ' μS</div>' +
            '</div>';
          container.innerHTML += readoutHtml;
        }
      }
    }

    el.appendChild(container);
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function deriveSrcType(p) {
    if (p.srcType) return p.srcType;
    if (p.type === 'pwl') return 'PWL';
    if (p.type === 'pulse') return 'PULSE';
    if (p.type === 'vac' || p.type === 'iac') return 'SIN';
    return 'DC';
  }

  window.setSrcType = function(v) {
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
    p.srcType = v;
    // Switch concrete type where needed so the rest of the engine picks it up
    if (v === 'PWL' && p.type !== 'pwl') p.type = 'pwl';
    else if (v === 'PULSE' && p.type !== 'pulse') p.type = 'pulse';
    else if (v === 'SIN' && p.type !== 'vac') p.type = 'vac';
    else if (v === 'DC' && p.type !== 'vdc') p.type = 'vdc';
    // EXP/SFFM live on vdc/vac with srcType flag (sim-legacy.js reads p.srcType)
    if (v === 'EXP' || v === 'SFFM') { if (p.type === 'pulse' || p.type === 'pwl') p.type = 'vdc'; }
    if (typeof needsRender !== 'undefined') needsRender = true;
    updateInspector();
  };

  window.setPwlPoints = function(text) {
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
    var lines = String(text).split(/\n+/);
    var pts = [];
    lines.forEach(function(ln) {
      var tk = ln.trim().split(/[\s,]+/).filter(Boolean);
      if (tk.length >= 2) {
        var t = (VXA.SpiceParser ? VXA.SpiceParser.parseSpiceNumber(tk[0]) : parseFloat(tk[0]));
        var v = (VXA.SpiceParser ? VXA.SpiceParser.parseSpiceNumber(tk[1]) : parseFloat(tk[1]));
        if (isFinite(t) && isFinite(v)) pts.push([t, v]);
      }
    });
    if (pts.length > 0) p.pwlPoints = pts;
    if (typeof needsRender !== 'undefined') needsRender = true;
  };

  window.setExpParams = function(text) {
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
    var tk = String(text).trim().split(/[\s,]+/).filter(Boolean);
    var pv = function(s) { return (VXA.SpiceParser ? VXA.SpiceParser.parseSpiceNumber(s) : parseFloat(s)); };
    p.expParams = {
      v1: pv(tk[0] || '0'), v2: pv(tk[1] || '5'),
      td1: pv(tk[2] || '0'), tau1: pv(tk[3] || '1m'),
      td2: pv(tk[4] || '3m'), tau2: pv(tk[5] || '1m')
    };
    if (typeof needsRender !== 'undefined') needsRender = true;
  };

  window.setSffmParams = function(text) {
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
    var tk = String(text).trim().split(/[\s,]+/).filter(Boolean);
    var pv = function(s) { return (VXA.SpiceParser ? VXA.SpiceParser.parseSpiceNumber(s) : parseFloat(s)); };
    p.sffmParams = {
      voff: pv(tk[0] || '0'), vamp: pv(tk[1] || '1'),
      fcar: pv(tk[2] || '1k'), mdi: pv(tk[3] || '5'), fsig: pv(tk[4] || '100')
    };
    if (typeof needsRender !== 'undefined') needsRender = true;
  };

  window.setCapIC = function(v) {
    var p = S.parts.find(function(pp) { return pp.id === S.sel[0]; }); if (!p) return;
    var n = parseFloat(v);
    p.icVoltage = isFinite(n) ? n : 0;
    if (typeof needsRender !== 'undefined') needsRender = true;
  };
})();
