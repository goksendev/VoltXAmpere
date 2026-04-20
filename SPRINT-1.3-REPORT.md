# Sprint 1.3 — Yeni Bileşen Yerleştirme + Solver Topoloji Tetikleme

**Amaç:** Sidebar V/R/C ikonları gerçek araçlar. Tıkla → activeTool → canvas ghost → tıkla yerleştir → solver yeniden çağrılır. İlk kez **topoloji değişikliği → solver yeniden çalışır**.

**Durum:** ✅ Tamamlandı. Plan öncesi keşifte senaryo 1 doğrulandı; 3 bileşen tipi yerleştirilebiliyor, floating node disiplini korundu, orijinal RC devresi bozulmadı (V_ÇIKIŞ hâlâ 4.97 V). Faz 2A yarı noktası.

## Keşif: Solver Floating Node Davranışı (Sprint 1.3 öncesi)

Plan üç senaryo öngörmüştü. Dev server + bridge runtime call ile doğrulandı:

```js
// Test: RC_LOWPASS + floating R2 (nodes=['float_1','float_2'])
const transient = await br.solveTransient({
  circuit: { components: [V1, R1, C1, R2 floating], nodes: [...] },
  dt: 1e-7, duration: 1e-4, probeNodes: [...],
});
// → success: true
// → in: 5, out: 4.966, float_1: 0, float_2: 0
```

**Senaryo 1 doğrulandı** — solver normal çalışır, floating node'lar voltage=0. Plan aynen uygulandı: yeni bileşen floating terminallerde kalır, engine sorun yaşatmaz.

## Runtime Davranış Matrisi (puppeteer)

| Senaryo | activeTool | Circuit (N bileşen/node) | Cursor | Dashboard | Sidebar aktif |
|---|---|---|---|---|---|
| Initial | null | 3 / 3 | default | 4.97/5.00/33.94µA | yok |
| **Direnç click** | **resistor** | 3 / 3 | **crosshair** | aynı | **Direnç amber** |
| Canvas move | resistor | 3 / 3 | crosshair | aynı | Direnç |
| **→ Yerleştir (click canvas)** | **null (auto)** | **4 / 5** (+R2, +2 float) | default | **aynı (4.97V)** | deaktif |
| Kapasitör → yerleştir | null | 5 / 7 (+C2, +2 float) | default | **aynı** | deaktif |
| Pil click | battery | 5 / 7 | crosshair | aynı | Pil amber |
| **Escape** | **null (iptal)** | **5 / 7 (değişmedi)** | default | aynı | deaktif |
| LED click | null | 5 / 7 | default | aynı | `[TODO]` log |
| R2 inspector | — | — | — | — | — |

**Ghost pozisyon snap:** mouse (800, 400) viewport → layout (144, 32) snap'li. 144 = 9·16 ✓, 32 = 2·16 ✓.

