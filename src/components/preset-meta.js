// ──────── PRESET METADATA (Sprint 34) ────────
// difficulty (1-5), details (tr/en), nextPreset
// Merged into PRESETS at runtime via decoratePresets()

var PRESET_META = {
  // ⭐ BAŞLANGIÇ
  'vdiv': { difficulty:1, nextPreset:'rclp', details:{
    tr:'\u0130ki diren\u00e7le voltaj\u0131 b\u00f6lme. Vout=Vin\u00d7R2/(R1+R2). Sens\u00f6r devreleri ve referans voltaj\u0131 i\u00e7in temel yap\u0131 ta\u015f\u0131.',
    en:'Divide voltage with two resistors. Vout=Vin\u00d7R2/(R1+R2). Building block for sensor circuits and voltage references.'}},
  'led': { difficulty:1, nextPreset:'halfwave', details:{
    tr:'En temel elektronik devresi. LED\'in do\u011fru yanmas\u0131 i\u00e7in seri diren\u00e7 gerekir. R=(Vs-Vf)/If form\u00fcl\u00fcyle hesaplan\u0131r.',
    en:'The most basic electronic circuit. Series resistor needed for safe LED operation. Calculate with R=(Vs-Vf)/If.'}},
  'halfwave': { difficulty:2, nextPreset:'bridge-rect', details:{
    tr:'Diyot ile yar\u0131m dalga do\u011frultma. AC sinyalin sadece pozitif yar\u0131s\u0131 ge\u00e7er. G\u00fc\u00e7 kayna\u011f\u0131 ilk a\u015famas\u0131.',
    en:'Half-wave rectification with a diode. Only positive half of AC signal passes. First stage of a power supply.'}},

  // ⭐⭐ ORTA-BAŞLANGIÇ
  'rclp': { difficulty:2, nextPreset:'rccharge', details:{
    tr:'Y\u00fcksek frekanslar\u0131 bloke eden basit filtre. Kesim frekans\u0131 f=1/(2\u03c0RC). Audio ve sinyal i\u015fleme i\u00e7in temel.',
    en:'Simple filter that blocks high frequencies. Cutoff f=1/(2\u03c0RC). Essential for audio and signal processing.'}},
  'rccharge': { difficulty:2, nextPreset:'rl', details:{
    tr:'Kapasit\u00f6r\u00fcn \u015farj e\u011frisi. \u03c4=RC zaman sabiti. 5\u03c4 sonra %99 \u015farjl\u0131. Zamanlay\u0131c\u0131 devrelerin temeli.',
    en:'Capacitor charging curve. \u03c4=RC time constant. 99% charged after 5\u03c4. Foundation of timing circuits.'}},
  'rl': { difficulty:2, nextPreset:'rlc', details:{
    tr:'Bobin \u00fczerinde ak\u0131m art\u0131\u015f\u0131. \u03c4=L/R zaman sabiti. R\u00f6le ve motor s\u00fcr\u00fcc\u00fc devrelerinde kar\u015f\u0131la\u015f\u0131l\u0131r.',
    en:'Current rise through inductor. \u03c4=L/R time constant. Found in relay and motor driver circuits.'}},
  'serpar': { difficulty:2, nextPreset:'vdiv', details:{
    tr:'Seri ve paralel diren\u00e7 kombinasyonlar\u0131. Seri: R1+R2. Paralel: R1\u00d7R2/(R1+R2). Devre analizinin temeli.',
    en:'Series and parallel resistor combinations. Series: R1+R2. Parallel: R1\u00d7R2/(R1+R2). Foundation of circuit analysis.'}},
  'rlc': { difficulty:3, nextPreset:'bode-rc', details:{
    tr:'RLC rezonans devresi. f0=1/(2\u03c0\u221aLC). Radyo, filtre ve osilat\u00f6r tasar\u0131m\u0131n\u0131n temeli.',
    en:'RLC resonant circuit. f0=1/(2\u03c0\u221aLC). Foundation of radio, filter and oscillator design.'}},

  // ⭐⭐⭐ ORTA
  'zener-reg': { difficulty:3, nextPreset:'vreg-7805', details:{
    tr:'Zener diyot ile sabit voltaj regul\u00e2t\u00f6r\u00fc. Vout = Vz \u2248 5.1V. Pil destekli devreler i\u00e7in temel referans.',
    en:'Voltage regulator using zener diode. Vout = Vz \u2248 5.1V. Reference voltage for battery-powered circuits.'}},
  'vreg-7805': { difficulty:2, nextPreset:'vreg-7805-bypass', details:{
    tr:'7805 entegre regul\u00e2t\u00f6r\u00fc. Sabit 5V \u00e7\u0131k\u0131\u015f. \u00d6r\u00fc dijital devre besleyebilir.',
    en:'7805 IC regulator. Fixed 5V output. Can power most digital circuits.'}},
  'vreg-7805-bypass': { difficulty:3, nextPreset:'bridge-rect', details:{
    tr:'7805 + giri\u015f/\u00e7\u0131k\u0131\u015f filtre kapasit\u00f6rleri. G\u00fcr\u00fclt\u00fcs\u00fcz, kararl\u0131 5V besleme.',
    en:'7805 with input/output filter capacitors. Clean, stable 5V supply.'}},
  'bridge-rect': { difficulty:3, nextPreset:'vreg-7805-bypass', details:{
    tr:'4 diyotlu k\u00f6pr\u00fc do\u011frultucu. AC\'nin her iki yar\u0131s\u0131 da kullan\u0131l\u0131r. G\u00fc\u00e7 kayna\u011f\u0131n\u0131n kalbi.',
    en:'4-diode bridge rectifier. Both AC halves are utilized. Heart of any power supply.'}},
  'npn-sw': { difficulty:3, nextPreset:'ce-amp', details:{
    tr:'BJT ile transistor anahtar. K\u00fc\u00e7\u00fck baz ak\u0131m\u0131 b\u00fcy\u00fck kolekt\u00f6r ak\u0131m\u0131n\u0131 kontrol eder. R\u00f6le al\u0131\u015fkanl\u0131\u011f\u0131.',
    en:'BJT switch. Small base current controls large collector current. Replaces a relay.'}},
  '555-astable': { difficulty:3, nextPreset:'555-mono', details:{
    tr:'555 Timer ile s\u00fcrekli kare dalga. LED yan\u0131p s\u00f6ner. f=1.44/((R1+2R2)\u00d7C). R ve C ile h\u0131z\u0131 ayarla.',
    en:'Continuous square wave with 555 Timer. LED blinks. f=1.44/((R1+2R2)\u00d7C). Tune speed via R and C.'}},
  '555-mono': { difficulty:3, nextPreset:'bjt-astable', details:{
    tr:'555 ile tek-darbe (one-shot) zamanlay\u0131c\u0131. T\u00fcr=1.1\u00d7R\u00d7C. Tu\u015f sek\u00fcrme, gecikme rolesi.',
    en:'One-shot timer with 555. T=1.1\u00d7R\u00d7C. Debounce, delay relay.'}},
  'bjt-astable': { difficulty:4, nextPreset:'led-chaser', details:{
    tr:'\u0130ki BJT ile asenkron multivibrat\u00f6r. Klasik LED yan\u0131p-s\u00f6nme devresi. 555\'ten \u00f6nce kullan\u0131l\u0131rd\u0131.',
    en:'Astable multivibrator with two BJTs. Classic LED blinker. Used before 555 timer.'}},
  'cmos-inv': { difficulty:3, nextPreset:'logic-demo', details:{
    tr:'CMOS NOT kap\u0131s\u0131 (NMOS+PMOS). Vin=0\u2192Vout=5V, Vin=5V\u2192Vout=0V. Dijital tasar\u0131m\u0131n temeli.',
    en:'CMOS NOT gate (NMOS+PMOS). Vin=0\u2192Vout=5V, Vin=5V\u2192Vout=0V. Foundation of digital design.'}},
  'logic-demo': { difficulty:2, nextPreset:'dff-toggle', details:{
    tr:'AND, OR, NOT temel kap\u0131lar\u0131. Boolean cebrinin g\u00f6rsel ifadesi. Truth table\'\u0131 kontrol et.',
    en:'Basic AND, OR, NOT gates. Visual expression of boolean algebra. Check the truth table.'}},
  'dff-toggle': { difficulty:4, nextPreset:'binary-counter', details:{
    tr:'D Flip-Flop ile frekans b\u00f6lme. Her clock\'ta \u00e7\u0131k\u0131\u015f tersine d\u00f6ner (\u00f72). Sayac\u0131n yap\u0131 ta\u015f\u0131.',
    en:'Frequency divider with D Flip-Flop. Output toggles every clock (\u00f72). Building block of counters.'}},
  'binary-counter': { difficulty:4, nextPreset:'led-chaser', details:{
    tr:'4-bit ikili sayac\u0131. 0-15 aras\u0131 sayar. T\u00fcm dijital saatlerin temeli.',
    en:'4-bit binary counter. Counts 0-15. Foundation of all digital clocks.'}},

  // ⭐⭐⭐⭐ İLERİ
  'ce-amp': { difficulty:4, nextPreset:'class-a-amp', details:{
    tr:'BJT ile gerilim y\u00fckselteci. Bias a\u011f\u0131 (R1,R2) \u00e7al\u0131\u015fma noktas\u0131n\u0131 belirler. Av\u2248-RC/RE. Analog tasar\u0131m\u0131n temel ta\u015f\u0131.',
    en:'BJT voltage amplifier. Bias network (R1,R2) sets operating point. Av\u2248-RC/RE. Cornerstone of analog design.'}},
  'class-a-amp': { difficulty:4, nextPreset:'diff-amp', details:{
    tr:'Class-A common-emitter y\u00fckselte\u00e7. Bias do\u011fru ayarl\u0131, distorsiyon d\u00fc\u015f\u00fck. Hi-fi audio devrelerinde kullan\u0131l\u0131r.',
    en:'Class-A common-emitter amplifier. Properly biased, low distortion. Used in hi-fi audio circuits.'}},
  'diff-amp': { difficulty:4, nextPreset:'inst-amp', details:{
    tr:'Fark y\u00fckselteci. \u0130ki giri\u015f aras\u0131 fark\u0131 y\u00fckseltir. Op-amp\'in i\u00e7indeki ilk katman.',
    en:'Differential amplifier. Amplifies the difference between two inputs. First stage inside an op-amp.'}},
  'push-pull': { difficulty:4, nextPreset:'h-bridge', details:{
    tr:'NPN+PNP push-pull \u00e7\u0131k\u0131\u015f katman\u0131. Y\u00fcksek ak\u0131m, d\u00fc\u015f\u00fck distorsiyon. Class-B audio amfilerinde.',
    en:'NPN+PNP push-pull output stage. High current, low distortion. Used in Class-B audio amps.'}},
  'h-bridge': { difficulty:4, nextPreset:'dc-motor', details:{
    tr:'4 transistorl\u00fc H-k\u00f6pr\u00fc. DC motoru iki y\u00f6nde \u00e7evirir. Robotik ve motor s\u00fcr\u00fcc\u00fc devresi.',
    en:'4-transistor H-bridge. Drives DC motor in both directions. Used in robotics and motor drivers.'}},
  'inv-opamp': { difficulty:3, nextPreset:'noninv-opamp', details:{
    tr:'Evirici op-amp y\u00fckselte\u00e7. Av=-Rf/Ri. \u00c7\u0131k\u0131\u015f ters fazda. Toplay\u0131c\u0131 ve filtre devrelerinde.',
    en:'Inverting op-amp amplifier. Av=-Rf/Ri. Output is inverted. Used in summing and filter circuits.'}},
  'noninv-opamp': { difficulty:3, nextPreset:'inv-opamp', details:{
    tr:'Eviricisiz op-amp y\u00fckselte\u00e7. Av=1+Rf/Ri. Y\u00fcksek giri\u015f empedans\u0131. Tampon olarak da kullan\u0131l\u0131r.',
    en:'Non-inverting op-amp amplifier. Av=1+Rf/Ri. High input impedance. Also used as buffer.'}},
  'sallen-key': { difficulty:5, nextPreset:'active-bpf', details:{
    tr:'Sallen-Key 2. dereceden aktif filtre. Op-amp + RC ile keskin kesim. Audio ve \u00f6l\u00e7\u00fcm devrelerinde.',
    en:'Sallen-Key 2nd-order active filter. Sharp cutoff using op-amp + RC. For audio and instrumentation.'}},
  'active-bpf': { difficulty:5, nextPreset:'sallen-key', details:{
    tr:'Aktif band-pass filtre. Belirli frekans aral\u0131\u011f\u0131n\u0131 ge\u00e7irir. Q fakt\u00f6r\u00fc keskinli\u011fi belirler.',
    en:'Active band-pass filter. Passes a specific frequency band. Q factor sets sharpness.'}},

  // ⭐⭐⭐⭐⭐ UZMAN
  'inst-amp': { difficulty:5, nextPreset:null, details:{
    tr:'3 op-amp\'l\u0131 enstr\u00fcmantasyon y\u00fckselteci. Y\u00fcksek CMRR. Medikal, end\u00fcstriyel \u00f6l\u00e7\u00fcm ve k\u00f6pr\u00fc devrelerinde.',
    en:'3-op-amp instrumentation amplifier. Very high CMRR. For medical, industrial measurement and bridge circuits.'}},

  // ANALİZ DEVRELERİ
  'bode-rc': { difficulty:3, nextPreset:'fft-square', details:{
    tr:'RC filtrenin frekans cevab\u0131. Bode plot \u00e7izimi. -3dB noktas\u0131 = kesim frekans\u0131.',
    en:'Frequency response of an RC filter. Bode plot. -3dB point = cutoff frequency.'}},
  'fft-square': { difficulty:3, nextPreset:'lissajous', details:{
    tr:'Kare dalgan\u0131n FFT\'si. Tek harmonikler g\u00f6r\u00fcn\u00fcr (Fourier serisi). Sinyal analizinin temeli.',
    en:'FFT of square wave. Odd harmonics visible (Fourier series). Foundation of signal analysis.'}},
  'dc-sweep-led': { difficulty:2, nextPreset:'param-sweep-rc', details:{
    tr:'LED I-V karakteristi\u011fi. DC Sweep ile Vd-Id e\u011frisi \u00e7\u0131kar\u0131l\u0131r. Vf bulma yolu.',
    en:'LED I-V characteristic. DC Sweep extracts Vd-Id curve. How to find Vf.'}},
  'param-sweep-rc': { difficulty:3, nextPreset:'mc-rc', details:{
    tr:'RC zaman sabitinin R\'ye ba\u011f\u0131ml\u0131l\u0131\u011f\u0131. Param Sweep ile birden \u00e7ok e\u011fri.',
    en:'RC time constant vs R. Param Sweep produces multiple curves.'}},
  'mc-rc': { difficulty:4, nextPreset:'sens-demo', details:{
    tr:'Monte Carlo analizi: bile\u015fen toleranslar\u0131n\u0131n \u00e7\u0131k\u0131\u015fa etkisi. \u00dcretim varyasyon analizi.',
    en:'Monte Carlo analysis: effect of component tolerances on output. Production variation analysis.'}},
  'sens-demo': { difficulty:4, nextPreset:'wc-demo', details:{
    tr:'Hassasiyet analizi. Hangi bile\u015fen \u00e7\u0131k\u0131\u015f\u0131 en \u00e7ok etkiler? Tasar\u0131m optimizasyonu.',
    en:'Sensitivity analysis. Which component most affects output? Design optimization.'}},
  'wc-demo': { difficulty:4, nextPreset:'mc-rc', details:{
    tr:'Worst-case analizi. T\u00fcm bile\u015fenler en k\u00f6t\u00fc kombinasyonda \u00e7al\u0131\u015fsa ne olur?',
    en:'Worst-case analysis. What if all components are at worst tolerance combo?'}},
  'lissajous': { difficulty:3, nextPreset:'fft-square', details:{
    tr:'Lissajous figurleri. \u0130ki sin\u00fcs aras\u0131 frekans/faz fark\u0131 g\u00f6rselle\u015ftirme. XY mod osiloskop.',
    en:'Lissajous figures. Visualizes frequency/phase between two sines. XY-mode oscilloscope.'}},
  'diff-meas': { difficulty:3, nextPreset:'inst-amp', details:{
    tr:'Diferansiyel \u00f6l\u00e7\u00fcm probu. \u0130ki nokta aras\u0131 voltaj\u0131 GND referans\u0131 olmadan \u00f6l\u00e7er.',
    en:'Differential measurement probe. Measures voltage between two points without GND reference.'}},

  // SENSÖR & UYGULAMA
  'ntc-sensor': { difficulty:2, nextPreset:'ntc-alarm', details:{
    tr:'NTC termist\u00f6r ile s\u0131cakl\u0131k \u00f6l\u00e7\u00fcm\u00fc. S\u0131cakl\u0131k artt\u0131k\u00e7a R d\u00fc\u015fer. Termostat devresi.',
    en:'Temperature measurement with NTC thermistor. R drops as temperature rises. Thermostat circuit.'}},
  'ldr-sensor': { difficulty:2, nextPreset:'ldr-led', details:{
    tr:'LDR (\u0131\u015f\u0131k diren\u00e7) ile \u0131\u015f\u0131k \u00f6l\u00e7\u00fcm\u00fc. Karanl\u0131kta R y\u00fcksek, ayd\u0131nl\u0131kta d\u00fc\u015f\u00fck. Otomatik lambada kullan\u0131l\u0131r.',
    en:'Light measurement with LDR. R high in dark, low in light. Used in automatic lamps.'}},
  'pot-divider': { difficulty:1, nextPreset:'vdiv', details:{
    tr:'Potansiyometre ile ayarlanabilir gerilim b\u00f6l\u00fcc\u00fc. Ses kontrol\u00fc, parlakl\u0131k ayar\u0131.',
    en:'Adjustable voltage divider with potentiometer. Volume control, brightness adjustment.'}},
  'ntc-alarm': { difficulty:3, nextPreset:'ldr-led', details:{
    tr:'NTC + komparat\u00f6r ile s\u0131cakl\u0131k alarm\u0131. E\u015fik a\u015f\u0131l\u0131nca buzzer/LED tetiklenir.',
    en:'Temperature alarm with NTC + comparator. Trigger buzzer/LED when threshold exceeded.'}},
  'ldr-led': { difficulty:2, nextPreset:'led-chaser', details:{
    tr:'Karanl\u0131kta yanan otomatik gece lambas\u0131. LDR + transist\u00f6r anahtar.',
    en:'Automatic night light that turns on in darkness. LDR + transistor switch.'}},
  'led-chaser': { difficulty:4, nextPreset:'binary-counter', details:{
    tr:'LED kovalama (chaser) efekti. 555 + 4017 sayac\u0131 ile s\u0131rayla yanma. Reklam panellerinde.',
    en:'LED chaser effect. 555 + 4017 counter for sequential lighting. Used in marquees.'}},

  // GÜÇ & ÖZEL
  'dc-motor': { difficulty:3, nextPreset:'h-bridge', details:{
    tr:'DC motor s\u00fcr\u00fcc\u00fc. PWM ile h\u0131z kontrol\u00fc. Diyot geri-EMK\'yi koruma sa\u011flar.',
    en:'DC motor driver. PWM speed control. Flyback diode protects against back-EMF.'}},
  'dc-motor-simple': { difficulty:2, nextPreset:'dc-motor', details:{
    tr:'Basit DC motor devresi. Anahtar a\u00e7\u0131l\u0131nca d\u00f6ner. Temel pil-motor ba\u011flant\u0131s\u0131.',
    en:'Simple DC motor circuit. Spins when switch closes. Basic battery-motor connection.'}},
  'relay-ctrl': { difficulty:3, nextPreset:'h-bridge', details:{
    tr:'BJT + r\u00f6le ile y\u00fck kontrol\u00fc. D\u00fc\u015f\u00fck voltajla y\u00fcksek g\u00fc\u00e7l\u00fc y\u00fck kontrol\u00fc. Klasik anahtarlama.',
    en:'BJT + relay load control. Control high-power load with low voltage. Classic switching.'}},
  'trafo': { difficulty:3, nextPreset:'trafo-demo', details:{
    tr:'Trafo (transformator). Vp/Vs = Np/Ns. Voltaj y\u00fckseltme/d\u00fc\u015f\u00fcrme. \u015eebeke g\u00fc\u00e7 kayna\u011f\u0131.',
    en:'Transformer. Vp/Vs = Np/Ns. Voltage step up/down. Mains power supply.'}},
  'trafo-demo': { difficulty:3, nextPreset:'bridge-rect', details:{
    tr:'Trafo + d\u00f6n\u00fc\u015ft\u00fcrme oran\u0131 g\u00f6sterimi. AC voltaj de\u011fi\u015fim ilkesi.',
    en:'Transformer + turns ratio demo. AC voltage transformation principle.'}},
  'speaker-demo': { difficulty:2, nextPreset:'active-bpf', details:{
    tr:'Audio amfli ile hoparl\u00f6r s\u00fcr\u00fcm\u00fc. Sin\u00fcs sinyali sese d\u00f6n\u00fc\u015f\u00fcr.',
    en:'Speaker driver with audio amp. Sine signal becomes audible sound.'}},
  'crystal-osc': { difficulty:5, nextPreset:'555-astable', details:{
    tr:'Kristal osilat\u00f6r. Yuksek hassasiyetli frekans referans\u0131. Saat ve mikrokontrol\u00f6rde kullan\u0131l\u0131r.',
    en:'Crystal oscillator. High-precision frequency reference. Used in clocks and microcontrollers.'}},
  'jfet-cs': { difficulty:4, nextPreset:'class-a-amp', details:{
    tr:'JFET common-source y\u00fckselte\u00e7. Y\u00fcksek giri\u015f empedans\u0131. Audio preamp ve elektret mikrofon.',
    en:'JFET common-source amplifier. High input impedance. Used in audio preamps and electret mics.'}},
  'scr-phase': { difficulty:5, nextPreset:'h-bridge', details:{
    tr:'SCR (Silicon Controlled Rectifier) ile faz kontrol\u00fc. AC g\u00fc\u00e7 ayar\u0131. Dimmer ve s\u0131cakl\u0131k kontrol\u00fcnde.',
    en:'Phase control with SCR. AC power adjustment. Used in dimmers and temperature controllers.'}},
  'dep-src': { difficulty:4, nextPreset:'jfet-cs', details:{
    tr:'Ba\u011f\u0131ml\u0131 kaynaklar (VCVS, VCCS, CCVS, CCCS). Op-amp ve transist\u00f6r modellemenin temeli.',
    en:'Dependent sources (VCVS, VCCS, CCVS, CCCS). Foundation for op-amp and transistor modeling.'}}
};

// Decorate PRESETS with metadata at runtime
function decoratePresets() {
  if (typeof PRESETS === 'undefined' || !PRESET_META) return;
  PRESETS.forEach(function(p) {
    var meta = PRESET_META[p.id];
    if (meta) {
      if (meta.difficulty != null) p.difficulty = meta.difficulty;
      if (meta.details) p.details = meta.details;
      if (meta.nextPreset !== undefined) p.nextPreset = meta.nextPreset;
    } else {
      // Default for any preset without explicit meta
      if (p.difficulty == null) p.difficulty = 2;
    }
  });
}
// Auto-decorate after PRESETS loads
if (typeof PRESETS !== 'undefined') decoratePresets();
