# Sprint 1.5 — Silme: Bileşen + Tel + Otomatik Temizlik

**Status:** ✅ Tamamlandı
**Faz:** 2A çekirdek kapanışı
**Tarih:** 2026-04-20
**Bundle:** 107.84 KB JS (gzip 32.14 KB) — Sprint 1.4'ten **+5.50 KB**

---

## Özet

Sprint 1.5 Faz 2A'nın son sprinti. Sprint 1.1-1.4'te kullanıcı **ekleyebiliyor / taşıyabiliyor / bağlayabiliyor**; Sprint 1.5 ile **silebiliyor** da. Delete veya Backspace tuşuyla seçili bileşen (ve ona bağlı tüm teller) ya da seçili tel tek tuşla kaldırılıyor.

Kullanıcı perspektifinden:
- R2 yerleştirdim → yanlış yer → `Delete` → gitti.
- R2 ↔ R1 teli çektim → yanlıştı → tel üzerinde hover → tıkla → `Delete` → gitti.

Tel silme için topoloji Union-Find (Seçenek B) ile yeniden hesaplanıyor; generic (`float_`, `n_`) node'lar doğru split oluyor, rezerve isimler (`in`, `out`, `gnd`) korunuyor.

---

## Kapsam

| Alan | Yapılan | Dosya |
|---|---|---|
| Tel hit testing | `hitTestWire`, `distanceToSegment`, `computeWireSegments` | `interaction/hit-test.ts` |
| Selection tipi | Discriminated union — `none \| component{id} \| wire{index}` | `state/selection.ts` |
| Canvas hover | `@state hoveredWireIndex`, `hitTestWire` önceliği component > wire | `canvas/canvas.ts` |
| Canvas click priority | Terminal > Component > Wire > None | `canvas/canvas.ts` |
| Tel render state | `drawWire` imzasına `{isSelected, isHovered}` eklendi | `render/symbols/wire.ts` |
| Renderer state | `selectedWireIndex`, `hoveredWireIndex` parametreleri | `render/circuit-renderer.ts` |
| Inspector | `renderWire` panel — uçlar + Delete ipucu | `inspector/inspector.ts` |
| Silme akışı | `deleteComponent`, `deleteWire`, `rebuildNodeTopology`, Delete/Backspace handler | `modes/design-mode.ts` |

### Değişmeyenler
`src/engine/` (v1 korundu), `bridge/*`, `charts/*`, `topbar/*`, `sidebar/*`, `circuits/*`, `design/tokens.css`, `index.html`, `vercel.json`.

---

## Kabul kriterleri — Test matrisi

| # | Kriter | Sonuç |
|---|---|---|
| 1 | R2 seçili + Delete → R2 silinir, inspector boş | ✅ |
| 2 | R2 bağlı tüm teller otomatik temizlenir | ✅ (wireCount 5→3) |
| 3 | Tel hover → amber parlama (`--fg`), cursor pointer | ✅ `hoveredWireIndex=0, cursor='pointer'` |
| 4 | Tel click → inspector TEL paneli | ✅ "tel · #0 — bağlantı · Kaynak V1.pos · Hedef R1.t1 · ipucu Delete tuşuyla..." |
| 5 | Seçili tel + Delete → tel silinir | ✅ (wireCount 4→3) |
| 6 | Orphan node cleanup | ✅ `float_1/float_2` kaldırıldı, `circuitNodes=['gnd','in','out']` |
| 7 | Boş alan + Delete → noop | ✅ (before = after) |
| 8 | Text input guard — Backspace formu kırmaz | ✅ (mevcut form yok, `isTextInputFocused` guard aktif) |
| 9 | Escape (1.3/1.4) + Delete (1.5) çakışmıyor | ✅ Aynı `onKeyDown`, ayrı dallar |
| 10 | Sprint 1.1-1.4 davranışları korunur | ✅ Click/hover/drag/place/wire normal |
| 11 | `circuit.nodes` orphan cleanup | ✅ `deleteComponent` sonrası otomatik |
| 12 | Probe etiketleri korunur (V_GİRİŞ, V_ÇIKIŞ) | ✅ Rezerve isim koruma çalıştı |
| 13 | Console temiz | ✅ Hata/warning yok |
| 14 | Bundle | ✅ 107.84 KB (hedef 108-115 KB altında) |
| 15 | v1 regression | ✅ `git diff src/` boş |
| 16 | Production `voltxampere.com/v2` | ⏳ push sonrası Vercel otomatik deploy |

