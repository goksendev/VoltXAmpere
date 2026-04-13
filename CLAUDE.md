# VoltXAmpere — CLAUDE.md

> Yeni Zenco, bu dosyayı oku. Projenin her detayı burada.
> Bu proje tek oturumda, sıfırdan v5.0'a geldi. Sen devam ettireceksin.

## Proje Kimliği

- **Ad:** VoltXAmpere
- **Domain:** voltxampere.com (Vercel deploy, GitHub: goksendev/VoltXAmpere)
- **Tagline:** "Devrenizi Hissedin" / "Feel Your Circuit"
- **Nedir:** Ücretsiz, kayıtsız, tek sayfalık, tarayıcı tabanlı profesyonel elektrik-elektronik devre simülatörü
- **Versiyon:** v5.0
- **Lisans:** MIT

## Dosya Yapısı

```
~/Desktop/VoltXAmpere/
├── index.html          ← TEK DOSYA: 5208 satır, tüm CSS + HTML + JS inline
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker (cache-first)
├── vercel.json         ← Security headers + cache config
├── robots.txt          ← SEO
├── sitemap.xml         ← SEO
├── LICENSE             ← MIT
├── test-browser.js     ← Puppeteer otomatik test (35 preset)
├── package.json        ← Puppeteer dependency
├── CLAUDE.md           ← BU DOSYA
│
└── voltix-engine/      ← Phase 1 motor (TypeScript, ayrı proje)
    ├── src/
    │   ├── core/       ← MNA solver, LU, Newton-Raphson, complex solver
    │   ├── analysis/   ← Transient (BE/TRAP), AC frequency sweep
    │   ├── components/ ← R, C, L, Diode, VSource, ISource, ACSource
    │   ├── models/     ← SIN, PULSE, PWL source functions
    │   ├── netlist/    ← Circuit serialization (JSON-safe)
    │   ├── worker/     ← Web Worker protocol, SimulationController
    │   └── utils/      ← Complex arithmetic, units, constants
    ├── tests/          ← 140 test (vitest)
    ├── bench/          ← 30 benchmark + performance tests
    ├── package.json
    ├── tsconfig.json
    └── vitest.config.ts
```

## Mimari Kararlar

### Neden Tek HTML Dosyası?
- Sıfır bağımlılık (Google Fonts hariç)
- Offline çalışır (PWA + SW)
- CDN gereksiz, embed edilebilir
- `<300KB` hedefi (şu an ~160KB)

### Neden Vanilla JS + Canvas 2D?
- Framework overhead yok
- 200+ eleman 60fps
- Direkt piksel kontrolü
- React/Svelte overkill, SVG yavaş, WebGL gereksiz karmaşıklık

### Motor Mimarisi
- **Phase 1 engine** (`voltix-engine/`): TypeScript, 140 test, akademik doğruluk
- **Inline engine** (`index.html` içinde): Basitleştirilmiş MNA solver, real-time UI için optimize
- İki motor AYRI — inline motor Phase 1'in port'u ama tam kopya değil

## Convention'lar

### Renk Paleti (CSS Variables)
```css
--bg: #06080c          /* Ana arka plan */
--surface: #0b0f15     /* Panel arka plan */
--surface-2: #10151e   /* Kart arka plan */
--surface-3: #172030   /* Hover/aktif */
--border: #1a2538      /* Kenarlık */
--accent: #00e09e      /* Ana aksiyon — yeşil/teal (Volt) */
--blue: #3b82f6        /* Akım, ikincil (Ampere) */
--orange: #f59e0b      /* Güç, uyarı (Watt/X) */
--purple: #a855f7      /* Bobbin, yarıiletken */
--red: #f0454a         /* Hata, diyot */
--yellow: #eab308      /* LED, akım kaynağı */
--cyan: #06b6d4        /* AC kaynak */
--pink: #ec4899        /* Zener, darbe */
--green: #22c55e       /* Başarı, onay */
--text: #e0e7f0        /* Ana metin */
--text-2: #8899aa      /* İkincil metin */
--text-3: #5a6a7a      /* Üçüncül metin */
```

### Tipografi
```
UI:     'Outfit', sans-serif
Kod:    'JetBrains Mono', monospace
```

### Bileşen Tanım Yapısı (COMP objesi)
```javascript
var COMP = {
  resistor: {
    name: 'Direnç',        // Türkçe isim (i18n ile değişir)
    en: 'Resistor',         // İngilizce kısaltma
    color: '#00e09e',       // Sembol rengi
    unit: 'Ω',             // Değer birimi
    def: 1000,              // Varsayılan değer
    key: '1',               // Klavye kısayolu (null = yok)
    cat: 'Passive',         // Kategori (palette gruplama)
    pins: [{dx:-40,dy:0}, {dx:40,dy:0}],  // Pin offset'leri
    draw: function(c) { ... }  // Canvas 2D çizim fonksiyonu
  },
  // ...
};
```

