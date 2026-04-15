// ──────── 5.1: INTERACTIVE TUTORIAL SYSTEM ────────
var TUTORIALS = [
  { id:'ohm', title:{tr:'Ohm Yasası',en:"Ohm's Law"}, level:1,
    desc:{tr:'Direnç, gerilim ve akım arasındaki temel ilişkiyi öğrenin.',en:'Learn the fundamental relationship between resistance, voltage and current.'},
    steps:[
      {text:{tr:'Bu devrede 5V kaynak ve 1kΩ direnç var. Simülasyonu başlatın (Space).',en:'This circuit has a 5V source and 1kΩ resistor. Start simulation (Space).'},
       validate:function(){return S.sim.running;}},
      {text:{tr:'Direnci seçin ve akım değerini okuyun. V=IR: I=5V/1kΩ=5mA.',en:'Select the resistor and read current. V=IR: I=5V/1kΩ=5mA.'},
       validate:function(){return S.sel.length>0;}},
      {text:{tr:'Direnci 2.2kΩ yapın (çift tıklayıp "2.2k" yazın). Akım nasıl değişti?',en:'Change R to 2.2kΩ. How did current change?'},
       validate:function(){var r=S.parts.find(function(p){return p.type==='resistor';}); return r&&r.val>2000&&r.val<2500;}},
    ],
    circuit:{parts:[{type:'vdc',x:0,y:0,rot:0,val:5},{type:'resistor',x:100,y:-60,rot:0,val:1000},{type:'ground',x:0,y:100,rot:0,val:0}],
      wires:[{x1:0,y1:-40,x2:60,y2:-60},{x1:140,y1:-60,x2:100,y2:100},{x1:0,y1:40,x2:0,y2:80}]},
    complete:{tr:'🎉 Tebrikler! Ohm Yasasını öğrendiniz: V = I × R',en:"🎉 Congratulations! You learned Ohm's Law: V = I × R"} },
  { id:'led', title:{tr:'LED Yakma',en:'Lighting an LED'}, level:1,
    desc:{tr:'LED için doğru direnci hesaplayıp LED yakın.',en:'Calculate the correct resistor for an LED.'},
    steps:[
      {text:{tr:'R = (Vs-Vf)/I = (5V-2V)/20mA = 150Ω. Direnci 150Ω yapın.',en:'R = (Vs-Vf)/I = (5V-2V)/20mA = 150Ω. Set R to 150Ω.'},
       validate:function(){var r=S.parts.find(function(p){return p.type==='resistor';}); return r&&r.val>130&&r.val<170;}},
      {text:{tr:'Simülasyonu başlatın. LED yanıyor mu?',en:'Start simulation. Is the LED on?'},
       validate:function(){return S.sim.running;}},
      {text:{tr:'Direnci 10Ω yapın — ne olacağını görün! (Gerçekçi mod açık olmalı)',en:'Set R to 10Ω and see what happens! (Realistic mode must be ON)'},
       validate:function(){var r=S.parts.find(function(p){return p.type==='resistor';}); return r&&r.val<=15;}},
    ],
    circuit:{parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'resistor',x:40,y:-40,rot:0,val:220},{type:'led',x:120,y:0,rot:1,val:0},{type:'ground',x:-60,y:80,rot:0,val:0}],
      wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:120,y2:-30},{x1:120,y1:30,x2:-60,y2:40},{x1:-60,y1:40,x2:-60,y2:60}]},
    complete:{tr:'🎉 LED doğru dirençle çalıştı, yanlış dirençle patladı!',en:'🎉 LED worked with correct resistance and exploded with wrong!'} },
  { id:'rc-filter', title:{tr:'RC Filtre',en:'RC Filter'}, level:1,
    desc:{tr:'Alçak geçiren RC filtre kurun ve Bode plot ile analiz edin.',en:'Build a low-pass RC filter and analyze with Bode plot.'},
    steps:[
      {text:{tr:'Bu alçak geçiren filtre. fc = 1/(2πRC) ≈ 1kHz. Simülasyonu başlatın.',en:'This is a low-pass filter. fc = 1/(2πRC) ≈ 1kHz. Start simulation.'},
       validate:function(){return S.sim.running;}},
      {text:{tr:'Bode Plot sekmesine geçin ve analizi çalıştırın.',en:'Switch to Bode Plot tab and run the analysis.'},
       validate:function(){return true;}},
      {text:{tr:'R değerini 10kΩ yapın. Kesim frekansı nasıl değişti?',en:'Change R to 10kΩ. How did the cutoff change?'},
       validate:function(){var r=S.parts.find(function(p){return p.type==='resistor';}); return r&&r.val>9000&&r.val<11000;}},
    ],
    circuit:{parts:[{type:'vac',x:-80,y:0,rot:0,val:5,freq:1000},{type:'resistor',x:40,y:-60,rot:0,val:1000},{type:'capacitor',x:120,y:0,rot:1,val:100e-9},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
      wires:[{x1:-80,y1:-40,x2:0,y2:-60},{x1:80,y1:-60,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60}]},
    complete:{tr:'🎉 RC filtresini öğrendiniz! R veya C artınca fc düşer.',en:'🎉 You learned RC filters! Higher R or C means lower cutoff.'} },
  { id:'vdiv-tut', title:{tr:'Gerilim Bölücü',en:'Voltage Divider'}, level:1,
    desc:{tr:'İki direnç ile gerilim bölücü devre kurun.',en:'Build a voltage divider with two resistors.'},
    steps:[
      {text:{tr:'Vout = Vin×R2/(R1+R2) = 12×10k/(10k+10k) = 6V. Simülasyonu başlatın.',en:'Vout = Vin×R2/(R1+R2) = 12×10k/(10k+10k) = 6V. Start simulation.'},
       validate:function(){return S.sim.running;}},
      {text:{tr:'İkinci direnci 4.7kΩ yapın. Vout ≈ 3.84V olmalı.',en:'Change the second R to 4.7kΩ. Vout ≈ 3.84V.'},
       validate:function(){var rs=S.parts.filter(function(p){return p.type==='resistor';}); return rs.length>=2&&rs.some(function(r){return r.val>4000&&r.val<5500;});}},
    ],
    circuit:{parts:[{type:'vdc',x:-80,y:0,rot:0,val:12},{type:'resistor',x:20,y:-60,rot:0,val:10000},{type:'resistor',x:120,y:0,rot:1,val:10000},{type:'ground',x:-80,y:80,rot:0,val:0},{type:'ground',x:120,y:80,rot:0,val:0}],
      wires:[{x1:-80,y1:-40,x2:-20,y2:-60},{x1:60,y1:-60,x2:120,y2:-40},{x1:-80,y1:40,x2:-80,y2:60},{x1:120,y1:40,x2:120,y2:60}]},
    complete:{tr:'🎉 Gerilim bölücü: Vout = Vin × R2/(R1+R2)',en:'🎉 Voltage divider: Vout = Vin × R2/(R1+R2)'} },
  { id:'cap-charge', title:{tr:'Kapasitör Şarj/Deşarj',en:'Capacitor Charge/Discharge'}, level:1,
    desc:{tr:'RC devresinde kapasitör şarj eğrisini izleyin.',en:'Watch capacitor charge curves in an RC circuit.'},
    steps:[
      {text:{tr:'τ = RC = 1kΩ × 1µF = 1ms. Simülasyonu başlatın.',en:'τ = RC = 1kΩ × 1µF = 1ms. Start simulation.'},
       validate:function(){return S.sim.running;}},
      {text:{tr:'Osiloskoptan kapasitör geriliminin yükselişini izleyin. 1τ sonra %63, 3τ sonra %95.',en:'Watch the capacitor voltage rise. After 1τ: 63%, after 3τ: 95%.'},
       validate:function(){return true;}},
    ],
    circuit:{parts:[{type:'vdc',x:-60,y:0,rot:0,val:5},{type:'resistor',x:40,y:-40,rot:0,val:1000},{type:'capacitor',x:140,y:0,rot:1,val:1e-6},{type:'ground',x:-60,y:80,rot:0,val:0},{type:'ground',x:140,y:80,rot:0,val:0}],
      wires:[{x1:-60,y1:-40,x2:0,y2:-40},{x1:80,y1:-40,x2:140,y2:-40},{x1:-60,y1:40,x2:-60,y2:60},{x1:140,y1:40,x2:140,y2:60}]},
    complete:{tr:'🎉 RC zaman sabiti: τ = RC, %63 şarj = 1τ, %95 = 3τ',en:'🎉 RC time constant: τ = RC, 63% charge = 1τ, 95% = 3τ'} },
];

