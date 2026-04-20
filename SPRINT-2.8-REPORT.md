# Sprint 2.8 — Sprint 2.7 Eksiklerinin Tamamlanması

**Status:** ✅ Tamamlandı · Faz 2B gerçekten kesin kapanış
**Tarih:** 2026-04-20
**Bundle:** 124.78 KB JS (gzip 35.74 KB) — Sprint 2.7'den **+1.14 KB**

---

## Özet

Sprint 2.7 temel fix'i (hasOpenSource + NaN validation) uyguladı; Sprint 2.8 cilayı tamamladı:

- ✅ **Tek kaynak disiplini** — Sprint 0.7'den beri korunuyor, doğrulandı (kod değişikliği yok)
- ✅ **`isValidSolverResult()` + `isValidTransientResult()`** helper'ları `bridge/engine.ts`
- ✅ **`renderError()`** empty/floating paternine uyduruldu (generic err-box → 4-state simetrisi)
- ✅ **Transient chart error state** zaten doğru davranışta (`hasData` + `isFinite` guard'lar)
- ✅ **Ctrl+Z tam zinciri** — 17 adım test, stale detection: **0 stale bulundu**

---

## 🔍 Keşif — 5 Kontrol Noktası

### 1. Tek kaynak disiplini (Sprint 0.7) korunuyor mu?

`modes/design-mode.ts` render template'i (satır 1619):

```typescript
const solve = this.dashboard.kind === 'ok' ? this.dashboard.snapshot : null;
```

Bu tek `solve` değişkeni **üç yere** dağılıyor:

| Tüketici | Prop | Etki |
|---|---|---|
| `<vxa-canvas>` | `.solve=${solve}` | Probe değerleri (render içinde) |
| `<vxa-inspector>` | `.solveResult=${solve}` | Canlı V/I/P slot'ları |
| Dashboard slot'lar | `dashboard.snapshot.*` | V_GİRİŞ/V_ÇIKIŞ/I(R1) @SON |

`<vxa-transient-chart>` sadece `dashboard.kind === 'ok'` dalında mount oluyor (`.data=${transient}`). Diğer kind'larda component yok, unmount.

**Sonuç:** Dashboard `ok` değilse `solve=null`, üç tüketici de aynı anda boşalır. Tek kaynak disiplini **hiç aşınmamış** — kod değişikliği gerekmez. Sprint 2.8 raporunda doğrulama amaçlı belgelendi.

### 2. Mevcut 'err' UI

Sprint 2.7 öncesi: tek merkezde kırmızı kutu (`dashboard-zone--error`, `err-box`, `err-title`). Empty/floating paterninden tamamen farklı — kullanıcı dashboard'ın genel akışından koparılıyordu.

Sprint 2.8: header + dash-chart (empty-hint) + 3-slot iskeleti. Empty/floating ile aynı layout.

### 3. Transient chart error handling

`vxa-transient-chart` zaten iki katmanlı guard'a sahipti:

- `render()` içinde `hasData = data?.success === true && ...` — data yoksa canvas yanında `.empty` div'i "veri bekleniyor" gösterir.
- `draw()` içinde `if (!isFinite(vMin) || !isFinite(vMax)) return` — NaN/Inf çizilmez.

Ek iyileştirme gerekmedi. Design-mode zaten `ok` olmayan kind'larda chart'ı hiç mount etmiyor (empty/floating/err template'leri ayrı) — "eski data tutulma" sorunu fiziksel olarak imkansız.

### 4. `isValidSolverResult` helper

Sprint 2.7'de inline `allFinite` vardı. Sprint 2.8'de:

```typescript
// bridge/engine.ts
export function isValidSolverResult(r: SolveResult | null | undefined): boolean {
  if (!r || !r.success) return false;
  for (const v of Object.values(r.nodeVoltages)) if (!Number.isFinite(v)) return false;
  for (const i of Object.values(r.branchCurrents)) if (!Number.isFinite(i)) return false;
  return true;
}

export function isValidTransientResult(r: TransientResult | null | undefined): boolean {
  if (!r || !r.success) return false;
  for (let i = 0; i < r.time.length; i++) if (!Number.isFinite(r.time[i]!)) return false;
  for (const series of Object.values(r.nodeVoltages)) {
    for (let i = 0; i < series.length; i++) if (!Number.isFinite(series[i]!)) return false;
  }
  return true;
}
```

`runSolver` iki helper'ı ayrı ayrı çağırıyor: **snapshot (slot değerler)** ve **trace (grafik)** bağımsız valide ediliyor. Birinden biri bozuksa dashboard err state'e düşer.

### 5. Ctrl+Z tam zinciri

17-adım reproduction sonucu (Şef senaryosu):

```
[INIT]            ok       vOut=4.97  iR1=33.94µA  past=0
[BULK DELETE]     empty    —          —            past=1
[PLACE V1]        floating —          —            past=2
[PLACE R1]        floating —          —            past=3
[PLACE C1]        floating —          —            past=4
[WIRE V1↔R1]      floating —          —            past=5  (V hâlâ GND'siz)
[WIRE R1↔C1]      floating —          —            past=6  (V hâlâ GND'siz)
[UNDO #1]         floating —          past=5  future=1
[UNDO #2]         floating —          past=4  future=2
[UNDO #3]         floating —          past=3  future=3
[UNDO #4]         floating —          past=2  future=4
[UNDO #5]         empty    —          past=1  future=5
[UNDO #6]         ok       vOut=4.97  past=0  future=6  (RC restore)
[UNDO #7..10]     ok       vOut=4.97  past=0  future=6  (saturation)
```

**Stale detection:** her adımda `kind==='ok' && |vIn|<1e-6 && |iR1|>1e-6` kontrol. **17 adım boyunca 0 stale.**

---

## 🎨 4-State UI Karşılaştırma Tablosu

| State | Canvas alt ipucu | Dashboard slot'lar | Grafik | Tetikleyici |
|---|---|---|---|---|
| **ok** | *(yok, transient chart mount)* | `4.97 V / 5.00 V / 33.94 µA` | Eğri | Solver başarılı + değerler finite + V GND'de |
| **empty** | `Devre boş · soldaki araçlardan bileşen ekleyin` | `— / — / —` (bileşen yok) | Yok (unmount) | `components.length === 0` |
| **floating** | `Devre tamamlanmamış · bileşenleri terminal'lerden telle bağla` | `— / — / —` (bağlantı bekleniyor) | Yok (unmount) | `wires=0` ya da `hasOpenSource` |
| **error** | `Çözüm hesaplanamadı · devreyi kontrol edin` | `— / — / —` (solver detay sub'da) | Yok (unmount) | Solver exception / success=false / NaN / Infinity |
| **loading** | — | placeholder | Boş | İlk yükleme |

Screenshots:
- `tests/sprint-2.8/screenshots/state-ok.png`
- `tests/sprint-2.8/screenshots/state-empty.png`
- `tests/sprint-2.8/screenshots/state-floating.png`
- `tests/sprint-2.8/screenshots/state-error.png`
- `tests/sprint-2.8/screenshots/chain-01-bulk-delete.png`, `chain-02-after-wires.png` (Ctrl+Z senaryosu ara adımları)

---

## 📋 Dosya Değişiklik Özeti

```
 SPRINT-2.8-REPORT.md                  | +190 (yeni)
 ui-v2/src/bridge/engine.ts            | +35  (isValidSolverResult + isValidTransientResult)
 ui-v2/src/modes/design-mode.ts        | +40  (helper import + renderError rewrite)
```

Net: 2 dosya güncellendi, 1 rapor + 7 screenshot. `src/` (v1) dokunulmadı.

---

## 📊 Bundle Trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 2.6 | 123.30 KB | +1.26 |
| 2.7 | 123.64 KB | +0.34 |
| **2.8** | **124.78 KB** | **+1.14 KB** |

Artış: 2 helper + renderError rewrite + ek yorum satırları. Plan tahmini +0.5 KB biraz aştı — empty-hint formatındaki sub-text detayları yüzünden.

---

## 🏁 Faz 2B Kesin Kapanış Tablosu

| Sprint | Kapsam | Bundle | Δ |
|---|---|---|---|
| 1.5 (2A son) | Silme + rebuild | 107.84 | — |
| 2.1 | Undo altyapı | 109.59 | +1.75 |
| 2.2 | Multi-select + bulk delete | 111.87 | +2.28 |
| 2.3 | Rubber-band | 115.73 | +3.86 |
| 2.4 | Topbar undo/redo + multi-drag | 118.92 | +3.19 |
| QA-2B | Sistematik bug taraması (kod yok) | 118.92 | 0 |
| 2.5 | 5 bug fix (Sprint 2.5) | 122.04 | +3.12 |
| 2.6 | Bug #4 (grounds + floating) | 123.30 | +1.26 |
| 2.7 | Open-circuit + NaN | 123.64 | +0.34 |
| **2.8** | **Cila (4-state simetri + helpers + Ctrl+Z matrix)** | **124.78** | **+1.14** |
| **Toplam 2B** | | | **+16.94 KB** |

Faz 2B elde edilenler:
- ✅ Undo/Redo (keyboard + topbar buton + tooltip + disabled)
- ✅ Multi-select (Shift+Click) + bulk delete (tek undo)
- ✅ Rubber-band (5px eşik, Shift union, Escape iptal)
- ✅ Multi-drag (fast path) + topbar canUndo/canRedo reaktif
- ✅ Empty / Floating / Error state — 4-state simetrik UI
- ✅ Orphan cleanup (probe + grounds render-only)
- ✅ Drag Escape iptal (history-safe)
- ✅ wireDraw FSM temiz (Shift+Click çakışması yok)
- ✅ hasOpenSource heuristic (V GND'siz → floating)
- ✅ isValidSolverResult / isValidTransientResult validation (NaN/Inf)
- ✅ Tek kaynak disiplini (Sprint 0.7) kesintisiz korundu

---

## 🔎 Askıda

**Bug #2 (V1 etiket kayboluyor):** QA-2B'den beri 10+ senaryoda reproduce edilemedi. Şef yeniden gözlemlemezse askıda kalır.

---

## ⏭️ Sonraki Yönler — Faz 2C

- **2C-A:** LED / Switch / GND yerleştirme + rotation (R tuşu) — bileşen zenginliği
- **2C-B:** **Waypoint tel çizimi** — Şef talebi, kablo yolu kontrolü
- **2C-C:** Kaydet / Aç / SPICE export — topbar [TODO]'ların 3'ü

Waypoint Şef'in en belirgin istediği özellik — Faz 2C'nin yüksek önceliği. Sprint 2.1 undo altyapısı + Sprint 2.5-2.8 state disiplini sayesinde her yeni action otomatik undoable, solver validation'dan geçiyor.

---

## 💬 Notlar (Zenco)

Sprint 2.8 bir "cila sprint" — 2.7'de yapılmamış beş inceliği kapatmak. Ama değerli: **4-state UI simetrisi** kullanıcı için net referans oluyor. Şef hangi durumda ne göreceğini tahmin edebilir.

**Tek kaynak keşfi beklenenden kısa sürdü.** Kod zaten Sprint 0.7'den beri doğru (`solve = ok ? snapshot : null` tek değişken). Plan "disiplin aşınmış olabilir" diye uyarmıştı, yoktu. Raporda bunu açıkça belgelemek geleceğin kararları için faydalı — "Sprint 2.8'de doğrulandı, kontrol edilmesine gerek yok" diyebiliriz.

**Ctrl+Z tam zinciri en değerli test.** Şef 10 Ctrl+Z denemişti, ben 10 basıp her adımda state dump + stale detection yaptım. 17 adım, 0 stale. Sprint 2.7'deki "11 PASS" daha dar kapsamlı idi, bu tam zincir kapsamadı. Sprint 2.8 bu boşluğu kapattı.

**renderError empty-hint paternine uydu** — generic kırmızı kutu yerine. Kullanıcı dashboard'ın normal akışında kalıyor, solver mesajı sub-text olarak erişilebilir. "Hata var" hissi yerine "bu state böyle gösteriliyor" dili — tutarlı UX.

**Faz 2B kesin olarak kapandı.** 4 fix sprint (2.5, 2.6, 2.7, 2.8) + 1 QA sprint + 4 özellik sprint. Her iterasyon Şef gözlemiyle açıldı, puppeteer ile doğrulandı, regresyon testinden geçti. Faz 2C başlarken zemin sağlam.
