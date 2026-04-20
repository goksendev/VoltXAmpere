# Sprint 2.2 — Multi-Select: Shift+Click Toggle + Bulk Delete

**Status:** ✅ Tamamlandı
**Faz:** 2B
**Tarih:** 2026-04-20
**Bundle:** 111.87 KB JS (gzip 33.19 KB) — Sprint 2.1'den **+2.28 KB**

---

## Özet

Shift+Click ile kullanıcı birden fazla bileşeni seçebiliyor. Toggle mantığı: seçili değilse ekler, seçiliyse çıkarır. 5 bileşen seçili + Delete → hepsi tek anda silinir, Ctrl+Z tek tuşla hepsini geri getirir.

Altyapı değil UX sprinti — ama Sprint 2.1'in undo altyapısı ile birebir uyumlu. `deleteMultipleComponents` başında tek `pushHistory()` çağrısı = tek undo adımı.

---

## Kapsam

| Alan | Yapılan | Dosya |
|---|---|---|
| Selection tipi | `{type:'multi', componentIds[]}` + `selectedComponentIds`/`isComponentSelected` helpers | `state/selection.ts` |
| Canvas click | `select` event detail `{hitComponent, hitWire, isShift}` — karar design-mode'da | `canvas/canvas.ts` |
| Canvas prop | `selectionId?: string` → `selectedIds: string[]` | `canvas/canvas.ts` |
| Renderer | `selectedIds.includes(id)` her bileşen için, `drawSelectionFrame` loop'lu | `render/circuit-renderer.ts` |
| Design-mode | `toggleComponentInSelection` geçiş mantığı, `deleteSelection` router, `deleteMultipleComponents` | `modes/design-mode.ts` |
| Inspector | `renderMulti` paneli — N bileşen + tip sayımı + Delete ipucu | `inspector/inspector.ts` |

### Değişmeyenler
`src/engine/` (v1 korundu), `bridge/*`, `charts/*`, `topbar/*`, `sidebar/*`, `render/symbols/*`, `interaction/*`, `state/history.ts`, `circuits/*`, `design/tokens.css`.

---

## Selection tipi geçişleri

```
 none ──shift+click A──> component(A)
 component(A) ──shift+click A──> none       (aynı bileşen)
 component(A) ──shift+click B──> multi([A,B])
 multi([A,B]) ──shift+click C──> multi([A,B,C])
 multi([A,B,C]) ──shift+click A──> multi([B,C])
 multi([A,B]) ──shift+click A──> component(B)    (tek kaldı)
 multi([A,B]) ──shift+click B──> component(A)    (tek kaldı)
 wire(0) ──shift+click A──> component(A)          (kategoriler arası geçiş)
 * ──shift+click empty──> * (selection KORUNUR)
 * ──shift+click wire──> * (selection KORUNUR)
```

**Kritik disiplin:** `'multi'` tipi **en az 2 eleman** içerir. Tek kalınca `'component'`, hepsi çıkınca `'none'`. `toggleComponentInSelection` bu invariant'ı garantiler — runtime testi 4. case `{type:'component', id:'C1'}` çıktısıyla kanıtladı.

---

