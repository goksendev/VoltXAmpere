# Sprint 1.1 — Click-to-Select + Hover (Faz 2A Açılışı)

**Amaç:** Canvas'ta ilk etkileşim. Bileşene hover → `--fg` rengi + `pointer` cursor. Tıklama → seçim. Boş alan → seçim temizleniyor. v2 artık **sadece görsel değil, etkileşimli**.

**Durum:** ✅ Tamamlandı. 5/5 davranış runtime doğrulandı, hit test 3 bileşende pinpoint, regression sıfır. Faz 2A başladı.

## Runtime Davranış Testleri (puppeteer)

Viewport 1440×900 DPR 2. Test pozisyonları:
- R1: viewport (660, 287) → canvas (564, 233) → layout (0, -80) ✓
- V1: viewport (510, 367) → canvas (414, 313) → layout (-150, 0) ✓
- C1: viewport (810, 367) → canvas (714, 313) → layout (150, 0) ✓
- Empty: viewport (660, 554) → canvas (564, 500) → layout (0, 187) — bileşen yok

| # | Senaryo | Inspector | R1 piksel | V1 piksel | Doğru? |
|---|---|---|---|---|:-:|
| 1 | **Initial** (sayfa yüklendi) | "bir bileşen seç" empty | `wire` (184,193,208) | `wire` | ✅ |
| 2 | **Hover R1** (mouse R1 üstünde) | — | **`fg` (232,234,237)** + cursor pointer | `wire` | ✅ |
| 3 | **Click R1** | R1 · direnç | **`accent` (255,184,77)** | `wire` | ✅ |
| 4 | **Click V1** (R1 zaten seçili iken) | V1 · voltaj kaynağı | `wire` (geri döndü) | **`accent`** | ✅ |
| 5 | **Click empty** | "bir bileşen seç" | `wire` | `wire` | ✅ |

**Hit test runtime** (canvas relative koordinat):

| Nokta | `hitTest(x,y)` sonucu |
|---|---|
| R1 merkez | `"R1"` ✓ |
| V1 merkez | `"V1"` ✓ |
| C1 merkez | `"C1"` ✓ |
| Empty (layout 0, 187) | — (bileşen yok, AABB miss) |

**Console:** `error/warn: []` — temiz.

## AABB Bounds Tablosu

| Tip | halfWidth | halfHeight | Gerekçe (Sprint 0.5 sembol) |
|---|---:|---:|---|
| **R** | 40 | 14 | Zigzag 80 wide (±40) + ±10 amp + label margin (±14) |
| **C** | 24 | 14 | Lead+gap+plate 48 wide (±24) + plate 24 tall (±12) + label margin |
| **V** | 35 | 18 | Lead+daire+lead 70 wide (±35) + daire 34 tall (±17) + tolerans |

**Rotation 90/270** swap: `componentAABB()` içinde `isRotated` check'i ile halfW/halfH yer değiştirir. RC_LOWPASS layout:
- R1 rotation 0 → AABB 80 × 28 (yatay direnç doğru)
- V1 rotation 270 → swap → AABB 36 × 70 (dikey pil doğru)
- C1 rotation 90 → swap → AABB 28 × 48 (dikey kapasitör doğru)

Plan'ın önerdiği V değerleri (halfWidth=18, halfHeight=35) rotation 0 için ters gibiydi; Sprint 0.5 sembol çizim sabitlerinden türetilerek halfWidth=35, halfHeight=18 olarak düzeltildi — rotation 270 swap sonrası dikey V için doğru bounding box.

## Event Akışı

```
  user mouse
       │
       ▼
  <canvas> DOM element (shadow DOM)
       │  addEventListener('mousemove'/'click'/'mouseleave')
       ▼
  onMouseMove / onClick (vxa-canvas)
       │  bubbles:true, composed:true
       ▼
  @select=${this.onCanvasSelect} (vxa-design-mode)
       │
       ▼
  this.selection = e.detail   (@state reactive)
       │
       ├─► <vxa-canvas .selectionId=...>  (amber sembol + dashed frame)
       └─► <vxa-inspector .selection=...> (R1 bilgisi veya empty)
```

