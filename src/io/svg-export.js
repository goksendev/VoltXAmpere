// ──────── SVG EXPORT (Sprint 35: Real schematic symbols, vector quality) ────────

function escapeXml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getCircuitBounds() {
  if (!S.parts || S.parts.length === 0) return null;
  var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  S.parts.forEach(function(p) {
    mnx = Math.min(mnx, p.x - 60);
    mny = Math.min(mny, p.y - 60);
    mxx = Math.max(mxx, p.x + 60);
    mxy = Math.max(mxy, p.y + 60);
  });
  // Wires too
  if (S.wires) S.wires.forEach(function(w) {
    mnx = Math.min(mnx, w.x1, w.x2);
    mny = Math.min(mny, w.y1, w.y2);
    mxx = Math.max(mxx, w.x1, w.x2);
    mxy = Math.max(mxy, w.y1, w.y2);
  });
  return { minX: mnx, minY: mny, maxX: mxx, maxY: mxy, width: mxx - mnx, height: mxy - mny };
}

// Engineering value formatter (220Ω, 100nF, 1kΩ, etc.)
function formatExportValue(val, type) {
  if (val == null) return '';
  if (type === 'resistor') {
    if (val >= 1e6) return (val/1e6).toFixed(val>=10e6?0:2).replace(/\.?0+$/,'') + 'M\u03A9';
    if (val >= 1e3) return (val/1e3).toFixed(val>=10e3?0:2).replace(/\.?0+$/,'') + 'k\u03A9';
    return val + '\u03A9';
  }
  if (type === 'capacitor') {
    if (val >= 1e-3) return (val*1e3).toFixed(2).replace(/\.?0+$/,'') + 'mF';
    if (val >= 1e-6) return (val*1e6).toFixed(2).replace(/\.?0+$/,'') + '\u00B5F';
    if (val >= 1e-9) return (val*1e9).toFixed(2).replace(/\.?0+$/,'') + 'nF';
    return (val*1e12).toFixed(2).replace(/\.?0+$/,'') + 'pF';
  }
  if (type === 'inductor') {
    if (val >= 1) return val.toFixed(2).replace(/\.?0+$/,'') + 'H';
    if (val >= 1e-3) return (val*1e3).toFixed(2).replace(/\.?0+$/,'') + 'mH';
    return (val*1e6).toFixed(2).replace(/\.?0+$/,'') + '\u00B5H';
  }
  if (type === 'vdc' || type === 'vac') return val + 'V';
  return String(val);
}

