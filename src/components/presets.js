// ──────── PRESETS ────────
var PRESETS = [
  { id:'vdiv', name:'Gerilim Bölücü', color:'#00e09e',
    desc:'Vout = Vin × R2/(R1+R2)', formula:'Vout ≈ 8.25V (12V, 1k/2.2k)',
    parts:[{type:'vdc',x:0,y:0,rot:0,val:12},{type:'resistor',x:100,y:-60,rot:0,val:1000},{type:'resistor',x:100,y:60,rot:1,val:2200},{type:'ground',x:0,y:100,rot:0,val:0}],
    wires:[{x1:0,y1:-40,x2:60,y2:-60},{x1:140,y1:-60,x2:100,y2:20},{x1:100,y1:100,x2:0,y2:40},{x1:0,y1:40,x2:0,y2:80}]},
  { id:'rclp', name:'RC Alçak Geçiren', color:'#3b82f6',
    desc:'fc = 1/(2πRC)', formula:'fc ≈ 1592 Hz (1kΩ, 100nF)',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:5,freq:1000},{type:'resistor',x:40,y:-60,rot:0,val:1000},{type:'capacitor',x:120,y:0,rot:1,val:100e-9},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:0,y2:-60},{x1:80,y1:-60,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60}]},
  { id:'led', name:'LED Devresi', color:'#eab308',
    desc:'I = (Vs - Vf) / R', formula:'I ≈ 13.6 mA (5V, 220Ω, Vf≈2V)',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'resistor',x:40,y:-40,rot:0,val:220},{type:'led',x:120,y:0,rot:1,val:0},{type:'ground',x:-60,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:120,y2:-30},{x1:120,y1:30,x2:-60,y2:40},{x1:-60,y1:40,x2:-60,y2:60}]},
  { id:'halfwave', name:'Yarım Dalga Doğrultucu', color:'#f0454a',
    desc:'Sadece pozitif yarım dalga geçer', formula:'Vout_peak ≈ Vpeak - 0.7V',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:10,freq:60},{type:'diode',x:40,y:-60,rot:0,val:0},{type:'resistor',x:120,y:0,rot:1,val:1000},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:10,y2:-60},{x1:70,y1:-60,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60}]},
  { id:'rccharge', name:'Kapasitör Şarj', color:'#06b6d4',
    desc:'V(t) = Vs × (1 - e^(-t/RC))', formula:'τ = RC = 1 ms (1kΩ, 1µF)',
    // Sprint 29: Fixed wiring — switch pre-closed, exact pin-to-pin, ground offset
    parts:[{type:'vdc',x:0,y:0,rot:0,val:5},{type:'switch',x:60,y:-40,rot:0,val:0,closed:true},{type:'resistor',x:140,y:-40,rot:0,val:1000},{type:'capacitor',x:220,y:0,rot:1,val:1e-6},{type:'ground',x:110,y:80,rot:0,val:0}],
    wires:[{x1:0,y1:-40,x2:30,y2:-40},{x1:90,y1:-40,x2:100,y2:-40},{x1:180,y1:-40,x2:220,y2:-40},{x1:0,y1:40,x2:110,y2:60},{x1:220,y1:40,x2:110,y2:60}]},
  { id:'rlc', name:'RLC Rezonans', color:'#a855f7',
    desc:'f0 = 1/(2π√LC)', formula:'Underdamped osilasyon',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:10},{type:'resistor',x:20,y:-60,rot:0,val:10},{type:'inductor',x:120,y:-60,rot:0,val:1e-3},{type:'capacitor',x:200,y:0,rot:1,val:10e-6},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:200,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:-60},{x1:60,y1:-60,x2:80,y2:-60},{x1:160,y1:-60,x2:200,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:200,y1:40,x2:200,y2:60},{x1:-80,y1:60,x2:200,y2:60}]},
  { id:'serpar', name:'Seri-Paralel Direnç', color:'#22c55e',
    desc:'Rtop = R1 + (R2||R3)', formula:'V1=9V, R1=470Ω, R2||R3=500Ω',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:9},{type:'resistor',x:20,y:-40,rot:0,val:470},{type:'resistor',x:140,y:-20,rot:1,val:1000},{type:'resistor',x:140,y:40,rot:1,val:1000},{type:'ground',x:-80,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:140,y2:-60},{x1:140,y1:60,x2:-80,y2:40},{x1:-80,y1:40,x2:-80,y2:60}]},
  { id:'rl', name:'RL Transient', color:'#f59e0b',
    desc:'I(t) = (V/R)(1-e^(-Rt/L))', formula:'τ = L/R = 1 µs (1kΩ, 1mH)',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'resistor',x:40,y:-40,rot:0,val:1000},{type:'inductor',x:140,y:0,rot:1,val:1e-3},{type:'ground',x:-60,y:80,rot:0,val:0},{type:'ground',x:140,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:140,y2:-40},{x1:-60,y1:40,x2:-60,y2:60},{x1:140,y1:40,x2:140,y2:60}]},
  { id:'ce-amp', name:'CE Yükselteç', color:'#a855f7',
    desc:'Common Emitter amplifier', formula:'Vce ≈ 7.5V, Ic ≈ 1.4mA (aktif bölge)',
    // Sprint 30: Rebuilt from scratch with simpler topology
    // NPN pin layout (rot=0, at 0,0): base (-40, 0), collector (20, -40), emitter (20, 40)
    // Topology: VCC up, GND down, bias R1/R2 on left of base, RC above collector, RE below emitter
    // All bias nodes connect exactly at NPN pins
    parts:[
      {type:'vdc',x:-160,y:0,rot:0,val:12},               // VCC source
      {type:'resistor',x:-80,y:-40,rot:0,val:47000},     // R1: VCC rail to base
      {type:'resistor',x:-80,y:40,rot:0,val:10000},      // R2: base to GND
      {type:'resistor',x:80,y:-80,rot:1,val:2200},       // RC: VCC to collector (Sprint 31: spec value)
      {type:'resistor',x:80,y:80,rot:1,val:1000},        // RE: emitter to GND (Sprint 31: spec value)
      {type:'npn',x:40,y:0,rot:0,val:100},               // NPN
      {type:'ground',x:-160,y:120,rot:0,val:0}           // Ground
    ],
    // Wire layout:
    // NPN pins (at 40,0 rot=0): base at (0,0), collector at (60,-40), emitter at (60,40)
    // R1 pins (at -80,-40 rot=0): left (-120,-40), right (-40,-40)
    // R2 pins (at -80,40 rot=0): left (-120,40), right (-40,40)
    // RC pins (at 80,-80 rot=1): top (80,-120), bottom (80,-40)
    // RE pins (at 80,80 rot=1): top (80,40), bottom (80,120)
    // VDC at (-160,0): top (-160,-40), bottom (-160,40)
    wires:[{x1:-160,y1:-40,x2:-120,y2:-40},{x1:-160,y1:-40,x2:80,y2:-120},{x1:-40,y1:-40,x2:0,y2:0},{x1:-40,y1:40,x2:0,y2:0},{x1:-120,y1:40,x2:-160,y2:40},{x1:-160,y1:40,x2:-160,y2:100},{x1:80,y1:120,x2:-160,y2:100},{x1:80,y1:-40,x2:60,y2:-40},{x1:60,y1:40,x2:80,y2:40}]},
  { id:'npn-sw', name:'NPN Anahtar', color:'#a855f7',
    desc:'Transistör ile switching', formula:'Vce_sat \u2248 0.2V',
    parts:[
      {type:'vdc',x:-100,y:0,rot:0,val:5},
      {type:'resistor',x:0,y:-40,rot:0,val:10000},
      {type:'resistor',x:100,y:-60,rot:1,val:1000},
      {type:'npn',x:60,y:0,rot:0,val:100},
      {type:'ground',x:-100,y:80,rot:0,val:0},
      {type:'ground',x:60,y:80,rot:0,val:0},
      {type:'vdc',x:100,y:-120,rot:0,val:5},
    ],
    wires:[{x1:-100,y1:-40,x2:-40,y2:-40},{x1:40,y1:-40,x2:20,y2:0},{x1:80,y1:-40,x2:100,y2:-80},{x1:-100,y1:40,x2:-100,y2:60},{x1:60,y1:40,x2:60,y2:60}]},
  { id:'cmos-inv', name:'CMOS Inverter', color:'#a855f7',
    desc:'Dijital NOT kapisi', formula:'Vin=0V\u2192Vout=5V, Vin=5V\u2192Vout=0V',
    // Sprint 103 (F-004): previous preset had the Vin source's bottom
    // terminal coincident with the VCC rail's top terminal, creating a
    // 0V==5V short that pinned the inverter rails to nonsense values.
    // Rewired with separate VCC and Vin sources each going to their own
    // ground, plus explicit NMOS/PMOS pin connections.
    // NMOS at (40,40): gate(0,40), drain(60,0), source(60,80)
    // PMOS at (40,-40): gate(0,-40), drain(60,-80), source(60,0)
    parts:[
      {type:'vdc',x:-120,y:0,rot:0,val:5},         // VCC rail
      {type:'vdc',x:-60,y:0,rot:0,val:0},          // Vin (default logic LOW)
      {type:'pmos',x:40,y:-40,rot:0,val:0},
      {type:'nmos',x:40,y:40,rot:0,val:0},
      {type:'ground',x:-120,y:80,rot:0,val:0},
      {type:'ground',x:-60,y:80,rot:0,val:0},
      {type:'ground',x:60,y:120,rot:0,val:0}
    ],
    wires:[
      {x1:-120,y1:-40,x2:60,y2:-80},     // VCC → PMOS drain (top)
      {x1:-120,y1:40,x2:-120,y2:60},     // VCC- → GND1
      {x1:-60,y1:40,x2:-60,y2:60},       // Vin- → GND2
      {x1:-60,y1:-40,x2:0,y2:-40},       // Vin+ → PMOS gate
      {x1:0,y1:-40,x2:0,y2:40},          // PMOS gate → NMOS gate (input tied)
      {x1:60,y1:80,x2:60,y2:100}         // NMOS source → GND3
    ]},
  { id:'inv-opamp', name:'Evirici Op-Amp', color:'#f59e0b',
    desc:'Av = -Rf/Ri', formula:'Av = -10 (Ri=1k\u03A9, Rf=10k\u03A9)',
    parts:[
      {type:'vdc',x:-160,y:0,rot:0,val:1},
      {type:'resistor',x:-60,y:-20,rot:0,val:1000},
      {type:'resistor',x:20,y:-60,rot:0,val:10000},
      {type:'opamp',x:40,y:0,rot:0,val:100000},
      {type:'ground',x:-160,y:60,rot:0,val:0},
      {type:'ground',x:0,y:40,rot:0,val:0},
    ],
    wires:[{x1:-160,y1:-40,x2:-100,y2:-20},{x1:-20,y1:-20,x2:0,y2:15},{x1:-20,y1:-60,x2:0,y2:15},{x1:60,y1:-60,x2:80,y2:0},{x1:0,y1:-15,x2:0,y2:20}]},
  { id:'noninv-opamp', name:'Evirmeyen Op-Amp', color:'#f59e0b',
    desc:'Av = 1 + Rf/R1', formula:'Av = +10 (R1=1k\u03A9, Rf=9k\u03A9)',
    parts:[
      {type:'vdc',x:-160,y:0,rot:0,val:1},
      {type:'resistor',x:20,y:40,rot:1,val:1000},
      {type:'resistor',x:20,y:-60,rot:0,val:9000},
      {type:'opamp',x:40,y:0,rot:0,val:100000},
      {type:'ground',x:-160,y:60,rot:0,val:0},
      {type:'ground',x:20,y:80,rot:0,val:0},
    ],
    wires:[{x1:-160,y1:-40,x2:0,y2:-15},{x1:0,y1:15,x2:20,y2:0},{x1:60,y1:-60,x2:80,y2:0}]},
  { id:'zener-reg', name:'Zener Regülatör', color:'#ec4899',
    desc:'Vz ile sabit gerilim', formula:'Vin=12V, Vz=5.1V → Vout≈5.1V',
    // Sprint 29: Fixed wiring — zener rot=1: anode at top (-30), cathode at bottom (+30).
    // For reverse breakdown: cathode must be at HIGH side → flip with rot=3 and connect pin0(bottom) to R
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'resistor',x:0,y:-40,rot:0,val:1000},{type:'zener',x:80,y:0,rot:1,val:5.1},{type:'ground',x:0,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-40,y2:-40},{x1:40,y1:-40,x2:80,y2:30},{x1:80,y1:-30,x2:0,y2:60},{x1:-80,y1:40,x2:0,y2:60}]},
  { id:'vreg-7805', name:'7805 Regülatör', color:'#22c55e',
    desc:'Sabit 5V \u00e7\u0131k\u0131\u015f', formula:'Vin=9V \u2192 Vout=5V',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:9},{type:'vreg',x:20,y:0,rot:0,val:5},{type:'resistor',x:100,y:20,rot:1,val:1000},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:20,y:60,rot:0,val:0},{type:'ground',x:100,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:0},{x1:60,y1:0,x2:100,y2:-20},{x1:20,y1:30,x2:20,y2:40},{x1:100,y1:20,x2:100,y2:40}]},
  { id:'logic-demo', name:'Lojik Kap\u0131lar Demo', color:'#06b6d4',
    desc:'AND + OR + NOT', formula:'Temel dijital lojik',
    parts:[{type:'vdc',x:-120,y:-40,rot:0,val:5},{type:'vdc',x:-120,y:40,rot:0,val:0},{type:'and',x:0,y:0,rot:0,val:0},{type:'not',x:100,y:0,rot:0,val:0},{type:'ground',x:-120,y:80,rot:0,val:0},{type:'ground',x:-120,y:-80,rot:0,val:0}],
    wires:[{x1:-120,y1:-80,x2:-30,y2:-10},{x1:-120,y1:0,x2:-30,y2:10},{x1:30,y1:0,x2:70,y2:0}]},
  { id:'trafo', name:'Trafo Devresi', color:'#a855f7',
    desc:'Gerilim d\u00f6n\u00fc\u015ft\u00fcrme', formula:'220V \u2192 22V (10:1)',
    parts:[{type:'vac',x:-100,y:0,rot:0,val:220,freq:50},{type:'transformer',x:0,y:0,rot:0,val:10},{type:'resistor',x:80,y:0,rot:0,val:100},{type:'ground',x:-100,y:60,rot:0,val:0}],
    wires:[{x1:-100,y1:-40,x2:-30,y2:-20},{x1:-100,y1:40,x2:-30,y2:20},{x1:30,y1:-20,x2:50,y2:0},{x1:30,y1:20,x2:110,y2:0}]},
  { id:'dep-src', name:'Bağımlı Kaynak Demo', color:'#00e09e',
    desc:'VCVS ×10 kazanç', formula:'Vout = 10 × Vin',
    parts:[{type:'vdc',x:-100,y:0,rot:0,val:1},{type:'vcvs',x:20,y:0,rot:0,val:10},{type:'resistor',x:120,y:20,rot:1,val:1000},{type:'ground',x:-100,y:60,rot:0,val:0},{type:'ground',x:120,y:60,rot:0,val:0}],
    wires:[{x1:-100,y1:-40,x2:-20,y2:-15},{x1:-100,y1:40,x2:-20,y2:15},{x1:60,y1:-15,x2:120,y2:-20},{x1:60,y1:15,x2:120,y2:20}]},
  { id:'dc-sweep-led', name:'DC Sweep — LED I-V', color:'#eab308',
    desc:'LED diyot karakteristiği', formula:'V sweep 0→5V → I-V eğrisi',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:3},{type:'resistor',x:40,y:-40,rot:0,val:100},{type:'led',x:120,y:0,rot:1,val:0},{type:'ground',x:-60,y:60,rot:0,val:0},{type:'ground',x:120,y:60,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:120,y2:-30},{x1:120,y1:30,x2:120,y2:40}]},
  { id:'bode-rc', name:'Bode Plot — RC Filtre', color:'#3b82f6',
    desc:'Frekans cevabı', formula:'fc = 1/(2\u03C0RC) \u2248 1592 Hz',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:5,freq:1000},{type:'resistor',x:20,y:-40,rot:0,val:1000},{type:'capacitor',x:100,y:0,rot:1,val:100e-9},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:100,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:100,y2:-40}]},
  { id:'jfet-cs', name:'JFET Common Source', color:'#a855f7',
    desc:'JFET yükselteç', formula:'Av = -gm × RD',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'njfet',x:40,y:0,rot:0,val:0},{type:'resistor',x:80,y:-60,rot:1,val:4700},{type:'resistor',x:80,y:60,rot:1,val:1000},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:80,y:100,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:80,y2:-100},{x1:60,y1:-40,x2:80,y2:-20},{x1:60,y1:40,x2:80,y2:20},{x1:-80,y1:40,x2:-80,y2:60}]},
  { id:'scr-phase', name:'SCR Faz Kontrolü', color:'#f0454a',
    desc:'Tristör ile AC güç kontrolü', formula:'Gate pulse → SCR iletim',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:10,freq:50},{type:'scr',x:40,y:0,rot:0,val:0},{type:'resistor',x:120,y:0,rot:1,val:100},{type:'vdc',x:0,y:60,rot:0,val:2},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:10,y2:0},{x1:70,y1:0,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60},{x1:0,y1:20,x2:40,y2:30}]},
  { id:'param-sweep-rc', name:'Param Sweep — RC', color:'#00e09e',
    desc:'R değişince filtre cevabı', formula:'R: 100Ω → 10kΩ tarama',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:5,freq:1000},{type:'resistor',x:20,y:-40,rot:0,val:1000},{type:'capacitor',x:100,y:0,rot:1,val:100e-9},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:100,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:100,y2:-40}]},
  { id:'fft-square', name:'FFT — Kare Dalga', color:'#ec4899',
    desc:'Kare dalga harmonik analizi', formula:'THD ve harmonik bileşenler',
    parts:[{type:'pulse',x:-80,y:0,rot:0,val:5,freq:1000},{type:'resistor',x:40,y:0,rot:1,val:1000},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:40,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:40,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:40,y1:40,x2:40,y2:60}]},
  { id:'dff-toggle', name:'D Flip-Flop Toggle', color:'#06b6d4',
    desc:'CLK ile D toggling', formula:'Rising edge \u2192 Q = D',
    parts:[{type:'pulse',x:-80,y:0,rot:0,val:5,freq:100},{type:'dff',x:40,y:0,rot:0,val:0},{type:'resistor',x:120,y:0,rot:1,val:1000},{type:'ground',x:-80,y:60,rot:0,val:0},{type:'ground',x:120,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:10,y2:-12},{x1:-80,y1:-40,x2:10,y2:12},{x1:70,y1:-12,x2:120,y2:-40}]},
  { id:'lissajous', name:'Lissajous Demo', color:'#a855f7',
    desc:'\u0130ki AC kaynak, faz fark\u0131', formula:'X-Y modunda daire/elips',
    parts:[{type:'vac',x:-80,y:-40,rot:0,val:5,freq:1000},{type:'vac',x:-80,y:40,rot:0,val:5,freq:1000},{type:'resistor',x:40,y:-40,rot:0,val:1000},{type:'resistor',x:40,y:40,rot:0,val:1000},{type:'ground',x:-80,y:100,rot:0,val:0},{type:'ground',x:40,y:100,rot:0,val:0}],
    wires:[{x1:-80,y1:-80,x2:0,y2:-40},{x1:-80,y1:0,x2:0,y2:40},{x1:-80,y1:60,x2:-80,y2:80}]},
  { id:'diff-meas', name:'Diferansiyel \u00d6l\u00e7\u00fcm', color:'#ec4899',
    desc:'\u0130ki nokta aras\u0131 gerilim fark\u0131', formula:'V_diff = V1 - V2',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:10},{type:'resistor',x:0,y:-40,rot:0,val:1000},{type:'resistor',x:0,y:40,rot:0,val:2200},{type:'diffprobe',x:80,y:0,rot:0,val:0},{type:'ground',x:-80,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-40,y2:-40},{x1:40,y1:-40,x2:50,y2:0},{x1:40,y1:40,x2:110,y2:0},{x1:-80,y1:40,x2:-80,y2:60}]},
  { id:'ntc-sensor', name:'NTC S\u0131cakl\u0131k Sens\u00f6r\u00fc', color:'#f59e0b',
    desc:'S\u0131cakl\u0131k \u2192 diren\u00e7 de\u011fi\u015fimi', formula:'R=R0\u00d7e^(B\u00d7(1/T-1/T0))',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'ntc',x:40,y:-40,rot:0,val:10000},{type:'resistor',x:40,y:40,rot:0,val:10000},{type:'ground',x:-60,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:10,y2:-40},{x1:70,y1:-40,x2:70,y2:40},{x1:70,y1:40,x2:-60,y2:40},{x1:-60,y1:40,x2:-60,y2:60}]},
  { id:'ldr-sensor', name:'LDR I\u015f\u0131k Sens\u00f6r\u00fc', color:'#eab308',
    desc:'I\u015f\u0131k \u2192 diren\u00e7 de\u011fi\u015fimi', formula:'R: 1M\u03A9 (karanl\u0131k) \u2192 100\u03A9 (ayd\u0131nl\u0131k)',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'ldr',x:40,y:-40,rot:0,val:10000},{type:'resistor',x:40,y:40,rot:0,val:10000},{type:'ground',x:-60,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:10,y2:-40},{x1:70,y1:-40,x2:70,y2:40},{x1:70,y1:40,x2:-60,y2:40},{x1:-60,y1:40,x2:-60,y2:60}]},
  { id:'pot-divider', name:'Potansiyometre B\u00f6l\u00fcc\u00fc', color:'#00e09e',
    desc:'Wiper ile ayarlan\u0131r Vout', formula:'Vout = Vin \u00d7 wiper_pos',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:10},{type:'potentiometer',x:40,y:0,rot:0,val:10000},{type:'ground',x:-60,y:60,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:0},{x1:80,y1:0,x2:-60,y2:40}]},
  { id:'mc-rc', name:'Monte Carlo \u2014 RC Tolerans', color:'#a855f7',
    desc:'\u00B110% tolerans da\u011f\u0131l\u0131m\u0131', formula:'200 \u00e7al\u0131\u015ft\u0131rma, histogram',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:10},{type:'resistor',x:40,y:-40,rot:0,val:1000},{type:'resistor',x:40,y:40,rot:0,val:2200},{type:'ground',x:-60,y:80,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:80,y2:40},{x1:80,y1:40,x2:-60,y2:40},{x1:-60,y1:40,x2:-60,y2:60}]},
  { id:'crystal-osc', name:'Kristal Osilat\u00f6r', color:'#06b6d4',
    desc:'32.768 kHz kristal', formula:'f0 = 1/(2\u03C0\u221A(LC))',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:5},{type:'crystal',x:20,y:-40,rot:0,val:32768},{type:'resistor',x:20,y:40,rot:0,val:1e6},{type:'ground',x:-80,y:60,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-10,y2:-40},{x1:50,y1:-40,x2:50,y2:40},{x1:-10,y1:40,x2:-80,y2:40}]},
  { id:'dc-motor', name:'DC Motor Kontrol\u00fc', color:'#22c55e',
    desc:'Motor h\u0131z kontrol\u00fc', formula:'V=IR+Ke\u03C9',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:12},{type:'resistor',x:20,y:-40,rot:0,val:10},{type:'dcmotor',x:100,y:0,rot:1,val:0},{type:'ground',x:-60,y:60,rot:0,val:0},{type:'ground',x:100,y:60,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:100,y2:-30},{x1:100,y1:30,x2:100,y2:40}]},
  { id:'sens-demo', name:'Duyarl\u0131l\u0131k Analizi', color:'#00e09e',
    desc:'Hangi bile\u015fen en kritik?', formula:'\u2202Vout/\u2202R bar chart',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:10},{type:'resistor',x:20,y:-40,rot:0,val:1000},{type:'resistor',x:20,y:40,rot:0,val:2200},{type:'capacitor',x:80,y:0,rot:1,val:100e-9},{type:'ground',x:-60,y:60,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:-20,y2:-40},{x1:60,y1:40,x2:-60,y2:40}]},
  { id:'wc-demo', name:'Worst-Case Analizi', color:'#f0454a',
    desc:'Tolerans u\u00e7lar\u0131', formula:'Nominal vs \u00B110% en k\u00f6t\u00fc',
    parts:[{type:'vdc',x:-60,y:0,rot:0,val:10},{type:'resistor',x:20,y:-40,rot:0,val:1000},{type:'resistor',x:20,y:40,rot:0,val:2200},{type:'ground',x:-60,y:60,rot:0,val:0}],
    wires:[{x1:-60,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:60,y2:40},{x1:60,y1:40,x2:-60,y2:40}]},
  // ═══════════════════════════════════════════════
  // Sprint 27b: 20 Yeni Preset (36-55)
  // ═══════════════════════════════════════════════
  { id:'555-astable', name:'555 Astable', color:'#8e44ad',
    desc:'f = 1.44 / ((R1+2R2)*C)', formula:'~6.9 Hz blinker',
    parts:[{type:'vdc',x:-120,y:-80,rot:0,val:9},{type:'timer555',x:0,y:0,rot:0,val:0},{type:'resistor',x:-60,y:-60,rot:1,val:1000},{type:'resistor',x:60,y:-60,rot:1,val:10000},{type:'capacitor',x:-60,y:40,rot:1,val:10e-6},{type:'resistor',x:80,y:60,rot:1,val:330},{type:'led',x:80,y:120,rot:1,val:0},{type:'ground',x:-120,y:80,rot:0,val:0}],
    wires:[{x1:-120,y1:-120,x2:30,y2:-15},{x1:-120,y1:-120,x2:-30,y2:15},{x1:-120,y1:40,x2:-30,y2:-35},{x1:30,y1:0,x2:80,y2:30},{x1:80,y1:150,x2:-120,y2:40}]},
  { id:'555-mono', name:'555 Monostable', color:'#9b59b6',
    desc:'T = 1.1 * R * C', formula:'Button trigger → timed LED',
    parts:[{type:'vdc',x:-120,y:-80,rot:0,val:9},{type:'timer555',x:0,y:0,rot:0,val:0},{type:'resistor',x:-60,y:-60,rot:1,val:100000},{type:'capacitor',x:-60,y:40,rot:1,val:10e-6},{type:'pushButton',x:-60,y:-15,rot:0,val:0},{type:'resistor',x:80,y:60,rot:1,val:330},{type:'led',x:80,y:120,rot:1,val:0},{type:'ground',x:-120,y:80,rot:0,val:0}],
    wires:[{x1:-120,y1:-120,x2:30,y2:-15},{x1:-120,y1:-120,x2:-30,y2:15},{x1:30,y1:0,x2:80,y2:30},{x1:80,y1:150,x2:-120,y2:40}]},
  { id:'bjt-astable', name:'BJT Astable', color:'#e74c3c',
    desc:'Cross-coupled multivibrator', formula:'2 LED dönüşümlü',
    parts:[{type:'vdc',x:0,y:-120,rot:0,val:9},{type:'npn',x:-80,y:40,rot:0,val:0},{type:'npn',x:80,y:40,rot:0,val:0},{type:'resistor',x:-80,y:-40,rot:1,val:1000},{type:'resistor',x:80,y:-40,rot:1,val:1000},{type:'capacitor',x:0,y:0,rot:0,val:10e-6},{type:'resistor',x:0,y:-80,rot:0,val:10000},{type:'led',x:-80,y:-80,rot:1,val:0},{type:'led',x:80,y:-80,rot:1,val:0},{type:'ground',x:0,y:120,rot:0,val:0}],
    wires:[{x1:0,y1:-160,x2:-80,y2:-80},{x1:0,y1:-160,x2:80,y2:-80},{x1:-80,y1:80,x2:80,y2:80},{x1:80,y1:80,x2:0,y2:120}]},
  { id:'bridge-rect', name:'Köprü Doğrultucu', color:'#3498db',
    desc:'4 diyot tam dalga', formula:'Vout_peak ≈ Vpeak - 1.4V',
    // Sprint 103 (F-003): previous wiring had dangling segments (-30,-40)→(60,-40)
    // and (-30,40)→(60,40) that didn't reach D2/D4 anodes at (20,-40)/(20,40),
    // plus no wires to C1 pins (120,±40). Every pin was geometrically correct
    // but 4 of them lacked any wire endpoint within 25px snap range so the
    // solver saw them as floating. Rewired to connect every pin to its
    // intended neighbour: AC rails → anode rows → cathode rows → C1/R1.
    parts:[{type:'vac',x:-150,y:0,rot:0,val:12,freq:50},{type:'diode',x:-60,y:-40,rot:0,val:0},{type:'diode',x:60,y:-40,rot:0,val:0},{type:'diode',x:-60,y:40,rot:0,val:0},{type:'diode',x:60,y:40,rot:0,val:0},{type:'capacitor',x:120,y:0,rot:1,val:1000e-6},{type:'resistor',x:180,y:0,rot:1,val:1000},{type:'ground',x:-150,y:80,rot:0,val:0},{type:'ground',x:180,y:80,rot:0,val:0}],
    wires:[
      {x1:-150,y1:-40,x2:-90,y2:-40},
      {x1:-30,y1:-40,x2:30,y2:-40},
      {x1:90,y1:-40,x2:120,y2:-40},
      {x1:120,y1:-40,x2:180,y2:-40},
      {x1:-150,y1:40,x2:-90,y2:40},
      {x1:-30,y1:40,x2:30,y2:40},
      {x1:90,y1:40,x2:120,y2:40},
      {x1:120,y1:40,x2:180,y2:40},
      {x1:180,y1:40,x2:180,y2:60},
      {x1:-150,y1:40,x2:-150,y2:60}
    ]},
  { id:'vreg-7805-bypass', name:'7805 Filtreli Regülatör', color:'#2ecc71',
    desc:'12V → 5V + bypass kapasitör', formula:'Vout = 5V (±2%, filtreli)',
    parts:[{type:'vdc',x:-120,y:0,rot:0,val:12},{type:'vreg',x:0,y:0,rot:0,val:5,model:'7805'},{type:'capacitor',x:-60,y:40,rot:1,val:100e-6},{type:'capacitor',x:60,y:40,rot:1,val:100e-6},{type:'resistor',x:120,y:0,rot:1,val:1000},{type:'ground',x:0,y:80,rot:0,val:0}],
    wires:[{x1:-120,y1:-40,x2:-40,y2:0},{x1:40,y1:0,x2:120,y2:-40},{x1:120,y1:40,x2:0,y2:60},{x1:0,y1:30,x2:0,y2:60}]},
  { id:'class-a-amp', name:'Class-A CE Amp', color:'#e67e22',
    desc:'Gerilim kazancı Av ≈ -RC/RE', formula:'Av ≈ -2.2 (RC=2.2k, RE=1k)',
    parts:[{type:'vdc',x:-180,y:-60,rot:0,val:12},{type:'npn',x:0,y:0,rot:0,val:0,model:'2N2222'},{type:'resistor',x:-120,y:-40,rot:1,val:47000},{type:'resistor',x:-120,y:40,rot:1,val:10000},{type:'resistor',x:80,y:-60,rot:1,val:2200},{type:'resistor',x:0,y:80,rot:1,val:1000},{type:'capacitor',x:-60,y:-40,rot:0,val:10e-6},{type:'vac',x:-180,y:-40,rot:0,val:0.1,freq:1000},{type:'ground',x:-180,y:100,rot:0,val:0}],
    wires:[{x1:-180,y1:-100,x2:80,y2:-100},{x1:40,y1:-40,x2:80,y2:-100},{x1:-120,y1:0,x2:-40,y2:0},{x1:-120,y1:80,x2:0,y2:40},{x1:0,y1:120,x2:-180,y2:60},{x1:-180,y1:60,x2:-180,y2:80}]},
  { id:'diff-amp', name:'Differential Amp', color:'#f39c12',
    desc:'2 NPN, ortak emitter', formula:'Vout = RC×gm×(Vin+ - Vin-)',
    parts:[{type:'vdc',x:0,y:-120,rot:0,val:12},{type:'npn',x:-100,y:0,rot:0,val:0},{type:'npn',x:100,y:0,rot:0,val:0},{type:'resistor',x:-100,y:-80,rot:1,val:4700},{type:'resistor',x:100,y:-80,rot:1,val:4700},{type:'resistor',x:0,y:80,rot:1,val:10000},{type:'ground',x:0,y:160,rot:0,val:0}],
    wires:[{x1:0,y1:-160,x2:-100,y2:-120},{x1:0,y1:-160,x2:100,y2:-120},{x1:-100,y1:40,x2:0,y2:40},{x1:100,y1:40,x2:0,y2:40},{x1:0,y1:120,x2:0,y2:140}]},
  { id:'inst-amp', name:'Instrumentation Amp', color:'#f1c40f',
    desc:'3 op-amp yapı', formula:'Hassas fark yükseltme',
    parts:[{type:'vdc',x:-180,y:-100,rot:0,val:15},{type:'opamp',x:-80,y:-60,rot:0,val:0,model:'LM741'},{type:'opamp',x:-80,y:60,rot:0,val:0,model:'LM741'},{type:'opamp',x:80,y:0,rot:0,val:0,model:'LM741'},{type:'resistor',x:-40,y:0,rot:1,val:10000},{type:'resistor',x:-140,y:-60,rot:0,val:10000},{type:'resistor',x:-140,y:60,rot:0,val:10000},{type:'resistor',x:40,y:-40,rot:0,val:10000},{type:'resistor',x:40,y:40,rot:0,val:10000},{type:'ground',x:180,y:80,rot:0,val:0}],
    wires:[{x1:-180,y1:-140,x2:180,y2:-140},{x1:-40,y1:-60,x2:-40,y2:-20},{x1:-40,y1:20,x2:-40,y2:60},{x1:-40,y1:-60,x2:80,y2:-15},{x1:-40,y1:60,x2:80,y2:15},{x1:120,y1:0,x2:180,y2:80}]},
  { id:'push-pull', name:'Push-Pull Class-B', color:'#e91e63',
    desc:'NPN+PNP complementary', formula:'Crossover distortion eğitim',
    parts:[{type:'vdc',x:-120,y:-80,rot:0,val:12},{type:'vdc',x:-120,y:80,rot:0,val:12},{type:'npn',x:0,y:-40,rot:0,val:0,model:'2N2222'},{type:'pnp',x:0,y:40,rot:0,val:0,model:'2N3906'},{type:'vac',x:-80,y:0,rot:0,val:1,freq:1000},{type:'speaker',x:100,y:0,rot:0,val:8},{type:'ground',x:-120,y:160,rot:0,val:0}],
    wires:[{x1:-120,y1:-120,x2:0,y2:-80},{x1:-120,y1:120,x2:0,y2:80},{x1:-80,y1:-40,x2:-40,y2:-40},{x1:-80,y1:40,x2:-40,y2:40},{x1:40,y1:0,x2:100,y2:-25},{x1:100,y1:25,x2:-120,y2:120}]},
  { id:'sallen-key', name:'Sallen-Key LPF', color:'#9c27b0',
    desc:'2nd order Butterworth', formula:'fc ≈ 1.07 kHz, Q=0.707',
    parts:[{type:'vac',x:-180,y:0,rot:0,val:1,freq:1000},{type:'opamp',x:40,y:0,rot:0,val:0,model:'TL072'},{type:'resistor',x:-120,y:-20,rot:0,val:10000},{type:'resistor',x:-60,y:-20,rot:0,val:10000},{type:'capacitor',x:-60,y:40,rot:1,val:10e-9},{type:'capacitor',x:0,y:-60,rot:0,val:22e-9},{type:'ground',x:-180,y:60,rot:0,val:0},{type:'ground',x:-60,y:100,rot:0,val:0}],
    wires:[{x1:-180,y1:-40,x2:-140,y2:-20},{x1:-100,y1:-20,x2:-80,y2:-20},{x1:-40,y1:-20,x2:20,y2:-15},{x1:-60,y1:20,x2:-60,y2:60},{x1:-40,y1:-60,x2:80,y2:0},{x1:80,y1:0,x2:-60,y2:100}]},
  { id:'active-bpf', name:'Active Band-Pass', color:'#673ab7',
    desc:'Multiple feedback BPF', formula:'Merkez frek. + Q ayarlanabilir',
    parts:[{type:'vac',x:-180,y:0,rot:0,val:1,freq:1000},{type:'opamp',x:40,y:0,rot:0,val:0,model:'TL072'},{type:'resistor',x:-120,y:-20,rot:0,val:10000},{type:'resistor',x:-40,y:-60,rot:0,val:100000},{type:'capacitor',x:-60,y:-20,rot:0,val:10e-9},{type:'capacitor',x:-40,y:60,rot:1,val:10e-9},{type:'ground',x:-180,y:60,rot:0,val:0}],
    wires:[{x1:-180,y1:-40,x2:-140,y2:-20},{x1:-100,y1:-20,x2:-80,y2:-20},{x1:-40,y1:-20,x2:20,y2:15},{x1:-60,y1:0,x2:-60,y2:40},{x1:-40,y1:-60,x2:80,y2:0}]},
  { id:'ldr-led', name:'LDR Işık Sensörü', color:'#cddc39',
    desc:'LDR direnç değişimi', formula:'Işık ↑ → LDR R ↓',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:5},{type:'ldr',x:40,y:-40,rot:0,val:10000},{type:'resistor',x:120,y:0,rot:1,val:10000},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60}]},
  { id:'ntc-alarm', name:'NTC Sıcaklık Alarmı', color:'#ff5722',
    desc:'Sıcaklık artınca buzzer', formula:'NTC ↓R → Vout ↑ → alarm',
    parts:[{type:'vdc',x:-180,y:0,rot:0,val:5},{type:'ntc',x:-80,y:-60,rot:1,val:10000},{type:'resistor',x:-80,y:60,rot:1,val:10000},{type:'opamp',x:40,y:0,rot:0,val:0,model:'LM358'},{type:'resistor',x:-40,y:40,rot:0,val:10000},{type:'buzzer',x:140,y:0,rot:0,val:40},{type:'ground',x:-180,y:120,rot:0,val:0}],
    wires:[{x1:-180,y1:-40,x2:-80,y2:-100},{x1:-80,y1:-20,x2:0,y2:-15},{x1:-180,y1:100,x2:-80,y2:100},{x1:-180,y1:40,x2:-180,y2:100},{x1:-40,y1:40,x2:0,y2:15},{x1:80,y1:0,x2:140,y2:-25},{x1:140,y1:25,x2:-180,y2:120}]},
  { id:'led-chaser', name:'LED Chaser (Basit)', color:'#ff9800',
    desc:'3 LED sıralı yakar', formula:'555 clock → counter',
    parts:[{type:'pulse',x:-120,y:0,rot:0,val:5,freq:2},{type:'resistor',x:-20,y:-60,rot:1,val:220},{type:'led',x:-20,y:-140,rot:1,val:0},{type:'resistor',x:40,y:-60,rot:1,val:220},{type:'led',x:40,y:-140,rot:1,val:0},{type:'resistor',x:100,y:-60,rot:1,val:220},{type:'led',x:100,y:-140,rot:1,val:0},{type:'ground',x:-120,y:60,rot:0,val:0}],
    wires:[{x1:-120,y1:-40,x2:-20,y2:-40},{x1:-120,y1:-40,x2:40,y2:-40},{x1:-120,y1:-40,x2:100,y2:-40},{x1:-20,y1:-100,x2:-20,y2:-120},{x1:40,y1:-100,x2:40,y2:-120},{x1:100,y1:-100,x2:100,y2:-120},{x1:-20,y1:-180,x2:100,y2:-180}]},
  { id:'binary-counter', name:'Binary Counter 4-bit', color:'#00bcd4',
    desc:'Clock → 0000-1111 döngü', formula:'4 LED binary gösterir',
    parts:[{type:'pulse',x:-180,y:0,rot:0,val:5,freq:1},{type:'counter',x:0,y:0,rot:0,val:0},{type:'resistor',x:80,y:-80,rot:1,val:220},{type:'resistor',x:120,y:-80,rot:1,val:220},{type:'resistor',x:160,y:-80,rot:1,val:220},{type:'resistor',x:200,y:-80,rot:1,val:220},{type:'led',x:80,y:-160,rot:1,val:0},{type:'led',x:120,y:-160,rot:1,val:0},{type:'led',x:160,y:-160,rot:1,val:0},{type:'led',x:200,y:-160,rot:1,val:0},{type:'ground',x:-180,y:80,rot:0,val:0}],
    wires:[{x1:-180,y1:-40,x2:-60,y2:0},{x1:-180,y1:40,x2:-180,y2:60}]},
  { id:'h-bridge', name:'H-Bridge Motor', color:'#4caf50',
    desc:'4 transistör, motor yön kontrolü', formula:'2 kontrol sinyali',
    parts:[{type:'vdc',x:0,y:-120,rot:0,val:12},{type:'npn',x:-120,y:-40,rot:0,val:0},{type:'npn',x:120,y:-40,rot:0,val:0},{type:'pnp',x:-120,y:40,rot:0,val:0},{type:'pnp',x:120,y:40,rot:0,val:0},{type:'dcmotor',x:0,y:0,rot:0,val:5},{type:'ground',x:0,y:120,rot:0,val:0}],
    wires:[{x1:0,y1:-160,x2:-120,y2:-80},{x1:0,y1:-160,x2:120,y2:-80},{x1:-120,y1:0,x2:-40,y2:0},{x1:120,y1:0,x2:40,y2:0},{x1:-120,y1:80,x2:0,y2:120},{x1:120,y1:80,x2:0,y2:120}]},
  { id:'relay-ctrl', name:'Röle Kontrol Basit', color:'#795548',
    desc:'Anahtar → röle bobini', formula:'Coil aktif → kontak kapanır',
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'switch',x:30,y:-40,rot:0,val:0,closed:true},{type:'relay',x:120,y:0,rot:0,val:0},{type:'ground',x:-80,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:0,y2:-40},{x1:60,y1:-40,x2:80,y2:-20},{x1:80,y1:20,x2:-80,y2:60},{x1:-80,y1:40,x2:-80,y2:60}]},
  { id:'trafo-demo', name:'Transformatör 1:1', color:'#607d8b',
    desc:'Primer=Sekonder L → gerilim izolasyonu', formula:'Vs ≈ Vp (K=0.99)',
    parts:[{type:'vac',x:-150,y:0,rot:0,val:10,freq:50},{type:'transformer',x:0,y:0,rot:0,val:10,L1:0.01,L2:0.01,coupling:0.99},{type:'resistor',x:150,y:0,rot:1,val:1000},{type:'ground',x:-150,y:80,rot:0,val:0},{type:'ground',x:150,y:80,rot:0,val:0}],
    wires:[{x1:-150,y1:-40,x2:-30,y2:-20},{x1:-150,y1:40,x2:-30,y2:20},{x1:30,y1:-20,x2:150,y2:-40},{x1:30,y1:20,x2:150,y2:40},{x1:-150,y1:40,x2:-150,y2:60},{x1:150,y1:40,x2:150,y2:60}]},
  { id:'speaker-demo', name:'Hoparlör Ses Çıkışı', color:'#8b5cf6',
    desc:'AC source → speaker', formula:'Ses dalga formu çıkışı',
    parts:[{type:'vac',x:-80,y:0,rot:0,val:3,freq:440},{type:'resistor',x:20,y:-40,rot:0,val:10},{type:'speaker',x:100,y:0,rot:0,val:8},{type:'ground',x:-80,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:-20,y2:-40},{x1:60,y1:-40,x2:100,y2:-25},{x1:100,y1:25,x2:-80,y2:60},{x1:-80,y1:40,x2:-80,y2:60}]},
  { id:'dc-motor-simple', name:'DC Motor Basit', color:'#009688',
    desc:'Batarya → motor', formula:'I = V/Ra ≈ 1.2A (12V, 10Ω)',
    // Sprint 29: Fixed wiring — exact pin-to-pin
    // dcmotor rot=1: pins (100,-30) and (100,30). vdc pins (-80,-40) and (-80,40). ground at (0,80) pin (0,60).
    parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'dcmotor',x:100,y:0,rot:1,val:10},{type:'ground',x:10,y:80,rot:0,val:0}],
    wires:[{x1:-80,y1:-40,x2:100,y2:-30},{x1:100,y1:30,x2:10,y2:60},{x1:-80,y1:40,x2:10,y2:60}]},
];