## Kabul kriterleri — Test matrisi

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Shift+Click → multi, amber çerçeveler | ✅ | `sel={type:'multi', componentIds:['R1','V1']}` |
| 2 | 3 bileşen → inspector "3 bileşen" + tip dökümü | ✅ | "3 bileşen çoklu seçim içerik direnç 1 voltaj kaynağı 1 kapasitör 1" |
| 3 | Shift+Click seçili bileşen → çıkar | ✅ | `multi[R1,V1,C1]` → shift+R1 → `multi[V1,C1]` |
| 4 | Multi'de son eleman çıkınca component'a düşer | ✅ | `multi[V1,C1]` → shift+V1 → `component(C1)` |
| 5 | Tek kalan component'ı shift ile çıkar → none | ✅ | `component(C1)` → shift+C1 → `none` |
| 6 | Inspector multi paneli | ✅ | Tip sayım (direnç 1, voltaj kaynağı 1, kapasitör 1) + Delete ipucu |
| 7 | Bulk Delete → tek undo adımı | ✅ | `histPast` delta = **1** (N değil), wireCount 4→0, compIds [] |
| 8 | Tek Ctrl+Z → hepsi geri | ✅ | 3 bileşen + 4 tel restore edildi |
| 9 | Shift+Click boş alan → selection korunur | ✅ | `multi[R1,V1]` before = after |
| 10 | Shift+Click tel → selection korunur | ✅ | `multi[R1,V1]` before = after |
| 11 | Shift yok → Sprint 1.1 davranış | ✅ | Normal click → `component(C1)`, multi düşer |
| 12 | Hover çalışıyor multi'de | ✅ | Render loop her bileşen için isHovered bağımsız |
| 13 | Sprint 1.1-2.1 davranışları korunuyor | ✅ | Click/hover/drag/place/wire/delete/undo/redo normal |
| 14 | Console temiz | ✅ | 0 hata/warning |
| 15 | Bundle | ✅ | 111.87 KB (hedef 112-116 KB altında) |
| 16 | v1 regression | ✅ | `git diff src/` boş |
| 17 | Production `voltxampere.com/v2` | ⏳ | Push sonrası Vercel otomatik |

---

## Runtime akış — bulk delete tek undo kanıtı

```
INIT                                  histPast=0, compIds=[C1,R1,V1], wireCount=4

R1 click                              sel=component(R1)
Shift+V1                              sel=multi([R1,V1])
Shift+C1                              sel=multi([R1,V1,C1])

Delete (bulk)                         histPast=1 (+1, NOT +3)
                                       sel=none
                                       compIds=[] (hepsi gitti)
                                       wireCount=0 (bağlı teller otomatik temiz)

Cmd+Z (SINGLE UNDO)                   histPast=0, histFuture=1
                                       compIds=[C1,R1,V1] (HEPSİ GERİ)
                                       wireCount=4 (HEPSİ GERİ)
```

Kanıt — `past delta: 1` (tek snapshot), `compIds restored: OK`, `wireCount restored: OK`.

---

## Render disiplini — multi'de her bileşen kendi çerçevesinde

Sprint 1.1'de `selectionId === p.id` kontrolü tek bileşen için çalışıyordu. Sprint 2.2:
```ts
// Bileşen body + label döngüleri
const isSelected = selectedIds.includes(p.id);

// Seçim çerçeveleri — tek değil artık loop
for (const selId of selectedIds) {
  const placement = layout.components.find(p => p.id === selId);
  // drawSelectionFrame(...)
}
```

**Birleşik çerçeve YOK** (tüm seçili bileşenleri saran tek kutu) — her bileşen kendi dashed amber çerçevesinde. Sprint 2.3 rubber-band sonrası tek-kutu UX tartışılabilir, şimdilik görsel tutarlılık.

---

## Edge case'ler

1. **Shift+Click boş alan** → selection korunur. Figma/Sketch davranışı — kullanıcı yanlışlıkla kaçırdıysa seçim kaybolmasın.
2. **Shift+Click tel** → bu sprint'te teller multi'ye katılmıyor. Selection korunur, tel seçimine geçiş olmaz.
3. **Multi seçiliyken wire'a normal click** → wire seçimine geçer (Sprint 1.5 davranışı korunur).
4. **Multi'de bulk delete + orphan node cleanup** → `rebuildNodeTopology` çağrısı kalan bileşenler için topoloji yeniden kurar. Rezerve isimler (`'in'`, `'out'`, `'gnd'`) korunur (Sprint 1.5 algoritması aynen).

---

## Dosya değişiklik özeti

```
 SPRINT-2.2-REPORT.md                     | +130 (yeni)
 ui-v2/src/state/selection.ts             |  ~30 değişim
 ui-v2/src/canvas/canvas.ts               |  ~55 değişim (prop rename + click detail)
 ui-v2/src/render/circuit-renderer.ts     |  ~15 değişim (selectionId → selectedIds + loop)
 ui-v2/src/modes/design-mode.ts           |  +120 ekleme (toggle, router, bulk delete, import)
 ui-v2/src/inspector/inspector.ts         |  +60 ekleme (renderMulti)
```

