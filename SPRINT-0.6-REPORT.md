# Sprint 0.6 — Inspector Paneli + Seçili Bileşen Vurgusu

**Amaç:** Inspector zone artık canlı. Seçili bileşen (hard-coded R1) için ELEKTRİKSEL / KONUM / CANLI sections. Canvas'ta seçili bileşen `--accent` + dashed frame. Format fonksiyonları SI prefix + anlamlı-hane seçimiyle genişletildi.

**Durum:** ✅ Tamamlandı. Inspector dolu, canvas'ta R1 amber + seçim frame'i, dashboard + inspector + canvas probe tek solver kaynağından.

## Inspector Görsel Yapısı

```
┌──────────────────────────────┐
│ BİLEŞEN · R1                 │  ← kicker (mono, --fs-xs, --fg-3, 0.16em)
│                              │
│ R₁                           │  ← büyük isim (sans, --fs-2xl, --fg)
│ direnç                       │  ← kind (sans, --fs-sm, --fg-2, italic)
├──────────────────────────────┤
│ ELEKTRİKSEL                  │  ← section title (mono, --fs-xs, --fg-3)
│ Değer                 1 kΩ   │  ← grid 68px 1fr, label sans/value mono
│ Güç              250.00 mW   │
├──────────────────────────────┤
│ KONUM                        │
│ X, Y               0, -80    │
│ Açı                   0°     │
├──────────────────────────────┤
│ CANLI                        │
│ V düş.             5.10 nV   │
│ I                  5.10 pA   │
│ P                  0.00 fW   │
└──────────────────────────────┘
```

Puppeteer ile puppeteer.evaluate() içinde DOM tarandı, her slot metni doğrulandı. Ekran görüntüsü `/tmp/vxa-0.6.png` (1440×900 @ DPR 2) — R1 canvas'ta amber renk + dashed frame, inspector sağda dolu.

## Format Fonksiyonları (runtime test)

`util/format.ts` iki aile:

### Bileşen değerleri (trailing zero atılır)

| Input | `formatResistance` | `formatCapacitance` | `formatInductance` |
|---|---|---|---|
| 1000 | "1 kΩ" | — | — |
| 10000 | "10 kΩ" | — | — |
| 1_200_000 | "1.2 MΩ" | — | — |
| 10e-9 | — | "10 nF" | — |
| 4.7e-9 | — | "4.7 nF" | — |
| 1e-6 | — | "1 µF" | — |
| 1e-3 | — | — | "1 mH" |

### Canlı ölçümler (her zaman 2 decimal)

| Input | `formatVoltage` | `formatCurrent` | `formatPower` | `formatEnergy` |
|---|---|---|---|---|
| 5 | "5.00 V" | — | — | — |
| 0.0011 | "1.10 mV" | — | — | — |
| 5.1e-9 | "5.10 nV" | — | — | — |
| 0.001152 | — | "1.15 mA" | — | — |
| 5.1e-12 | — | "5.10 pA" | — | — |
| 0.00133 | — | — | "1.33 mW" | — |
| 2.6e-20 | — | — | "0.00 fW" | — |
| 1.25e-7 | — | — | — | "125.00 nJ" |

**SI prefix mantığı:** `a < 1e-12 → f`, `< 1e-9 → p`, `< 1e-6 → n`, `< 1e-3 → µ`, `< 1 → m`, `< 1e3 → ""`, `< 1e6 → k`, `< 1e9 → M`, else `G`. `siScale()` + `trimTrailingZeros()` + `digitsFor()` (100+ → 0, 10+ → 1, else 2) tek fonksiyon ailesinde.

## Canvas'ta Seçim Vurgusu

Circuit-renderer `selectionId?: string` param'ı aldı. Her sembol `isSelected` boolean alıp `strokeStyle` ve label renklerini `--wire` yerine `--accent`'e çevirir.

**Selection frame:** bileşenin bounding box'tan 6 px dışında, dashed `[4, 3]` pattern, 1.2 px stroke, `--accent` rengi. `BBOX_BY_TYPE` tablosu (R: 80×20, C: 48×24, V: 70×34) rotation 90/270'de swap eder.

**Piksel kanıtı** (canvas.getImageData, prod build):
- R1 zigzag merkez (world cx, cy-80): `rgb(255, 184, 77)` = `#FFB84D` = `--accent` ✓
- Selection frame kenarı (world cx-44, cy-96): `rgb(255, 184, 77)` = `--accent` ✓ (dashed frame çizgisine denk geldi)
- V1 daire kenarı: hâlâ `rgb(184, 193, 208)` = `--wire` (seçili değil) ✓
- C1 plakası: hâlâ `rgb(184, 193, 208)` = `--wire` ✓

