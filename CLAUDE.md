# VoltXAmpere — CLAUDE.md

> Yeni Zenco, bu dosyayı oku. Projenin her detayı burada.

## Protocol Rules (added Sprint 102.5, 2026-04-19)

These rules are non-negotiable across every sprint. They exist because
Sprint 98 showed us how test harnesses can lie by racing themselves,
Sprint 101 showed us how tests can lie by existing only on paths that
don't reach the user, and Sprint 102 showed us that a probe waiting on
a preset loop can leave behind autonomous scheduled tasks that trigger
later without the operator's knowledge. Each rule is a one-line guard
against a specific failure mode we have already seen.

### 1. No autonomous wakeups, no scheduled tasks, no persistent loops

Zenco must not schedule, register, or arm any form of autonomous
continuation. This includes, but is not limited to:

- `ScheduleWakeup` / scheduled task registrations
- Background cron-like loops waiting for an external trigger
- `setInterval` / `setTimeout` processes that survive past the sprint
- Detached shell processes (`nohup`, `disown`, `&`) that keep running
  after Zenco's active work is done
- Auto-retry mechanisms that re-run a failed sprint without operator
  review

If a task genuinely requires waiting (e.g., a 55-preset probe loop),
use inline `Promise` with a hard timeout (`Promise.race`), and clean
up all handles before the sprint ends. When the sprint finishes,
`ps | grep` the machine for any residual processes Zenco spawned and
kill them before reporting.

The operator (Göksen) must explicitly request a wakeup for one to
exist. If a sprint prompt does not say "schedule a follow-up after X",
no follow-up is scheduled.

### 2. No silent scope expansion

If a finding emerges mid-sprint that is outside the sprint's stated
scope, Zenco documents it in the final report as a new finding with
severity tag, but does NOT fix it in the current sprint. Fixing a
"small" out-of-scope bug under the cover of a larger sprint is how
untested code reaches users.

Example from Sprint 102: the `findDCOperatingPoint` hang on `npn-sw`
and `cmos-inv` was discovered during probe development. Correct
response: document as a new HIGH finding, note the workaround (use
`solve()` loop instead), report it, and let the operator scope a
follow-up sprint. Incorrect response: quietly "fix" it by changing
the simulator's DC OP algorithm.

### 3. No sahte PASS under any rationalization

The failure modes we have seen:

- Sprint 37-38: Zenco saved 11 test failures and reported "0 fail"
  (`Gate mechanism` was added to prevent this)
- Sprint 101: `npm run scenarios` reported 14/14 PASS but never
  exercised `loadPreset()` — so "PASS" meant nothing for 23 presets
- Sprint 102: round-trip diff = 0 looked like PASS but both paths
  shared the same bug; only anchors caught it

When a test reports PASS, Zenco asks: **what specifically was tested,
and could this PASS be consistent with the bug still existing?** If the
answer is "yes, the test would pass either way," the test is not
sufficient — flag it as inadequate coverage, don't celebrate the green
check.

### 4. User-visible bugs take priority over engineering debt

If a bug reaches a user (preset returns wrong voltage, button click
hangs the browser, feature silently produces garbage), that bug is
always more urgent than internal refactoring, ES Modules migration,
or "cleaner architecture." The priority order is:

1. Data loss / silent wrong answer for users (CRITICAL)
2. User-facing crash or hang (HIGH)
3. Missing CI coverage for a user-reachable path (HIGH)
4. Internal code health (MEDIUM / LOW)

Sprint 103+ scheduling follows this order unless the operator
explicitly overrides it.

### 5. Every sprint ends with three gates (post-Sprint-104 Great Reset)

Before commit, every sprint must show:

1. `npm test` green (harness, currently 11/11)
2. `npm run scenarios` green (currently 13 probes)
3. `npm run test:sparse` green (currently 25/25)

If any gate is red, the sprint is not done. Don't commit. Don't push.
Don't tag. Report the failure and stop.

Sprint 104 removed the preset-based fences (`test:presets`,
`test:integrity`) — see CHANGELOG [12.0.0-alpha.1] "The Great Reset"
for the rationale. New feature-level tests live under
`src/test-spice/feature-tests/`; they grow back one at a time as
each component / source / model / analysis earns analytic or LTspice
verification.

### 6. Fix-baseline-regression discipline

When fixing a bug, Zenco must:

1. Capture the pre-fix baseline (`git stash` the fix, run the probe,
   save the log)
2. Apply the fix
3. Run the probe again
4. Include both numbers in the commit message and CHANGELOG

The pre-fix baseline is non-optional. Without it we can't prove the
fix fixed anything — we just have a green post-fix run. Sprint 102
caught this: round-trip diff was 0 both before and after fix, but
anchors went 7/10 → 10/10. Without baselines we couldn't have told
those apart.

### 7. When a sprint is truly done

A sprint is done when:

- All four gates green (§5)
- Commit pushed to `main` with descriptive message and baseline numbers
- Annotated tag pushed if it's a release sprint
- Vercel deploy confirmed (`https://voltxampere.com` shows new version)
- Zenco has `pkill`'ed all spawned processes (§1)
- Final report posted with sürprizler section (§2)
- No `git status` stragglers

Zenco then waits silently for the operator's next command. No auto-
continuation, no "I went ahead and started the next sprint," no
scheduled follow-ups.

---

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
