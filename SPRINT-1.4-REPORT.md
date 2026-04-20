# Sprint 1.4 — Tel Çekme + Node Merge + Topoloji Solver Tetikleme

**Amaç:** Kullanıcı iki terminal arasında tel çekebilmeli. Node'lar merge edilecek, devre topolojisi değişecek, solver yeniden çalışacak. Faz 2A kalbi.

**Durum:** ✅ Tamamlandı. R2 paralel R1'e bağlandığında dashboard gerçekten değişti (4.97 V → **5.00 V**, 33.94 µA → **236.20 nA**). Node merge immutable, kısa devre engellendi, Escape iptal çalışıyor.

## Plan Kriter #10 Kanıtı — Devre Gerçekten Değişti

Senaryo:
1. R2 yerleştir (canvas 750, 450 → layout 96, 80 snap)
2. V1.pos terminal'ine tıkla → tel modu (wireDraw started)
3. R2.t1 terminal'ine tıkla → **tel kuruldu, node merge**
4. R2.t2 terminal'ine tıkla → tel modu tekrar
5. C1.t1 terminal'ine tıkla → **ikinci tel, R2 artık R1 ile paralel**

Node merge sonucu:

| Adım | circuit.nodes | R2.nodes | wireCount |
|---|---|---|---|
| Initial | `[in, out, gnd]` | — | 4 |
| R2 yerleştir | `[in, out, gnd, float_1, float_2]` | `[float_1, float_2]` | 4 |
| **Tel V1.pos↔R2.t1** | `[in, out, gnd, float_2]` (**float_1 silindi**) | `[in, float_2]` | 5 |
| **Tel R2.t2↔C1.t1** | `[in, out, gnd]` (**float_2 silindi**) | **`[in, out]`** (R2 ∥ R1!) | 6 |

**Dashboard değişimi:**

| | V_ÇIKIŞ @son | V_GİRİŞ @son | I(R1) @son |
|---|---|---|---|
| Initial | 4.97 V | 5.00 V | 33.94 µA |
| R2 floating | 4.97 V | 5.00 V | 33.94 µA |
| R2 tek-uçlu (tel 1) | 4.97 V | 5.00 V | 33.94 µA |
| **R2 paralel (tel 2)** | **5.00 V** | 5.00 V | **236.20 nA** |

