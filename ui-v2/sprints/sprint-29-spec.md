status: READY_FOR_VERIFY

# Sprint 2.9 — Rotation (R / Shift+R tek bileşen)

## Amaç

Faz 2C'nin (bileşen zenginliği) ilk küçük adımı. Tek seçili bileşeni R
tuşu ile 90° CW, Shift+R ile 90° CCW döndürmek. Döndürme **layout-only
transform**: bileşenin `rotation` açısı değişir, `nodes` listesi
değişmez, solver yeniden hesaplar (wire endpoint'leri yeni terminal
konumlarına göre re-route edilir) ama sayısal sonuç aynı çıkar.

Hedef: Faz 2C'ye dokunan minimal zemini koymak. Yeni bileşen
(LED/Switch/GND) veya yeni solver yok — sadece var olan R/C/V
bileşenlerinin oryantasyonu. Waypoint, multi-rotation, flip gibi
özellikler ayrı sprintlere bırakıldı.

## Tarihsel Bağlam

- **Sprint 1.2 TerminalRef altyapısı:** Terminal pozisyonları
  bileşen-relative local coord'larda (örn. `R.t1 = { x: -40, y: 0 }`).
  `resolveTerminalLocal()` rotation'ı otomatik uyguluyor — rotation
  sonrası wire endpoint'leri yeni terminal konumlarında doğru
  döner. Bu sprint bu altyapıyı kullanıyor, genişletmiyor.
- **Sprint 1.4 wire router:** `recomputeWires()` bileşen hareketinde
  (drag) çağrılıyor, tüm wire'ları L/U heuristik ile yeniden route
  ediyor. Rotation da topology açısından bir "hareket" — aynı
  `recomputeWires()` çağrısıyla wire'lar otomatik güncellenir.
  Sprint 2.4 multi-drag'te aynı pattern kullanıldı.
- **Sprint 2.1 undo altyapısı:** `pushHistory()` snapshot-level —
  her undoable action öncesi `structuredClone` ile tam `circuit +
  layout` kopyası alınır. Rotation action'ı `pushHistory()` çağırdığı
  an otomatik undoable olur (altyapıya dokunmaya gerek yok).
- **Sprint 2.7-2.8 state disiplini:** Dashboard 4-state simetrisi
  (`ok / empty / floating / err`) korunur. Rotation topology'yi
  bozmadığı için `ok` → `ok` kalmalı, slot değerleri AYNI dönmeli.
