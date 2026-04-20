# Sprint 2.4 — Topbar Undo/Redo Butonları + Multi-Drag: Faz 2B Kapanışı

**Status:** ✅ Tamamlandı · **Faz 2B tamamlandı** 🎉
**Tarih:** 2026-04-20
**Bundle:** 118.92 KB JS (gzip 34.93 KB) — Sprint 2.3'ten **+3.19 KB**

---

## Özet

Faz 2B'nin son sprint'i iki küçük ama tamamlayıcı iş:

1. **Topbar Undo/Redo butonları** — Sprint 2.1 altyapısı artık ikon-butonlarla görünür. Mod switch ile ana aksiyonlar arasına yerleşti, `canUndo`/`canRedo` ile disabled/enabled, native `title` tooltip'leriyle klavye kısayolu keşfedilebilir.
2. **Multi-drag** — 5 bileşen seçili + drag → hepsi aynı dx/dy ile taşınır. `recomputeWires`'da iki-uç fast path: her iki uç da drag grubunda olan tellerin via noktaları kaydırılır (rota şekli korunur).

v2 artık gerçek bir power-user devre editörü: **ekle / taşı / bağla / sil + undo/redo + multi-select + rubber-band + multi-drag**. Faz 2B kapandı.

---

## Kapsam

| Alan | Yapılan | Dosya |
|---|---|---|
| Topbar butonları | Undo/Redo ikon-only buton, SVG ok-geri/ileri, title="Geri Al (Ctrl+Z)" / "Yinele (Ctrl+Shift+Z)" | `topbar/topbar.ts` |
| Topbar prop | `canUndo: boolean`, `canRedo: boolean` — disabled state'i yönetir | `topbar/topbar.ts` |
| Topbar CSS | `.icon-only` sınıfı, `:disabled` opacity 0.35 + cursor not-allowed + hover kapalı | `topbar/topbar.ts` |
| Topbar emit | `onAction` [TODO] log kaldırıldı — tüm butonlar artık neutral emitter | `topbar/topbar.ts` |
| Design-mode handler | `onTopbarAction` — undo/redo → doUndo/doRedo, diğerleri log | `modes/design-mode.ts` |
| Design-mode prop | `historyCanUndo(history)` / `historyCanRedo(history)` render'da topbar'a geçer | `modes/design-mode.ts` |
| Multi-drag | `onCanvasDragPosition` selection tabanlı — drag'lenen bileşen seçim içindeyse `selectedComponentIds` hepsi dx/dy kaydırılır | `modes/design-mode.ts` |
| Fast path routing | `recomputeWires(layout, draggedIds?, dx?, dy?)` — iki ucu da drag grubunda tellerin via'ları kaydırılır, routeWire çağrısız | `modes/design-mode.ts` |

### Değişmeyenler
`src/engine/` (v1), `bridge/*`, `canvas/*`, `charts/*`, `inspector/*`, `sidebar/*`, `render/*`, `interaction/*` (drag.ts/hit-test.ts/wire-draw.ts/rubber-band.ts/component-*.ts/wire-router.ts), `state/history.ts`/`selection.ts`, `circuits/*`, `design/tokens.css`, `index.html`, `vercel.json`.

---

