// ──────── MNA SIMULATION ENGINE ────────
function UnionFind(n) { this.parent = Array.from({length:n}, (_,i)=>i); this.rank = new Array(n).fill(0); }
UnionFind.prototype.find = function(x) { if(this.parent[x]!==x) this.parent[x]=this.find(this.parent[x]); return this.parent[x]; };
UnionFind.prototype.union = function(a,b) { a=this.find(a); b=this.find(b); if(a===b) return; if(this.rank[a]<this.rank[b]) {var t=a;a=b;b=t;} this.parent[b]=a; if(this.rank[a]===this.rank[b]) this.rank[a]++; };

let SIM = null; // active simulation state

function buildCircuitFromCanvas() {
  // 1. Collect all pin positions → assign node indices
  const pinMap = new Map(); // "x,y" → index
  let nodeCount = 0;
  function getNode(x, y) {
    const key = Math.round(x)+','+Math.round(y);
    if (!pinMap.has(key)) pinMap.set(key, nodeCount++);
    return pinMap.get(key);
  }
  // register all part pins
  const partPinNodes = [];
  for (const p of S.parts) {
    const pins = getPartPins(p);
    partPinNodes.push(pins.map(pin => getNode(pin.x, pin.y)));
  }
  // 2. Union-Find to merge wire-connected nodes
  const uf = new UnionFind(nodeCount);
  for (const w of S.wires) {
    const n1 = getNode(w.x1, w.y1), n2 = getNode(w.x2, w.y2);
    uf.union(n1, n2);
  }
  // Also merge pins within 2px of each other
  const allKeys = [...pinMap.entries()];
  for (let i = 0; i < allKeys.length; i++) {
    const [ki, ni] = allKeys[i];
    const [xi, yi] = ki.split(',').map(Number);
    for (let j = i+1; j < allKeys.length; j++) {
      const [kj, nj] = allKeys[j];
      const [xj, yj] = kj.split(',').map(Number);
      if (Math.abs(xi-xj) <= 2 && Math.abs(yi-yj) <= 2) uf.union(ni, nj);
    }
  }
  // 2b. Net label merging — same-name labels share the same node
  var netLabelNodes = {};
  for (let i = 0; i < S.parts.length; i++) {
    var p = S.parts[i];
    if (p.type === 'netLabel' || p.type === 'vccLabel' || p.type === 'gndLabel') {
      var lName = p.type === 'vccLabel' ? 'VCC' : p.type === 'gndLabel' ? 'GND' : (p.val || p.name || 'NET1');
      if (typeof lName === 'number') lName = 'NET' + lName;
      var pinNode = partPinNodes[i][0];
      if (netLabelNodes[lName] !== undefined) {
        uf.union(netLabelNodes[lName], pinNode);
      } else {
        netLabelNodes[lName] = pinNode;
      }
    }
  }
  // 3. Ground detection — find ground node root
  let groundRoot = -1;
  for (let i = 0; i < S.parts.length; i++) {
    if (S.parts[i].type === 'ground' || S.parts[i].type === 'gndLabel') { groundRoot = uf.find(partPinNodes[i][0]); break; }
  }
  if (groundRoot === -1 && nodeCount > 0) groundRoot = uf.find(0); // fallback: node 0 is ground
  // 4. Remap canonical nodes (ground → 0)
  const canonMap = new Map(); // uf.find(n) → new index
  canonMap.set(groundRoot, 0);
  let nextNode = 1;
  for (let i = 0; i < nodeCount; i++) {
    const r = uf.find(i);
    if (!canonMap.has(r)) canonMap.set(r, nextNode++);
  }
  const N = nextNode; // number of unique nodes (including ground=0)
  // build _pinToNode for voltage map
  S._pinToNode = {};
  for (const [key, ni] of pinMap) { S._pinToNode[key] = canonMap.get(uf.find(ni)); }
  // 5. Build component list for solver
  const comps = [];
  for (let i = 0; i < S.parts.length; i++) {
    const p = S.parts[i], nodes = partPinNodes[i].map(n => canonMap.get(uf.find(n)));
    if (p.type === 'ground' || p.type === 'netLabel' || p.type === 'vccLabel' || p.type === 'gndLabel') continue;
    // Damaged part override — open circuit = huge R, short circuit = tiny R
    if (p.damaged) {
      if (p.damageResult === 'open') { comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:1e15, part:p}); continue; }
      if (p.damageResult === 'short') { comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:0.001, part:p}); continue; }
    }
    if (p.type === 'resistor') comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:p.val||1000, part:p});
    else if (p.type === 'capacitor') comps.push({type:'C', n1:nodes[0], n2:nodes[1], val:p.val||1e-6, part:p, vPrev:0});
    else if (p.type === 'inductor') comps.push({type:'L', n1:nodes[0], n2:nodes[1], val:p.val||0.01, part:p, iPrev:0});
    else if (p.type === 'vdc') comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:p.val||5, part:p, isAC:false});
    else if (p.type === 'vac') comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:p.val||5, part:p, isAC:true, freq:p.freq||COMP.vac.freq||50});
    else if (p.type === 'diode' || p.type === 'led') {
      // Sprint 25: Smart initial guess — use Vf_typ × 0.8 if model defined
      var initVd = 0.6;
      if (p.model && typeof VXA !== 'undefined' && VXA.Models && VXA.Models.getModel) {
        var mdl = VXA.Models.getModel(p.type, p.model);
        if (mdl && mdl.Vf_typ) initVd = mdl.Vf_typ * 0.8;
      }
      comps.push({type:'D', n1:nodes[0], n2:nodes[1], part:p, vPrev:initVd});
    }
    else if (p.type === 'switch') comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:p.closed?0.001:1e9, part:p});
    // Sprint 27a: Push Button (momentary) — closed is set by mousedown/up handlers
    else if (p.type === 'pushButton') comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:p.closed?0.01:1e9, part:p});
    // Sprint 27a: Buzzer — R+L series, audio output if voltage exceeds threshold
    else if (p.type === 'buzzer') {
      var bzR = p.val || 40;
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:bzR, part:p, isBuzzer:true});
    }
    // Sprint 27b: Speaker — impedance model (R default 8Ω), audio output
    else if (p.type === 'speaker') {
      var spkR = p.val || 8;
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:spkR, part:p, isSpeaker:true});
    }
    // Sprint 27a: 555 Timer — behavioural model (8 pins)
    else if (p.type === 'timer555') {
      // Pin map: 0=GND, 1=TRIG, 2=OUT, 3=RST, 4=CTRL, 5=THR, 6=DIS, 7=VCC
      comps.push({
        type: 'IC555',
        nGND: nodes[0], nTRIG: nodes[1], nOUT: nodes[2], nRST: nodes[3],
        nCTRL: nodes[4], nTHR: nodes[5], nDIS: nodes[6], nVCC: nodes[7],
        part: p
      });
      if (!p.ic555State) p.ic555State = { latch: false };
    }
    else if (p.type === 'npn') {
      var m = BJT_MODELS[p.model || 'Generic'] || BJT_MODELS['Generic'];
      comps.push({type:'BJT', polarity:1, n1:nodes[0], n2:nodes[1], n3:nodes[2], BF:m.BF, IS:m.IS, NF:m.NF, VAF:m.VAF, part:p, vbePrev:0.6, vbcPrev:0});
    }
    else if (p.type === 'pnp') {
      var m = BJT_MODELS[p.model || 'Generic'] || BJT_MODELS['Generic'];
      comps.push({type:'BJT', polarity:-1, n1:nodes[0], n2:nodes[1], n3:nodes[2], BF:m.BF, IS:m.IS, NF:m.NF, VAF:m.VAF, part:p, vbePrev:-0.6, vbcPrev:0});
    }
    else if (p.type === 'nmos') {
      var mm = MOSFET_MODELS[p.model || 'Generic'] || MOSFET_MODELS['Generic'];
      comps.push({type:'MOS', polarity:1, n1:nodes[0], n2:nodes[1], n3:nodes[2],
        VTO:mm.VTO, KP:mm.KP, LAMBDA:mm.LAMBDA, part:p});
    }
    else if (p.type === 'pmos') {
      var mm = MOSFET_MODELS[p.model || 'Generic'] || MOSFET_MODELS['Generic'];
      comps.push({type:'MOS', polarity:-1, n1:nodes[0], n2:nodes[1], n3:nodes[2],
        VTO:mm.VTO, KP:mm.KP, LAMBDA:mm.LAMBDA, part:p});
    }
    else if (p.type === 'opamp') {
      var om = OPAMP_MODELS[p.model || 'Ideal'] || OPAMP_MODELS['Ideal'];
      comps.push({type:'OA', nP:nodes[0], nN:nodes[1], nO:nodes[2],
        A:om.A, Rin:om.Rin, Rout:om.Rout, part:p});
    }
    else if (p.type === 'zener') {
      comps.push({type:'Z', n1:nodes[0], n2:nodes[1], vz:p.val||5.1, part:p, vPrev:0});
    }
    else if (p.type === 'vreg') {
      comps.push({type:'VREG', nIn:nodes[0], nOut:nodes[1], nGnd:nodes[2], vreg:p.val||5, part:p});
    }
    else if (p.type==='and'||p.type==='or'||p.type==='not'||p.type==='nand'||p.type==='nor'||p.type==='xor') {
      comps.push({type:'GATE', gate:p.type, pins:nodes, part:p, _out:0});
    }
    else if (p.type === 'transformer') {
      comps.push({type:'XFMR', n1a:nodes[0], n1b:nodes[1], n2a:nodes[2], n2b:nodes[3], ratio:p.val||10, part:p});
    }
    else if (p.type === 'relay') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:100, part:p});
      comps.push({type:'R', n1:nodes[2], n2:nodes[3], val:(p._activated?0.001:1e9), part:p});
    }
    else if (p.type === 'fuse') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:(p._blown?1e9:0.001), part:p});
    }
    else if (p.type === 'ammeter') {
      // 0V voltage source — measures current through it
      comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:0, part:p, isAC:false, isMeter:true});
    }
    else if (p.type === 'voltmeter') {
      // Very high resistance — measures voltage across it
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:1e9, part:p, isMeter:true});
    }
    else if (p.type === 'pulse') {
      comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:p.val||5, part:p, isAC:false, isPulse:true,
        v1:0, v2:p.val||5, td:0, tr:1e-6, tf:1e-6, pw:p.freq?0.5/p.freq:5e-4, per:p.freq?1/p.freq:1e-3});
    }
    else if (p.type === 'pwl') {
      comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:p.val||5, part:p, isAC:false, isPWL:true,
        points:p.pwlPoints||[[0,0],[0.001,p.val||5],[0.002,0]]});
    }
    else if (p.type === 'iac') {
      comps.push({type:'I', n1:nodes[0], n2:nodes[1], val:p.val||0.01, part:p, isAC:true, freq:p.freq||50});
    }
    else if (p.type === 'noise') {
      comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:0, part:p, isAC:false, isNoise:true, amp:p.val||0.1});
    }
    else if (p.type === 'vcvs') {
      comps.push({type:'VCVS', ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3], gain:p.val||10, part:p});
    }
    else if (p.type === 'vccs') {
      comps.push({type:'VCCS', ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3], gm:p.val||0.001, part:p});
    }
    else if (p.type === 'ccvs') {
      comps.push({type:'CCVS', ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3], rm:p.val||1000, part:p});
    }
    else if (p.type === 'cccs') {
      comps.push({type:'CCCS', ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3], alpha:p.val||10, part:p});
    }
    else if (p.type === 'schottky') {
      comps.push({type:'D', n1:nodes[0], n2:nodes[1], part:p, vPrev:0.3, IS:3.16e-8, N:1.04});
    }
    else if (p.type === 'njfet') {
      comps.push({type:'JFET', polarity:1, n1:nodes[0], n2:nodes[1], n3:nodes[2], Idss:0.01, Vp:-2, part:p});
    }
    else if (p.type === 'pjfet') {
      comps.push({type:'JFET', polarity:-1, n1:nodes[0], n2:nodes[1], n3:nodes[2], Idss:0.01, Vp:2, part:p});
    }
    else if (p.type === 'igbt') {
      comps.push({type:'MOS', polarity:1, n1:nodes[0], n2:nodes[1], n3:nodes[2], VTO:4, KP:5, LAMBDA:0.01, part:p});
    }
    else if (p.type === 'scr') {
      comps.push({type:'SCR', nA:nodes[0], nK:nodes[1], nG:nodes[2], part:p, latched:false});
    }
    else if (p.type === 'triac') {
      comps.push({type:'TRIAC', n1:nodes[0], n2:nodes[1], nG:nodes[2], part:p, active:false});
    }
    else if (p.type === 'diac') {
      comps.push({type:'DIAC', n1:nodes[0], n2:nodes[1], vbo:p.val||30, part:p});
    }
    else if (p.type === 'dff' || p.type === 'counter' || p.type === 'shiftreg' || p.type === 'mux') {
      comps.push({type:'DIGI', subtype:p.type, pins:nodes, part:p, _state:0, _prevClk:0, _count:0, _q:0});
    }
    else if (p.type === 'adc' || p.type === 'pwmGen') {
      // Mixed-signal: store node mapping for MixedSignal bridge, no MNA stamp needed
      p._nodes = nodes;
      comps.push({type:'R', n1:nodes[0]||0, n2:0, val:1e12, part:p}); // very high R placeholder
    }
    else if (p.type === 'dac') {
      // Mixed-signal DAC: store node mapping + controlled voltage source on AOUT
      p._nodes = nodes;
      var dacV = VXA.MixedSignal ? VXA.MixedSignal.getDACOutput(p.id) : 0;
      // AOUT (pin 8) to GND (pin 10)
      var aoutNode = nodes[8] || 0, gndNode = nodes[10] || 0;
      if (aoutNode > 0) {
        comps.push({type:'V', n1:aoutNode, n2:gndNode, val:dacV, part:p, isAC:false, isDACOutput:true});
      }
    }
    else if (p.type === 'wattmeter') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:0.001, part:p, isMeter:true});
    }
    else if (p.type === 'diffprobe') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:1e9, part:p, isMeter:true});
    }
    else if (p.type === 'iprobe') {
      comps.push({type:'V', n1:nodes[0], n2:nodes[1], val:0, part:p, isAC:false, isMeter:true});
    }
    else if (p.type === 'potentiometer') {
      var wpos = p.wiper !== undefined ? p.wiper : 0.5;
      var rTotal = Math.max(1, p.val || 10000);
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:Math.max(1, rTotal*(1-wpos)), part:p});
      comps.push({type:'R', n1:nodes[1], n2:nodes[2], val:Math.max(1, rTotal*wpos), part:p});
    }
    else if (p.type === 'ntc') {
      var Tk = (p.temperature !== undefined ? p.temperature : 25) + 273.15;
      var T0k = 298.15, Bcoeff = 3950, R0ntc = p.val || 10000;
      var Rntc = R0ntc * Math.exp(Bcoeff * (1/Tk - 1/T0k));
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:Math.max(1, Rntc), part:p});
    }
    else if (p.type === 'ptc') {
      var Tptc = p.temperature !== undefined ? p.temperature : 25;
      var alphaPtc = 0.01, R0ptc = p.val || 100;
      var Rptc = R0ptc * (1 + alphaPtc * (Tptc - 25));
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:Math.max(1, Rptc), part:p});
    }
    else if (p.type === 'ldr') {
      var light = p.light !== undefined ? p.light : 0.5;
      var Rdark = 1e6, Rlight = 100;
      var Rldr = Rdark * Math.pow(Rlight/Rdark, light);
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:Math.max(1, Rldr), part:p});
    }
    else if (p.type === 'varistor') {
      var vdVar = Math.abs((S._nodeVoltages && S._nodeVoltages.length > 1) ? (S._nodeVoltages[1]||0) : 0);
      var Vc = p.val || 200;
      var Rvar = vdVar > Vc ? 1 : 1e8;
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:Rvar, part:p});
    }
    else if (p.type === 'comparator') {
      p._nodes = nodes;
      // 5-pin: V+(0), V-(1), OUT(2), VCC(3), GND(4)
      comps.push({type:'COMP', nP:nodes[0], nN:nodes[1], nO:nodes[2], part:p});
      // VCC/GND passive — no stamp needed (power rails are external)
    }
    else if (p.type === 'crystal') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:100, part:p});
      comps.push({type:'C', n1:nodes[0], n2:nodes[1], val:1e-12, part:p, vPrev:0});
    }
    else if (p.type === 'coupled_l') {
      var k = p.val || 0.5;
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:0.1, part:p});
      comps.push({type:'R', n1:nodes[2], n2:nodes[3], val:0.1, part:p});
      comps.push({type:'VCVS', ncP:nodes[0], ncN:nodes[1], noP:nodes[2], noN:nodes[3], gain:k, part:p});
    }
    else if (p.type === 'dcmotor') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[1], val:5, part:p});
    }
    else if (p.type === 'tline') {
      comps.push({type:'R', n1:nodes[0], n2:nodes[2], val:p.val||50, part:p});
      comps.push({type:'R', n1:nodes[1], n2:nodes[3], val:p.val||50, part:p});
    }
  }
  // assign wire node mapping for current display
  for (const w of S.wires) {
    const k1 = Math.round(w.x1)+','+Math.round(w.y1), k2 = Math.round(w.x2)+','+Math.round(w.y2);
    w._n1 = canonMap.get(uf.find(pinMap.get(k1)||0)) || 0;
    w._n2 = canonMap.get(uf.find(pinMap.get(k2)||0)) || 0;
  }
  SIM = { N, comps, vSrc: comps.filter(c=>c.type==='V') };
}

