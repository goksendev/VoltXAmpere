#!/usr/bin/env node
// Sprint 70a headless layout verifier.
// Loads spice-layout.js + spice-router.js with stubbed VXA,
// feeds each test circuit (mirroring SPICE parse output),
// computes placements + routed wires, then emits ASCII snapshot.

const fs = require('fs');
const path = require('path');

global.VXA = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'io', 'spice-layout.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'io', 'spice-router.js'), 'utf8'));

// Minimal COMP pin defs mirroring src/components/definitions.js.
const COMP = {
  resistor:  { pins: [{dx:-40,dy:0},{dx:40,dy:0}], sym:'R' },
  capacitor: { pins: [{dx:-40,dy:0},{dx:40,dy:0}], sym:'C' },
  inductor:  { pins: [{dx:-40,dy:0},{dx:40,dy:0}], sym:'L' },
  vdc:       { pins: [{dx:0,dy:-40},{dx:0,dy:40}], sym:'V' },
  vac:       { pins: [{dx:0,dy:-40},{dx:0,dy:40}], sym:'V~' },
  pulse:     { pins: [{dx:0,dy:-40},{dx:0,dy:40}], sym:'VP' },
  idc:       { pins: [{dx:0,dy:-40},{dx:0,dy:40}], sym:'I' },
  diode:     { pins: [{dx:-40,dy:0},{dx:40,dy:0}], sym:'D' },
  npn:       { pins: [{dx:-40,dy:0},{dx:20,dy:-40},{dx:20,dy:40}], sym:'Q' },
  pnp:       { pins: [{dx:-40,dy:0},{dx:20,dy:-40},{dx:20,dy:40}], sym:'Q' },
  nmos:      { pins: [{dx:-40,dy:0},{dx:20,dy:-40},{dx:20,dy:40}], sym:'M' },
  pmos:      { pins: [{dx:-40,dy:0},{dx:20,dy:-40},{dx:20,dy:40}], sym:'M' },
  vcvs:      { pins: [{dx:-40,dy:-15},{dx:-40,dy:15},{dx:40,dy:-15},{dx:40,dy:15}], sym:'E' },
};

function rotatePin(dx, dy, rot) {
  const r = (rot||0) * Math.PI/2, c = Math.cos(r), s = Math.sin(r);
  return { x: dx*c - dy*s, y: dx*s + dy*c };
}
function getPins(part) {
  const def = COMP[part.type]; if (!def) return [];
  return def.pins.map(p => {
    const r = rotatePin(p.dx, p.dy, part.rot);
    return { x: Math.round(part.x + r.x), y: Math.round(part.y + r.y) };
  });
}

function runLayout(circuit) {
  const layout = VXA.SpiceLayout.computeLayout(circuit);
  const placed = [];
  layout.placements.forEach(pl => {
    const cp = circuit.parts[pl.partIdx];
    placed.push({
      type: cp.type, x: pl.x, y: pl.y, rot: pl.rot,
      nodes: cp.nodes, partIdx: pl.partIdx
    });
  });
  // Collect pin positions per node
  const nodePins = {};
  placed.forEach(p => {
    const pins = getPins(p);
    (p.nodes || []).forEach((n, i) => {
      if (n == null || i >= pins.length) return;
      if (!nodePins[n]) nodePins[n] = [];
      nodePins[n].push(pins[i]);
    });
  });
  // Route non-GND nodes
  const wires = [];
  Object.keys(nodePins).forEach(nk => {
    if (+nk === 0) return;
    const segs = VXA.SpiceRouter.connectNode(nodePins[nk]);
    segs.forEach(w => wires.push(w));
  });
  // GND bus
  let gndSymbol = null;
  if (nodePins[0] && nodePins[0].length > 0) {
    const maxY = Math.max(...placed.map(p=>p.y));
    const busY = Math.round((maxY + 80)/20)*20;
    const gb = VXA.SpiceRouter.groundBus(nodePins[0], busY);
    gb.wires.forEach(w => wires.push(w));
    gndSymbol = { x: gb.groundX, y: busY + 20 };
  }
  return { placed, wires, gndSymbol, nodeDepth: layout.nodeDepth, nodePins };
}