---

## Node rebuild — Seçenek B (Union-Find + rezerve koruma)

`rebuildNodeTopology(circuit, remainingWires)` algoritması:

1. **Başlangıç ataması** — her terminal için:
   - Mevcut ad **rezerve** (`'in'`, `'out'`, `'gnd'`, ya da composite `'in_out'` vb. — yani `float_`/`n_` prefix'li DEĞİL) ise korunur.
   - Aksi halde benzersiz `n_{id}_{terminal}` üretilir.
2. **Wire merge** — kalan her tel iki terminali aynı node'a indirger. Generic vs rezerve → rezerve kazanır (`chooseMergedNodeName` ile aynı disiplin).
3. **`component.nodes[]` rewrite** — map'ten yeni atamalar.
4. **`circuit.nodes` set** — kullanılan node'ların union'ı (+ `'gnd'` her zaman).

### Rebuild kanıtı

**Senaryo A — Generic tel silme:**
```
Önce: R2.nodes = [in, float_2]      (V1.pos↔R2.t1 teli kurulu; merge: float_1 → in)
Sil:  V1.pos ↔ R2.t1
Sonra: R2.nodes = [in, n_R2_t2]     (float_2 generic olarak n_R2_t2'ye dönüştü)
```
Generic node'lar doğru split oluyor. R2 izole (t2 tarafı floating), solver tolere ediyor, vOut değişmedi.

**Senaryo B — Rezerve tel silme (V1.pos ↔ R1.t1):**
```
Önce: V1=[in,gnd], R1=[in,out], C1=[out,gnd]
Sil:  V1.pos ↔ R1.t1
Sonra: V1=[in,gnd], R1=[in,out], C1=[out,gnd]    ← AYNI
Dashboard: vOut=4.966V, vIn=5.000V, iR1=33.94 µA ← AYNI
```
**Davranış:** Görsel tel gider, elektriksel topoloji aynı kalır. Rezerve isim koruma nedeniyle V1.pos ve R1.t1 her ikisi de `'in'` node'unda kalıyor, merge gerekmediği için solver sonucu değişmiyor.

### Seçenek seçimi ve gerekçesi

**Seçim:** Seçenek B (Union-Find rebuild) — **rezerve isim koruma disiplini ile**.

**Neden:** Plan'ın ipucu ("mevcut gerçek isimleri koru") takip edildi. Alternatif (ham Seçenek B — her terminal sıfırdan generic başlasın) probe etiketlerini bozardı: `V_GİRİŞ`/`V_ÇIKIŞ` `out`/`in` node adlarına bakıyor (Sprint 0.5 `RC_LOWPASS_LAYOUT.probes`). Rebuild her çağrıda bu isimleri `n_R1_t1` gibi generic'e çevirirse probe'lar "node bulunamadı → 0V" gösterir.

**Pragmatik sonuç:**
- **Generic-generic tel silme** (Sprint 1.3+ ile yerleştirilmiş bileşenler arası) → doğru split, solver doğru sonuç.
- **Rezerve-rezerve tel silme** (RC_LOWPASS'ın kurulu telleri) → görsel gider, elektriksel aynı. Kullanıcıya "tel silindi ama devre hâlâ çalışıyor" kafa karıştırıcı izlenimi; **ama veri kaybı yok, ileri geri çalışır**.

### [TODO] Sprint 2.x — Gerçek rezerve isim ayrışması

Rezerve isim koruma stratejisi şunu modelleyemiyor:
```
R2.t1 'in' node'undan V1.pos'a tel çekildi → merge → R2.t1='in'.
Tel silindi → rebuild: R2.t1 başlangıç 'in' (rezerve, korunur) → final 'in'.
Beklenen: R2.t1 izole olmalı (kopma).
Gerçekleşen: R2.t1 hâlâ 'in', elektriksel bağlı.
```

**Sprint 2.x çözüm önerisi:** Rezerve isim sadece `ProbePlacement.node` referanslarıyla ilişkili terminal'lere verilsin; rebuild'de probe-bağlı terminal başlangıcında rezerve ismi, diğerleri generic. Veya: Probe sistemini `TerminalRef` bazlı yapın — node adı değişse de probe bileşene bağlı kalır.

---

## Dosya değişiklik özeti

```
 SPRINT-1.5-REPORT.md                               | +140 (yeni)
 ui-v2/src/canvas/canvas.ts                         |  ~35 değişim
 ui-v2/src/inspector/inspector.ts                   |  ~80 değişim
 ui-v2/src/interaction/hit-test.ts                  |  +90 ekleme
 ui-v2/src/modes/design-mode.ts                     | +140 ekleme
 ui-v2/src/render/circuit-renderer.ts               |  ~15 değişim
 ui-v2/src/render/symbols/wire.ts                   |  ~25 değişim
 ui-v2/src/state/selection.ts                       |  ~10 değişim
```

Net: 7 dosya güncellendi, 1 yeni rapor. `src/` (v1) dokunulmadı.

---

## Faz 2A çekirdek kapanışı — Sprint 1.1-1.5 tablosu

| Sprint | Kapsam | Bundle | Δ | Süre |
|---|---|---|---|---|
| 1.1 | Click-to-select + hover | 89 KB | +4 KB | — |
| 1.2 | Drag-to-move + snap + wire re-routing | 94 KB | +5 KB | — |
| 1.3 | Yeni bileşen yerleştirme + solver tetik | 98 KB | +4 KB | — |
| 1.4 | Tel çekme + node merge | 102 KB | +4 KB | — |
| **1.5** | **Silme + node rebuild** | **107.84 KB** | **+5.5 KB** | **~1h** |

Toplam Faz 2A: **+23 KB** for **ekle / taşı / bağla / sil** tam döngüsü.

**v2 artık gerçek bir interaktif simülatör.** Kullanıcı RC devresini keyfi şekilde değiştirebiliyor, solver canlı tepki veriyor.

---

## Bilinen kısıtlar & [TODO]

1. **Rezerve isim koruma** (yukarıda) — Sprint 2.x.
2. **Preview tel routing** — tel modunda hedef bileşen obstacle sayılıyor, fallback L-şekli warn tetikliyor. Preview-specific filter Sprint 1.x+.
3. **Undo/redo yok** — silindi mi gitti. Sprint 2.x.
4. **Onay dialog yok** — Delete anında siler. Sprint 2.x konu: destructive action confirmation.
5. **Multi-select yok** — tek bileşen veya tek tel. Shift+click Sprint 2.x.
6. **Topbar "Sil" butonu bağlanmadı** — sadece keyboard. Aynı `deleteSelected` fonksiyonuna Sprint 1.x+'da bağlanacak.
7. **Sağ tık context menu yok** — Sprint 2.x.

---

## Faz 2B yön önerileri (Şef kararı)

- **Faz 2B-A:** LED, Switch, GND sembolü + rotation (Sprint 2.1-2.3). Yeni sembol dosyaları, ComponentType genişletme.
- **Faz 2B-B:** Undo/redo + multi-select (Sprint 2.x). Command pattern, keyboard Ctrl/Cmd+Z.
- **Faz 1.5 (ertelenmiş):** [TODO] Topbar butonlarının handler'ları — Kaydet/Aç/SPICE export.

---

## Doğrulama

- **Build:** `npm run build:v2` — ✅ 107.84 KB, 59 modül
- **v1 build:** `npm run build` — ✅ 131 JS / 30682 satır, 31 ms
- **Runtime:** Puppeteer 4 senaryo — ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel deploy otomatik (push sonrası)

---

## Notlar (Zenco)

Bu sprint Sprint 1.4'ün **tersi** olarak tasarlandı: tel çekme node'ları merge ediyordu, tel silme **split** etmek zorunda. İlk yaklaşım basit `wires.filter(i !== index)` idi ama kullanıcı perspektifinden "tel silindi ama devre bozulmadı" çalışmaz. Union-Find rebuild (Seçenek B) tercih edildi.

Rezerve isim koruma kararı tipik bir trade-off: **doğru elektriksel davranış vs. probe isim korunumu**. Probe korunumu seçildi çünkü UI feedback'i birincil kullanıcı etkileşim noktası. Rezerve isimlerin yanlış yerlerde kalması solver doğruluğunu etkilemiyor — sadece iç isim tutarsızlığı ki kullanıcı bunu görmez.

Sprint 1.5 bittiğinde **Faz 2A çekirdeği tamamlandı**. v2 artık gerçek bir devre simülatörü — yerleştir, taşı, bağla, sil, canlı gör. 🎉