const GMIN = 1e-12, SIM_DT = 1e-5, SUBSTEPS = 15;
function getAdaptiveSubsteps() {
  var n = S.parts.length;
  var hasNL = S.parts.some(function(p) {
    return ['diode','led','zener','schottky','npn','pnp','nmos','pmos','njfet','pjfet','scr','triac','diac','igbt'].indexOf(p.type) >= 0;
  });
  var base = n < 5 ? 5 : n < 20 ? 10 : n < 50 ? 15 : 20;
  return hasNL ? base + 5 : base;
}
const DIODE_IS = 1e-14, DIODE_N = 1, VT = 0.026;

// Legacy model aliases — now reference VXA.Models (Sprint 7)
var DIODE_MODELS = VXA.Models.DIODE;
var LED_MODELS = {
  'Kırmızı': { VF: 1.8, color: '#f0454a' }, 'Yeşil': { VF: 2.2, color: '#22c55e' },
  'Mavi': { VF: 3.2, color: '#3b82f6' }, 'Sarı': { VF: 2.0, color: '#eab308' }, 'Beyaz': { VF: 3.3, color: '#e0e7f0' },
};
var ZENER_MODELS = {
  '3.3V': { VZ: 3.3 }, '5.1V': { VZ: 5.1 }, '6.8V': { VZ: 6.8 }, '12V': { VZ: 12 }, '15V': { VZ: 15 },
};
var BJT_MODELS = VXA.Models.BJT;
var MOSFET_MODELS = VXA.Models.MOSFET;
var OPAMP_MODELS = {};
(function() { for (var k in VXA.Models.OPAMP) { var m = VXA.Models.OPAMP[k]; OPAMP_MODELS[k] = { A: m.Aol, Rin: m.Rin, Rout: m.Rout }; } })();
var VREG_MODELS = {
  '7805': { VREG: 5, DROPOUT: 2 }, '7812': { VREG: 12, DROPOUT: 2 },
  'LM317': { VREG: 1.25, DROPOUT: 3, adjustable: true },
};

