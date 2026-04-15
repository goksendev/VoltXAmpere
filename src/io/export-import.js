// ──────── EXPORT / IMPORT ────────
// Sprint 35: Export dropdown helpers
function toggleExportMenu(ev) {
  if (ev) ev.stopPropagation();
  var menu = document.getElementById('export-dropdown');
  if (!menu) return;
  var visible = menu.style.display === 'block';
  menu.style.display = visible ? 'none' : 'block';
  if (!visible) {
    setTimeout(function() {
      document.addEventListener('click', hideExportMenu, { once: true });
    }, 0);
  }
}
function hideExportMenu() {
  var menu = document.getElementById('export-dropdown');
  if (menu) menu.style.display = 'none';
}

function exportJSON() {
  const data = { version: 'VoltXAmpere-8.0', parts: S.parts, wires: S.wires, nextId: S.nextId, settings: { bgStyle: S.bgStyle, wireStyle: S.wireStyle, symbolStd: S.symbolStd } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voltxampere-circuit.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.parts && data.wires) {
          saveUndo();
          S.parts = data.parts; S.wires = data.wires;
          S.nextId = data.nextId || (Math.max(0, ...S.parts.map(p=>p.id)) + 1);
          S.sel = []; needsRender = true; updateInspector();
          // Fit view
          if (S.parts.length) {
            let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
            S.parts.forEach(p=>{mnx=Math.min(mnx,p.x-60);mny=Math.min(mny,p.y-60);mxx=Math.max(mxx,p.x+60);mxy=Math.max(mxy,p.y+60);});
            const cw=cvs.width/DPR,ch=cvs.height/DPR;
            S.view.zoom=Math.min(cw/(mxx-mnx),ch/(mxy-mny),S.view.maxZoom)*0.85;
            S.view.ox=cw/2-((mnx+mxx)/2)*S.view.zoom;
            S.view.oy=ch/2-((mny+mxy)/2)*S.view.zoom;
          }
        }
      } catch (err) { console.error('Import error:', err); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Sprint 35: Professional PNG export — white bg, 2x retina, title, footer
function exportPNG() {
  var bounds = (typeof getCircuitBounds === 'function') ? getCircuitBounds() : null;
  if (!bounds) {
    var trEmpty = (typeof currentLang !== 'undefined' && currentLang === 'tr');
    if (typeof showInfoCard === 'function') {
      showInfoCard(trEmpty?'Bo\u015f devre':'Empty circuit', trEmpty?'\u00d6nce devre kurun':'Build a circuit first', '');
    }
    return;
  }
  var scale = 2; // Retina
  var padding = 80;
  var titleH = 56;
  var footerH = 28;
  var logicalW = bounds.width + padding * 2;
  var logicalH = bounds.height + padding * 2 + titleH + footerH;
  var cw = logicalW * scale;
  var ch = logicalH * scale;
  var expCvs = document.createElement('canvas');
  expCvs.width = cw;
  expCvs.height = ch;
  var ctx = expCvs.getContext('2d');
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.scale(scale, scale);

  var tr = (typeof currentLang !== 'undefined' && currentLang === 'tr');
  var circuitName = S.currentPresetName || (tr ? '\u00d6zel Devre' : 'Custom Circuit');
  var date = new Date().toISOString().slice(0, 10);

  // Title
  ctx.fillStyle = '#222';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(circuitName, padding, 30);
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(S.parts.length + (tr?' bile\u015fen, ':' components, ') + S.wires.length + (tr?' kablo':' wires'), logicalW - padding, 26);
  // Title underline
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, titleH - 6);
  ctx.lineTo(logicalW - padding, titleH - 6);
  ctx.stroke();

  // Schematic area
  ctx.save();
  ctx.translate(padding - bounds.minX, padding + titleH - bounds.minY);

  // Light grid
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 0.5;
  for (var gx = Math.floor(bounds.minX/40)*40; gx <= bounds.maxX; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, bounds.minY); ctx.lineTo(gx, bounds.maxY); ctx.stroke();
  }
  for (var gy = Math.floor(bounds.minY/40)*40; gy <= bounds.maxY; gy += 40) {
    ctx.beginPath(); ctx.moveTo(bounds.minX, gy); ctx.lineTo(bounds.maxX, gy); ctx.stroke();
  }

  // Wires (dark on white)
  ctx.strokeStyle = '#2a3a4a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  S.wires.forEach(function(w) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  });
  // Junction dots
  var jct = {};
  S.wires.forEach(function(wr) {
    [wr.x1+','+wr.y1, wr.x2+','+wr.y2].forEach(function(k) { jct[k] = (jct[k]||0)+1; });
  });
  ctx.fillStyle = '#2a3a4a';
  for (var jk in jct) {
    if (jct[jk] >= 3) {
      var jp = jk.split(',');
      ctx.beginPath();
      ctx.arc(parseFloat(jp[0]), parseFloat(jp[1]), 3.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Components — use existing draw + dark labels
  S.parts.forEach(function(p) {
    var def = COMP[p.type];
    if (def && def.draw) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot * Math.PI / 2);
      try { def.draw(ctx, 1, p); } catch(e) {}
      ctx.restore();
    }
    // Value label below
    var valLbl = (typeof formatExportValue === 'function') ? formatExportValue(p.val, p.type) : String(p.val||'');
    if (valLbl) {
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(valLbl, p.x, p.y + 30);
    }
    // Name label above
    if (p.name) {
      ctx.fillStyle = '#333';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y - 26);
    }
  });
  ctx.restore();

  // Footer
  var fy = logicalH - footerH + 16;
  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('VoltXAmpere v8.0 \u2014 voltxampere.com', padding, fy);
  ctx.textAlign = 'right';
  ctx.fillText(date, logicalW - padding, fy);

  // Download
  var safeName = circuitName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  var link = document.createElement('a');
  link.download = 'voltxampere_' + safeName + '_' + date + '.png';
  link.href = expCvs.toDataURL('image/png');
  link.click();
}

