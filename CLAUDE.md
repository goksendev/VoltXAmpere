# VoltXAmpere — CLAUDE.md

> Yeni Zenco, bu dosyayı oku. Projenin her detayı burada.

## Proje Kimliği

- **Ad:** VoltXAmpere
- **Domain:** voltxampere.com (Vercel deploy, GitHub: goksendev/VoltXAmpere)
- **Tagline:** "Devrenizi Hissedin" / "Feel Your Circuit"
- **Nedir:** Ücretsiz, kayıtsız, tarayıcı tabanlı profesyonel devre simülatörü
- **Versiyon:** v7.1 (Sprint 16 — Modüler mimari)
- **Lisans:** MIT

## Proje Yapısı (v7.1+ Modüler)

```
~/Desktop/VoltXAmpere/
├── src/                    ← KAYNAK DOSYALAR (geliştirme burada yapılır)
│   ├── core/               ← Çekirdek (namespace, config, eventbus, state, i18n, startup)
│   │   ├── namespace.js    — VXA={}, S state, Config, EventBus
│   │   ├── i18n.js         — STR objeleri, t(), setLanguage, updateLabels
│   │   └── startup.js      — DOMContentLoaded, buildLeftPanel, loadPreset, API
│   ├── engine/             ← Simülasyon motoru
│   │   ├── sparse.js       — CSC matris, Cuthill-McKee, banded LU
│   │   ├── stamps.js       — MNA stamp fonksiyonları (12+)
│   │   ├── stamps-enhanced.js — diode_spice, bjt_gp, nmos_spice
│   │   ├── voltage-limit.js — SPICE-correct N-R sınırlama
│   │   ├── sim.js          — VXA.SimV2 (N-R döngüsü, GMIN stepping)
│   │   ├── sim-legacy.js   — Legacy MNA, buildCircuitFromCanvas, simulationStep
│   │   ├── adaptive.js     — LTE tabanlı adaptif dt
│   │   ├── ac-analysis.js  — Kompleks matris, small-signal AC
│   │   ├── noise-analysis.js — Per-source transfer, SPICE-correct gürültü
│   │   ├── sensitivity.js  — Duyarlılık analizi + Monte Carlo stats
│   │   ├── validation.js   — 10 referans devre cross-validation
│   │   └── benchmark.js    — Performans benchmark
│   ├── models/             ← SPICE modeller
│   │   ├── models.js       — VXA.Models (BJT, MOSFET, Diode, LED, Zener, OpAmp)
│   │   ├── spice-parser.js — .model parse + applyModel
│   │   ├── spice-import.js — Netlist → canvas + importSPICENetlist
│   │   └── spice-export.js — Canvas → SPICE netlist
│   ├── components/         ← Bileşen tanımları ve çizim
│   │   ├── definitions.js  — COMP (62 bileşen) + drawGateBody
│   │   ├── presets.js      — PRESETS (35 hazır devre)
│   │   ├── drawing.js      — drawPart, drawWire, drawBackground, drawGrid
│   │   └── encyclopedia.js — ENCYCLOPEDIA (30 madde)
│   ├── fx/                 ← Görsel/ses efektleri
│   │   ├── particles.js    — Kıvılcım, duman, patlama
│   │   ├── thermal.js      — C_th × dT/dt termal motor
│   │   ├── damage.js       — Enerji tabanlı hasar sistemi
│   │   └── sound.js        — 7 Web Audio ses efekti
│   ├── ui/                 ← Kullanıcı arayüzü (25 dosya)
│   │   ├── render-loop.js  — render(), minimap
│   │   ├── scope-controls.js — Osiloskop kontrolleri
│   │   ├── scope-enhanced.js — CRT, phosphor, gelişmiş drawScope
│   │   ├── scope-extras.js — Dalga önizleme, export, tooltip
│   │   ├── crt.js          — CRT modu, cursor, ölçüm
│   │   ├── inspector-basic.js + inspector-enhanced.js
│   │   ├── settings.js     — Ayarlar modalı
│   │   ├── context-menu-basic.js + context-menu-smart.js
│   │   ├── inline-edit.js  — Canvas üzerinde değer düzenleme
│   │   ├── graph.js        — VXA.Graph + analiz export
│   │   ├── gallery.js, tabs.js, statusbar.js, welcome.js, about.js
│   │   ├── bode.js, dc-sweep.js, fft.js, monte-carlo.js, param-sweep.js
│   │   ├── temp-sweep.js, noise-ui.js, sensitivity-ui.js, worst-case.js
│   │   ├── tutorials.js + tutorials-basic.js
│   │   ├── net-labels.js, a11y-pwa.js, ui-extras.js, sound-triggers.js
│   │   └── modals.js       — About, changelog, validation UI
│   ├── interaction/        ← Etkileşim
│   │   ├── mouse.js        — Mouse event handler'ları
│   │   ├── keyboard.js     — Klavye kısayolları
│   │   ├── canvas-setup.js — Canvas refs, resize, coord transforms, pin helpers
│   │   ├── history.js      — Undo/redo
│   │   ├── helpers.js      — fmtVal, nextName, mode/selection actions
│   │   ├── clipboard.js    — Copy/paste/duplicate
│   │   └── touch.js        — Touch support
│   ├── io/                 ← Giriş/çıkış
│   │   ├── export-import.js — JSON kaydet/yükle
│   │   ├── share.js        — URL paylaşım
│   │   ├── autosave.js     — VXA.AutoSave
│   │   ├── blocks.js       — Subcircuit + saveAsBlock
│   │   ├── svg-export.js, csv-export.js, pwa.js
│   │   └── export.js       — PNG export
│   ├── styles.css          — TÜM CSS (tek dosya)
│   ├── index.html          — HTML şablon (yapı, __CSS_PLACEHOLDER__, __JS_PLACEHOLDER__)
│   └── app.js              — Final init (loop, a11y, keyboard patches)
│
├── dist/
│   └── index.html          ← BUILD ÇIKTISI — deploy edilecek tek dosya
│
├── build.js                ← Build scripti (pure Node.js, concat + inline)
├── split.js                ← Tek seferlik split scripti (index.html → src/)
├── test-browser.js         ← Puppeteer test suite (409+ test)
├── package.json            ← Puppeteer dependency
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker
├── vercel.json             ← Vercel config
├── robots.txt, sitemap.xml ← SEO
├── LICENSE                 ← MIT
├── CLAUDE.md               ← BU DOSYA
└── index.html              ← ESKİ monolitik dosya (yedek, artık src/'den build edilir)
```

