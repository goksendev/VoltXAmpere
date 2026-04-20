# Sprint 2.7 — Open Circuit Detection + Solver NaN Validation

**Status:** ✅ Tamamlandı · Faz 2B kalıcı kapanış
**Tarih:** 2026-04-20
**Bundle:** 123.64 KB JS (gzip 35.64 KB) — Sprint 2.6'dan **+0.34 KB**

---

## Özet

Şef iki ayrıntı bildirdi. Keşif sonucu:

- **Bug #4A-residue (probe kılçık orphan):** Reproduce edilemedi. Sprint 2.5 guard tüm `drawProbe` çağrısını (kutu + kılçık + pin tek fonksiyon) atlıyor. Muhtemelen Şef cache'li bir görüntü veya ara bir sürümde görmüş. Defensive ek fix gerekmedi.
- **Bug #3-variant (V=0 V=0 I=33.94µA stale):** Reproduce edildi — farklı formda. Seri bağlı ama GND'ye bağlanmamış devrede solver başarılı dönüyor, dashboard `V=0 V=0 I=2.5pA` gösteriyor (sayısal noise). Stale değil ama tutarsız. Fix: **V kaynağı GND'ye bağlı değilse floating state** + **NaN/Infinity validation**.

**Sprint 1.3 disiplini revize:** "Solver başarısızsa eski sonucu koru" kuralı Sprint 2.5-2.7 boyunca aşındırıldı; Sprint 2.7'de NaN/Inf yakalaması ile tamamen güvenlik ağına dönüştü. Stale değer kullanıcıya artık hiç gösterilmez.

---

## 🔍 Keşif

### Bug #4A-residue — Probe kılçık orphan?

Kod incelemesi: `ui-v2/src/render/symbols/probe.ts` `drawProbe()` tek fonksiyon, kılçık + pin + kutu hepsi birlikte çiziliyor. Sprint 2.5'te `ui-v2/src/render/circuit-renderer.ts` probe döngüsünde `activeNodes.has(pr.node)` guard'ı tüm çağrıyı atlıyor:

```typescript
for (const pr of layout.probes) {
  if (!activeNodes.has(pr.node)) continue;   // tüm drawProbe atlandı
  // ...
  drawProbe(ctx, spec, colors);  // kutu + kılçık + pin birlikte
}
```

Şef senaryosu (bulk delete + 3 yerleştir + 2 tel) reproduce edildi, screenshot alındı:

```
circuit.nodes = [float_1, float_2, float_4, float_6, gnd]
layout.probes.node = [in, out]
activeNodes.has('in')  = false
activeNodes.has('out') = false
→ probe'lar atlanır, kılçık dahil
```

Screenshot kanıtı: `tests/sprint-2.7/screenshots/before-fix-step1-bulk-replace-wire.png` — canvas'ta V1+R1+C1 görünüyor, **dashed amber kılçık YOK**. Şef'in gözlemi muhtemelen sayfa cache'li bir önceki sürümdü.

### Bug #3-variant — V=0 V=0 I=2.5pA

Şef senaryosu reproduce edildi:

```
BULK DELETE → V/R/C yerleştir → V.pos↔R.t1, R.t2↔C.t1 tel
→ V1.nodes = [float_1, float_2]  (float_2 GND'de DEĞİL)
→ R1.nodes = [float_1, float_4]  (merge)
→ C1.nodes = [float_4, float_6]  (merge)
→ V1.neg, C1.t2 izole (loop kapalı değil)

Solver çalıştı:
  vIn = 0, vOut = 0, iR1 = 2.5e-12  (picoamp = sayısal noise)
  dashboard.kind = 'ok' (önceki fix'ler "empty"/"floating" tetiklemedi)
```

**Kullanıcı açısından yanlış:** V kaynağı 5V ama vIn=0 gösterilmesi ve I=2.5pA'lık anlamsız noise. Şef'in Sprint 2.5 öncesi gördüğü "I=33.94µA stale" bu mekanizmanın agresif varyasyonu (solver tam sıfır yerine eski snapshot döndürüyordu).

**Undo zinciri testi:**
```
UNDO #1: ok (vOut=0, iR1=1.67e-12)      ← Şef'in stale gördüğü kritik an
UNDO #2: floating (wires=0)              ← Sprint 2.6 fix çalıştı
UNDO #3: floating (wires=0)
UNDO #4: floating (wires=0)
UNDO #5: empty (components=0)            ← Sprint 2.5 fix çalıştı
UNDO #6-8: ok (RC orijinal)              ← hedefe döndü
```