function exportSPICE() {
  var net = '* VoltXAmpere v8.0 — SPICE Netlist\n* Date: ' + new Date().toISOString().slice(0, 10) + '\n*\n';
  var usedModels = {};
  S.parts.forEach(function(p) {
    var def = COMP[p.type]; if (!def) return;
    var n1 = 'n' + p.id + '_1', n2 = 'n' + p.id + '_2', n3 = 'n' + p.id + '_3';
    if (p.type === 'resistor') net += 'R_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + p.val + '\n';
    else if (p.type === 'capacitor') net += 'C_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + p.val + '\n';
    else if (p.type === 'inductor') net += 'L_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + p.val + '\n';
    else if (p.type === 'vdc') net += 'V_' + p.name + ' ' + n1 + ' ' + n2 + ' DC ' + p.val + '\n';
    else if (p.type === 'vac') net += 'V_' + p.name + ' ' + n1 + ' ' + n2 + ' AC ' + p.val + ' SIN(0 ' + p.val + ' ' + (p.freq || 50) + ')\n';
    else if (p.type === 'diode' || p.type === 'schottky') {
      var dm = p.model || 'Generic'; net += 'D_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + dm + '\n'; usedModels['D_' + dm] = { type: 'D', name: dm, cat: p.type };
    } else if (p.type === 'led') {
      var lm = p.model || 'RED_5MM'; net += 'D_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + lm + '\n'; usedModels['D_' + lm] = { type: 'D', name: lm, cat: 'led' };
    } else if (p.type === 'npn') {
      var bm = p.model || 'Generic'; net += 'Q_' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + bm + '\n'; usedModels['NPN_' + bm] = { type: 'NPN', name: bm, cat: 'npn' };
    } else if (p.type === 'pnp') {
      var bm = p.model || 'Generic'; net += 'Q_' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + bm + '\n'; usedModels['PNP_' + bm] = { type: 'PNP', name: bm, cat: 'pnp' };
    } else if (p.type === 'nmos') {
      var mm = p.model || 'Generic'; net += 'M_' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + n3 + ' ' + mm + '\n'; usedModels['NMOS_' + mm] = { type: 'NMOS', name: mm, cat: 'nmos' };
    } else if (p.type === 'pmos') {
      var mm = p.model || 'Generic'; net += 'M_' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + n3 + ' ' + mm + '\n'; usedModels['PMOS_' + mm] = { type: 'PMOS', name: mm, cat: 'pmos' };
    } else if (p.type === 'opamp') {
      var om = p.model || 'Ideal'; net += 'X_' + p.name + ' ' + n1 + ' ' + n2 + ' ' + n3 + ' ' + om + '\n';
    }
  });
  // .model statements for used models
  net += '*\n';
  Object.keys(usedModels).forEach(function(key) {
    var um = usedModels[key], model = VXA.Models.getModel(um.cat, um.name);
    if (!model || um.name === 'Generic') return;
    var params = [];
    var skip = ['type', 'desc', 'color', 'Vf_typ', 'If_max', 'Vz', 'Zz', 'Iz', 'Pd'];
    for (var pk in model) { if (skip.indexOf(pk) === -1 && typeof model[pk] === 'number') params.push(pk + '=' + model[pk]); }
    if (params.length > 0) net += '.model ' + um.name + ' ' + um.type + '(' + params.join(' ') + ')\n';
  });
  net += '*\n.tran 1u 10m\n.end\n';
  var blob = new Blob([net], { type: 'text/plain' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'voltxampere.cir'; a.click(); URL.revokeObjectURL(a.href);
}