## Dashboard ↔ Inspector Senkronu

Her iki kaynak da aynı `SolveResult` objesinden:

```
design-mode.ts (firstUpdated)
  ├─ solveCircuit(RC_LOWPASS) → result
  ├─ dashboard slot'ları: result.branchCurrents['R1'] → formatCurrent → "5.10 pA"
  └─ <vxa-inspector .solveResult=${result}>
       ↓
     liveFields(R1): I = vDrop / R → formatCurrent → "5.10 pA"
```

Dashboard ve inspector farklı matematik yapmıyor (dashboard `branchCurrents['R1']`'i solver'dan direkt alıyor; inspector R için Ohm yasasıyla `(V_in - V_out) / 1000`'i hesaplıyor). Sonuç aynı: **5.10 pA**. İki yol aynı sayısal cevaba yakınsıyor çünkü fizik tutarlı — bridge'de R için de `(v1 - v2) / value` hesabı var.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Inspector R1 bilgilerini gösteriyor | ✅ |
| 2 | Kicker + büyük isim + açıklama + 3 section yapısı | ✅ |
| 3 | R1 değer `1 kΩ` formatında | ✅ |
| 4 | CANLI V düş./I/P solver'dan; dashboard I(R1) = inspector I | ✅ (5.10 pA iki yerde) |
| 5 | Canvas R1 `--accent` + selection frame | ✅ (piksel doğrulandı) |
| 6 | Dashboard değerleri hâlâ doğru | ✅ (5.00 V / 5.00 V / 5.10 pA) |
| 7 | Console temiz | ✅ (prod; willReadFrequently test artifact) |
| 8 | Bundle raporda | ✅ (aşağıda) |
| 9 | `git diff src/` boş | ✅ |
| 10 | Inspector 216px sabit | ✅ (Sprint 0.2 grid korundu) |
| 11 | Prod deploy sonrası dolu inspector | ⏳ push sonrası |

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/state/selection.ts` — Selection tip + INITIAL_SELECTION (R1).
- `ui-v2/src/state/component-defaults.ts` — tip bazlı rating'ler (R → 0.25W, C → 50V, vb.).
- `ui-v2/src/inspector/inspector.ts` — `<vxa-inspector>` component (~270 satır).
- `SPRINT-0.6-REPORT.md`.

**Güncellenen:**
- `ui-v2/src/util/format.ts` — rewrite. `formatVolt`/`formatAmp` (Sprint 0.5) kaldırıldı, 7 yeni: `formatResistance`, `formatCapacitance`, `formatInductance`, `formatVoltage`, `formatCurrent`, `formatPower`, `formatEnergy`. Tek `siScale()` + `trimTrailingZeros()` + `digitsFor()` helper ailesi.
- `ui-v2/src/render/circuit-renderer.ts` — `selectionId` parametresi, `BBOX_BY_TYPE` tablosu, `drawSelectionFrame()`.
- `ui-v2/src/render/symbols/resistor.ts`, `capacitor.ts`, `voltage-source.ts` — `isSelected` parametresi eklendi (gövde + label rengi `--accent`'e geçer).
- `ui-v2/src/canvas/canvas.ts` — `selectionId` prop, `updated()` hook'una eklendi.
- `ui-v2/src/modes/design-mode.ts` — `selection` state, `<vxa-inspector>` mount, `.inspector-zone` ayrı class, canvas'a `.selectionId=${...}`, `formatVolt` → `formatVoltage`, dev-marker "sprint 0.6".

**Dokunulmayan:**
- `ui-v2/src/bridge/engine.ts` — Sprint 0.5 whitelist sağlam.
- `ui-v2/src/circuits/rc-lowpass.ts`, `render/symbols/wire.ts`, `ground.ts`, `probe.ts` — Sprint 0.5'teki gibi.
- `ui-v2/src/design/tokens.css` — yeni token yok.
- `ui-v2/vite.config.ts`, `ui-v2/tsconfig.json`, `ui-v2/index.html`, `ui-v2/package.json`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Bundle Boyutu

| Dosya | Sprint 0.5 | Sprint 0.6 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.69 KB | 1.69 KB | 0 |
| `index.css` | 0.89 KB | 0.89 KB | 0 |
| `index.js` | 51.44 KB | 60.24 KB | +8.80 (inspector + format expansion) |
| **Gzip total** | ~18.0 KB | ~20.0 KB | +2.0 KB |

Plan tahmini 55-65 KB — 60.24 tam ortada. Chunk uyarı eşiği 256 KB'ın çok altında.

## Bilinen Estetik Gözlemler

1. **"250.00 mW" uzun.** R1 defaults `powerRating: 0.25`. formatPower 2 decimal kuralıyla "250.00 mW" döner. Daha kompakt olabilir ama canlı ölçüm formatına uyumlu (plan "always 2 decimal" diyor). İleriki sprintte "integer değilse decimal, integer ise atla" opsiyonu düşünülebilir.
2. **"0.00 fW" psychology.** Gerçekte `2.6e-20 W`. "0.00" gören kullanıcı "solver çalışmıyor mu?" diye sorabilir. Plan "kullanıcı gerçek fiziği görsün" diyordu — yine de bir tooltip veya "≈0 (noise floor)" notu düşünülebilir. Sprint 0.7 transient analiziyle birlikte.
3. **KONUM section koordinatları canvas-relative (0, -80).** Kullanıcı açısından absolute değil. İleride görsel koordinat sistemi kararlaşınca (sol-üst 0,0 mı merkez 0,0 mı?) yeniden değerlendirilecek.
4. **Subscript "R₁" vertical-align: sub** — standart HTML sub tag yerine CSS. Font 55% boyut, bariz küçülüyor. 60-65% düşünülebilir.
5. **Inspector padding 16px** — plan `var(--sp-4)`. 216px genişlikte ferah ama field label'ları 68px dar olabilir "V düş." gibi uzunlara sınırda oturuyor.
6. **Seçim frame dashed 4/3 pattern** — EveryCircuit tarzı. Daha ince (3/2) veya daha seyrek (6/4) denenebilir; şimdilik net ve oynak değil, iyi.

## Karar Noktaları

1. **Format ayrı aile** — komponent değerleri trim-trailing-zero, canlı ölçümler 2 decimal. Tek fonksiyon + option yerine iki aile: çağrı yerinde hangi tipte olduğu net (`formatResistance(1000)` vs `formatVoltage(5)`).
2. **Selection state `@state` içinde** — Sprint 0.7'de canvas click handler bu state'i `dispatchEvent` ile güncelleyecek. Şimdilik hard-coded değer `INITIAL_SELECTION` constructor'da yüklü.
3. **`.inspector-zone` ayrı class** — `.canvas-zone` ve `.dashboard-zone` pattern'ini izledi. Base `.zone` placeholder stilleri (dashed border, center align) uygulanmıyor.
4. **Inspector display: flex + child flex: 1 1 auto** — `<vxa-inspector>` içinde overflow-y auto çalışması için dış kapsayıcının yüksek sınırı olmalı. Grid cell yüksekliği iletmesi için flex kullanıldı.
5. **`componentDefaults` `Partial<Record>` değil `Record<Type, Defaults>` + optional alanlar** — tüm tipler tanımlı, field-level optional. Tipsiz geçmez.
6. **liveFields switch yerine object map?** Şimdilik switch — 3 tip (R/C/V), her birinin hesabı farklı. Sprint 0.7+ D/BJT/MOS eklerken hesaplar çoğalınca refactor.
7. **Canvas seçim frame BBOX bilgisi renderer içinde, sembol dosyalarında değil** — sembol dosyaları "kendi çiziminden" sorumlu; renderer bileşen boyutunu ayrı tablo olarak tutar. Alternatif: her sembolden `export const SIZE = { w, h }`. Bu daha dağınık olurdu.

## Bilinen Eksiklikler (Bilerek)

- **Canvas click YOK.** Selection hard-coded. Sprint 0.7'de event handler.
- **Inspector input YOK.** Tüm alanlar readonly. Değer değiştirme Sprint 0.7+.
- **Wire selection YOK.** `selection.type === 'wire'` placeholder mesaj.
- **Multi-select YOK.**
- **Kontext menü YOK.**
- **Undo/redo YOK.**
- **L / D / Z / BJT / MOS / OA sembol ve inspector hesap YOK.** (Whitelist'te var, çizim Sprint 0.7+.)
- **Transient analiz YOK.** DC only.

## Sonraki Adım

Sprint 0.7 — Canvas click selection. Kullanıcı canvas'ta bir bileşene tıklar, `selection` state güncellenir, inspector canlı yeniden render eder. Hit-testing için her bileşenin bounding box'ı lookup edilir (circuit-renderer.ts'te zaten var). Ek bonus: ESC ile seçimi kaldırma, dashboard'a "zamanda" sekmesi (transient analiz skice).