function getSVGSymbol(type, val, part) {
  switch(type) {
    case 'resistor':
      return '<path class="comp" d="M-40,0 L-25,0 L-20,-8 L-10,8 L0,-8 L10,8 L20,-8 L25,0 L40,0" fill="none"/>';
    case 'capacitor':
      return '<line class="comp" x1="-40" y1="0" x2="-5" y2="0"/>'
        + '<line class="comp" x1="-5" y1="-12" x2="-5" y2="12"/>'
        + '<line class="comp" x1="5" y1="-12" x2="5" y2="12"/>'
        + '<line class="comp" x1="5" y1="0" x2="40" y2="0"/>';
    case 'inductor':
      return '<path class="comp" d="M-40,0 L-25,0 A6,6 0 0 1 -13,0 A6,6 0 0 1 -1,0 A6,6 0 0 1 11,0 A6,6 0 0 1 23,0 L40,0" fill="none"/>';
    case 'vdc':
      return '<circle class="comp" cx="0" cy="0" r="20" fill="white"/>'
        + '<line class="comp" x1="0" y1="-40" x2="0" y2="-20"/>'
        + '<line class="comp" x1="0" y1="20" x2="0" y2="40"/>'
        + '<text fill="currentColor" font-size="12" text-anchor="middle" x="0" y="-4">+</text>'
        + '<text fill="currentColor" font-size="12" text-anchor="middle" x="0" y="14">\u2212</text>';
    case 'vac':
      return '<circle class="comp" cx="0" cy="0" r="20" fill="white"/>'
        + '<line class="comp" x1="0" y1="-40" x2="0" y2="-20"/>'
        + '<line class="comp" x1="0" y1="20" x2="0" y2="40"/>'
        + '<path class="comp" d="M-10,0 Q-5,-8 0,0 T10,0" fill="none"/>';
    case 'ground':
      return '<line class="comp" x1="0" y1="-20" x2="0" y2="0"/>'
        + '<line class="comp" x1="-12" y1="0" x2="12" y2="0"/>'
        + '<line class="comp" x1="-8" y1="5" x2="8" y2="5"/>'
        + '<line class="comp" x1="-4" y1="10" x2="4" y2="10"/>';
    case 'diode':
      return '<polygon class="comp" points="-8,-10 -8,10 8,0" fill="currentColor"/>'
        + '<line class="comp" x1="8" y1="-10" x2="8" y2="10"/>'
        + '<line class="comp" x1="-30" y1="0" x2="-8" y2="0"/>'
        + '<line class="comp" x1="8" y1="0" x2="30" y2="0"/>';
    case 'led':
      return '<polygon class="comp" points="-8,-10 -8,10 8,0" fill="currentColor"/>'
        + '<line class="comp" x1="8" y1="-10" x2="8" y2="10"/>'
        + '<line class="comp" x1="-30" y1="0" x2="-8" y2="0"/>'
        + '<line class="comp" x1="8" y1="0" x2="30" y2="0"/>'
        + '<line class="comp" x1="2" y1="-12" x2="10" y2="-20"/>'
        + '<line class="comp" x1="6" y1="-20" x2="10" y2="-20"/>'
        + '<line class="comp" x1="10" y1="-20" x2="10" y2="-16"/>'
        + '<line class="comp" x1="-3" y1="-12" x2="5" y2="-20"/>'
        + '<line class="comp" x1="1" y1="-20" x2="5" y2="-20"/>'
        + '<line class="comp" x1="5" y1="-20" x2="5" y2="-16"/>';
    case 'zener':
      return '<polygon class="comp" points="-8,-10 -8,10 8,0" fill="currentColor"/>'
        + '<path class="comp" d="M5,-13 L8,-10 L8,10 L11,13" fill="none"/>'
        + '<line class="comp" x1="-30" y1="0" x2="-8" y2="0"/>'
        + '<line class="comp" x1="8" y1="0" x2="30" y2="0"/>';
    case 'schottky':
      return '<polygon class="comp" points="-8,-10 -8,10 8,0" fill="currentColor"/>'
        + '<path class="comp" d="M5,-13 L8,-10 L8,10 L11,13 M5,-13 L8,-13 M11,13 L8,13" fill="none"/>'
        + '<line class="comp" x1="-30" y1="0" x2="-8" y2="0"/>'
        + '<line class="comp" x1="8" y1="0" x2="30" y2="0"/>';
    case 'npn':
      return '<circle class="comp" cx="5" cy="0" r="20" fill="white"/>'
        + '<line class="comp" x1="-40" y1="0" x2="-5" y2="0"/>'
        + '<line class="comp" x1="-5" y1="-15" x2="-5" y2="15"/>'
        + '<line class="comp" x1="-5" y1="-8" x2="20" y2="-25"/>'
        + '<line class="comp" x1="-5" y1="8" x2="20" y2="25"/>'
        + '<line class="comp" x1="20" y1="-25" x2="20" y2="-40"/>'
        + '<line class="comp" x1="20" y1="25" x2="20" y2="40"/>'
        + '<polygon points="14,18 20,25 12,24" fill="currentColor" stroke="none"/>';
    case 'pnp':
      return '<circle class="comp" cx="5" cy="0" r="20" fill="white"/>'
        + '<line class="comp" x1="-40" y1="0" x2="-5" y2="0"/>'
        + '<line class="comp" x1="-5" y1="-15" x2="-5" y2="15"/>'
        + '<line class="comp" x1="-5" y1="-8" x2="20" y2="-25"/>'
        + '<line class="comp" x1="-5" y1="8" x2="20" y2="25"/>'
        + '<line class="comp" x1="20" y1="-25" x2="20" y2="-40"/>'
        + '<line class="comp" x1="20" y1="25" x2="20" y2="40"/>'
        + '<polygon points="-3,2 -1,12 5,8" fill="currentColor" stroke="none"/>';
    case 'nmos':
      return '<line class="comp" x1="-40" y1="0" x2="-5" y2="0"/>'
        + '<line class="comp" x1="-5" y1="-15" x2="-5" y2="15"/>'
        + '<line class="comp" x1="0" y1="-15" x2="0" y2="-8"/>'
        + '<line class="comp" x1="0" y1="-2" x2="0" y2="2"/>'
        + '<line class="comp" x1="0" y1="8" x2="0" y2="15"/>'
        + '<line class="comp" x1="0" y1="-12" x2="20" y2="-25"/>'
        + '<line class="comp" x1="0" y1="12" x2="20" y2="25"/>'
        + '<line class="comp" x1="20" y1="-25" x2="20" y2="-40"/>'
        + '<line class="comp" x1="20" y1="25" x2="20" y2="40"/>';
    case 'pmos':
      return '<line class="comp" x1="-40" y1="0" x2="-9" y2="0"/>'
        + '<circle class="comp" cx="-7" cy="0" r="3" fill="white"/>'
        + '<line class="comp" x1="0" y1="-15" x2="0" y2="15"/>'
        + '<line class="comp" x1="0" y1="-12" x2="20" y2="-25"/>'
        + '<line class="comp" x1="0" y1="12" x2="20" y2="25"/>'
        + '<line class="comp" x1="20" y1="-25" x2="20" y2="-40"/>'
        + '<line class="comp" x1="20" y1="25" x2="20" y2="40"/>';
    case 'opamp':
      return '<polygon class="comp" points="-20,-25 -20,25 25,0" fill="white"/>'
        + '<line class="comp" x1="-40" y1="-15" x2="-20" y2="-15"/>'
        + '<line class="comp" x1="-40" y1="15" x2="-20" y2="15"/>'
        + '<line class="comp" x1="25" y1="0" x2="40" y2="0"/>'
        + '<text fill="currentColor" font-size="10" x="-16" y="-11">+</text>'
        + '<text fill="currentColor" font-size="10" x="-16" y="19">\u2212</text>';
    case 'switch':
      return '<line class="comp" x1="-30" y1="0" x2="-5" y2="0"/>'
        + '<line class="comp" x1="5" y1="0" x2="30" y2="0"/>'
        + '<circle cx="-5" cy="0" r="3" fill="currentColor"/>'
        + '<circle cx="5" cy="0" r="3" fill="white" class="comp"/>'
        + '<line class="comp" x1="-5" y1="0" x2="10" y2="-12"/>';
    case 'fuse':
      return '<rect class="comp" x="-15" y="-6" width="30" height="12" rx="2" fill="white"/>'
        + '<line class="comp" x1="-30" y1="0" x2="-15" y2="0"/>'
        + '<line class="comp" x1="15" y1="0" x2="30" y2="0"/>';
    default:
      var c = (typeof COMP !== 'undefined' && COMP[type]) ? COMP[type].color : '#888';
      var lbl = (type || 'X').substring(0,6);
      return '<rect class="comp" x="-20" y="-15" width="40" height="30" rx="3" fill="white" stroke="' + c + '"/>'
        + '<text fill="' + c + '" font-size="8" text-anchor="middle" y="4">' + escapeXml(lbl) + '</text>';
  }
}

