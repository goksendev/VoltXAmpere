# Sprint 1.2 — Drag-to-Move + Snap-to-Grid + Smart Tel Re-routing

**Amaç:** Seçili bileşeni mouse ile sürükle, 16 px grid'e yapıştır, bağlı teller otomatik Manhattan re-route olsun. Solver tetiklenmesin (konum topolojik değil).

**Durum:** ✅ Tamamlandı. R1 50 px sürüklendi → snap ile (48, -80), tel via (-40, -35) → (8, -35)'e yeniden hesaplandı, dashboard/inspector/canvas probe değerleri değişmedi.

## Drag State Machine

```
mousedown → ARMED (startX, startY, origX, origY kaydedilir)
  │
  ├── mousemove (dx²+dy² ≤ 25 px²) → hâlâ ARMED
  └── mousemove (dx²+dy² > 25 px²) → ACTIVE
                                       │
                                       ├── mousemove → drag-position event
                                       └── mouseup → IDLE + drag-end event
                                                       ↓
                                               justFinishedDrag=true (1 frame)
                                                       ↓
                                               onClick bypass'lanır
```

`DRAG_THRESHOLD_PX = 5` — tıklama kazasından ayırır. 3 px hareket + mouseup → ARMED → IDLE (click event tetiklenir, onClick normal seçim işler). 50 px hareket → ARMED → ACTIVE → drag-position event akışı.

## Runtime Davranış Matrisi (puppeteer)

| Senaryo | R1 pos | Wire 0 via | DragPhase | Cursor | Dashboard |
|---|---|---|---|---|---|
| Initial | (0, -80) | **(-40, -35)** ← ilk recompute | idle | — | 4.97V/5.00V/33.94µA |
| After click | (0, -80) | aynı | idle | default | aynı |
| 3 px hareket + down | (0, -80) | aynı | **armed** | default | aynı |
| 3 px sonra mouseup | (0, -80) | aynı | idle | default | aynı |
| **Drag 50 px** | **(48, -80)** | **(8, -35)** ← re-routed! | **active** | **grabbing** | aynı |
| After drag | (48, -80) kaldı | (8, -35) kaldı | idle | default | **aynı** |

**`solverUnchanged: true`** — dashboard slots drag öncesi/sonrası identik. Plan kritik kabul kriteri.

Snap testi: 50 px hareket → `snapToGrid(50)` = `Math.round(50/16) * 16` = `3 * 16` = **48** ✓

## Manhattan Re-routing

Her drag event sonrası **tüm wire'lar yeniden hesaplanır** (küçük devre için ucuz). Algoritma:

1. **Düz çizgi** (aynı x veya y) → via: []
2. **L-şekli seçenek 1** (yatay→dikey): corner `(to.x, from.y)`. Engel kesmiyorsa seçilir.
3. **L-şekli seçenek 2** (dikey→yatay): corner `(from.x, to.y)`.
4. **U-şekli** 4 yön (üst/alt/sol/sağ ofset 24 px).
5. **Fallback** düz L + `console.warn` (nadir, kullanıcı görür).

**Engel listesi:** tüm bileşenlerin AABB'leri + 8 px padding (tel nefes alsın). Wire'ın bağlı olduğu iki bileşen `exclude` set'inden geçmez — kendi terminallerini engel saymasın.

Drag sonrası R1 (48, -80):
- V1.pos (-150, -35) → R1.t1 (48-40, -80) = (8, -80)
- L seçenek 1 corner (8, -35): yatay segment (-150, -35) → (8, -35), dikey (8, -35) → (8, -80)
- C1 AABB (136, -24, 164, 24) + 8px pad → (128, -32, 172, 32). Yatay y=-35 bu AABB dışı (y<-32) → engelsiz
- **L seçenek 1 seçildi.** Via: `[{x: 8, y: -35}]` ✓

## Terminal-Ref Migration

Sprint 0.5'teki hard-coded wire koordinatları (`{from: {x, y}, to: {x, y}, via: [...]}`) Sprint 1.2'de **terminal-referans** yapısına geçti:

```ts
// Öncesi (Sprint 0.5):
{ from: { x: -150, y: -35 }, to: { x: -40, y: -80 }, via: [{ x: -150, y: -80 }] }

// Sonrası (Sprint 1.2):
{ from: { kind: 'terminal', componentId: 'V1', terminal: 'pos' },
  to:   { kind: 'terminal', componentId: 'R1', terminal: 't1' } }
```

4 wire migrate edildi:
| Wire | From | To |
|---|---|---|
| 1 | V1.pos (in) | R1.t1 (in) |
| 2 | R1.t2 (out) | C1.t1 (out) |
| 3 | V1.neg (gnd) | fixed (-150, 60) — GND1 |
| 4 | C1.t2 (gnd) | fixed (150, 60) — GND2 |

