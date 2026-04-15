// ──────── SPRINT 36: 20 NEW LESSONS (Levels 2-5) ────────
// Adds 20 lessons to existing TUTORIALS (5 from tutorials.js) → 25 total
// Each lesson: id, title{tr,en}, level (2-5), order (1-5), desc, circuit, steps, quiz
// Quiz: array of {question{tr,en}, options[4], correct:0-3}

(function() {
  if (typeof TUTORIALS === 'undefined') return;

  // Helper to construct circuit from existing preset reference
  function presetRef(presetId) {
    return { presetRef: presetId, parts: [], wires: [] };
  }

  var NEW_LESSONS = [
    // ═══════════ LEVEL 2 — YARIİLETKENLER ═══════════
    {
      id:'diode-iv', level:2, order:1,
      title:{tr:'Diyot I-V Eğrisi', en:'Diode I-V Curve'},
      desc:{tr:'Silikon diyodun karakteristiğini keşfedin.',en:'Discover silicon diode characteristics.'},
      circuit:{
        parts:[{type:'vdc',x:-100,y:0,rot:0,val:1},{type:'diode',x:0,y:-40,rot:0,val:0,model:'1N4148'},
               {type:'resistor',x:100,y:0,rot:1,val:1000},{type:'ground',x:-100,y:80,rot:0,val:0},{type:'ground',x:100,y:80,rot:0,val:0}],
        wires:[{x1:-100,y1:-40,x2:-40,y2:-40},{x1:40,y1:-40,x2:100,y2:-40},
               {x1:-100,y1:40,x2:-100,y2:60},{x1:100,y1:40,x2:100,y2:60}]
      },
      steps:[
        {text:{tr:'Silikon diyot tek yönde akım geçirir. Simülasyonu başlatın.',en:'Silicon diode passes current one way. Start simulation.'},
         validate:function(){return S.sim.running;}},
        {text:{tr:'Vf ≈ 0.65V — eşik voltajı. Altında akım neredeyse sıfır.',en:'Vf ≈ 0.65V — threshold. Below this, current is near zero.'},
         validate:function(){return true;}},
        {text:{tr:'DC Sweep analizini açıp 0-2V tarama yapın.',en:'Open DC Sweep and run a 0-2V sweep.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'Silikon diyodun tipik Vf değeri nedir?',en:'Typical Vf of silicon diode?'},options:['0.3V','0.7V','1.5V','3.3V'],correct:1}],
      complete:{tr:'🎉 Diyot karakteristiğini öğrendiniz!',en:'🎉 You learned diode characteristics!'}
    },
    {
      id:'rectifier-tut', level:2, order:2,
      title:{tr:'Doğrultucu — AC\'den DC\'ye',en:'Rectifier — AC to DC'},
      desc:{tr:'AC sinyali DC\'ye çeviren devreler.',en:'Circuits that convert AC to DC.'},
      circuit:{
        parts:[{type:'vac',x:-120,y:0,rot:0,val:10,freq:50},{type:'diode',x:-20,y:-40,rot:0,val:0,model:'1N4007'},
               {type:'resistor',x:80,y:0,rot:1,val:1000},{type:'ground',x:-120,y:80,rot:0,val:0},{type:'ground',x:80,y:80,rot:0,val:0}],
        wires:[{x1:-120,y1:-40,x2:-60,y2:-40},{x1:20,y1:-40,x2:80,y2:-40},
               {x1:-120,y1:40,x2:-120,y2:60},{x1:80,y1:40,x2:80,y2:60}]
      },
      steps:[
        {text:{tr:'AC kaynak sinüsoidal voltaj üretir. Simülasyonu başlatın.',en:'AC source produces sinusoidal voltage. Start simulation.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Diyot sadece pozitif yarım dalgayı geçirir → yarım dalga doğrultucu.',en:'Diode passes only positive half → half-wave rectifier.'},validate:function(){return true;}},
        {text:{tr:'Çıkışta sadece pozitif tepeler — bu DC değil ama DC\'ye doğru ilk adım.',en:'Output has only positive peaks — first step toward DC.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'Tam dalga köprü doğrultucuda kaç diyot vardır?',en:'How many diodes in a full-wave bridge rectifier?'},options:['1','2','4','6'],correct:2}],
      complete:{tr:'🎉 Doğrultucu prensiplerini öğrendiniz!',en:'🎉 You learned rectifier principles!'}
    },
    {
      id:'bjt-switch-tut', level:2, order:3,
      title:{tr:'BJT Anahtarlama',en:'BJT Switching'},
      desc:{tr:'Transistörle LED kontrolü — küçük akım büyük akımı yönetir.',en:'Control LED with transistor — small current controls big current.'},
      circuit:'npn-sw',
      steps:[
        {text:{tr:'NPN transistör elektronik anahtardır. Base akımı → Collector akımı.',en:'NPN transistor is an electronic switch. Base current controls collector current.'},validate:function(){return true;}},
        {text:{tr:'Switch\'i kapatın. LED yandı! Base\'e küçük akım, Collector\'da büyük akım.',en:'Close switch. LED ON! Small base current, large collector current.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Bu kazanç β (beta). Tipik β=100-300.',en:'This is gain β (beta). Typical β=100-300.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'β=200 olan BJT\'de Ib=10µA ise Ic kaç mA?',en:'BJT with β=200, Ib=10µA, Ic=?'},options:['0.2mA','1mA','2mA','20mA'],correct:2}],
      complete:{tr:'🎉 BJT anahtarlama: küçük güç → büyük güç kontrol!',en:'🎉 BJT switching: small power controls large power!'}
    },
    {
      id:'mosfet-switch-tut', level:2, order:4,
      title:{tr:'MOSFET Anahtarlama',en:'MOSFET Switching'},
      desc:{tr:'Voltaj kontrollü anahtar — gate akımı çekmez.',en:'Voltage-controlled switch — no gate current.'},
      circuit:{
        parts:[{type:'vdc',x:-120,y:0,rot:0,val:12},{type:'resistor',x:0,y:-60,rot:1,val:100},
               {type:'nmos',x:60,y:0,rot:0,val:0},{type:'vdc',x:-120,y:80,rot:0,val:5},
               {type:'ground',x:-120,y:140,rot:0,val:0},{type:'ground',x:60,y:80,rot:0,val:0}],
        wires:[{x1:-120,y1:-40,x2:0,y2:-100},{x1:0,y1:-20,x2:60,y2:0},
               {x1:-120,y1:40,x2:-120,y2:60},{x1:-120,y1:120,x2:-120,y2:120},
               {x1:60,y1:40,x2:60,y2:60}]
      },
      steps:[
        {text:{tr:'MOSFET gate voltajı ile drain akımını kontrol eder. BJT\'den farklı: gate akımı sıfır.',en:'MOSFET: gate voltage controls drain current. Unlike BJT: zero gate current.'},validate:function(){return true;}},
        {text:{tr:'Vgs > Vth (eşik) olunca MOSFET açılır. NMOS Vth ≈ 2V.',en:'When Vgs > Vth, MOSFET turns on. NMOS Vth ≈ 2V.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Avantaj: dijital lojik için ideal — sıfır gate akımı, düşük güç tüketimi.',en:'Advantage: ideal for digital logic — zero gate current, low power.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'MOSFET gate akımı nedir?',en:'MOSFET gate current?'},options:['Çok yüksek','Çok düşük','≈ 0','Vgs\'e bağlı'],correct:2}],
      complete:{tr:'🎉 MOSFET: gerilim kontrollü, sıfır gate akımı!',en:'🎉 MOSFET: voltage-controlled, zero gate current!'}
    },
    {
      id:'zener-tut', level:2, order:5,
      title:{tr:'Zener Regülatör',en:'Zener Regulator'},
      desc:{tr:'Sabit voltaj — kaynak değişse bile çıkış aynı.',en:'Constant voltage — output same even when source varies.'},
      circuit:'zener-reg',
      steps:[
        {text:{tr:'Zener diyot ters bağlandığında sabit Vz voltajı düşürür.',en:'Zener diode in reverse: drops fixed Vz voltage.'},validate:function(){return true;}},
        {text:{tr:'Simülasyonu başlatın. Çıkış ≈ 5.1V (1N4733 zeneri).',en:'Start simulation. Output ≈ 5.1V (1N4733 zener).'},validate:function(){return S.sim.running;}},
        {text:{tr:'Kaynağı 8V→15V değiştirin. Çıkış hâlâ ≈ 5.1V — bu regülasyon!',en:'Change source 8V→15V. Output still ≈ 5.1V — this is regulation!'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'1N4733 zener diyodun Vz değeri nedir?',en:'Vz of 1N4733 zener?'},options:['3.3V','5.1V','9V','12V'],correct:1}],
      complete:{tr:'🎉 Zener regülatör: en basit voltaj regülatörü!',en:'🎉 Zener regulator: simplest voltage regulator!'}
    },

    // ═══════════ LEVEL 3 — ANALOG TASARIM ═══════════
    {
      id:'opamp-basics', level:3, order:1,
      title:{tr:'Op-Amp Temelleri',en:'Op-Amp Basics'},
      desc:{tr:'İdeal yükselteç — voltage follower devresi.',en:'Ideal amplifier — voltage follower circuit.'},
      circuit:{
        parts:[{type:'vdc',x:-160,y:0,rot:0,val:1},{type:'opamp',x:0,y:0,rot:0,val:100000},
               {type:'ground',x:-160,y:60,rot:0,val:0}],
        wires:[{x1:-160,y1:-40,x2:-40,y2:-15},{x1:40,y1:0,x2:60,y2:0},
               {x1:60,y1:0,x2:60,y2:30},{x1:60,y1:30,x2:-40,y2:15},
               {x1:-160,y1:40,x2:-160,y2:40}]
      },
      steps:[
        {text:{tr:'Op-amp çok yüksek kazançlı yükselteçtir. + (non-inverting) ve − (inverting) iki giriş.',en:'Op-amp is a high-gain amplifier. Two inputs: + (non-inverting) and − (inverting).'},validate:function(){return true;}},
        {text:{tr:'Bu devrede çıkış − girişe bağlı → voltage follower. Vout = Vin.',en:'Output connected to − input → voltage follower. Vout = Vin.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Altın kural: V(+) = V(−), giriş akımı = 0.',en:'Golden rule: V(+) = V(−), input current = 0.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'Voltage follower\'ın kazancı nedir?',en:'Voltage follower gain?'},options:['0','0.5','1','∞'],correct:2}],
      complete:{tr:'🎉 Op-amp temelleri: V(+)=V(−), giriş akımı=0!',en:'🎉 Op-amp basics: V(+)=V(−), input current=0!'}
    },
    {
      id:'opamp-inv', level:3, order:2,
      title:{tr:'Evirici Yükselteç',en:'Inverting Amplifier'},
      desc:{tr:'Av = -Rf/Ri — sinyali ters çevir ve büyüt.',en:'Av = -Rf/Ri — invert and amplify signal.'},
      circuit:'inv-opamp',
      steps:[
        {text:{tr:'Evirici yükselteç: çıkış girişin TERSİ ve yükseltilmiş hali.',en:'Inverting amp: output is INVERTED and amplified.'},validate:function(){return true;}},
        {text:{tr:'Av = -Rf/Ri = -10k/1k = -10. Giriş 0.5V → Çıkış -5V.',en:'Av = -Rf/Ri = -10k/1k = -10. Input 0.5V → Output -5V.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Rf değerini değiştirin. Kazanç değişti!',en:'Change Rf. Gain changed!'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'Ri=2kΩ, Rf=20kΩ ise kazanç kaçtır?',en:'Ri=2kΩ, Rf=20kΩ, gain=?'},options:['+10','-10','+20','-20'],correct:1}],
      complete:{tr:'🎉 Evirici yükselteç: Av = -Rf/Ri',en:'🎉 Inverting amp: Av = -Rf/Ri'}
    },
    {
      id:'active-filter', level:3, order:3,
      title:{tr:'Aktif Filtre',en:'Active Filter'},
      desc:{tr:'Op-amp ile -40dB/dec eğim — pasif filtreden 2x dik.',en:'Op-amp with -40dB/dec slope — 2x steeper than passive.'},
      circuit:'sallen-key',
      steps:[
        {text:{tr:'Pasif RC filtre -20dB/dec eğim. Aktif filtre -40dB/dec — daha keskin!',en:'Passive RC filter: -20dB/dec. Active filter: -40dB/dec — sharper!'},validate:function(){return true;}},
        {text:{tr:'Bode plot çalıştırın. Kesim frekansını bulun.',en:'Run Bode plot. Find cutoff frequency.'},validate:function(){return true;}},
        {text:{tr:'Bu Sallen-Key 2. derece Butterworth filtre — düz geçiş, keskin geçiş.',en:'This is Sallen-Key 2nd-order Butterworth — flat passband, sharp transition.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'2. derece LPF\'nin eğimi kaç dB/decade?',en:'2nd-order LPF slope?'},options:['-10','-20','-40','-60'],correct:2}],
      complete:{tr:'🎉 Aktif filtre: keskin geçiş + birim kazanç!',en:'🎉 Active filter: sharp transition + unity gain!'}
    },
    {
      id:'oscillator-555', level:3, order:4,
      title:{tr:'555 Timer Osilatör',en:'555 Timer Oscillator'},
      desc:{tr:'Dünyanın en popüler IC\'si — kare dalga üretici.',en:'World\'s most popular IC — square wave generator.'},
      circuit:'555-astable',
      steps:[
        {text:{tr:'555 Timer 1972\'den beri kullanılan efsanevi entegredir.',en:'555 Timer is a legendary IC since 1972.'},validate:function(){return true;}},
        {text:{tr:'Astable mod: sürekli kare dalga. LED yanıp sönüyor!',en:'Astable mode: continuous square wave. LED blinks!'},validate:function(){return S.sim.running;}},
        {text:{tr:'Frekans: f = 1.44 / ((R1 + 2×R2) × C). R/C ile hızı ayarla.',en:'Frequency: f = 1.44 / ((R1 + 2×R2) × C). Tune via R/C.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'R1=1k, R2=10k, C=10µF ise frekans yaklaşık?',en:'R1=1k, R2=10k, C=10µF, frequency≈?'},options:['0.7Hz','6.9Hz','69Hz','690Hz'],correct:1}],
      complete:{tr:'🎉 555 Timer: zamanlama + osilasyon = sınırsız uygulama!',en:'🎉 555 Timer: timing + oscillation = endless applications!'}
    },
    {
      id:'power-supply', level:3, order:5,
      title:{tr:'Güç Kaynağı Tasarımı',en:'Power Supply Design'},
      desc:{tr:'AC\'den temiz DC\'ye tam süreç.',en:'Full process: AC to clean DC.'},
      circuit:'vreg-7805-bypass',
      steps:[
        {text:{tr:'Gerçek güç kaynağı: AC → doğrultma → filtreleme → regülasyon.',en:'Real power supply: AC → rectify → filter → regulate.'},validate:function(){return true;}},
        {text:{tr:'7805 regülatör: 12V girişten 5V kararlı çıkış.',en:'7805 regulator: 12V input → 5V stable output.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Filtre kapasitörleri ripple\'ı azaltır. Çıkış neredeyse mükemmel DC!',en:'Filter capacitors reduce ripple. Output: nearly perfect DC!'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'7805 regülatörün dropout voltajı yaklaşık?',en:'7805 regulator dropout voltage?'},options:['0.5V','2V','5V','7V'],correct:1}],
      complete:{tr:'🎉 Güç kaynağı tasarımının tüm aşamalarını öğrendiniz!',en:'🎉 You learned all stages of power supply design!'}
    },

    // ═══════════ LEVEL 4 — DİJİTAL ELEKTRONİK ═══════════
    {
      id:'logic-gates', level:4, order:1,
      title:{tr:'Lojik Kapılar',en:'Logic Gates'},
      desc:{tr:'AND, OR, NOT — dijital dünyanın yapı taşları.',en:'AND, OR, NOT — building blocks of digital world.'},
      circuit:'logic-demo',
      steps:[
        {text:{tr:'Dijital elektronik 0 ve 1 ile çalışır. 0V=LOW, 5V=HIGH.',en:'Digital electronics: 0 and 1. 0V=LOW, 5V=HIGH.'},validate:function(){return true;}},
        {text:{tr:'AND: İKİ giriş HIGH ise çıkış HIGH. OR: EN AZ BİR HIGH → çıkış HIGH.',en:'AND: BOTH HIGH → output HIGH. OR: AT LEAST ONE HIGH → output HIGH.'},validate:function(){return S.sim.running;}},
        {text:{tr:'NOT: tersine çevirir. Boolean cebrinin temeli.',en:'NOT: inverts. Foundation of boolean algebra.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'AND kapısında A=1, B=0 ise çıkış nedir?',en:'AND gate, A=1, B=0, output?'},options:['0','1','X','depends'],correct:0}],
      complete:{tr:'🎉 Lojik kapılar: dijital tasarımın temeli!',en:'🎉 Logic gates: foundation of digital design!'}
    },
    {
      id:'flipflop', level:4, order:2,
      title:{tr:'D Flip-Flop',en:'D Flip-Flop'},
      desc:{tr:'1 bit bellek elemanı — tüm sayıcıların ve registerların temeli.',en:'1-bit memory element — basis of all counters and registers.'},
      circuit:'dff-toggle',
      steps:[
        {text:{tr:'Flip-flop 1 bit bilgi saklar. D=Data, CLK=Clock.',en:'Flip-flop stores 1 bit. D=Data, CLK=Clock.'},validate:function(){return true;}},
        {text:{tr:'Clock yükselen kenarında D girişini Q\'ya yakalar.',en:'Captures D into Q on clock rising edge.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Bu temel bellek hücresi — RAM, register, sayıcı her şey buna dayanıyor.',en:'This is the basic memory cell — RAM, registers, counters all rely on this.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'D FF\'de D=1, CLK↑ olursa Q=?',en:'D FF: D=1, CLK↑, Q=?'},options:['0','1','X','Z'],correct:1}],
      complete:{tr:'🎉 D Flip-Flop: dijital belleğin temel taşı!',en:'🎉 D Flip-Flop: cornerstone of digital memory!'}
    },
    {
      id:'counter', level:4, order:3,
      title:{tr:'4-Bit Sayıcı',en:'4-Bit Counter'},
      desc:{tr:'Clock pulse\'larını sayan dijital devre.',en:'Digital circuit that counts clock pulses.'},
      circuit:'binary-counter',
      steps:[
        {text:{tr:'Sayıcı clock pulse\'larını sayar. 4-bit: 0\'dan 15\'e.',en:'Counter counts clock pulses. 4-bit: 0 to 15.'},validate:function(){return true;}},
        {text:{tr:'Simülasyonu başlatın. LED\'ler binary olarak sayıyor!',en:'Start simulation. LEDs count in binary!'},validate:function(){return S.sim.running;}},
        {text:{tr:'Q0 en hızlı (clock/2), Q3 en yavaş (clock/16). Frekans bölücü!',en:'Q0 fastest (clock/2), Q3 slowest (clock/16). Frequency divider!'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'4-bit sayıcı maksimum kaça kadar sayar?',en:'4-bit counter max value?'},options:['8','15','16','31'],correct:1}],
      complete:{tr:'🎉 Sayıcılar: tüm dijital saatlerin temeli!',en:'🎉 Counters: foundation of all digital clocks!'}
    },
    {
      id:'adc-dac', level:4, order:4,
      title:{tr:'ADC ve DAC',en:'ADC and DAC'},
      desc:{tr:'Analog ↔ Dijital köprüsü.',en:'Bridge between analog and digital.'},
      circuit:{
        parts:[{type:'vdc',x:-100,y:0,rot:0,val:5},{type:'resistor',x:0,y:0,rot:0,val:1000,wiper:0.5},
               {type:'voltmeter',x:120,y:0,rot:0,val:0},{type:'ground',x:-100,y:80,rot:0,val:0}],
        wires:[{x1:-100,y1:-40,x2:-40,y2:0},{x1:40,y1:0,x2:120,y2:0},
               {x1:-100,y1:40,x2:-100,y2:60}]
      },
      steps:[
        {text:{tr:'ADC analog voltajı dijital sayıya çevirir. 8-bit: 0-255.',en:'ADC converts analog voltage to digital number. 8-bit: 0-255.'},validate:function(){return true;}},
        {text:{tr:'Çözünürlük = Vref / 2^N. 8-bit 5V → 19.5mV/adım.',en:'Resolution = Vref / 2^N. 8-bit 5V → 19.5mV/step.'},validate:function(){return S.sim.running;}},
        {text:{tr:'DAC tersini yapar — dijital sayıyı analog voltaja çevirir. Müzik çalarlar bunu kullanır.',en:'DAC does the reverse — digital to analog. Music players use this.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'8-bit ADC, Vref=5V ise çözünürlük kaç mV?',en:'8-bit ADC, Vref=5V, resolution?'},options:['5mV','19.5mV','39mV','78mV'],correct:1}],
      complete:{tr:'🎉 ADC/DAC: analog ve dijital dünya buluştu!',en:'🎉 ADC/DAC: analog and digital worlds meet!'}
    },
    {
      id:'sensor-project', level:4, order:5,
      title:{tr:'Sensör Projesi',en:'Sensor Project'},
      desc:{tr:'Karanlıkta yanan otomatik LED.',en:'Automatic LED that lights up in darkness.'},
      circuit:'ldr-led',
      steps:[
        {text:{tr:'LDR (ışık bağımlı direnç) — karanlıkta R yüksek, aydınlıkta düşük.',en:'LDR — high R in dark, low R in light.'},validate:function(){return true;}},
        {text:{tr:'LDR + sabit direnç → gerilim bölücü. Çıkış voltajı ışığa bağlı.',en:'LDR + fixed R → voltage divider. Output depends on light.'},validate:function(){return S.sim.running;}},
        {text:{tr:'BJT base voltajı eşiği aşınca → LED yanar. Otomatik gece lambası!',en:'When base voltage crosses threshold → LED on. Automatic night light!'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'LDR karanlıkta ne olur?',en:'LDR in dark?'},options:['Direnci artar','Direnci azalır','Değişmez','Patlar'],correct:0}],
      complete:{tr:'🎉 İlk sensör projeniz tamamlandı!',en:'🎉 Your first sensor project is complete!'}
    },

    // ═══════════ LEVEL 5 — PROJE ═══════════
    {
      id:'ce-amplifier', level:5, order:1,
      title:{tr:'CE Yükselteç Tasarımı',en:'CE Amplifier Design'},
      desc:{tr:'Common Emitter — analog tasarımın temel taşı.',en:'Common Emitter — cornerstone of analog design.'},
      circuit:'ce-amp',
      steps:[
        {text:{tr:'Common Emitter yükselteç analog tasarımın klasiğidir.',en:'Common Emitter is the classic analog amplifier.'},validate:function(){return true;}},
        {text:{tr:'Bias ağı (R1, R2) çalışma noktasını belirler. Vce ≈ 7.6V — aktif bölgenin ortasında!',en:'Bias network sets Q-point. Vce ≈ 7.6V — middle of active region!'},validate:function(){return S.sim.running;}},
        {text:{tr:'AC kazanç: Av ≈ -RC/RE. Bode analizi ile ölçün.',en:'AC gain: Av ≈ -RC/RE. Measure with Bode analysis.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'CE amplifikatörün voltaj kazancı yaklaşık nedir?',en:'CE amp voltage gain ≈?'},options:['+RC×RE','-RC/RE','+RE/RC','-RE×RC'],correct:1}],
      complete:{tr:'🎉 CE yükselteç: analog tasarımın klasiği!',en:'🎉 CE amplifier: classic of analog design!'}
    },
    {
      id:'hbridge-motor', level:5, order:2,
      title:{tr:'H-Bridge Motor Kontrolü',en:'H-Bridge Motor Control'},
      desc:{tr:'4 transistörle motoru iki yönde çevir.',en:'Spin motor both directions with 4 transistors.'},
      circuit:'h-bridge',
      steps:[
        {text:{tr:'H-Bridge 4 transistör — motorun yönünü kontrol eder.',en:'H-Bridge: 4 transistors — control motor direction.'},validate:function(){return true;}},
        {text:{tr:'Q1+Q4 açık → saat yönü. Q2+Q3 açık → ters yön.',en:'Q1+Q4 on → clockwise. Q2+Q3 on → counter-clockwise.'},validate:function(){return S.sim.running;}},
        {text:{tr:'DİKKAT: Q1+Q2 aynı anda asla! Kısa devre = patlama (shoot-through).',en:'WARNING: Never Q1+Q2 simultaneously! Short circuit = explosion.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'H-Bridge\'de kaç transistör kullanılır?',en:'Transistors in H-Bridge?'},options:['2','3','4','6'],correct:2}],
      complete:{tr:'🎉 H-Bridge: robotiğin temel yapı taşı!',en:'🎉 H-Bridge: building block of robotics!'}
    },
    {
      id:'audio-amp', level:5, order:3,
      title:{tr:'Audio Amplifikatör',en:'Audio Amplifier'},
      desc:{tr:'Push-pull Class-B ses yükseltici.',en:'Push-pull Class-B audio amplifier.'},
      circuit:'push-pull',
      steps:[
        {text:{tr:'Class-B push-pull: NPN pozitif yarı, PNP negatif yarı yükseltir.',en:'Class-B push-pull: NPN amplifies positive half, PNP negative half.'},validate:function(){return true;}},
        {text:{tr:'Sorun: crossover distortion — 0V civarında ölü bant. Class-AB bunu çözer.',en:'Issue: crossover distortion — dead band near 0V. Class-AB fixes this.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Verim: Class-A %25, Class-B %78.5, Class-AB %50-70. Hi-fi: Class-AB tercih.',en:'Efficiency: Class-A 25%, Class-B 78.5%, Class-AB 50-70%. Hi-fi prefers Class-AB.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'Class-B amplifikatörün maksimum verimi yaklaşık?',en:'Class-B amp max efficiency?'},options:['%25','%50','%78.5','%100'],correct:2}],
      complete:{tr:'🎉 Audio amplifikatör: ses gücünün matematiği!',en:'🎉 Audio amp: math of sound power!'}
    },
    {
      id:'filter-design', level:5, order:4,
      title:{tr:'Filtre Tasarımı',en:'Filter Design'},
      desc:{tr:'Butterworth vs Chebyshev — Q faktörünün etkisi.',en:'Butterworth vs Chebyshev — effect of Q factor.'},
      circuit:'sallen-key',
      steps:[
        {text:{tr:'Butterworth filtre: maksimum düz geçiş bandı, -40dB/dec eğim, Q=0.707.',en:'Butterworth: maximally flat passband, -40dB/dec slope, Q=0.707.'},validate:function(){return true;}},
        {text:{tr:'Bode analizi yapın. Kesim frekansını ve eğimi ölçün.',en:'Run Bode analysis. Measure cutoff and slope.'},validate:function(){return S.sim.running;}},
        {text:{tr:'Pole-Zero analizi: kutuplar s-düzleminde nerede? Bu filtre karakteristiğini belirler.',en:'Pole-Zero analysis: where are poles in s-plane? This sets filter character.'},validate:function(){return true;}},
      ],
      quiz:[{question:{tr:'2. derece Butterworth\'un Q değeri kaçtır?',en:'2nd-order Butterworth Q?'},options:['0.5','0.707','1','1.414'],correct:1}],
      complete:{tr:'🎉 Filtre tasarımı: kutuplar dünyasına hoş geldiniz!',en:'🎉 Filter design: welcome to the world of poles!'}
    },
    {
      id:'capstone', level:5, order:5,
      title:{tr:'Final Projesi: Güç Kaynağı',en:'Capstone: Power Supply'},
      desc:{tr:'Tüm öğrendiklerinizi birleştirin — 12V AC\'den 5V DC.',en:'Combine everything — 12V AC to 5V DC.'},
      circuit:{parts:[],wires:[]}, // Empty — student builds it
      steps:[
        {text:{tr:'Bu son derste kendi devrenizi tasarlayacaksınız!',en:'In this final lesson, you design your own circuit!'},validate:function(){return true;}},
        {text:{tr:'Görev: 12V AC girişten 5V DC kararlı çıkış veren güç kaynağı.',en:'Task: design power supply with 12V AC input and 5V DC stable output.'},validate:function(){return true;}},
        {text:{tr:'İpucu: Trafo → Köprü doğrultucu → Filtre kapasitörü → 7805 regülatör.',en:'Hint: Transformer → Bridge rectifier → Filter capacitor → 7805 regulator.'},validate:function(){return true;}},
        {text:{tr:'Devrenizi kurun, simülasyonu çalıştırın. Çıkış 4.8-5.2V arasında mı?',en:'Build your circuit, run simulation. Is output between 4.8-5.2V?'},validate:function(){return S.parts.length >= 5;}},
        {text:{tr:'🎓 Tebrikler! 25 dersi tamamladınız — artık elektronik mühendisisiniz!',en:'🎓 Congratulations! You completed 25 lessons — you are now an electronics engineer!'},validate:function(){return true;}},
      ],
      quiz:[],
      complete:{tr:'🎓 25 ders tamamlandı! Elektronik dünyasına hoş geldiniz!',en:'🎓 25 lessons complete! Welcome to the electronics world!'}
    }
  ];

  // Append to TUTORIALS array
  NEW_LESSONS.forEach(function(lesson) { TUTORIALS.push(lesson); });

  // Patch startTutorial to handle preset references
  if (typeof startTutorial === 'function') {
    var _origStart = startTutorial;
    startTutorial = function(id) {
      var tut = TUTORIALS.find(function(t) { return t.id === id; });
      if (tut && typeof tut.circuit === 'string') {
        // Preset reference — load preset directly
        document.getElementById('tutorial-list-modal').classList.remove('show');
        if (typeof loadPreset === 'function') loadPreset(tut.circuit);
        _tutActive = tut; _tutStep = 0;
        if (typeof _showTutStep === 'function') _showTutStep();
        if (_tutValidator) clearInterval(_tutValidator);
        _tutValidator = setInterval(_checkTutStep, 500);
        return;
      }
      _origStart(id);
    };
  }

  // Patch _completeTutorial to show quiz before completion
  if (typeof _completeTutorial === 'function') {
    var _origComplete = _completeTutorial;
    _completeTutorial = function() {
      if (_tutActive && _tutActive.quiz && _tutActive.quiz.length > 0) {
        _showQuiz();
      } else {
        _origComplete();
      }
    };
  }

  // Quiz UI
  function _showQuiz() {
    if (!_tutActive || !_tutActive.quiz) return;
    var q = _tutActive.quiz[0]; // First quiz question
    var runner = document.getElementById('tut-runner');
    if (!runner) return;
    var tr = currentLang === 'tr';
    var question = q.question[currentLang] || q.question.tr;
    var html = '<div class="tr-header"><div class="tr-title">\uD83D\uDCDD ' + (tr?'Quiz':'Quiz') + '</div></div>'
      + '<div class="tr-text" style="font-weight:600">' + question + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">';
    q.options.forEach(function(opt, i) {
      html += '<button class="quiz-opt" data-idx="' + i + '" '
        + 'style="padding:8px 14px;border-radius:6px;background:var(--surface-3);color:var(--text);'
        + 'border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui);text-align:left" '
        + 'onclick="_answerQuiz(' + i + ',' + q.correct + ')">'
        + String.fromCharCode(65 + i) + ') ' + opt + '</button>';
    });
    html += '</div>';
    runner.innerHTML = html;
  }

  window._answerQuiz = function(picked, correct) {
    var btns = document.querySelectorAll('.quiz-opt');
    btns.forEach(function(b, i) {
      b.style.cursor = 'default';
      b.disabled = true;
      if (i === correct) {
        b.style.background = '#1e7d3a';
        b.style.borderColor = '#2eb653';
        b.style.color = '#fff';
      } else if (i === picked && picked !== correct) {
        b.style.background = '#7d1e1e';
        b.style.borderColor = '#b62e2e';
        b.style.color = '#fff';
      }
    });
    setTimeout(function() {
      // Now run original completion
      if (typeof _origComplete === 'function') _origComplete();
      else if (typeof _completeTutorial === 'function') _completeTutorial();
    }, 1500);
  };
  window._showQuiz = _showQuiz;
})();