Hover ayrı flow: `hoveredId` canvas'ın **kendi** `@state`'i (transient UI state, kalıcı değil). `hover-change` event de emit ediliyor ama design-mode şu an dinlemiyor — Sprint 1.x status bar vb. için hazır kanal.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Initial: hiçbir bileşen seçili değil | ✅ (Inspector empty, tüm bileşenler wire rengi) |
| 2 | Hover R1 → `--fg` + cursor pointer + hover-change event | ✅ (cursor: pointer, fg rgb doğru) |
| 3 | Hover çıkınca R1 eski rengine + cursor default | ✅ (cleared test R1 wire) |
| 4 | Click R1 → accent + dashed frame + Inspector R1 | ✅ |
| 5 | Click V1 → V1 amber, R1 geri wire (tekil seçim) | ✅ |
| 6 | Click empty → selection 'none', Inspector empty | ✅ |
| 7 | Selected > Hovered öncelik (seçiliye hover amber kalır) | ✅ CSS mantığı (isSelected check önce) |
| 8 | Toprak hover/click yok | ✅ (COMPONENT_BOUNDS'ta GND yok, hit test miss) |
| 9 | Canvas resize → hit test doğru | ✅ (getBoundingClientRect her event'te taze okunur) |
| 10 | Selection state design-mode'da, hoveredId canvas'ta | ✅ (mimari disiplin) |
| 11 | Regression yok — topbar/sidebar/dashboard/chrome | ✅ |
| 12 | Console temiz | ✅ |
| 13 | Bundle raporda | ✅ |
| 14 | `git diff src/` boş | ✅ |
| 15 | Prod deploy auto | ✅ |

## Ekran Görüntüleri

`/tmp/vxa-1.1-a-initial.png` — hiçbir bileşen seçili değil, Inspector "bir bileşen seç"
`/tmp/vxa-1.1-b-hover.png` — R1 üzerine hover, R1 fg rengi, cursor pointer
`/tmp/vxa-1.1-c-r1.png` — R1 seçili, amber + dashed frame + Inspector dolu
`/tmp/vxa-1.1-d-v1.png` — V1 seçili, R1 default geri, Inspector V1'e geçti

## Bundle Boyutu

| Dosya | Sprint 0.11 | Sprint 1.1 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 87.00 KB | 89.13 KB | +2.13 (hit-test + bounds + mouse handlers) |
| **Gzip total** | ~28.8 KB | ~29.4 KB | +0.6 KB |

Plan tahmini 89-93 KB → 89.13 aralık başı. Minimal artış — interaction logic başarıyla kompakt.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/interaction/hit-test.ts` — `componentAABB`, `pointInAABB`, `mouseToCanvasCoords` (saf fonksiyonlar, ~45 satır)
- `ui-v2/src/interaction/component-bounds.ts` — `COMPONENT_BOUNDS` tablosu, `DEFAULT_BOUNDS` fallback
- `SPRINT-1.1-REPORT.md`

**Güncellenen:**
- `ui-v2/src/canvas/canvas.ts` — `hoveredId` @state, mouse event listener'ları (`mousemove`/`mouseleave`/`click`), `hitTest()` private method, `hover-change` + `select` event emit (bubbles+composed), `disconnectedCallback`'te cleanup
- `ui-v2/src/render/circuit-renderer.ts` — `drawCircuit` imzasına `hoveredId?: string | null` eklendi, her sembol çağrısında iletilir
- `ui-v2/src/render/symbols/resistor.ts` / `capacitor.ts` / `voltage-source.ts` — her `drawX()` fonksiyonuna `isHovered = false` parametresi. Stroke rengi: `isSelected ? accent : isHovered ? fg : wire` (öncelik selected > hovered > default).
- `ui-v2/src/state/selection.ts` — `INITIAL_SELECTION` artık `{ type: 'none' }` (Sprint 0.6'daki hard-coded R1 kaldırıldı)
- `ui-v2/src/modes/design-mode.ts` — `<vxa-canvas @select=${this.onCanvasSelect}>` handler, `onCanvasSelect` arrow method selection state'i günceller

**Dokunulmayan:**
- `ui-v2/src/bridge/*`, `ui-v2/src/charts/*`, `ui-v2/src/inspector/*`, `ui-v2/src/topbar/*`, `ui-v2/src/sidebar/*`, `ui-v2/src/util/*`, `ui-v2/src/circuits/*`
- `ui-v2/src/design/tokens.css`, `ui-v2/index.html`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **Hit testing saf fonksiyonlarda.** `hit-test.ts` DOM bilmez, state tutmaz; Sprint 2+ test ortamında birim test kolay. Canvas component bunu çağırır.
2. **`componentAABB` rotation 90/270 swap.** Plan'ın önerisi doğru — sembol döndüğünde bounding box da döner. Test: V1 rotation 270 (dikey) için AABB 36×70 çıktı, mouse test tutarlı.
3. **Plan V bounds düzeltildi.** Plan halfWidth=18, halfHeight=35 "rotation 0" demişti ama V rotation 0 yatay → halfWidth=35, halfHeight=17 olmalı. Sprint 0.5 sembol sabitlerinden (RADIUS=17, LEAD=18) türetildi. Rotation 270 swap sonrası doğru dikey AABB çıktı.
4. **`hoveredId` canvas'ın kendi state'i, selection design-mode'da.** Transient UI state (fare çıkınca kaybolan) canvas içinde tutulur; kalıcı state (kullanıcının seçtiği bileşen) üst komponentte. Lit `@state` vs `@property` ayrımıyla uyumlu.
5. **`mouseToCanvasCoords` `getBoundingClientRect + clientX/Y` kullanıyor.** Plan `offsetX/Y`'ı yasakladı — shadow DOM + DPI scaling kombinasyonunda tutarsız. Test prod build DPR 2'de doğru sonuç verdi.
6. **`hover-change` event dinlenmiyor ama emit ediliyor.** Sprint 1.x status bar ("R1 hover") veya sidebar info için hazır kanal. Emit maliyeti düşük, ileriye dönük yatırım.
7. **Selected > Hovered > Default öncelik.** CSS `z-index` benzeri — isSelected true ise hover üstüne gelse bile amber kalır. Kullanıcı "hangi bileşenim seçili" hissini kaybetmez.
8. **Label rengi hover'da değişmiyor.** Plan "sadece renk değişimi (stroke)" dedi. Label (id + value) hover'da statik kalır; sadece sembol gövdesi `--fg`'ye geçer. Görsel gürültü minimum.
9. **INITIAL_SELECTION `'none'` oldu.** Sprint 0.6'da R1 hard-coded idi; Sprint 0.11'e kadar bu demo faydalıydı. Sprint 1.1'de gerçek kullanım — ilk açılışta boş.

## Bilinen Estetik Gözlemler

1. **Hover `--fg` farkı R1'de belirgin, V1/C1'de daha hafif.** Sembol stroke'u zaten ince (1.8-2.6 px). Fark göz kaçırabilir. Sprint 1.x'te `--accent-dim` tone (0.3 alpha amber) bile düşünülebilir — ama o zaman "seçili" ile karışma riski.
2. **Cursor pointer'a geçiş hafif gecikmeli (~1-2 frame).** mousemove → hitTest → state update → re-render → canvas.style.cursor. Optimize ihtiyacı yok — 60 fps'de fark edilmez.
3. **Inspector "bir bileşen seç" lowercase + italic değil**: `class="empty"` stil CSS'te `text-transform: lowercase + letter-spacing 0.12em`. Sprint 0.6'daki orijinal stil. Gerçek kullanımda biraz passive — Sprint 1.x'te "↓ devre bileşenine tıkla" gibi aktif bir çağrı yapılabilir.
4. **AABB cömert (14 px padding label için).** R1'in "R1" etiketine tıklayınca da direnç seçiliyor — beklenen ama bazı kullanıcılar "boş alan" sanabilir. Kabul edilebilir trade-off: tıklama kolaylığı > teknik kesinlik.
5. **Çoklu R1 overlap senaryosu** şu an yok (tek RC devre). Reverse iteration var (son çizilen önce), ama test yapılmadı. Sprint 1.x çoklu devrede doğrulanır.

## Bilinen Eksiklikler (Bilerek)

- **Drag YOK.** Sprint 1.2.
- **Yeni bileşen yerleştirme YOK.** Sidebar ikonları hâlâ `[TODO]`. Sprint 1.3.
- **Tel seçimi YOK.** Sprint 1.4+.
- **Toprak seçimi YOK** (bilinçli — devrenin parçası değil).
- **Silme YOK.** Sprint 1.5.
- **Multi-select YOK.**
- **Keyboard shortcut YOK.**
- **Sağ tık / context menu YOK.**
- **Çift tık YOK.**

## Sonraki Adım

Sprint 1.2 — Drag-to-move. Seçili bileşene mousedown + mousemove → pozisyon güncelle. Mouse up → layout mutation. Snap-to-grid 16 px. **Teknik kalp: tel otomatik takibi** — bileşen taşındıkça bağlı tellerin Manhattan routing'i yeniden hesaplanır.
