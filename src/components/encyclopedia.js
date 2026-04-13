// ──────── 5.2: COMPONENT ENCYCLOPEDIA ────────
var ENCYCLOPEDIA = {
  resistor: { theory:{tr:'Elektrik akımına karşı koyan pasif eleman. Georg Simon Ohm tarafından keşfedilen yasayla tanımlanır.',en:'Passive component opposing current flow. Defined by Ohm\'s Law.'},
    formulas:['V = I × R','P = V²/R = I²R','R_seri = R₁ + R₂','1/R_par = 1/R₁ + 1/R₂','R(T) = R₀(1 + α(T-T₀))'],
    standards:'E12: 1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2',
    specs:{tr:'Güç: 1/8W-5W | Tolerans: ±1%-±20% | TCR: ±50-500 ppm/°C',en:'Power: 1/8W-5W | Tolerance: ±1%-±20% | TCR: ±50-500 ppm/°C'} },
  capacitor: { theory:{tr:'Elektrik yükünü depolayan pasif eleman. İki iletken plaka arasındaki dielektrik malzeme ile çalışır.',en:'Passive component storing electric charge between two conductive plates.'},
    formulas:['I = C × dV/dt','W = ½CV²','Z = 1/(jωC)','τ = RC','f_c = 1/(2πRC)'],
    specs:{tr:'Kapasite: pF-mF | Maks V: 6.3V-450V | Tip: Seramik, Elektrolitik, Film, Tantal',en:'Capacitance: pF-mF | Max V: 6.3-450V | Type: Ceramic, Electrolytic, Film, Tantalum'} },
  inductor: { theory:{tr:'Manyetik alanda enerji depolayan pasif eleman. Akım değişimine karşı koyar.',en:'Passive component storing energy in magnetic field.'},
    formulas:['V = L × dI/dt','W = ½LI²','Z = jωL','τ = L/R','f₀ = 1/(2π√LC)'] },
  vdc: { theory:{tr:'Sabit DC gerilim sağlayan ideal kaynak. Pil veya güç kaynağını temsil eder.',en:'Ideal source providing constant DC voltage.'},
    formulas:['V_out = sabit','P = V × I'] },
  vac: { theory:{tr:'Sinüzoidal AC gerilim üreten kaynak. V(t) = Vp × sin(2πft + φ)',en:'Source producing sinusoidal AC voltage.'},
    formulas:['V(t) = Vp × sin(2πft)','V_rms = Vp/√2','P = V²_rms/R'] },
  diode: { theory:{tr:'Akımı tek yönde geçiren yarıiletken eleman. P-N junction prensibi.',en:'Semiconductor allowing current in one direction.'},
    formulas:['I = Is(e^(V/nVt)-1)','V_f ≈ 0.7V (Si)','V_T = kT/q ≈ 26mV'] },
  led: { theory:{tr:'Akım geçince ışık yayan diyot. Renk yarıiletken malzemeye bağlıdır.',en:'Diode emitting light when forward biased.'},
    formulas:['R = (V_s - V_f)/I_f','V_f: 1.8V(kırm), 3.0V(mavi)','I_tipik = 20mA'] },
  npn: { theory:{tr:'NPN bipolar jonksiyon transistörü. Base akımıyla collector akımını kontrol eder.',en:'NPN BJT. Controls collector current via base current.'},
    formulas:['I_C = β × I_B','I_E = I_C + I_B','V_BE ≈ 0.7V'] },
  pnp: { theory:{tr:'PNP bipolar jonksiyon transistörü. Complementary NPN.',en:'PNP BJT. Complementary to NPN.'},
    formulas:['I_C = β × I_B','V_EB ≈ 0.7V'] },
  opamp: { theory:{tr:'İşlemsel yükselteç. Çok yüksek kazançlı diferansiyel yükselteç.',en:'Op-amp. Very high gain differential amplifier.'},
    formulas:['Evirici: -Rf/Rin','Evirmeyen: 1+Rf/Rin','GBW = A_OL × f_3dB'] },
  'switch': { theory:{tr:'Devreyi açıp kapayan mekanik anahtar.',en:'Mechanical switch.'},
    formulas:['Kapalı: R ≈ 0','Açık: R → ∞'] },
  fuse: { theory:{tr:'Aşırı akımda eriyerek devreyi koruyan güvenlik elemanı.',en:'Safety device melting to protect from overcurrent.'},
    formulas:['I > I_rated → erir','I²t = enerji sabiti'] },
  ground: { theory:{tr:'Referans potansiyel noktası (0V). Tüm gerilimlerin referansı.',en:'Reference potential point (0V).'},
    formulas:['V_ground = 0V'] },
  zener: { theory:{tr:'Ters yönde belirli bir gerilimde iletken olan özel diyot. Gerilim düzenleme.',en:'Special diode conducting at specific reverse voltage.'},
    formulas:['V_Z = sabit (ters yön)','I_Z_min < I < I_Z_max'] },
  nmos: { theory:{tr:'N-kanal MOSFET. Gate gerilimi ile drain akımını kontrol eder.',en:'N-channel MOSFET. Controls drain current via gate voltage.'},
    formulas:['I_D = K(V_GS - V_th)²','V_GS > V_th → açık'] },
  pmos: { theory:{tr:'P-kanal MOSFET. Complementary NMOS.',en:'P-channel MOSFET.'},
    formulas:['V_SG > |V_th| → açık'] },
  vreg: { theory:{tr:'Sabit çıkış gerilimi sağlayan lineer regülatör. 78xx serisi en yaygını.',en:'Linear voltage regulator providing constant output. 78xx series most common.'},
    formulas:['Vout = sabit (3.3V/5V/12V)','P_dissipation = (Vin-Vout) × Iload','Dropout: Vin_min = Vout + 2V'],
    specs:{tr:'Tip: 7805(5V), 7812(12V), LM317(ayarlanabilir) | Imax: 1A-1.5A',en:'Type: 7805(5V), 7812(12V), LM317(adjustable) | Imax: 1A-1.5A'} },
  transformer: { theory:{tr:'Manyetik kuplaj ile AC gerilim dönüştürme. Primer ve sekonder sargılar.',en:'AC voltage conversion via magnetic coupling. Primary and secondary windings.'},
    formulas:['V2/V1 = N2/N1','I2/I1 = N1/N2','P1 ≈ P2 (ideal)'] },
  relay: { theory:{tr:'Elektromanyetik anahtar. Düşük güçle yüksek güç kontrol eder.',en:'Electromagnetic switch. Controls high power with low power signal.'},
    formulas:['Coil: V = I × R_coil','Contact: R_on ≈ 0, R_off → ∞'] },
  crystal: { theory:{tr:'Piezoelektrik kristal osilatör. Yüksek hassasiyetli frekans referansı.',en:'Piezoelectric crystal oscillator. High precision frequency reference.'},
    formulas:['f_series = 1/(2π√(Ls×Cs))','Q > 10000 (çok yüksek)'] },
  ntc: { theory:{tr:'NTC termistör. Sıcaklık arttıkça direnç azalır. Sıcaklık ölçümü ve kompanzasyon.',en:'NTC thermistor. Resistance decreases with temperature. Temperature sensing and compensation.'},
    formulas:['R(T) = R₀ × exp(B × (1/T - 1/T₀))','B = 3000-5000K tipik'] },
  ldr: { theory:{tr:'Işığa bağımlı direnç (fotoresistör). Karanlıkta MΩ, aydınlıkta kΩ seviyesinde.',en:'Light dependent resistor (photoresistor). MΩ in dark, kΩ in light.'},
    formulas:['R_dark > 1MΩ','R_light ≈ 1-10kΩ'] },
  potentiometer: { theory:{tr:'Ayarlanabilir direnç. Üç terminalli — iki uç ve sürgü (wiper).',en:'Adjustable resistor. Three terminals — two ends and a wiper.'},
    formulas:['R_wiper = R_total × position','V_out = V_in × (R_wiper/R_total)'] },
  scr: { theory:{tr:'Silikon kontrollü doğrultucu (tristör). Gate tetiklemesiyle açılır, akım sıfıra düşünce kapanır.',en:'Silicon controlled rectifier. Triggered by gate, turns off when current drops to zero.'},
    formulas:['V_GT ≈ 0.7V (gate trigger)','I_H = holding current'] },
  triac: { theory:{tr:'Çift yönlü tristör. AC güç kontrolü için kullanılır (dimmer, motor hız).',en:'Bidirectional thyristor. Used for AC power control (dimmer, motor speed).'},
    formulas:['Tetikleme: her iki yarım dalga','Faz kontrolü: α = 0° (tam güç) — 180° (kapalı)'] },
  diac: { theory:{tr:'Çift yönlü tetikleme diyodu. Belirli bir gerilimde (breakover) iletmeye başlar.',en:'Bidirectional trigger diode. Starts conducting at breakover voltage.'},
    formulas:['V_BO ≈ 28-36V (tipik)'] },
  comparator: { theory:{tr:'İki gerilimi karşılaştırır. V(+) > V(-) ise çıkış HIGH.',en:'Compares two voltages. Output HIGH when V(+) > V(-).'},
    formulas:['Vout = V(+) > V(-) ? VCC : VEE','Histerezis: V_H = R1/R2 × Vout'] },
  jfet_n: { theory:{tr:'N-kanal JFET. Gate-source gerilimi ile drain akımını kontrol eder.',en:'N-channel JFET. Controls drain current via gate-source voltage.'},
    formulas:['ID = IDSS × (1 - VGS/VP)²','VP = pinch-off voltage'] },
  ammeter: { theory:{tr:'Akım ölçer. Seri bağlanır, iç direnci idealde sıfırdır.',en:'Current meter. Connected in series, ideally zero internal resistance.'},
    formulas:['I = V_measured / R_shunt'] },
  voltmeter: { theory:{tr:'Gerilim ölçer. Paralel bağlanır, iç direnci idealde sonsuzdur.',en:'Voltage meter. Connected in parallel, ideally infinite internal resistance.'},
    formulas:['V = I × R_input (R_input → ∞)'] },
};