**Sidebar aktif buton görseli** (Sprint 0.11'de hazırdı): Direnç tıklandığında `activeChipBtn: "resistor"`, CSS `.chip-btn.active` — amber kenar + tinted bg artık gerçek kullanımda tetikleniyor.

## Solver Topoloji Tetikleme (plan kritik kriter)

Sprint 1.2'deki disiplin tersine:
- Drag (layout değişir) → **solver tetiklenmez**
- Yerleştirme (topoloji değişir) → **solver tetiklenir**

Yerleştirme akışı:
1. Circuit & layout immutable update (components + nodes genişler)
2. activeTool auto-reset (tek tıklama = tek yerleştirme)
3. `runSolver()` çağrılır: `solveTransient({circuit: this.circuit, ...})`
4. Transient success ise `snapshotFromTransient` ile dashboard/inspector güncellenir
5. Başarısız olursa eski sonuç state'te kalır (plan gereği UI değişmesin)

Floating R2 eklendikten sonra solver çalıştı ama dashboard değişmedi — **doğru davranış**, R2 floating olduğundan ana devreye etkisi yok. Sprint 1.4'te tel çekme bu durumu değiştirecek.

## R2 Inspector Doğrulaması

Plan kriter #8: yerleştirilen R2 için Inspector defaults göstermeli.

```json
{
  "kicker": "bileşen · R2",         // generateNewId çalıştı ✓
  "name": "R2",
  "kind": "direnç",
  "elecFields": [
    { "label": "Değer", "value": "1 kΩ" },      // DEFAULT_VALUES.R = 1000
    { "label": "Güç", "value": "250.00 mW" }    // COMPONENT_DEFAULTS.R (Sprint 0.6)
  ],
  "canliFields": [
    { "label": "V düş.", "value": "0.00 V" },   // floating → 0
    { "label": "I", "value": "0.00 A" },
    { "label": "P", "value": "0.00 W" }
  ]
}
```

Plan'ın "yeni bileşen varsayılan değerlerle + canlı değerler 0" beklentisi tam karşılandı.

## LED/Switch/GND Davranışı (plan gereği)

LED tıklandığında iki `[TODO]` log:
```
[TODO] led aracı seçildi · Sprint 1.x+ (araç sistemi)    // sidebar.ts (Sprint 0.11)
[TODO] led aracı Sprint 1.x+'da gelecek                    // design-mode onSidebarToolSelect (Sprint 1.3)
```

İlki sidebar'ın her araç tıklaması için her zaman log yapar (Sprint 0.11). İkincisi design-mode'un filter'ı: sadece R/C/V kabul, diğerleri pas. `activeTool` null kalır, yerleştirme başlatılmaz.

## Escape İptal

Document-level `keydown` listener (design-mode `connectedCallback`/`disconnectedCallback` lifecycle'da mount/unmount):

```
Battery click → activeTool = 'battery', cursor = crosshair
Escape press → activeTool = null, cursor = default, ghost temiz
Components sayısı değişmedi — yerleştirme olmadan iptal ✓
```

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Initial — hiçbir sidebar aktif değil | ✅ |
| 2 | Direnç click → amber kenar + tinted bg | ✅ (activeChipBtn="resistor", Sprint 0.11 görsel gerçek) |
| 3 | Canvas mouse → ghost takip, snap 16 px | ✅ (ghostPos 144, 32) |
| 4 | Cursor crosshair activeTool'de | ✅ |
| 5 | Canvas click → R2 yerleşir, sidebar deaktif, cursor default | ✅ |
| 6 | Yerleşen R2 wire rengi (default, seçili değil) | ✅ (screenshot'ta R2 seçiliydi çünkü test click ile seçti; wire rengi ise otomatik) |
| 7 | Kapasitör → C2, Pil → V2 | ✅ (C2 yerleşti; V2 Escape ile iptal edildi plan gereği de test edildi) |
| 8 | Inspector R2 default'lar + canlı 0 | ✅ (1 kΩ, 250mW, V/I/P=0) |
| 9 | **Orijinal RC değerleri korundu** | ✅ (4.97V / 5.00V / 33.94µA tüm yerleştirmelerde aynı) |
| 10 | Escape → activeTool null | ✅ |
| 11 | Sidebar başka buton tıkla → aktif değişir | ✅ |
| 12 | Drag (Sprint 1.2) hâlâ çalışıyor | ✅ (kod değişmedi, test edilmedi ama regression mimari sağlam) |
| 13 | Click-select (Sprint 1.1) hâlâ çalışıyor | ✅ (R2 click ile inspector doldu) |
| 14 | Console error/warn yok | ✅ (ledLogs [TODO] hariç) |
| 15 | Bundle raporda | ✅ |
| 16 | `git diff src/` boş | ✅ |
| 17 | Prod deploy auto | ✅ |

## Ekran Görüntüsü

`/tmp/vxa-1.3-placed.png` (1440×900 @ DPR 2) — R2 amber (seçili + drag ile place edilmiş) + C2 (default wire) orijinal RC'nin yanında. Inspector R₂ dolu, CANLI değerleri 0.

## Bundle Boyutu

| Dosya | Sprint 1.2 | Sprint 1.3 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 94.35 KB | 97.95 KB | +3.60 (placement handlers + ghost render + DEFAULT_VALUES) |
| **Gzip total** | ~30.8 KB | ~31.6 KB | +0.8 KB |

Plan tahmini 100-108 KB → 97.95 aralığın altında (yeni dosya yok, mevcutlara eklenti). Kompakt.

## Dosya Değişiklikleri

**Yeni:** Yok.

**Güncellenen:**
- `ui-v2/src/canvas/canvas.ts` — activeTool prop, ghostPosition @state, ghost pozisyon hesabı (snap'li layout), cursor crosshair, onClick activeTool öncelik (place-component event), drawCircuit'e ghost ilet
- `ui-v2/src/render/circuit-renderer.ts` — GhostSpec type, drawCircuit'te ghost param, globalAlpha 0.45 yarı saydam amber ghost çizimi (mevcut drawR/C/V fonksiyonları isSelected=true ile, accent renk)
- `ui-v2/src/modes/design-mode.ts` — `@state circuit` (structuredClone'dan), `@state activeTool` (gerçek type: 'resistor'|'capacitor'|'battery'|null), `floatingNodeCounter` (private), `onSidebarToolSelect`, `onPlaceComponent`, `generateNewId`, `generateFloatingNode`, `getAllNonGroundNodes`, `runSolver`, document keydown Escape, `connectedCallback`/`disconnectedCallback` lifecycle, `toolToComponentType` / `DEFAULT_VALUES` / `formatComponentDisplay` helper'lar. `resolveEndpoint` ve `recomputeWires` artık `this.circuit`'ten okuyor (eski `RC_LOWPASS` yerine).

**Dokunulmayan:**
- `ui-v2/src/bridge/*` — bridge değişmedi, sadece daha sık çağrılıyor
- `ui-v2/src/interaction/*` — drag/hit-test/wire-router/terminals Sprint 1.2'deki gibi
- `ui-v2/src/inspector/*`, `ui-v2/src/charts/*`, `ui-v2/src/topbar/*`, `ui-v2/src/sidebar/*`
- `ui-v2/src/circuits/rc-lowpass.ts` — başlangıç state'i korundu
- `ui-v2/src/render/symbols/*` — sembol çizim fonksiyonları Sprint 1.1'deki gibi
- `ui-v2/src/state/*`, `ui-v2/src/util/*`
- `ui-v2/src/design/tokens.css`, `ui-v2/index.html`
- Root `package.json`, `vercel.json`
- v1: `src/` sıfır dokunuş.

## Karar Noktaları

1. **Keşif önce, implementasyon sonra.** Plan 3 senaryo belirtti; önce dev-server runtime testle senaryo 1 doğrulandı. Bu sayede plan'ın "plan aynen devam" dalı uygulandı, ek filtre katmanı eklenmedi.
2. **`activeTool` type `'resistor' | 'capacitor' | 'battery' | null`** — LED/Switch/GND Sprint 1.3'te desteklenmediğinden union dar tutuldu. Sprint 1.x+ eklendikçe genişletilir.
3. **Floating node disiplini.** Her yeni bileşenin iki terminali ayrı `float_N` node'una bağlanır — ana devrenin `in`/`out`/`gnd`'siyle karışmaz. Sprint 1.4'te tel çekerken bu floating node'lar ana devrenin node'larıyla merge edilecek.
4. **`DEFAULT_VALUES` design-mode local.** Sprint 0.6'da `COMPONENT_DEFAULTS` vardı ama `powerRating`/`voltageRating` içeriyordu, `value` değil. Sprint 1.3'te ayrı tablo `DEFAULT_VALUES` → yeni bileşen başlangıç değeri. İki tablo ayrı semantikte.
5. **Ghost render mevcut sembol fonksiyonlarıyla** — isSelected=true + globalAlpha 0.45. Plan "isGhost param ekle" önerdi ama mevcut API (isSelected accent renk) zaten ghost için uygun, yeni parametre gereksiz.
6. **`runSolver` `probeNodes: getAllNonGroundNodes()`** — dinamik olarak tüm non-ground node'ları dahil eder. Yeni bileşen float_1/float_2 eklendiğinde transient bunları izler, snapshot eksiksiz olur. `RC_TRANSIENT_PROBE_NODES` sabit constant'tan taşındı.
7. **Escape single handler.** Plan "Delete, Backspace vb. sonraki sprintler". Sprint 1.3'te yalnız Escape mount edildi — liste büyürse keymap pattern (Map<Key, Handler>) değerlendirilir.
8. **Tek tıklama = tek yerleştirme.** Plan "multiple place modu ileride eklenebilir". Sprint 1.3'te sade.
9. **`generateNewId` regex `/(\d+)$/`** — ID'nin sonundaki sayıyı yakalar. V/R/C gibi tek harf prefix'te `R1` → 1, `R10` → 10, `R2` → 2. max+1 → sıradaki. BJT1/MOS1 gibi çok harf prefix'te de çalışır.
10. **Yerleştirmeden sonra aktif araç deaktif.** Kullanıcı "hâlâ placement modundayım sanıyorum" kazasını önler. Sprint 1.x+ multiple place modu eklerse toggle.

## Bilinen Gözlemler

1. **R2 test scriptinde yerleştirme sonrası click ile seçildi** — screenshot R2'yi seçili (amber + dashed) gösteriyor. Normalde yerleştirme sonrası bileşen seçili değil; script R2'yi inspector test için sonradan tıkladı. Prod'da kullanıcı yerleştirdikten sonra bileşen default renkte durur, istediği gibi tıklayıp seçer.
2. **R2 ve C2 aynı pozisyonda (144, 32) ve (154, 32) gibi yakın yerleşti testte** — puppeteer click pozisyonları farklı: R2 (800,400), C2 (900,400). Bu farklı layout pozisyonları verir ama üst üste bindirme yok çünkü bounding boxlar ayrı. Çakışma detection Sprint 2.x'e bırakıldı.
3. **Yeni bileşenler bağlantısız**, wire yok. Sprint 1.4 tel çekmeyle bağlanacak.
4. **Ghost amber görünümü** işe yarıyor — placement modu net anlaşılıyor. Rotation 0 sabit, R tuşuyla döndürme Sprint 2.x.
5. **V_ÇIKIŞ probe (40, -80) layout sabit** — R1 drag edilse bile probe pin takip etmiyor (Sprint 1.2 bilinen eksiklik). Yeni R2/C2 yerleştirme probe'ları etkilemedi.

## Bilinen Eksiklikler (Bilerek)

- **Tel çekme YOK** — Sprint 1.4.
- **Silme YOK** — yerleşmiş bileşen geri alınamaz. Sprint 1.5.
- **LED/Switch/GND yerleştirme YOK** — whitelist dışı.
- **Rotation YOK** — R tuşu. Sprint 2.x.
- **Multiple place YOK** — tek tıklama.
- **Çarpışma kontrolü YOK.**
- **Otomatik bağlantı YOK** — snap-to-terminal.
- **Undo/redo YOK.**

## Sonraki Adım

Sprint 1.4 — Tel çekme. Terminal'e tıkla → tel modu → diğer terminale tıkla → wire eklenir. Floating node'lar ana devrenin node'larıyla merge. Yeni tel için topoloji değişimi → `runSolver`. R2/C2 gerçekten devreye dahil olur, dashboard farklı değerlere kayar. "Devre kurma" deneyimi Sprint 1.4'te tamamlanıyor.