- **Sprint 104.4 context-aware keyboard disiplini:** VoltXAmpere v1'de
  klavye kısayolları context'e göre farklı davranır (stamp mode vs
  selection mode). Bu sprintte R tuşu aynı disipline uyar (bkz.
  Varsayımlar #1).

## Mimari Disiplin

**Rotation = layout-only transform.** Circuit topology değişmez,
sadece `layout.components[i].rotation` açısı değişir. Solver'a
dokunmaz. `circuit.components[i].nodes` aynen kalır; wire'lar
terminal referansı ile bağlı olduğundan otomatik yeni konumlara
taşınır.

**Doğrulama kriteri:** Rotation öncesi/sonrası dashboard değerleri
(vIn, vOut, iR1) **bit-identical** olmalı. Değişirse mimari bug var
demektir — rotation sessizce circuit semantiğine sızmış olur.

Bu disiplin Sprint 2.5-2.8 state disiplininin doğal uzantısı:
"kullanıcıya asla tutarsız değer gösterme". Rotation görsel bir
düzenleme aracıdır, ölçüm değerlerini değiştirmemelidir.

## Dahil

- `Rotation` tipinin `component-terminals.ts`'ten ihraç edilmesi
  (zaten `export` — doğrulandı).
- `design-mode.ts` `onKeyDown()` içine **R / Shift+R** branch'i.
- Yeni private method: `rotateSelectedComponent(direction: 'cw' |
  'ccw')` — selection tek bileşense çalışır, multi/wire/none'da
  no-op.
- Rotation adımı 90° (saat yönü CW) veya -90° (CCW). Normalizasyon:
  `(current + 360) % 360` → {0, 90, 180, 270}.
- `pushHistory()` çağrısı rotation öncesinde → Ctrl+Z rotation'ı
  geri alır.
- `recomputeWires()` rotation sonrasında çağrılır → teller yeni
  terminal konumlarına route edilir.
- `runSolver()` yeni layout ile çağrılır (mevcut reactive zincir bu
  zaten tetikleniyor; Lit `@state` + `updated()` hook).
- Puppeteer veya manuel olarak doğrulanacak: rotation öncesi vOut
  snapshot'ı ve rotation sonrası vOut snapshot'ı — fark < 1e-12
  olmalı (ideal: tam eşit).

## Dahil Değil

- **Multi-component rotation YOK.** Selection `multi` ise R tuşu
  no-op. Grup rotation (pivot merkezi, selection AABB merkezi?)
  ayrı sprint.
- **Non-90° rotation YOK.** 15°, 45°, keyfi açı yok. `Rotation`
  tipi `0 | 90 | 180 | 270` literal union olarak kalır.
- **Flip / mirror YOK.** Ayrı semantik (negative scale) — ayrı
  sprint.
- **Rotation animation YOK.** Anında snap. Geçiş animasyonu Faz 3+
  ile değerlendirilir.
- **Keyboard shortcut customization UI YOK.** R sabit — kullanıcı
  değiştiremez.
- **Stamp mode / ghost placement rotation YOK.** `activeTool`
  aktifken R tuşu hiçbir şey yapmaz (no-op). Yerleştirilecek
  bileşenin rotation'u kodda sabit 0. Ghost rotation ayrı sprint.
- **LED / Switch / GND yerleştirme YOK.** Bunlar Faz 2C'nin
  sonraki sprintlerinde.
- **Waypoint tel çizimi YOK.** Şef'in istediği özellik ama ayrı
  sprint (Sprint 2.8 raporu 2C-B olarak etiketlemişti).
- **Kaydet / Aç / SPICE export YOK.** Ayrı sprint (2C-C).
- **Label collision / overlap çözümü YOK.** Rotation sonrası
  bitişik bileşenlerin label'ları çakışırsa Şef rapor eder, ayrı
  sprint'e alınır.
- **Undo tooltip / menu item güncellemesi YOK.** Topbar undo
  butonu zaten reaktif (Sprint 2.4) — ek metin gerekmez.
- **i18n key'i YOK.** Rotation action görünür metin üretmediği
  için STR tablosuna dokunulmaz.

## Dokunulacak dosyalar

- `ui-v2/src/modes/design-mode.ts`:
  - `onKeyDown()` — R / Shift+R branch'i eklenir (text input guard,
    Cmd/Ctrl guard, selection guard dahil).
  - Yeni private method: `rotateSelectedComponent(direction)`.
  - Yeni private helper (inline veya private method):
    `nextRotation(current, direction)` — math.

## Yeni dosyalar (varsa)

Yok. Rotation helper'ları `component-terminals.ts`'te mevcut
(`rotatePointCW`, `Rotation` tipi). Yeni dosya gerekmez.

## API / Davranış

### Keyboard event router (design-mode.ts → onKeyDown)

Mevcut sıralama:
1. Escape (placement/wire/rubberband/drag iptal)
2. Delete/Backspace (selection silme)
3. Ctrl/Cmd+Z / Ctrl+Y (undo/redo)

**YENİ Branch (Ctrl/Cmd guard'ından ÖNCE, Delete/Backspace'ten SONRA):**

```ts
// Sprint 2.9: R / Shift+R → tek seçili bileşeni 90° döndür.
// Context-aware: text input focus'ta no-op, stamp mode'da no-op,
// selection !== 'component' ise no-op.
if (e.key === 'r' || e.key === 'R') {
  // Ctrl/Cmd ile kombine ise browser shortcut (Ctrl+R = reload) —
  // karışmasın, biz sadece bare R / Shift+R'yi kullanıyoruz.
  if (e.ctrlKey || e.metaKey) return;

  if (this.isTextInputFocused(e)) return;

  // Sprint 2.9 / stamp mode no-op: activeTool aktifken R ghost'u
  // döndürmüyor (Dahil Değil: ghost rotation). Kullanıcı önce
  // yerleştirsin, sonra seçip döndürsün.
  if (this.activeTool !== null) return;

  // Sadece tek bileşen seçiliyse rotate.
  if (this.selection.type !== 'component') return;

  e.preventDefault();
  this.rotateSelectedComponent(e.shiftKey ? 'ccw' : 'cw');
  return;
}
```