(function buildPalette() {
  const cats = { Passive: 'Pasif (Passive)', Sources: 'Kaynaklar (Sources)', Semi: 'Yarıiletken (Semiconductor)', ICs: 'Entegre (ICs)', Logic: 'Lojik (Logic)', Control: 'Kontrol (Control)', Basic: 'Temel (Basic)' };
  const el = document.getElementById('left');
  for (const [ck, cl] of Object.entries(cats)) {
    const items = Object.entries(COMP).filter(([, v]) => v.cat === ck);
    if (!items.length) continue;
    const hdr = document.createElement('div');
    hdr.className = 'cat-header open';
    hdr.innerHTML = `<span>${cl}</span><span class="arrow">&#9654;</span>`;
    const body = document.createElement('div');
    body.className = 'cat-body'; body.style.maxHeight = '400px';
    items.forEach(([k, v]) => {
      const d = document.createElement('div'); d.className = 'comp-item';
      d.innerHTML = `<span style="display:flex;align-items:center"><span class="dot" style="background:${v.color}"></span>${v.name}</span>${v.key ? '<span class="key">'+v.key+'</span>' : ''}`;
      d.addEventListener('click', () => startPlace(k));
      body.appendChild(d);
    });
    hdr.addEventListener('click', () => { hdr.classList.toggle('open'); body.classList.toggle('closed'); });
    el.appendChild(hdr); el.appendChild(body);
  }
  // Preset section
  const psec = document.createElement('div');
  psec.innerHTML = '<div style="margin-top:16px;padding:8px;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;border-top:2px solid var(--accent);border-radius:0">&#9889; Hazır Devreler (Presets)</div>';
  el.appendChild(psec);
  PRESETS.forEach(pr => {
    const d = document.createElement('div'); d.className = 'comp-item';
    d.innerHTML = `<span style="display:flex;align-items:center"><span class="dot" style="background:${pr.color}"></span>${pr.name}</span>`;
    d.addEventListener('click', () => loadPreset(pr.id));
    el.appendChild(d);
  });
})();