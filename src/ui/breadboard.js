// ══════════════════════════════════════════════════════════════
// VXA.Breadboard — Sprint 20a: 3D Breadboard Render + Auto-Place
// ══════════════════════════════════════════════════════════════
VXA.Breadboard = (function() {
  'use strict';

  // ── CONSTANTS ──
  var HS = 20;           // Hole spacing (px per grid unit)
  var HR = 3.5;          // Hole radius
  var COLS = 63;         // Columns
  var POWER_ROWS = 2;    // Power rail rows (top/bottom each)
  var MAIN_ROWS = 5;     // Rows per half (a-e, f-j)
  var POWER_GAP = 0.8;   // Gap between power rail and main grid (in HS units)
  var CENTER_GAP = 1.5;  // DIP channel gap (in HS units)
  var TOTAL_ROWS = 14;   // 2 power + 5 top + 5 bottom + 2 power

  var C = {
    board: '#f5f0e8', boardEdge: '#d4cfc4', boardDark: '#c8c0b0',
    hole: '#2a2a2a', holeMetal: '#888', holeOccupied: '#4a90d9',
    channel: '#e8e0d0', channelLine: '#d0c8b8',
    railPlus: '#cc3333', railMinus: '#3366cc', railBg: '#f0ebe0',
    label: '#999', shadow: 'rgba(0,0,0,0.15)',
    desk: '#1a1a2e', deskLine: 'rgba(255,255,255,0.02)',
    mount: '#4a4a4a'
  };

  var WIRE_COLORS = ['#e74c3c','#2ecc71','#3498db','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
  var BAND_COLORS = ['#1a1a1a','#8B4513','#cc0000','#ff6600','#ffcc00','#00aa00','#0000cc','#9900cc','#808080','#ffffff'];
  var TOLERANCE_COLORS = { 5: '#D4AF37', 10: '#C0C0C0', 1: '#8B4513', 2: '#cc0000' };

  // Izometric projection
  var cosA = Math.cos(30 * Math.PI / 180); // ~0.866
  var sinA = Math.sin(30 * Math.PI / 180); // ~0.5

  // ── STATE ──
  var active = false;
  var scale = 1.0;
  var placements = [];  // {partId, type, pins:[{row,col}], value, model, damaged, temperature, isOn, brightness}
  var jumpers = [];     // {fromHole:{row,col}, toHole:{row,col}, color, netName}
  var occupied = {};    // "row:col" -> true
  var offX = 0, offY = 0;
  var fadeAlpha = 1;
  var fadeDir = 0; // 0=none, 1=fading in, -1=fading out
  var fadeCallback = null;

  // ── GRID HELPERS ──
  function rowY(row) {
    if (row < POWER_ROWS) return row * HS;
    if (row < POWER_ROWS + MAIN_ROWS) return (row + POWER_GAP) * HS;
    if (row < POWER_ROWS + MAIN_ROWS * 2) return (row + POWER_GAP + CENTER_GAP) * HS;
    return (row + POWER_GAP * 2 + CENTER_GAP) * HS;
  }

  function g2s(row, col, z) {
    z = z || 0;
    var x = col * HS;
    var y = rowY(row);
    return {
      x: (x - y) * cosA * scale + offX,
      y: (x + y) * sinA * scale - z * HS * scale + offY
    };
  }

  function rowLabel(r) {
    if (r === 0 || r === 12) return '+';
    if (r === 1 || r === 13) return '\u2212';
    return 'abcdefghij'[r - POWER_ROWS] || '?';
  }

  function markOccupied(row, col) { occupied[row + ':' + col] = true; }
  function isOccupied(row, col) { return !!occupied[row + ':' + col]; }

  // ── RESISTOR COLOR BANDS ──
  function getResistorBands(ohms) {
    if (!ohms || ohms <= 0) return [0, 0, 0, 5];
    var exp = Math.floor(Math.log10(ohms));
    var mantissa = Math.round(ohms / Math.pow(10, Math.max(0, exp - 1)));
    if (mantissa >= 100) { mantissa = Math.round(mantissa / 10); exp++; }
    var d1 = Math.floor(mantissa / 10) % 10;
    var d2 = mantissa % 10;
    var mult = Math.max(0, exp - 1);
    return [d1, d2, Math.min(mult, 9), 5]; // 5% tolerance
  }

  // ── DRAW BOARD ──
  function drawBoard(ctx, cw, ch) {
    var bw = (COLS + 2) * HS;
    var bh = (TOTAL_ROWS + POWER_GAP * 2 + CENTER_GAP + 2) * HS;

    offX = (cw - bw * cosA * scale) / 2 + 100;
    offY = ch * 0.3;

    // Desk surface
    ctx.fillStyle = C.desk;
    ctx.fillRect(0, 0, cw, ch);
    // Subtle wood lines
    ctx.strokeStyle = C.deskLine;
    ctx.lineWidth = 1;
    for (var dy = 0; dy < ch; dy += 40) {
      ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(cw, dy); ctx.stroke();
    }

    // Board shadow
    var tl = g2s(-1, -1, 0);
    var tr = g2s(-1, COLS + 1, 0);
    var br = g2s(TOTAL_ROWS, COLS + 1, 0);
    var bl = g2s(TOTAL_ROWS, -1, 0);
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.moveTo(tl.x + 6, tl.y + 6); ctx.lineTo(tr.x + 6, tr.y + 6);
    ctx.lineTo(br.x + 6, br.y + 6); ctx.lineTo(bl.x + 6, bl.y + 6);
    ctx.closePath(); ctx.fill();

    // Board body (isometric parallelogram)
    ctx.fillStyle = C.board;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
    ctx.closePath(); ctx.fill();

    // Board edge (bottom)
    ctx.fillStyle = C.boardDark;
    var thickness = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x, br.y + thickness); ctx.lineTo(bl.x, bl.y + thickness);
    ctx.closePath(); ctx.fill();
    // Board edge (right)
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x, br.y + thickness); ctx.lineTo(tr.x, tr.y + thickness);
    ctx.closePath(); ctx.fill();

    // Board outline
    ctx.strokeStyle = C.boardEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
    ctx.closePath(); ctx.stroke();

    // Mounting holes (4 corners)
    var corners = [[0, 1], [0, COLS - 2], [TOTAL_ROWS - 1, 1], [TOTAL_ROWS - 1, COLS - 2]];
    corners.forEach(function(cr) {
      var p = g2s(cr[0], cr[1], 0);
      ctx.fillStyle = C.mount;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.boardEdge;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2 * scale, 0, Math.PI * 2); ctx.fill();
    });

    // DIP channel
    var chLeft = g2s(POWER_ROWS + MAIN_ROWS - 0.3, 0, 0);
    var chRight = g2s(POWER_ROWS + MAIN_ROWS - 0.3, COLS, 0);
    var chLeft2 = g2s(POWER_ROWS + MAIN_ROWS + CENTER_GAP * 0.3, 0, 0);
    var chRight2 = g2s(POWER_ROWS + MAIN_ROWS + CENTER_GAP * 0.3, COLS, 0);
    ctx.fillStyle = C.channel;
    ctx.beginPath();
    ctx.moveTo(chLeft.x, chLeft.y); ctx.lineTo(chRight.x, chRight.y);
    ctx.lineTo(chRight2.x, chRight2.y); ctx.lineTo(chLeft2.x, chLeft2.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.channelLine; ctx.lineWidth = 0.5;
    ctx.stroke();

    // Power rail stripes
    drawPowerRails(ctx);

    // Row/column labels
    drawLabels(ctx);
  }

  function drawPowerRails(ctx) {
    // Top power rail: rows 0 (+) and 1 (-)
    // Bottom power rail: rows 12 (+) and 13 (-)
    var pairs = [[0, C.railPlus], [1, C.railMinus], [12, C.railPlus], [13, C.railMinus]];
    pairs.forEach(function(pr) {
      var row = pr[0], color = pr[1];
      // Draw stripe segments (every 5 cols break)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      for (var seg = 0; seg < COLS; seg += 5) {
        var end = Math.min(seg + 4, COLS - 1);
        var p1 = g2s(row, seg, 0);
        var p2 = g2s(row, end, 0);
        // Offset stripe slightly above/below holes
        var dy = (row % 2 === 0) ? -6 * scale : 6 * scale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y + dy);
        ctx.lineTo(p2.x, p2.y + dy);
        ctx.stroke();
      }
    });
  }

  function drawLabels(ctx) {
    ctx.font = (7 * scale) + 'px "JetBrains Mono", monospace';
    ctx.fillStyle = C.label;
    // Row labels (left side)
    for (var r = 0; r < TOTAL_ROWS; r++) {
      var p = g2s(r, -1.5, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rowLabel(r), p.x, p.y);
    }
    // Column labels (top, every 5)
    for (var c = 0; c < COLS; c += 5) {
      var p2 = g2s(-1.5, c, 0);
      ctx.fillText(String(c + 1), p2.x, p2.y);
    }
  }

  // ── DRAW HOLES ──
  function drawHoles(ctx) {
    var hr = HR * scale;
    for (var r = 0; r < TOTAL_ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var p = g2s(r, c, 0);
        var key = r + ':' + c;
        // Hole body
        ctx.fillStyle = occupied[key] ? C.holeOccupied : C.hole;
        ctx.beginPath(); ctx.arc(p.x, p.y, hr, 0, Math.PI * 2); ctx.fill();
        // Metal glint
        if (!occupied[key]) {
          ctx.fillStyle = C.holeMetal;
          ctx.globalAlpha = 0.3;
          ctx.beginPath(); ctx.arc(p.x - 0.5 * scale, p.y - 0.5 * scale, 1 * scale, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ── 3D COMPONENT DRAWINGS ──

  function drawLeg(ctx, pos, z, color) {
    // Vertical leg from z height down to hole (z=0)
    var top = g2s(pos.row, pos.col, z);
    var bot = g2s(pos.row, pos.col, 0);
    ctx.strokeStyle = color || '#aaa';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
  }

  function drawResistor3D(ctx, pl) {
    var p1 = pl.pins[0], p2 = pl.pins[1];
    var z = 0.5; // height above board
    // Legs
    drawLeg(ctx, p1, z, '#aaa');
    drawLeg(ctx, p2, z, '#aaa');
    // Body — elliptical cylinder between pins
    var s1 = g2s(p1.row, p1.col, z);
    var s2 = g2s(p2.row, p2.col, z);
    var mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    var dx = s2.x - s1.x, dy = s2.y - s1.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var bodyLen = len * 0.6;
    var bodyH = 6 * scale;
    var angle = Math.atan2(dy, dx);

    ctx.save(); ctx.translate(mx, my); ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(1, 3 * scale, bodyLen / 2, bodyH * 0.8, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    var bodyColor = pl.damaged ? '#333' : '#c8a882';
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, 0, bodyLen / 2, bodyH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pl.damaged ? '#555' : '#a08060';
    ctx.lineWidth = 0.5; ctx.stroke();

    // Color bands
    if (!pl.damaged) {
      var bands = getResistorBands(pl.value);
      var bandPositions = [-0.3, -0.15, 0.05, 0.3]; // normalized positions on body
      for (var bi = 0; bi < bands.length; bi++) {
        var bx = bandPositions[bi] * bodyLen;
        var bw = bodyLen * 0.06;
        var color = (bi === 3) ? (TOLERANCE_COLORS[bands[bi]] || '#D4AF37') : BAND_COLORS[bands[bi]];
        ctx.fillStyle = color;
        ctx.fillRect(bx - bw / 2, -bodyH * 0.9, bw, bodyH * 1.8);
      }
    }

    // Leads extending to legs
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(-bodyLen / 2, 0); ctx.lineTo(-len / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyLen / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();

    // Damage: smoke wisps
    if (pl.damaged) {
      ctx.strokeStyle = 'rgba(100,100,100,0.4)';
      ctx.lineWidth = 1;
      var t = Date.now() / 1000;
      for (var si = 0; si < 3; si++) {
        var sx = (si - 1) * bodyLen * 0.2;
        ctx.beginPath();
        ctx.moveTo(sx, -bodyH);
        ctx.bezierCurveTo(sx + Math.sin(t + si) * 3, -bodyH - 8 * scale,
                          sx - Math.sin(t + si * 2) * 4, -bodyH - 16 * scale,
                          sx + Math.sin(t + si * 3) * 2, -bodyH - 24 * scale);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawLED3D(ctx, pl) {
    var p1 = pl.pins[0], p2 = pl.pins[1];
    var z = 0.7;
    // Legs (anode longer)
    drawLeg(ctx, p1, z + 0.1, '#aaa');
    drawLeg(ctx, p2, z, '#aaa');

    // Dome center
    var s1 = g2s(p1.row, p1.col, z);
    var s2 = g2s(p2.row, p2.col, z);
    var cx = (s1.x + s2.x) / 2, cy = (s1.y + s2.y) / 2 - 2 * scale;
    var domeR = 7 * scale;

    // LED color from part (default red)
    var part = S.parts.find(function(pp) { return pp.id === pl.partId; });
    var ledColor = '#ff2222';
    if (part && part.color === 'green') ledColor = '#22cc22';
    else if (part && part.color === 'blue') ledColor = '#2266ff';
    else if (part && part.color === 'yellow') ledColor = '#ffcc00';
    else if (part && part.color === 'white') ledColor = '#ffffff';

    // Glow (if on)
    if (pl.isOn && !pl.damaged) {
      var brightness = Math.min(1, pl.brightness || 0.5);
      var grad = ctx.createRadialGradient(cx, cy, domeR * 0.5, cx, cy, domeR * 3);
      grad.addColorStop(0, ledColor.replace(')', ',' + (brightness * 0.6) + ')').replace('rgb', 'rgba').replace('#', ''));
      // Simpler glow
      ctx.globalAlpha = brightness * 0.4;
      ctx.fillStyle = ledColor;
      ctx.beginPath(); ctx.arc(cx, cy, domeR * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + 4 * scale, domeR * 0.9, domeR * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    // Dome body
    if (pl.damaged) {
      ctx.fillStyle = '#444';
    } else if (pl.isOn) {
      ctx.fillStyle = ledColor;
      ctx.globalAlpha = 0.5 + (pl.brightness || 0.5) * 0.5;
    } else {
      // Translucent colored dome
      ctx.fillStyle = ledColor;
      ctx.globalAlpha = 0.35;
    }
    ctx.beginPath(); ctx.arc(cx, cy, domeR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Dome edge
    ctx.strokeStyle = pl.damaged ? '#333' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, domeR, 0, Math.PI * 2); ctx.stroke();

    // Highlight
    if (!pl.damaged) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(cx - domeR * 0.25, cy - domeR * 0.3, domeR * 0.3, domeR * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();
    }

    // Flat edge (cathode side)
    var angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
    ctx.strokeStyle = pl.damaged ? '#555' : 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle + Math.PI / 2) * domeR * 0.7, cy + Math.sin(angle + Math.PI / 2) * domeR * 0.7);
    ctx.lineTo(cx - Math.cos(angle + Math.PI / 2) * domeR * 0.7, cy - Math.sin(angle + Math.PI / 2) * domeR * 0.7);
    ctx.stroke();

    // Damage: crack lines
    if (pl.damaged) {
      ctx.strokeStyle = 'rgba(200,200,200,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - domeR * 0.5, cy - domeR * 0.3);
      ctx.lineTo(cx + domeR * 0.2, cy + domeR * 0.1);
      ctx.lineTo(cx + domeR * 0.5, cy + domeR * 0.4);
      ctx.stroke();
    }
  }

  function drawCapCeramic3D(ctx, pl) {
    var p1 = pl.pins[0], p2 = pl.pins[1];
    var z = 0.4;
    drawLeg(ctx, p1, z, '#aaa');
    drawLeg(ctx, p2, z, '#aaa');

    var s1 = g2s(p1.row, p1.col, z);
    var s2 = g2s(p2.row, p2.col, z);
    var mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    var r = 5 * scale;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.arc(mx + 1, my + 2, r, 0, Math.PI * 2); ctx.fill();

    // Disk body (dark orange-yellow)
    ctx.fillStyle = pl.damaged ? '#555' : '#cc8833';
    ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pl.damaged ? '#444' : '#996622';
    ctx.lineWidth = 0.5; ctx.stroke();

    // Marking
    if (!pl.damaged && scale > 0.8) {
      ctx.fillStyle = '#333';
      ctx.font = (4 * scale) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var val = pl.value;
      var txt = val >= 1e-6 ? (val * 1e6).toFixed(0) + 'u' : (val * 1e9).toFixed(0) + 'n';
      ctx.fillText(txt, mx, my);
    }
  }

  function drawCapElectrolytic3D(ctx, pl) {
    var p1 = pl.pins[0], p2 = pl.pins[1];
    var height = Math.min(1.5, 0.8 + (pl.value || 1e-6) * 5e4);
    var z = height;
    drawLeg(ctx, p1, z, '#aaa');
    drawLeg(ctx, p2, z, '#aaa');

    var s1 = g2s(p1.row, p1.col, z);
    var s2 = g2s(p2.row, p2.col, z);
    var mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    var rw = 6 * scale, rh = height * HS * sinA * scale * 0.5;
    var bodyBot = g2s((p1.row + p2.row) / 2, (p1.col + p2.col) / 2, 0);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(mx + 1, my + rh + 3, rw, rw * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    // Cylinder body
    var grad = ctx.createLinearGradient(mx - rw, my, mx + rw, my);
    if (pl.damaged) {
      grad.addColorStop(0, '#444'); grad.addColorStop(0.5, '#666'); grad.addColorStop(1, '#444');
    } else {
      grad.addColorStop(0, '#888'); grad.addColorStop(0.3, '#ccc'); grad.addColorStop(0.7, '#bbb'); grad.addColorStop(1, '#777');
    }
    // Cylinder side
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(mx, my + rh, rw, rw * 0.4, 0, 0, Math.PI);
    ctx.ellipse(mx, my - rh, rw, rw * 0.4, 0, Math.PI, 0);
    ctx.closePath(); ctx.fill();

    // Top cap
    ctx.fillStyle = pl.damaged ? '#555' : '#aaa';
    ctx.beginPath(); ctx.ellipse(mx, my - rh, rw, rw * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5; ctx.stroke();

    // Negative stripe
    if (!pl.damaged) {
      ctx.fillStyle = 'rgba(40,40,40,0.4)';
      ctx.fillRect(mx + rw * 0.4, my - rh, rw * 0.5, rh * 2);
    }

    // Polarity mark (+)
    ctx.fillStyle = '#666';
    ctx.font = (5 * scale) + 'px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', mx - rw * 0.5, my - rh - 3 * scale);

    // Damage: bulging top
    if (pl.damaged) {
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath(); ctx.ellipse(mx, my - rh - 2 * scale, rw * 0.6, rw * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTransistor3D(ctx, pl) {
    var z = 0.5;
    // TO-92 package: 3 pins
    for (var i = 0; i < pl.pins.length; i++) {
      drawLeg(ctx, pl.pins[i], z, '#aaa');
    }
    // Body center
    var mid = pl.pins[1] || pl.pins[0]; // center pin
    var s = g2s(mid.row, mid.col, z);
    var bw = 8 * scale, bh = 10 * scale;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(s.x + 1, s.y + 3, bw, bh * 0.4, 0, 0, Math.PI * 2); ctx.fill();

    // D-shape body (flat front + semicircle back)
    ctx.fillStyle = pl.damaged ? '#222' : '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(s.x - bw * 0.7, s.y - bh * 0.5);
    ctx.lineTo(s.x - bw * 0.7, s.y + bh * 0.5);
    ctx.arc(s.x, s.y, bh * 0.5, Math.PI * 0.5, -Math.PI * 0.5, true);
    ctx.closePath(); ctx.fill();

    // Outline
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5; ctx.stroke();

    // Label
    if (scale > 0.8 && pl.model) {
      ctx.fillStyle = '#ccc';
      ctx.font = (3.5 * scale) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pl.model.substring(0, 6), s.x - bw * 0.1, s.y);
    }
  }

  function drawIC3D(ctx, pl) {
    if (pl.pins.length < 2) return;
    var z = 0.4;
    // Draw all legs
    for (var i = 0; i < pl.pins.length; i++) {
      drawLeg(ctx, pl.pins[i], z, '#aaa');
    }

    // Body spans from first pin to last
    var topLeft = pl.pins[0];
    var halfPins = Math.floor(pl.pins.length / 2);
    var topRight = pl.pins[halfPins - 1];
    var botLeft = pl.pins[pl.pins.length - 1];

    var tl = g2s(topLeft.row, topLeft.col, z);
    var tr = g2s(topRight.row, topRight.col, z);
    var bl = g2s(botLeft.row, botLeft.col, z);
    var br = g2s(pl.pins[halfPins].row, pl.pins[halfPins].col, z);

    // Rectangular body
    var pad = 4 * scale;
    ctx.fillStyle = pl.damaged ? '#1a1a1a' : '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(tl.x - pad, tl.y - pad);
    ctx.lineTo(tr.x + pad, tr.y - pad);
    ctx.lineTo(br.x + pad, br.y + pad);
    ctx.lineTo(bl.x - pad, bl.y + pad);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8; ctx.stroke();

    // Pin 1 notch
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(tl.x + 3 * scale, tl.y + 3 * scale, 3 * scale, 0, Math.PI, true); ctx.fill();

    // Pin 1 dot
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(tl.x + 3 * scale, tl.y + 6 * scale, 1.5 * scale, 0, Math.PI * 2); ctx.fill();

    // Label
    if (scale > 0.7) {
      ctx.fillStyle = '#ccc';
      ctx.font = 'bold ' + (4.5 * scale) + 'px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2;
      ctx.fillText(pl.model || 'IC', cx, cy);
    }
  }

  function drawDiode3D(ctx, pl) {
    var p1 = pl.pins[0], p2 = pl.pins[1];
    var z = 0.4;
    drawLeg(ctx, p1, z, '#aaa');
    drawLeg(ctx, p2, z, '#aaa');

    var s1 = g2s(p1.row, p1.col, z);
    var s2 = g2s(p2.row, p2.col, z);
    var mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    var len = Math.sqrt((s2.x - s1.x) * (s2.x - s1.x) + (s2.y - s1.y) * (s2.y - s1.y));
    var angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);

    ctx.save(); ctx.translate(mx, my); ctx.rotate(angle);
    var bLen = len * 0.4, bH = 4 * scale;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(1, 3, bLen / 2, bH, 0, 0, Math.PI * 2); ctx.fill();

    // Glass/plastic body
    ctx.fillStyle = pl.damaged ? '#333' : (pl.type === 'zener' ? '#222' : '#1a1a1a');
    ctx.beginPath(); ctx.ellipse(0, 0, bLen / 2, bH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5; ctx.stroke();

    // Cathode band
    ctx.fillStyle = '#ccc';
    ctx.fillRect(bLen * 0.25, -bH * 0.9, bLen * 0.08, bH * 1.8);

    // Leads
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.2 * scale;
    ctx.beginPath(); ctx.moveTo(-bLen / 2, 0); ctx.lineTo(-len / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bLen / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();

    ctx.restore();
  }

  function drawJumperWire(ctx, from, to, color) {
    var z1 = 0.2, z2 = 0.2;
    var s1 = g2s(from.row, from.col, z1);
    var s2 = g2s(to.row, to.col, z2);
    var dist = Math.sqrt((s2.x - s1.x) * (s2.x - s1.x) + (s2.y - s1.y) * (s2.y - s1.y));
    var sag = Math.max(8 * scale, dist * 0.15);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 * scale;
    ctx.lineCap = 'round';

    // Bezier curve with sag
    var mx = (s1.x + s2.x) / 2;
    var my = (s1.y + s2.y) / 2 - sag;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.quadraticCurveTo(mx, my, s2.x, s2.y);
    ctx.stroke();

    // Wire ends (tiny bulge at hole entry)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s1.x, s1.y, 2 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s2.x, s2.y, 2 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';
  }

  // ── AUTO-PLACEMENT ALGORITHM ──
  function autoPlace(parts, wires) {
    placements = [];
    jumpers = [];
    occupied = {};

    if (!parts || !parts.length) return;

    // Classify parts
    var ics = [], passives = [], semis = [], sources = [], others = [];
    parts.forEach(function(p) {
      if (p.type === 'ground' || p.type === 'wire' || p.type === 'netLabel' ||
          p.type === 'vccLabel' || p.type === 'gndLabel' || p.type === 'probe' ||
          p.type === 'voltmeter' || p.type === 'ammeter') return; // skip non-physical
      if (p.type === 'opamp' || (p.type === 'ic')) ics.push(p);
      else if (['resistor','capacitor','inductor','potentiometer'].indexOf(p.type) >= 0) passives.push(p);
      else if (['led','diode','zener','npn','pnp','nmos','pmos'].indexOf(p.type) >= 0) semis.push(p);
      else if (['dcSource','acSource','battery'].indexOf(p.type) >= 0) sources.push(p);
      else others.push(p);
    });

    var nextCol = 3;

    // ICs: straddle DIP channel (rows 2-6 top, 7-11 bottom)
    ics.forEach(function(ic) {
      var def = COMP[ic.type];
      var pinCount = def ? def.pins.length : 8;
      if (pinCount < 2) pinCount = 8;
      var halfPins = Math.ceil(pinCount / 2);
      var startCol = nextCol;

      var pins = [];
      // Left side: top half (rows 2..6), going down
      for (var i = 0; i < halfPins; i++) {
        var row = 2 + Math.min(i, 4);
        pins.push({ row: row, col: startCol + i });
        markOccupied(row, startCol + i);
      }
      // Right side: bottom half (rows 7..11), going up from right
      for (var j = 0; j < halfPins; j++) {
        var row2 = 7 + Math.min(halfPins - 1 - j, 4);
        pins.push({ row: row2, col: startCol + halfPins - 1 - j });
        markOccupied(row2, startCol + halfPins - 1 - j);
      }

      placements.push({
        partId: ic.id, type: 'ic', pins: pins,
        model: ic.model || ic.name || 'IC', value: null,
        damaged: ic.damaged || false, temperature: 25,
        isOn: false, brightness: 0
      });
      nextCol += halfPins + 2;
    });

    // Passives: top half (rows 2-6)
    var pCol = nextCol, pRow = 2;
    passives.forEach(function(part) {
      var span = 3; // 3 holes apart
      if (pCol + span >= COLS - 2) { pCol = 3; pRow++; if (pRow > 6) pRow = 2; }
      // Skip occupied
      while (isOccupied(pRow, pCol) || isOccupied(pRow, pCol + span)) {
        pCol++;
        if (pCol + span >= COLS - 2) { pCol = 3; pRow++; if (pRow > 6) pRow = 2; }
      }
      var p1 = { row: pRow, col: pCol };
      var p2 = { row: pRow, col: pCol + span };
      markOccupied(pRow, pCol);
      markOccupied(pRow, pCol + span);

      placements.push({
        partId: part.id, type: part.type,
        pins: [p1, p2], startHole: p1, endHole: p2,
        model: part.model || null,
        value: part.val || part.value || 1000,
        damaged: part.damaged || false, temperature: part.temperature || 25,
        isOn: false, brightness: 0
      });
      pCol += span + 2;
    });

    // Sources treated as passives (placed in top rows too)
    sources.forEach(function(part) {
      var span = 4;
      if (pCol + span >= COLS - 2) { pCol = 3; pRow++; if (pRow > 6) pRow = 2; }
      while (isOccupied(pRow, pCol) || isOccupied(pRow, pCol + span)) {
        pCol++;
        if (pCol + span >= COLS - 2) { pCol = 3; pRow++; if (pRow > 6) pRow = 2; }
      }
      var p1 = { row: pRow, col: pCol };
      var p2 = { row: pRow, col: pCol + span };
      markOccupied(pRow, pCol);
      markOccupied(pRow, pCol + span);
      placements.push({
        partId: part.id, type: part.type,
        pins: [p1, p2], startHole: p1, endHole: p2,
        model: null, value: part.val || 5,
        damaged: false, temperature: 25, isOn: false, brightness: 0
      });
      pCol += span + 2;
    });

    // Semiconductors: bottom half (rows 7-11)
    var sCol = 3, sRow = 8;
    semis.forEach(function(part) {
      var def = COMP[part.type];
      var pinCount = def ? def.pins.length : 2;
      if (sCol + pinCount >= COLS - 2) { sCol = 3; sRow++; if (sRow > 11) sRow = 7; }
      while (isOccupied(sRow, sCol)) {
        sCol++;
        if (sCol + pinCount >= COLS - 2) { sCol = 3; sRow++; if (sRow > 11) sRow = 7; }
      }

      var pins = [];
      for (var k = 0; k < pinCount; k++) {
        pins.push({ row: sRow, col: sCol + k });
        markOccupied(sRow, sCol + k);
      }

      placements.push({
        partId: part.id, type: part.type,
        pins: pins, startHole: pins[0], endHole: pins[pins.length - 1],
        model: part.model || part.name || null,
        value: null, damaged: part.damaged || false,
        temperature: part.temperature || 25,
        isOn: false, brightness: 0
      });
      sCol += pinCount + 2;
    });

    // Others: fill remaining space
    others.forEach(function(part) {
      var def = COMP[part.type];
      var pinCount = def ? def.pins.length : 2;
      if (pCol + pinCount >= COLS - 2) { pCol = 3; pRow++; if (pRow > 6) pRow = 2; }
      var pins = [];
      for (var k = 0; k < pinCount; k++) {
        pins.push({ row: pRow, col: pCol + k });
        markOccupied(pRow, pCol + k);
      }
      placements.push({
        partId: part.id, type: part.type,
        pins: pins, model: null, value: part.val,
        damaged: part.damaged || false, temperature: 25,
        isOn: false, brightness: 0
      });
      pCol += pinCount + 2;
    });

    // Generate jumper wires
    generateJumpers(wires);
  }

  function generateJumpers(wires) {
    if (!wires || !wires.length) return;

    // Build pin→placement hole mapping using schematic coordinates
    // For each wire, find which parts' pins it connects, then check breadboard connectivity
    var pinHoleMap = {}; // "worldX:worldY" -> {placement, pinIdx, hole}

    placements.forEach(function(pl) {
      var part = S.parts.find(function(pp) { return pp.id === pl.partId; });
      if (!part) return;
      var def = COMP[part.type];
      if (!def) return;
      var worldPins = getPartPins(part);
      for (var i = 0; i < worldPins.length && i < pl.pins.length; i++) {
        var key = Math.round(worldPins[i].x) + ':' + Math.round(worldPins[i].y);
        pinHoleMap[key] = { placement: pl, pinIdx: i, hole: pl.pins[i] };
      }
    });

    var wireColorIdx = 0;
    var addedJumpers = {}; // prevent duplicates

    wires.forEach(function(w) {
      var k1 = Math.round(w.x1) + ':' + Math.round(w.y1);
      var k2 = Math.round(w.x2) + ':' + Math.round(w.y2);
      var from = pinHoleMap[k1];
      var to = pinHoleMap[k2];
      if (!from || !to) return;
      if (!from.hole || !to.hole) return;

      // Check if internally connected on breadboard
      var sameCol = from.hole.col === to.hole.col;
      var fromTopHalf = from.hole.row >= 2 && from.hole.row <= 6;
      var toTopHalf = to.hole.row >= 2 && to.hole.row <= 6;
      var fromBotHalf = from.hole.row >= 7 && from.hole.row <= 11;
      var toBotHalf = to.hole.row >= 7 && to.hole.row <= 11;
      var sameGroup = (fromTopHalf && toTopHalf) || (fromBotHalf && toBotHalf);

      if (sameCol && sameGroup) return; // internally connected, no jumper needed

      // Dedup
      var jKey = [from.hole.row, from.hole.col, to.hole.row, to.hole.col].join(':');
      var jKeyRev = [to.hole.row, to.hole.col, from.hole.row, from.hole.col].join(':');
      if (addedJumpers[jKey] || addedJumpers[jKeyRev]) return;
      addedJumpers[jKey] = true;

      jumpers.push({
        fromHole: from.hole,
        toHole: to.hole,
        color: WIRE_COLORS[wireColorIdx % WIRE_COLORS.length],
        netName: 'net_' + wireColorIdx
      });
      wireColorIdx++;
    });
  }

  // ── MAIN RENDER ──
  function draw(ctx, cw, ch) {
    if (!active) return;

    ctx.save();
    if (fadeAlpha < 1) ctx.globalAlpha = fadeAlpha;

    // 1. Board
    drawBoard(ctx, cw, ch);

    // 2. Holes
    drawHoles(ctx);

    // 3. Components (sorted by row for painter's algorithm)
    var sorted = placements.slice().sort(function(a, b) {
      return (a.pins[0] ? a.pins[0].row : 0) - (b.pins[0] ? b.pins[0].row : 0);
    });

    sorted.forEach(function(pl) {
      switch (pl.type) {
        case 'resistor': drawResistor3D(ctx, pl); break;
        case 'led': drawLED3D(ctx, pl); break;
        case 'capacitor':
          if (pl.value && pl.value > 1e-6) drawCapElectrolytic3D(ctx, pl);
          else drawCapCeramic3D(ctx, pl);
          break;
        case 'npn': case 'pnp': case 'nmos': case 'pmos':
          drawTransistor3D(ctx, pl); break;
        case 'ic': case 'opamp':
          drawIC3D(ctx, pl); break;
        case 'diode': case 'zener':
          drawDiode3D(ctx, pl); break;
        default:
          // Generic 2-pin component: draw as resistor-like
          if (pl.pins.length >= 2) drawResistor3D(ctx, pl);
          break;
      }
    });

    // 4. Jumper wires (on top)
    jumpers.forEach(function(j) {
      drawJumperWire(ctx, j.fromHole, j.toHole, j.color);
    });

    // 5. Overlay badge
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6, 6, 140, 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(6, 6, 140, 36);
    ctx.fillStyle = '#00e09e';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('\uD83D\uDD32 BREADBOARD', 12, 11);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px "JetBrains Mono", monospace';
    var hint = (typeof currentLang !== 'undefined' && currentLang === 'tr') ? 'Ctrl+B: \u015Eemati\u011Fe d\u00F6n' : 'Ctrl+B: Back to schematic';
    ctx.fillText(hint, 12, 27);

    ctx.restore();
  }

  // ── SIMULATION STATE SYNC ──
  function syncSimState() {
    if (!active) return;
    placements.forEach(function(pl) {
      var part = S.parts.find(function(pp) { return pp.id === pl.partId; });
      if (!part) return;
      pl.damaged = part.damaged || false;
      pl.temperature = (part._thermal && part._thermal.T) || 25;
      if (part.type === 'led') {
        pl.isOn = Math.abs(part._i || 0) > 0.001;
        pl.brightness = Math.min(1, Math.abs(part._i || 0) / 0.020);
      }
    });
  }

  // ── TRANSITION ──
  function activateWithTransition() {
    autoPlace(S.parts, S.wires);
    active = true;
    fadeAlpha = 0;
    fadeDir = 1;
    needsRender = true;
  }

  function deactivateWithTransition() {
    fadeDir = -1;
    fadeCallback = function() { active = false; };
    needsRender = true;
  }

  function updateFade() {
    if (fadeDir === 0) return;
    fadeAlpha += fadeDir * 0.08;
    if (fadeAlpha >= 1) { fadeAlpha = 1; fadeDir = 0; }
    if (fadeAlpha <= 0) {
      fadeAlpha = 0; fadeDir = 0;
      if (fadeCallback) { fadeCallback(); fadeCallback = null; }
    }
    needsRender = true;
  }

  // ══════════════════════════════════════════════════════════════
  // Sprint 20b — Interaction Layer
  // ══════════════════════════════════════════════════════════════

  var dragState = null;
  var hoveredHole = null;
  var hoveredComponent = null;
  var _bbQuickAddEl = null;

  // ── SCREEN → GRID (inverse isometric) ──
  function s2g(sx, sy) {
    // Undo the forward transform: g2s(row, col, 0) → screen
    // sx = (col*HS - rowY) * cosA * scale + offX
    // sy = (col*HS + rowY) * sinA * scale + offY
    // Let u = col*HS, v = rowY:
    //   sx - offX = (u - v) * cosA * scale
    //   sy - offY = (u + v) * sinA * scale
    //   u - v = (sx - offX) / (cosA * scale)
    //   u + v = (sy - offY) / (sinA * scale)
    //   u = ((sx-offX)/(cosA*scale) + (sy-offY)/(sinA*scale)) / 2
    //   v = ((sy-offY)/(sinA*scale) - (sx-offX)/(cosA*scale)) / 2
    var dx = (sx - offX) / (cosA * scale);
    var dy = (sy - offY) / (sinA * scale);
    var u = (dx + dy) / 2; // col * HS
    var v = (dy - dx) / 2; // rowY
    var col = Math.round(u / HS);

    // Inverse rowY: find nearest row
    var bestRow = -1, bestDist = Infinity;
    for (var r = 0; r < TOTAL_ROWS; r++) {
      var dist = Math.abs(rowY(r) - v);
      if (dist < bestDist) { bestDist = dist; bestRow = r; }
    }

    if (col < 0 || col >= COLS || bestRow < 0 || bestRow >= TOTAL_ROWS) return null;
    // Check if close enough to a hole (within half spacing)
    if (bestDist > HS * 0.8) return null;
    return { row: bestRow, col: col };
  }

  function isValidHole(row, col) {
    return row >= 0 && row < TOTAL_ROWS && col >= 0 && col < COLS;
  }

  function isOccupiedByOther(row, col, excludePartId) {
    var key = row + ':' + col;
    if (!occupied[key]) return false;
    // Check if the occupation is by a different part
    for (var i = 0; i < placements.length; i++) {
      if (placements[i].partId === excludePartId) continue;
      for (var j = 0; j < placements[i].pins.length; j++) {
        if (placements[i].pins[j].row === row && placements[i].pins[j].col === col) return true;
      }
    }
    return false;
  }

  // ── HIT TESTS ──
  function hitTestComponent(sx, sy) {
    // Check placements from top (closest to camera) to back
    for (var i = placements.length - 1; i >= 0; i--) {
      var pl = placements[i];
      if (!pl.pins || pl.pins.length < 1) continue;
      // Bounding box in screen coords
      var minSx = Infinity, maxSx = -Infinity, minSy = Infinity, maxSy = -Infinity;
      for (var j = 0; j < pl.pins.length; j++) {
        var p = g2s(pl.pins[j].row, pl.pins[j].col, 0);
        if (p.x < minSx) minSx = p.x;
        if (p.x > maxSx) maxSx = p.x;
        if (p.y < minSy) minSy = p.y;
        if (p.y > maxSy) maxSy = p.y;
      }
      // Expand bounding box for component body
      var pad = 12 * scale;
      minSx -= pad; maxSx += pad;
      minSy -= pad - 15 * scale; maxSy += pad; // extra upward for component height
      if (sx >= minSx && sx <= maxSx && sy >= minSy && sy <= maxSy) return pl;
    }
    return null;
  }

  function hitTestJumper(sx, sy) {
    for (var ji = 0; ji < jumpers.length; ji++) {
      var j = jumpers[ji];
      var from = g2s(j.fromHole.row, j.fromHole.col, 0.2);
      var to = g2s(j.toHole.row, j.toHole.col, 0.2);
      var dist2 = Math.sqrt((to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y));
      var sag = Math.max(8 * scale, dist2 * 0.15);
      var midX = (from.x + to.x) / 2;
      var midY = (from.y + to.y) / 2 - sag;
      // Sample 20 points along the quadratic bezier
      for (var t = 0; t <= 1; t += 0.05) {
        var px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
        var py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
        var d = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
        if (d < 8 * scale) return j;
      }
    }
    return null;
  }

  // ── EVENT HANDLERS ──
  function onMouseDown(e) {
    var rect = cvs.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    // Hide quick-add menu if open
    hideBBQuickAdd();

    // Right-click handled separately
    if (e.button === 2) return;
    // Middle-click: pan (delegate to default handler by not consuming)
    if (e.button === 1) return false;

    // 1. Component hit?
    var hitPl = hitTestComponent(mx, my);
    if (hitPl) {
      var refPos = g2s(hitPl.pins[0].row, hitPl.pins[0].col, 0);
      dragState = {
        type: 'component',
        placement: hitPl,
        originalPins: JSON.parse(JSON.stringify(hitPl.pins)),
        offsetX: mx - refPos.x,
        offsetY: my - refPos.y,
        preview: null,
        moved: false
      };
      // Select in schematic too
      S.sel = [hitPl.partId];
      needsRender = true;
      return true; // consumed
    }

    // 2. Jumper hit? → select it
    var hitJ = hitTestJumper(mx, my);
    if (hitJ) {
      // Just highlight for now, context menu on right-click
      needsRender = true;
      return true;
    }

    // 3. Empty hole? → start jumper draw
    var hole = s2g(mx, my);
    if (hole && isValidHole(hole.row, hole.col)) {
      dragState = {
        type: 'jumper',
        startHole: hole,
        targetHole: null,
        currentMouse: { x: mx, y: my }
      };
      return true;
    }

    return false; // not consumed
  }

  function onMouseMove(e) {
    var rect = cvs.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (!dragState) {
      // Hover
      hoveredHole = s2g(mx, my);
      hoveredComponent = hitTestComponent(mx, my);
      var wrap = document.getElementById('canvas-wrap');
      if (wrap) {
        if (hoveredComponent) wrap.style.cursor = 'grab';
        else if (hoveredHole) wrap.style.cursor = 'crosshair';
        else wrap.style.cursor = 'default';
      }
      needsRender = true;
      return;
    }

    if (dragState.type === 'component') {
      var wrap2 = document.getElementById('canvas-wrap');
      if (wrap2) wrap2.style.cursor = 'grabbing';
      dragState.moved = true;
      // Calculate target grid position
      var targetHole = s2g(mx - dragState.offsetX, my - dragState.offsetY);
      if (targetHole) {
        var dr = targetHole.row - dragState.originalPins[0].row;
        var dc = targetHole.col - dragState.originalPins[0].col;
        dragState.preview = { deltaRow: dr, deltaCol: dc };
      }
      needsRender = true;
    }

    if (dragState.type === 'jumper') {
      dragState.currentMouse = { x: mx, y: my };
      dragState.targetHole = s2g(mx, my);
      needsRender = true;
    }
  }

  function onMouseUp(e) {
    if (!dragState) return;

    if (dragState.type === 'component' && dragState.moved && dragState.preview) {
      var pl = dragState.placement;
      var dr = dragState.preview.deltaRow;
      var dc = dragState.preview.deltaCol;
      var newPins = pl.pins.map(function(pin) {
        return { row: dragState.originalPins[pl.pins.indexOf(pin)].row + dr, col: dragState.originalPins[pl.pins.indexOf(pin)].col + dc };
      });
      // Recompute from original pins
      newPins = dragState.originalPins.map(function(pin) {
        return { row: pin.row + dr, col: pin.col + dc };
      });

      var allValid = true;
      for (var k = 0; k < newPins.length; k++) {
        if (!isValidHole(newPins[k].row, newPins[k].col) || isOccupiedByOther(newPins[k].row, newPins[k].col, pl.partId)) {
          allValid = false; break;
        }
      }

      if (allValid && (dr !== 0 || dc !== 0)) {
        // Free old holes
        dragState.originalPins.forEach(function(pin) { delete occupied[pin.row + ':' + pin.col]; });
        // Set new pins
        pl.pins = newPins;
        if (pl.startHole) pl.startHole = newPins[0];
        if (pl.endHole) pl.endHole = newPins[newPins.length - 1];
        // Mark new holes
        newPins.forEach(function(pin) { occupied[pin.row + ':' + pin.col] = true; });
        // Regenerate jumpers
        regenJumpers();
      }
      // else: snap back (no change needed, original pins still set)
    }

    if (dragState.type === 'jumper' && dragState.targetHole) {
      var from = dragState.startHole;
      var to = dragState.targetHole;
      if (from.row !== to.row || from.col !== to.col) {
        if (isValidHole(to.row, to.col)) {
          jumpers.push({
            fromHole: from, toHole: to,
            color: WIRE_COLORS[jumpers.length % WIRE_COLORS.length],
            netName: 'manual_' + jumpers.length,
            isManual: true
          });
          // Sync to schematic: add wire
          syncJumperToSchematic(from, to);
        }
      }
    }

    dragState = null;
    var wrap = document.getElementById('canvas-wrap');
    if (wrap) wrap.style.cursor = 'default';
    needsRender = true;
  }

  function onDblClick(e) {
    var rect = cvs.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    var hitPl = hitTestComponent(mx, my);
    if (hitPl) {
      // Select part and open inline edit
      S.sel = [hitPl.partId];
      var part = S.parts.find(function(pp) { return pp.id === hitPl.partId; });
      if (part && typeof openInlineEdit === 'function') openInlineEdit(part);
      return;
    }

    var hole = s2g(mx, my);
    if (hole && isValidHole(hole.row, hole.col) && !isOccupied(hole.row, hole.col)) {
      showBBQuickAdd(hole, e.clientX, e.clientY);
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    var rect = cvs.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    var hitPl = hitTestComponent(mx, my);
    if (hitPl) {
      showBBContextMenu(e.clientX, e.clientY, [
        { label: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? '\u270E D\u00FCzenle' : '\u270E Edit', action: function() {
          S.sel = [hitPl.partId];
          var part = S.parts.find(function(pp) { return pp.id === hitPl.partId; });
          if (part && typeof openInlineEdit === 'function') openInlineEdit(part);
        }},
        { label: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? '\u21BB D\u00F6nd\u00FCr' : '\u21BB Rotate', action: function() { rotateOnBoard(hitPl); }},
        { label: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? '\u2715 Sil' : '\u2715 Delete', action: function() { removeFromBoard(hitPl); }, danger: true }
      ]);
      return;
    }

    var hitJ = hitTestJumper(mx, my);
    if (hitJ) {
      showBBContextMenu(e.clientX, e.clientY, [
        { label: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? '\u2715 Kabloyu Sil' : '\u2715 Delete Wire', action: function() { removeJumper(hitJ); }, danger: true }
      ]);
    }
  }

  // ── CONTEXT MENU ──
  function showBBContextMenu(x, y, items) {
    hideBBContextMenu();
    var menu = document.createElement('div');
    menu.id = 'bb-ctx-menu';
    menu.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;background:rgba(12,16,28,0.95);border:1px solid #336;border-radius:8px;padding:4px 0;z-index:9999;min-width:140px;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.5);font:12px "JetBrains Mono",monospace';
    items.forEach(function(item) {
      var btn = document.createElement('div');
      btn.textContent = item.label;
      btn.style.cssText = 'padding:6px 14px;cursor:pointer;color:' + (item.danger ? '#f66' : '#ddd') + ';transition:background 0.15s';
      btn.onmouseenter = function() { btn.style.background = 'rgba(255,255,255,0.08)'; };
      btn.onmouseleave = function() { btn.style.background = 'none'; };
      btn.onclick = function() { item.action(); hideBBContextMenu(); needsRender = true; };
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('mousedown', _bbCtxOutside);
    }, 30);
  }
  function hideBBContextMenu() {
    var el = document.getElementById('bb-ctx-menu');
    if (el) el.remove();
    document.removeEventListener('mousedown', _bbCtxOutside);
  }
  function _bbCtxOutside(e) {
    var el = document.getElementById('bb-ctx-menu');
    if (el && !el.contains(e.target)) hideBBContextMenu();
  }

  // ── QUICK-ADD MENU ──
  function showBBQuickAdd(hole, px, py) {
    hideBBQuickAdd();
    var items = [
      { type: 'resistor', label: 'R', name: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? 'Diren\u00E7' : 'Resistor' },
      { type: 'capacitor', label: 'C', name: (typeof currentLang !== 'undefined' && currentLang === 'tr') ? 'Kapasit\u00F6r' : 'Capacitor' },
      { type: 'led', label: 'L', name: 'LED' }
    ];
    var menu = document.createElement('div');
    menu.id = 'bb-quick-add';
    menu.style.cssText = 'position:fixed;left:' + px + 'px;top:' + py + 'px;background:rgba(12,16,28,0.95);border:1px solid #336;border-radius:8px;padding:4px 0;z-index:9999;min-width:120px;backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,0.5);font:12px "JetBrains Mono",monospace';
    items.forEach(function(item) {
      var btn = document.createElement('div');
      btn.textContent = item.label + '  ' + item.name;
      btn.style.cssText = 'padding:6px 14px;cursor:pointer;color:#ddd;transition:background 0.15s';
      btn.onmouseenter = function() { btn.style.background = 'rgba(255,255,255,0.08)'; };
      btn.onmouseleave = function() { btn.style.background = 'none'; };
      btn.onclick = function() {
        addPartAtHole(item.type, hole);
        hideBBQuickAdd();
        needsRender = true;
      };
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    _bbQuickAddEl = menu;
    setTimeout(function() {
      document.addEventListener('mousedown', _bbQAOutside);
    }, 30);
  }
  function hideBBQuickAdd() {
    if (_bbQuickAddEl) { _bbQuickAddEl.remove(); _bbQuickAddEl = null; }
    document.removeEventListener('mousedown', _bbQAOutside);
  }
  function _bbQAOutside(e) {
    if (_bbQuickAddEl && !_bbQuickAddEl.contains(e.target)) hideBBQuickAdd();
  }

  // ── ADD PART AT HOLE ──
  function addPartAtHole(type, hole) {
    var def = COMP[type];
    if (!def) return;
    var pinCount = def.pins.length;
    var span = pinCount === 2 ? 3 : pinCount;
    // Check space
    for (var i = 0; i < span; i++) {
      if (isOccupied(hole.row, hole.col + i)) return;
      if (hole.col + i >= COLS) return;
    }
    // Add to schematic
    if (typeof saveUndo === 'function') saveUndo();
    var p = { id: S.nextId++, type: type, name: (typeof nextName === 'function' ? nextName(type) : type + S.nextId), x: 200, y: 200, rot: 0, val: def.def, flipH: false, flipV: false };
    S.parts.push(p);
    // Add to breadboard
    var pins = [];
    for (var k = 0; k < Math.min(pinCount, span); k++) {
      pins.push({ row: hole.row, col: hole.col + k });
      markOccupied(hole.row, hole.col + k);
    }
    placements.push({
      partId: p.id, type: type,
      pins: pins, startHole: pins[0], endHole: pins[pins.length - 1],
      model: null, value: def.def,
      damaged: false, temperature: 25, isOn: false, brightness: 0
    });
    S.sel = [p.id];
    if (typeof updateInspector === 'function') updateInspector();
  }

  // ── ROTATE ──
  function rotateOnBoard(pl) {
    if (pl.pins.length !== 2) return;
    var p0 = pl.pins[0], p1 = pl.pins[1];
    var dc = p1.col - p0.col, dr = p1.row - p0.row;
    // 90° rotation: (dc, dr) → (-dr, dc)
    var newP1 = { row: p0.row + dc, col: p0.col - dr };
    if (!isValidHole(newP1.row, newP1.col)) return;
    if (isOccupiedByOther(newP1.row, newP1.col, pl.partId)) return;
    delete occupied[p1.row + ':' + p1.col];
    pl.pins[1] = newP1;
    if (pl.endHole) pl.endHole = newP1;
    occupied[newP1.row + ':' + newP1.col] = true;
    regenJumpers();
    needsRender = true;
  }

  // ── REMOVE ──
  function removeFromBoard(pl) {
    pl.pins.forEach(function(pin) { delete occupied[pin.row + ':' + pin.col]; });
    var idx = placements.indexOf(pl);
    if (idx >= 0) placements.splice(idx, 1);
    // Remove related jumpers
    jumpers = jumpers.filter(function(j) {
      var fromMatch = pl.pins.some(function(p) { return p.row === j.fromHole.row && p.col === j.fromHole.col; });
      var toMatch = pl.pins.some(function(p) { return p.row === j.toHole.row && p.col === j.toHole.col; });
      return !fromMatch && !toMatch;
    });
    // Remove from schematic
    if (typeof saveUndo === 'function') saveUndo();
    S.parts = S.parts.filter(function(p) { return p.id !== pl.partId; });
    S.sel = [];
    if (typeof updateInspector === 'function') updateInspector();
    needsRender = true;
  }

  function removeJumper(j) {
    var idx = jumpers.indexOf(j);
    if (idx >= 0) jumpers.splice(idx, 1);
    needsRender = true;
  }

  // ── SYNC ──
  function syncJumperToSchematic(from, to) {
    // Find which parts are at these holes and their pin world coords
    var fromPl = null, fromPinIdx = -1, toPl = null, toPinIdx = -1;
    placements.forEach(function(pl) {
      for (var i = 0; i < pl.pins.length; i++) {
        if (pl.pins[i].row === from.row && pl.pins[i].col === from.col) { fromPl = pl; fromPinIdx = i; }
        if (pl.pins[i].row === to.row && pl.pins[i].col === to.col) { toPl = pl; toPinIdx = i; }
      }
    });
    if (!fromPl || !toPl) return;
    var fromPart = S.parts.find(function(p) { return p.id === fromPl.partId; });
    var toPart = S.parts.find(function(p) { return p.id === toPl.partId; });
    if (!fromPart || !toPart) return;
    var fromPins = getPartPins(fromPart);
    var toPins = getPartPins(toPart);
    if (fromPinIdx >= fromPins.length || toPinIdx >= toPins.length) return;
    // Add wire to schematic
    if (typeof saveUndo === 'function') saveUndo();
    S.wires.push({
      x1: Math.round(fromPins[fromPinIdx].x), y1: Math.round(fromPins[fromPinIdx].y),
      x2: Math.round(toPins[toPinIdx].x), y2: Math.round(toPins[toPinIdx].y)
    });
  }

  function syncFromSchematic() {
    if (!active) return;
    var existingIds = {};
    placements.forEach(function(p) { existingIds[p.partId] = true; });

    // Add new parts
    S.parts.forEach(function(part) {
      if (existingIds[part.id]) return;
      if (['ground','wire','netLabel','vccLabel','gndLabel','probe','voltmeter','ammeter'].indexOf(part.type) >= 0) return;
      addSinglePartToBoard(part);
    });

    // Remove deleted parts
    var currentIds = {};
    S.parts.forEach(function(p) { currentIds[p.id] = true; });
    for (var i = placements.length - 1; i >= 0; i--) {
      if (!currentIds[placements[i].partId]) {
        placements[i].pins.forEach(function(pin) { delete occupied[pin.row + ':' + pin.col]; });
        placements.splice(i, 1);
      }
    }

    // Update values
    placements.forEach(function(pl) {
      var part = S.parts.find(function(pp) { return pp.id === pl.partId; });
      if (part) { pl.value = part.val || pl.value; pl.damaged = part.damaged || false; }
    });

    regenJumpers();
    needsRender = true;
  }

  function regenJumpers() {
    var manualJ = jumpers.filter(function(j) { return j.isManual; });
    jumpers = [];
    generateJumpers(S.wires);
    for (var i = 0; i < manualJ.length; i++) jumpers.push(manualJ[i]);
  }

  function addSinglePartToBoard(part) {
    var def = COMP[part.type];
    var pinCount = def ? def.pins.length : 2;
    var span = pinCount === 2 ? 3 : pinCount;
    var searchRow, searchRowEnd;
    if (['resistor','capacitor','inductor','potentiometer'].indexOf(part.type) >= 0) {
      searchRow = 2; searchRowEnd = 6;
    } else if (['led','diode','zener','npn','pnp','nmos','pmos'].indexOf(part.type) >= 0) {
      searchRow = 7; searchRowEnd = 11;
    } else if (['opamp','ic'].indexOf(part.type) >= 0) {
      searchRow = 2; searchRowEnd = 6;
    } else { searchRow = 2; searchRowEnd = 6; }

    for (var row = searchRow; row <= searchRowEnd; row++) {
      for (var col = 2; col <= COLS - span - 2; col++) {
        var fits = true;
        for (var i = 0; i < span; i++) {
          if (occupied[(row) + ':' + (col + i)]) { fits = false; break; }
        }
        if (fits) {
          var pins = [];
          for (var j = 0; j < Math.min(pinCount, span); j++) {
            pins.push({ row: row, col: col + j });
            occupied[row + ':' + (col + j)] = true;
          }
          placements.push({
            partId: part.id, type: part.type,
            pins: pins, startHole: pins[0], endHole: pins[pins.length - 1],
            model: part.model || null, value: part.val || 0,
            damaged: part.damaged || false, temperature: 25, isOn: false, brightness: 0
          });
          return true;
        }
      }
    }
    return false;
  }

  // ── DRAW INTERACTION OVERLAYS ──
  function drawHoverEffects(ctx) {
    if (dragState) return;
    if (hoveredHole && isValidHole(hoveredHole.row, hoveredHole.col)) {
      var pos = g2s(hoveredHole.row, hoveredHole.col, 0);
      var pulse = 0.4 + 0.3 * Math.sin(Date.now() / 300);
      ctx.strokeStyle = 'rgba(74, 144, 226, ' + pulse + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 6 * scale, 0, Math.PI * 2); ctx.stroke();
    }
    if (hoveredComponent) {
      // Glow around hovered component
      var pl = hoveredComponent;
      for (var i = 0; i < pl.pins.length; i++) {
        var pp = g2s(pl.pins[i].row, pl.pins[i].col, 0);
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pp.x, pp.y, 5 * scale, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawDragPreview(ctx) {
    if (!dragState) return;

    if (dragState.type === 'component' && dragState.preview) {
      var dr = dragState.preview.deltaRow, dc = dragState.preview.deltaCol;
      var newPins = dragState.originalPins.map(function(pin) { return { row: pin.row + dr, col: pin.col + dc }; });
      var valid = true;
      for (var k = 0; k < newPins.length; k++) {
        if (!isValidHole(newPins[k].row, newPins[k].col) || isOccupiedByOther(newPins[k].row, newPins[k].col, dragState.placement.partId)) {
          valid = false; break;
        }
      }
      // Draw ghost pins
      ctx.globalAlpha = 0.5;
      for (var i = 0; i < newPins.length; i++) {
        var p = g2s(newPins[i].row, newPins[i].col, 0);
        ctx.fillStyle = valid ? '#2ecc71' : '#e74c3c';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 * scale, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (dragState.type === 'jumper') {
      var fromPos = g2s(dragState.startHole.row, dragState.startHole.col, 0);
      ctx.strokeStyle = WIRE_COLORS[jumpers.length % WIRE_COLORS.length];
      ctx.lineWidth = 2.5 * scale;
      ctx.setLineDash([5, 3]);

      if (dragState.targetHole && isValidHole(dragState.targetHole.row, dragState.targetHole.col)) {
        var toPos = g2s(dragState.targetHole.row, dragState.targetHole.col, 0);
        var midY = Math.min(fromPos.y, toPos.y) - 15 * scale;
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.quadraticCurveTo((fromPos.x + toPos.x) / 2, midY, toPos.x, toPos.y);
        ctx.stroke();
        // Target halo
        ctx.setLineDash([]);
        ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(toPos.x, toPos.y, 6 * scale, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(dragState.currentMouse.x, dragState.currentMouse.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  // ── PUBLIC API ──
  return {
    activate: function() { activateWithTransition(); },
    deactivate: function() { deactivateWithTransition(); },
    toggle: function() {
      if (active) this.deactivate();
      else this.activate();
    },
    isActive: function() { return active; },
    draw: function(ctx, w, h) {
      updateFade();
      draw(ctx, w, h);
      if (active) {
        drawHoverEffects(ctx);
        drawDragPreview(ctx);
      }
    },
    syncSimState: syncSimState,
    getPlacements: function() { return placements; },
    getJumpers: function() { return jumpers; },
    reset: function() {
      placements = []; jumpers = []; occupied = {};
      active = false; fadeAlpha = 1; fadeDir = 0;
      dragState = null; hoveredHole = null; hoveredComponent = null;
    },
    setScale: function(s) { scale = Math.max(0.3, Math.min(3.0, s)); needsRender = true; },
    getScale: function() { return scale; },
    // Sprint 20b — Interaction
    handleMouseDown: function(e) { return onMouseDown(e); },
    handleMouseMove: function(e) { onMouseMove(e); },
    handleMouseUp: function(e) { onMouseUp(e); },
    handleDblClick: function(e) { onDblClick(e); },
    handleContextMenu: function(e) { onContextMenu(e); },
    syncFromSchematic: function() { syncFromSchematic(); },
    addSinglePart: function(part) { return addSinglePartToBoard(part); },
    // Testing
    _autoPlace: function(parts, wires) { autoPlace(parts, wires); },
    _gridToScreen: g2s,
    _screenToGrid: s2g,
    _getOccupied: function() { return occupied; },
    _hitTestComponent: hitTestComponent,
    _hitTestJumper: hitTestJumper,
    _getDragState: function() { return dragState; },
    _setDragState: function(ds) { dragState = ds; },
    _rotateOnBoard: rotateOnBoard,
    _removeFromBoard: removeFromBoard,
    _removeJumper: removeJumper,
    _addSinglePartToBoard: addSinglePartToBoard,
    _regenJumpers: regenJumpers,
    _isOccupiedByOther: isOccupiedByOther
  };
})();