## Build & Test

```bash
# Build (dist/index.html oluşturur)
node build.js

# Test (Puppeteer ile tarayıcı testi)
node test-browser.js          # Orijinal index.html'i test eder
# dist/ testi için: test-dist.js (test-browser.js'in dist/ versiyonu)

# Tarayıcıda test
# dist/index.html?test=1
```

## Kurallar

### Geliştirme
- `src/` dosyalarını düzenle, `node build.js` ile build et
- **Yeni modül eklerken:** build.js'teki `JS_FILES` dizisine doğru sıraya ekle
- **Bağımlılık sırası KRİTİK** — fonksiyon çağrılmadan önce tanımlanmış olmalı
- Global fonksiyonlar scope'da kalmalı (IIFE dışında tanımla)
- `var` kullan (TDZ güvenliği), `const`/`let` sadece bilinen safe yerlerde

### VXA Namespace
- Tüm modüller `VXA.*` altında: `VXA.Sparse`, `VXA.SimV2`, `VXA.Models`, vb.
- `S` objesi global state — tüm modüllerden erişilebilir
- `VXA.State = S` geriye uyumlu referans

### Deploy
- `dist/index.html` → Vercel'e deploy et
- Tek dosya, sıfır bağımlılık (Google Fonts hariç)
- PWA + Service Worker (offline çalışır)

## Sayılarla VoltXAmpere v7.1

```
Kaynak dosya:    76 (74 JS + 1 CSS + 1 HTML)
Build çıktısı:   ~10500 satır tek HTML
Bileşen:         62
Preset:          35
Analiz tab:      10
Osiloskop:       Pro (CRT, cursor, math, X-Y, persist, roll, 4 kanal)
Test:            409+ (Puppeteer)
Validation:      10/10 referans devre
Ansiklopedi:     30 madde
i18n:            81 key (TR/EN)
Quick Start:     4 şablon
Export:          7 format (JSON, PNG, SVG, CSV, SPICE, URL, BOM)
Build süresi:    <10ms
```

## Sprint Geçmişi

- Sprint 1-10 ✅ — Canvas, thermal, damage, CRT, sound, tutorials, encyclopedia, sparse MNA, SPICE models, AC analysis, net labels, PWA/A11y
- Sprint 11 ✅ — Cuthill-McKee banded solver, SPICE voltage limiting, Trapezoidal, GMIN stepping
- Sprint 12 ✅ — Noise rewrite (per-source transfer), Op-Amp 2-pole+slew+sat, junction cap
- Sprint 13 ✅ — Cross-validation: 10/10 reference circuits PASS
- Sprint 14 ✅ — Energy damage, Preset 24 fix, RSS worst-case, SPICE import hardened
- Sprint 15 ✅ — i18n 81 keys, encyclopedia 30 entries, quick start, thermal sources
- Sprint 16 ✅ — Modüler mimari: 10471-satır tek HTML → 76 kaynak dosya + build sistemi