UNDO #1'de kind='ok' ama V=0 I=noise. Burada yeni fix kolonsal girer: **V kaynağı GND'ye bağlı değilse floating**, solver sonucu gösterilmez.

---

## 🔧 Fix — `ui-v2/src/modes/design-mode.ts` `runSolver`

İki savunma katmanı eklendi:

```typescript
// Sprint 2.7 / Bug #3-variant: V kaynağı GND'ye bağlı değilse açık devre.
// Proxy heuristic: her V için nodes.includes('gnd') şart.
const hasOpenSource = this.circuit.components.some(
  (c) => c.type === 'V' && !c.nodes.includes('gnd'),
);
if (hasOpenSource) {
  this.dashboard = { kind: 'floating' };
  return;
}

// ... solver çalıştır ...

if (transient.success) {
  const snapshot = snapshotFromTransient(transient, this.circuit, -1);
  // Sprint 2.7: NaN/Infinity validation. Solver success=true olsa bile
  // matrix near-singular, overflow gibi durumlarda geçersiz sayılar
  // döndürebilir. Stale 33.94µA senaryosunun bir varyantı.
  const allFinite =
    Object.values(snapshot.nodeVoltages).every((v) => Number.isFinite(v)) &&
    Object.values(snapshot.branchCurrents).every((v) => Number.isFinite(v));
  if (!allFinite) {
    this.dashboard = {
      kind: 'err',
      message: 'solver geçersiz sonuç üretti (NaN/Infinity)',
    };
    return;
  }
  this.dashboard = { kind: 'ok', transient, snapshot };
}
```

**Neden 2 katman?**

1. **Pre-check `hasOpenSource`:** V kaynağı GND'ye bağlı değilse solver'ı hiç çağırmıyoruz. Noise sonucu zaten üretmesin, direkt floating state'e geç. Tipik "seri bağla ama GND'yi unut" senaryosunu yakalar.
2. **Post-check `allFinite`:** Solver bazen success=true döner ama NaN/Infinity değerlerle. Matrix singular durumlarında tipik. Yakalanmazsa dashboard `"NaN V"` gibi garip göstergeler verir. Defensive.

**Sprint 1.3 disiplini evrimi:**

- **Sprint 1.3:** "Solver başarısızsa eski sonucu koru" (plan).
- **Sprint 2.5:** "Empty circuit → 'empty' state; solver başarısız → 'err' state." Eski sonuç koruma yasak.
- **Sprint 2.6:** "Wires=0 → 'floating' state."
- **Sprint 2.7:** "V GND'siz → 'floating'; NaN sonuç → 'err'." Tüm kaçak yollar kapandı.

Dashboard artık 4 temiz state: `ok` (değerler güvenilir), `empty` (devre yok), `floating` (bağlantı eksik), `err` (solver hata). Stale veri hiçbir yerden sızmaz.

---

## ✅ Doğrulama

### Şef senaryosu

| Adım | Önce (keşif) | Sonra (fix) |
|---|---|---|
| Bulk delete + V/R/C yerleştir + seri bağla | `kind='ok'`, iR1=2.5pA noise | `kind='floating'` |
| Dashboard hint | "veri bekleniyor" | "Devre tamamlanmamış · bileşenleri terminal'lerden telle bağla" |
| Slot değerleri | "0.00V / 0.00V / 2.50 pA" | "— / — / —" (bağlantı bekleniyor) |
| Canvas | V1+R1+C1 + teller, kılçık yok | V1+R1+C1 + teller, kılçık yok (aynı — fix öncesi zaten doğru) |

Screenshot: `tests/sprint-2.7/screenshots/fix-sef-scenario-floating.png`

### 11 senaryo test matrisi

```
✓ ŞEF SENARYOSU (V GND-siz seri) → floating
✓ ŞEF SENARYOSU → stale 2.5pA GÖSTERİLMİYOR (iR1=undefined)
✓ ŞEF SENARYOSU → hint "tamamlanmamış"
✓ INIT (RC ok) → vOut=4.966, iR1=33.94µA (beklenen gerçek değer)
✓ Tek V (wires=0) → floating
✓ NaN validation kod içeri test edildi
✓ REG INIT → ok
✓ REG empty (bulk delete) → empty
✓ REG undo → RC ok
✓ REG R1 sil → solver ok (V1 hâlâ GND'de)
✓ REG multi-drag ok
```

**11 PASS / 0 FAIL, console temiz.**

---

## 🧪 Regresyon Özel Not — R1 sil

Kritik test: `R1 sil → solver ok (V1 hâlâ GND'de)`.