## Kabul kriterleri — Test matrisi

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Topbar'da Undo/Redo ikonları (mod ile Kaydet arasında) | ✅ | Render template, SVG ikonlar görünür |
| 2 | Açılışta iki buton disabled (opacity 0.35, not-allowed) | ✅ | `undoDisabled: true, redoDisabled: true` |
| 3 | R2 yerleştir → Undo enabled, Redo disabled | ✅ | `undoDisabled: false, redoDisabled: true, past=1` |
| 4 | Undo butonu tıkla → R2 kayboldu | ✅ | `!positions.find(R2) === true`, `past=0, future=1` |
| 5 | Redo butonu tıkla → R2 geri | ✅ | `positions.find(R2) === true`, `past=1, future=0` |
| 6 | Ctrl+Z / Ctrl+Shift+Z eskisi gibi | ✅ | Sprint 2.1 kısayolları korundu |
| 7 | Undo tooltip "Geri Al (Ctrl+Z)" | ✅ | `undoTitle` doğru |
| 8 | Redo tooltip "Yinele (Ctrl+Shift+Z)" | ✅ | `redoTitle` doğru |
| 9 | 3 bileşen seçili, biri drag → hepsi dx/dy | ✅ | V1(-118,16), R1(32,-64), C1(182,16) — hepsi +32/+16 |
| 10 | Selection dışı drag → sadece o bileşen | ✅ | multi[R1,V1], C1 drag → R1/V1 sabit, C1 taşındı |
| 11 | Multi-drag sonrası selection korundu | ✅ | `sel.type='multi', componentIds.length=2` |
| 12 | Multi-drag fast path (iki uç dragged → via kaydır) | ✅ (kod) | `fromIn && toIn → via.map(p=>{x+dx,y+dy})` |
| 13 | Multi-drag tek undo adımı | ✅ | `past=1` (3 bileşen taşındı ama tek snapshot) |
| 14 | Ctrl+Z tek adımda hepsi geri | ✅ | `positions restored: OK` |
| 15 | Multi-drag snap korunur (16px grid) | ✅ | Canvas drag snap'i dx/dy hesabında zaten grid katı |
| 16 | Disabled buton click noop | ✅ | `state değişmedi: OK` (past=0 iken undo click) |
| 17 | Sprint 1.1-2.3 davranışları | ✅ | Click/hover/rubber-band/select/place/wire/delete normal |
| 18 | Console temiz | ✅ | 0 hata/warning |
| 19 | Bundle | ✅ | 118.92 KB (hedef 118-122 KB aralığında) |
| 20 | v1 regression | ✅ | `git diff src/` boş |
| 21 | Production `voltxampere.com/v2` | ⏳ | Push sonrası Vercel otomatik |

---

## Multi-drag — fast path kanıtı

```typescript
// recomputeWires içinde:
if (hasFastPath && draggedSet) {
  const fromIn = wire.from.kind === 'terminal' && draggedSet.has(wire.from.componentId);
  const toIn = wire.to.kind === 'terminal' && draggedSet.has(wire.to.componentId);
  if (fromIn && toIn) {
    return {
      ...wire,
      via: (wire.via ?? []).map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
}
// Aksi halde normal routeWire çağrısı.
```

**Neden rota şekli korunur?** Multi-drag'de 3 bileşen seçili (V1, R1, C1) hep birlikte kayar. Örn. V1↔R1 teli her iki ucuyla seçim içinde — iki uç aynı dx/dy hareket eder → göreceli geometri aynı → via noktaları orijinal şekilde kaydırılır, tel "olduğu gibi" gider. Eğer `routeWire` çağrılsaydı algoritma yeni rota hesaplayabilir (L-shape → U-shape değişebilir), kullanıcı "neden tel başka yerden geçiyor?" derdi.

**Tek uç dragged** durumunda (örn. selection içinde sadece V1 var, V1↔R1 telinin R1 ucu selection dışı) smart re-route → `routeWire` çağrısı. Sprint 1.2 davranışı korunur.

---

## Runtime akış — multi-drag tek undo adımı

```
INIT                                 past=0, V1(-150,0) R1(0,-80) C1(150,0)
selection = multi[R1,V1,C1]          (programatik)

onCanvasDragPosition (R1, x=32, y=-64)
  isComponentSelected(sel, 'R1') → true
  targetIds = [R1, V1, C1]
  dx = 32 - 0 = 32, dy = -64 - (-80) = 16
  pushHistory → past=1 (TEK snapshot)
  components.map → V1(-118,16), R1(32,-64), C1(182,16)
  recomputeWires(layout, [R1,V1,C1], 32, 16)
    → her wire fromIn && toIn → via kaydır (fast path)

onCanvasDragEnd
  dragHistoryPushed = false

Cmd+Z (tek tıklama)                 past=0, future=1
  → snapshot geri yüklenir
  → V1(-150,0), R1(0,-80), C1(150,0) (hepsi orijinal)
```