function exportSVG() {
  var bounds = getCircuitBounds();
  if (!bounds) {
    if (typeof showInfoCard === 'function') {
      var tr = (typeof currentLang !== 'undefined' && currentLang === 'tr');
      showInfoCard(tr?'Bo\u015f devre':'Empty circuit', tr?'\u00d6nce devre kurun':'Build a circuit first', '');
    }
    return;
  }
  var padding = 60;
  var titleH = 50;
  var footerH = 24;
  var w = bounds.width + padding * 2;
  var h = bounds.height + padding * 2 + titleH + footerH;
  var ox = padding - bounds.minX;
  var oy = padding + titleH - bounds.minY;
  var tr = (typeof currentLang !== 'undefined' && currentLang === 'tr');
  var circuitName = (S.currentPresetName) || (tr ? '\u00d6zel Devre' : 'Custom Circuit');
  var date = new Date().toISOString().slice(0, 10);

  var svg = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" '
    + 'viewBox="0 0 ' + w + ' ' + h + '" '
    + 'style="background:white;font-family:\'JetBrains Mono\',monospace">\n';
  svg += '<style>\n'
    + '  .wire { stroke: #2a3a4a; stroke-width: 2; fill: none; stroke-linecap: round; }\n'
    + '  .comp { stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }\n'
    + '  .label { fill: #555; font-size: 10px; text-anchor: middle; font-family: monospace; }\n'
    + '  .name { fill: #333; font-size: 9px; font-weight: 600; text-anchor: middle; font-family: monospace; }\n'
    + '  .title { fill: #222; font-size: 16px; font-weight: 600; }\n'
    + '  .info { fill: #888; font-size: 11px; }\n'
    + '  .footer { fill: #aaa; font-size: 9px; }\n'
    + '</style>\n';

  // Title
  svg += '<text class="title" x="' + padding + '" y="28">' + escapeXml(circuitName) + '</text>\n';
  svg += '<text class="info" x="' + (w - padding) + '" y="24" text-anchor="end">'
    + S.parts.length + (tr?' bile\u015fen, ':' components, ') + S.wires.length + (tr?' kablo':' wires') + '</text>\n';
  svg += '<line x1="' + padding + '" y1="' + (titleH - 6) + '" x2="' + (w - padding) + '" y2="' + (titleH - 6) + '" stroke="#ddd" stroke-width="1"/>\n';

  // Wires
  S.wires.forEach(function(wr) {
    svg += '<line class="wire" '
      + 'x1="' + (wr.x1 + ox) + '" y1="' + (wr.y1 + oy) + '" '
      + 'x2="' + (wr.x2 + ox) + '" y2="' + (wr.y2 + oy) + '"/>\n';
  });
  // Junction dots
  var jct = {};
  S.wires.forEach(function(wr) {
    [wr.x1+','+wr.y1, wr.x2+','+wr.y2].forEach(function(k) { jct[k] = (jct[k]||0)+1; });
  });
  for (var k in jct) {
    if (jct[k] >= 3) {
      var p = k.split(',');
      svg += '<circle cx="' + (parseFloat(p[0])+ox) + '" cy="' + (parseFloat(p[1])+oy) + '" r="3.5" fill="#2a3a4a"/>\n';
    }
  }

  // Components
  S.parts.forEach(function(p) {
    var px = p.x + ox, py = p.y + oy;
    var rot = (p.rot || 0) * 90;
    var def = (typeof COMP !== 'undefined') ? COMP[p.type] : null;
    var color = def ? def.color : '#333';
    svg += '<g transform="translate(' + px + ',' + py + ') rotate(' + rot + ')" stroke="' + color + '">\n';
    svg += getSVGSymbol(p.type, p.val, p);
    svg += '</g>\n';
    var label = formatExportValue(p.val, p.type);
    if (label) svg += '<text class="label" x="' + px + '" y="' + (py + 30) + '">' + escapeXml(label) + '</text>\n';
    if (p.name) svg += '<text class="name" x="' + px + '" y="' + (py - 26) + '">' + escapeXml(p.name) + '</text>\n';
  });

  // Footer
  svg += '<text class="footer" x="' + padding + '" y="' + (h - 8) + '">VoltXAmpere v9.0 \u2014 voltxampere.com</text>\n';
  svg += '<text class="footer" x="' + (w - padding) + '" y="' + (h - 8) + '" text-anchor="end">' + date + '</text>\n';
  svg += '</svg>\n';

  var safeName = circuitName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voltxampere_' + safeName + '_' + date + '.svg';
  a.click();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 100);
}
