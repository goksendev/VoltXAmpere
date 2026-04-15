VXA.SpiceParser = (function() {
  function parseSpiceNumber(str) {
    str = str.trim().toUpperCase();
    if (/E[+\-]?\d/.test(str)) return parseFloat(str);
    var suffixes = [['MEG',1e6],['T',1e12],['G',1e9],['K',1e3],['M',1e-3],['U',1e-6],['N',1e-9],['P',1e-12],['F',1e-15]];
    for (var i = 0; i < suffixes.length; i++) {
      if (str.endsWith(suffixes[i][0])) return parseFloat(str.slice(0, -suffixes[i][0].length)) * suffixes[i][1];
    }
    return parseFloat(str);
  }
  function parseModelLine(line) {
    // Sprint 41: accept multi-token BSIM3 cards (80+ params inside parens).
    var m = line.match(/\.model\s+(\S+)\s+(NPN|PNP|D|NMOS|PMOS|NFET|PFET|NJF|PJF)\s*\(([\s\S]+?)\)\s*$/i);
    if (!m) {
      // Fallback: parens may be unclosed on single-line cards — grab rest of line
      m = line.match(/\.model\s+(\S+)\s+(NPN|PNP|D|NMOS|PMOS|NFET|PFET|NJF|PJF)\s*\(?([\s\S]+?)\)?$/i);
      if (!m) return null;
    }
    var name = m[1], type = m[2].toUpperCase(), params = {};
    m[3].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).forEach(function(p) {
      var kv = p.split('=');
      if (kv.length === 2) {
        var key = kv[0].toUpperCase();
        var valStr = kv[1];
        // Preserve non-numeric values (e.g. VERSION=3.3 stays numeric; LEVEL=49 numeric)
        var n = parseSpiceNumber(valStr);
        params[key] = isNaN(n) ? valStr : n;
      }
    });
    var category;
    if (type === 'NPN' || type === 'PNP') category = 'npn';
    else if (type === 'D') category = 'diode';
    else if (type === 'NMOS' || type === 'PMOS' || type === 'NFET' || type === 'PFET') category = 'nmos';
    else if (type === 'NJF' || type === 'PJF') category = 'jfet';
    else return null;
    // Sprint 41: mark BSIM3-class MOSFET cards so engine can dispatch properly
    if (category === 'nmos' && typeof VXA !== 'undefined' && VXA.BSIM3 && VXA.BSIM3.isBSIM3Model(params)) {
      params.BSIM3 = true;
      if (type === 'PMOS' || type === 'PFET') params.TYPE = -1;
      else params.TYPE = 1;
    }
    return { name: name, type: type, category: category, params: params };
  }
  function parseMultiple(text) {
    var models = [], lines = text.split('\n'), current = '';
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (t.charAt(0) === '*' || t === '') continue;
      if (t.charAt(0) === '+') { current += ' ' + t.slice(1); }
      else { if (current) { var m = parseModelLine(current); if (m) models.push(m); } current = t; }
    }
    if (current) { var m = parseModelLine(current); if (m) models.push(m); }
    return models;
  }
  return { parseModelLine: parseModelLine, parseMultiple: parseMultiple, parseSpiceNumber: parseSpiceNumber };
})();
// 7.8: MODEL → PART PROPS INTEGRATION
function applyModel(part, modelName) {
  var model = VXA.Models.getModel(part.type, modelName);
  if (!model) return;
  part.model = modelName;
  if (part.type === 'npn' || part.type === 'pnp') { part.beta = model.BF || 100; }
  else if (part.type === 'led') { if (model.color) part.ledColor = model.color; }
  else if (part.type === 'nmos' || part.type === 'pmos') { part.val = model.VTO || 2; }
  else if (part.type === 'opamp') { /* model params used directly in sim */ }
  else if (part.type === 'zener') { part.val = model.Vz || 5.1; }
  else if (part.type === 'vreg') { part.val = model.Vout || 5; }
}