function showEncyclopedia(type) {
  var data = ENCYCLOPEDIA[type];
  if (!data) {
    // Fallback for unknown types
    data = { theory:{tr:'Bu bileşen hakkında bilgi henüz eklenmedi.',en:'Information not yet available for this component.'}, formulas:[] };
  }
  var def = COMP[type];
  var name = def ? def.name : type;
  var box = document.getElementById('ency-box');
  var theory = data.theory[currentLang] || data.theory.tr;
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<h2 style="font:600 18px var(--font-ui);color:var(--accent)">ℹ ' + name + '</h2>'
    + '<button style="font-size:20px;color:var(--text-3);cursor:pointer;background:none;border:none" onclick="document.getElementById(\'ency-modal\').classList.remove(\'show\')">&times;</button></div>';
  html += '<div class="ency-section"><h4>📖 ' + (currentLang==='tr'?'Teori':'Theory') + '</h4><div class="ency-text">' + theory + '</div></div>';
  if (data.formulas && data.formulas.length) {
    html += '<div class="ency-section"><h4>📐 ' + (currentLang==='tr'?'Formüller':'Formulas') + '</h4>';
    data.formulas.forEach(function(f) { html += '<div class="ency-formula">• ' + f + '</div>'; });
    html += '</div>';
  }
  if (data.standards) {
    html += '<div class="ency-section"><h4>📊 ' + (currentLang==='tr'?'Standart Değerler':'Standard Values') + '</h4><div class="ency-text">' + data.standards + '</div></div>';
  }
  if (data.specs) {
    var specs = data.specs[currentLang] || data.specs.tr;
    html += '<div class="ency-section"><h4>⚡ ' + (currentLang==='tr'?'Tipik Parametreler':'Typical Parameters') + '</h4><div class="ency-text">' + specs + '</div></div>';
  }
  html += '<div style="text-align:right;margin-top:16px"><button style="padding:6px 16px;border-radius:6px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);cursor:pointer;font:12px var(--font-ui)" onclick="document.getElementById(\'ency-modal\').classList.remove(\'show\')">' + (currentLang==='tr'?'Kapat':'Close') + '</button></div>';
  box.innerHTML = html;
  document.getElementById('ency-modal').classList.add('show');
}