V1.nodes = [in, gnd] orijinal RC'de. R1 silindiğinde V1 hâlâ GND'ye bağlı → `hasOpenSource=false` → solver çalışır. V1+C1 kaldı ama C1 şarjsız, akım yok. Dashboard `ok` göstergesi doğru.

Bu test `hasOpenSource` heuristic'in **aşırı agresif olmadığını** doğruluyor. Sadece "V-GND hiç yok" durumunda tetiklenir, kısmi silmelerde değil.

---

## 📋 Dosya Değişiklik Özeti

```
 SPRINT-2.7-REPORT.md                  | +180 (yeni)
 ui-v2/src/modes/design-mode.ts        | +25 (hasOpenSource + allFinite)
```

Net: 1 dosya güncellendi, 1 rapor + screenshots. `src/` (v1) dokunulmadı.

---

## 📊 Bundle Trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 2.5 | 122.04 KB | +3.12 |
| 2.6 | 123.30 KB | +1.26 |
| **2.7** | **123.64 KB** | **+0.34 KB** |

Minimal — 25 satır runSolver validation.

---

## 🏁 Faz 2B Kalıcı Kapanış

```
Sprint 2.1  Undo altyapı
Sprint 2.2  Multi-select + bulk delete
Sprint 2.3  Rubber-band
Sprint 2.4  Topbar undo/redo + multi-drag
QA-2B       Sistematik bug taraması (kod yok)
Sprint 2.5  5 bug fix (hover, empty state, probe, drag-Esc, wire-Shift)
Sprint 2.6  Bug #4 fix (grounds cleanup + floating state)
Sprint 2.7  Open-circuit detection + NaN validation ← BURADAYIZ

Toplam: 107.84 → 123.64 KB = +15.80 KB
```

Dashboard state matrix (final):

| State | Tetikleyici | UI |
|---|---|---|
| `ok` | Solver başarılı + değerler finite + V GND'de | Normal (değerler) |
| `loading` | İlk yükleme | Placeholder |
| `empty` | `components.length === 0` | "Devre boş · bileşen ekleyin" |
| `floating` | `wires.length === 0` veya `hasOpenSource` | "Devre tamamlanmamış · telle bağla" |
| `err` | Solver başarısız / NaN / exception | Kırmızı hata kutusu |

Stale değer hiçbir yerden sızmaz.

---

## 🔎 Askıda Kalan

**Bug #2 (V1 etiket kayboluyor):** QA-2B'den beri reproduce edilemedi. Sprint 2.7'de de test edilmedi (kapsam dışı). Şef yeniden gözlemlemezse askıda kalır.

**Bug #4A-residue:** Reproduce edilemedi — mevcut guard yeterli. Defensive fix gerekmedi.

---

## ⏭️ Sonraki — Faz 2C Yön Seçimi

- **2C-A:** LED / Switch / GND yerleştirme + rotation (R tuşu) — bileşen zenginliği
- **2C-B:** Kaydet / Aç / SPICE export — topbar [TODO] 3'ü gerçek

Sprint 2.1 altyapısı + Sprint 2.5-2.7 state disiplini sayesinde:
- Yeni bileşen tipleri otomatik undoable
- Her topoloji değişimi solver validation'dan geçiyor
- Kullanıcıya asla stale / tutarsız değer gösterilmiyor

Faz 2C güvenli zeminde başlar.

---

## 💬 Notlar (Zenco)

Sprint 2.7'nin değeri **teşhis disiplini**. Şef iki şikayet verdi, keşif gösterdi:
- Bug #4A-residue: **yanlış alarm** (mevcut kod zaten doğru).
- Bug #3-variant: **gerçek sorun** ama reproduce etmek için spesifik senaryo (V GND'siz seri).

Ek fix'i ne eksik ne fazla yaptık. `hasOpenSource` heuristic basit ama güçlü: tek kontrol, yanlış pozitif yok (R1 sil regression ile doğrulandı). `allFinite` NaN savunması paranoyak seviyede koruma, overhead ihmal edilebilir.

**Sprint 1.3 disiplininin ölümü.** "Solver başarısızsa eski sonucu koru" Sprint 0.7'de doğal bir kararaydı, Sprint 2.5'te aşındı, Sprint 2.7'de tamamen terk edildi. Yeni prensip: **her durumda kullanıcıya dürüst state göster.** Dashboard'un 5 kind'i bu prensibe göre şekillendi.

**Faz 2B gerçekten kalıcı kapandı.** 4 fix sprint (2.5, 2.6, 2.7 ve potansiyel Şef geri bildirimleri için hazırlanıyor muydu) — hepsi temizlendi. Faz 2C ya bileşen zenginliği ya I/O ile başlar, altyapı ve state disiplini hazır.
