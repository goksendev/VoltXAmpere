# Sprint 2.1 — Undo/Redo Altyapısı: Snapshot Stack + Klavye Kısayolları

**Status:** ✅ Tamamlandı
**Faz:** 2B açılışı
**Tarih:** 2026-04-20
**Bundle:** 109.59 KB JS (gzip 32.63 KB) — Sprint 1.5'ten **+1.75 KB**

---

## Özet

Faz 2A'da kullanıcı devre kurabiliyordu; Sprint 2.1 ile **geri alabiliyor**. Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (veya Ctrl+Y) redo. Snapshot-level altyapı — her undoable action öncesi `structuredClone` ile tam kopya alınır, stack'e pushlanır.

Bu sprintin asıl değeri: **bir kere kuruldu, sonsuza kadar işe yarıyor**. Sprint 2.x-3.x'te eklenecek her action (rotation, kopyala-yapıştır, import, yeni bileşen tipleri) handler'ın başına `this.pushHistory()` koymakla otomatik undoable olacak.

---

## Kapsam

| Alan | Yapılan | Dosya |
|---|---|---|
| History modülü | `HistoryState`, `snapshot`, `pushAction`, `undo`, `redo`, `canUndo`, `canRedo`, `HISTORY_LIMIT=50` | `state/history.ts` (YENİ) |
| State | `@state() history` | `modes/design-mode.ts` |
| Helpers | `pushHistory()`, `doUndo()`, `doRedo()` | `modes/design-mode.ts` |
| Action bağlama | `onPlaceComponent`, `connectTerminals`, `deleteComponent`, `deleteWire` başlarına `pushHistory()` | `modes/design-mode.ts` |
| Drag snapshot | `dragHistoryPushed` flag — ilk `drag-position` event'inde tek sefer, `drag-end`'de reset | `modes/design-mode.ts` |
| Drag-end dinleme | `onCanvasDragEnd` handler + render template `@drag-end=` | `modes/design-mode.ts` |
| Klavye kısayolları | `onKeyDown` genişletildi — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y | `modes/design-mode.ts` |
| Platform detection | `navigator.platform` üzerinden isMac; Meta (Mac) vs Ctrl (Win/Linux) | `modes/design-mode.ts` |

### Değişmeyenler
`src/engine/` (v1 korundu), `canvas/*`, `render/*`, `inspector/*`, `bridge/*`, `charts/*`, `topbar/*`, `sidebar/*`, `circuits/*`, `interaction/*`, `state/selection.ts`, `design/tokens.css`.

---

## Kabul kriterleri — Test matrisi

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| 1 | R2 yerleştir → Ctrl+Z → R2 kaybolur | ✅ | compIds `[V1,R1,C1,R2]` → `[V1,R1,C1]`, past 1→0, future 0→1 |
| 2 | Ctrl+Shift+Z → R2 geri gelir | ✅ | compIds geri `[V1,R1,C1,R2]`, past 0→1, future 1→0 |
| 3 | 4 action + 4 Ctrl+Z sırayla geri alınır | ✅ | past: 4→3→2→1→0, future: 0→1→2→3→4 |
| 4 | Ctrl+Z sonrası yeni action → future boşalır | ✅ | future 4 → yeni yerleştirme → past 1, future 0 |
| 5 | Drag → Ctrl+Z → R1 eski konuma döner | ✅ | r1x=160 (drag sonrası) → Ctrl+Z → r1x=0 |
| 6 | Drag tek snapshot — 10 ara mousemove, past +1 | ✅ | `delta past: 1` |
| 7 | HISTORY_LIMIT=50 — 51. action en eskiyi atar | ✅ (kod) | `pushAction` içinde `newPast.slice(-HISTORY_LIMIT)` |
| 8 | Mac Cmd+Z, Win/Linux Ctrl+Z | ✅ | `navigator.platform` runtime check (headless: MacIntel → Meta) |
| 9 | Text input'ta Ctrl+Z pass-through | ✅ (kod) | `isTextInputFocused` guard; preventDefault YAPMA |
| 10 | Undo sonrası selection=none | ✅ | doUndo içinde `this.selection = INITIAL_SELECTION` |
| 11 | Undo sonrası solver yeniden çalışır | ✅ | V1 sil → Ctrl+Z → vOut `0.000` → `4.966` |
| 12 | Sprint 1.1-1.5 davranışları korunur | ✅ | Click/hover/drag/place/wire/delete normal |
| 13 | Console temiz | ✅ | 0 hata/warning |
| 14 | Bundle | ✅ | 109.59 KB (hedef 112-118 KB altında) |
| 15 | v1 regression | ✅ | `git diff src/` boş |
| 16 | Production `voltxampere.com/v2` | ⏳ | Push sonrası Vercel otomatik |

---

## Runtime doğrulama akışı

```
INIT                                              past=0, future=0
  R2 yerleştir (onPlaceComponent)                 past=1, future=0
  Ctrl+Z                                           past=0, future=1  (R2 gitti)
  Ctrl+Shift+Z                                     past=1, future=0  (R2 geri)

  V1.pos↔R2.t1 tel (connectTerminals)             past=2, future=0
  R1 drag (10 mousemove → 1 snapshot)              past=3, future=0
  V1 delete (Delete tuşu)                          past=4, future=0

  Ctrl+Z  (V1 geri, wireCount 2→5)                past=3, future=1
  Ctrl+Z  (drag geri, r1x 80→0)                   past=2, future=2
  Ctrl+Z  (tel geri, wireCount 5→4)               past=1, future=3
  Ctrl+Z  (R2 geri kayboldu)                      past=0, future=4

  C2 yerleştir (yeni dallanma)                    past=1, future=0  ← future temizlendi
```