// ──────── SPICE .model PARSER ────────
function parseSpiceModel(line) {
  var m = line.match(/\.model\s+(\S+)\s+(NPN|PNP|D|NMOS|PMOS|NFET|PFET)\s*\(([^)]+)\)/i);
  if (!m) return null;
  var name = m[1], type = m[2].toUpperCase(), params = {};
  m[3].replace(/\s+/g,' ').trim().split(/\s+/).forEach(function(p) {
    var kv = p.split('='); if (kv.length === 2) params[kv[0].toUpperCase()] = parseFloat(kv[1]);
  });
  return { name: name, type: type, params: params };
}

function importSpiceModels() {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.model,.lib,.mod,.txt,.cir';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = ev.target.result;
      var models = VXA.SpiceParser.parseMultiple(text);
      var count = 0;
      for (var i = 0; i < models.length; i++) {
        var parsed = models[i];
        var t = parsed.type, p = parsed.params, n = parsed.name;
        if (t === 'NPN' || t === 'PNP') {
          p.type = t; p.desc = 'Imported: ' + n;
          VXA.Models.addCustomModel('npn', n, p);
          count++;
        } else if (t === 'D') {
          p.desc = 'Imported: ' + n;
          VXA.Models.addCustomModel('diode', n, p);
          count++;
        } else if (t === 'NMOS' || t === 'PMOS' || t === 'NFET' || t === 'PFET') {
          p.type = t.replace('FET','MOS'); p.VTO = p.VTO || p.VTH || 2; p.desc = 'Imported: ' + n;
          VXA.Models.addCustomModel('nmos', n, p);
          count++;
        }
      }
      if (count > 0) {
        showInfoCard('SPICE Modelleri Yüklendi', count + ' model başarıyla eklendi.', 'Inspector dropdown\'larında görünecekler.');
        if (S.sim.running) buildCircuitFromCanvas();
        updateInspector();
      } else {
        showInfoCard('Model Bulunamadı', 'Dosyada geçerli .model satırı bulunamadı.', '.model NAME TYPE(PARAM=VAL ...) formatı bekleniyor.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// solveStep: delegates to VXA.SimV2 (Sprint 6 engine)
function solveStep(dt) {
  VXA.SimV2.solve(dt);
}

function simulationStep() {
  if (!S.sim.running || !SIM) return;
  try {
    var dt = VXA.AdaptiveStep.getDt();
    var steps = Math.max(1, Math.round(getAdaptiveSubsteps() * (S.sim.speed || 1)));
    for (var i = 0; i < steps; i++) {
      S.sim.t += dt;
      VXA.SimV2.solve(dt);
      if (!VXA.SimV2.getConverged()) {
        VXA.AdaptiveStep.setDt(dt / 4);
        dt = VXA.AdaptiveStep.getDt();
      } else {
        VXA.AdaptiveStep.adjust(true, VXA.SimV2.getNRIter());
        dt = VXA.AdaptiveStep.getDt();
      }
    }
    S.sim.error = '';
    S._simDt = dt;
    // Thermal update (accelerated — thermal time constants are much slower than electrical)
    VXA.Thermal.update(dt * steps * 50); // 50x thermal acceleration for visible effect
    // Damage check
    for (var di = 0; di < S.parts.length; di++) {
      VXA.Damage.check(S.parts[di]);
    }
    // Sprint 13: Chaos Monkey update
    if (VXA.ChaosMonkey && VXA.ChaosMonkey.isRunning()) {
      VXA.ChaosMonkey.update(S.parts, S.sim.t);
    }
    // Sprint 18: Mixed-signal analog → digital sync
    if (VXA.MixedSignal) {
      VXA.MixedSignal.syncAnalogToDigital(S.sim.t, S.parts, S._nodeVoltages || {});
    }
    // Sprint 17: Digital simulation step
    if (VXA.Digital && VXA.Digital.isRunning()) {
      VXA.Digital.step(S.sim.t, S.parts, S.wires);
    }
    // Sprint 18: Mixed-signal digital → analog sync
    if (VXA.MixedSignal && VXA.Digital) {
      VXA.MixedSignal.syncDigitalToAnalog(S.sim.t, S.parts, VXA.Digital.getStates());
    }
    // TimeMachine capture (Sprint 11)
    if (VXA.TimeMachine && VXA.TimeMachine.isEnabled()) {
      var _tmThermal = S.parts.map(function(p) {
        return { id: p.id, temp: VXA.Thermal.getTemperature(p), status: VXA.Thermal.getStatus(p) };
      });
      var _tmDamage = S.parts.filter(function(p) { return p.damaged; }).map(function(p) {
        return { id: p.id, damaged: true, justDamaged: p._justDamaged || false };
      });
      VXA.TimeMachine.capture(S.sim.t, S._nodeVoltages, S.parts, _tmThermal, _tmDamage, S.scope.ch);
    }
    // Sprint 12: Spatial Audio hum update
    if (VXA.SpatialAudio && S.soundOn) {
      VXA.SpatialAudio.updateViewport(
        typeof cvs !== 'undefined' ? cvs.width / (typeof DPR !== 'undefined' ? DPR : 1) : 800,
        typeof cvs !== 'undefined' ? cvs.height / (typeof DPR !== 'undefined' ? DPR : 1) : 600,
        typeof S.view !== 'undefined' ? -S.view.ox / S.view.zoom : 400,
        typeof S.view !== 'undefined' ? -S.view.oy / S.view.zoom : 300,
        typeof S.view !== 'undefined' ? S.view.zoom : 1
      );
      for (var _hi = 0; _hi < S.parts.length; _hi++) {
        var _hp = S.parts[_hi];
        var _hCur = Math.abs(_hp._i || 0);
        var _hMax = 0.1;
        if (_hp._thermal) _hMax = Math.sqrt((_hp._thermal.Pmax || 0.25) / Math.max(1, _hp.val || 1));
        if (_hp.type === 'led') _hMax = 0.02;
        else if (_hp.type === 'diode' || _hp.type === 'zener') _hMax = 1.0;
        else if (_hp.type === 'npn' || _hp.type === 'pnp') _hMax = 0.5;
        else if (_hp.type === 'nmos' || _hp.type === 'pmos') _hMax = 2.0;
        else if (_hp.type === 'fuse') _hMax = _hp.val || 1.0;
        else if (_hp.type === 'resistor' && _hp.val > 0) _hMax = Math.sqrt(0.25 / _hp.val);
        if (_hCur > _hMax * 0.2) {
          VXA.SpatialAudio.startHum(_hp.id, _hp.x, _hp.y, _hCur, _hMax);
          VXA.SpatialAudio.updateHum(_hp.id, _hp.x, _hp.y, _hCur, _hMax);
        } else {
          VXA.SpatialAudio.stopHum(_hp.id);
        }
      }
    }
  } catch(e) {
    S.sim.running = false; S.sim.error = e.message;
    document.getElementById('sim-dot').classList.remove('on');
    document.getElementById('sim-label').textContent = 'HATA';
    document.getElementById('btn-sim').innerHTML = '&#9654; Başlat';
  }
}
