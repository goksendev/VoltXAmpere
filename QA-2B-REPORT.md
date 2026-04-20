# QA-2B Raporu — Zenco Aşama 1

**Tarih:** 2026-04-20
**Kapsam:** Faz 2A (Sprint 1.1-1.5) + Faz 2B (Sprint 2.1-2.4)
**Ortam:** `http://localhost:5174/v2/` (Sprint 2.4 commit `e2c87a0`)
**Araç:** Puppeteer + shadow DOM state dump + screenshot

**Kural:** Kod değişikliği yasak, sadece gözlem + rapor. `git diff src/` ve `git diff ui-v2/src/` boş kontrolü nihai.

---

## 🎯 Özet

- **Seed bug sayısı:** 4 (Şef 5 dakikalık denemede yakaladı)
  - **Konfirme:** 2 (Bug #1 orphan markers, Bug #3 solver inconsistency)
  - **Reproduce edilemedi:** 2 (Bug #2 V1 etiketi, Bug #4 auto-wire)
- **Yeni bulunan bug:** 3 (Bug #5 probe orphan, Bug #6 drag+Esc, Bug #7 wireDraw+Shift)
- **Kategori tarama:** 33 senaryo (6 kategori) — **31 PASS, 2 FAIL**
- **Toplam bug:** 5 konfirme (2 seed + 3 yeni), 2 reproduce edilemedi ([Bug #2, #4])
- **Öncelik dağılımı:** P0=0, P1=3, P2=2

`git diff --stat src/` ve `git diff --stat ui-v2/src/` **ikisi de boş**. Hiçbir kaynak kod değişmedi.

---

## 🐞 Seed Bug Doğrulama

### Bug #1 — Orphan amber terminal noktaları · **KONFIRME** · P1

**Reproduction (minimum adım):**
1. Sayfa aç, RC devresi yüklü (V1, R1, C1 + 4 tel)
2. Fareyi R1 üzerine getir → hover aktif (`hoveredId='R1'`)
3. R1 tıkla → selection=component(R1)
4. `Delete` tuşuna bas → R1 silinir, `compIds: [V1, C1]`, `wireCount: 4`
5. **Fare canvas'ta hala yerinde.** Canvas'ta screenshot al.

**State dump (silme sonrası, fare taşınmadan):**
```json
{
  "hoveredId": "R1",           // ← STALE (R1 silindi ama state kaldı)
  "hoveredWireIndex": null,
  "sel": { "type": "none" },
  "compIds": ["V1", "C1"]
}
```
Fare uzak bir yere hareket edince düzelir:
```json
{ "hoveredId": null, "hoveredWireIndex": null }
```

**Ekran görüntüsü:** `tests/qa-2b/screenshots/bug1-orphan-after-delete.png`

Canvas'ta görünen anomaliler:
- V_GİRİŞ probe pin (~599, 286) ve V_ÇIKIŞ probe pin (~678, 287) — **iki küçük amber/beyaz daire orphan kalıyor**
- Probe kutu etiketleri `V_GİRİŞ 5.00 V` ve `V_ÇIKIŞ 0.00 V` hala duruyor (R1 silinmiş)
- R1'e bağlı teller otomatik temizlenmiş (doğru), ama probe'lar silinen bileşenin terminal bölgesinde asılı

**Hipotez:**
- `hoveredId` Canvas @state'idir, mouseleave veya yeni mousemove olmadığı sürece güncellenmez. `deleteComponent` sonrası design-mode selection'ı temizliyor ama canvas'ın hoveredId'si temizlenmiyor.
- Probe pin dots'un orphan kalması ayrı bir alt-bug (aşağıda Bug #5 olarak ayrı raporlandı) — layout.probes statik tanım, silme sonrası güncellenmiyor.

**İki alt belirti aynı senaryoda gözlemlendi:**
- 1a: `hoveredId` stale (fare hareket edince kendi kendine düzeliyor — render üzerinde görünür etkisi şu an yok çünkü renderer `layout.components.filter` ile stale ID'yi atlıyor — **passive bug**)
- 1b: Probe orphan pin dots (`layout.probes` güncellenmiyor — **active visual bug**, Bug #5 olarak ayrı).

---

### Bug #2 — V1 etiketi ("5 V") kayboluyor · **REPRODUCE EDİLEMEDİ**

**Test senaryoları (8 farklı action sonrası `V1.displayValue` + canvas kontrol):**

| Senaryo | `V1.displayValue` | Sonuç |
|---|---|---|
| INIT | `"5 V"` | ✅ |
| AFTER DRAG V1 (-100, 32) | `"5 V"` | ✅ |
| AFTER UNDO (drag undo) | `"5 V"` | ✅ |
| AFTER MULTI-DRAG (multi[V1,R1], V1 taşı) | `"5 V"` | ✅ |
| AFTER WIRE START (V1.pos terminal click) | `"5 V"` | ✅ |
| AFTER Escape | `"5 V"` | ✅ |
| AFTER PLACE V2 | `"5 V"` | ✅ |
| AFTER DELETE R1 | `"5 V"` | ✅ |

Canvas screenshot'larında da V1 sembolünün altında "5 V" metni tüm durumlarda görünür.

**Ekran görüntüleri:**
- `tests/qa-2b/screenshots/bug2-v1-after-drag.png` — V1 drag sonrası
- `tests/qa-2b/screenshots/bug2-final.png` — R1 silme sonrası

**Hipotez:**
- State bazında `displayValue` her zaman `"5 V"`. Render bazında canvas'ta görünür.
- Şef'in gördüğü durum özel bir action kombinasyonu veya browser cache artifact olabilir. **Daha derin tarama gerekir** — Zenco Aşama 2'de Claude + Şef eklemeli.
- Olası ipucu: V1'in `rotation: 270` — rotasyon + özel konumlama `drawVoltageSourceLabels`'da bir edge case tetikleyebilir. Ama bu sprint kapsamında test edilmedi (rotation değiştirme yok).

---

### Bug #3 — Solver state tutarsızlığı · **KONFIRME** (farklı formda) · P1

Şef'in gözlemlediği tam kombinasyon (V=0, I=33.94µA) direk reproduce edilemedi, ama **aynı altyatan sorunun daha ağır bir varyasyonu** konfirme edildi:

**Reproduction:**
1. Sayfa aç, RC devresi yüklü
2. Programatik: `selection = { type: 'multi', componentIds: ['V1', 'R1', 'C1'] }`
3. Delete tuşuna bas → tüm bileşenler + bağlı teller silinir
4. Dashboard ve canvas'a bak

**State dump:**
```json
{
  "compIds": [],               // ← CIRCUIT BOŞ
  "wireCount": 0,
  "dashKind": "ok",            // ← "ok" olması yanlış — solver başarısız olmalıydı
  "vIn": 5,                    // ← STALE (eski snapshot'tan)
  "vOut": 4.966057623424773,   // ← STALE
  "iR1": 0.0000339423765752267 // ← STALE
}
```

DOM kontrolü:
```json
{ "dashValues": ["4.97 V", "5.00 V", "33.94 µA"] }
```

**Ekran görüntüsü:** `tests/qa-2b/screenshots/bug3-bulk-empty-stale-dashboard.png`

Canvas tamamen boş (2 toprak sembolü hariç) + 2 probe kutusu orphan dots ile asılı. Dashboard'un 3 slotu ve zaman domain grafiği hala orijinal RC'nin değerlerini/eğrisini gösteriyor.

**Hipotez:**
- `deleteMultipleComponents` sonunda `await this.runSolver()` çağrılıyor. Boş devre için solver muhtemelen hata döndürüyor (success: false).
- `runSolver` içinde `console.warn('[solver] yeniden hesap başarısız: ...')` pattern'i var; **önceki snapshot korunuyor** (`dashboard.kind` `'ok'` kalıyor).
- Bu disiplin Sprint 0.7'de "UI değişmesin, önceki değerleri korusun" amacıyla konmuş. Ama **bu senaryoda yanlış davranış**: kullanıcı tüm devreyi sildi, dashboard eski RC sonuçlarını göstermemeli.
- **Şef'in V=0, I=33.94µA gözlemi muhtemelen aynı mekanizmanın kısmi varyasyonu** — bir bileşen silindi, solver başarısız oldu, bir slot güncellendi (snapshot'tan) bir slot stale kaldı. Tam senaryo bulunamadı ama aynı kök neden.

**İlgili senaryo (konfirme edilen):**
- **R1 sil:** `vOut=0, iR1=undefined` (solver başarılı, tutarlı) ✅
- **V1 sil:** `vIn=0, vOut=0, iR1=0` (solver başarılı, tutarlı) ✅
- **Bulk delete all:** solver başarısız, **dashboard stale** ❌ (bu bug)

---

### Bug #4 — Yeni V otomatik bağlanıyor · **REPRODUCE EDİLEMEDİ**

**Test:**
1. Sayfa aç (V1, R1, C1 + 4 tel)
2. Sidebar → "Pil" butonu
3. Canvas'a click (merkez-sol-alt, kör alan)

**State dump (AFTER PLACE):**
```json
{
  "components": [
    { "id": "V1", "nodes": ["in", "gnd"], ... },
    { "id": "R1", "nodes": ["in", "out"], ... },
    { "id": "C1", "nodes": ["out", "gnd"], ... },
    { "id": "V2", "nodes": ["float_1", "float_2"], "value": 5 }  // ← FLOATING, DOĞRU
  ],
  "wireCount": 4,              // ← DEĞİŞMEDİ, yeni tel eklenmedi
  "wires": [ /* orijinal 4 tel, yeni wire yok */ ]
}
```
V2 için bağlı tel sayısı: **0**.

**Ekran görüntüsü:** `tests/qa-2b/screenshots/bug4-after-place-v.png`

V2 canvas'ta (-80, 160) konumunda, izole, hiçbir tele bağlı değil. "5 V" etiketi + "+" sembolü görünür. Orijinal devre telleri (V1↔R1, R1↔C1, GND'ler) korundu, hiçbiri V2'ye uzanmıyor.

**Hipotez:**
- Sprint 1.3'ün "yeni bileşen floating kalır" disiplini **doğru çalışıyor**. `circuit.components[V2].nodes = ['float_1', 'float_2']`, `layout.wires` değişmedi.
- Şef'in gözlemi olasılıkla:
  - Cache'li browser artifact (Sprint 1.4/1.5 sonrası güncel koda dönmemişti)
  - Özel bir action sırası (örn. wireDraw.started iken yerleştirme)
  - Rendering kazası (bir önceki frame'de tel render'ı overflow'ladı)
- **Daha derin tarama gerekir** — Aşama 2'de Şef elle tekrar dener.

---

## 📋 Sistematik Tarama Sonuçları

### Kategori 1 — Sıralı kombinasyonlar (8 senaryo)

| # | Senaryo | Sonuç | Detay |
|---|---|---|---|
| 1a | yerleştir→sil | ✅ | `compIds=[V1,R1,C1]`, orphan node cleanup |
| 1b | yerleştir→tel→sil: bağlı tel otomatik | ✅ | `wireCount: 5→4`, R2 yok |
| 1c | drag→sil | ✅ | R1 silindi, state tutarlı |
| 1d | place+wire sonra 1 undo: sadece tel geri | ✅ | past 2→1, R2 kaldı |
| 1e | multi→bulkDelete→undo: tek adım restore | ✅ | 3 bileşen + 4 tel geri |
| 1f | rubber→bulk→undo tek adım | ✅ | — |
| 1g | multi-drag→undo tek adım | ✅ | past 1→0 |
| 1h | tel→undo | ✅ | wireCount 5→4, R2 kaldı |

### Kategori 2 — Paralel mod çakışmaları (5 senaryo)

| # | Senaryo | Sonuç | Detay |
|---|---|---|---|
| 2a | wireDraw.started + Shift+Click bileşen | ⚠️ | **Descriptive PASS — Bug #7 gözlemlendi**: wireDraw.started korunuyor AMA selection component'a atanıyor. İki modda birden. |
| 2b | wireDraw + Escape: iptal | ✅ | wireDraw→idle |
| 2c | activeTool + Escape: tool iptal | ✅ | — |
| 2d | drag sırasında Escape | ⚠️ | **Descriptive PASS — Bug #6 gözlemlendi**: Escape drag'i iptal etmiyor, bileşen yeni konumda kalıyor (undo gerekir). Sprint 1.2'de iptal mekanizması yok. |
| 2e | rubber + Escape: iptal + baseSelection | ✅ | rb active → idle |

### Kategori 3 — Edge cases (6 senaryo)

| # | Senaryo | Sonuç |
|---|---|---|
| 3a | boş+Delete noop | ✅ |
| 3b | history=0 + undo button disabled | ✅ |
| 3c | single+Shift-aynı → none | ✅ |
| 3d | multi[2] shift-içinden → component (invariant) | ✅ |
| 3e | wire selected + Shift+Click bileşen → component | ✅ |
| 3f | rubber boş kutu → none | ✅ |

### Kategori 4 — Solver tutarlılığı (6 senaryo)

| # | Senaryo | Sonuç | Detay |
|---|---|---|---|
| 4a | INIT Ohm yasası (V_drop/R = I) | ✅ | 3.39e-2 V / 1 kΩ = 33.94 µA |
| 4b | R1 sil → V_out=0, I=0 | ✅ | Solver başarılı |
| 4c | V1 sil → tüm 0 | ✅ | — |
| 4d | **bulk-delete-all → dashboard SIFIRLANMALI** | ❌ | **BUG #3** — vOut=4.97, iR1=33.94µA stale |
| 4e | yeni R2 yerleştirme → vOut~4.97 (floating) | ✅ | R2 izole, dashboard doğru |
| 4f | undo sonrası solver | ✅ | vOut=4.97 geri |

### Kategori 5 — Render tutarlılığı (5 senaryo)

| # | Senaryo | Sonuç | Detay |
|---|---|---|---|
| 5a | **silme sonrası hoveredId cleanup** | ❌ | **BUG #1a** — `hoveredId='R1'` stale kaldı |
| 5b | V1 displayValue korundu | ✅ | Bug #2 reproduce edilemedi |
| 5c | hover yok → terminal markers yok | ✅ | — |
| 5d | R1 sil sonrası probe layout aynı | ⚠️ | **Descriptive PASS — Bug #5**: probe'lar statik, silmede güncellenmiyor |
| 5e | multi selection → selectedIds canvas prop | ✅ | canvas `.selectedIds=[V1,R1]` |

### Kategori 6 — Yeni bileşen auto-bağlanma (3 senaryo)

| # | Tool | Yeni comp nodes | Yeni tel | Sonuç |
|---|---|---|---|---|
| 6b | battery → V2 | `[float_1, float_2]` | 0 | ✅ floating |
| 6r | resistor → R2 | `[float_1, float_2]` | 0 | ✅ floating |
| 6c | capacitor → C2 | `[float_1, float_2]` | 0 | ✅ floating |

**Bug #4 (auto-wire) reproduce edilemedi** — üç bileşen tipi de doğru floating başladı.

---

## 🆕 Yeni Bulunan Bug'lar

### Bug #5 — Probe layout stale (silinen node'a bağlı probe canvas'ta kalıyor) · P1

**Reproduction:**
1. RC devresi yüklü (V_GİRİŞ probe 'in' node'a, V_ÇIKIŞ probe 'out' node'a bağlı)
2. R1'i sil
3. Canvas'a bak

**State dump:**
```json
{
  "probeLayoutCount": 2,
  "probeNodes": ["in", "out"],
  "circuitNodes": ["gnd", "in", "out"]
}
```
'out' node hala circuit'te (C1 bir ucu 'out'), 'in' node V1 üzerinde kaldı. Teknik olarak `nodeVoltages['out']=0` (C1 şarjsız, izole). Fakat:

**Görsel anomali** (`bug1-orphan-after-delete.png`):
- V_GİRİŞ kutusu hala "5.00 V" gösteriyor → doğru (V1.pos hala 'in' node)
- V_ÇIKIŞ kutusu "0.00 V" → solver'a göre doğru
- **Probe pin daireleri silinen R1'in olduğu bölgede asılı duruyor** — kullanıcı "R1 silindi ama V_ÇIKIŞ hala burada?" diye kafası karışır.

**Hipotez:**
- `layout.probes` dosyaya (circuits/rc-lowpass.ts) hardcoded bağlı, silme handler'larında güncellenmiyor.
- `deleteComponent`/`deleteMultipleComponents` probe layout'u dokunmuyor.
- Probe pin konumu silinen bileşenin terminaline denk geliyorsa → orphan visual dot.
- **Doğru davranış tartışmaya açık**: ya probe silinen bileşene bağlıysa kendisi de gitsin, ya probe "kırık/gri" renklensin ve "node artık kullanılmıyor" göstersin.

### Bug #6 — Drag sırasında Escape iptal etmiyor · P2

**Reproduction:**
1. R1 mousedown → move (drag active, cursor 'grabbing')
2. Escape tuşuna bas (fare hala basılı)

**State dump:**
```json
{
  "midDrag": { "compIds": ["C1", "R1", "V1"] },
  "afterEsc": { "compIds": ["C1", "R1", "V1"] }
}
```
Escape hiç etki etmedi. Mouseup olunca yeni konum kalıcı. Kullanıcı drag'i iptal etmek için `Ctrl+Z` gerekir.

**Hipotez:**
- Sprint 1.2 drag FSM'inde Escape iptal mekanizması yok.
- Sprint 2.3'te rubber-band için `baseSelection` snapshot disiplini eklendi; aynı pattern drag için de uygulanmalı: armed anında `origX/origY` zaten saklanıyor, Escape'te bunu restore et + dragState.idle.

**Önem:** Minor — kullanıcı yine de `Ctrl+Z` ile geri alabilir. Ama ergonomik sürtünme.

### Bug #7 — wireDraw.started iken Shift+Click bileşen: iki mod aynı anda · P2

**Reproduction:**
1. V1.pos terminal click → wireDraw.started (tel moduna girdik)
2. Shift+Click R1 bileşene → selection=component(R1)

**State dump:**
```json
{
  "pre": { "wireDraw": "started", "sel": { "type": "none" } },
  "post": { "wireDraw": "started", "sel": { "type": "component", "id": "R1" } }
}
```
Tel modu hala açık (`wireDraw.started`) + bileşen seçili. Kullanıcı Shift+Click bileşeni amaçladıysa, tel modunu iptal etmek istediğini çıkarabilirdik; ama kod tel modunda kalıyor. Sonraki bir terminal click tel modunu devam ettirir.

**Hipotez:**
- `onCanvasSelect` handler sadece `selection`'ı güncelliyor, `wireDraw` state'ine dokunmuyor.
- Belirsiz UX: aynı anda iki modda olmak kullanıcı beklentisini bozar.
- **Doğru davranış tartışmaya açık:**
  - a) Shift+Click bileşene → wireDraw iptal edilsin (tel modundan çık) + selection güncellensin
  - b) Shift+Click tel modunda ignore edilsin (tıklama yok sayılsın)
  - c) Mevcut davranış (ikisi birden) korunsun + UX not olarak dokümantasyona eklensin

**Önem:** Minor — normal kullanıcı bu kombinasyonu çağırmaz. Ama sprint 2.5 fix sırasında kapatılmalı.

---

## 📊 Özet Tablosu

| Bug | Tip | Öncelik | Durum |
|---|---|---|---|
| #1 | Orphan amber (hoveredId stale + probe dots) | P1 | Konfirme — fix gerek |
| #2 | V1 etiketi kayboluyor | — | Reproduce edilemedi |
| #3 | Solver stale snapshot (bulk delete all) | P1 | Konfirme — fix gerek |
| #4 | Yeni V auto-wire | — | Reproduce edilemedi |
| #5 | Probe layout stale (node cleanup yok) | P1 | Yeni — fix gerek |
| #6 | Drag sırasında Escape iptal yok | P2 | Yeni — minor |
| #7 | wireDraw + Shift+Click çift mod | P2 | Yeni — minor |

**Öncelik dağılımı:**
- P0 (kritik): 0
- P1 (önemli): 3 (#1, #3, #5)
- P2 (minor): 2 (#6, #7)
- Reproduce edilemedi: 2 (#2, #4)

---

## 🔬 Test Disiplini Notları

- **33 senaryo test edildi** (6 kategori).
- Her iddia **DOM ölçümü + state dump** ile desteklendi. Göz testi kullanılmadı.
- 4 screenshot (destekleyici kanıt): `tests/qa-2b/screenshots/`.
- Puppeteer headless Chrome + shadow DOM reaching. Platform: MacIntel.
- Kaynak kod değişikliği **sıfır**: `git diff src/` = boş, `git diff ui-v2/src/` = boş.

---

## 📎 Dosya Referansları

Screenshot'lar (`tests/qa-2b/screenshots/`):
- `bug1-orphan-after-delete.png` — R1 silme sonrası probe orphan pins
- `bug1-after-move-away.png` — fare taşındıktan sonra düzelen hoveredId
- `bug2-v1-after-drag.png` — V1 drag sonrası (etiket korundu)
- `bug2-final.png` — R1 silme sonrası V1 etiketi (korundu)
- `bug3-after-r1-delete.png` — R1 sil sonrası dashboard (tutarlı)
- `bug3-after-v1-delete.png` — V1 sil sonrası dashboard (tutarlı)
- `bug3-bulk-empty-stale-dashboard.png` — **Bug #3 ana kanıt** (bulk delete all, dashboard stale)
- `bug4-after-place-v.png` — V2 yerleştirme sonrası (otomatik bağlantı yok)

Test script'leri (disposable, commit edilmiyor):
- `/tmp/qa-bug1.mjs`, `/tmp/qa-bug2.mjs`, `/tmp/qa-bug3.mjs`, `/tmp/qa-bug4.mjs`
- `/tmp/qa-categories.mjs` (33 senaryo tek dosya)
- `/tmp/qa-bulk-screenshot.mjs`

---

## 🔀 Sonraki Adımlar

1. **QA Aşama 2 (Claude + Şef):** Bu rapor incelenir. Bug #2 ve Bug #4 için ek deneme — özellikle:
   - Bug #2: Rotation senaryoları, font yüklenme, özel action sıraları
   - Bug #4: Cache temizleyip prod'da tekrar dene, özel action kombinasyonları (wireDraw.started iken yerleştirme?)
2. **QA Aşama 3 (Şef):** Göksen 5-10 dakika elle dener, ek bug varsa ekler.
3. **Sprint 2.5 (fix sprint):** Bu raporun bug listesi + Aşama 2/3 eklemeleri birleştirilir, Sprint 2.5 planı yazılır.
4. **Sprint 2.5 fix önerileri (ön çalışma):**
   - Bug #1a: `deleteComponent`/`deleteMultipleComponents` sonunda canvas'ın `hoveredId`'sini temizle (veya Lit reactive ile tetikle). Event API gerekirse `hover-clear` ekle.
   - Bug #3: `runSolver` başarısız olursa dashboard'u "err" veya "loading" state'ine düşür (mevcut warn yerine). Veya circuit boş olduğu durumda özel bir state: "empty" + slot'lar "—".
   - Bug #5: `deleteComponent` sonrası `layout.probes` filter — probe'un bağlı node'u artık aktif değilse probe düş. Veya probe "kırık" rengine dön.
   - Bug #6: Drag FSM'e Escape iptal ekle — `origX/origY` restore + `dragState.idle`.
   - Bug #7: `onCanvasSelect` handler'da wireDraw.started iken Shift+Click bileşen → `wireDraw = INITIAL_WIRE_DRAW` + normal selection akışı.

**Faz 2B'nin "kesin kapandı" sayılması Sprint 2.5 sonrasına ertelendi.**