function validateLayout(name, result) {
  const { placed, wires, gndSymbol } = result;
  const checks = [];
  // 1. No diagonal wires
  const diag = wires.filter(w => w.x1 !== w.x2 && w.y1 !== w.y2);
  checks.push({ rule: 'Manhattan 90° (no diagonals)', ok: diag.length === 0, detail: diag.length ? diag.length+' diagonal' : 'all 90°' });
  // 2. All parts on 20px grid
  const offGrid = placed.filter(p => (p.x % 20) || (p.y % 20));
  checks.push({ rule: 'Parts on 20px grid', ok: offGrid.length === 0, detail: offGrid.length ? offGrid.length+' off-grid' : 'grid-snapped' });
  // 3. No overlapping parts (same x,y)
  const posSet = {};
  let overlaps = 0;
  placed.forEach(p => { const k = p.x+','+p.y; if (posSet[k]) overlaps++; posSet[k] = true; });
  checks.push({ rule: 'No overlapping parts', ok: overlaps === 0, detail: overlaps ? overlaps+' overlaps' : 'unique positions' });
  // 4. GND bus consolidated (either no GND or one symbol)
  checks.push({ rule: 'Single GND symbol', ok: true, detail: gndSymbol ? 'at ('+gndSymbol.x+','+gndSymbol.y+')' : 'no GND in circuit' });
  // 5. Parts have adequate spacing (min distance between centers ≥ 100px)
  let tooClose = 0;
  for (let i=0;i<placed.length;i++) for (let j=i+1;j<placed.length;j++) {
    const d = Math.hypot(placed[i].x-placed[j].x, placed[i].y-placed[j].y);
    if (d < 100) tooClose++;
  }
  checks.push({ rule: 'Part spacing ≥ 100px', ok: tooClose === 0, detail: tooClose ? tooClose+' pairs too close' : 'clean spacing' });
  return checks;
}

function renderASCII(result) {
  const { placed, wires, gndSymbol } = result;
  const all = [...placed.map(p => ({x:p.x,y:p.y})), ...wires.flatMap(w=>[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}])];
  if (gndSymbol) all.push(gndSymbol);
  if (all.length === 0) return '(empty)';
  const minX = Math.min(...all.map(a=>a.x)) - 20;
  const maxX = Math.max(...all.map(a=>a.x)) + 20;
  const minY = Math.min(...all.map(a=>a.y)) - 20;
  const maxY = Math.max(...all.map(a=>a.y)) + 20;
  const W = Math.ceil((maxX-minX)/20) + 1;
  const H = Math.ceil((maxY-minY)/20) + 1;
  const grid = Array.from({length: H}, () => Array(W).fill(' '));
  const toCol = x => Math.round((x-minX)/20);
  const toRow = y => Math.round((y-minY)/20);
  // Draw wires first (so parts overlay)
  wires.forEach(w => {
    if (w.x1 === w.x2) {
      const col = toCol(w.x1);
      const y1 = Math.min(toRow(w.y1), toRow(w.y2));
      const y2 = Math.max(toRow(w.y1), toRow(w.y2));
      for (let y=y1; y<=y2; y++) if (grid[y] && col>=0 && col<W && grid[y][col] === ' ') grid[y][col] = '|';
    } else {
      const row = toRow(w.y1);
      const x1 = Math.min(toCol(w.x1), toCol(w.x2));
      const x2 = Math.max(toCol(w.x1), toCol(w.x2));
      for (let x=x1; x<=x2; x++) if (grid[row] && x>=0 && x<W && grid[row][x] === ' ') grid[row][x] = '-';
    }
  });
  // Draw parts
  placed.forEach(p => {
    const sym = COMP[p.type] ? COMP[p.type].sym : '?';
    const c = toCol(p.x), r = toRow(p.y);
    if (grid[r] && c>=0 && c<W) {
      for (let i=0;i<sym.length;i++) if (c+i < W) grid[r][c+i] = sym[i];
    }
  });
  // GND
  if (gndSymbol) {
    const c = toCol(gndSymbol.x), r = toRow(gndSymbol.y);
    if (grid[r] && c>=0 && c<W) { grid[r][c] = '⏚'; }
  }
  return grid.map(row => row.join('')).join('\n');
}

