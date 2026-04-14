// ──────── GATE DRAWING HELPER ────────
function drawGateBody(c, type, color) {
  c.strokeStyle = color; c.lineWidth = 2; c.fillStyle = color;
  if (type === 'NOT') {
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(-14, 0); c.stroke();
  } else {
    c.beginPath(); c.moveTo(-30, -10); c.lineTo(-14, -10); c.moveTo(-30, 10); c.lineTo(-14, 10); c.stroke();
  }
  c.beginPath();
  if (type === 'AND' || type === 'NAND') {
    c.moveTo(-14, -16); c.lineTo(-14, 16); c.arc(0, 0, 16, Math.PI*0.5, -Math.PI*0.5, true); c.closePath();
  } else if (type === 'OR' || type === 'NOR' || type === 'XOR') {
    c.moveTo(-14, -16); c.quadraticCurveTo(4, -16, 18, 0);
    c.quadraticCurveTo(4, 16, -14, 16); c.quadraticCurveTo(-6, 0, -14, -16);
  } else {
    c.moveTo(-14, -14); c.lineTo(-14, 14); c.lineTo(12, 0); c.closePath();
  }
  c.stroke();
  if (type === 'NAND' || type === 'NOR' || type === 'NOT') {
    var bx = (type === 'NOT') ? 15 : 19;
    c.beginPath(); c.arc(bx, 0, 3, 0, Math.PI*2); c.stroke();
  }
  if (type === 'XOR') {
    c.beginPath(); c.moveTo(-18, -16); c.quadraticCurveTo(-10, 0, -18, 16); c.stroke();
  }
  var ox = (type === 'NAND' || type === 'NOR') ? 22 : (type === 'NOT' ? 18 : 18);
  c.beginPath(); c.moveTo(ox, 0); c.lineTo(30, 0); c.stroke();
  c.font = '600 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  var lbl = {'AND':'&','OR':'\u22651','NOT':'1','NAND':'&','NOR':'\u22651','XOR':'=1'}[type]||'';
  c.fillText(lbl, (type==='NOT')?-2:2, 0);
}