var _tutActive = null, _tutStep = 0, _tutValidator = null;

function showTutorialList() {
  var box = document.getElementById('tutorial-list-box');
  var progress = JSON.parse(localStorage.getItem('vxa_tutorials') || '{}');
  var completed = 0;
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<h2 style="font:600 18px var(--font-ui);color:var(--accent)">📖 ' + (currentLang==='tr'?'İnteraktif Dersler':'Interactive Tutorials') + '</h2>'
    + '<button style="font-size:20px;color:var(--text-3);cursor:pointer;background:none;border:none" onclick="document.getElementById(\'tutorial-list-modal\').classList.remove(\'show\')">&times;</button></div>';
  // Sprint 36: Group by level (5 levels)
  var levelNames = currentLang === 'tr' ? {
    1:'Seviye 1 \u2014 Temel Elektronik',
    2:'Seviye 2 \u2014 Yar\u0131iletkenler',
    3:'Seviye 3 \u2014 Analog Tasar\u0131m',
    4:'Seviye 4 \u2014 Dijital Elektronik',
    5:'Seviye 5 \u2014 Proje'
  } : {
    1:'Level 1 \u2014 Basics',
    2:'Level 2 \u2014 Semiconductors',
    3:'Level 3 \u2014 Analog Design',
    4:'Level 4 \u2014 Digital Electronics',
    5:'Level 5 \u2014 Capstone Projects'
  };
  for (var lvl = 1; lvl <= 5; lvl++) {
    var lessonsAtLvl = TUTORIALS.filter(function(t) { return (t.level || 1) === lvl; });
    if (lessonsAtLvl.length === 0) continue;
    var doneAtLvl = lessonsAtLvl.filter(function(t) { return progress[t.id] && progress[t.id].completed; }).length;
    html += '<div style="font:600 12px var(--font-ui);color:var(--accent);margin:14px 0 8px 0;display:flex;justify-content:space-between">'
      + '<span>' + levelNames[lvl] + '</span>'
      + '<span style="color:var(--text-3);font-weight:400">' + doneAtLvl + '/' + lessonsAtLvl.length + '</span>'
      + '</div>';
    lessonsAtLvl.forEach(function(tut) {
      var done = progress[tut.id] && progress[tut.id].completed;
      if (done) completed++;
      var title = tut.title[currentLang] || tut.title.tr;
      var desc = tut.desc[currentLang] || tut.desc.tr;
      var stars = '';
      for (var s = 0; s < 5; s++) stars += s < (tut.level||1) ? '\u2B50' : '\u2606';
      html += '<div class="tut-list-item" onclick="startTutorial(\'' + tut.id + '\')">'
        + '<div><div class="tl-title">' + title + (done?' \u2705':'') + '</div>'
        + '<div class="tl-desc">' + desc + '</div></div>'
        + '<div class="tl-badge"><div style="font-size:9px;letter-spacing:-1px">' + stars + '</div>' + (currentLang==='tr'?'Ba\u015fla \u2192':'Start \u2192') + '</div></div>';
    });
  }
  var pct = Math.round(completed / TUTORIALS.length * 100);
  html += '<div style="margin-top:12px;font:11px var(--font-mono);color:var(--text-3)">' + (currentLang==='tr'?'İlerleme':'Progress') + ': ' + completed + '/' + TUTORIALS.length + '</div>';
  html += '<div class="tut-progress"><div class="tut-progress-bar" style="width:' + pct + '%"></div></div>';
  box.innerHTML = html;
  document.getElementById('tutorial-list-modal').classList.add('show');
}