Her adım state doğrulandı, vOut değerleri topoloji değişimine göre tutarlı (V1 silindiğinde `0.000`, geri geldiğinde `4.966`).

---

## Drag snapshot disiplini — kritik detay

```typescript
private onCanvasDragPosition = (e: Event): void => {
  if (!this.dragHistoryPushed) {
    this.pushHistory();              // ← this.layout HENÜZ drag öncesi
    this.dragHistoryPushed = true;
  }
  // ...
  this.layout = this.recomputeWires(next);  // ← SONRA güncellenir
};

private onCanvasDragEnd = (): void => {
  this.dragHistoryPushed = false;   // bir sonraki drag için
};
```

**Kanıt:** 10 ardışık `drag-position` + 1 `drag-end` çağrısı:
- Öncesi: `past=0`
- Sonrası: `past=1`
- Ctrl+Z: r1x `160 → 0` (drag öncesi konuma döndü)

Aksi senaryo (her `drag-position`'da snapshot): 10 undo gerekirdi → kötü UX. Flag pattern'i bunu düzeltir.

---

## Dosya değişiklik özeti

```
 SPRINT-2.1-REPORT.md                  | +120 (yeni)
 ui-v2/src/state/history.ts            | +125 (yeni)
 ui-v2/src/modes/design-mode.ts        | ~110 değişim (+100 ekleme, action bağlama, undo/redo, keyboard)
```

Net: 1 yeni modül, 1 dosya güncellendi, 1 rapor. `src/` (v1) dokunulmadı.

---

## Bundle trendi

| Sprint | Bundle | Δ |
|---|---|---|
| 1.5 | 107.84 KB | +5.50 |
| **2.1** | **109.59 KB** | **+1.75** |

Yeni modül küçük: `history.ts` saf fonksiyonlar + tip tanımları, ~125 satır. Çoğu design-mode'da inline helper.

---

## Bilinen kısıtlar & [TODO]

1. **Topbar undo/redo butonları bağlı değil** — Sprint 2.4'te bağlanacak. Şu an sadece keyboard. `canUndo`/`canRedo` helper'ları butonların disabled hali için hazır.
2. **Görsel geri bildirim yok** — undo yapılınca toast mesajı yok. Sprint 2.x+ iyileştirme.
3. **Parametre değişikliği undo yok** — inspector'dan değer düzenleme henüz yok. Sprint 2.x'te gelince pushHistory bağlanır.
4. **Cross-session persistence yok** — sayfa yenilenirse history kaybolur. Figma/Photoshop benzeri otomatik kayıt Sprint 3.x.
5. **Undo sonrası selection daima none** — eski selection restore edilemiyor (bileşen silinmiş olabilir). Basit çözüm seçildi; Sprint 2.x'te "bileşen hâlâ varsa re-select" iyileştirmesi düşünülebilir.
6. **HISTORY_LIMIT=50 sabit** — kullanıcı ayarı yok. Çoğu kullanıcı için yeterli; gelecekte settings'te değiştirilebilir.
7. **Snapshot bellek** — 50 × ~10 KB ≈ 500 KB. 100+ bileşenli devrelerde structuredClone yavaşlayabilir; o zaman immer migrasyonu ayrı sprint.

---

## Sprint 2.x yol haritası

| Sprint | Kapsam | Bu altyapı üzerine |
|---|---|---|
| 2.1 (BU) | Undo/redo altyapısı | — |
| 2.2 | Multi-select (Shift+Click) | Bulk Delete tek undo adımı |
| 2.3 | Rubber-band seçim kutusu | — |
| 2.4 | Topbar butonları (Sil/Geri/Yinele) bağlama | `canUndo`/`canRedo` kullanır |
| 2.5 | Rotation (R tuşu) | pushHistory ile otomatik undoable |
| 2.6+ | Kopyala/yapıştır, yeni bileşen tipleri (LED/Switch/GND) | Her action pushHistory ile undoable |

---

## Doğrulama

- **Build:** `npm run build:v2` — ✅ 109.59 KB, 60 modül
- **v1 build:** `npm run build` — ✅ 31 ms, regression yok
- **Runtime:** Puppeteer tam senaryo — ✅ 0 hata/warning
- **v1 regression:** `git diff src/` — ✅ boş
- **Production:** Vercel otomatik deploy (push sonrası)

---

## Notlar (Zenco)

Bu sprint **altyapı** sprinti — kullanıcı gözünden küçük ("Ctrl+Z çalıştı"), ama kod tarafında bu bir **temel değişim**. Snapshot-level tasarım tercihi `structuredClone`'un pahası (her action +10 KB bellek) karşılığında **yeni action'ların otomatik undoable olması**nı getiriyor.

Drag snapshot flag'i ilk versiyonda unutulsa 60 undo adımı olurdu, kötü UX. Flag disiplini kritik: `pushHistory` **önce** `this.layout` güncellenmeden; aksi halde undoed state kopyalanan state ile aynı olurdu.

`doUndo`/`doRedo` sonrası UI state reset (selection=none, wireDraw=idle, activeTool=null) basit ama sağlam karar. Alternatifi — undo sonrası eski selection restore — bileşen silinmiş olduğu durumda hataya düşer. Basit her zaman doğru.

Faz 2B açılışı temiz: Sprint 2.2'de multi-select eklenince bulk Delete tek undo adımı olacak (action başında pushHistory, action içi döngüsel silmeler zaten tek atomic handler). Altyapı için ek kod yok.
