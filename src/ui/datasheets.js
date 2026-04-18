// ──────── SPRINT 104.3.6 — DATASHEET CONTENT ────────
// Panel content for every component in COMP. Each entry is optional field
// by field — write what the part genuinely has, skip the rest. Ground has
// no equation; Op-Amp earns every field. Turkish, jargon-free opener with
// (TR, EN) glossing on first mention. See src/ui/datasheet-panel.js for
// the rendering pipeline and src/ui/datasheet-chart.js for the SVG chart
// builder.
//
// Schema (all optional except whatItDoes for most rows):
//   tagline:        short taxonomy chip — "Pasif · Lineer"
//   whatItDoes:     2–3 sentence plain-Turkish explanation
//   equation:       { formula, label }
//   chart:          { type, title, xLabel, yLabel, curves, annotation }
//   keyParameters:  [{ name, value, note }]
//   advanced:       string[] engineer-level bullets
//   spiceTemplate:  ngspice line
//   applications:   string[] short inline bullets
//   warnings:       string[] physical hazards

var DATASHEETS = {

  // ═══ PASİF ═══
  resistor: {
    tagline: 'Pasif · Lineer',
    whatItDoes: 'Direnç akıma karşı koyan en temel bileşendir. Uçları arasına uygulanan gerilim (voltaj, voltage) ile içinden geçen akım (current) doğrusal orantılıdır: gerilim iki katına çıkarsa akım da iki katına çıkar.',
    equation: { formula: 'V = I · R', label: 'Ohm Kanunu — gerilim (V), akım (A), direnç (Ω)' },
    chart: { type: 'linear', title: 'V–I karakteristiği', xLabel: 'I (mA)', yLabel: 'V (V)', curves: [{ label: 'R=1kΩ', points: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]] }], annotation: 'Eğim = R' },
    keyParameters: [
      { name: 'Direnç değeri', value: '1 Ω … 10 MΩ', note: 'E12/E24/E96 serileri' },
      { name: 'Tolerans', value: '±1% … ±20%', note: 'Renk bandı veya üstündeki yazı' },
      { name: 'Güç', value: '1/8 W … 5 W', note: 'P = I² · R' },
      { name: 'Sıcaklık katsayısı', value: '±50 … ±1000 ppm/°C', note: 'Hassas devrelerde <50 ppm/°C' }
    ],
    advanced: [
      'Direnç, Drude modeli ile elektron çarpışma frekansı üzerinden türetilir; makroskopik Ohm yasası mikroskopik J = σE biçiminin integralidir.',
      'Parazitik indüktans ve kapasitans yüksek frekansta öne çıkar; tel-sarmal dirençler RF için uygun değildir.',
      'Johnson–Nyquist termal gürültüsü: v_n² = 4·k·T·R·Δf — düşük gürültülü ön katlarda R mümkün olduğunca küçük seçilir.',
      'Metal-film dirençler düşük TCR + düşük gürültü sunar; karbon-kompozit patlamaya karşı dayanımlı ama toleransı geniştir.'
    ],
    spiceTemplate: 'R1 N1 N2 1k',
    applications: ['Akım sınırlama', 'Voltage divider', 'Pull-up / pull-down', 'RC / LPF filtre', 'LED seri direnci', 'Shunt ölçüm'],
    warnings: ['Güç değerini aşma — kavrulur.']
  },

  capacitor: {
    tagline: 'Pasif · Enerji depolama',
    whatItDoes: 'Kapasitör (kondansatör, capacitor) iki iletken plaka arasına konan yalıtkanla elektrik alanı şeklinde enerji depolar. DC\'de belirli bir süre sonra tamamen dolar ve akımı keser; AC\'de sürekli dolup boşalarak akımı iletir.',
    equation: { formula: 'I = C · dV/dt', label: 'Akım, gerilim değişim hızıyla orantılı' },
    chart: { type: 'log-log', title: 'Empedans |Z| = 1/(ωC)', xLabel: 'f (Hz)', yLabel: '|Z| (Ω)', curves: [{ label: '1 µF', points: [[10,15915],[100,1591],[1000,159],[10000,15.9],[100000,1.59],[1000000,0.159]] }] },
    keyParameters: [
      { name: 'Kapasite', value: '1 pF … 10 mF', note: 'Seramik / film / elektrolit / tantal' },
      { name: 'Maks gerilim', value: '6.3 V … 1 kV+', note: 'Aşılırsa dielektrik delinir' },
      { name: 'ESR', value: '0.01 Ω … birkaç Ω', note: 'Eşdeğer seri direnç — SMPS\'de kritik' },
      { name: 'Tolerans', value: '±5% … ±80%', note: 'Elektrolitlerde tolerans çok geniştir' }
    ],
    advanced: [
      'Dielektrik sabiti ε_r: hava 1, X7R seramik 3000, tantal oksit ≈27. Aynı hacimde kapasite bu oranla artar.',
      'Elektrolitik kondansatörler kutupludur; ters bağlanırsa gaz çıkışı + patlama riski.',
      'Seramik (Class II) kapasitelerde DC bias etkisi — nominal gerilimde kapasite %60 düşebilir.',
      'Film kapasiteler self-healing: kısa arktan sonra dielektrik kendini onarır; yüksek güvenilirlik.',
      'Paralel eşdeğer: C_eş = ΣC; seri eşdeğer: 1/C_eş = Σ(1/C).'
    ],
    spiceTemplate: 'C1 N1 N2 100n',
    applications: ['Güç kaynağı filtreleme', 'AC kuplaj (DC block)', 'Zamanlama (RC, 555)', 'Bypass / decoupling', 'Rezonans devresi', 'Snubber'],
    warnings: ['Elektrolitte kutup ters → patlama.', 'Yüksek V\'de depolanmış yükle temas — boşalt önce.']
  },

  inductor: {
    tagline: 'Pasif · Enerji depolama',
    whatItDoes: 'Bobin (indüktör, inductor) içinden akım geçtiğinde manyetik alan oluşturur ve bu alanda enerji depolar. Akım değişmek istediğinde bobin buna direnir — DC\'de sonunda kısa devre gibi davranır, AC\'de frekans yükseldikçe direnci artar.',
    equation: { formula: 'V = L · dI/dt', label: 'İndüklenen gerilim akımın değişim hızıyla orantılı' },
    chart: { type: 'log-log', title: 'Empedans |Z| = ωL', xLabel: 'f (Hz)', yLabel: '|Z| (Ω)', curves: [{ label: '10 mH', points: [[10,0.628],[100,6.28],[1000,62.8],[10000,628],[100000,6283]] }] },
    keyParameters: [
      { name: 'İndüktans', value: '1 nH … 10 H', note: 'Toroid / çubuk / film / planar' },
      { name: 'Doyma akımı (Isat)', value: 'mA … 100+ A', note: 'Aşıldığında çekirdek doyar, L çöker' },
      { name: 'DCR', value: '0.01 Ω … birkaç Ω', note: 'Sarım bakır direnci' },
      { name: 'Self-resonant freq', value: 'kHz … GHz', note: 'Üstünde kapasitif davranır' }
    ],
    advanced: [
      'Faraday yasası ve Ampere kanununun birleşimi: ∇×B = μ₀J — indüksiyon toplam sarılmış akımla orantılı.',
      'Çekirdek doyma sonrası L_eff keskin düşer; switch-mode güç kaynaklarında tasarım noktası Isat\'ın altında tutulmalıdır.',
      'Skin ve proximity etkileri yüksek frekansta bakır kaybını artırır — Litz tel veya folyo sarım RF için uygun.',
      'Hysterisiz + eddy-current kayıpları = toplam çekirdek kaybı; ferrit seçimi frekansla belirlenir.',
      'Paralel eşdeğer: 1/L_eş = Σ(1/L); seri eşdeğer: L_eş = ΣL.'
    ],
    spiceTemplate: 'L1 N1 N2 10m',
    applications: ['SMPS buck/boost', 'LC rezonans', 'EMI/RFI filtre', 'Choke', 'Rölelerde zamanlama', 'Manyetik sensör'],
    warnings: ['Akım kesilince oluşan yüksek gerilim (V = L·dI/dt) çevre parçaları yakabilir — flyback diyodu şart.']
  },

  potentiometer: {
    tagline: 'Pasif · Ayarlanabilir',
    whatItDoes: 'Potansiyometre ayarlanabilir bir dirençtir. Üç ucu vardır: iki uç sabit direnci temsil eder, ortadaki gezici uç (wiper) sürüldükçe uçlara göre oran değişir. Gerilim bölücü olarak da, ayarlı seri direnç olarak da kullanılır.',
    equation: { formula: 'V_out = V_in · (R_wiper / R_total)', label: 'Voltage divider konumu' },
    keyParameters: [
      { name: 'Toplam direnç', value: '100 Ω … 10 MΩ', note: 'Log, lin, anti-log taper' },
      { name: 'Mekanik ömür', value: '10k … 10M döngü', note: 'Döner / slider / dijital' },
      { name: 'Güç', value: '0.1 W … 5 W', note: 'Wiper akım limiti daha düşük olabilir' }
    ],
    advanced: [
      'Log-taper (A) ses seviyesi için tercih edilir; kulak gürlüğü logaritmik algılar.',
      'Wiper teması gürültülü olabilir (scratching) — DC kuplaj yerine kapasitör üzerinden besle.',
      'Dijital potlar (X9C, MCP41xxx) SPI/I²C üzerinden çalışır, mekanik aşınma yoktur ama tolerans daha geniştir.'
    ],
    spiceTemplate: 'R1a N1 Nw {val*k}\nR1b Nw N2 {val*(1-k)}',
    applications: ['Ses seviyesi', 'LCD kontrast', 'Referans gerilim ayarı', 'Kalibrasyon'],
    warnings: ['Wiper akımını zorlama — yanar.']
  },

  ntc: {
    tagline: 'Pasif · Sıcaklık sensörü',
    whatItDoes: 'NTC termistör (negative temperature coefficient) sıcaklık arttıkça direnci DÜŞER. 25 °C\'deki nominal değerden (R₂₅) başlayıp üstel olarak değişir. Sıcaklık ölçümü ve inrush akım sınırlaması için kullanılır.',
    equation: { formula: 'R(T) = R₂₅ · exp(B · (1/T − 1/298))', label: 'Beta modeli, T Kelvin cinsinden' },
    chart: { type: 'exp', title: 'R vs Sıcaklık', xLabel: 'T (°C)', yLabel: 'R (Ω)', curves: [{ label: '10k NTC B=3950', points: [[-20,97100],[0,32650],[25,10000],[50,3600],[75,1510],[100,696]] }] },
    keyParameters: [
      { name: 'R₂₅', value: '10 Ω … 1 MΩ', note: '25 °C nominal' },
      { name: 'Beta (B)', value: '2000 … 5000 K', note: 'Eğrinin dikliği' },
      { name: 'Tolerans', value: '±1% … ±10%', note: 'Hassas sensörlerde ±0.5%' }
    ],
    advanced: [
      'Steinhart–Hart denklemi: 1/T = A + B·ln(R) + C·ln(R)³ — üç katsayı tablosuyla ±0.1 °C doğruluk.',
      'Self-heating hatası: akım × gerilim = ısı; ölçüm sırasında termistörü kendi ısıtmamak için I_probe < 0.1 mA.',
      'NTC bir kez inrush\'ı emdikten sonra sıcak kalır; tekrar soğuma süresi 30 s+ olabilir.'
    ],
    spiceTemplate: 'R_NTC N1 N2 10k tc=-0.045',
    applications: ['Ortam sıcaklığı', 'Batarya sıcaklık koruma', 'AC line inrush limiter', 'Sıvı seviye (dual-NTC)'],
    warnings: ['Self-heating ölçüm hatası yaratır — ölçüm akımını sınırla.']
  },

  ptc: {
    tagline: 'Pasif · Kendi-kendini koruyan',
    whatItDoes: 'PTC (positive temperature coefficient) termistörü sıcaklık artınca direnci YÜKSELİR. Belirli bir eşikten sonra keskin sıçrama yapar; bu onu kendi-sıfırlayan bir sigorta (polyswitch) haline getirir.',
    equation: { formula: 'R(T) ≈ R₀ · exp(α(T−T_ref))', label: 'Eşik üstünde α çok büyüktür' },
    keyParameters: [
      { name: 'Hold akımı (I_h)', value: '0.05 … 10 A', note: 'Bu akıma kadar düşük R' },
      { name: 'Trip akımı (I_t)', value: '~2 × I_h', note: 'Bu akımda direnç patlar' },
      { name: 'V_max', value: '30 … 600 V', note: 'Trip durumunda dayanım' }
    ],
    advanced: [
      'Trip edince direnç ~100Ω → 10 kΩ arasına sıçrar; akım kendi kendini sınırlar.',
      'Soğuyunca otomatik reset — sigortadan farkı: tekrar kullanılabilir.',
      'Yanıt süresi 100 ms … birkaç saniye; hızlı overcurrent için eritme sigortası daha uygundur.'
    ],
    spiceTemplate: 'R_PTC N1 N2 100 tc=0.02',
    applications: ['USB port koruma', 'Motor overheat', 'Hat telefonu aşırı akım', 'Pil paketi koruma'],
    warnings: ['Trip sonrası I_h\'in altına düşmeden reset olmaz.']
  },

  ldr: {
    tagline: 'Pasif · Işık sensörü',
    whatItDoes: 'LDR (Light Dependent Resistor, fotorezistör) üstüne düşen ışık arttıkça direnci düşer. Karanlıkta MΩ, aydınlıkta birkaç yüz Ω olabilir. Yavaş (10–100 ms) ama ucuzdur.',
    equation: { formula: 'R = R_10lux · (E / 10)^−γ', label: 'Gamma ≈ 0.7–0.9, lineer değil' },
    chart: { type: 'log-log', title: 'R vs Aydınlatma', xLabel: 'E (lux)', yLabel: 'R (Ω)', curves: [{ label: 'Tipik CdS', points: [[0.1,1000000],[1,100000],[10,10000],[100,1000],[1000,100]] }] },
    keyParameters: [
      { name: 'Karanlık R', value: '100 kΩ … 100 MΩ', note: 'Tam karanlıkta' },
      { name: 'Aydınlık R', value: '100 Ω … 10 kΩ', note: '10 lux\'te' },
      { name: 'Spektral tepki', value: 'Cd-S ≈ 520 nm pik', note: 'İnsan gözüne benzer' }
    ],
    advanced: [
      'Cadmium sulfide (CdS) bazlı; RoHS\'ta cadmium kısıtlaması bazı pazarlarda sorunludur — fotodiyot ile değiştirilebilir.',
      'Hysterisis: parlak ışıktan karanlığa geçiş yavaştır, tam değer için dakikalar gerekebilir.',
      'Voltage divider ile Arduino analog pin\'inden okuma en basit yöntem; logaritmik ölçek için log-amp düşün.'
    ],
    spiceTemplate: 'R_LDR N1 N2 10k',
    applications: ['Sokak lambası otomatı', 'Gün doğumu alarm', 'Kamera pozlama', 'Yangın alarmı duman alg.'],
    warnings: ['Yanıt yavaştır — strobe veya hızlı sinyal için fotodiyot.']
  },

  varistor: {
    tagline: 'Pasif · Aşırı gerilim koruyucu',
    whatItDoes: 'Varistör (MOV, Metal Oxide Varistor) belirli bir eşik geriliminin altında çok yüksek dirençli, üstünde aniden iletken olur. Şebeke hatlarındaki ani yüksek gerilim darbelerini (lightning surge) emer ve yüke ulaşmasını engeller.',
    equation: { formula: 'I ≈ k · V^α', label: 'α = 25–50; keskin clamping davranışı' },
    keyParameters: [
      { name: 'V_clamp', value: '18 V … 1.5 kV', note: 'Eşik gerilimi' },
      { name: 'Enerji', value: '0.1 J … 1 kJ', note: 'Surge sırasında emilen' },
      { name: 'Tepki süresi', value: '<25 ns', note: 'Piko saniye darbelere yetmez' }
    ],
    advanced: [
      'Çoklu darbede aşınır — enerji kümülatif, MOV zamanla V_clamp düşer.',
      'TVS diyotu daha hızlıdır (<1 ns) ama enerji kapasitesi düşük; ikisi birlikte sıkça kullanılır.',
      'Şebeke girişinde sigortayla seri bağlanır — MOV kısa devreye gittiğinde sigorta atmalı.'
    ],
    spiceTemplate: 'V_MOV N1 N2 DC 0 ; idealized clamp with diode chain',
    applications: ['AC priz koruması', 'SMPS primer koruması', 'Anten/kablo giriş koruması', 'Motor bobini snubber'],
    warnings: ['Aşınan MOV sessizce çöker — düzenli değiştir.', 'Kısa devre olursa ısınıp patlar.']
  },

  crystal: {
    tagline: 'Pasif · Rezonatör',
    whatItDoes: 'Kristal (quartz crystal) piezoelektrik kuvars ile mekanik olarak rezonansa girer. Üstüne AC verildiğinde yalnızca belirli, çok dar bir frekansta verimli titrer. Milyonda bir hata mertebesinde frekans referansı üretir.',
    equation: { formula: 'f = 1/(2π√(L·C_m))', label: 'Seri rezonans (motional L ve C)' },
    keyParameters: [
      { name: 'Frekans', value: '32.768 kHz … 200 MHz', note: 'Saat kristalleri 32.768 kHz' },
      { name: 'Tolerans', value: '±10 … ±100 ppm', note: '±1 ppm özel grade (TCXO)' },
      { name: 'ESR', value: '10 Ω … 100 kΩ', note: 'Yüksek ESR → başlatma zor' },
      { name: 'Load kapasitansı', value: '8 … 22 pF', note: 'PCB layout ile eşle' }
    ],
    advanced: [
      'Seri vs paralel rezonans: 10–100 Hz aralığıyla ayrılır; veri sayfasında hangisi olduğuna dikkat.',
      'Pierce osilatörü (iki kapasitör + invertör) en yaygın topoloji; load kapasitansı = (C1·C2)/(C1+C2) + C_stray.',
      'Sıcaklık eğrisi ilk dereceden parabol — TCXO içindeki sıcaklık kompanzasyonu bu eğriyi düzeltir.',
      'OCXO (oven) oda sıcaklığının üstünde sabit tutar → <1 ppb kararlılık.'
    ],
    spiceTemplate: 'XTAL N1 N2 XTAL_16M ; subcircuit: L_m, C_m, R_m, C_0',
    applications: ['MCU saat kaynağı', 'RTC (32.768 kHz)', 'Radyo haberleşme', 'USB host saat', 'Ölçüm frekans referansı'],
    warnings: ['Mekanik darbe kristali çatlatır — vibrasyonlu ortamda MEMS osilatör düşün.']
  },

  coupled_l: {
    tagline: 'Pasif · Manyetik bağlı',
    whatItDoes: 'Bağlı bobin (coupled inductor) ortak çekirdek etrafında iki veya daha fazla sarımla, birindeki akımın diğerinde manyetik olarak gerilim indüklediği bileşendir. Trafo bunun uygulamasıdır; flyback SMPS\'de enerji depolayıp transferi için de kullanılır.',
    equation: { formula: 'k = M / √(L₁·L₂)', label: 'Bağlaşım katsayısı — ideal trafoda k=1' },
    keyParameters: [
      { name: 'L₁, L₂', value: 'µH … mH', note: 'Birincil/ikincil sarım indüktansları' },
      { name: 'k (coupling)', value: '0.7 … 0.99', note: 'Planar 0.98, ferrit 0.95' },
      { name: 'Dönüş oranı', value: '√(L₁/L₂)', note: 'Trafo fonksiyonu' }
    ],
    advanced: [
      'Leakage (kaçak) indüktansı = L·(1−k²) — flyback\'te snubber gerektiren kısım.',
      'Polarite noktası (dot convention) devre analizinde kritik; yanlış yorumlanırsa üretilen gerilim işareti ters döner.',
      'Common-mode choke = bağlı bobinin EMI uygulamasıdır — iki sarım aynı yönde gelen akımı keser, zıt akımı iletir.'
    ],
    spiceTemplate: 'L1 N1 N2 100u\nL2 N3 N4 100u\nK L1 L2 0.98',
    applications: ['Flyback SMPS', 'İzolasyon trafosu', 'EMI common-mode choke', 'Empedans eşleyici', 'Geribesleme optoizolatörü (foto)'],
    warnings: ['Yanlış polarite → flyback\'te MOSFET patlar.']
  },

  tline: {
    tagline: 'Pasif · Dağıtılmış',
    whatItDoes: 'İletim hattı (transmission line) uzun PCB izleri, koaksiyel kablo, stripline gibi yapıların RF davranışını modelleyen dağıtılmış parametreli bir eleman. Empedans eşleşmemesi yansıma ve duran dalga yaratır.',
    equation: { formula: 'Z₀ = √(L/C)', label: 'Karakteristik empedans' },
    keyParameters: [
      { name: 'Z₀', value: '50 Ω (RF), 75 Ω (video), 100 Ω (diff)', note: 'Hedef empedans' },
      { name: 'Dielektrik', value: 'FR4 ε_r≈4.3, Rogers ≈3.0', note: 'v_prop = c/√ε_r' },
      { name: 'VSWR', value: '1.0 (mükemmel) … ∞', note: 'Yük eşleşme kalitesi' }
    ],
    advanced: [
      'Elektriksel uzunluk λ/10\'dan büyükse hat lumped değil dağıtılmış davranır — o noktada iletim hattı modeli şart.',
      'Yansıma katsayısı Γ = (Z_L − Z₀)/(Z_L + Z₀); eşleşmiş yükte Γ=0.',
      'Smith chart bu hesapları grafik olarak yapar — RF tasarımın ana aracı.'
    ],
    spiceTemplate: 'T1 N1 0 N2 0 Z0=50 TD=1n',
    applications: ['RF anten besleme', 'USB/HDMI diff pair', 'PCB clock trace', 'Coax kablo simülasyonu'],
    warnings: ['DC simulasyonda anlamlı davranmaz — AC/transient analiz gerekli.']
  },

  // ═══ KAYNAKLAR ═══
  vdc: {
    tagline: 'Kaynak · DC ideal',
    whatItDoes: 'DC gerilim kaynağı (DC Source) uçlarında sabit bir gerilim tutar — akım ne olursa olsun. İdeal modelde iç direnç sıfırdır; gerçek pil birkaç miliohm\'dan birkaç ohm\'a iç direnç gösterir.',
    equation: { formula: 'V_out = V_set', label: 'Yüke bağımsız sabit gerilim' },
    keyParameters: [
      { name: 'Gerilim', value: '1 mV … 1 kV+', note: 'Sim\'de sınırsız' },
      { name: 'İç direnç (R_s)', value: '0 Ω (ideal)', note: 'Lab PSU 10 mΩ tipik' },
      { name: 'Ripple', value: '0 (ideal)', note: 'SMPS 10–100 mV' }
    ],
    advanced: [
      'Thevenin eşdeğeri: her aktif lineer devre → kaynak + seri direnç; DC kaynak bu dönüşümün sol yarısıdır.',
      'Gerçek güç kaynaklarında output impedance frekansla değişir — decoupling kapasitör alçak empedans sağlar.',
      'Paralel bağlanan ideal kaynaklar farklı voltajdaysa sonsuz akım — sim kilitlenir.'
    ],
    spiceTemplate: 'V1 N+ N- DC 5',
    applications: ['Pil modelleme', 'Sabit gerilim referansı', 'Test düzeneği besleme'],
    warnings: ['Kısa devrede ideal kaynak sonsuz akım sağlar — gerçek dünyada R_s ekle.']
  },

  vac: {
    tagline: 'Kaynak · AC sinüs',
    whatItDoes: 'AC kaynak sinüs dalgası üretir. Tepe genliği, frekans ve faz açısıyla tanımlanır. Şebeke elektriği 230 V RMS / 50 Hz bir AC kaynağıdır.',
    equation: { formula: 'V(t) = V_p · sin(2π·f·t + φ)', label: 'V_p tepe, f frekans Hz, φ faz radyan' },
    keyParameters: [
      { name: 'V_peak', value: 'kullanıcı tanımlı', note: 'V_RMS = V_p / √2' },
      { name: 'Frekans', value: 'DC … GHz', note: 'Sim\'de sınırsız' },
      { name: 'Faz', value: '0 … 2π rad', note: 'Çoklu kaynakta referans' }
    ],
    advanced: [
      'AC analiz (.AC) tek sinüs frekansında sistemin genlik+faz tepkisini (Bode) üretir; küçük-sinyal lineerleştirmesi kullanır.',
      'Transient analizinde (.TRAN) gerçek dalga formu bir bir çözülür — non-lineer etkiler görünür.',
      'RMS değer: bir Ω\'luk yüktekiyle aynı ısıyı üreten DC eşdeğeri. Sinüste V_RMS = V_p/√2 ≈ 0.707·V_p.'
    ],
    spiceTemplate: 'V1 N+ N- AC 1 SIN(0 1 1k 0 0)',
    applications: ['Şebeke simülasyonu', 'Bode plot test sinyali', 'Filter frekans tepkisi', 'Anten driver'],
    warnings: ['Yüksek frekansta gerçek jeneratör çıkış empedansı sıfır değil — 50 Ω tipik.']
  },

  pulse: {
    tagline: 'Kaynak · Darbe / PWM',
    whatItDoes: 'Darbe kaynağı (pulse source) düşük ve yüksek olmak üzere iki seviye arasında periyodik olarak atlar. Yükselme/düşme süreleri, doluluk oranı (duty cycle) ve periyot parametreleriyle her türlü kare dalgayı üretir.',
    equation: { formula: 'V(t) = V1 → V2 her PER', label: 'Parametreler: TD, TR, TF, PW, PER' },
    keyParameters: [
      { name: 'V1, V2', value: 'alt / üst seviye', note: 'Lojik için 0/3.3 tipik' },
      { name: 'TD', value: 'delay', note: 'İlk kenara kadar geçen süre' },
      { name: 'TR / TF', value: 'rise / fall', note: '0 verilirse ideal kenar' },
      { name: 'PW / PER', value: 'width / period', note: 'Duty = PW/PER' }
    ],
    advanced: [
      'Rise/fall zamanı sıfır verilirse sim çok küçük bir geçiş eklemeye zorlanabilir — sayısal verimsizlik.',
      'PWM için PW\'yi duty oranıyla değiştir; taşıyıcı frekansı 1/PER.',
      'Clock/stimulus için en uygun kaynak türü; kenar saydırma ve timing analizinde ideal.'
    ],
    spiceTemplate: 'V1 N+ N- PULSE(0 5 0 1n 1n 499n 1u)',
    applications: ['Dijital lojik stimulus', 'PWM sürme', '555 simülasyonu', 'Kenar trigger testi'],
    warnings: ['Çok dik kenar (TR=0) büyük dI/dt → indüktif yüklerde aşırı gerilim.']
  },

  pwl: {
    tagline: 'Kaynak · Piecewise-linear',
    whatItDoes: 'PWL (piecewise-linear) kaynağı, verilen (zaman, gerilim) nokta çiftleri arasında doğrusal bağlayarak istediğiniz özel dalgayı üretir. Gerçek ölçülmüş sinyali simülasyona aktarmanın en kolay yoludur.',
    equation: { formula: 'V(t) = lineer(pᵢ, pᵢ₊₁)', label: 'Ara noktalar lineer interpolasyon' },
    keyParameters: [
      { name: 'Nokta sayısı', value: '2 … sınırsız', note: 'Daha fazla nokta = daha iyi çözünürlük' },
      { name: 'Zaman adımı', value: 'ns … s', note: 'Dosyadan okuma destekler' }
    ],
    advanced: [
      'Osiloskop CSV\'si → PWL dizisi dönüşümü analog modelleme için standart yol.',
      'Tekrarlı olması için R (repeat) parametresi — her R kez tekrar eder.',
      'Çok uzun dizilerde .include ile ayrı dosya tercih et.'
    ],
    spiceTemplate: 'V1 N+ N- PWL(0 0 1n 1 2n 1 3n 0)',
    applications: ['Ölçülmüş sinyal replay', 'Özel trigger sequences', 'Audio waveform test', 'Glitch injection'],
    warnings: ['İlk nokta t=0\'dan geç başlarsa simülasyon o ana kadar 0 varsayar.']
  },

  iac: {
    tagline: 'Kaynak · AC akım',
    whatItDoes: 'AC akım kaynağı, bağlı olduğu yüke sinüs biçiminde akım pompalar. Gerilimi yük belirler. RF test, transkonduktans modelleme ve sensör simülasyonunda kullanılır.',
    equation: { formula: 'I(t) = I_p · sin(2π·f·t + φ)', label: 'Akım kontrollüdür; gerilim yük direncinin sonucu' },
    keyParameters: [
      { name: 'I_peak', value: 'µA … A', note: 'I_RMS = I_p/√2' },
      { name: 'Frekans', value: 'DC … GHz', note: 'Sim sınırsız' }
    ],
    advanced: [
      'AC akım kaynağı gerilim kaynağının düalidır — aynı analiz teknikleri (Bode, impedans) uygulanabilir.',
      'Pratikte tam akım kaynağı bulunmaz; gerilim kaynağı + büyük seri empedans yaklaşımdır.'
    ],
    spiceTemplate: 'I1 N+ N- AC 0.01 SIN(0 10m 1k)',
    applications: ['Transconductans ölçüm', 'Test sinyali (RF sensör)', 'Anten simülasyonu'],
    warnings: ['Açık devre → sonsuz gerilim, sim patlar.']
  },

  noise: {
    tagline: 'Kaynak · Gürültü',
    whatItDoes: 'Gürültü kaynağı (noise source) istatistiksel olarak rastgele gerilim üretir. Beyaz gürültü (tüm frekanslarda eşit güç) veya pembe gürültü (1/f) türleri vardır. Gürültü analizinde sistem performansını test eder.',
    equation: { formula: 'v_n² = 4·k·T·R·Δf', label: 'Johnson–Nyquist termal gürültü yoğunluğu' },
    keyParameters: [
      { name: 'Amplitüd RMS', value: 'µV … V', note: 'Ölçülen RMS değer' },
      { name: 'Bant genişliği', value: 'Hz … MHz', note: 'Band-limited generator' }
    ],
    advanced: [
      'Noise floor hesaplaması için .NOISE analizi çıkış portuna göre gürültü spektral yoğunluğu üretir.',
      'Input-referred noise = output noise / kazanç — amplifier karşılaştırmasında standart metrik.'
    ],
    spiceTemplate: 'V_noise N+ N- DC 0 TRNOISE(1u 1n 0)',
    applications: ['Opamp gürültü analizi', 'SNR ölçüm', 'Dither sinyal üretimi', 'ADC test'],
    warnings: ['Transient .TRAN için trnoise, küçük-sinyal için .NOISE — karıştırılırsa yanlış sonuç.']
  },

  vcvs: {
    tagline: 'Kaynak · Bağımlı (E)',
    whatItDoes: 'VCVS (Voltage-Controlled Voltage Source, E elemanı) başka iki düğüm arasındaki gerilimi kazançla çarpıp kendi uçlarında üretir. İdeal op-amp davranışını modellemenin en temiz yolu.',
    equation: { formula: 'V_out = e · (V+ − V−)', label: 'Kazanç e birimsizdir' },
    keyParameters: [
      { name: 'Kazanç (e)', value: '1 … 10⁶+', note: 'Op-amp için 10⁵ tipik' }
    ],
    advanced: [
      'E elemanı girişten çıkışa sonsuz empedans yansıtır → gerçek op-amp yaklaşımı ama çıkış empedansı yoktur.',
      'Polynomial veya tablolaştırılmış form (E=POLY) non-lineer transfer yaratır.'
    ],
    spiceTemplate: 'E1 Nout 0 N+ N- 1000',
    applications: ['İdeal op-amp modelleme', 'Voltage buffer', 'Fark alıcı', 'Transfer function simulation'],
    warnings: ['Kazanç çok yüksekse çıkış rail\'e çarpar — limitler yok.']
  },

  vccs: {
    tagline: 'Kaynak · Bağımlı (G)',
    whatItDoes: 'VCCS (Voltage-Controlled Current Source, G elemanı) iki düğüm arasındaki gerilim kontrolünden çıkışına akım pompalar. MOSFET\'in drain akımı modelinin temelidir.',
    equation: { formula: 'I_out = g · (V+ − V−)', label: 'Transkonduktans (S = 1/Ω)' },
    keyParameters: [
      { name: 'g_m', value: 'µS … S', note: 'MOSFET\'te µS–mS mertebesi' }
    ],
    advanced: [
      'Küçük-sinyal MOSFET modeli: i_d = g_m · v_gs + v_ds/r_o — G elemanı tam bu yapının karşılığı.',
      'OTA (operational transconductance amplifier) G ile modellenir — filtre sentezinde temel blok.'
    ],
    spiceTemplate: 'G1 Nout 0 Vctrl+ Vctrl- 0.001',
    applications: ['MOSFET küçük-sinyal', 'OTA modelleme', 'Gm-C filter', 'Current-mode control'],
    warnings: ['Çıkış kısa devreye yapılırsa yine ideal — yük sınır koymaz.']
  },

  ccvs: {
    tagline: 'Kaynak · Bağımlı (H)',
    whatItDoes: 'CCVS (Current-Controlled Voltage Source, H elemanı) bir referans dalından akan akım ile çıkış gerilimini belirler. Transimpedans (akım→gerilim) dönüşümünün temiz modelidir.',
    equation: { formula: 'V_out = h · I_in', label: 'h birimi Ω' },
    keyParameters: [
      { name: 'h (Ω)', value: '1 Ω … 1 MΩ+', note: 'Transimpedans' }
    ],
    advanced: [
      'TIA (transimpedance amplifier) fotodiyot arayüzünde akımı gerilime çevirir — H temel modelidir.',
      'Referans akımı bir V-kaynağı üzerinden geçmeli; Vdummy (0V) kaynak bu amaca hizmet eder.'
    ],
    spiceTemplate: 'Vsense Nsense+ Nsense- 0\nH1 Nout 0 Vsense 1k',
    applications: ['TIA simülasyonu', 'Akım probu modeli', 'Sensör arayüz'],
    warnings: ['Vsense kaynağı unutulursa SPICE hatası verir.']
  },

  cccs: {
    tagline: 'Kaynak · Bağımlı (F)',
    whatItDoes: 'CCCS (Current-Controlled Current Source, F elemanı) bir referans dalındaki akımı kazanç ile çarpıp kendi çıkışına aktarır. Akım aynası (current mirror) ve bipolar transistörün β modelinin çekirdeğidir.',
    equation: { formula: 'I_out = f · I_in', label: 'Kazanç f birimsizdir' },
    keyParameters: [
      { name: 'f (β)', value: '10 … 500+', note: 'BJT için hFE' }
    ],
    advanced: [
      'β = I_C / I_B BJT için F elemanıyla doğrudan modellenir.',
      'Wilson/cascode current mirror gibi yapılar F kullanılarak davranışsal seviyede hızla prototiplenir.'
    ],
    spiceTemplate: 'Vsense Nin+ Nin- 0\nF1 Nout 0 Vsense 100',
    applications: ['Current mirror', 'BJT davranışsal model', 'Akım yükselteci'],
    warnings: ['Akım yönünü (dummy kaynak polaritesi) dikkatli seç — işaret terse döner.']
  },

  behavioral: {
    tagline: 'Kaynak · Davranışsal (B)',
    whatItDoes: 'B kaynağı (behavioral source) keyfi bir matematiksel ifadeyle gerilim ya da akım üretir. V=I1*V(N2)+sqrt(V(N3)) gibi formüllerle idealleştirilmiş blokları modellemenin en güçlü yolu.',
    equation: { formula: 'V = f(x,y,z…) or I = f(...)', label: 'İfade dili: +, -, *, /, sin, log, if, limit' },
    keyParameters: [
      { name: 'İfade', value: 'kullanıcı yazar', note: 'Çalışma zamanı değerlendirilir' }
    ],
    advanced: [
      'Kompleks non-lineer parçaları (örn. termistör, foto-sensör) tek satırda modelleyebilir.',
      'limit(), if() fonksiyonları ile saturation ve dead-band mantıkları dahili.',
      'Davranışsal kaynaklar Newton-Raphson adımında türevlenir → türev analitik ise yakınsaması hızlı.'
    ],
    spiceTemplate: 'B1 Nout 0 V=limit(V(Nin)*2, -5, 5)',
    applications: ['İdeal bloklar (ADC/DAC)', 'Non-lineer sensör', 'Transfer fonksiyonu replikası', 'Hata amplifikatörü'],
    warnings: ['İfadede tanımsız bölme/log → simülasyon NaN üretir.']
  },

  // ═══ YARIİLETKEN ═══
  diode: {
    tagline: 'Yarıiletken · Tek yönlü',
    whatItDoes: 'Diyot akımı sadece tek yönde geçirir. İleri yönlü bağlandığında yaklaşık 0.7 V\'lik bir gerilim düşüşüyle iletir, ters bağlandığında kesim halindedir. Yönü anot (+) → katod (−).',
    equation: { formula: 'I_D = I_S · (exp(V_D/(n·V_T)) − 1)', label: 'Shockley denklemi — V_T≈26 mV, n ideality 1–2' },
    chart: { type: 'exp', title: 'Shockley karakteristiği', xLabel: 'V_D (V)', yLabel: 'I_D (mA)', curves: [{ label: '1N4148', points: [[0,0],[0.4,0.05],[0.5,0.5],[0.6,5],[0.7,50],[0.75,200]] }], annotation: 'V_F ≈ 0.7 V eşik' },
    keyParameters: [
      { name: 'V_F', value: '0.3 V (Ge) / 0.7 V (Si) / 3.3 V (LED beyaz)', note: 'İleri gerilim' },
      { name: 'I_F(max)', value: '100 mA … 100 A', note: 'Sürekli ileri akım' },
      { name: 'PIV / V_R', value: '50 V … 1 kV', note: 'Ters gerilim dayanımı' },
      { name: 'Reverse recovery', value: 'ns … µs', note: 'Yüksek hızda önemli' }
    ],
    advanced: [
      'Junction capacitance ters-bias\'ta azalır — varaktör diyotlar bu etkiyle frekans değiştirir.',
      'Schottky diyotu metal-yarıiletken birleşimi; V_F ≈ 0.3 V, reverse recovery yok → SMPS ideali.',
      'Avalanche vs Zener breakdown: 6 V altında Zener, üstünde avalanche baskındır; TC de işaret değiştirir.',
      'Termal runaway: I_F arttıkça ısınır, ısınınca daha çok iletir → parallel diyotlarda eşit yük için balance direnci şart.'
    ],
    spiceTemplate: 'D1 Nanot Nkatot D1N4148',
    applications: ['AC → DC doğrultma', 'Flyback snubber', 'Polarite koruması', 'Voltage clamp', 'OR logic (low-side)', 'Peak detektör'],
    warnings: ['PIV aşılırsa breakdown kalıcı olabilir.', 'Akım sınırlayıcı olmadan sürmek yakar.']
  },

  led: {
    tagline: 'Yarıiletken · Işık',
    whatItDoes: 'LED (Light Emitting Diode) ileri yönlü akım geçtiğinde ışık yayan bir diyottur. İleri gerilimi rengine göre değişir: kırmızı 1.8 V, beyaz 3.3 V, UV 4 V. Akım ile ışık şiddeti doğru orantılı, ama mutlaka akım sınırlayıcı gerekir.',
    equation: { formula: 'R_series = (V_supply − V_F) / I_F', label: 'Sürme direnci hesabı' },
    keyParameters: [
      { name: 'V_F', value: '1.8 V (kırmızı) … 4 V (UV)', note: 'Renge bağlı' },
      { name: 'I_F', value: '10 mA … 350 mA', note: 'Indicator 20 mA, power 350 mA+' },
      { name: 'Lümen / W', value: '50 … 200 lm/W', note: 'Modern beyaz LED' },
      { name: 'Görüş açısı', value: '15° … 180°', note: 'Optik lens ile daraltılır' }
    ],
    advanced: [
      'LED bir akım kaynağıyla sürülmeli; sabit gerilim ile sürme sıcaklık + toleransla patlamaya götürür.',
      'PWM ile parlaklık kontrolü — sürme akımını sabit tut, duty cycle değiştir; CCR (constant current reduction) alternatifi gri-scale doğruluğu için.',
      'ESD\'ye hassas — GaN tabanlı yüksek güçlü LEDler girişine Zener konur.',
      'Sıcaklık arttıkça V_F düşer (~2 mV/°C) — akım kaynağı şart.'
    ],
    spiceTemplate: 'D_LED Nanot Nkatot LED_RED',
    applications: ['Göstergeler', 'Ekran arka ışık', 'Aydınlatma', 'Optokuplaj', 'Haberleşme (Li-Fi)'],
    warnings: ['Akım sınırlama yok → LED yanar.', 'Polarite ters → akıtmaz, PIV aşılırsa bozulur.']
  },

  zener: {
    tagline: 'Yarıiletken · Ters regülasyon',
    whatItDoes: 'Zener diyot ileri yönlü normal diyot gibi çalışır, ama TERS bağlandığında belirli bir gerilimde (Vz) kırılır ve bu gerilimi sabit tutar. Basit, ucuz voltaj regülasyonunun temelidir.',
    equation: { formula: 'V_out ≈ V_Z (I > I_Zmin)', label: 'V_Z akımdan zayıf bağımlıdır' },
    keyParameters: [
      { name: 'V_Z', value: '2.4 V … 200 V', note: 'Katalog değeri' },
      { name: 'I_Zmin', value: '100 µA … 5 mA', note: 'Bu akımın altında regüle etmez' },
      { name: 'P_max', value: '250 mW … 5 W', note: 'V_Z × I_Z toplamı' }
    ],
    advanced: [
      'Sıcaklık katsayısı: 5.6 V\'ta TC ≈ 0 — kararlı referans için bu değer seçilir.',
      'Gerçek voltaj regülasyonu için seri direnç + Zener şönt → çıkış ripple düşük değildir; yüklü uygulamada shunt regulator yerine LDO daha iyi.',
      'TL431 programlanabilir şönt referansı Zener yerine tercih edilir — 1% doğruluk + ayarlanabilir V_Z.'
    ],
    spiceTemplate: 'D_Z Nanot Nkatot DZENER_5V1',
    applications: ['Voltaj klamp', 'Referans gerilim', 'Aşırı gerilim koruma', 'Bias noktası ayarı'],
    warnings: ['Dağınıklık + sıcaklık nedeniyle ±5% tolerans tipik.', 'I_Z > I_Zmin olmadan yüzer.']
  },

  schottky: {
    tagline: 'Yarıiletken · Hızlı diyot',
    whatItDoes: 'Schottky diyotu metal-yarıiletken birleşimiyle yapılan, V_F ≈ 0.3 V ve reverse recovery ≈ 0 olan hızlı bir diyottur. SMPS, polarite koruma, RF karıştırıcı gibi uygulamalarda tercih edilir.',
    equation: { formula: 'I = I_S · (exp(V/(n·V_T)) − 1)', label: 'Düşük I_S ve n ≈ 1.05–1.3' },
    keyParameters: [
      { name: 'V_F', value: '0.15 V … 0.45 V', note: 'Akımla artar' },
      { name: 'V_R_max', value: '15 V … 200 V', note: 'Yüksek V için Si daha iyi' },
      { name: 'Reverse leakage', value: 'µA … mA', note: 'Si diyoda göre yüksek' }
    ],
    advanced: [
      'Reverse recovery yok → SMPS sıfırdan 1 MHz\'e dek verimli çalışır.',
      'Leakage sıcaklıkla üstel büyür → yüksek T\'de termal runaway riski.',
      'GaN Schottky SiC\'den sonra geliyor — çok daha hızlı, çok daha pahalı.'
    ],
    spiceTemplate: 'D1 A K SCHOTTKY_1N5819',
    applications: ['SMPS rectifier', 'Düşük Vf polarite koruması', 'RF detector', 'OR gate (ideal diode)'],
    warnings: ['Leakage sıcakta yüksek — yüksek-T uygulamada dikkat.']
  },

  npn: {
    tagline: 'Yarıiletken · BJT',
    whatItDoes: 'NPN transistör (Bipolar Junction Transistor) küçük bir base akımı ile çok daha büyük bir collector akımı kontrol eder. Baz akımı × β = kollektör akımı kuralıyla yükselteç veya anahtar olarak çalışır.',
    equation: { formula: 'I_C = β · I_B,  V_BE ≈ 0.7 V', label: 'Aktif bölge — Ebers-Moll modelinin basitleştirmesi' },
    chart: { type: 'output-char', title: 'I_C vs V_CE (I_B sabit)', xLabel: 'V_CE (V)', yLabel: 'I_C (mA)', curves: [
      { label: 'I_B=10µA', points: [[0,0],[0.2,1.5],[1,2.3],[5,2.5],[10,2.6]] },
      { label: 'I_B=30µA', points: [[0,0],[0.2,4.5],[1,7],[5,7.5],[10,7.8]] },
      { label: 'I_B=50µA', points: [[0,0],[0.2,7.5],[1,11.5],[5,12.5],[10,13]] }
    ], annotation: 'Active bölge V_CE > 0.3 V' },
    keyParameters: [
      { name: 'β (hFE)', value: '50 … 500+', note: 'Sıcaklık + I_C ile değişir' },
      { name: 'V_BE', value: '0.6 … 0.7 V', note: 'Aktif bölgede' },
      { name: 'V_CE_sat', value: '0.1 … 0.3 V', note: 'Anahtar olarak doymada' },
      { name: 'f_T', value: 'MHz … GHz', note: 'Kazanç-bant çarpımı' },
      { name: 'I_C_max', value: '100 mA (2N3904) … 30 A', note: 'Sürekli akım sınırı' }
    ],
    advanced: [
      'Ebers-Moll modeli: I_E = I_ES·(exp(V_BE/V_T)−1) − α_R·I_CS·(exp(V_BC/V_T)−1) — tüm bölgelerde geçerli.',
      'Gummel-Poon model eklentisi: yüksek-seviye injection, Early etkisi (V_A), ve çarpma efektlerini katar.',
      'Early etkisi: V_CE arttıkça I_C artar → r_o = V_A/I_C çıkış empedansı.',
      'Termal runaway: I_C artar → ısınır → V_BE düşer → I_C daha da artar. Emitter direnci (R_E) doğal negatif geribesleme sağlar.',
      'Saturation hafif dizgin verir — hızlı switch için proportional base drive veya Schottky clamp (Baker).'
    ],
    spiceTemplate: 'Q1 Nc Nb Ne QNPN_2N3904',
    applications: ['Common-emitter amp', 'Switching', 'Current mirror', 'Darlington', 'Differential pair'],
    warnings: ['V_CE_max aşılırsa avalanche.', 'Termal runaway → emitter degen zorunlu.']
  },

  pnp: {
    tagline: 'Yarıiletken · BJT (tamamlayıcı)',
    whatItDoes: 'PNP transistör NPN\'in tamamlayıcısıdır. Akım ve gerilim yönleri terstir; emitter collector\'dan pozitiftir, baz emitter\'den negatif. High-side switching\'te NPN\'nin bacakları yetmediğinde PNP kullanılır.',
    equation: { formula: 'I_C = β · I_B (mutlak değer)', label: 'İşaretler NPN\'nin tersi' },
    keyParameters: [
      { name: 'β (hFE)', value: '50 … 300', note: 'NPN muadiline göre biraz düşük' },
      { name: 'V_EB', value: '0.6 … 0.7 V', note: 'Aktifte' },
      { name: 'I_C_max', value: '100 mA … 10 A', note: 'Genelde NPN\'den düşük' }
    ],
    advanced: [
      'Push-pull çıkış katında NPN+PNP simetrik çift kullanılır.',
      'PNP\'nin f_T genelde NPN muadilden düşüktür → aynı devrede RF\'de asimetri.',
      'Komplementer çiftler: 2N3904/2N3906, BC547/BC557, MJL3281/MJL1302.'
    ],
    spiceTemplate: 'Q1 Nc Nb Ne QPNP_2N3906',
    applications: ['High-side switch', 'Push-pull amp', 'Level shift (NPN cascaded)', 'Current mirror PMOS muadili'],
    warnings: ['Yönleri ters — base-emitter diyot tersine çalışır.']
  },

  nmos: {
    tagline: 'Yarıiletken · MOSFET',
    whatItDoes: 'N-channel MOSFET gate\'e uygulanan gerilim ile drain-source arasındaki kanalı açar. Baz akımı gerektirmez (neredeyse sıfır gate akımı). Anahtarlama ve analog uygulamada BJT\'nin en yaygın halefi.',
    equation: { formula: 'I_D = (µnCox·W/L)/2 · (V_GS − V_th)²', label: 'Saturation bölgesi, kare-yasası' },
    chart: { type: 'output-char', title: 'I_D vs V_DS (V_GS sabit)', xLabel: 'V_DS (V)', yLabel: 'I_D (A)', curves: [
      { label: 'V_GS=4V', points: [[0,0],[1,1.3],[2,2.3],[4,2.5],[10,2.6]] },
      { label: 'V_GS=6V', points: [[0,0],[1,3.5],[2,6],[4,7],[10,7.5]] },
      { label: 'V_GS=8V', points: [[0,0],[1,6],[2,10],[4,12],[10,13]] }
    ] },
    keyParameters: [
      { name: 'V_th', value: '1 V (logic) … 4 V (std)', note: 'Gate threshold' },
      { name: 'R_DS(on)', value: 'mΩ … Ω', note: 'Doyma bölgesinde direnç' },
      { name: 'I_D_max', value: '1 A … 300 A+', note: 'Paket + soğutmayla sınırlı' },
      { name: 'V_DS_max', value: '20 V … 1 kV', note: 'Breakdown gerilimi' },
      { name: 'Q_g / C_iss', value: 'nC / pF', note: 'Gate driver akım seçimi' }
    ],
    advanced: [
      'MOSFET square-law ideal; sub-threshold bölgede I_D üstel — düşük-güç analog tasarımda önemli.',
      'Body effect (γ): source-to-bulk gerilimi V_th\'yi kaydırır → stacked switch\'lerde dikkat.',
      'SOA (Safe Operating Area) eğrisi V_DS–I_D uzayında izinli bölgeyi gösterir; lineer bölgede kullanırken kritik.',
      'Gate oxide reliability: sabit V_GS > V_GS_max cihazı dakikalar içinde yakar.',
      'Miller plateau anahtarlamada gate charge eğrisinde düzleşme — driver akımı bu bölgede sabit kalmalı.'
    ],
    spiceTemplate: 'M1 Nd Ng Ns Nb NMOS_IRF540 W=1u L=1u',
    applications: ['SMPS anahtarı', 'Motor drive', 'Load switch', 'Analog switch', 'RF amp'],
    warnings: ['Gate ESD hassasiyeti yüksek — resistör + Zener.', 'Static charge body-gate oksidini deler.']
  },

  pmos: {
    tagline: 'Yarıiletken · MOSFET (tamamlayıcı)',
    whatItDoes: 'P-channel MOSFET nMOS\'un tamamlayıcısıdır. Gate source\'tan negatif olduğunda iletir. High-side load switch için en kolay çözümdür — gate\'i ground\'a çekince açılır.',
    equation: { formula: 'I_D = (µpCox·W/L)/2 · (V_GS − V_th)², V_th < 0', label: 'nMOS denkleminin işaret tersidir' },
    keyParameters: [
      { name: 'V_th', value: '−1 V … −4 V', note: 'Negatif eşik' },
      { name: 'R_DS(on)', value: 'mΩ … Ω', note: 'nMOS\'tan ~2–3× yüksek' },
      { name: 'I_D_max', value: '1 A … 100 A+', note: '' }
    ],
    advanced: [
      'Hole mobility < electron mobility → aynı W·L\'de pMOS iletkenlik nMOS\'un yarısıdır. CMOS\'ta pMOS W 2–3× daha büyük yapılır.',
      'High-side load switch\'te pMOS gate source gerilimine göre sürülür → open-drain NPN ile kolay.',
      'Complementary pairs: IRF540/IRF9540, Si2301/Si2303, FQP30N06/FQP27P06.'
    ],
    spiceTemplate: 'M1 Nd Ng Ns Nb PMOS_IRF9540',
    applications: ['High-side load switch', 'Battery reverse protection', 'CMOS logic pull-up', 'Charge pump PMOS'],
    warnings: ['V_GS polaritesi nMOS\'un tersi — kolayca karıştırılır.']
  },

  njfet: {
    tagline: 'Yarıiletken · JFET',
    whatItDoes: 'N-kanal JFET (Junction FET) sıfır V_GS\'te açıktır (depletion mode) — gate\'e giderek daha negatif gerilim uygulandıkça akım düşer. Yüksek giriş empedansı gereken lineer amp katlarında klasik seçimdir.',
    equation: { formula: 'I_D = I_DSS · (1 − V_GS/V_P)²', label: 'V_P pinch-off gerilimi' },
    keyParameters: [
      { name: 'I_DSS', value: '1 mA … 50 mA', note: 'V_GS=0 saturation akımı' },
      { name: 'V_P / V_GS(off)', value: '−0.5 V … −6 V', note: 'Pinch-off' },
      { name: 'g_m', value: '1 … 10 mS', note: 'Transkonduktans' }
    ],
    advanced: [
      'JFET depletion-mode\'dur: "daha iyi" veya "daha kötü" yok, hep akıtır, V_GS ile kısılır.',
      'Gürültüsü MOSFET\'ten düşük — ön-amp\'te tercih edilir (phono amp, instrumentation front-end).',
      'Gate-source diyotuyla forward\'a sürülmemeli; tipik çalışma V_GS < 0.'
    ],
    spiceTemplate: 'J1 Nd Ng Ns JFET_2N5457',
    applications: ['Düşük gürültülü ön-amp', 'Cascode biasing', 'Akım kaynağı (diode-connected JFET)', 'Mute switch (audio)'],
    warnings: ['V_GS > 0 → gate-source diyot açılır, cihaz yanar.']
  },

  pjfet: {
    tagline: 'Yarıiletken · JFET (tamamlayıcı)',
    whatItDoes: 'P-kanal JFET, n-JFET\'in tamamlayıcısıdır. Pinch-off için POZİTİF V_GS gerekir. Audio çift-katlı tasarımlarda simetrik top-bottom topoloji için kullanılır.',
    equation: { formula: 'I_D = I_DSS · (1 − V_GS/V_P)², V_P > 0', label: '' },
    keyParameters: [
      { name: 'I_DSS', value: '1 … 30 mA', note: '' },
      { name: 'V_P', value: '+0.5 V … +6 V', note: '' }
    ],
    advanced: [
      'Complementary JFET pairs (2SJ74/2SK170 gibi) audio dünyasında efsane statü — artık sınırlı üretim.',
      'MOSFET süpürdü JFET\'i power alanında; analog ön-amp\'te hâlâ niş kullanımlar var.'
    ],
    spiceTemplate: 'J1 Nd Ng Ns PJFET_2N5462',
    applications: ['Fark katı PJFET', 'Cascode yük', 'Discrete audio front-end'],
    warnings: ['Mainstream üreticiler bıraktı — alternatif bulunması zor.']
  },

  igbt: {
    tagline: 'Yarıiletken · Güç anahtarı',
    whatItDoes: 'IGBT (Insulated Gate Bipolar Transistor) MOSFET\'in kolay gate sürüşü ile BJT\'nin düşük iletim kayıplarını birleştirir. Yüksek gerilim + yüksek akım güç elektroniği için tasarlanmıştır.',
    equation: { formula: 'V_CE(sat) ≈ V_BE + I_C·R_ch', label: 'BJT + MOSFET serisi eşdeğer' },
    keyParameters: [
      { name: 'V_CES', value: '600 V … 6.5 kV', note: 'Kollektör-emitter breakdown' },
      { name: 'I_C(nom)', value: '10 A … 2 kA', note: 'Nominal akım' },
      { name: 'V_CE(sat)', value: '1.5 … 3 V', note: 'Aynı akımda MOSFET\'ten yüksek' },
      { name: 'Switching freq', value: '1 kHz … 20 kHz', note: 'Üstünde kayıplar baskın' }
    ],
    advanced: [
      '600 V+ ve 20+ A bölgesinde MOSFET\'in iletim kayıpları IGBT\'den büyüktür → IGBT baskın.',
      'Tail current: IGBT kapanırken minority carrier\'lar rekombine olana dek akım akar → switching loss burada.',
      'SiC MOSFET son yıllarda IGBT\'nin üstüne çıkıyor — daha hızlı, daha az kayıp, daha pahalı.'
    ],
    spiceTemplate: 'Q1 Nc Ng Ne IGBT_IRGP4066D',
    applications: ['Motor sürücü (VFD)', 'Güneş inverter', 'Trafo kaynak', 'İndüksiyon fırını'],
    warnings: ['Short-circuit withstand 5–10 µs — desat detection şart.', 'dV/dt ile Miller tetiklemesi patlamaya neden olur.']
  },

  scr: {
    tagline: 'Yarıiletken · Tetiklemeli',
    whatItDoes: 'SCR (Silicon-Controlled Rectifier, tristör) bir kez gate ile tetiklendiğinde, akım sıfıra düşene kadar açık kalan tek-yönlü bir anahtardır. AC faz kontrolü ve yüksek akım anahtarlamada temel bileşen.',
    equation: { formula: 'I_G > I_GT → ON, I < I_H → OFF', label: 'Latch davranışı' },
    keyParameters: [
      { name: 'V_DRM / V_RRM', value: '100 V … 6 kV', note: 'Tepe ters gerilim' },
      { name: 'I_T(RMS)', value: '1 A … 5 kA', note: 'Sürekli akım' },
      { name: 'I_GT', value: '10 µA … 100 mA', note: 'Gate tetik akımı' },
      { name: 'I_H (holding)', value: 'mA', note: 'Bu altına düşerse kapanır' }
    ],
    advanced: [
      'Faz kontrolü: AC yarım dalganın belli bir açısından sonra tetik → ortalama güç kontrolü (dimmer, motor).',
      'dV/dt ile yanlış tetiklenebilir → snubber (R+C) paraleli zorunlu.',
      'Commutation: AC\'de doğal sıfır geçişi kapatır; DC\'de forced commutation gerekir (SCR + LC).'
    ],
    spiceTemplate: 'X_SCR A K G SCR_BT151',
    applications: ['AC dimmer', 'Motor soft-start', 'Crowbar koruma', 'Yüksek güç kaynak anahtarı'],
    warnings: ['Bir kez tetiklendikten sonra gate kontrolü kaybolur.', 'Snubber\'sız dV/dt yanlış tetikler.']
  },

  triac: {
    tagline: 'Yarıiletken · Çift yönlü',
    whatItDoes: 'TRIAC ters-paralel iki SCR\'nin tek bileşende bütünleştirilmiş halidir. AC\'nin HER İKİ yarı dalgasını gate ile tetikleyerek geçirir. Ev ışık dimmerlarında, fan kontrolünde standart.',
    equation: { formula: 'I_G > I_GT → aktif, V × I=0 → kapan', label: '4 quadrant gate sürme' },
    keyParameters: [
      { name: 'V_DRM', value: '400 V / 600 V / 800 V', note: '220 V şebekede min 600 V' },
      { name: 'I_T(RMS)', value: '1 … 40 A', note: '' },
      { name: 'I_GT', value: 'mA', note: '4 modun her biri farklı' }
    ],
    advanced: [
      'MT1/MT2 terminal isimlendirmesi tarafsız; quadrant 1 (MT2 + gate +) en duyarlıdır.',
      'Zero-crossing detection ile tetikleme gürültüyü azaltır (snubberless, "random fire" yerine).',
      'Endüktif yüklerde snubber + dV/dt sınırlaması şart; yoksa commutation failure.'
    ],
    spiceTemplate: 'X_TRIAC MT1 MT2 G TRIAC_BT136',
    applications: ['AC dimmer (ışık, fan)', 'Motor hız kontrolü', 'Isıtıcı kontrolü', 'Solid-state relay'],
    warnings: ['Indüktif yükte snubber (0.1 µF + 100 Ω) olmadan kullanma.']
  },

  diac: {
    tagline: 'Yarıiletken · Breakover',
    whatItDoes: 'DIAC (Diode for AC) iki yönlü voltaj-tetiklemeli diyottur. Belirli bir breakover geriliminin üstüne çıkıldığında ani akım geçişine izin verir. TRIAC kapısını tetiklemek için klasik kullanım.',
    equation: { formula: 'V > V_BO → breakover; hızla düşük-direnç', label: 'Bilateral' },
    keyParameters: [
      { name: 'V_BO', value: '±28 V … ±40 V', note: 'Tetik gerilimi' },
      { name: 'ΔV', value: '5 … 10 V', note: 'Tetik sonrası voltaj düşüşü' }
    ],
    advanced: [
      'DB3 (32 V) en yaygın DIAC — RC + DIAC zinciri TRIAC dimmer\'in kalbidir.',
      'Negatif direnç bölgesi var → AC dalganın belirli açısında deterministic tetik.'
    ],
    spiceTemplate: 'X_DIAC A B DIAC_DB3',
    applications: ['TRIAC dimmer tetik', 'Faz kontrol osilatör'],
    warnings: ['Yaşlanma ile V_BO düşer — eski dimmer flickerlar.']
  },

  // ═══ ANALOG IC ═══
  opamp: {
    tagline: 'Analog IC · Yükselteç',
    whatItDoes: 'Op-Amp (Operational Amplifier, işlemsel yükselteç) iki girişi arasındaki farkı çok büyük bir kazançla (10⁵ tipik) yükselten diferansiyel yükselteçtir. Feedback ile sarıldığında toplama, çıkarma, türev, integral dahil her türlü lineer işlemi yapar.',
    equation: { formula: 'V_out = A_OL · (V+ − V−)', label: 'A_OL açık-döngü kazancı — DC\'de 10⁵, frekansla düşer' },
    chart: { type: 'bode', title: 'Açık döngü kazancı (Bode)', xLabel: 'f (Hz)', yLabel: 'Kazanç (dB)', curves: [{ label: 'LM741 A_OL', points: [[1,100],[10,100],[100,80],[1000,60],[10000,40],[100000,20],[1000000,0]] }], annotation: 'GBW = 1 MHz' },
    keyParameters: [
      { name: 'A_OL (DC)', value: '10⁴ … 10⁷', note: 'Açık-döngü DC kazancı' },
      { name: 'GBW', value: '0.5 MHz (LM741) … 1 GHz+', note: 'Gain-Bandwidth Product' },
      { name: 'Slew rate', value: '0.5 V/µs … 5000 V/µs', note: 'Büyük-sinyal hız sınırı' },
      { name: 'V_os (offset)', value: '1 µV … 10 mV', note: 'Giriş referans offset' },
      { name: 'V_supply', value: '±5 V … ±18 V', note: 'Rail-to-rail variants ayrı' },
      { name: 'I_bias', value: 'fA (CMOS) … µA (BJT)', note: 'Kaynak empedansı hesabı' }
    ],
    advanced: [
      'Kapalı-döngü band genişliği: GBW / kazanç. Non-invert +10 kazanç → 100 kHz BW (1 MHz op-amp\'te).',
      'Phase margin stabiliteyi belirler: 60° tipik hedef. Kapasitif yük → phase margin düşer → osilasyon.',
      'CMRR: common-mode reddedme oranı; fark amp uygulamalarında 100 dB+ istenir.',
      'Input bias current × kaynak empedans = DC offset hatası; düşük-akım giriş için FET-input op-amp.',
      'Rail-to-rail (RRI/RRO) düşük-gerilim tek-kaynak için; tam rail\'e ulaşmaz ama mV mesafeye yaklaşır.',
      'Compensation: iç Miller kapasitörü pole split — bazı op-ampler (LM301) dış comp pini sunar, kullanıcı ayarlar.'
    ],
    spiceTemplate: 'X1 Nin+ Nin- Vcc Vee Nout OPAMP_LM358',
    applications: ['Inverting amp', 'Non-inverting amp', 'Integrator / differentiator', 'Active filter', 'Comparator', 'Instrumentation amp', 'Precision rectifier', 'Summing amp'],
    warnings: ['Kapasitif yük (>100 pF) → phase margin erozyonu, osilasyon.', 'Input common-mode range aşılırsa latch-up veya faz tersleme.']
  },

  comparator: {
    tagline: 'Analog IC · Anahtar',
    whatItDoes: 'Komparatör (comparator) iki giriş gerilimini karşılaştırır ve HIGH veya LOW dijital seviye verir. Op-amp\'ten farkı: kararlı, hızlı anahtarlama için optimize edilmiştir — linear kullanıma uygun değildir.',
    equation: { formula: 'V_out = V_H if V+ > V−,  V_L else', label: 'Ideal — histeresissiz' },
    chart: { type: 'transfer', title: 'Transfer karakteristiği (histeresissiz)', xLabel: 'V+ − V−', yLabel: 'V_out', curves: [{ label: 'ideal', points: [[-0.5,0],[-0.001,0],[0.001,5],[0.5,5]] }] },
    keyParameters: [
      { name: 'Propagation delay', value: 'ns … µs', note: 'LM393 ≈ 1.3 µs, TLV3501 ≈ 4 ns' },
      { name: 'Input offset', value: '1 mV … 10 mV', note: 'Accuracy sınırı' },
      { name: 'Output stage', value: 'Open-drain / push-pull', note: 'OD pull-up şart' },
      { name: 'V_hyst (tasarım)', value: '10 mV … 100 mV', note: 'Schmitt için eklenir' }
    ],
    advanced: [
      'Histeresis için pozitif geribesleme ekle → tek eşik yerine iki eşik (upper/lower). Schmitt trigger bu yapıdır.',
      'Sistem gürültüsünü histeresis genliğinden küçük tut — aksi halde çıkış chattering yapar.',
      'LM393 open-drain — pull-up direnç şart; kenarlar yavaşlar ama wire-OR mümkün.'
    ],
    spiceTemplate: 'X1 Nin+ Nin- Vcc Vee Nout COMPARATOR_LM393',
    applications: ['Zero-cross dedektör', 'Threshold anahtar', 'PWM generator', 'Voltage monitor', 'Data slicer'],
    warnings: ['Giriş zıtladığında saniyelik aralıklarla chatter — histeresis ekle.', 'Analog (op-amp) gibi kullanma → osilasyon.']
  },

  timer555: {
    tagline: 'Analog IC · Zamanlayıcı',
    whatItDoes: 'NE555 (555 Timer) iki karşılaştırıcı, bir RS flip-flop ve çıkış sürücüsü içeren analog osilatör/zamanlayıcı IC\'dir. Astable (osilatör) veya monostable (gecikme) modlarında 1 µs ile saatler arası zaman üretir.',
    equation: { formula: 'f = 1.44 / ((R1 + 2·R2)·C)', label: 'Astable mod' },
    keyParameters: [
      { name: 'V_supply', value: '4.5 … 16 V', note: 'CMOS 7555: 2 V+' },
      { name: 'I_out', value: 'sink/source 200 mA', note: 'LED/relay direct sürer' },
      { name: 'Frekans', value: '<1 MHz', note: 'CMOS variantları 2 MHz+' }
    ],
    advanced: [
      'Astable duty cycle: D = (R1+R2)/(R1+2·R2); 50% için diyot trick\'i kullanılır.',
      'Monostable pulse: T = 1.1 · R · C; trigger pin (pin 2) < V_supply/3 ile tetikler.',
      'CMOS 7555 düşük akım (~100 µA) + düşük-V operation, ancak 200 mA sürme kaybı.'
    ],
    spiceTemplate: 'X1 Ntrig Nthr Nout Ndis Nctrl Nrst Vcc Gnd TIMER555',
    applications: ['PWM oluşturma', 'Flasher', 'Debounce', 'Missing-pulse detector', 'Düşük-frekans osilatör'],
    warnings: ['Power rail\'a 100 nF decoupling şart — iç latch noise\'a hassas.']
  },

  vreg: {
    tagline: 'Analog IC · Regülatör',
    whatItDoes: 'Lineer voltaj regülatörü (voltage regulator) giriş gerilimini seri-pass tranzistör ile düşürerek sabit, düşük-ripple çıkış üretir. 78xx pozitif rail, 79xx negatif rail serisi. Yüksek verim istenirse SMPS\'e geç.',
    equation: { formula: 'V_out = V_ref · (1 + R1/R2)', label: 'Ayarlanabilir tip (LM317)' },
    keyParameters: [
      { name: 'V_in/V_out', value: 'dropout ≥ 2 V (std), 100 mV (LDO)', note: 'LDO düşük dropout için' },
      { name: 'I_out', value: '100 mA … 3 A+', note: 'Thermal pad gerekli' },
      { name: 'Line regulation', value: '%0.01 … %0.1', note: '' },
      { name: 'Load regulation', value: '%0.01 … %0.5', note: '' }
    ],
    advanced: [
      'Power dissipation = (V_in − V_out) × I_out — büyükse heatsink + junction temp hesabı.',
      'LDO (Low Dropout): pass eleman PMOS → V_dropout mV\'lere düşer, ama stabiliteyle ilgili dikkat gerektirir (ESR pencere).',
      '78xx şarj pompası değil — step-down. Yükseltmek için boost converter gerekir.'
    ],
    spiceTemplate: 'X1 Nin Nout Ngnd VREG_7805',
    applications: ['Analog rail', 'MCU Vdd (düşük güç)', 'Ölçüm ref kaynağı', 'Post-regulator'],
    warnings: ['Düşük yükte LDO stabilitesi ESR penceresine bağlı.', 'Giriş kapasitörü yoksa regülasyon bozulur.']
  },

  // ═══ ÖLÇÜM ═══
  ammeter: {
    tagline: 'Ölçüm · Akım',
    whatItDoes: 'Ampermetre bir kol boyunca akan akımı ölçer. Devreye SERİ bağlanır. İdeal olarak iç direnci sıfırdır; gerçek ampermetrelerde shunt + amplifier ile mV üzerinden okunur.',
    equation: { formula: 'I = V_shunt / R_shunt', label: 'Ölçüm yöntemi' },
    keyParameters: [
      { name: 'Aralık', value: 'pA … kA', note: 'Shunt değiştirerek' },
      { name: 'Doğruluk', value: '%0.01 … %2', note: 'Kalibrasyonla' }
    ],
    advanced: [
      'Simülasyon içinde ampermetre "0 V kaynak" olarak yerleştirilir — sonra .print i(V) ile okunur.',
      'AC ampermetre RMS veya peak gösterebilir; cihaz modundan emin ol.',
      'Current probe (Hall effect) izolasyon sağlar ama DC için offset kalibrasyonu şart.'
    ],
    spiceTemplate: 'V_ammeter N+ N- DC 0 ; 0 V kaynak = akım ölçüm',
    applications: ['Devre akım ölçümü', 'Power calculation', 'Sensör okuma'],
    warnings: ['Paralel bağlanmaz — kısa devre olur.']
  },

  voltmeter: {
    tagline: 'Ölçüm · Gerilim',
    whatItDoes: 'Voltmetre iki nokta arasındaki gerilim farkını ölçer. Devreye PARALEL bağlanır. İdeal iç empedansı sonsuzdur; gerçek voltmetrelerde 10 MΩ+ giriş empedansı tipiktir.',
    equation: { formula: 'V_AB = φ_A − φ_B', label: 'Noktalar arası potansiyel farkı' },
    keyParameters: [
      { name: 'Giriş empedansı', value: '10 MΩ … TΩ', note: 'Yüksek Z = az yükleme' },
      { name: 'Aralık', value: 'µV … kV', note: 'Probe + attenuator ile' }
    ],
    advanced: [
      'Yüksek empedans kaynaktan (fotodiyot, pH probe) ölçümde electrometer amp — I_bias fA mertebesi.',
      'Differansiyel voltmetre common-mode\'u reddeder, gürültülü ortamda şart.',
      'True-RMS voltmetre her dalga formu için doğru RMS verir; average-responding yalnızca sinüste doğru.'
    ],
    spiceTemplate: '; simülasyonda V(düğüm) otomatik ölçülür',
    applications: ['Node ölçüm', 'Fark ölçümü', 'Sinyal izleme'],
    warnings: ['Düşük-empedans devreden yüksek-empedans devreye geçerken probe yükleme önemli.']
  },

  wattmeter: {
    tagline: 'Ölçüm · Güç',
    whatItDoes: 'Wattmetre gerilim ve akımı aynı anda ölçüp anlık çarpımının ortalamasını alarak gerçek gücü (watt, W) verir. AC\'de power factor (cos φ) etkilerini yakalar.',
    equation: { formula: 'P = (1/T) · ∫v(t)·i(t) dt', label: 'Gerçek güç — AC\'de PF otomatik dahil' },
    keyParameters: [
      { name: 'Aralık', value: 'mW … MW', note: 'Current clamp ile non-invaziv' },
      { name: 'Doğruluk', value: '%0.1 … %2', note: 'PF ile değişir' }
    ],
    advanced: [
      'Reaktif güç Q = V·I·sin(φ); görünür güç S = V·I. S² = P² + Q².',
      'Harmonikler wattmetrenin bandwidth\'ini aşarsa hata büyür — örnekleme tabanlı digital wattmetre tercih.',
      '3-phase ölçümde iki wattmetre metodu veya üç wattmetre doğrudan; delta/wye farkı dikkate.'
    ],
    spiceTemplate: '; .MEAS P avg v(N1)*i(V_shunt)',
    applications: ['Güç tüketimi ölçüm', 'PF düzeltme tasarımı', 'SMPS verim ölçümü', 'Motor analizi'],
    warnings: ['DC wattmetre AC\'de ortalama değil, yanıltıcı.', 'PF < 0.1 olan yüklerde doğruluk düşer.']
  },

  diffprobe: {
    tagline: 'Ölçüm · Fark',
    whatItDoes: 'Diferansiyel probu, iki nokta arasındaki gerilim farkını yer referansından bağımsız olarak ölçer. Şebeke üstündeki yüksek-kenarlı düğümü (floating node) güvenle osiloskopa bağlar.',
    equation: { formula: 'V_out = V_A − V_B', label: 'Common-mode reddedimesi yüksek' },
    keyParameters: [
      { name: 'CMRR', value: '60 dB … 100 dB', note: 'DC\'den 10 MHz\'e' },
      { name: 'Input range', value: '±10 V … ±7000 V', note: 'Galvanically isolated' }
    ],
    advanced: [
      'CMRR yüksek frekansta düşer → RF ölçümde dikkat.',
      'Kapasitif yükleme etkisi common-mode kapasitans ile modellenir; hızlı kenarlı sinyalde bozucu.'
    ],
    spiceTemplate: '; (V(N_A) − V(N_B)) plot',
    applications: ['Şebeke ölçüm', 'Floating SMPS node', 'Gate-source VGs ölçüm', 'Audio differential line'],
    warnings: ['Max giriş gerilimi aşılırsa dahili optik izolatör patlar.']
  },

  iprobe: {
    tagline: 'Ölçüm · Akım',
    whatItDoes: 'Akım probu Hall sensörü veya Rogowski coil ile kablodan geçen akımı kesintisiz ölçer. Osiloskopa voltaj çıktısı verir (genellikle 100 mV/A).',
    equation: { formula: 'V_probe = G · I_meas', label: 'G transduktans (V/A)' },
    keyParameters: [
      { name: 'Aralık', value: 'mA … kA', note: 'Probe modeline göre' },
      { name: 'Bandwidth', value: 'DC (Hall) … 100 MHz (Rogowski AC only)', note: '' },
      { name: 'Transduktans', value: '10 mV/A … 1 V/A', note: '' }
    ],
    advanced: [
      'Hall probu DC ölçer ama offset drift\'e sahip — kullanım öncesi demagnetize/degauss.',
      'Rogowski coil sadece AC; ağırlıksız ve büyük kablolara kıvrılır.',
      'Current transformer passive ama sadece AC — yüksek akımda en doğru.'
    ],
    spiceTemplate: '; .MEAS tran i_peak max i(V_load)',
    applications: ['SMPS ind akımı', 'Motor inrush', 'Arıza analizi', 'AC şebeke harmonik analizi'],
    warnings: ['Hall probe degauss edilmeden kullanılırsa DC offset yüksek.']
  },

  // ═══ LOJİK ═══
  and: {
    tagline: 'Lojik · Kapı',
    whatItDoes: 'AND (VE) kapısı: TÜM girişleri HIGH ise çıkış HIGH, aksi takdirde LOW. CMOS ailesinde 74HC08, TTL 7408 yaygın entegreler.',
    equation: { formula: 'Y = A · B', label: 'Boolean çarpım' },
    keyParameters: [
      { name: 'V_IL / V_IH', value: 'TTL: <0.8V / >2V, CMOS: <0.3Vcc / >0.7Vcc', note: 'Eşik seviyeleri' },
      { name: 'Propagation delay', value: '5 ns … 50 ns', note: 'HC tipik 10 ns' },
      { name: 'Fan-out', value: '10 (TTL), 50+ (CMOS)', note: '' }
    ],
    advanced: [
      'De Morgan: A·B = NOT(A+B) — NAND + NOT ile gerçekleştirilebilir.',
      'CMOS statik güç ≈ 0; dinamik güç C·V²·f.',
      'Birden fazla giriş için AND-of-ANDs ağacı derinliği log₂(n).'
    ],
    spiceTemplate: 'X_AND A B Y AND2_74HC08',
    applications: ['Koşul maskeleme', 'Address decoding', 'Interrupt gate', 'Enable circuit'],
    warnings: ['Floating input = bilinmez seviye → pull-up/down şart.']
  },

  or: {
    tagline: 'Lojik · Kapı',
    whatItDoes: 'OR (VEYA) kapısı: HERHANGİ bir girişi HIGH ise çıkış HIGH, hepsi LOW ise LOW. 74HC32, 7432 standart IC\'ler.',
    equation: { formula: 'Y = A + B', label: 'Boolean toplam' },
    spiceTemplate: 'X_OR A B Y OR2_74HC32',
    applications: ['Interrupt merge', 'Alarm logic', 'Enable path', 'Bit set'],
    warnings: ['Floating = bilinmez.']
  },

  not: {
    tagline: 'Lojik · Tersleyici',
    whatItDoes: 'NOT (DEĞİL) kapısı tek bir girişi tersine çevirir: HIGH→LOW, LOW→HIGH. 74HC04 (hex inverter) altı tane NOT içerir.',
    equation: { formula: 'Y = ¬A', label: 'Bitwise tersleme' },
    spiceTemplate: 'X_NOT A Y INV_74HC04',
    applications: ['Sinyal terseleme', 'Level translator', 'Schmitt inverter (74HC14)', 'Delay line (chained)'],
    warnings: ['Oscillator olarak 3 adet NOT seri bağlanırsa istenmeyen osilasyon.']
  },

  nand: {
    tagline: 'Lojik · Evrensel kapı',
    whatItDoes: 'NAND = NOT + AND. Tüm girişler HIGH ise LOW, aksi halde HIGH. Sadece NAND ile her lojik devre kurulabilir — "universal gate".',
    equation: { formula: 'Y = ¬(A · B)', label: '' },
    spiceTemplate: 'X_NAND A B Y NAND2_74HC00',
    applications: ['Evrensel tabanlı tasarım', 'RS latch', 'Oscillator (CMOS NAND)', 'Level monitor'],
    warnings: ['']
  },

  nor: {
    tagline: 'Lojik · Evrensel kapı',
    whatItDoes: 'NOR = NOT + OR. Tüm girişler LOW ise HIGH, aksi halde LOW. NAND gibi evrensel; RS flip-flop\'un NAND alternatifi NOR bazlıdır.',
    equation: { formula: 'Y = ¬(A + B)', label: '' },
    spiceTemplate: 'X_NOR A B Y NOR2_74HC02',
    applications: ['RS latch (NOR)', 'Enable-active-low', 'Idle detection'],
    warnings: ['']
  },

  xor: {
    tagline: 'Lojik · Özel VEYA',
    whatItDoes: 'XOR (Özel VEYA, Exclusive OR) girişlerden tam bir tanesi HIGH ise HIGH verir. Toplayıcı devrelerin ve parite üretecinin temelidir.',
    equation: { formula: 'Y = A ⊕ B', label: 'A·¬B + ¬A·B' },
    spiceTemplate: 'X_XOR A B Y XOR2_74HC86',
    applications: ['Toplayıcı (sum), full adder', 'Parite bit', 'Phase detector', 'Şifreleme (XOR cipher)'],
    warnings: ['']
  },

  dff: {
    tagline: 'Lojik · Bellek elemanı',
    whatItDoes: 'D Flip-Flop (D-FF) saat darbesinin yükselen kenarında (rising edge) D girişindeki değeri Q çıkışına kopyalar ve saklar. Senkron lojik ve register\'lerin atomudur.',
    equation: { formula: 'Q(n+1) = D(n) at CLK↑', label: 'Setup+hold süresi sağlanmalı' },
    keyParameters: [
      { name: 'Setup time (t_su)', value: '2 … 10 ns', note: 'Kenardan önce D kararlı' },
      { name: 'Hold time (t_h)', value: '0 … 3 ns', note: 'Kenardan sonra D kararlı' },
      { name: 'Clock-to-Q (t_pCQ)', value: '5 … 15 ns', note: 'Propagation' }
    ],
    advanced: [
      'Setup/hold ihlali metastability → birkaç ns boyunca ne 0 ne 1; sonraki stage\'de yanlış yakala.',
      'Asenkron preset/clear pinleri klock\'la senkronize edilmezse glitch riski.',
      'Registers 8+ D-FF paralel bir byte\'ı aynı saat kenarında yakalar.'
    ],
    spiceTemplate: 'X_DFF D CLK Q Qbar DFF_74HC74',
    applications: ['Register', 'Counter (T-FF = D-FF + XOR)', 'Synchronizer (double-flop)', 'Edge detector'],
    warnings: ['Setup/hold ihlali metastability — fix edilemez, kaçın.']
  },

  counter: {
    tagline: 'Lojik · Sayıcı',
    whatItDoes: 'Binary counter saat darbelerini sayar ve sonucu paralel çıkışa verir. 4-bit tipik modül 0–15, 8-bit 0–255 sayar. 74HC161 (sync), 74HC590 (reg\'lı) sık kullanılır.',
    keyParameters: [
      { name: 'Genişlik', value: '4 / 8 / 16 bit', note: 'Cascade ile büyütülür' },
      { name: 'f_max', value: '20 … 100+ MHz', note: 'HC serisi 35 MHz' }
    ],
    advanced: [
      'Ripple counter (async): basit ama cascade gecikmesi birikir — aynı-kenar ölçümlerde glitch.',
      'Synchronous counter: tüm flip-flop\'lar aynı saat; daha hızlı + glitch\'siz.',
      'Modulo-N counter için load/reset'],
    spiceTemplate: 'X_CNT CLK RST Q0 Q1 Q2 Q3 COUNTER_74HC161',
    applications: ['Frekans bölücü', 'Olay sayıcı', 'Digital clock', 'PWM kenar üretimi'],
    warnings: ['Ripple counter\'lar izlenirken kenarları çökmeler görülür.']
  },

  shiftreg: {
    tagline: 'Lojik · Kaydırıcı',
    whatItDoes: 'Shift register paralel veya seri veriyi bit-bit kaydırarak serial-to-parallel veya parallel-to-serial dönüşüm yapar. 74HC595 (SPI-yi LED sürücüye genişletmek için) klasiktir.',
    keyParameters: [
      { name: 'Genişlik', value: '8 / 16 bit', note: 'Cascade mümkün' },
      { name: 'f_clock', value: '20 MHz+', note: 'HC serisi' }
    ],
    advanced: [
      '595: SPI-compatible, latch pin ile paralel çıkış bir saat kenarında güncelllenir → glitch\'siz',
      '165: parallel-to-serial, butonlar / switch\'ler için giriş expander.',
      'Ring counter = shift register + feedback; Johnson counter shift\'in tersi ile.'
    ],
    spiceTemplate: 'X_SR DIN CLK LATCH Q0..Q7 SHIFTREG_74HC595',
    applications: ['LED matrix', 'GPIO expander', 'Seri ↔ paralel dönüşüm', 'LCD bus'],
    warnings: ['Latch pin\'i unutulursa ara çıkışlar flicker yapar.']
  },

  mux: {
    tagline: 'Mixed · Çoklayıcı',
    whatItDoes: 'Multiplexer (çoklayıcı) N seçim pini ile 2^N girişten birini çıkışa bağlar. Analog MUX (CD4051) ve dijital MUX (74HC151) türleri var.',
    equation: { formula: 'Y = IN[SEL]', label: '' },
    keyParameters: [
      { name: 'Genişlik', value: '2:1 / 4:1 / 8:1 / 16:1', note: '' },
      { name: 'R_on', value: '50 Ω (analog) … µΩ (dijital)', note: 'Analog MUX\'te' }
    ],
    advanced: [
      'Analog MUX\'ler gerçek iki yönlü — source↔drain simetrik.',
      'Glitch (break-before-make vs make-before-break) uygulamaya göre seçilir; audio\'da zero-cross switch tercih.'
    ],
    spiceTemplate: 'X_MUX A0 A1 A2 EN IN0..IN7 Y MUX_CD4051',
    applications: ['ADC çoklu kanal', 'Audio routing', 'Address decoder', 'Bus expansion'],
    warnings: ['V_in > V_supply → latch-up riski.']
  },

  // ═══ MIXED-SIGNAL ═══
  adc: {
    tagline: 'Mixed · Dönüştürücü',
    whatItDoes: 'ADC (Analog-to-Digital Converter) analog giriş gerilimini sabit dijital kod çıkışına dönüştürür. 8-bit ADC 0-255 değer, 12-bit 0-4095 değer üretir. Örnekleme frekansı (fs) sinyalin çift katının üzerinde olmalıdır (Nyquist).',
    equation: { formula: 'kod = round((V_in / V_ref) · 2ⁿ)', label: 'n bit genişliği' },
    keyParameters: [
      { name: 'Çözünürlük', value: '8 bit … 24 bit', note: 'SAR 12–16, sigma-delta 20+' },
      { name: 'f_s', value: 'kSa/s … GSa/s', note: 'Nyquist: f_s > 2·f_max' },
      { name: 'V_ref', value: 'dahili / harici', note: 'Doğruluk buradan gelir' },
      { name: 'ENOB', value: '0.5–2 bit altında nominal', note: 'Gürültü sınırlı etkin bit sayısı' }
    ],
    advanced: [
      'SAR ADC: binary search ile n saatte dönüşüm → düşük-orta fs için verimli.',
      'Pipeline ADC: her stage ~1.5 bit; yüksek-fs uygulamada baskın.',
      'Sigma-delta: oversample + decimate ile çok yüksek bit ama düşük fs — audio, sensör.',
      'Anti-aliasing LPF fs/2 üstünü kesmeli yoksa spectral fold-back hataya yol açar.'
    ],
    spiceTemplate: 'X_ADC VIN VREF CLK D0..D7 ADC8',
    applications: ['Sensör arayüz', 'Audio digitization', 'Ölçüm aleti', 'Image sensor', 'SDR receiver'],
    warnings: ['Kaynak empedansı yüksekse SAR sample-hold \'un C\'yi doldurması bozulur.']
  },

  dac: {
    tagline: 'Mixed · Dönüştürücü',
    whatItDoes: 'DAC (Digital-to-Analog Converter) sabit dijital kodu analog gerilime çevirir. Ters ADC. 8-bit DAC 256 seviye üretir. R-2R ladder veya akım-steering yapıları yaygın.',
    equation: { formula: 'V_out = (kod / 2ⁿ) · V_ref', label: '' },
    keyParameters: [
      { name: 'Çözünürlük', value: '8 bit … 24 bit', note: '' },
      { name: 'Güncellenme hızı', value: 'kSa/s … GSa/s', note: 'Direct Digital Synthesis için GSa/s' },
      { name: 'Settling time', value: 'ns … µs', note: 'Code-to-code geçiş süresi' },
      { name: 'INL / DNL', value: 'LSB mertebesi', note: 'Lineerlik' }
    ],
    advanced: [
      'R-2R ladder: yalnızca 2 direnç değeri kullanılır → matching rahat.',
      'Glitch enerji kodlar arası büyükse (MSB 0111→1000) bozucu; deglitcher sample-hold eklenir.',
      'Monotonicity DAC\'te feedback sistemlerde şart — tersi control loop kararsızlığına yol açar.'
    ],
    spiceTemplate: 'X_DAC D0..D7 VREF VOUT DAC8',
    applications: ['Audio çıkış', 'Sinyal jeneratörü', 'Motor sürücü referans', 'Video DAC'],
    warnings: ['Glitch dönüşümünü deglitch filter ile yumuşat.']
  },

  pwmGen: {
    tagline: 'Mixed · PWM',
    whatItDoes: 'PWM (Pulse Width Modulation) üreteci, duty cycle\'ı kontrol girişiyle değiştiren kare dalga üretir. Duty = ortalama güç — motor hızı, LED parlaklığı, audio class-D amp\'te kullanılır.',
    equation: { formula: 'V_avg = D · V_high', label: 'D = 0…1 duty cycle' },
    keyParameters: [
      { name: 'Frekans', value: '100 Hz … 1 MHz+', note: 'İşitilebilir üst limit 20 kHz' },
      { name: 'Çözünürlük', value: '8 … 16 bit', note: 'Duty adım sayısı' },
      { name: 'Dead time', value: '10 ns … µs', note: 'Bridge sürücüde shoot-through önlemi' }
    ],
    advanced: [
      'Class-D amp: PWM modüle edilen ses sinyali + LC filtre = verimli ses yükselteci (>%90).',
      'Motor sürme: carrier 20 kHz üstü seçilirse işitilmez — mekanik aşırı titreşim kalmaz.',
      'Edge-aligned vs center-aligned PWM: şebeke inverter\'da harmonik içerik farklı.'
    ],
    spiceTemplate: 'X_PWM CTRL CARRIER OUT PWM_GEN',
    applications: ['Motor hız kontrolü', 'LED dimming', 'Class-D audio', 'DC-DC konvertör', 'Isıtıcı kontrolü'],
    warnings: ['Endüktif yükte flyback diyodu şart.', 'Carrier audio bant içindeyse akustik gürültü.']
  },

  // ═══ KONTROL / ELEKTROMEKANİK ═══
  transformer: {
    tagline: 'Elektromekanik · Manyetik',
    whatItDoes: 'Trafo (transformer) manyetik çekirdek etrafındaki iki veya daha fazla sarımla AC gerilimi ölçeklendirir veya galvanic izolasyon sağlar. Sarım oranı gerilim oranını belirler.',
    equation: { formula: 'V₁/V₂ = N₁/N₂,  I₁/I₂ = N₂/N₁', label: 'İdeal, kayıpsız' },
    keyParameters: [
      { name: 'Güç', value: '1 VA … MVA', note: '' },
      { name: 'Frekans', value: '50/60 Hz (core) … MHz (ferrit)', note: 'Çekirdek tipi frekansa bağlı' },
      { name: 'Verim', value: '%85 … %99', note: 'Copper + core losses' },
      { name: 'Regulation', value: '%2 … %10', note: 'Yüklü V düşüşü' }
    ],
    advanced: [
      'Inrush akımı nominal 5–10 katına çıkabilir — sigorta "slow blow" seçimi kritik.',
      'Isolation transformer = 1:1 oran; medikal ekipmanda güvenlik için şart.',
      'DC trafodan geçemez — core doyar. Flyback SMPS istisna: depolanıp transfer edilir.',
      'Auto-transformer ortak sarımlı; ucuz ama izolasyon yok.'
    ],
    spiceTemplate: 'L1 P1 P2 10m\nL2 S1 S2 2.5m\nK L1 L2 0.98',
    applications: ['Şebeke stepdown', 'İzolasyon', 'SMPS çekirdek', 'Audio çıkış (tube)', 'Push-pull drive'],
    warnings: ['DC geçirtmek çekirdeği doyurur.', 'Primerden dokunma → 220V.']
  },

  relay: {
    tagline: 'Elektromekanik · Anahtar',
    whatItDoes: 'Röle (relay) düşük güçlü bir bobin ile yüksek güçlü kontakları mekanik olarak açıp kapayan elektromekanik anahtardır. Düşük voltaj mikrokontrolcüyle 220V şebekeyi kontrol etmenin en kolay yolu.',
    equation: { formula: 'I_bobin × N = F_mekanik', label: 'Kapanma eşik kuvveti' },
    keyParameters: [
      { name: 'Bobin V', value: '5 V, 12 V, 24 V', note: 'DC veya AC' },
      { name: 'Kontakt akım', value: '1 A … 30 A', note: 'NO/NC/COM' },
      { name: 'Kontakt V', value: '250 V AC … 125 V DC', note: 'Arc quenching\'e bağlı' },
      { name: 'Ömür', value: '100k … 10M döngü', note: 'Yüke bağlı' }
    ],
    advanced: [
      'Flyback diyodu (1N4007, bobin ile antiparalel) şart; MCU GPIO\'yu açılmadığında indüktif gerilimden korur.',
      'SPDT/DPDT: kontakt konfigürasyonu. AC\'de switching noise için sıfır-geçişli SSR daha iyi.',
      'Latching relay iki bobin ile durumu koruyor → sürekli güç çekmiyor.'
    ],
    spiceTemplate: 'S1 Ncoil+ Ncoil- NC1 NC2 MY_RELAY',
    applications: ['Şebeke yük kontrolü', 'Motor yön değiştirme', 'Telefon devresi', 'Alarm kontakt', 'Otomotiv'],
    warnings: ['Flyback diyodu olmadan MOSFET/transistör yanar.', 'Kontakt arkı ömrü kısaltır — snubber gerekli.']
  },

  fuse: {
    tagline: 'Koruma · Sigorta',
    whatItDoes: 'Sigorta (fuse) belirli bir akımın üzerine çıkıldığında içindeki tel erir ve devreyi açar. Tek kullanımlıktır; kısa devre veya aşırı yük sonrası yenisi takılır.',
    equation: { formula: 'I²t = sabit', label: 'Eritme enerjisi sabiti' },
    keyParameters: [
      { name: 'Nominal akım', value: 'mA … kA', note: 'Sürekli geçebilen' },
      { name: 'Kırma kapasitesi', value: 'A … kA', note: 'Kısa devrede güvenli açma' },
      { name: 'Hız', value: 'Fast / Slow / Very slow', note: 'Inrush için slow' }
    ],
    advanced: [
      'I²t selectivity: üst-akım sigortasının I²t değeri alt-sigortanın kırma I²t\'sinden yüksek olmalı → cascaded koruma.',
      'Arc-quenching ortam: kuartz kum dolgulu sigorta yüksek kısa devre akımını soğurur.',
      'PTC resettable sigorta alternatif — ama trip gerilim sınırlı.'
    ],
    spiceTemplate: 'F_fuse N1 N2 FUSE_1A',
    applications: ['Şebeke koruma', 'Batarya paketi', 'SMPS giriş', 'Otomotiv DIN', 'PCB SMT fuse'],
    warnings: ['Nominalin üstü değer koyma — yangın riski.', 'AC/DC sigorta tiplerini karıştırma — DC arc söndürmesi zor.']
  },

  dcmotor: {
    tagline: 'Elektromekanik · Hareket',
    whatItDoes: 'DC motor armatür (rotor) sarımından geçen akımla manyetik alan arasında Lorentz kuvveti yaratarak döner. Gerilim hızı, akım (yük) torku belirler. Brushed vs brushless (BLDC) olmak üzere iki ana tür.',
    equation: { formula: 'V = k_e · ω + I · R_a,  T = k_t · I', label: 'Ters-EMF + armatür direnci' },
    keyParameters: [
      { name: 'Nominal V', value: '1.5 V … 600 V', note: '' },
      { name: 'No-load hız', value: 'rpm', note: 'Yüksüz maksimum' },
      { name: 'Stall torku', value: 'mNm … Nm', note: 'Durdurulduğunda' },
      { name: 'Verim', value: '%50 … %95', note: 'BLDC daha yüksek' }
    ],
    advanced: [
      'PWM ile hız kontrolü yaygın; carrier işitilebilir üstünde (>20 kHz) seçilir.',
      'Back-EMF (ters-EMF) sensörsüz BLDC\'de rotor pozisyonu için kullanılır.',
      'H-bridge yön değiştirir; shoot-through\'a karşı dead time şart.',
      'Kurşun-asit starter motor inrush 10× nominal — kabloyu boyutlandır.'
    ],
    spiceTemplate: 'L_a N1 Ne 1m\nR_a N1 Ne 1\nV_backemf Ne 0 PULSE(...)',
    applications: ['Fan', 'Pompa', 'Robot', 'Araç tahrik', 'Servo motor (kapalı döngü)'],
    warnings: ['Flyback diyodu / snubber şart.', 'Stall uzun sürerse bobin yanar.']
  },

  switch: {
    tagline: 'Elektromekanik · Manuel',
    whatItDoes: 'Anahtar (switch) mekanik olarak kontak açar/kapar. SPST (tek kutup tek konum), SPDT (tek kutup iki konum), DPDT vb. konfigürasyonlar. El hareketiyle kilitlenen (toggle) veya yaylı geri dönen tiplerde gelir.',
    keyParameters: [
      { name: 'Akım', value: 'mA … 30 A', note: '' },
      { name: 'Gerilim', value: '5 V … 600 V', note: '' },
      { name: 'Ömür', value: '10k … 1M çevrim', note: 'Mekanik' }
    ],
    advanced: [
      'Contact bounce 1–10 ms sürer — MCU girişinde debouncing (SW veya HW) şart.',
      'Wet vs dry contact: düşük akımda oksit tabaka iletimi bozar → "wetting current" gerekebilir.'
    ],
    spiceTemplate: 'S1 N1 N2 NSCTL 0 SWMOD',
    applications: ['Power on/off', 'Mode select', 'Security interlock', 'Limit switch'],
    warnings: ['Contact bounce debounce gerektirir.']
  },

  pushButton: {
    tagline: 'Elektromekanik · Anlık',
    whatItDoes: 'Buton (push button) basılınca kontak kapanan, bırakılınca yaylı olarak açılan anlık anahtardır. MCU girişlerinde kullanıcı etkileşimi için en yaygın eleman.',
    keyParameters: [
      { name: 'Akım', value: 'mA … A', note: '' },
      { name: 'Ömür', value: '100k … 10M basım', note: '' },
      { name: 'Bounce', value: '1 … 20 ms', note: 'Debounce hedefi' }
    ],
    advanced: [
      'NO (normally open) ve NC (normally closed) varyantları — güvenlik butonlarında NC tercih.',
      'Tactile vs keypad dome: farklı kliklik hissi + farklı ömür.'
    ],
    spiceTemplate: 'S1 N1 N2 NSCTL 0 SWMOD ; momentary',
    applications: ['Kullanıcı arayüzü', 'Reset', 'E-stop', 'Keypad matris'],
    warnings: ['Debounce yapılmazsa single basım multi-detect.']
  },

  speaker: {
    tagline: 'Elektromekanik · Ses',
    whatItDoes: 'Hoparlör (speaker) bobin + manyetik çekirdek yapısıyla audio akımı mekanik harekete çevirir, diaframla havayı iter ve ses oluşturur. Nominal empedansı 4 Ω, 8 Ω, 32 Ω olur.',
    equation: { formula: 'P_akustik = F · v ≈ (B·L·I)²·R_rad / ...', label: 'Elektromekanik dönüşüm' },
    keyParameters: [
      { name: 'Empedans', value: '2 Ω / 4 Ω / 8 Ω / 16 Ω / 32 Ω', note: 'Frekansla değişir' },
      { name: 'Güç', value: '0.1 W … 1 kW', note: 'RMS ve peak ayrı' },
      { name: 'Frekans aralığı', value: '20 Hz … 20 kHz', note: 'Driver tipine bağlı' }
    ],
    advanced: [
      'Resonant frekans (f_s) driver\'ın çözülmesi gereken fiziksel özelliği; crossover bu frekanstan uzağa yerleştirilir.',
      'Impedans sabit değildir — nominal 8Ω hoparlör 100 Hz\'de 30Ω\'a çıkabilir.',
      'Sensitivity (dB SPL @ 1W/1m) verim ölçüsü — amplifier güç bütçesi için kritik.'
    ],
    spiceTemplate: 'R_spk N1 N2 8',
    applications: ['Audio çıkış', 'Alarm', 'Intercom', 'Musical instrument'],
    warnings: ['DC uygulama → bobin yanar.', 'Peak güç geçici, RMS sürekli.']
  },

  buzzer: {
    tagline: 'Elektromekanik · Ses',
    whatItDoes: 'Buzzer alçak-frekanslı, tiz "bip" sesi üretir. Piezo (kristal) veya elektromagnetik tipleri var. Aktif buzzer dahili osilatörlü (DC verirsin, ses çıkar); pasif buzzer dışarıdan frekans sürmeyi bekler.',
    keyParameters: [
      { name: 'Rezonans frekansı', value: '1 … 5 kHz', note: 'Piezo\'larda en verimli' },
      { name: 'Ses basıncı', value: '60 … 110 dB SPL @ 10 cm', note: '' },
      { name: 'Çalışma V', value: '1.5 … 24 V', note: '' }
    ],
    advanced: [
      'Piezo buzzer kapasitif yük — MOSFET ile PWM sür; direkt GPIO sürmek mümkün ama ses kısık.',
      'Active buzzer built-in oscillator → sadece ON/OFF; passive buzzer istediğin frekansı basabilirsin.'
    ],
    spiceTemplate: 'R_bz N1 N2 40 ; piezo ≈ C//R',
    applications: ['Alarm', 'UI feedback', 'Timer bitiş', 'Arıza uyarısı'],
    warnings: ['Piezo DC\'de ses vermez — AC veya PWM şart.']
  },

  // ═══ TEMEL / ETİKET ═══
  ground: {
    tagline: 'Temel · Referans',
    whatItDoes: 'Ground (toprak) devredeki 0 V referans noktasıdır. Tüm gerilimler bu düğüme göre ölçülür. Simülasyonda zorunlu — yoksa solver referans bulamaz.',
    applications: ['Referans düğümü', 'Akım dönüş yolu', 'Shielding', 'Güvenlik toprağı'],
    warnings: ['Her devrede en az bir ground olmalı — SPICE yoksa matrisi tekil.']
  },

  vccLabel: {
    tagline: 'Temel · Rail',
    whatItDoes: 'VCC etiketi pozitif besleme rayını (tipik +5 V veya +3.3 V) temsil eder. Tellerin karmaşasını azaltmak için bağlantı yerine isim kullanılır.',
    applications: ['Positive rail bağlantı', 'Multi-sheet projeler', 'Bus bar gösterimi'],
    warnings: ['Tüm VCC sembolleri aynı rail\'e bağlıdır — farklı voltaj istiyorsan yeniden adlandır.']
  },

  gndLabel: {
    tagline: 'Temel · Rail',
    whatItDoes: 'GND etiketi yer referansının etiket formudur. Ground sembolü ile özdeş davranır — çizim temizliği için.',
    applications: ['Return path', 'Multi-sheet ground', 'Analog/digital ground split'],
    warnings: ['Analog GND ile digital GND farklı sinyal yolları olabilir — yalnızca tek noktada birleşir (star grounding).']
  },

  netLabel: {
    tagline: 'Temel · Tel',
    whatItDoes: 'Net etiketi isim verilen sanal bir tele karşılık gelir. Aynı isme sahip tüm etiketler bağlıdır — tel çizmeden bağlantı yapmanın yolu.',
    applications: ['Hiyerarşik tasarım', 'Bus isimlendirme (D0..D7)', 'Çok-sayfa bağlantı'],
    warnings: ['Aynı ismin yanlışlıkla iki farklı yerde kullanılması short devre yaratır — dikkat.']
  },

  subcircuit: {
    tagline: 'Yapısal · Alt devre',
    whatItDoes: 'Subcircuit (.SUBCKT) tekrar kullanılabilir bir alt modülü tanımlar. Tek bir sembolle çağrılır, içeriği ayrı dosyada saklanır. Hiyerarşik tasarımın yapı taşı.',
    advanced: [
      '.SUBCKT isim port1 port2 ... tanım satırı; .ENDS ile biter.',
      'Parametrik: .SUBCKT INV {WIDTH=1u} → çağrılırken WIDTH=2u ile override.',
      'Nested subcircuit mümkün ama profil derinliği 100\'ü geçmemeli (SPICE limit).'
    ],
    spiceTemplate: '.SUBCKT MYOP IN+ IN- OUT\n* ...\n.ENDS',
    applications: ['Reusable bloklar', 'IP core paylaşımı', 'Hiyerarşik test', 'Model kütüphanesi'],
    warnings: ['Port sırası tanımla çağrıda tutarlı olmalı — yoksa yanlış bağlanır.']
  }
};

// Export for non-module script tag builds; build.js concatenates files raw.
if (typeof window !== 'undefined') window.DATASHEETS = DATASHEETS;