function startTutorial(id) {
  var tut = TUTORIALS.find(function(t) { return t.id === id; });
  if (!tut) return;
  document.getElementById('tutorial-list-modal').classList.remove('show');
  _tutActive = tut; _tutStep = 0;
  // Load circuit
  saveUndo();
  S.parts = []; S.wires = []; S.nextId = 1; S.sel = [];
  if (S.sim.running) toggleSim();
  tut.circuit.parts.forEach(function(p) {
    S.parts.push({ id: S.nextId++, type: p.type, name: nextName(p.type), x: p.x, y: p.y, rot: p.rot || 0, val: p.val, freq: p.freq || 0, flipH: false, flipV: false, closed: p.closed || false });
  });
  tut.circuit.wires.forEach(function(w) { S.wires.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }); });
  fitToScreen(); needsRender = true;
  _showTutStep();
  // Start validator
  if (_tutValidator) clearInterval(_tutValidator);
  _tutValidator = setInterval(_checkTutStep, 500);
}

function _showTutStep() {
  if (!_tutActive) return;
  var runner = document.getElementById('tut-runner');
  var step = _tutActive.steps[_tutStep];
  var title = _tutActive.title[currentLang] || _tutActive.title.tr;
  var text = step.text[currentLang] || step.text.tr;
  runner.innerHTML = '<div class="tr-header"><div class="tr-title">📖 ' + title + '</div>'
    + '<div class="tr-step">' + (currentLang==='tr'?'Adım':'Step') + ' ' + (_tutStep+1) + '/' + _tutActive.steps.length + '</div></div>'
    + '<div class="tr-text">' + text + '</div>'
    + '<div class="tr-actions">'
    + '<button class="tr-btn tr-btn-skip" onclick="endTutorialRunner()">' + (currentLang==='tr'?'Kapat ✕':'Close ✕') + '</button>'
    + '<button class="tr-btn tr-btn-next" id="tut-next-btn" onclick="nextTutorialStep()">' + (currentLang==='tr'?'Sonraki →':'Next →') + '</button></div>';
  runner.style.display = 'block';
}

