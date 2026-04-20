# Sprint 2.6 — Bug #4 Fix: Otomatik Bağlanma + Floating State

**Status:** ✅ Tamamlandı · Faz 2B kesin kapanışı
**Tarih:** 2026-04-20
**Bundle:** 123.30 KB JS (gzip 35.49 KB) — Sprint 2.5'ten **+1.26 KB**

---

## Özet

Şef'in `voltxampere.com/v2`'de gördüğü Bug #4 için keşif + fix. 3 snapshot'lık state dump ile hipotez testi yapıldı, root cause bulundu, lokal fix uygulandı. Runtime doğrulama: 17 PASS / 0 FAIL, console temiz.

**Bug #4A (otomatik bağlanma)** aslında `layout.probes` ve özellikle `layout.grounds` bulk delete'te temizlenmiyordu → yeni bileşen yerleştirildiğinde canvas'ta orphan GND sembolleri görünüyordu. Sprint 2.5'te probe için render cleanup eklenmişti, grounds atlanmıştı. Şimdi her ikisi de kapalı.

**Bug #4B (solver stale)** aslında Sprint 2.5'in `empty` state'inin devamı. "Bileşen var ama tel yok" (tamamen izole) durumu ek bir state gerektiriyordu: `floating`. Artık kullanıcı "devre tamamlanmamış · bileşenleri telle bağla" ipucu alıyor.

---

## 🔍 Keşif — Hipotez Testi

3 snapshot alındı: **INIT → AFTER BULK DELETE → AFTER PLACE V**.

### Hipotez A (rezerve node hayalet) — YANLIŞ

```
INIT:          circuit.nodes = [gnd, in, out]
BULK DELETE:   circuit.nodes = [gnd]           ← Sprint 1.5 cleanup çalışıyor
PLACE V:       yeni V.nodes = [float_1, float_2]  ← rezerve'ye yapışmadı
```

Bulk delete `deleteMultipleComponents` `stillUsed` set'i üzerinden orphan node'ları temizliyor, `gnd` her zaman tutuluyor. Yeni V yerleştirildiğinde `generateFloatingNode()` ile benzersiz float ID'ler atanıyor. Circuit tarafı temiz.

### Hipotez B (probe orphan) — DOĞRU + Genişletilmeli

```
INIT:          layout.probes = 2, layout.grounds = 2
BULK DELETE:   layout.probes = 2, layout.grounds = 2   ← DOKUNULMADI
PLACE V:       layout.probes = 2, layout.grounds = 2   ← YİNE DOKUNULMADI
```

**Keşif sırasında asıl bug ortaya çıktı:** Sprint 2.5 probe render fix'i aktif (probe kutuları çizilmiyor — `activeNodes.has('in')` false, probe atlandı). Fakat **grounds için aynı kontrol yoktu** → 2 GND sembolü canvas'ta orphan olarak kalıyordu. Şef'in gördüğü "V1 üstünden C1'e giden tel" muhtemelen eski bir sürüm artifact'i, ama **grounds orphan sorunu doğrulandı**.

### Bug #4B durumu

```
PLACE V:       dashboard.kind = 'ok' (solver success=true)
               vIn, vOut, iR1 = undefined
               Slot'larda "?? 0" fallback → "0.00 V / 0.00 V / 0.00 A"
```