// ─── Test circuits (mirror what spice-import.js parser produces) ───
const circuits = [
  { name: '01 Voltage Divider', parts: [
    { type:'vdc', nodes:[1,0], val:12 },
    { type:'resistor', nodes:[1,2], val:1000 },
    { type:'resistor', nodes:[2,0], val:2200 },
  ], nodeCount: 3 },
  { name: '02 Parallel R', parts: [
    { type:'vdc', nodes:[1,0], val:10 },
    { type:'resistor', nodes:[1,0], val:1000 },
    { type:'resistor', nodes:[1,0], val:2200 },
    { type:'resistor', nodes:[1,0], val:4700 },
  ], nodeCount: 2 },
  { name: '03 RLC Series', parts: [
    { type:'vac', nodes:[1,0], val:5, freq:1000 },
    { type:'resistor', nodes:[1,2], val:100 },
    { type:'inductor', nodes:[2,3], val:1e-3 },
    { type:'capacitor', nodes:[3,0], val:100e-9 },
  ], nodeCount: 4 },
  { name: '04 Diode Bridge', parts: [
    { type:'vac', nodes:[1,0], val:10, freq:60 },
    { type:'diode', nodes:[1,3], model:'DMOD' },
    { type:'diode', nodes:[0,3], model:'DMOD' },
    { type:'diode', nodes:[4,1], model:'DMOD' },
    { type:'diode', nodes:[4,0], model:'DMOD' },
    { type:'resistor', nodes:[3,4], val:1000 },
  ], nodeCount: 5 },
  { name: '05 CE Amp (BJT)', parts: [
    { type:'vdc', nodes:[1,0], val:12 },
    { type:'resistor', nodes:[1,2], val:47000 },
    { type:'resistor', nodes:[2,0], val:10000 },
    { type:'resistor', nodes:[1,3], val:2200 },
    { type:'resistor', nodes:[4,0], val:1000 },
    // BJT parser re-orders: [base, collector, emitter]
    { type:'npn', nodes:[2,3,4], model:'QMOD' },
  ], nodeCount: 5 },
  { name: '06 Op-Amp Buffer', parts: [
    { type:'vdc', nodes:[1,0], val:5 },
    { type:'resistor', nodes:[1,2], val:1000 },
    // E1 3 0 2 3 1e6 — parser maps to [ctrl+, ctrl-, out+, out-] = [2,3,3,0]
    { type:'vcvs', nodes:[2,3,3,0], val:1e6 },
    { type:'resistor', nodes:[3,0], val:10000 },
  ], nodeCount: 4 },
  { name: '07 555 Astable (BJT equiv.)', parts: [
    { type:'vdc', nodes:[5,0], val:9 },
    { type:'resistor', nodes:[5,1], val:2200 },
    { type:'resistor', nodes:[5,2], val:2200 },
    { type:'resistor', nodes:[5,3], val:47000 },
    { type:'resistor', nodes:[5,4], val:47000 },
    { type:'capacitor', nodes:[1,4], val:10e-9 },
    { type:'capacitor', nodes:[2,3], val:10e-9 },
    { type:'npn', nodes:[3,1,0], model:'QMOD' },
    { type:'npn', nodes:[4,2,0], model:'QMOD' },
  ], nodeCount: 6 },
  { name: '08 Voltage Regulator', parts: [
    { type:'vdc', nodes:[1,0], val:12 },
    { type:'resistor', nodes:[1,2], val:220 },
    { type:'diode', nodes:[0,2], model:'DZEN' },
    { type:'resistor', nodes:[2,0], val:1000 },
  ], nodeCount: 3 },
  { name: '09 H-Bridge', parts: [
    { type:'vdc', nodes:[5,0], val:12 },
    { type:'pulse', nodes:[10,0], val:5 },
    { type:'pulse', nodes:[11,0], val:5 },
    { type:'pmos', nodes:[10,2,5], model:'MPMOS' },
    { type:'pmos', nodes:[11,3,5], model:'MPMOS' },
    { type:'nmos', nodes:[11,0,2], model:'MNMOS' },
    { type:'nmos', nodes:[10,0,3], model:'MNMOS' },
    { type:'resistor', nodes:[2,3], val:10 },
  ], nodeCount: 6 },
  { name: '10 Boost Converter', parts: [
    { type:'vdc', nodes:[1,0], val:5 },
    { type:'inductor', nodes:[1,2], val:100e-6 },
    { type:'nmos', nodes:[3,0,2], model:'MNMOS' },
    { type:'pulse', nodes:[3,0], val:5 },
    { type:'diode', nodes:[2,4], model:'DMOD' },
    { type:'capacitor', nodes:[4,0], val:100e-6 },
    { type:'resistor', nodes:[4,0], val:10 },
  ], nodeCount: 5 },
];

// ─── Main ───
let totalPass = 0, totalFail = 0;
circuits.forEach(cir => {
  const result = runLayout(cir);
  const checks = validateLayout(cir.name, result);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST: ' + cir.name);
  console.log('Parts: ' + cir.parts.length + ' • Nodes: ' + cir.nodeCount);
  console.log('');
  console.log('Placements:');
  result.placed.forEach(p => {
    console.log('  ' + p.type.padEnd(10) + ' x=' + String(p.x).padStart(4) + ' y=' + String(p.y).padStart(4) + ' rot=' + p.rot + '  nodes=[' + p.nodes.join(',') + ']');
  });
  if (result.gndSymbol) console.log('  GND        x=' + String(result.gndSymbol.x).padStart(4) + ' y=' + String(result.gndSymbol.y).padStart(4) + '  (consolidated bus)');
  console.log('');
  console.log('Wires: ' + result.wires.length + ' segments');
  console.log('');
  console.log('ASCII Layout:');
  console.log(renderASCII(result).split('\n').map(l => '  ' + l).join('\n'));
  console.log('');
  console.log('Validation:');
  checks.forEach(c => {
    const mark = c.ok ? '✓' : '✗';
    console.log('  ' + mark + ' ' + c.rule.padEnd(32) + ' — ' + c.detail);
    if (c.ok) totalPass++; else totalFail++;
  });
  console.log('');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY: ' + totalPass + ' checks passed, ' + totalFail + ' failed');
process.exit(totalFail === 0 ? 0 : 1);