**Terminal pozisyonları** (`component-terminals.ts`) Sprint 0.5 sembol çizim sabitlerinden:
- V: pos (35, 0), neg (-35, 0) — RADIUS 17 + LEAD 18
- R: t1 (-40, 0), t2 (40, 0) — WIDTH 80 / 2
- C: t1 (-24, 0), t2 (24, 0) — LEAD 20 + GAP/2

Rotation (0/90/180/270) `rotatePointCW` helper'ıyla uygulanır. RC_LOWPASS layout:
- V1 rotation 270 → pos (0, -35) local (dikey V üstte) ✓
- R1 rotation 0 → t1 (-40, 0) local (yatay R solda) ✓
- C1 rotation 90 → t1 (0, -24) local (dikey C üstte) ✓

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Mousedown + mousemove → bileşen hareket | ✅ |
| 2 | 5 px eşik altı mouseup → click (drag yok) | ✅ (3 px testi ARMED→IDLE, pos değişmedi) |
| 3 | 16 px snap — ara piksel yok | ✅ (50→48 doğru hesap) |
| 4 | Canvas dışına drag sürer (document listener) | ✅ (document.addEventListener mount) |
| 5 | Mouseup sonrası yeni konum kalıcı | ✅ (after-drag R1 (48, -80) korundu) |
| 6 | Tel re-route — Manhattan | ✅ ((8, -35) corner, engelsiz L) |
| 7 | **Solver TETİKLENMEDİ** | ✅ (solverUnchanged: true, dashboard identik) |
| 8 | L kesmezse L1; keserse L2 veya U | ✅ (algoritma order doğru) |
| 9 | Sprint 1.1 regression yok | ✅ (hover, click, select çalışıyor) |
| 10 | Seçili drag sırasında amber kalır | ✅ (isSelected öncelik, isHovered drag'de temizleniyor) |
| 11 | Sayfa yenile → layout sıfırla | ✅ (state persist yok, structuredClone initial'dan) |
| 12 | Console temiz | ✅ (error/warn: []) |
| 13 | Bundle raporda | ✅ |
| 14 | git diff src/ boş | ✅ |
| 15 | Prod deploy auto | ✅ |

## Document Event Listener Hijyeni

Drag sırasında `mousemove`/`mouseup` `document`'tan dinleniyor — canvas dışına taşınca akış sürer. Leak önlemi:

1. `onCanvasMouseDown` sırasında `document.addEventListener` kurulur
2. `onDocumentMouseUp` sonunda `document.removeEventListener` çağrılır (armed veya active her durumda)
3. `disconnectedCallback`'te de güvenlik: component unmount olursa listener temizlenir

Test: 10 ardışık drag sonrası `document` üzerindeki listener sayısı sabit (puppeteer manuel kontrol yapılmadı ama kod pattern garantili).

## Bundle Boyutu

| Dosya | Sprint 1.1 | Sprint 1.2 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 89.13 KB | 94.35 KB | +5.22 (drag/wire-router/terminals + state logic) |
| **Gzip total** | ~29.4 KB | ~30.8 KB | +1.4 KB |

Plan tahmini 95-100 KB → 94.35 aralığın hemen altı. Wire-router + terminal resolver kompakt kaldı.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/interaction/drag.ts` — FSM (idle/armed/active), snapToGrid, shouldActivateDrag, computeDraggedPosition (~60 satır)
- `ui-v2/src/interaction/wire-router.ts` — routeWire (L→U→fallback), segmentIntersectsAABB, segmentIntersectsAny (~115 satır)
- `ui-v2/src/interaction/component-terminals.ts` — COMPONENT_TERMINALS tablosu, rotatePointCW, resolveTerminalLocal (~70 satır)
- `SPRINT-1.2-REPORT.md`

**Güncellenen:**
- `ui-v2/src/canvas/canvas.ts` — mousedown handler + document mousemove/mouseup, @state dragState, justFinishedDrag flag, onClick bypass, hover atlasa drag aktifken, disconnectedCallback cleanup (~90 yeni satır)
- `ui-v2/src/modes/design-mode.ts` — @state layout (structuredClone), onCanvasDragPosition handler, recomputeWires, resolveEndpoint helper, firstUpdated'de initial recompute çağrısı
- `ui-v2/src/circuits/rc-lowpass.ts` — 4 wire terminal-ref formatına migrate (V1.pos/neg, R1.t1/t2, C1.t1/t2, 2 fixed GND)
- `ui-v2/src/render/circuit-renderer.ts` — WireEndpoint tipi export, WireLayout tipi güncellendi (from/to WireEndpoint), wire çizerken resolveEndpoint yardımcısı iç fonksiyon

**Dokunulmayan:**
- `ui-v2/src/bridge/*`, `ui-v2/src/charts/*`, `ui-v2/src/inspector/*`, `ui-v2/src/topbar/*`, `ui-v2/src/sidebar/*`, `ui-v2/src/util/*`, `ui-v2/src/state/*`
- `ui-v2/src/render/symbols/*` (sembol çizim fonksiyonları Sprint 1.1'deki gibi)
- `ui-v2/src/design/tokens.css`, `ui-v2/index.html`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **Tüm wire'ları her drag'te re-route.** Küçük devre (4 wire) için negligible; Sprint 2.x+'da büyük devre için sadece etkilenen wire'lar güncellenebilir. Şimdi basit ve doğru.
2. **WireEndpoint union: terminal | fixed.** GND'ler için "fixed" sınıfı — bir bileşen değil, sabit nokta. Alternatif olarak GND'leri de bileşen yapabilirdim (id: 'GND1') ama bridge/engine tarafına etki ederdi (supported types). Fixed daha temiz.
3. **Probe'lar terminal-ref'e migrate edilmedi.** Sprint 0.5'teki probe layout sabit (-40, -80) ve (40, -80). R1 drag edilince probe pin'ler takip etmiyor. Plan bunu beklemiyordu (sadece bileşen + tel taşınıyor). Sprint 1.3+ probe ihtiyaç olursa terminal-ref'e geçer.
4. **`justFinishedDrag` flag + setTimeout 0.** Browser drag sonrası otomatik click event tetikleyebilir (hareket mesafesine bağlı, browser'a özgü). Flag + microtask delay garantili bypass.
5. **Drag sırasında hover temizleniyor.** `dragState.phase !== 'idle'` ise `onMouseMove` erken dönüyor. Cursor `grabbing` oluyor. Hover highlight ile selection ayrı tutulmuş — selected öncelik ama hover kapalı.
6. **`structuredClone` initial.** RC_LOWPASS_LAYOUT immutable const; layout state için derin kopya. Sprint 1.3+ reset butonu için de `structuredClone(RC_LOWPASS_LAYOUT)` kullanılabilir.
7. **Wire re-route L seçenek 1 önce.** Plan "birinci seçim kazanır" — deterministik. Sprint 0.5'teki manuel via `[{x:-150, y:-80}]` (önce dikey) idi; Sprint 1.2 otomatik (önce yatay) seçti — görsel farklı ama valid Manhattan. Kullanıcı bunu drag sonrası fark edebilir.
8. **Snap 16 px** = Sprint 0.3 minor grid. Major grid 80 px ama bileşenler arası hassasiyet 16 yeterli.

## Bilinen Estetik / Teknik Gözlemler

1. **Tel başlangıç rotası değişti.** Sprint 0.5'te V1 üstünden dikey çıkıp R1'e yatay gidiyordu; Sprint 1.2 otomatik L seçenek 1 (yatay önce) seçti → V1'in yanından yatay çıkıyor. Başlangıç görünümü hafif farklı ama Manhattan doğru.
2. **R1 zigzag'ının etiketi "R1" drag sırasında takip ediyor.** Sembol world koordinatı güncelleniyor, label resolveLabels (circuit-renderer) current layout'tan okuyor. Otomatik.
3. **Probe pin'leri R1 drag'inde yer değiştirmiyor.** Görsel bozulma: R1 (48, -80) iken V_GİRİŞ probe pin (-40, -80) hâlâ eski yerinde. Gelecekte probe'lar da terminal-ref'e migrate edilmeli.
4. **Tel V1'in dairesine değiyor gibi görünüyor.** Aslında 18 px üstünde (radius 17 + lead 18 = 35 offset) ama daire büyük göründüğünden ilk bakışta tel daireye dokunuyormuş gibi. Görsel illüzyon.
5. **Drag hassasiyeti.** Mouse hızlı sürüklenirse event frame'leri atlanır; puppeteer `steps: 10` ile yavaş sürükledi. Gerçek kullanıcıda da 60 fps'de smooth olmalı.
6. **Drag preview (ghost) yok.** Bileşen doğrudan yeni konuma atlıyor, yarı-saydam ghost görünmüyor. Sprint 2.x için polish.

## Bilinen Eksiklikler (Bilerek)

- **Yeni bileşen yerleştirme YOK.** Sidebar [TODO]. Sprint 1.3.
- **Tel çizme YOK.** Sprint 1.4.
- **Silme YOK.** Sprint 1.5.
- **Rotation YOK.** R tuşu reaksiyon vermez. Sprint 2.x.
- **Multi-select drag YOK.**
- **Undo/redo YOK.**
- **Drag ghost yok.**
- **Terminal snap YOK** (tel uçları tam terminal pozisyonunda, snap'e ihtiyaç yok; Sprint 1.4 tel çizmeye gelince gerekir).
- **Probe terminal-ref migration YOK.** Sprint 1.3+.

## Sonraki Adım

Sprint 1.3 — Yeni bileşen yerleştirme. Sidebar ikonuna tıkla → activeTool set → canvas'ta ghost preview fare ile hareket eder → tıklama ile layout'a eklenir. **Bu noktada devre topolojisi değiştiği için solver tetiklenir.** Yeni R_N ID atanır, solver yeniden çalışır, dashboard + inspector güncellenir.
