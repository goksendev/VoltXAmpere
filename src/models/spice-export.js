VXA.SpiceExport = (function() {
  function fmtSV(val) {
    if (val === 0) return '0';
    var a = Math.abs(val);
    if (a >= 1e6) return (val / 1e6) + 'MEG';
    if (a >= 1e3) return (val / 1e3) + 'K';
    if (a >= 1) return val.toString();
    if (a >= 1e-3) return (val * 1e3) + 'M';
    if (a >= 1e-6) return (val * 1e6) + 'U';
    if (a >= 1e-9) return (val * 1e9) + 'N';
    if (a >= 1e-12) return (val * 1e12) + 'P';
    return val.toExponential(3);
  }
  function generate() {
    buildCircuitFromCanvas();
    if (!SIM) return '* Empty circuit\n.end\n';
    var lines = ['* VoltXAmpere v8.0 — SPICE Netlist', '* Date: ' + new Date().toISOString().slice(0, 10), '*'];
    var usedModels = {};
    for (var i = 0; i < SIM.comps.length; i++) {
      var c = SIM.comps[i], p = c.part;
      if (!p) continue;
      var n1 = c.n1 || 0, n2 = c.n2 || 0, n3 = c.n3 || 0;
      if (c.type === 'R') lines.push('R' + p.name + ' ' + n1 + ' ' + n2 + ' ' + fmtSV(c.val));
      else if (c.type === 'C') lines.push('C' + p.name + ' ' + n1 + ' ' + n2 + ' ' + fmtSV(c.val));
      else if (c.type === 'L') lines.push('L' + p.name + ' ' + n1 + ' ' + n2 + ' ' + fmtSV(c.val));
      else if (c.type === 'V') {
        if (c.isAC) lines.push('V' + p.name + ' ' + n1 + ' ' + n2 + ' SIN(0 ' + c.val + ' ' + fmtSV(c.freq) + ')');
        else if (c.isPulse) lines.push('V' + p.name + ' ' + n1 + ' ' + n2 + ' PULSE(' + (c.v1 || 0) + ' ' + (c.v2 || 5) + ' 0 1N 1N ' + fmtSV(c.pw || 5e-4) + ' ' + fmtSV(c.per || 1e-3) + ')');
        else lines.push('V' + p.name + ' ' + n1 + ' ' + n2 + ' DC ' + c.val);
      }
      else if (c.type === 'I') lines.push('I' + p.name + ' ' + n1 + ' ' + n2 + ' ' + fmtSV(c.val));
      else if (c.type === 'D') { var mn = p.model || 'DMOD'; lines.push('D' + p.name + ' ' + n1 + ' ' + n2 + ' ' + mn); usedModels[mn] = p.type; }
      else if (c.type === 'BJT') { var mn = p.model || 'QMOD'; lines.push('Q' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + mn); usedModels[mn] = p.type; }
      else if (c.type === 'MOS') { var mn = p.model || 'MMOD'; lines.push('M' + p.name + ' ' + n2 + ' ' + n1 + ' ' + n3 + ' ' + n3 + ' ' + mn); usedModels[mn] = p.type; }
      else if (c.type === 'OA') lines.push('* OPAMP ' + p.name + ' ' + (c.nP || 0) + ' ' + (c.nN || 0) + ' ' + (c.nO || 0));
    }
    lines.push('*');
    // .model statements
    Object.keys(usedModels).forEach(function(mn) {
      var ptype = usedModels[mn];
      var model = VXA.Models.getModel(ptype, mn);
      if (!model || mn === 'Generic' || mn === 'DMOD' || mn === 'QMOD' || mn === 'MMOD') return;
      var skip = ['type', 'desc', 'color', 'Vf_typ', 'If_max', 'Vz', 'Zz', 'Iz', 'Pd', 'adjustable', 'Vout', 'Vdropout', 'Imax', 'Vref', 'Vout_min', 'Vout_max'];
      var params = [];
      for (var k in model) { if (skip.indexOf(k) === -1 && typeof model[k] === 'number') params.push(k + '=' + model[k]); }
      var st = model.type || (ptype === 'diode' || ptype === 'led' || ptype === 'schottky' ? 'D' : ptype === 'npn' ? 'NPN' : ptype === 'pnp' ? 'PNP' : ptype === 'nmos' ? 'NMOS' : 'PMOS');
      if (params.length) lines.push('.model ' + mn + ' ' + st + '(' + params.join(' ') + ')');
    });
    lines.push('*', '.tran 0.01M 10M', '.end');
    return lines.join('\n');
  }
  return { generate: generate, fmtSV: fmtSV };
})();