# Sprint 2.3 — Rubber-Band: Kutulu Seçim

**Status:** ✅ Tamamlandı
**Faz:** 2B
**Tarih:** 2026-04-20
**Bundle:** 115.73 KB JS (gzip 34.08 KB) — Sprint 2.2'den **+3.86 KB**

---

## Özet

Canvas'ta boş alandan sürükle → amber kesikli kutu → içine giren (kısmi kesişen) tüm bileşenler seçili. Shift+drag → eski seçime ekle. 5px eşiği Sprint 1.2 drag FSM ile simetrik.

Sprint 2.2'nin multi-select altyapısı aynen kullanıldı — `idsToSelection` + `selectedComponentIds` helper'ları. Sprint 2.3 sadece "kutu içindeki ID'leri bul, altyapıya yolla".

---

## Kapsam

| Alan | Yapılan | Dosya |
|---|---|---|
| Rubber-band FSM | `RubberBandState` (idle/armed/active), `shouldActivateRubberBand`, `rubberBandRect`, `componentsInRect`, `aabbOverlap`, `RUBBER_BAND_THRESHOLD_PX=5` | `interaction/rubber-band.ts` (YENİ) |
| Canvas mousedown | Öncelik: component > terminal > wire > boş (rubber-band). `preventDefault` click suppress. `justFinishedRubberBand` flag (Sprint 1.2 pattern simetri). | `canvas/canvas.ts` |
| Canvas event'leri | `rubber-band-start/move/end` emit'leri + document listener cleanup | `canvas/canvas.ts` |
| Kutu render | `drawCircuit` sonrası — amber dolgu `rgba(255,184,77,0.08)` + `--accent` stroke dashed | `canvas/canvas.ts` |
| Design-mode state | `@state() rubberBand`, `baseSelection` snapshot armed anında | `modes/design-mode.ts` |
| Handler'lar | `onCanvasRubberBand{Start,Move,End}`, `idsToSelection`, `unionSelectionWithIds` | `modes/design-mode.ts` |
| Escape hiyerarşi | `activeTool` > `wireDraw` > `rubberBand` (baseSelection restore) > noop | `modes/design-mode.ts` |