Net: 5 dosya güncellendi, 1 rapor. `src/` (v1) dokunulmadı.

---

## Bundle trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 1.5 | 107.84 KB | +5.50 |
| 2.1 | 109.59 KB | +1.75 |
| **2.2** | **111.87 KB** | **+2.28** |

---

## Bilinen kısıtlar & [TODO]

1. **Multi-drag YOK** — 5 bileşen seçiliyken drag başlatırsa sadece tıklanan bileşen taşınır, grup kalır. Sprint 2.4.
2. **Rubber-band seçim kutusu YOK** — Sprint 2.3.
3. **Tel multi-select YOK** — Shift+Click tel noop. Sprint 2.x'te "telleri de multi'ye ekle" değerlendirilir.
4. **Ctrl+A (tümünü seç) YOK** — Sprint 2.x.
5. **Bulk property editing YOK** — inspector multi paneli sadece özet, değer düzenleme yok. Parametre editing altyapısı henüz hiç yok (Sprint 2.x).
6. **Birleşik seçim çerçevesi YOK** — her bileşen kendi çerçevesinde. Sprint 2.3 sonrası tek-kutu UX.
7. **Topbar seçim sayacı YOK** — Sprint 2.4 topbar bağlamada eklenebilir.

---

## Sprint 2.x yol haritası

| Sprint | Kapsam | Bu sprint üzerine |
|---|---|---|
| 2.1 | Undo altyapı | — |
| 2.2 (BU) | Multi-select + bulk delete | `selectedIds` array + tek pushHistory |
| 2.3 | Rubber-band seçim kutusu | Kutu içine düşen id'leri `toggleComponentInSelection` ile ekle |
| 2.4 | Topbar butonları + multi-drag | `canUndo`/`canRedo` + bulk drag-position |
| 2.5 | Rotation (R tuşu) | Seçili hepsine uygula, tek undo |
| 2.6+ | Kopyala/yapıştır, LED/Switch/GND | Her handler pushHistory ile undoable |

---

## Doğrulama

- **Build:** `npm run build:v2` — ✅ 111.87 KB, 60 modül
- **v1 build:** `npm run build` — ✅ 10 ms, regression yok
- **Runtime:** Puppeteer 5 senaryo — ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel otomatik deploy (push sonrası)

---

## Notlar (Zenco)

Sprint 2.2'nin "en büyük risk" Sprint 1.1'deki `selectionId === p.id` kontrolünü unutmaktı. `selectedIds.includes(p.id)`'a geçiş 4 yerde (renderer body + label + frame + canvas prop). Hepsi değişti, build temiz, runtime doğru.

Toggle logic'inde **tek invariant**: `'multi'` en az 2 eleman. Bu invariant'ı `toggleComponentInSelection`'ın 4 dalı da koruyor — "kalan 1" ise component'a düşer. Test bunu açıkça ölçtü (case 4).

Bulk delete'te tek `pushHistory()` Sprint 2.1 altyapısıyla birebir uyumlu — Sprint 2.1 bu amacı için kuruldu. N adet undo adımı yerine 1 adım = "Figma benzeri UX".

Shift+Click boş alan davranışı (selection korumak) ilk bakışta ters geliyor — shift yoksa boş alana tıklama seçimi temizler, shift varken temizlemiyor. Ama bu Figma/Sketch davranışı: kullanıcı "bir bileşen daha eklemek istiyorum ama fareyi kaydırdım" durumunda seçim kaybolmasın. Sprint 2.3 rubber-band başlatma zamanı "shift+drag on empty" olacak; shift+click bu akışı tetiklemiyor.

Sprint 2.2 Faz 2B'nin ikinci adımı. Multi-select temelli işler (bulk rotate, bulk copy-paste) sonraki sprint'lerde direkt bu altyapı üzerine bina edilecek.