### State Objesi (S)
```javascript
var S = {
  parts: [],              // Tüm bileşenler
  wires: [],              // Tüm kablolar
  nextId: 1,              // Sonraki bileşen ID
  view: { ox, oy, zoom }, // Pan/zoom
  mode: 'select',         // 'select' | 'place' | 'wire'
  sel: [],                // Seçili bileşen ID'leri
  sim: { running, t, dt, speed, error },
  scope: { ch:[4 kanal], ptr, tDiv, trigger, mode, persist, math, cursors },
  undoStack: [], redoStack: [],
  netNames: {},           // Wire indeks → isim
  annotations: [],        // Metin notları
  groups: [],             // Bileşen grupları
  subcircuits: {},        // Kaydedilen bloklar
  reducedMotion: false,   // prefers-reduced-motion
};
```

### i18n Sistemi
```javascript
var STR = { tr: { undo:'Geri Al', ... }, en: { undo:'Undo', ... } };
var currentLang = localStorage.getItem('vxa_lang') || (navigator.language.startsWith('tr') ? 'tr' : 'en');
function t(key) { return STR[currentLang][key] || STR.en[key] || key; }
function setLanguage(lang) { /* Tüm UI'ı günceller, sayfa yenilemesiz */ }
```

### Değişken Tanımları
- **KURAL:** `var` kullan, `const`/`let` kullanma (TDZ hatası riski)
- İstisna: GRID, DPR, S gibi sabitler `const` ile tanımlı (çalışıyor ama gelecekte var'a çevir)

### Solver Tipleri (MNA Motor)
```
R    = Resistor (conductance stamp)
C    = Capacitor (BE companion: Geq=C/dt)
L    = Inductor (BE companion: Req=L/dt)
V    = Voltage source (extended MNA row)
I    = Current source (RHS injection)
D    = Diode (Shockley + Newton-Raphson)
BJT  = NPN/PNP (Ebers-Moll, 2 junction + VCCS)
MOS  = MOSFET (Shichman-Hodges Level 1)
OA   = Op-Amp (VCCS approximation)
Z    = Zener (forward + reverse breakdown)
VREG = Voltage regulator (clamped output)
GATE = Logic gate (threshold: >2.5V = HIGH)
XFMR = Transformer (coupled conductance)
JFET = JFET (Shockley model)
SCR  = Thyristor (latching switch)
TRIAC = Bidirectional SCR
DIAC = Breakover voltage switch
DIGI = Digital (DFF, counter, shift reg, mux)
COMP = Comparator (digital output)
VCVS, VCCS, CCVS, CCCS = Dependent sources
```

## Tamamlanan Fazlar

### Phase 1: Simülasyon Motoru ✅
- MNA matris builder (stamp sistemi)
- LU solver (partial pivoting)
- Newton-Raphson (voltage limiting, GMIN)
- Transient (BE + TRAP)
- AC (kompleks MNA, frekans sweep)
- Web Worker + SimulationController API
- 140 test, 30 benchmark devre
- Performans: DC <1ms, Transient 1K <50ms

### Phase 2: Schematic Editor ✅
- Canvas 2D render (HiDPI, grid, zoom/pan)
- 9 bileşen sembolü + pin sistemi
- Catenary kablo (quadratic bezier sarkma)
- Snap glow (pulsing yeşil halka)
- Enerji partikülleri (akım yönü/büyüklüğü)
- Etkileşim: place, select, drag, wire, delete, rotate, undo/redo, box select, copy/paste
- Context menü, inspector, ölçüm kartları
- 4 kanallı osiloskop (glow efekt)
- 8 hazır devre preset
- Export: JSON, PNG, SPICE, URL sharing
- PWA, tutorial, splash screen

### Phase 3: Komponent Genişleme ✅
- BJT (NPN/PNP, Ebers-Moll)
- MOSFET (NMOS/PMOS, Level 1)
- Op-Amp (ideal VCVS)
- Zener, VReg (7805), Logic gates (6 tip)
- Transformer, Relay, Fuse
- SPICE .model parser + import
- 40+ gerçek part number

### Phase 3.5: Tam Donanım ✅
- Pulse, PWL, AC Current, Noise kaynakları
- VCVS/VCCS/CCVS/CCCS bağımlı kaynaklar
- Schottky, JFET, IGBT, SCR, TRIAC, DIAC
- D Flip-Flop, Counter, Shift Register, MUX
- Ammeter, Voltmeter, Wattmeter, Probes
- Potansiyometre, NTC/PTC, LDR, Varistor
- Comparator, Crystal, Coupled L, DC Motor, T-Line
- 10 analiz tab: Scope, Bode, DC Sweep, Param Sweep, FFT, Monte Carlo, Temperature, Noise, Sensitivity, Worst-Case
- Osiloskop Pro: cursor, math, X-Y Lissajous, persistence, roll

### Phase 4: Tasarım Araçları ✅
- Net isimlendirme (çift tıkla wire)
- Minimap (sağ alt, click-to-pan)
- BOM (modal tablo + CSV export)
- Annotations (T tuşu)
- Subcircuit (blok kaydet, palette'e ekle)
- Grouping (Ctrl+G, birlikte sürükle)
- Timeline (step, bookmark, restore)
- Junction detection (3+ wire merge)
- Circuit report (HTML, yeni sekmede)

### Phase 5: Platform & Topluluk ✅
- i18n (TR/EN, 100+ string, anında geçiş)
- Share modal (URL, QR, embed, sosyal)
- Gallery (35 devre, filtre, arama, zorluk)
- Embed modu (?embed=1)
- Viewport culling, adaptive substeps
- Erişilebilirlik (aria, font size, kontrast, motion)
- OG tags (İngilizce, global audience)

### Phase 6: Pro & İleri Düzey ✅
- AI Asistan (Anthropic Claude API, chat panel)
- Scripting API (window.VXA, 12 metod)
- Circuit description (pattern matching)

## Bilinen Sorunlar / Dikkat Edilecekler

### Aktif Buglar
1. **RLC Rezonans maxV=56K** — Düzeldi (116T → 56K) ama hala yüksek. L companion model'de küçük dt/L oranı kararsızlık yaratıyor. Daha büyük R veya adaptive dt ile çözülür.
2. **Console'da 2 hata** — `file://` protokolünde manifest.json ve SW yüklenemiyor. Sadece lokal test sorunu, Vercel'de çalışır.

### Tasarım Borçları
1. **const GRID, DPR, S** — `var` olmalı (TDZ güvenliği). Şu an çalışıyor ama refactor edilmeli.
2. **Inline motor vs Phase 1 motor** — İki ayrı MNA implementasyonu var. İdeal: Phase 1 motoru WASM olarak compile edip inline'ın yerine kullanmak.
3. **Preset wire koordinatları** — Elle ayarlanmış, bazıları pin'lere tam snap etmiyor olabilir. Her yeni preset eklerken Puppeteer testinden geçir.
4. **Bode Plot faz ölçümü** — Zero-crossing bazlı, düşük frekanslarda inaccurate olabilir. İdeal: kompleks MNA (Phase 1 AC analiz) doğrudan kullanılmalı.

### Performans Notları
- 50+ bileşen → viewport culling aktif
- Nonlineer bileşen varsa → +5 substep (adaptive)
- Scope ring buffer: 600 sample
- Undo stack: max 50

### Test Altyapısı
- `voltix-engine/`: `npx vitest run` → 140 test
- `test-browser.js`: `node test-browser.js` → Puppeteer, 35 preset testi
- Her commit öncesi: syntax check + engine test + browser test

## Git Geçmişi

```
21 commit | main branch | Vercel auto-deploy
Key commits:
- Phase 1: MNA + NR + Transient + AC (140 test)
- Phase 2: Canvas UI + interaction + scope
- Phase 3: BJT + MOSFET + OpAmp + 27 bileşen
- Phase 3.5: 61 bileşen + 10 analiz
- Phase 4: Subcircuit + BOM + groups + report
- Phase 5: i18n + gallery + share + accessibility
- Phase 6: AI + scripting API
- Final: 35/35 preset Puppeteer PASS
```

## Sayılarla VoltXAmpere v5.0

```
Satır:       5208 (tek HTML)
Bileşen:     61 (59 gerçek + 2 i18n false positive)
Analiz:      10 tab
Preset:      35
Osiloskop:   Pro (cursor, math, X-Y, persistence, roll)
Export:      7 format (JSON, PNG, SVG, CSV, SPICE, URL, BOM CSV)
Import:      3 (JSON, SPICE .model, URL hash)
Dil:         2 (TR/EN)
Motor test:  140
Browser test: 35/35 PASS
Fonksiyon:   142
Klavye kısayolu: 19
```

## Şef'e Not (Göksen)

Bu proje tek oturumda sıfırdan inşa edildi. Zencolar Köyü'nün tüm gücüyle. Yeni Zenco bu dosyayı okuyunca projenin DNA'sını bilecek. Eksik hiçbir şey kalmasın diye her detayı yazdım.

Efsane tamamlandı. O7, Şefim.

— Zenco Baba, 13 Nisan 2026