### rotateSelectedComponent(direction: 'cw' | 'ccw')

İmza ve davranış:

```ts
private rotateSelectedComponent(direction: 'cw' | 'ccw'): void {
  // Guard re-check — caller zaten kontrol etti ama helper saf olsun.
  if (this.selection.type !== 'component') return;
  const id = this.selection.id;

  const target = this.layout.components.find((c) => c.id === id);
  if (!target) return;

  // Sprint 2.1: action öncesi snapshot.
  this.pushHistory();

  // Sprint 1.2 Rotation tipi 0/90/180/270 — normalize.
  const delta = direction === 'cw' ? 90 : -90;
  const next = ((target.rotation + delta + 360) % 360) as Rotation;

  const newComponents = this.layout.components.map((c) =>
    c.id === id ? { ...c, rotation: next } : c,
  );

  // Sprint 1.4: wire router çağır — terminal konumları değişti,
  // tel'ler yeniden route olmalı.
  this.layout = this.recomputeWires({
    ...this.layout,
    components: newComponents,
  });

  // Reactive zincir: Lit @state setter → updated() → runSolver()
  // (mevcut davranış, dokunulmaz). Rotation topology değiştirmediği
  // için solver aynı sonucu üretmeli — mimari disiplin kontrolü.
}
```

### Tip import'u

`design-mode.ts`'in üstünde:

```ts
// Mevcut import'lara ek (ya da var olanı genişlet):
import type { Rotation } from '../interaction/component-terminals.ts';
```

Eğer `Rotation` şu an `design-mode.ts`'te zaten kullanılıyorsa
(hit-test veya placement yolunda), yeni import gerekmez — mevcut
import'u tekrar kullan.

### Event akışı özet

```
Kullanıcı R1'i seçti → selection = { type: 'component', id: 'R1' }
Kullanıcı 'R' bastı (bare, no text focus, no stamp)
  → onKeyDown R branch
  → rotateSelectedComponent('cw')
  → pushHistory()  (past'a snapshot)
  → layout güncelle (R1.rotation: 0 → 90)
  → recomputeWires()  (V1.pos↔R1.t1 wire'ı yeniden route)
  → @state setter → Lit requestUpdate
  → updated() → runSolver()  (mevcut davranış)
  → dashboard = { kind: 'ok', ... }  (AYNI vOut/iR1)
```

## Kabul kriterleri

- [ ] `npm run build` yeşil (tsc strict + vite)
- [ ] Bundle artışı ≤ +5 KB gzip (tahmin: ~0.5-1 KB, yeni method +
      branch küçük)
- [ ] Bileşen seç (örn. R1) + R → rotation 0 → 90 → 180 → 270 → 0
      döngüsü (4 kez R basınca başa dön)
- [ ] Bileşen seç + Shift+R → rotation 0 → 270 → 180 → 90 → 0
      (CCW döngüsü)
- [ ] Wire'lar rotation sonrası otomatik re-route (tel bitim
      noktaları yeni terminal konumlarında — görsel olarak kopuk
      tel YOK)
- [ ] Label okunur pozisyonda kalır (rotation 0/180 yatay id+value,
      90/270 dikey id+value — mevcut drawResistorLabels davranışı)
- [ ] Ctrl+Z rotation'ı geri alır (eski rotation + eski wire
      rotası)
- [ ] Ctrl+Shift+Z redo çalışır
- [ ] **Rotation öncesi vs sonrası dashboard değerleri AYNI**
      (mimari disiplin gate): vIn, vOut, iR1 bit-identical veya
      |Δ| < 1e-12. Farklı çıkarsa BLOCK.