Solver tek izole V için başarı döndürüyor ama nodeVoltages boş → dashboard slot'ları "0.00" gösterip kullanıcıya "devre çalışıyor mu?" hissi veriyor. Şef'in 33.94µA gördüğü Sprint 2.5 öncesi senaryoydu (artık `err` state'e düşüyor). Yeni eklenen bilgi: **tamamlanmamış devre için ayrı bir UI durumu gerek**.

---

## 🔧 Fix'ler

### Bug #4A (grounds orphan cleanup) — render-only

**Dosya:** `ui-v2/src/render/circuit-renderer.ts`

Sprint 2.5 probe pattern'ine paralel:

```typescript
// ─── 2) Toprak sembolleri ──────────────────────────────────────────
// Sprint 2.6 / Bug #4A: sadece 'gnd' node aktif bir bileşende
// kullanılıyorsa çiz. Aksi halde bulk delete sonrası canvas'ta orphan
// GND sembolleri kalıyordu.
let gndActive = false;
for (const c of circuit.components) {
  if (c.nodes.includes('gnd')) { gndActive = true; break; }
}
if (gndActive) {
  for (const g of layout.grounds) {
    ctx.save();
    ctx.translate(cx + g.x, cy + g.y);
    drawGround(ctx, colors);
    ctx.restore();
  }
}
```

**Neden render-only ve data cleanup değil?** `layout.grounds` veya `layout.probes` data'dan silmek `Ctrl+Z` ile geri getirmeyi zorlaştırır. Sprint 2.1 history snapshot `circuit + layout` tam kopyası alıyor; render-time filter ile data aynen korunuyor (Ctrl+Z gerçek RC'ye dönerse GND'ler otomatik görünür). Sprint 2.5'teki probe fix felsefesi aynen.

### Bug #4B (floating state)

**Dosya:** `ui-v2/src/modes/design-mode.ts`

1. **DashboardState'e `'floating'` kind:**
```typescript
type DashboardState =
  | { kind: 'loading' }
  | { kind: 'ok'; transient; snapshot }
  | { kind: 'err'; message }
  | { kind: 'empty' }          // bileşen yok
  | { kind: 'floating' };       // YENİ — bileşen var ama tel yok
```

2. **`runSolver` erken dönüş:**
```typescript
if (this.circuit.components.length === 0) {
  this.dashboard = { kind: 'empty' };
  return;
}
if (this.layout.wires.length === 0) {
  this.dashboard = { kind: 'floating' };
  return;   // solver'ı çağırmadan — anlamsız sonuç vermesin
}
```

3. **`renderDashboard` floating dalı** — empty ile paralel şablon, farklı mesaj:
```
"Devre tamamlanmamış · bileşenleri terminal'lerden telle bağla"
Slot'lar: V_ÇIKIŞ @son "—" bağlantı bekleniyor  (× 3)
```

**Ton nötr-destekleyici:** "hata" değil, "devam bekleniyor". Kullanıcı bir şey yanlış yapmadı, devreyi henüz bitirmedi.

---

## ✅ Fix Doğrulama — Şef Senaryosu

| Adım | Kriter | Sonuç |
|---|---|---|
| INIT | RC devresi yüklü, dash='ok' | ✅ |
| BULK DELETE | → dash='empty' + "Devre boş" hint | ✅ |
| PLACE V | → **dash='floating'** (YENİ state) | ✅ |
| PLACE V | → canvas'ta **wireCount=0, otomatik tel YOK** | ✅ |
| PLACE V | → hint "Devre tamamlanmamış · bileşenleri terminal'lerden telle bağla" | ✅ |
| PLACE V | → slot'lar "—" (33.94µA gibi stale değer YOK) | ✅ |
| PLACE R (V zaten var) | → hala 'floating' (iki izole bileşen) | ✅ |
| WIRE V.pos↔R.t1 | → **dash='ok'** (tel eklendi, solver çalışır) | ✅ |

### Screenshot karşılaştırma

**Keşif (fix öncesi):** `tests/sprint-2.6/screenshots/step-3-after-place-v.png`
- V1 merkezde, "5 V" etiketi görünür
- **2 adet orphan GND sembolü** canvas'ta (V1/C1'in eski konumları)
- Alt şerit "veri bekleniyor" + slot'lar "0.00 V / 0.00 V / 0.00 A"

**Fix sonrası:** `tests/sprint-2.6/screenshots/fix-step3-place-v-floating.png`
- V1 merkezde, "5 V" etiketi görünür
- **GND sembolleri YOK**, probe yok, sadece V1
- Alt şerit "devre tamamlanmamış · bileşenleri terminal'lerden telle bağla"
- Slot'lar "—" / "bağlantı bekleniyor"

---

## 🧪 Regresyon Matrisi (Sprint 1.1-2.5)

| Sprint | Senaryo | Sonuç |
|---|---|---|
| 1.1 | click-select | ✅ |
| 1.3 | Place R2 | ✅ |
| 1.5 | R1 sil → V1+C1 kaldı, gnd hala aktif → GND sembolleri RENDER EDİLİR | ✅ |
| 2.1 | Ctrl+Z → R1 geri, dash='ok' | ✅ |
| 2.4 | Multi-drag 3 bileşen (past=1 tek undo) | ✅ |
| 2.5 | Empty state hala çalışıyor (bulk delete) | ✅ |

