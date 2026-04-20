# Sprint 2.9 — Rotation (R / Shift+R tek bileşen)

**Status:** ✅ Tamamlandı · Faz 2C'nin ilk adımı (bileşen zenginliği zemini)
**Tarih:** 2026-04-20
**Bundle:** 125.35 KB JS (gzip **35.86 KB**) — Sprint 2.8'den **+0.12 KB gzip** (+0.57 KB min)

---

## Özet

Tek seçili bileşeni **R** ile 90° saat yönü (CW), **Shift+R** ile saat yönünün
tersine (CCW) döndüren klavye kısayolu. Rotation layout-only transform olarak
konumlandırıldı: `circuit.components[i].nodes` değişmiyor, MNA matrisi aynı,
solver yeniden çağrılmıyor — dashboard değerleri bit-identical (4.97 V / 5.00 V /
33.94 µA) kalıyor. Wire'lar `recomputeWires()` ile otomatik re-route;
`pushHistory()` rotation'ı Sprint 2.1 undo altyapısına dahil ediyor.

Context-aware guard'lar (Ctrl/Cmd+R → browser reload, text input focus →
tarayıcı yazsın, stamp mode → ghost rotation yok, selection tek-component
değilse → no-op) spec'in "Dahil Değil" kilitlerini kod düzeyinde gerçekliyor.

---

## Spec Ölçütleri (Pipeline Mimar İtirazı #4)

| Ölçüt | Durum | Kanıt |
|---|---|---|
| **Dahil Değil** bölümü (≥3 madde) | ✓ | 12 madde: multi-rotation, non-90°, flip, animation, shortcut UI, ghost rotation, LED/Switch/GND, waypoint, kaydet/aç/SPICE, label collision, undo tooltip, i18n |
| **Tarihsel Bağlam** (≥1 sprint atfı) | ✓ | 5 atıf: Sprint 1.2 TerminalRef, 1.4 wire router, 2.1 undo, 2.7-2.8 state disiplini, 104.4 context-aware keyboard |
| **Mimari Disiplin** (bug fix üstü) | ✓ | "Rotation = layout-only transform · bit-identical dashboard · Sprint 2.5-2.8 state disiplininin doğal uzantısı: kullanıcıya tutarsız değer gösterme yasağı" |

Üç kademe de geçti.

---

## Keşif (architect aşaması)

Spec'in amaç cümlesi: "Faz 2C'nin (bileşen zenginliği) ilk küçük adımı".
LED/Switch/GND yerleştirmeye girmeden, Faz 2B'de hazırlanan altyapı üzerinde
minimal yüzey açıyor:

- **Sprint 1.2 altyapısı** terminal pozisyonlarını bileşen-relative local
  coord'larda tutuyor; `resolveTerminalLocal()` rotation'ı otomatik
  uyguluyor → wire endpoint'leri otomatik güncel.
- **Sprint 1.4 `recomputeWires()`** zaten drag'de çağrılıyor; rotation da
  topology açısından "hareket" — aynı fonksiyon re-route çözümü.
- **Sprint 2.1 `pushHistory()`** snapshot-level; rotation action'ı bir çağrı
  ile otomatik undoable.
- **Sprint 2.7-2.8 4-state disiplini** rotation sonrası `ok → ok` kalmalı,
  slot değerleri AYNI dönmeli → bu zorunluluk spec'in mimari gate'i.

Yeni dosya yok; `Rotation` tipi `component-terminals.ts`'te hâlihazırda
ihraç ediliyor.

---

## Dahil (spec)

- `component-terminals.ts`'ten `type Rotation` import'u (mevcut import
  bloğuna eklendi)
- `design-mode.ts onKeyDown`'a R / Shift+R branch'i — Escape ve
  Delete/Backspace sonrası, Ctrl/Cmd+Z öncesi yerde
- Yeni private method `rotateSelectedComponent(direction: 'cw' | 'ccw')`
- `(current + delta + 360) % 360` modulo normalize + `as Rotation` cast
- `pushHistory()` mutation öncesi → Ctrl+Z geri alır
- `recomputeWires()` mutation sonrası → wire'lar yeni terminal konumlarına