// ──────── COMPONENT DEFINITIONS ────────
var COMP = {
  resistor: {
    name: 'Resistor', en: 'R', color: '#00e09e', unit: '\u03A9', def: 1000, key: '1', cat: 'Passive',
    pins: [{ dx: -40, dy: 0 }, { dx: 40, dy: 0 }],
    pinNames: ['1', '2'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      if (S.symbolStd === 'ANSI') {
        // ANSI zigzag
        c.beginPath(); c.moveTo(-40, 0); c.lineTo(-24, 0);
        for (var i = 0; i < 6; i++) { c.lineTo(-20 + i * 8, i % 2 ? 8 : -8); }
        c.lineTo(24, 0); c.lineTo(40, 0); c.stroke();
      } else {
        // IEC rectangle
        c.beginPath(); c.moveTo(-40, 0); c.lineTo(-20, 0); c.stroke();
        c.strokeRect(-20, -8, 40, 16);
        c.beginPath(); c.moveTo(20, 0); c.lineTo(40, 0); c.stroke();
      }
    }
  },
  capacitor: {
    name: 'Capacitor', en: 'C', color: '#3b82f6', unit: 'F', def: 1e-6, key: '2', cat: 'Passive',
    pins: [{ dx: -40, dy: 0 }, { dx: 40, dy: 0 }],
    pinNames: ['+', '-'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-6, 0); c.stroke();
      c.beginPath(); c.moveTo(-6, -14); c.lineTo(-6, 14); c.stroke();
      if (S.symbolStd === 'ANSI') {
        // ANSI: curved plate (arc)
        c.beginPath(); c.arc(14, 0, 16, Math.PI * 0.6, Math.PI * 1.4, true); c.stroke();
      } else {
        // IEC: two straight plates
        c.beginPath(); c.moveTo(6, -14); c.lineTo(6, 14); c.stroke();
      }
      c.beginPath(); c.moveTo(6, 0); c.lineTo(40, 0); c.stroke();
    }
  },
  inductor: {
    name: 'Inductor', en: 'L', color: '#a855f7', unit: 'H', def: 0.01, key: '3', cat: 'Passive',
    pins: [{ dx: -40, dy: 0 }, { dx: 40, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-24, 0); c.stroke();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-18 + i * 12, 0, 6, Math.PI, 0, false); c.stroke(); }
      c.beginPath(); c.moveTo(24, 0); c.lineTo(40, 0); c.stroke();
    }
  },
  vdc: {
    name: 'DC Source', en: 'V', color: '#22c55e', unit: 'V', def: 5, key: '4', cat: 'Sources',
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.font = 'bold 12px "JetBrains Mono"'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('+', 0, -7); c.fillText('\u2212', 0, 8);
    }
  },
  vac: {
    name: 'AC Source', en: 'V~', color: '#06b6d4', unit: 'V', def: 5, key: '5', cat: 'Sources', freq: 50,
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.lineWidth = 1.5; c.beginPath();
      for (let i = -10; i <= 10; i++) { const t = i / 10 * Math.PI; c.lineTo(i * 0.9, Math.sin(t) * 6); }
      c.stroke();
    }
  },
  pulse: {
    name: 'Darbe Kaynağı', en: 'Pulse', color: '#ec4899', unit: 'V', def: 5, cat: 'Sources',
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.lineWidth = 1.5; c.beginPath();
      c.moveTo(-8, 4); c.lineTo(-4, 4); c.lineTo(-4, -4); c.lineTo(4, -4); c.lineTo(4, 4); c.lineTo(8, 4);
      c.stroke();
    }
  },
  pwl: {
    name: 'PWL Kaynağı', en: 'PWL', color: '#ec4899', unit: 'V', def: 5, cat: 'Sources',
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.lineWidth = 1.5; c.beginPath();
      c.moveTo(-8, 4); c.lineTo(-4, -2); c.lineTo(0, 4); c.lineTo(4, -4); c.lineTo(8, 2);
      c.stroke();
    }
  },
  iac: {
    name: 'AC Akım', en: 'I~', color: '#eab308', unit: 'A', def: 0.01, cat: 'Sources', freq: 50,
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.beginPath(); c.moveTo(0, -10); c.lineTo(0, 10); c.stroke();
      c.beginPath(); c.moveTo(0, -10); c.lineTo(-3, -5); c.moveTo(0, -10); c.lineTo(3, -5); c.stroke();
      c.lineWidth = 1; c.beginPath();
      c.moveTo(7, -4); c.quadraticCurveTo(10, -8, 13, -4); c.quadraticCurveTo(10, 0, 7, -4);
      c.stroke();
    }
  },
  noise: {
    name: 'Gürültü', en: 'Noise', color: '#8899aa', unit: 'V', def: 0.1, cat: 'Sources',
    pins: [{ dx: 0, dy: -40 }, { dx: 0, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -18); c.stroke();
      c.beginPath(); c.arc(0, 0, 18, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 40); c.stroke();
      c.lineWidth = 1; c.beginPath();
      for (var i = -8; i <= 8; i += 2) c.lineTo(i, (Math.random()-0.5)*12);
      c.stroke();
    }
  },
  vcvs: {
    name: 'VCVS (E)', en: 'E', color: '#00e09e', unit: '', def: 10, cat: 'Sources',
    pins: [{ dx: -40, dy: -15 }, { dx: -40, dy: 15 }, { dx: 40, dy: -15 }, { dx: 40, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(18, 0); c.lineTo(0, 18); c.lineTo(-18, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(-18, -8); c.moveTo(-40, 15); c.lineTo(-18, 8); c.stroke();
      c.beginPath(); c.moveTo(18, -8); c.lineTo(40, -15); c.moveTo(18, 8); c.lineTo(40, 15); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('E', 0, 3);
      c.font = '7px sans-serif'; c.fillText('+', -25, -12); c.fillText('\u2212', -25, 18);
      c.fillText('+', 25, -12); c.fillText('\u2212', 25, 18);
    }
  },
  vccs: {
    name: 'VCCS (G)', en: 'G', color: '#3b82f6', unit: 'S', def: 0.001, cat: 'Sources',
    pins: [{ dx: -40, dy: -15 }, { dx: -40, dy: 15 }, { dx: 40, dy: -15 }, { dx: 40, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(18, 0); c.lineTo(0, 18); c.lineTo(-18, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(-18, -8); c.moveTo(-40, 15); c.lineTo(-18, 8); c.stroke();
      c.beginPath(); c.moveTo(18, -8); c.lineTo(40, -15); c.moveTo(18, 8); c.lineTo(40, 15); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.fillText('G', 0, 3);
    }
  },
  ccvs: {
    name: 'CCVS (H)', en: 'H', color: '#f59e0b', unit: '\u03A9', def: 1000, cat: 'Sources',
    pins: [{ dx: -40, dy: -15 }, { dx: -40, dy: 15 }, { dx: 40, dy: -15 }, { dx: 40, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(18, 0); c.lineTo(0, 18); c.lineTo(-18, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(-18, -8); c.moveTo(-40, 15); c.lineTo(-18, 8); c.stroke();
      c.beginPath(); c.moveTo(18, -8); c.lineTo(40, -15); c.moveTo(18, 8); c.lineTo(40, 15); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.fillText('H', 0, 3);
    }
  },
  cccs: {
    name: 'CCCS (F)', en: 'F', color: '#a855f7', unit: '', def: 10, cat: 'Sources',
    pins: [{ dx: -40, dy: -15 }, { dx: -40, dy: 15 }, { dx: 40, dy: -15 }, { dx: 40, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(18, 0); c.lineTo(0, 18); c.lineTo(-18, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(-18, -8); c.moveTo(-40, 15); c.lineTo(-18, 8); c.stroke();
      c.beginPath(); c.moveTo(18, -8); c.lineTo(40, -15); c.moveTo(18, 8); c.lineTo(40, 15); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.fillText('F', 0, 3);
    }
  },
  diode: {
    name: 'Diode', en: 'D', color: '#f0454a', unit: '', def: 0, key: '6', cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.fillStyle = this.color;
      c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, 0); c.lineTo(-10, 10); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(10, -10); c.lineTo(10, 10); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  led: {
    name: 'LED', en: 'LED', color: '#eab308', unit: '', def: 0, key: '7', cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.fillStyle = this.color;
      c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, 0); c.lineTo(-10, 10); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(10, -10); c.lineTo(10, 10); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
      // light arrows
      c.lineWidth = 1;
      const ax = [4, 10]; ax.forEach(bx => {
        c.beginPath(); c.moveTo(bx, -14); c.lineTo(bx + 6, -22); c.stroke();
        c.beginPath(); c.moveTo(bx + 6, -22); c.lineTo(bx + 3, -19); c.stroke();
        c.beginPath(); c.moveTo(bx + 6, -22); c.lineTo(bx + 5, -18); c.stroke();
      });
    }
  },
  ground: {
    name: 'Ground', en: 'GND', color: '#8899aa', unit: '', def: 0, key: '8', cat: 'Basic',
    pins: [{ dx: 0, dy: -20 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 0); c.stroke();
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.stroke();
      c.beginPath(); c.moveTo(-9, 6); c.lineTo(9, 6); c.stroke();
      c.beginPath(); c.moveTo(-4, 12); c.lineTo(4, 12); c.stroke();
    }
  },
  switch: {
    name: 'Switch', en: 'SW', color: '#f59e0b', unit: '', def: 0, key: '9', cat: 'Basic',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c, g, part) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.arc(-10, 0, 3, 0, Math.PI * 2); c.stroke();
      if (part && part.closed) { c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke(); }
      else { c.beginPath(); c.moveTo(-7, -1); c.lineTo(8, -16); c.stroke(); }
      c.beginPath(); c.arc(10, 0, 3, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(13, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  npn: {
    name: 'NPN Transistör', en: 'NPN', color: '#a855f7', unit: '', def: 100, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    pinNames: ['B', 'C', 'E'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-8, 0); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(20, -28); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-8, 8); c.lineTo(20, 28); c.lineTo(20, 40); c.stroke();
      var ax = 10, ay = 20;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 6, ay - 2); c.lineTo(ax - 2, ay - 6); c.closePath();
      c.fillStyle = this.color; c.fill();
    }
  },
  pnp: {
    name: 'PNP Transistör', en: 'PNP', color: '#a855f7', unit: '', def: 100, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    pinNames: ['B', 'C', 'E'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-8, 0); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(20, -28); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-8, 8); c.lineTo(20, 28); c.lineTo(20, 40); c.stroke();
      var ax = 0, ay = 4;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + 6, ay + 2); c.lineTo(ax + 2, ay + 6); c.closePath();
      c.fillStyle = this.color; c.fill();
    }
  },
  nmos: {
    name: 'N-MOSFET', en: 'NMOS', color: '#a855f7', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    pinNames: ['G', 'D', 'S'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-12, 0); c.stroke();
      c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-12, -16); c.lineTo(-12, 16); c.stroke();
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-4, -16); c.lineTo(-4, -6); c.lineTo(20, -6); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-4, 16); c.lineTo(-4, 6); c.lineTo(20, 6); c.lineTo(20, 40); c.stroke();
      c.beginPath(); c.moveTo(-4, -6); c.lineTo(-4, 6); c.stroke();
      c.beginPath(); c.moveTo(4, 6); c.lineTo(-2, 3); c.lineTo(-2, 9); c.closePath(); c.fillStyle = this.color; c.fill();
    }
  },
  pmos: {
    name: 'P-MOSFET', en: 'PMOS', color: '#a855f7', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    pinNames: ['G', 'S', 'D'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-12, 0); c.stroke();
      c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-12, -16); c.lineTo(-12, 16); c.stroke();
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-4, -16); c.lineTo(-4, -6); c.lineTo(20, -6); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-4, 16); c.lineTo(-4, 6); c.lineTo(20, 6); c.lineTo(20, 40); c.stroke();
      c.beginPath(); c.moveTo(-4, -6); c.lineTo(-4, 6); c.stroke();
      c.beginPath(); c.moveTo(8, 6); c.lineTo(14, 3); c.lineTo(14, 9); c.closePath(); c.fillStyle = this.color; c.fill();
      c.beginPath(); c.arc(-15, 0, 3, 0, Math.PI*2); c.stroke();
    }
  },
  opamp: {
    name: 'Op-Amp', en: 'OpAmp', color: '#f59e0b', unit: '', def: 100000, cat: 'ICs',
    pins: [{ dx: -40, dy: -15 }, { dx: -40, dy: 15 }, { dx: 40, dy: 0 }],
    pinNames: ['+', '-', 'OUT'],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-20, -28); c.lineTo(-20, 28); c.lineTo(25, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -15); c.lineTo(-20, -15); c.stroke();
      c.font = 'bold 12px sans-serif'; c.fillStyle = this.color;
      c.fillText('+', -17, -11);
      c.beginPath(); c.moveTo(-40, 15); c.lineTo(-20, 15); c.stroke();
      c.fillText('\u2212', -18, 19);
      c.beginPath(); c.moveTo(25, 0); c.lineTo(40, 0); c.stroke();
    }
  },
  zener: {
    name: 'Zener Diyot', en: 'Zener', color: '#ec4899', unit: 'V', def: 5.1, cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      var s = 10;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-s, 0); c.stroke();
      c.beginPath(); c.moveTo(-s, -s); c.lineTo(-s, s); c.lineTo(s, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(s, -s); c.lineTo(s, s); c.stroke();
      c.beginPath(); c.moveTo(s, -s); c.lineTo(s+4, -s-3); c.stroke();
      c.beginPath(); c.moveTo(s, s); c.lineTo(s-4, s+3); c.stroke();
      c.beginPath(); c.moveTo(s, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  vreg: {
    name: 'Regülatör (7805)', en: '7805', color: '#22c55e', unit: 'V', def: 5, cat: 'ICs',
    pins: [{ dx: -40, dy: 0 }, { dx: 40, dy: 0 }, { dx: 0, dy: 30 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.strokeRect(-20, -14, 40, 28);
      c.font = '600 9px "JetBrains Mono"'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('7805', 0, 3);
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-20, 0); c.stroke();
      c.beginPath(); c.moveTo(20, 0); c.lineTo(40, 0); c.stroke();
      c.beginPath(); c.moveTo(0, 14); c.lineTo(0, 30); c.stroke();
    }
  },
  and: {
    name: 'VE Kapısı', en: 'AND', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'AND', this.color); }
  },
  or: {
    name: 'VEYA Kapısı', en: 'OR', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'OR', this.color); }
  },
  not: {
    name: 'DEĞİL Kapısı', en: 'NOT', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'NOT', this.color); }
  },
  nand: {
    name: 'VE-DEĞİL', en: 'NAND', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'NAND', this.color); }
  },
  nor: {
    name: 'VEYA-DEĞİL', en: 'NOR', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'NOR', this.color); }
  },
  xor: {
    name: 'ÖZEL VEYA', en: 'XOR', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) { drawGateBody(c, 'XOR', this.color); }
  },
  transformer: {
    name: 'Trafo', en: 'Transformer', color: '#a855f7', unit: '', def: 10, cat: 'Control',
    pins: [{ dx: -30, dy: -20 }, { dx: -30, dy: 20 }, { dx: 30, dy: -20 }, { dx: 30, dy: 20 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(-10, -12+i*12, 6, Math.PI*1.5, Math.PI*0.5); c.stroke(); }
      for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(10, -12+i*12, 6, Math.PI*0.5, Math.PI*1.5); c.stroke(); }
      c.beginPath(); c.moveTo(-2, -22); c.lineTo(-2, 22); c.moveTo(2, -22); c.lineTo(2, 22); c.stroke();
      c.beginPath(); c.moveTo(-30, -20); c.lineTo(-16, -20); c.moveTo(-30, 20); c.lineTo(-16, 20); c.stroke();
      c.beginPath(); c.moveTo(30, -20); c.lineTo(16, -20); c.moveTo(30, 20); c.lineTo(16, 20); c.stroke();
    }
  },
  relay: {
    name: 'Röle', en: 'Relay', color: '#f59e0b', unit: '', def: 0.05, cat: 'Control',
    pins: [{ dx: -30, dy: -15 }, { dx: -30, dy: 15 }, { dx: 30, dy: -15 }, { dx: 30, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.strokeRect(-20, -20, 16, 40);
      c.font = '8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.fillText('~', -12, 3);
      c.beginPath(); c.moveTo(-30, -15); c.lineTo(-20, -15); c.moveTo(-30, 15); c.lineTo(-20, 15); c.stroke();
      c.beginPath(); c.moveTo(30, 15); c.lineTo(10, 15); c.stroke();
      c.beginPath(); c.arc(10, 15, 2, 0, Math.PI*2); c.fill();
      c.beginPath(); c.arc(10, -15, 2, 0, Math.PI*2); c.fill();
      c.beginPath(); c.moveTo(10, 15); c.lineTo(8, -10); c.stroke();
      c.beginPath(); c.moveTo(10, -15); c.lineTo(30, -15); c.stroke();
    }
  },
  fuse: {
    name: 'Sigorta', en: 'Fuse', color: '#f0454a', unit: 'A', def: 1, cat: 'Control',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeRect(-12, -6, 24, 12);
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke();
      c.beginPath(); c.moveTo(12, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  ammeter: {
    name: 'Ampermetre', en: 'Ammeter', color: '#3b82f6', unit: 'A', def: 0, cat: 'ICs',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-14, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 14, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(14, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 12px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('A', 0, 1);
    }
  },
  voltmeter: {
    name: 'Voltmetre', en: 'Voltmeter', color: '#00e09e', unit: 'V', def: 0, cat: 'ICs',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-14, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 14, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(14, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 12px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('V', 0, 1);
    }
  },
  schottky: {
    name: 'Schottky Diyot', en: 'Schottky', color: '#f59e0b', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      var s = 10;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-s, 0); c.stroke();
      c.beginPath(); c.moveTo(-s, -s); c.lineTo(-s, s); c.lineTo(s, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(s-2, -s); c.lineTo(s, -s); c.lineTo(s, s); c.lineTo(s+2, s); c.stroke();
      c.beginPath(); c.moveTo(s, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  njfet: {
    name: 'N-JFET', en: 'NJFET', color: '#a855f7', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-8, 0); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, -10); c.lineTo(20, -10); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-8, 10); c.lineTo(20, 10); c.lineTo(20, 40); c.stroke();
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(-8, -4); c.lineTo(-8, 4); c.closePath(); c.fillStyle = this.color; c.fill();
    }
  },
  pjfet: {
    name: 'P-JFET', en: 'PJFET', color: '#a855f7', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-8, 0); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, -10); c.lineTo(20, -10); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-8, 10); c.lineTo(20, 10); c.lineTo(20, 40); c.stroke();
      c.beginPath(); c.moveTo(-2, 0); c.lineTo(-8, -4); c.lineTo(-8, 4); c.closePath(); c.fillStyle = this.color; c.fill();
    }
  },
  igbt: {
    name: 'IGBT', en: 'IGBT', color: '#a855f7', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -40, dy: 0 }, { dx: 20, dy: -40 }, { dx: 20, dy: 40 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-12, 0); c.stroke();
      c.lineWidth = 2.5; c.beginPath(); c.moveTo(-12, -16); c.lineTo(-12, 16); c.stroke();
      c.lineWidth = 1; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-8, 16); c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(20, -10); c.lineTo(20, -40); c.stroke();
      c.beginPath(); c.moveTo(-4, 10); c.lineTo(20, 10); c.lineTo(20, 40); c.stroke();
      c.beginPath(); c.moveTo(8, 10); c.lineTo(2, 7); c.lineTo(2, 13); c.closePath(); c.fillStyle = this.color; c.fill();
      c.font = '600 7px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.fillText('IGBT', 0, -20);
    }
  },
  scr: {
    name: 'Tristör (SCR)', en: 'SCR', color: '#f0454a', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }, { dx: 0, dy: 30 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.moveTo(-10, -10); c.lineTo(-10, 10); c.lineTo(10, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(10, -10); c.lineTo(10, 10); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
      c.beginPath(); c.moveTo(0, 5); c.lineTo(0, 30); c.stroke();
    }
  },
  triac: {
    name: 'TRIAC', en: 'TRIAC', color: '#f0454a', unit: '', def: 0, cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }, { dx: 0, dy: 30 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(-8, 8); c.lineTo(8, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(8, -8); c.lineTo(8, 8); c.lineTo(-8, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
      c.beginPath(); c.moveTo(0, 5); c.lineTo(0, 30); c.stroke();
    }
  },
  diac: {
    name: 'DIAC', en: 'DIAC', color: '#f0454a', unit: 'V', def: 30, cat: 'Semi',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-8, 0); c.stroke();
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(-8, 8); c.lineTo(8, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(8, -8); c.lineTo(8, 8); c.lineTo(-8, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(8, 0); c.lineTo(30, 0); c.stroke();
    }
  },
  dff: {
    name: 'D Flip-Flop', en: 'DFF', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -12 }, { dx: -30, dy: 12 }, { dx: 30, dy: -12 }, { dx: 30, dy: 12 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.strokeRect(-18, -20, 36, 40);
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('D', -10, -8); c.fillText('Q', 10, -8);
      c.fillText('>', -10, 16); c.fillText('Q\u0305', 10, 16);
      c.beginPath(); c.moveTo(-30,-12); c.lineTo(-18,-12); c.moveTo(-30,12); c.lineTo(-18,12); c.stroke();
      c.beginPath(); c.moveTo(18,-12); c.lineTo(30,-12); c.moveTo(18,12); c.lineTo(30,12); c.stroke();
    }
  },
  counter: {
    name: 'Sayıcı (4-bit)', en: 'Counter', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: -15 }, { dx: 30, dy: -5 }, { dx: 30, dy: 5 }, { dx: 30, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.strokeRect(-18, -22, 36, 44);
      c.font = '600 7px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('CLK', -8, 3); c.fillText('CTR', 0, -14);
      c.fillText('Q0', 12, -12); c.fillText('Q1', 12, -2); c.fillText('Q2', 12, 8); c.fillText('Q3', 12, 18);
      c.beginPath(); c.moveTo(-30,0); c.lineTo(-18,0); c.stroke();
      for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(18,-15+i*10); c.lineTo(30,-15+i*10); c.stroke(); }
    }
  },
  shiftreg: {
    name: 'Kaydırıcı', en: 'Shift Reg', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.strokeRect(-18, -18, 36, 36);
      c.font = '600 7px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('D', -10, -6); c.fillText('>', -10, 14); c.fillText('SR', 0, -12); c.fillText('Q', 10, 3);
      c.beginPath(); c.moveTo(-30,-10); c.lineTo(-18,-10); c.moveTo(-30,10); c.lineTo(-18,10); c.stroke();
      c.beginPath(); c.moveTo(18,0); c.lineTo(30,0); c.stroke();
    }
  },
  mux: {
    name: 'Çoklayıcı (2:1)', en: 'MUX', color: '#06b6d4', unit: '', def: 0, cat: 'Logic',
    pins: [{ dx: -30, dy: -10 }, { dx: -30, dy: 10 }, { dx: 0, dy: 20 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-14, -20); c.lineTo(-14, 20); c.lineTo(14, 12); c.lineTo(14, -12); c.closePath(); c.stroke();
      c.font = '600 7px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('0', -8, -6); c.fillText('1', -8, 14); c.fillText('S', 2, 22);
      c.beginPath(); c.moveTo(-30,-10); c.lineTo(-14,-10); c.moveTo(-30,10); c.lineTo(-14,10); c.stroke();
      c.beginPath(); c.moveTo(0,20); c.lineTo(0,14); c.stroke();
      c.beginPath(); c.moveTo(14,0); c.lineTo(30,0); c.stroke();
    }
  },
  wattmeter: {
    name: 'Wattmetre', en: 'Wattmeter', color: '#f59e0b', unit: 'W', def: 0, cat: 'ICs',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-14, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 14, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(14, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 12px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('W', 0, 1);
    }
  },
  diffprobe: {
    name: 'Dif. Probe', en: 'Diff Probe', color: '#ec4899', unit: 'V', def: 0, cat: 'ICs',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 9px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('\u0394V', 0, 1);
    }
  },
  iprobe: {
    name: 'Akım Probu', en: 'I Probe', color: '#3b82f6', unit: 'A', def: 0, cat: 'ICs',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(10, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 9px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('I', 0, 1);
    }
  },
  potentiometer: {
    name: 'Potansiyometre', en: 'Pot', color: '#00e09e', unit: '\u03A9', def: 10000, cat: 'Passive',
    pins: [{ dx: -40, dy: 0 }, { dx: 0, dy: -25 }, { dx: 40, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(-24, 0);
      var segs=6, segW=48/segs, amp=8;
      for(var i=0;i<segs;i++) c.lineTo(-24+(i+0.5)*segW, i%2===0?-amp:amp);
      c.lineTo(40, 0); c.stroke();
      c.beginPath(); c.moveTo(0, -25); c.lineTo(0, -8); c.stroke();
      c.beginPath(); c.moveTo(-4, -12); c.lineTo(0, -6); c.lineTo(4, -12); c.closePath(); c.fillStyle = this.color; c.fill();
    }
  },
  ntc: {
    name: 'NTC Termist\u00f6r', en: 'NTC', color: '#f59e0b', unit: '\u03A9', def: 10000, cat: 'Passive',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeRect(-12, -8, 24, 16);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('t\u00B0', 0, 3);
      c.beginPath(); c.moveTo(-8, 6); c.lineTo(8, -6); c.stroke();
    }
  },
  ptc: {
    name: 'PTC Termist\u00f6r', en: 'PTC', color: '#f59e0b', unit: '\u03A9', def: 100, cat: 'Passive',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeRect(-12, -8, 24, 16);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 8px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('t\u00B0', 0, 3);
      c.beginPath(); c.moveTo(-8, -6); c.lineTo(8, 6); c.stroke();
    }
  },
  ldr: {
    name: 'LDR', en: 'LDR', color: '#eab308', unit: '\u03A9', def: 10000, cat: 'Passive',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeRect(-12, -8, 24, 16);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(30, 0); c.stroke();
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-8, -14); c.lineTo(-4, -10); c.stroke();
      c.beginPath(); c.moveTo(-4, -16); c.lineTo(0, -12); c.stroke();
      c.beginPath(); c.moveTo(-6, -14); c.lineTo(-8, -12); c.lineTo(-6, -10); c.stroke();
      c.beginPath(); c.moveTo(-2, -16); c.lineTo(-4, -14); c.lineTo(-2, -12); c.stroke();
    }
  },
  varistor: {
    name: 'Varist\u00f6r (MOV)', en: 'MOV', color: '#f0454a', unit: 'V', def: 200, cat: 'Passive',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeRect(-12, -8, 24, 16);
      c.beginPath(); c.moveTo(12, 0); c.lineTo(30, 0); c.stroke();
      c.font = '600 7px sans-serif'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('MOV', 0, 3);
    }
  },
  comparator: {
    name: 'Komparatör', en: 'Comparator', color: '#22c55e', unit: '', def: 0, cat: 'Mixed',
    pins: [
      { dx: -30, dy: -12 },   // Pin 0: V+ (non-inverting)
      { dx: -30, dy: 12 },    // Pin 1: V- (inverting)
      { dx: 30, dy: 0 },      // Pin 2: OUT (dijital)
      { dx: 0, dy: -25 },     // Pin 3: VCC
      { dx: 0, dy: 25 }       // Pin 4: GND
    ],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 1.5;
      // Op-amp benzeri üçgen
      c.beginPath();
      c.moveTo(-20, -25); c.lineTo(20, 0); c.lineTo(-20, 25); c.closePath();
      c.fillStyle = '#1a2a1a'; c.fill(); c.stroke();
      // + ve - işaretleri
      c.fillStyle = '#aaffaa';
      c.font = 'bold 10px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('+', -12, -10); c.fillText('\u2212', -12, 10);
      // Pin çizgileri
      c.strokeStyle = '#aaaaaa'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-20, -12); c.lineTo(-30, -12); c.stroke();
      c.beginPath(); c.moveTo(-20, 12); c.lineTo(-30, 12); c.stroke();
      c.beginPath(); c.moveTo(20, 0); c.lineTo(30, 0); c.stroke();
      c.beginPath(); c.moveTo(0, -16); c.lineTo(0, -25); c.stroke();
      c.beginPath(); c.moveTo(0, 16); c.lineTo(0, 25); c.stroke();
    }
  },
  crystal: {
    name: 'Kristal', en: 'Crystal', color: '#06b6d4', unit: 'Hz', def: 32768, cat: 'Passive',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30,0); c.lineTo(-10,0); c.stroke();
      c.beginPath(); c.moveTo(-10,-10); c.lineTo(-10,10); c.stroke();
      c.beginPath(); c.moveTo(10,-10); c.lineTo(10,10); c.stroke();
      c.strokeRect(-6, -8, 12, 16);
      c.beginPath(); c.moveTo(10,0); c.lineTo(30,0); c.stroke();
    }
  },
  coupled_l: {
    name: 'Ba\u011fl\u0131 Bobbin', en: 'Coupled L', color: '#a855f7', unit: '', def: 0.5, cat: 'Passive',
    pins: [{ dx: -30, dy: -15 }, { dx: -30, dy: 15 }, { dx: 30, dy: -15 }, { dx: 30, dy: 15 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      for(var i=0;i<3;i++){c.beginPath();c.arc(-10,-10+i*10,5,Math.PI,0);c.stroke();}
      for(var i=0;i<3;i++){c.beginPath();c.arc(10,-10+i*10,5,0,Math.PI);c.stroke();}
      c.fillStyle=this.color; c.beginPath(); c.arc(-10,-18,2,0,Math.PI*2); c.fill();
      c.beginPath(); c.arc(10,-18,2,0,Math.PI*2); c.fill();
      c.beginPath(); c.moveTo(-30,-15); c.lineTo(-15,-15); c.moveTo(-30,15); c.lineTo(-15,15); c.stroke();
      c.beginPath(); c.moveTo(15,-15); c.lineTo(30,-15); c.moveTo(15,15); c.lineTo(30,15); c.stroke();
    }
  },
  dcmotor: {
    name: 'DC Motor', en: 'DC Motor', color: '#22c55e', unit: '', def: 0, cat: 'Control',
    pins: [{ dx: -30, dy: 0 }, { dx: 30, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-30,0); c.lineTo(-14,0); c.stroke();
      c.beginPath(); c.arc(0,0,14,0,Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(14,0); c.lineTo(30,0); c.stroke();
      c.font='600 12px sans-serif'; c.fillStyle=this.color; c.textAlign='center'; c.textBaseline='middle';
      c.fillText('M',0,1);
    }
  },
  tline: {
    name: '\u0130letim Hatt\u0131', en: 'T-Line', color: '#3b82f6', unit: '\u03A9', def: 50, cat: 'Passive',
    pins: [{ dx: -40, dy: -10 }, { dx: -40, dy: 10 }, { dx: 40, dy: -10 }, { dx: 40, dy: 10 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-40,-10); c.lineTo(-20,-10); c.moveTo(-40,10); c.lineTo(-20,10); c.stroke();
      c.beginPath(); c.moveTo(-20,-10); c.lineTo(20,-10); c.stroke();
      c.beginPath(); c.moveTo(-20,10); c.lineTo(20,10); c.stroke();
      c.font='600 8px "JetBrains Mono"'; c.fillStyle=this.color; c.textAlign='center';
      c.fillText('Z\u2080',0,2);
      c.beginPath(); c.moveTo(20,-10); c.lineTo(40,-10); c.moveTo(20,10); c.lineTo(40,10); c.stroke();
    }
  },
  // Sprint 9: Net Labels
  netLabel: {
    name: 'Net Label', en: 'NET', color: '#00d4ff', unit: '', def: 0, key: 'N', cat: 'Basic',
    pins: [{ dx: -20, dy: 0 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-20, 0); c.lineTo(-8, 0); c.lineTo(-4, -6); c.lineTo(8, -6); c.lineTo(8, 6); c.lineTo(-4, 6); c.lineTo(-8, 0); c.stroke();
      c.font = 'bold 9px "JetBrains Mono"'; c.fillStyle = this.color; c.textAlign = 'left';
    }
  },
  vccLabel: {
    name: 'VCC', en: 'VCC', color: '#f85149', unit: '', def: 0, cat: 'Basic',
    pins: [{ dx: 0, dy: 20 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 20); c.lineTo(0, 4); c.stroke();
      c.beginPath(); c.moveTo(-8, 4); c.lineTo(0, -6); c.lineTo(8, 4); c.closePath(); c.stroke();
      c.font = 'bold 9px "JetBrains Mono"'; c.fillStyle = this.color; c.textAlign = 'center';
      c.fillText('VCC', 0, -10);
    }
  },
  gndLabel: {
    name: 'GND Label', en: 'GNDL', color: '#8b949e', unit: '', def: 0, cat: 'Basic',
    pins: [{ dx: 0, dy: -20 }],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 0); c.stroke();
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
      c.beginPath(); c.moveTo(-6, 5); c.lineTo(6, 5); c.stroke();
      c.beginPath(); c.moveTo(-2, 10); c.lineTo(2, 10); c.stroke();
    }
  },
  // Sprint 18: Mixed-Signal Components
  adc: {
    name: 'ADC (8-bit)', en: 'ADC', color: '#06d6a0', unit: '', def: 0, cat: 'Mixed',
    pins: [
      { dx: -40, dy: 0 },     // Pin 0: AIN
      { dx: -40, dy: -20 },   // Pin 1: VREF+
      { dx: -40, dy: 20 },    // Pin 2: GND
      { dx: 40, dy: -35 },    // Pin 3: D0 (LSB)
      { dx: 40, dy: -25 },    // Pin 4: D1
      { dx: 40, dy: -15 },    // Pin 5: D2
      { dx: 40, dy: -5 },     // Pin 6: D3
      { dx: 40, dy: 5 },      // Pin 7: D4
      { dx: 40, dy: 15 },     // Pin 8: D5
      { dx: 40, dy: 25 },     // Pin 9: D6
      { dx: 40, dy: 35 },     // Pin 10: D7 (MSB)
      { dx: -40, dy: -35 }    // Pin 11: CLK
    ],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 1.5;
      c.fillStyle = '#1a2a3a';
      c.fillRect(-30, -40, 60, 80);
      c.strokeRect(-30, -40, 60, 80);
      c.fillStyle = '#aaddff';
      c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('ADC', 0, -6);
      c.font = '7px monospace';
      c.fillText('8-bit', 0, 6);
      c.strokeStyle = '#ffaa44'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-30, 0); c.lineTo(-40, 0); c.stroke();
      c.beginPath(); c.moveTo(-30, -20); c.lineTo(-40, -20); c.stroke();
      c.beginPath(); c.moveTo(-30, 20); c.lineTo(-40, 20); c.stroke();
      c.beginPath(); c.moveTo(-30, -35); c.lineTo(-40, -35); c.stroke();
      c.strokeStyle = '#44ff44';
      for (var i = 0; i < 8; i++) {
        var py = -35 + i * 10;
        c.beginPath(); c.moveTo(30, py); c.lineTo(40, py); c.stroke();
      }
    }
  },
  dac: {
    name: 'DAC (8-bit)', en: 'DAC', color: '#b388ff', unit: '', def: 0, cat: 'Mixed',
    pins: [
      { dx: -40, dy: -35 },   // Pin 0: D0 (LSB)
      { dx: -40, dy: -25 },   // Pin 1: D1
      { dx: -40, dy: -15 },   // Pin 2: D2
      { dx: -40, dy: -5 },    // Pin 3: D3
      { dx: -40, dy: 5 },     // Pin 4: D4
      { dx: -40, dy: 15 },    // Pin 5: D5
      { dx: -40, dy: 25 },    // Pin 6: D6
      { dx: -40, dy: 35 },    // Pin 7: D7 (MSB)
      { dx: 40, dy: 0 },      // Pin 8: AOUT
      { dx: 40, dy: -20 },    // Pin 9: VREF+
      { dx: 40, dy: 20 }      // Pin 10: GND
    ],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 1.5;
      c.fillStyle = '#2a1a3a';
      c.fillRect(-30, -40, 60, 80);
      c.strokeRect(-30, -40, 60, 80);
      c.fillStyle = '#ddaaff';
      c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('DAC', 0, -6);
      c.font = '7px monospace';
      c.fillText('8-bit', 0, 6);
      c.strokeStyle = '#44ff44'; c.lineWidth = 1;
      for (var i = 0; i < 8; i++) {
        var py = -35 + i * 10;
        c.beginPath(); c.moveTo(-30, py); c.lineTo(-40, py); c.stroke();
      }
      c.strokeStyle = '#ffaa44';
      c.beginPath(); c.moveTo(30, 0); c.lineTo(40, 0); c.stroke();
      c.beginPath(); c.moveTo(30, -20); c.lineTo(40, -20); c.stroke();
      c.beginPath(); c.moveTo(30, 20); c.lineTo(40, 20); c.stroke();
    }
  },
  pwmGen: {
    name: 'PWM \u00dcreteci', en: 'PWM', color: '#ffd166', unit: '', def: 0, cat: 'Mixed',
    pins: [
      { dx: -30, dy: 0 },     // Pin 0: CTRL
      { dx: 30, dy: 0 },      // Pin 1: OUT
      { dx: 0, dy: -20 },     // Pin 2: VCC
      { dx: 0, dy: 20 }       // Pin 3: GND
    ],
    draw(c) {
      c.strokeStyle = this.color; c.lineWidth = 1.5;
      c.fillStyle = '#2a2a1a';
      c.fillRect(-25, -18, 50, 36);
      c.strokeRect(-25, -18, 50, 36);
      c.strokeStyle = '#ffff44'; c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-12, 8); c.lineTo(-12, -4); c.lineTo(0, -4); c.lineTo(0, 8); c.lineTo(12, 8);
      c.stroke();
      c.fillStyle = '#ffffaa';
      c.font = '7px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('PWM', 0, -12);
      c.strokeStyle = '#aaaaaa'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-25, 0); c.lineTo(-30, 0); c.stroke();
      c.beginPath(); c.moveTo(25, 0); c.lineTo(30, 0); c.stroke();
      c.beginPath(); c.moveTo(0, -18); c.lineTo(0, -20); c.stroke();
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 20); c.stroke();
    }
  }
};