function _checkTutStep() {
  if (!_tutActive) return;
  var step = _tutActive.steps[_tutStep];
  if (step.validate()) {
    var btn = document.getElementById('tut-next-btn');
    if (btn) { btn.classList.add('ready'); btn.style.background = 'var(--accent)'; }
  }
}

function nextTutorialStep() {
  if (!_tutActive) return;
  _tutStep++;
  if (_tutStep >= _tutActive.steps.length) {
    _completeTutorial();
    return;
  }
  _showTutStep();
}

function _completeTutorial() {
  if (_tutValidator) { clearInterval(_tutValidator); _tutValidator = null; }
  var runner = document.getElementById('tut-runner');
  var msg = _tutActive.complete[currentLang] || _tutActive.complete.tr;
  runner.innerHTML = '<div style="text-align:center;padding:12px">'
    + '<div style="font:600 16px var(--font-ui);color:var(--accent);margin-bottom:8px">' + msg + '</div>'
    + '<button class="tr-btn tr-btn-next" onclick="endTutorialRunner()" style="margin-top:8px">' + (currentLang==='tr'?'Tamam':'OK') + '</button></div>';
  // Save progress
  var progress = JSON.parse(localStorage.getItem('vxa_tutorials') || '{}');
  progress[_tutActive.id] = { completed: true, date: Date.now() };
  localStorage.setItem('vxa_tutorials', JSON.stringify(progress));
  _tutActive = null; _tutStep = 0;
}

function endTutorialRunner() {
  if (_tutValidator) { clearInterval(_tutValidator); _tutValidator = null; }
  _tutActive = null; _tutStep = 0;
  document.getElementById('tut-runner').style.display = 'none';
}