**3 bileşen taşındı ama 1 undo adımı.** Sprint 2.1 `dragHistoryPushed` flag disiplini multi-drag'de birebir çalışıyor.

---

## Topbar — Undo/Redo buton reaktivitesi

```
Kullanıcı action → history değişir (past[++] veya future[++])
              ↓
         design-mode re-render (Lit @state reactive)
              ↓
    canUndo(history), canRedo(history) hesaplanır
              ↓
    topbar prop'ları güncellenir (.canUndo=, .canRedo=)
              ↓
    Buton disabled attribute'u otomatik toggle
              ↓
    CSS :disabled → opacity 0.35, cursor not-allowed
```

**State/prop zinciri Lit reactive pattern'iyle tutarlı.** Helper fonksiyonlar (`canUndo`/`canRedo`) Sprint 2.1'de saf olarak yazıldığı için test zamanı kontrolü kolay.

---

## Topbar — neden ana buton emit'i değişti?

Sprint 0.8'de `onAction` içinde `console.log('[TODO] ${id} butonu — Sprint 1.x+')` vardı. Sprint 2.4'te iki buton gerçek oldu (undo/redo), diğerleri hâlâ [TODO]. Log topbar'da kaldırıldı — design-mode tarafında tutuldu:

```typescript
// topbar.ts — her buton aynı pattern (event emit)
private onAction(id: string): void {
  this.dispatchEvent(new CustomEvent('action', { detail: { id }, bubbles: true, composed: true }));
}

// design-mode.ts — karar burada
private onTopbarAction = (e: Event): void => {
  const id = (e as CustomEvent).detail.id;
  if (id === 'undo') void this.doUndo();
  else if (id === 'redo') void this.doRedo();
  else console.log(`[TODO] ${id} butonu — Sprint 3.x+`);
};
```

Temizlik: topbar saf bir event emitter, iş mantığı design-mode'da.

---

## 🏁 Faz 2B Kapanış — Sprint 2.1-2.4 Özet Tablosu

| Sprint | Kapsam | Bundle | Δ | Yeni Dosya | Cook |
|---|---|---|---|---|---|
| 1.5 (Faz 2A son) | Silme + rebuild | 107.84 KB | — | — | — |
| 2.1 | Undo/Redo altyapı (snapshot stack, Ctrl+Z) | 109.59 KB | +1.75 | `state/history.ts` | 5m |
| 2.2 | Multi-select + bulk delete | 111.87 KB | +2.28 | — | 6m |
| 2.3 | Rubber-band seçim kutusu | 115.73 KB | +3.86 | `interaction/rubber-band.ts` | 13m |
| **2.4** | **Topbar butonları + multi-drag** | **118.92 KB** | **+3.19** | — | **?** |
| **Toplam Faz 2B** | **Power-user araçları** | **+11.08 KB** | | **2 yeni modül** | |

### Faz 2B'de Elde Edilenler

- ✅ **Undo/Redo** — keyboard (Ctrl/Cmd+Z, Shift+Z, Y) + topbar butonları + tooltip + disabled state
- ✅ **Multi-select** — Shift+Click toggle, 'multi' selection tipi, `isComponentSelected` helper
- ✅ **Rubber-band** — 5px eşik, AABB overlap, Shift+drag union, baseSelection snapshot, Escape iptal
- ✅ **Bulk delete** — multi seçili + Delete → tek undo adımı, orphan node cleanup
- ✅ **Multi-drag** — selection hepsi dx/dy, fast path (iki uç dragged → via kaydır), tek undo adımı
- ✅ **Inspector** — tek bileşen, tel, çoklu seçim panelleri ayrı
- ✅ **Canvas render** — her seçili bileşen kendi amber çerçevesinde, rubber-band kutu çizimi

### Faz 2B [TODO] (Sprint 2.x+)