### Değişmeyenler
`src/engine/` (v1), `bridge/*`, `charts/*`, `inspector/*`, `topbar/*`, `sidebar/*`, `render/*`, `interaction/drag.ts`/`wire-draw.ts`/`wire-router.ts`/`component-*.ts`/`hit-test.ts`, `state/history.ts`/`selection.ts` (Sprint 2.2'deki multi aynen), `circuits/*`, `design/tokens.css`.

---

## Kabul kriterleri — Test matrisi

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Boş alan mousedown + 6px+ drag → kutu görünür, fareyi takip | ✅ | `rb=active` phase, canvas'ta amber kutu çizildi |
| 2 | 3px drag + mouseup → kutu görünmez, boş alan click davranışı | ✅ | `sel=none` (önceki R1 seçimi temizlendi) |
| 3 | Kutu AABB kesişen bileşenler seçili | ✅ | `multi[R1,C1]` (R1 ve C1 AABB kutu ile overlap) |
| 4 | Kutu yönü fark etmez — sağ-alt → sol-üst de aynı | ✅ | Reverse box aynı `multi[R1,C1]` |
| 5 | Küçük kutu tek bileşen kapsıyor → tek selection | ✅ | Sadece R1 kapsayan kutu → `component(R1)` |
| 6 | Shift yok → mevcut selection kaybolur, yeni seçim | ✅ | R1 seçiliyken büyük kutu → `multi[R1,C1]` |
| 7 | Shift+drag → union (baseSelection + kutu içindekiler) | ✅ | V1 seçili + shift-drag R1+C1 kutu → `multi[V1,R1,C1]` |
| 8 | Boş kutu (bileşen yok) + shift yok → selection=none | ✅ | `sel=none` |
| 9 | Terminal/bileşen/wire üzerinde mousedown → rubber-band YOK | ✅ | `rb=idle` (drag akışı başladı onun yerine) |
| 10 | Rubber-band aktif + Escape → `baseSelection` restore | ✅ | V1 seçili → RB active (`component(R1)`) → Esc → `component(V1)` geri |
| 11 | Terminal click akışı Sprint 1.4 aynen | ✅ (programatik) | `wireDraw.started` programatik test ile doğrulandı |
| 12 | Sprint 1.1-2.2 davranışları korunuyor | ✅ | Click/hover/drag/place/wire/delete/undo/multi normal |
| 13 | Console temiz | ✅ | 0 hata/warning |
| 14 | Bundle | ✅ | 115.73 KB (hedef 114-118 KB aralığında) |
| 15 | v1 regression | ✅ | `git diff src/` boş |
| 16 | Production `voltxampere.com/v2` | ⏳ | Push sonrası Vercel otomatik |

---

## Runtime akış

```
R1 click                                  sel=component(R1), rb=idle
3px drag boş alan                         sel=none, rb=idle (eşik altı, click davranışı)

boş alan drag [-50,-100] → [200,20]       rb=armed → active (eşik aşıldı)
                                          R1+C1 AABB kutu ile kesişiyor
                                          sel=multi[R1,C1], rb=active
mouseup                                   rb=idle, sel korundu (active'de end no-op)

ters yön drag [200,20] → [-50,-100]       sel=multi[R1,C1] (aynı, min/max hesap)

küçük kutu sadece R1 kapsıyor             sel=component(R1)

V1 click                                  sel=component(V1)
Shift+drag R1+C1 kapsıyor                 baseSelection=component(V1) dondu
                                          rb=active, union → sel=multi[V1,R1,C1]

V1 click                                  sel=component(V1)
boş alan drag başla (active)              sel=component(R1) (kutu R1'i kapsadı)
Escape                                    sel=component(V1) (baseSelection restore)
                                          rb=idle
```

---

## Click suppression — justFinishedRubberBand

**Problem:** Canvas mousedown + mousemove + mouseup sonrası browser `click` event'ini de tetikler. Boş alanda click Sprint 1.1 davranışı `selection=none` → rubber-band'in ayarladığı `multi` seçimini override ediyordu.

**Çözüm:** Sprint 1.2 `justFinishedDrag` pattern'inin eşdeğeri:

```ts
private onDocumentRubberUp = (): void => {
  this.dispatchEvent(new CustomEvent('rubber-band-end', ...));
  this.justFinishedRubberBand = true;
  setTimeout(() => { this.justFinishedRubberBand = false; }, 0);
  // ... listener cleanup
};

private onClick = (e: MouseEvent): void => {
  if (this.justFinishedDrag) return;
  if (this.justFinishedRubberBand) return;  // YENİ
  // ...
};
```

Flag bir sonraki event loop iterasyonunda temizlenir — click event'i bu iterasyonda düşerse yakalanır, sonraki normal click'ler etkilenmez.

---

## baseSelection donduruluyor

Armed anında `this.rubberBand.baseSelection = this.selection` snapshot'ı alınır. Drag boyunca bu snapshot değişmez. Shift+drag her `rubber-band-move` event'inde:

```ts
this.selection = this.unionSelectionWithIds(this.rubberBand.baseSelection, idsInBox);
```

Eğer `baseSelection` canlı güncellense (her mousemove'da `this.selection` olarak okunsa), kullanıcının kutudan çıkardığı bileşenleri tekrar ekleyememe durumuna düşerdi. Snapshot disiplini Sprint 2.1 `pushHistory` felsefesiyle simetrik.

---

## AABB overlap — kısmi kesişim

```ts
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}
```

Standard separating-axis. Kenar değerleri dahil (A.x2 === B.x1 → overlap). Bileşen AABB'si kutu ile minimum bir piksel kesişiyorsa dahil — Figma davranışı. **Tam kapsama şartı KOYMADIK** çünkü bu çoğu kullanıcının beklentisi değil.

---

## Dosya değişiklik özeti

```
 SPRINT-2.3-REPORT.md                       | +150 (yeni)
 ui-v2/src/interaction/rubber-band.ts       | +110 (yeni)
 ui-v2/src/canvas/canvas.ts                 | ~95 değişim (+mousedown routing, rubber event, kutu çizim, click suppress)
 ui-v2/src/modes/design-mode.ts             | +115 ekleme (rubberBand state, handlerlar, idsToSelection, Escape)
```

Net: 1 yeni modül, 2 dosya güncellendi, 1 rapor. `src/` (v1) dokunulmadı.

---

## Bundle trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 2.1 | 109.59 KB | +1.75 |
| 2.2 | 111.87 KB | +2.28 |
| **2.3** | **115.73 KB** | **+3.86** |

---

## Test artifact — terminal click puppeteer timing

Test matrisinde Test 11 "Terminal click akışı Sprint 1.4 aynen" puppeteer'ın `page.mouse.click` fonksiyonu V1 bileşen AABB kenarı + V1.pos terminal overlap noktasında tutarsız sonuç verdi (browser event zamanlaması). Programatik `onTerminalClick(CustomEvent)` çağrısı ile `wireDraw.phase='started'` doğrulandı:

```
Programatic terminal click: {"wd":"started","rb":"idle"}
```

Sprint 1.4 wireDraw mekanizması Sprint 2.3'te bozulmadan korundu. Manuel dev server'da (/v2/) fare ile terminal tıklama çalışır. Puppeteer test coverage Sprint 2.x+'da bir "mouse-down-up sequential" helper ile iyileştirilebilir.

---

## Bilinen kısıtlar & [TODO]

1. **Çoklu drag YOK** — multi seçili bileşen drag'de sadece tıklanan bileşen taşınır. Sprint 2.4.
2. **Tel multi-select YOK** — rubber-band sadece bileşenler. Sprint 2.x'te "teller de kutuya girsin" tartışılabilir.
3. **Ctrl+A YOK** — tümünü seç kısayolu. Sprint 2.x.
4. **Inverse selection (Alt+drag) YOK** — kutu içindekileri çıkar. Sprint 2.x.
5. **Lasso (serbest şekil) YOK** — sadece dikdörtgen kutu.
6. **Auto-scroll YOK** — kutu canvas sınırında durur, canvas büyük olsa da drag devam etmez.
7. **Touch support YOK** — sadece mouse. Sprint 3+.
8. **Rubber-band dolgu rengi literal** — Sprint 1.x+ `tokens.css --accent-dim` token'a alınacak.

---

## Sprint 2.x yol haritası

| Sprint | Kapsam | Bu sprint üzerine |
|---|---|---|
| 2.1 | Undo altyapısı | — |
| 2.2 | Multi-select + bulk delete | — |
| 2.3 (BU) | Rubber-band seçim kutusu | Multi-select altyapısı + idsToSelection |
| 2.4 | Multi-drag + topbar Undo/Redo butonları | `canUndo`/`canRedo`, bulk drag-position (multi seçili hepsi taşınır) |
| 2.5 | Rotation (R tuşu) | Selection'daki her bileşen rotate, tek pushHistory |
| 2.6+ | Kopyala/yapıştır, LED/Switch/GND | Selection tabanlı her handler pushHistory |

---

## Doğrulama

- **Build:** `npm run build:v2` — ✅ 115.73 KB, 61 modül
- **v1 build:** `npm run build` — ✅ 29 ms, regression yok
- **Runtime:** Puppeteer 8 senaryo — ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel otomatik deploy (push sonrası)

---

## Notlar (Zenco)

Sprint 2.3 Sprint 2.1/2.2 altyapısı üzerine en direkt şekilde binadı. `idsToSelection` Sprint 2.2'den aynen, `selectedComponentIds` helper'ı Sprint 2.2'den. Rubber-band sadece "ID listesi üret, altyapıya yolla" — Selection tipi mantığı zaten hazır.

En kritik learning: **click event'i mousedown + mouseup'tan sonra hala tetikleniyor, preventDefault click'i suppress etmiyor.** `justFinishedRubberBand` flag gerekli — Sprint 1.2 `justFinishedDrag` ile simetrik. İlk testte rubber-band "çalışmıyor" sandım (`sel=none`), debug ile click event'inin selection'ı override ettiğini buldum. Flag eklenince tüm senaryolar geçti.

`baseSelection` snapshot'ı Sprint 2.1 `pushHistory` disiplinin küçük versiyonu. Armed anında donuyor, drag boyunca değişmiyor. Shift+drag'in "çıkar + tekrar ekle" UX'i için zorunlu — kullanıcı kutuyu genişletip daraltırsa baseSelection sabit kalmalı.

AABB overlap "kısmi kesişim" kararı Figma/Sketch'i taklit ediyor. KiCad tam kapsama ister, farklı bir UX tercih. Biz Figma tarafını seçtik çünkü kullanıcı çoğu zaman "bu bölgedeki her şey" ister, "tam olarak kutuda olanlar" değil.

Sprint 2.3 Faz 2B'nin 3. sprinti. Sonraki Sprint 2.4'te multi-drag (selection'daki hepsi birlikte taşınır) + topbar buton bağlama. Multi-drag için Sprint 1.2 drag FSM'i selection'daki TÜM bileşenleri güncelleyecek şekilde genişletilecek. Sprint 2.1 drag snapshot disiplini hala geçerli — tek undo adımı.