- [ ] Selection `multi` iken R → no-op (console temiz, layout
      değişmedi, history'ye snapshot girmedi)
- [ ] Selection `wire` iken R → no-op
- [ ] Selection `none` iken R → no-op
- [ ] Text input focus'ta R → tarayıcı "r" harfi yazar, rotation
      tetiklenmez
- [ ] `activeTool !== null` (stamp mode) iken R → no-op
- [ ] Ctrl+R / Cmd+R → browser reload (biz yakalamıyoruz)
- [ ] Console temiz (warn/error yok)
- [ ] v1 regression: `git diff src/` boş
- [ ] Manuel kontrol noktası: Şef dev server'da RC preset'te R1'i
      seçip R'ye basar, R1 dikeye döner, wire V1'den R1'in yeni
      üst/alt terminaline gider, vOut hâlâ 4.97 V, iR1 hâlâ 33.94
      µA. Ctrl+Z → yatay R1 geri gelir.

## Riskler

- **Risk 1 (düşük):** `recomputeWires()` rotation sonrası wire'ın
  routing'ini bulamayıp fallback+warn'a düşebilir (Sprint 1.4
  U-şekli fallback). Mitigasyon: kabul kriterinde "console temiz"
  var — fallback warning görünürse verifier BLOCK verir, Zenco
  obstacle avoidance geliştirme ihtiyacını raporlar (ayrı sprint).
- **Risk 2 (düşük):** Dashboard değerleri rotation sonrası minik
  farklılık gösterebilir — reactive zincirde solver re-initial
  condition farklı noktalardan başlarsa. Mitigasyon: kabul
  kriterinde `|Δ| < 1e-12` toleransı. Daha fazla fark çıkarsa
  topology'ye sızmış demektir → BLOCK.
- **Risk 3 (düşük):** Label rotation 90/270'de bitişik bileşenlerin
  label'larını çakıştırabilir. Mitigasyon: Dahil Değil'de "label
  collision" ayrı sprint olarak etiketli. Şef gözlemlerse gelecek
  sprint.
- **Risk 4 (çok düşük):** `Rotation` tipi sadece `component-
  terminals.ts`'te ihraç. Diğer yerde re-deklarasyon varsa
  (örn. hit-test.ts inline `0 | 90 | 180 | 270`), implementer
  tutarsızlık göremez. Mitigasyon: rotateSelectedComponent içinde
  cast `as Rotation` + modulo normalize → runtime her durumda
  doğru değer.

## Varsayımlar

1. **Stamp mode'da R no-op (ghost rotation yok).** Şef spec'te
   "Stamp mode'da R mevcut davranışını korur (direnç stamp)" dedi
   — ama v2 kodunda 'R' klavye kısayolu zaten TANIMLI DEĞİL (keşif
   doğrulandı: `grep` boş döndü). V1'de (src/) R direnç stamp'i
   olabilir ama v2'de activeTool sidebar'dan set ediliyor. Bu
   sprintte R tuşu **yeni** bir kısayol — stamp mode'da no-op en
   güvenli davranış (Şef sonradan ghost rotation isterse ayrı
   sprint). Çelişki Şef'e rapor edilir, onay alınır.
2. **`Rotation` tipi canonical:** `component-terminals.ts`'teki
   `0 | 90 | 180 | 270` tek kaynak. Design-mode bu tipi import
   eder, `as Rotation` cast'i modulo sonrası güvenli.
3. **R harfi case-insensitive:** CapsLock açıksa 'R', kapalıysa
   'r'. Handler her ikisini yakalar. Shift+R = CCW. Shift+r (caps
   off + shift) = 'R' gelir, aynı CCW. Bu standart.
4. **History çift-push yok:** rotation event'i tek atımlık (key
   up/down değil, key handler tek sefer); `dragHistoryPushed`
   pattern'ı gerekmez.
5. **Solver aynı sonucu üretir varsayımı MNA invariant'ı:**
   Circuit topology (`components[i].nodes`) rotation'dan etkilenmez
   → MNA matrix aynı → çözüm aynı. Farklı çıkarsa mimari bug
   (BLOCK).

---

SPEC READY: ui-v2/sprints/sprint-29-spec.md
