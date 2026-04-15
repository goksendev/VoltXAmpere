
// 9.5: AUTO WIRE ROUTING (L-shaped)
function autoRoute(pin1, pin2) {
  var x1 = snap(pin1.x), y1 = snap(pin1.y), x2 = snap(pin2.x), y2 = snap(pin2.y);
  if (x1 === x2 || y1 === y2) return [{ x1: x1, y1: y1, x2: x2, y2: y2 }];
  // L-route: prefer horizontal first
  return [{ x1: x1, y1: y1, x2: x2, y2: y1 }, { x1: x2, y1: y1, x2: x2, y2: y2 }];
}

// 9.6: MULTI-SELECTION ENHANCEMENTS
function selectAll() { S.sel = S.parts.map(function(p) { return p.id; }); needsRender = true; updateInspector(); }
function alignSelected(dir) {
  var selParts = S.parts.filter(function(p) { return S.sel.includes(p.id); });
  if (selParts.length < 2) return;
  saveUndo();
  if (dir === 'left') { var m = Math.min.apply(null, selParts.map(function(p) { return p.x; })); selParts.forEach(function(p) { p.x = m; }); }
  else if (dir === 'right') { var m = Math.max.apply(null, selParts.map(function(p) { return p.x; })); selParts.forEach(function(p) { p.x = m; }); }
  else if (dir === 'top') { var m = Math.min.apply(null, selParts.map(function(p) { return p.y; })); selParts.forEach(function(p) { p.y = m; }); }
  else if (dir === 'bottom') { var m = Math.max.apply(null, selParts.map(function(p) { return p.y; })); selParts.forEach(function(p) { p.y = m; }); }
  needsRender = true;
}
function distributeSelected(axis) {
  var selParts = S.parts.filter(function(p) { return S.sel.includes(p.id); });
  if (selParts.length < 3) return;
  saveUndo();
  var sorted = selParts.slice().sort(function(a, b) { return axis === 'h' ? a.x - b.x : a.y - b.y; });
  var first = axis === 'h' ? sorted[0].x : sorted[0].y;
  var last = axis === 'h' ? sorted[sorted.length - 1].x : sorted[sorted.length - 1].y;
  var step = (last - first) / (sorted.length - 1);
  sorted.forEach(function(p, i) { if (axis === 'h') p.x = snap(first + step * i); else p.y = snap(first + step * i); });
  needsRender = true;
}

// 9.8: CIRCUIT REPORT GENERATOR
function generateCircuitReport() {
  var r = ['VoltXAmpere v9.0 — Circuit Report', '='.repeat(40), 'Date: ' + new Date().toLocaleString(), ''];
  r.push('COMPONENTS (' + S.parts.filter(function(p) { return p.type !== 'ground' && p.type !== 'netLabel' && p.type !== 'vccLabel' && p.type !== 'gndLabel'; }).length + ')');
  r.push('-'.repeat(40));
  S.parts.forEach(function(p) {
    if (p.type === 'ground' || p.type === 'netLabel' || p.type === 'vccLabel' || p.type === 'gndLabel') return;
    var val = p.val ? fmtVal(p.val, COMP[p.type] ? COMP[p.type].unit : '') : '';
    var model = p.model ? ' (' + p.model + ')' : '';
    r.push('  ' + p.name + ': ' + (COMP[p.type] ? COMP[p.type].name : p.type) + model + ' = ' + val);
  });
  r.push('  Wires: ' + S.wires.length);
  r.push('');
  if (S.sim.running || S.sim.t > 0) {
    r.push('DC OPERATING POINT'); r.push('-'.repeat(40));
    S.parts.forEach(function(p) {
      if (['ground', 'probe', 'netLabel', 'vccLabel', 'gndLabel'].indexOf(p.type) >= 0) return;
      r.push('  ' + p.name + ': V=' + fmtVal(p._v || 0, 'V') + ', I=' + fmtVal(p._i || 0, 'A') + ', P=' + fmtVal(Math.abs((p._v || 0) * (p._i || 0)), 'W'));
    });
    r.push('');
  }
  r.push('BOM (Bill of Materials)'); r.push('-'.repeat(40));
  var bom = {};
  S.parts.forEach(function(p) {
    if (['ground', 'probe', 'netLabel', 'vccLabel', 'gndLabel'].indexOf(p.type) >= 0) return;
    var k = p.type + '_' + (p.val || '') + '_' + (p.model || '');
    if (!bom[k]) bom[k] = { type: p.type, val: p.val, model: p.model, count: 0, ids: [] };
    bom[k].count++; bom[k].ids.push(p.name);
  });
  Object.values(bom).forEach(function(b) {
    r.push('  ' + b.count + 'x ' + (COMP[b.type] ? COMP[b.type].name : b.type) + ' ' + (b.val ? fmtVal(b.val, COMP[b.type] ? COMP[b.type].unit : '') : '') + (b.model ? ' (' + b.model + ')' : '') + '  [' + b.ids.join(', ') + ']');
  });
  return r.join('\n');
}
