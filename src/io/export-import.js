// ──────── EXPORT / IMPORT ────────
function exportJSON() {
  const data = { version: 'VoltXAmpere-6.0', parts: S.parts, wires: S.wires, nextId: S.nextId, settings: { bgStyle: S.bgStyle, wireStyle: S.wireStyle, symbolStd: S.symbolStd } };
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

function exportPNG() {
  const link = document.createElement('a');
  link.download = 'voltxampere-circuit.png';
  link.href = cvs.toDataURL('image/png');
  link.click();
}

function exportSPICE() {
  var net = '* VoltXAmpere v7.1 — SPICE Netlist\n* Date: ' + new Date().toISOString().slice(0, 10) + '\n*\n';
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