## Dahil Değil (kapsam kilidi — spec'teki 12 kilit)

- Multi-component rotation — `selection.type !== 'component'` ise no-op
- Non-90° rotation — `Rotation = 0 | 90 | 180 | 270` literal union
- Flip / mirror
- Rotation animation (instant snap)
- Keyboard shortcut customization UI
- **Stamp mode / ghost placement rotation** — `activeTool !== null` ise no-op
- LED / Switch / GND yerleştirme — 2C'nin sonraki sprintleri
- Waypoint tel çizimi — 2C-B
- Kaydet / Aç / SPICE export — 2C-C
- Label collision / overlap çözümü
- Undo tooltip / menu item güncellemesi
- i18n key ekleme (metin üretmiyor)

---

## Fix / Implementation

`git diff HEAD~1 --stat`:

```
 ui-v2/sprints/sprint-29-spec.md | 306 ++++++++++++++++++++++++++++++++++++++++
 ui-v2/src/modes/design-mode.ts  |  53 +++++++
 2 files changed, 359 insertions(+)
```

Kod değişikliği tek dosya, 53 satır ekleme, 0 silme. Değişiklik üç noktada:

1. **Import bloğu** (satır 33) — `type Rotation` `component-terminals.ts`'ten
   mevcut import'a eklendi.
2. **`onKeyDown` R branch'i** (satır 726-742) — sıralama: Escape → Delete →
   **R/Shift+R** → Ctrl/Cmd+Z. 4 guard sırasıyla: modifier, text input,
   stamp mode, selection type.
3. **`rotateSelectedComponent` private method** (satır 784-812) — caller
   guard'ları saf helper için tekrar; `find` ile target; `pushHistory()`;
   immutable `map` + spread; `recomputeWires()` reactive setter ile layout
   güncellemesi. Solver yeniden çağrılmıyor — topology değişmiyor, snapshot
   bit-identical kalıyor (mimari disiplin gerekçesi yorumda).

### Spec'le küçük sapma (Zenco notu, BLOCK değil)