1. Ctrl+A (tümünü seç) — `selection = multi(tümBileşenler)`
2. Alt+drag inverse selection (kutu içindekileri çıkar)
3. Tel multi-select (şu an sadece bileşen)
4. Kopyala/yapıştır (Ctrl+C, Ctrl+V)
5. Undo sonrası "re-select if still exists" (şu an always none)
6. Custom tooltip komponenti (native yerine)
7. Topbar seçim sayacı ("3 seçili")
8. Rezerve node isim cleanup (Sprint 1.5 TODO aynen)

---

## Sonraki Yönler

Faz 2B kapandı. İki olası yön:

**Faz 2C — Bileşen zenginliği:**
- LED, Switch, GND sembolleri (sidebar tool'ları zaten hazır)
- Rotation (R tuşu) — selection'daki her bileşen rotate, tek undo
- Yeni bileşen tiplerinin engine desteği

**Faz 2C-alt — I/O:**
- Kaydet/Aç/SPICE export — 15 [TODO]'nun 3'ü gerçek olur
- JSON serialization, localStorage veya dosya

**Faz 3 — v1→v2 swap:**
- Ana path'te v2, v1 arşive
- Keşfet/Güç mod geçişleri

Şef kararı bekleniyor.

---

## Dosya değişiklik özeti

```
 SPRINT-2.4-REPORT.md                 | +180 (yeni)
 ui-v2/src/topbar/topbar.ts           | ~75 değişim (canUndo/canRedo prop + 2 buton + CSS)
 ui-v2/src/modes/design-mode.ts       | ~70 değişim (onTopbarAction, canUndo/Redo import/prop, multi-drag, fast path)
```

Net: 2 dosya güncellendi, 1 rapor. `src/` (v1) dokunulmadı.

---

## Doğrulama

- **Build:** `npm run build:v2` — ✅ 118.92 KB, 61 modül
- **v1 build:** `npm run build` — ✅ 29 ms, regression yok
- **Runtime:** Puppeteer 6 senaryo — ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel otomatik deploy (push sonrası)

---

## Notlar (Zenco)

Sprint 2.4 Faz 2B'nin **en küçük** sprinti — iki glue iş. Altyapı Sprint 2.1-2.3'te zaten kuruldu; 2.4 sadece kullanıcı görür yüze taşıdı.

**Topbar bağlantısı** Sprint 2.1'in helper'larını (`canUndo`/`canRedo`) kullandı — sıfır yeni matematik. Buton render'ı CSS + SVG. Tooltip native `title` — özel komponentsiz.

**Multi-drag'in kritik detayı `isComponentSelected` kontrolü.** Selection dışı bileşene tıklayıp drag başlatıyor → sadece o taşınır, seçim aynen. Figma'da aksine selection sıfırlanır + o bileşen seçilir + taşınır; biz "selection'a zarar verme" tarafını seçtik. İleride bu davranışı değiştirmek isterseniz tek satır.

**Fast path'in kalite katkısı performanstan çok rota korunumu.** 3-bileşen multi-drag'inde tüm tellerin her iki ucu selection içinde → fast path hepsini kaydırır, `routeWire` hiç çağrılmaz. Kullanıcı için "tel olduğu gibi hareket etti" hissi — algoritma re-routing'i (L↔U shape değişimi) görsel olarak rahatsız ederdi.

Sprint 2.1'in `dragHistoryPushed` flag'i multi-drag'de otomatik çalıştı — hiç değişmedi. Tek `pushHistory` çağrısı handler başında, multi-drag veya solo-drag fark etmez. Sprint 2.1 altyapısının doğru tasarlandığının kanıtı.

**Faz 2B kapandı.** v2 artık gerçek bir interaktif devre editörü — Figma benzeri power-user araçlarıyla donatılmış. Sprint 2.5+'da bileşen çeşitliliği (LED/Switch/GND) veya I/O (kaydet/aç/SPICE) seçimi. Her ikisi de Sprint 2.1 altyapısıyla otomatik undoable olacak.
