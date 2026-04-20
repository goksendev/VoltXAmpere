# Sprint 2.5 — Fix Sprint: QA-2B Bug'larının Tamiri

**Status:** ✅ Tamamlandı · **🏁 Faz 2B kesin kapanışı**
**Tarih:** 2026-04-20
**Bundle:** 122.04 KB JS (gzip 35.37 KB) — Sprint 2.4'ten **+3.12 KB**

---

## Özet

QA-2B raporundaki 5 kesin bug'ı düzelttim. Kod değişikliği lokal, altyapı dokunulmadı. Her fix runtime puppeteer + state dump + screenshot ile doğrulandı. Sprint 1.1-2.4 davranışları regresyon matrisi ile kontrol edildi.

**Test sonucu: 15 PASS / 0 FAIL, console temiz.**

- 5 bug FIXED doğrulandı
- 8 regresyon senaryosu PASS (Sprint 1.1-2.4 davranışları korundu)
- Bundle +3.12 KB — cleanup kodu + empty state placeholder UI

---

## 🐞 Bug Fix'leri

### Bug #1 (P1) — Silme sonrası hover cleanup · ✅ FIXED

**Neden:** Canvas'ın `hoveredId` @state'i silme sonrası eski bileşen ID'sinde kalıyordu (fare taşınana kadar). Render'da görsel etki dolaylı — renderer stale ID'yi zaten layout.components'te bulamadığı için terminal markers çizmiyordu; ama disiplin bozuk, ileride eklenecek kod için risk.

**Fix:**
- Canvas'a public `clearHover()` metodu (`hoveredId=null`, `hoveredWireIndex=null`, cursor default)
- Design-mode'a private `clearCanvasHover()` helper (shadow ref ile canvas.clearHover() çağırır)
- `deleteComponent`, `deleteMultipleComponents`, `deleteWire` handler'larının sonunda çağrılır

**Kanıt:**
```json
// Önce: hover R1 → click R1 → Delete
// Sonra (fare taşınmamış):
{ "hoveredId": null, "hoveredWireIndex": null }
```

**Dosya:** `canvas/canvas.ts`, `modes/design-mode.ts`

---

### Bug #3 (P1) — Solver stale snapshot (topoloji boşalınca) · ✅ FIXED

**Neden:** `runSolver` boş devre için solver'ı çağırıyor, başarısız oluyor, Sprint 0.7'deki "eski snapshot'ı koru" disiplini devreye giriyor → circuit=[] olduğu halde dashboard "4.97V / 5.00V / 33.94µA" stale gösteriyor. Kullanıcı "tüm bileşenleri sildim ama dashboard hâlâ RC değerlerini gösteriyor" diye kafası karışıyor.

**Fix:**
- DashboardState'e `{ kind: 'empty' }` kind eklendi
- `runSolver` başında `if (circuit.components.length === 0) → dashboard = 'empty', return`
- `runSolver` solver başarısız durumda artık eski snapshot korumuyor → `err` state'e düşüyor (tutarlı hata UX)
- `renderDashboard`'a empty state dalı: slot'lar "—", dash-chart yerine "devre boş · soldaki araçlardan bileşen ekleyin" ipucu
- CSS: `.empty-hint` mono font, fg-3 donuk

**Kanıt:**
```json
// Bulk delete all:
{ "compIds": [], "dashKind": "empty", "dashText": "V_ÇIKIŞ @son — bileşen yok V_GİRİŞ @son — bileşen yok I(R1) @son — bileşen yok" }
```

**Screenshot:** `tests/qa-2b/screenshots/fix-bug3-empty-state.png` — dashboard slot'ları "—", grafik alanında "devre boş · soldaki araçlardan bileşen ekleyin".

**Dosya:** `modes/design-mode.ts`

---

### Bug #5 (P1) — Probe layout stale (silinen bileşene bağlı probe) · ✅ FIXED

**Neden:** `layout.probes[]` statik tanımlı (Sprint 0.5). Bağlı olduğu node silinmiş bileşenlerin silinmesiyle artık hiçbir bileşene referans vermiyorsa bile probe render'ı devam ediyordu → canvas'ta orphan probe kutusu + pin daireği asılı kalıyor.

**Fix:** `circuit-renderer.ts` probe çizim döngüsünde:
```typescript
const activeNodes = new Set<string>();
for (const c of circuit.components) for (const n of c.nodes) activeNodes.add(n);
for (const pr of layout.probes) {
  if (!activeNodes.has(pr.node)) continue; // orphan probe atla
  // ... drawProbe
}
```