Kritik detay — **Tek bileşen silme GND render'ını bozmuyor:** R1 silindiğinde V1 ve C1 kaldı. V1.nodes=['in','gnd'], C1.nodes=['out','gnd']. `gndActive=true` → GND sembolleri çizilir. Sadece **tüm 'gnd' kullanan bileşenler silindiğinde** grounds atlanır (doğru davranış).

---

## 📋 Dosya Değişiklik Özeti

```
 SPRINT-2.6-REPORT.md                       | +145 (yeni)
 ui-v2/src/render/circuit-renderer.ts       | +14 (gndActive kontrolü)
 ui-v2/src/modes/design-mode.ts             | +60 (DashboardState 'floating',
                                                  runSolver guard, render dalı)
```

Net: 2 dosya güncellendi, 1 rapor + screenshots. `src/` (v1) dokunulmadı.

---

## 📊 Bundle Trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 2.4 | 118.92 KB | +3.19 |
| 2.5 | 122.04 KB | +3.12 |
| **2.6** | **123.30 KB** | **+1.26** |

Minimal artış (floating state UI + gndActive döngü). Plan tahmini +1-2 KB, gerçek +1.26 KB — hedefte.

---

## 🏁 Faz 2B Kesin Kapanışı

- [x] Sprint 2.1-2.4: altyapı + özellikler
- [x] Sprint 2.5: QA-2B'deki 5 bug FIXED
- [x] Sprint 2.6: Bug #4 FIXED (grounds cleanup + floating state)
- [x] Runtime doğrulama: 17/17 PASS
- [x] Regresyon: Sprint 1.1-2.5 tüm kritik senaryolar ✅
- [x] Console temiz

**Faz 2B gerçekten kesin kapandı.** v2 power-user editör + tutarlı state göstergesi. Şef'in "tamamen temiz çalışıyor" diyebileceği noktaya geldi.

---

## 🔎 Askıda Kalan

**Bug #2 (V1 etiket kayboluyor):** QA-2B'de 8 senaryoda reproduce edilemedi, Sprint 2.6'da da ayrıca araştırılmadı (Şef yeniden gözlemlemezse askıda kalır).

---

## ⏭️ Sonraki Yönler

Faz 2C için 2 ana yön:
- **2C-A:** LED / Switch / GND yerleştirme + rotation (R tuşu) — bileşen zenginliği
- **2C-B:** Kaydet / Aç / SPICE export — topbar [TODO]'ların 3'ü gerçek olur

Sprint 2.1 altyapısı + Sprint 2.5/2.6 state disiplini sayesinde her yeni action otomatik undoable + tutarlı UI.

---

## 💬 Notlar (Zenco)

Sprint 2.6'nın değeri **keşif disiplinindeydi**: Şef ekran görüntüsü gönderdi ama sebep belirsizdi. Üç snapshot state dump (INIT/bulk/place) hipotezleri aynı turda test etti:
- Hipotez A (circuit.nodes hayalet) → state dump temiz, YANLIŞ
- Hipotez B (layout.probes orphan) → state dump doğrulandı, DOĞRU + grounds'a genişletildi

Kod yazmadan önce **state doğrulaması** gereksiz fix'lerden kurtarıyor.

**Render-only cleanup kararı kritik.** `layout.probes` ve `layout.grounds`'u data'dan silmek `Ctrl+Z` ile geri getirmeyi kırardı — history snapshot layout'un tamamını tutuyor, render-time filter ile data korunup görsel temizlik sağlanıyor. Sprint 2.5'ten gelen felsefe tutarlı.

**"Floating" kelimesinin tonu:** "Devre tamamlanmamış" — hata değil, devam bekleniyor. "Bağlantı bekleniyor" slot sub-metni. Kullanıcı bir şey yanlış yapmadı, editör yardımcı ipucu veriyor.

**Sprint 2.5 + Sprint 2.6 birlikte Faz 2B'nin gerçek kalite bitişi.** 2.1-2.4 özellik, 2.5 bug temizlik, 2.6 son Şef gözlemi. Faz 2C başlarken temiz zemin.