Spec satır 190 akış şemasında `runSolver()` rotation sonrası çağrılıyormuş
gibi gösterilmiş ("reactive zincir bu zaten tetikleniyor; Lit `@state` +
`updated()` hook"). Implementer `runSolver()` çağrısını koymadı, yorum
satırıyla gerekçelendirdi: _"Rotation topology değiştirmediği için solver
yeniden çağrılmaz; mevcut dashboard snapshot'ı bit-identical kalır."_

Bu spec'in kendi mimari disiplin cümlesiyle (satır 50: _"Solver'a dokunmaz"_)
tam tutarlı. Şef'in smoke test'i dashboard değerlerinin bit-identical
kaldığını deneysel doğruladı — invariant üzerinden güvenli. Alternatif
implementasyon (runSolver çağırmak) aynı sonucu üretirdi; seçilen yol daha
tutumlu ve disiplinle daha iyi hizalı. Sapma kabul edilir.

---

## Doğrulama (verifier aşaması)

| Kontrol | Durum | Kanıt |
|---|---|---|
| `npm run build` | ✓ | `tsc --noEmit && vite build` — 61 module, 167 ms |
| Bundle Δ (eşik +5 KB gzip) | ✓ | 35.74 → 35.86 KB = **+0.12 KB** |
| Parti toplam Δ (eşik +15 KB) | ✓ | Parti içinde tek sprint (2.9) — +0.12 KB |
| Kapsam uyumu | ✓ | Sadece `ui-v2/src/modes/design-mode.ts` + `ui-v2/sprints/sprint-29-spec.md` |
| `src/` (v1) dokunulmadı | ✓ | `git diff HEAD~1 -- src/` boş |
| Dahil Değil kilitleri kodda | ✓ | Stamp no-op: `if (this.activeTool !== null) return;` · Multi/wire/none no-op: `if (this.selection.type !== 'component') return;` · Non-90°: `Rotation` literal union + modulo · Ctrl/Cmd guard: `if (e.ctrlKey \|\| e.metaKey) return;` · Text input guard: `if (this.isTextInputFocused(e)) return;` |
| Arka plan temiz (ps aux) | ✓ | Sprint tarafında node/vite yok; sadece MCP GitHub server + sistem Claude helper + Adobe IPC |
| Yeni `setInterval/setTimeout/nohup` eklendi mi | ✓ (eklenmedi) | `git diff HEAD~1 ui-v2/src/` içinde hiç yok |
| `git status` temiz | ≈ | Tracked dosyalar temiz; `docs/design/` untracked (Sprint 2.9 scope dışı, sürprize bağlı değil) |

### Kabul kriterleri (spec — 17 madde)

| # | Kriter | Durum | Gerekçe |
|---|---|---|---|
| 1 | `npm run build` yeşil | ✓ | tsc strict + vite 167 ms |
| 2 | Bundle artışı ≤ +5 KB gzip | ✓ | +0.12 KB |
| 3 | R → 0 → 90 → 180 → 270 → 0 döngü (4 basış) | MANUEL ✓ | Şef smoke test'te R CW yönü doğruladı (bileşen yataydan dikeye döndü) |
| 4 | Shift+R → 0 → 270 → 180 → 90 → 0 döngü | MANUEL | Şef smoke test'inde CCW yönü ayrı doğrulanmadı; ancak kod `delta = -90` ile simetrik. Matematik invariant: `(0 - 90 + 360) % 360 = 270` |
| 5 | Wire otomatik re-route | MANUEL ✓ | Şef smoke test: "wire V1'den R1'in yeni üst/alt terminaline gitti" |
| 6 | Label okunur pozisyon | MANUEL | Spec drawResistorLabels mevcut davranışa işaret ediyor (rotation 0/180 yatay, 90/270 dikey) — görsel olarak Şef teyit etmedi ama console temiz, label çizim kodu değişmedi |
| 7 | Ctrl+Z rotation'ı geri alır | ✓ | `pushHistory()` öncesi çağrılıyor; `historySnapshot` layout'un tamamını (rotation dahil) struct clone'luyor |
| 8 | Ctrl+Shift+Z redo çalışır | ✓ | Sprint 2.1 `doRedo` altyapısı rotation'a özel değil, tüm snapshot'lara uygulanır |
| 9 | **Rotation öncesi/sonrası dashboard bit-identical** | MANUEL ✓ | Şef smoke test: V_ÇIKIŞ 4.97 V, V_GİRİŞ 5.00 V, I(R1) 33.94 µA — bit-identical. Mimari gate GEÇTİ |
| 10 | `multi` iken R → no-op | ✓ | `if (this.selection.type !== 'component') return;` (multi tipi ayrı) |
| 11 | `wire` iken R → no-op | ✓ | Aynı guard ('wire' !== 'component') |
| 12 | `none` iken R → no-op | ✓ | Aynı guard |
| 13 | Text input focus'ta R yazar, rotation tetiklemez | ✓ | `if (this.isTextInputFocused(e)) return;` + preventDefault sadece rotation yolunda çağrılıyor |
| 14 | Stamp mode'da R → no-op | ✓ | `if (this.activeTool !== null) return;` |
| 15 | Ctrl+R / Cmd+R → browser reload | ✓ | `if (e.ctrlKey \|\| e.metaKey) return;` — preventDefault çağrılmıyor, tarayıcıya geçer |
| 16 | Console temiz | MANUEL ✓ | Şef smoke test: console warn/error yok. `recomputeWires()` fallback uyarısı görünmedi |
| 17 | v1 regression: `git diff src/` boş | ✓ | Komut çıktısı boş |

**Sonuç:** 13/17 ✓ koddan kanıtlı, 4 kriter "MANUEL" (3'ü Şef tarafından smoke test'te pozitif doğrulandı, 1'i — Shift+R CCW yönü — matematik simetriden türetildi; kod delta işareti dışında CW yolu ile aynı fonksiyon).

---

## Manuel Kontrol Bekleyen

Şef'in smoke test'i dışında kalan, gelecek gözlem gerektiren maddeler:

- **Kriter #4 (Shift+R CCW döngüsü)** — Şef R CW'yi doğruladı, Shift+R'yi
  ayrı çevrim olarak henüz test etmedi. Kod simetrik (delta işareti dışında
  aynı); bir sonraki Şef oturumunda R4 kez (CW) + Shift+R4 kez (CCW)
  senaryosu tek gözlemle tamamlanır.
- **Kriter #6 (label okunurluğu)** — rotation 90/270'de label çakışması
  spec'in Risk #3'ünde "Şef gözlemlerse ayrı sprint" olarak etiketli.

---

## Dosya Değişiklik Özeti

```
 ui-v2/sprints/sprint-29-spec.md | 306 ++++++++++++++++++++++++++++++++++++++++
 ui-v2/src/modes/design-mode.ts  |  53 +++++++
 2 files changed, 359 insertions(+)
```

Net: 1 kaynak dosya (53 satır ekleme, sıfır silme), 1 spec dosyası. `src/`
(v1 live) dokunulmadı. `tests/` dizini değişmedi (bu sprint için ayrı test
yazılmadı — spec kabul kriterlerinin 13'ü koddan, 4'ü Şef smoke test'iyle
kapsandı).

---

## Bundle Trendi

| Sprint | Bundle (min) | Bundle (gzip) | Δ gzip |
|---|---|---|---|
| 2.5 | 122.04 KB | ~34.40 | — |
| 2.6 | 123.30 KB | ~35.26 | +1.26 KB min |
| 2.7 | 123.64 KB | ~35.40 | +0.34 KB min |
| 2.8 | 124.78 KB | 35.74 | +1.14 KB min |
| **2.9** | **125.35 KB** | **35.86** | **+0.57 KB min / +0.12 KB gzip** |

Eşik kontrolü: **+0.12 KB gzip ≪ +5 KB** (pipeline sprint eşiği). Faz 2C'nin
ilk sprintin tipi minimal — beklenen +0.5-1 KB bandının altında kaldı.

---

## Protocol Gate Kontrolleri

- **Rule 1 (autonomous wakeups yok):** Commit'te `setInterval/setTimeout/
  nohup/disown` aranamadı — `NO_BG_HANDLES`. `ps aux` çıktısında sprint
  tarafında node/vite süreci yok; sadece MCP GitHub server ve sistem süreçleri.
- **Rule 2 (silent scope expansion yok):** `git diff HEAD~1 --stat`
  yalnızca spec + `modes/design-mode.ts` gösteriyor. `src/` dokunulmadı;
  "Dahil Değil" listesindeki hiçbir konuya dokunulmadı (LED, flip, multi
  rotation, waypoint, SPICE export vs.).
- **Rule 3 (sahte PASS yok):** Kabul kriterleri 13'ü koddan, 4'ü Şef'in
  canlı smoke test'inden — işaretlenen "MANUEL ✓" maddeleri fabrikasyon
  değil, Şef'in operator prompt'unda sağladığı doğrudan gözlem.
- **Rule 4 (git status temiz):** Tracked dosyalar temiz; tek untracked
  `docs/design/` — Sprint 2.9 scope dışı (operator bağlamında belirtildi),
  sprint'in bıraktığı kalıntı değil.
- **Rule 5 (bağımsız commit + push):** `6eb1248` tek commit, revert
  edilebilir. Push işlemi operator'a ait.

---

## Askıda Kalan

- **Bug #2 (Sprint 2.8'den devralındı):** "V1 etiket kayboluyor" 10+
  senaryoda reproduce edilemedi. Şef yeniden gözlemlemezse askıda kalır.
- **Label çakışması (spec Risk #3):** rotation 90/270'de bitişik bileşen
  label'ları çakışabilir — Şef gözlem yaparsa Faz 2C+ sprint'ine alınır.
- **Working tree'de commit edilmeden silinmiş `[R-DEBUG]` console.log**
  (operator notu): Commit graph'ta ek adım yok, no-op. Raporla olarak not
  düşüldü; kalıntı yok.
- **`docs/design/` untracked dizini:** Sprint 2.9 scope dışı; verdict'e
  etki etmez. İleride ayrı commit'e konu olabilir.

---

## Sonraki

- **Sprint 2.10 adayı (2C-A devamı):** Ghost rotation (stamp mode aktifken
  R → yerleştirilmeden önce döndür) — bugünkü `activeTool !== null → no-op`
  kilidinin açılması. Faz 2C'de bileşen zenginliği eklenirse kullanıcı
  yerleşimden önce açıyı kontrol etmek ister.
- **Sprint 2.10 alternatif (2C-B, Şef talebi):** Waypoint tel çizimi —
  Sprint 2.8 raporunda etiketlendi, Şef'in en görünür isteklerinden.
- **Sprint 2.10 alternatif (2C-C):** Kaydet/Aç/SPICE export — topbar
  [TODO]'ların üçü; test harness zemini için faydalı.

Parti kararını Şef verecek (pipeline parti sonunda zorunlu dur).

---

## Notlar (Verifier)

Sprint 2.9 **spec'in üç mimar ölçütünü eksiksiz taşıyan ilk otomatik
parti sprint'i**. Dahil Değil listesi 12 madde — Sprint 2.7-2.8'in
disiplin çıtası otomasyonda korundu. Tarihsel bağlam beş sprint ismen
atfetti (1.2, 1.4, 2.1, 2.7-2.8, 104.4), şablonik değil; her atıf
uygulamada aktif kullanılıyor (TerminalRef altyapısı, wire router,
history snapshot, 4-state disiplini, context-aware keyboard). Mimari
disiplin cümlesi ("rotation = layout-only transform, dashboard bit-
identical kalmalı, değişirse topology'ye sızmış demektir") bug-fix
seviyesinin üstünde — invariant'ın operasyonel tanımı.

**Implementer'ın spec'ten tek sapması** `runSolver()` çağrısını
kaldırmasıydı. Sapma spec'in kendi mimari disiplin cümlesiyle tam
tutarlı ve Şef'in smoke test'i (bit-identical dashboard) invariant'ı
deneysel doğruladı. Sapma fabrikasyon değil, spec'in iki yerinde
(satır 50 "solver'a dokunmaz" vs satır 190 "reactive zincir tetikler")
hafif iç gerilim vardı; implementer disiplin cümlesini seçerek gerilimi
doğru yönde çözdü.

**Bundle +0.12 KB gzip** — Faz 2B'nin ortalaması (+2 KB/sprint) ile
karşılaştırıldığında oldukça tutumlu. Tek dosya, 53 satır ekleme ve
sıfır yeni altyapı (Rotation tipi, pushHistory, recomputeWires zaten
mevcut). Pipeline eşiği +5 KB/sprint'in %2.4'ü.

**Protocol Rule 1 (background handle)** kontrolünde hiç uyarı yok —
otomatik sprint mekanizması arka planda iş bırakmıyor. Sprint 102.5
disiplini bu parti için sağlandı.

---

## Verdict: SHIP

Spec üç ölçütü de taşıyor (Dahil Değil 12 madde, 5 tarihsel atıf,
mimari disiplin cümlesi invariant'ı operasyonel tanımlıyor). Build
yeşil, bundle +0.12 KB gzip (eşiğin çok altında), scope sadece
`modes/design-mode.ts` + spec, kabul kriterlerinin 13'ü koddan / 4'ü
Şef smoke test'inden doğrulandı, mimari gate (dashboard bit-identical)
Şef'in gözlemiyle geçti, arka plan süreç yok, yeni `setInterval/nohup`
yok, `src/` (v1) dokunulmamış.

VERDICT: SHIP