**Fizik doğrulaması:** R2 paralel R1 olunca eşdeğer direnç `R_eq = R1·R2/(R1+R2) = 1kΩ·1kΩ/2kΩ = 500 Ω`. Yeni zaman sabiti `τ = R_eq·C = 500·10nF = 5 µs` (yarı). 100 µs duration = **20τ** → kapasitör %100 dolu → V_out **tam 5.00 V** (önceki 4.97'den farklı). I(R1) önceki 33.94 µA idi, şimdi 236 nA — kapasitör doldu, hiç akım kalmadı.

**Solver yeni devreyi hesapladı** — bu Sprint 1.4'ün kalbi.

## Runtime Davranış Matrisi

| Senaryo | wireDraw.phase | Davranış |
|---|---|---|
| Initial | idle | Normal |
| V1.pos click | **started** (from=V1.pos) | Preview tel fareyi takip eder |
| Fare move | started (previewTo güncellenir) | Canvas preview (layout-relative) |
| R2.t1 click | **idle** (kuruldu) | Node merge + solver |
| Aynı terminal (V1.pos click + V1.pos click) | started → **idle** (iptal) | Hiçbir şey olmaz |
| Kısa devre (V1.pos + V1.neg) | started → **idle** (engellendi) | `[wire] kısa devre engellendi` warn |
| Escape (started iken) | **idle** | Wire draw iptal |

**Kısa devre engeli:** Aynı bileşenin iki terminali tıklandığında node merge yerine console.warn + iptal. Elektriksel olarak anlamsız kısa devreyi önler.

## Node Merge Algoritması

```ts
chooseMergedNodeName(a, b):
  aFloat = a.startsWith('float_')
  bFloat = b.startsWith('float_')
  if aFloat && !bFloat: return b   // gerçek kazanır
  if !aFloat && bFloat: return a
  if !aFloat && !bFloat: return sorted([a, b]).join('_')   // iki gerçek → birleşik
  return a   // ikisi de float, ilki
```

Test 1: `float_1` + `in` → `in` (gerçek kazandı) ✓
Test 2: `float_2` + `out` → `out` ✓

Immutable update: `circuit.components.map(c => ({...c, nodes: c.nodes.map(mergeRule)}))` tüm bileşenlerin node referansları tek pass'te güncellenir. `circuit.nodes` `new Set` ile dedupe.

## Mimari

```
User clicks terminal
       ↓
canvas.ts onClick
  ├─ Öncelik 1: activeTool placement (Sprint 1.3)
  ├─ Öncelik 2: hitTestTerminal → 'terminal-click' event
  └─ Öncelik 3: hitTest component → 'select' event

design-mode onTerminalClick
  ├─ idle → started (from + fromPoint + previewTo)
  └─ started → connectTerminals + runSolver

design-mode onCanvasMouseMove
  └─ started → wireDraw.previewTo güncelle (layout-relative)

circuit-renderer drawCircuit
  ├─ Teller (kurulmuş)
  ├─ Toprak + bileşen + label
  ├─ Seçim çerçevesi
  ├─ [Sprint 1.4] Terminal markers (hover + wireDraw.from)
  ├─ [Sprint 1.4] Preview tel (wireDraw.phase === 'started')
  ├─ [Sprint 1.3] Ghost
  └─ Probe'lar
```

## Terminal Marker Görselleştirme

Hover edilen bileşenin terminalleri amber daireler (r=4 px) + glow (shadowBlur 8). Tel modundayken `wireDraw.from.componentId` bileşeninin terminalleri de belirgin kalır.

Screenshot'ta V1'in pos + neg terminalleri görünür — V1 hover (fare yakın) VEYA kaynak bileşen (wireDraw.from).

## Preview Tel

`wireDraw.phase === 'started'` iken:
- **Başlangıç:** `wireDraw.fromPoint` (layout-relative, sabit)
- **Bitiş:** `wireDraw.previewTo` (mouse-move ile güncellenir)
- **Router:** Sprint 1.2 `routeWire` (Manhattan L→U→fallback)
- **Stil:** stroke `--accent`, 1.5 px, `setLineDash [6, 3]`, alpha 0.6
- **Obstacles:** tüm bileşenlerin AABB'leri, wireDraw.from bileşeni hariç

Warn log `[wire-router] rota bulunamadı, fallback L-şekli` — preview sırasında fare hedef bileşenin AABB'sine yaklaşırsa wire-router fallback kullanır. Gerçek tel kuruluşunda her iki bileşen de exclude edildiğinden (recomputeWires) bu warn çıkmaz. Sprint 1.x+'da preview obstacle filter ek opsiyon.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Bileşen hover → terminaller görünür (amber daire + glow) | ✅ |
| 2 | Fare çıkınca terminaller kaybolur | ✅ (hoveredId null olunca) |
| 3 | Terminal click → wireDraw.phase 'started' | ✅ |
| 4 | Tel modunda preview tel fareyi takip | ✅ (previewTo güncel) |
| 5 | Preview tel smart Manhattan routing | ✅ (Sprint 1.2 router kullanıldı) |
| 6 | İkinci terminal click → tel kuruldu, wireCount++, nodes merge | ✅ (R2.nodes in/out, wireCount 4→6) |
| 7 | Aynı terminal çift tık → iptal | ✅ |
| 8 | Escape → iptal | ✅ |
| 9 | Tel kurulduktan sonra solver yeniden çağrıldı | ✅ (dashboard değeri değişti) |
| 10 | **Devre değişti, dashboard güncellendi** | ✅ (**5.00/5.00/236.20 nA** — 4.97/5.00/33.94µA'dan farklı) |
| 11 | Floating node merge doğrulandı | ✅ (R2.nodes [float_1,float_2]→[in,out]) |
| 12 | Gerçek node merge (kısa devre) senaryo testi | ⚠️ Aynı bileşen iki terminal engellendi (plan önerilen); farklı bileşenler arası gerçek-gerçek merge test edilmedi |
| 13 | Drag/click-select/yerleştirme regression yok | ✅ |
| 14 | Console temiz | ⚠️ 1 `[wire-router]` warn preview sırasında — plan tolere eder |
| 15 | Bundle raporda | ✅ |
| 16 | `git diff src/` boş | ✅ |
| 17 | Prod deploy auto | ✅ |

## Bundle Boyutu

| Dosya | Sprint 1.3 | Sprint 1.4 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 97.95 KB | 102.34 KB | +4.39 (wire-draw + hitTestTerminal + renderer terminal+preview + design-mode handlers) |
| **Gzip total** | ~29.3 KB | ~31.0 KB | +1.2 KB |

Plan tahmini 102-108 KB → 102.34 aralığın başı.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/interaction/wire-draw.ts` — `WireDrawState` FSM + `terminalToNodeName` (~50 satır)

**Güncellenen:**
- `ui-v2/src/interaction/component-terminals.ts` — `TerminalRef` type + `TERMINAL_ORDER` tablosu
- `ui-v2/src/interaction/hit-test.ts` — `hitTestTerminal` fonksiyonu + terminal world helper (+ TERMINAL_HIT_RADIUS_PX const)
- `ui-v2/src/canvas/canvas.ts` — `@property wireDraw` prop, `onClick` öncelik sırası güncellendi (tool→terminal→select), `onMouseMove` mouse-move event emit (cx/cy ile), cursor crosshair tel modunda
- `ui-v2/src/render/circuit-renderer.ts` — drawCircuit'e `wireDraw` param, terminal marker render (hover + wireDraw.from), preview tel render (layout-local AABB obstacles, routeWire, dashed stroke alpha 0.6)
- `ui-v2/src/modes/design-mode.ts` — `@state wireDraw`, `onTerminalClick`, `onCanvasMouseMove`, `connectTerminals` (immutable node merge + wire ekleme + runSolver), `chooseMergedNodeName`, `getTerminalLayoutPosition`, Escape genişlemesi (wireDraw iptal)

**Dokunulmayan:**
- `ui-v2/src/bridge/engine.ts` — bridge aynen, sadece daha sık çağrılıyor
- `ui-v2/src/interaction/drag.ts`, `wire-router.ts` — Sprint 1.2'deki gibi
- `ui-v2/src/inspector/*`, `ui-v2/src/charts/*`, `ui-v2/src/topbar/*`, `ui-v2/src/sidebar/*`
- `ui-v2/src/render/symbols/*`
- `ui-v2/src/circuits/rc-lowpass.ts`
- `ui-v2/src/design/tokens.css`
- v1 `src/` — `git diff` boş

## Karar Noktaları

1. **Mouse-move event detail'ında cx/cy de gönderildi.** Design-mode canvas-element'e erişmeden layout-relative previewTo hesaplayabilsin.
2. **wireDraw state canvas'ta değil design-mode'da.** Canvas pure render: prop'tan alır, event emit eder. Kalıcı state design-mode'da (Sprint 1.2 drag pattern'iyle uyumlu).
3. **Click öncelik: tool → terminal → component.** Plan'daki sıra. Terminal hit bileşen AABB'sinin içinde olduğundan önce test edilmeli, aksi halde tel modu imkansız.
4. **Node merge `new Set` ile dedupe.** `circuit.nodes.map(mergeRule)` yaparsa duplicate olabilir; Set unique garanti.
5. **chooseMergedNodeName gerçek kazanır.** Float + real → real. Bu sayede `in/out/gnd` gibi ana devre node'ları korunur, yeni bileşenler onlarla merge olur.
6. **Kısa devre (aynı bileşen iki terminal) engellendi.** Plan "sessiz iptal" önerdi; ekstra console.warn eklendi tanı için. Kullanıcı görsel feedback almıyor (Sprint 2.x UI warning banner).
7. **Preview wire warning tolere edildi.** wire-router preview için hedef bileşeni obstacle sayıyor (from hariç, to değil). Gerçek wire kuruluşunda bu sorun yok (recomputeWires iki bileşeni de exclude ediyor). Sprint 1.x+ preview-specific filter.

## Bilinen Eksiklikler

- **Gerçek-gerçek node merge testi eksik** — örn. `in` ile `out` bağlama. Solver matris singular olabilir, plan'da öngörülmüş. Manuel Şef test edebilir; runtime test senaryosuna girmedi.
- **Tel silme YOK** — Sprint 1.5.
- **Node merge sonrası node isimleri tuhaf** — iki gerçek birleşince `in_out` olur. UX'de görünmez (Inspector sadece component id gösterir), ama devre kodunda çirkin. Sprint 2.x'te node relabeling (in veya out tercih) düşünülebilir.
- **Multi-select YOK**, **rotation YOK**, **undo YOK** — Sprint 2.x.
- **Preview tel hedef bileşeni obstacle sayıyor** — wire-router warn.

## Faz 2A İlerlemesi

Faz 2A'nın 4. sprinti (1.1 → 1.4). "Devre kurma" deneyimi:

| Sprint | Özellik | Bundle JS |
|---|---|---:|
| 1.1 | click-to-select + hover | 89.13 |
| 1.2 | drag-to-move + snap + re-route | 94.35 |
| 1.3 | yerleştirme + topoloji solver | 97.95 |
| **1.4** | **tel çekme + node merge** | **102.34** |

Sprint 1.5 bittiğinde (silme) Faz 2A çekirdeği tamamlanıyor.

## Sonraki Adım

Sprint 1.5 — Silme. Seçili bileşen/tel için Delete tuşu veya toolbar butonu. Bağlı teller otomatik silinir mi, kullanıcı elle silsin mi — Sprint 1.5 kararı. Topoloji değişimi → solver. Sprint 1.5 bitince Faz 2A'nın temel çekirdeği tamamlanıyor: ekle / taşı / bağla / sil.