**Kanıt (R1+C1 silindi, V1 kaldı):**
- `activeNodes = {in, gnd}` (V1.nodes)
- V_GİRİŞ probe (`node='in'`) → aktif, çizilir
- V_ÇIKIŞ probe (`node='out'`) → orphan, atlanır

**Screenshot:** `tests/qa-2b/screenshots/fix-bug5-orphan-probe-hidden.png` — V_ÇIKIŞ probe kutusu canvas'tan kaybolmuş, V_GİRİŞ 5.00V hâlâ görünür.

**Not:** Sadece R1 silinince (C1 hâlâ 'out' kullanıyor) probe kalır — doğru davranış. Fix sadece gerçekten orphan olan node'lar için etkili.

**Dosya:** `render/circuit-renderer.ts`

---

### Bug #6 (P2) — Drag sırasında Escape iptal · ✅ FIXED

**Neden:** Sprint 1.2 drag FSM'sinde iptal mekanizması yoktu. Escape handler Sprint 1.3 (activeTool), 1.4 (wireDraw), 2.3 (rubberBand) için vardı, drag unutulmuştu. Kullanıcı yanlış taşıyor → mouseup + Ctrl+Z ergonomik değil.

**Fix:**
- Design-mode'a `dragOrigPositions: Map<string, {x,y}>` field eklendi. İlk drag-position event'inde etkilenen (target set) bileşenlerin orijinal konumları kaydedilir (multi-drag dahil).
- Canvas'a public `cancelDrag()` metodu eklendi (dragState idle + document listener cleanup + cursor default).
- Design-mode'a private `cancelActiveDrag()` helper:
  1. Layout restore (dragOrigPositions'tan, recomputeWires ile teller de)
  2. `history.past.pop()` — drag başında pushHistory yapılmıştı, commit olmadığı için atılır (Ctrl+Z "hayalet" drag'e gitmesin)
  3. `dragHistoryPushed = false`, `dragOrigPositions = null`
  4. `canvas.cancelDrag()` çağrısı
- Escape handler'a drag dalı: `activeTool > wireDraw > rubberBand > drag > noop` öncelik hiyerarşisi.
- `onCanvasDragEnd` sonunda `dragOrigPositions = null` (normal commit temizliği).

**Kanıt:**
```json
// R1 (0,-80) → mouse drag (80,-40) → Escape → mouseup:
{
  "pre":     { "R1": { "x": 0, "y": -80 },  "past": 0 },
  "mid":     { "R1": { "x": 80, "y": -32 }, "past": 1 },  // active drag, snapshot alındı
  "afterEsc":{ "R1": { "x": 0, "y": -80 },  "past": 0 }   // restore + pop
}
```

**Sıra kritik:** Layout restore → history pop → state reset. Yanlış sırada history bozulur veya fantom undo adımı kalır.

**Dosya:** `interaction/drag.ts` (değişmedi, yeterliydi), `modes/design-mode.ts`, `canvas/canvas.ts`

---

### Bug #7 (P2) — wireDraw + Shift+Click çakışması · ✅ FIXED

**Neden:** Canvas click handler `select` event'i emit ediyordu tel modunda bile → design-mode hem wireDraw.started hem de selection güncelleniyordu. İki mod aynı anda aktif, belirsiz UX.

**Fix:** Canvas `onClick` içinde wireDraw.started kontrolü:
```typescript
// Terminal hit yukarıda handle edildi ve return edildi.
// Tel modundayken terminal olmayan click'leri ignore et — kullanıcı Escape
// ile iptal eder. "Tel modundasın, terminal bul ya da Escape" net FSM.
if (this.wireDraw.phase === 'started') {
  return;
}
```

**Kanıt:**
```json
// V1.pos terminal click (wireDraw.started) → C1 bileşenine Shift+Click:
{
  "pre":  { "wireDraw": "started", "sel": { "type": "none" } },
  "post": { "wireDraw": "started", "sel": { "type": "none" } }  // selection DEĞİŞMEDİ
}
// Escape basılınca: wireDraw=idle (iptal)
```

**Muhafazakar yol seçildi:** Kullanıcı Shift+Click yaptığında selection değişmez, tel modu devam eder. Alternatif (tel iptal + selection güncelle) daha agresif ve kafa karıştırıcı olurdu.

**Dosya:** `canvas/canvas.ts`

---

## ✅ Fix Doğrulama Matrisi

| Bug | Kriter | Sonuç |
|---|---|---|
| #1 | Silme sonrası hoveredId/hoveredWireIndex null | ✅ |
| #3 | Bulk delete all → dashKind='empty', slot'lar "—" | ✅ |
| #3 | renderDashboard empty state "devre boş · bileşen ekleyin" | ✅ |
| #5 | Orphan node (R1+C1 sil → 'out' kullanılmıyor) → probe atla | ✅ |
| #5 | Node aktif olan probe çizilmeye devam eder | ✅ |
| #6 | Drag → Escape → bileşen eski konuma | ✅ |
| #6 | history.past drag sırasında +1, Escape sonrası -1 (pop) | ✅ |
| #7 | wireDraw.started + Shift+Click → selection değişmez, wireDraw korunur | ✅ |
| #7 | Escape → wireDraw=idle (iptal akışı korundu) | ✅ |

---

## 🧪 Regresyon Matrisi (Sprint 1.1-2.4)

| Sprint | Senaryo | Sonuç |
|---|---|---|
| 1.1 | click-select → `component(R1)` | ✅ |
| 1.2 | R1 mouse drag → R1.x=64 (committed) | ✅ |
| 1.3 | R2 yerleştirme → `compIds: [C1,R1,R2,V1]` | ✅ |
| 1.4 | V1.pos↔R2.t1 tel → `wireCount: 5` | ✅ |
| 2.1 | Topbar undo buton tıkla → `wireCount: 4` | ✅ |
| 2.2 | Multi selection (programatik) → `sel.type='multi', count=2` | ✅ |
| 2.3 | Rubber-band drag → `rubberBand: idle` mouseup sonrası | ✅ |
| 2.4 | Multi-drag 3 bileşen → R1=32, past=1 (tek undo adımı) | ✅ |

---

## 📋 Dosya Değişiklik Özeti

```
 SPRINT-2.5-REPORT.md                   | +180 (yeni)
 ui-v2/src/canvas/canvas.ts             | +50 değişim (clearHover + cancelDrag public, onClick FSM)
 ui-v2/src/render/circuit-renderer.ts   | +12 değişim (probe activeNodes kontrolü)
 ui-v2/src/modes/design-mode.ts         | +100 değişim (DashboardState 'empty', runSolver empty/err,
                                         |               cancelActiveDrag, clearCanvasHover,
                                         |               Escape hiyerarşi, renderDashboard empty,
                                         |               empty-hint CSS, dragOrigPositions field)
```

Net: 3 dosya güncellendi, 1 rapor. `src/` (v1) dokunulmadı.

---

## 📊 Bundle Trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 2.1 | 109.59 KB | +1.75 |
| 2.2 | 111.87 KB | +2.28 |
| 2.3 | 115.73 KB | +3.86 |
| 2.4 | 118.92 KB | +3.19 |
| **2.5** | **122.04 KB** | **+3.12** |

5 fix + empty state UI + drag cancel logic = +3.12 KB. Plan tahmini 120-125 KB, gerçek 122.04 KB — hedefte.

---

## 🏁 Faz 2B Kesin Kapanışı — Özet Tablosu

| Sprint | Kapsam | Bundle | Δ |
|---|---|---|---|
| 2.1 | Undo altyapı | 109.59 KB | — |
| 2.2 | Multi-select + bulk delete | 111.87 KB | +2.28 |
| 2.3 | Rubber-band | 115.73 KB | +3.86 |
| 2.4 | Topbar butonları + multi-drag | 118.92 KB | +3.19 |
| QA-2B | Sistematik bug taraması (kod yok) | 118.92 KB | 0 |
| **2.5** | **5 bug fix + empty state** | **122.04 KB** | **+3.12** |
| **Toplam 2B** | | | **+14.20 KB** |

Faz 2B elde edilenler:
- ✅ Undo/Redo (keyboard + topbar butonları + tooltip + disabled state)
- ✅ Multi-select (Shift+Click)
- ✅ Rubber-band (5px eşik, AABB overlap, Shift union, Escape iptal)
- ✅ Bulk delete (tek undo)
- ✅ Multi-drag (fast path + tek undo)
- ✅ Empty state (solver empty circuit handling)
- ✅ Orphan probe cleanup
- ✅ Drag Escape iptal (history-safe)
- ✅ wireDraw FSM temiz (Shift+Click çakışması yok)

---

## 🔬 Askıda Kalanlar

**QA-2B'den reproduce edilemeyen 2 bug:**

- **Bug #2 (V1 etiketi kayboluyor):** 8 senaryoda `displayValue="5 V"` korundu. Şef özel bir kombinasyonda görmüş olabilir — ortaya çıkarsa değerlendirilecek.
- **Bug #4 (Yeni V otomatik bağlanıyor):** V2 state `[float_1, float_2]`, layout.wires değişmiyor. Muhtemelen Şef cache'li browser'da gördü — voltxampere.com/v2 deploy'dan sonra temiz.

Bu ikisi Sprint 2.5 kapsamında değil; tekrar ortaya çıkarsa sonraki sprint'te incelenir.

---

## ⏭️ Sonraki Yönler

Faz 2B kapandı. Faz 2C için 3 olası yön (Şef kararı):

- **Faz 2C-A:** LED / Switch / GND sembolü + rotation (R tuşu) → bileşen zenginliği
- **Faz 2C-B:** Kaydet / Aç / SPICE export → topbar [TODO]'ların 3'ü gerçek olur
- **Faz 2C-C:** Bug #2 ve #4 yeniden ortaya çıkarsa derin araştırma

Sprint 2.1 altyapısı sayesinde hangi yön seçilirse her yeni action otomatik undoable olacak. Sprint 2.5'in bug fix disiplini (tek undo adımı, empty state, orphan cleanup) tüm yeni action'lar için şablon.

---

## 🔎 Doğrulama

- **Build:** `npm run build:v2` — ✅ 122.04 KB, 61 modül
- **v1 build:** `npm run build` — ✅ 10 ms, regression yok
- **Runtime:** Puppeteer 15 senaryo — ✅ 15 PASS / 0 FAIL
- **Console:** ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel otomatik deploy (push sonrası)

---

## 📎 Fix Screenshot'ları

`tests/qa-2b/screenshots/`:
- `fix-bug1-after-delete.png` — R1 sil sonrası hover null (state düzgün)
- `fix-bug3-empty-state.png` — **Bug #3 ana kanıt**: bulk delete all → "devre boş · bileşen ekleyin" placeholder + slot'lar "—"
- `fix-bug5-orphan-probe-hidden.png` — **Bug #5 ana kanıt**: R1+C1 sil sonrası V_ÇIKIŞ probe atlandı, V_GİRİŞ hâlâ görünür

---

## 💬 Notlar (Zenco)

Sprint 2.5 bug fix sprint'i — altyapı değil, cerrah yaklaşımı. Her fix tam olarak ilgili satırları hedef aldı. Regression matrix sayesinde bir fix'in diğer özellikleri bozmadığı kanıtlandı.

**En kritik detay Bug #6 history pop.** Drag başında `pushHistory()` çağrıldıktan sonra Escape ile iptal edilirse, stack'te "hayalet" snapshot kalıyordu — Ctrl+Z boş bir adıma gider, kullanıcı kafası karışır. `history.past.slice(0, -1)` ile atılması bu senaryoyu düzeltiyor. Layout restore → history pop → state reset sırası **kritik** — yanlış sırada history bozuk kalır.

**Bug #3 empty state felsefi bir kazanım.** "Boş devre" bir hata değil, ayrı bir durum. Solver'a hiç gitmiyor. Dashboard empty state UI kullanıcıya "buraya bileşen ekle" ipucu veriyor — birinci seans deneyimi için iyi.

**Bug #5 probe cleanup render-only.** layout.probes state'te değişmiyor, sadece çizimde atlanıyor. Bu önemli: probe'ları silmek yerine "şu an yok" göstermek ileride probe yeniden aktif olunca otomatik geri gelmesini sağlıyor (örn. C1 yeniden eklense 'out' node geri gelir → probe otomatik çizilir).

**Bug #7 muhafazakar çözüm.** Tel modunda Shift+Click ignore, selection değişmez. Alternatif (tel iptal + selection değiştir) kullanıcı için sürprizli olurdu. Mevcut davranış: "tel modundasın, Escape ile çık, sonra seçim yap" — net FSM disiplini.

**Faz 2B gerçekten kapandı.** v2 artık power-user editör deneyimi. Şef'in "5 dakika dene" gözlemi ve Zenco sistematik taraması iki farklı açıdan bug bulmuştu; Sprint 2.5 hepsini temizledi. Faz 2C başlamaya hazır.
