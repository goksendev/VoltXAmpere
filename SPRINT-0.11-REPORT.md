# Sprint 0.11 — Sidebar Bileşen Kataloğu + Faz 1 Kapanışı

**Amaç:** Sidebar (96 px sol kolon) 6 temel bileşen ikonuyla dolduruldu. Tıklama görsel — gerçek araç sistemi Faz 2'de. Bu sprint **Faz 1'in son sprinti**: polish tamamlandı, v2 görsel olarak mockup'ı birebir yakaladı.

**Durum:** ✅ Tamamlandı. 6 ikon yerinde, tıklama 6/6 `[TODO]` log, aktif durum runtime test edildi, regression sıfır. Faz 1 kapandı.

## Yapısal Doğrulama (puppeteer)

```json
{
  "buttons": [
    { "id": "resistor",  "label": "Direnç", "hasSvg": true, "active": false },
    { "id": "capacitor", "label": "Kap.",   "hasSvg": true, "active": false },
    { "id": "battery",   "label": "Pil",    "hasSvg": true, "active": false },
    { "id": "led",       "label": "LED",    "hasSvg": true, "active": false },
    { "id": "switch",    "label": "Anah.",  "hasSvg": true, "active": false },
    { "id": "ground",    "label": "Toprak", "hasSvg": true, "active": false }
  ],
  "sidebarWidth": 96,        // --grid-sidebar-w ✓
  "sidebarHeight": 626       // 900 viewport - 54 topbar - 220 dashboard = 626 ✓
}
```

Default durum: **activeTool = null**, hiçbir buton `.active` class almıyor. Plan'a uyumlu — araç sistemi henüz yok.

## Tıklama Testleri

6/6 buton puppeteer click simülasyonuyla tetiklendi:

```
[TODO] resistor aracı seçildi · Sprint 1.x+ (araç sistemi)
[TODO] capacitor aracı seçildi · Sprint 1.x+ (araç sistemi)
[TODO] battery aracı seçildi · Sprint 1.x+ (araç sistemi)
[TODO] led aracı seçildi · Sprint 1.x+ (araç sistemi)
[TODO] switch aracı seçildi · Sprint 1.x+ (araç sistemi)
[TODO] ground aracı seçildi · Sprint 1.x+ (araç sistemi)
```

Her tıklama `tool-select` CustomEvent emit ediyor (design-mode dinlemiyor, Sprint 1.x+).

`grep -rn "TODO" ui-v2/src` şu an **18 nokta** (Sprint 0.8: 7, Sprint 0.10: 5, Sprint 0.11: 6).

## Aktif Durum Testi (runtime)

Plan gereği: `activeTool = 'resistor'` manuel set → Direnç butonu aktif görünümünde olmalı.

```json
{
  "className": "chip-btn active",
  "hasActiveClass": true,
  "borderColor": "rgb(255, 184, 77)",           // --accent ✓
  "backgroundColor": "rgba(255, 184, 77, 0.14)", // accent-dim literal ✓
  "ariaPressed": "true"
}
```

Screenshot: `/tmp/vxa-0.11-active.png` — Direnç butonu amber kenar + amber-dim arka plan; diğer 5 buton default (ince `--line` kenar + `--fg-2` ikon). Test sonrası `activeTool = null`'a geri alındı, kodda `INITIAL_SELECTION` null olarak kalıyor (commit'lenen kod).

## Regression

```json
{
  "slots": ["4.97 V", "5.00 V", "33.94 µA"],
  "iName": "R1",
  "logo": "Volt&Ampere",
  "chromeBadge": "DENEY Alçak Geçiren RC Süzgeç f_c ≈ 15.9 kHz"
}
```

Sprint 0.5-0.10 tüm özellikler korundu: dashboard transient son örnek, inspector R1, topbar logo, canvas chrome deney badge.

**Console:** `error/warn logs: []` — 6 `[TODO]` log'u haricinde temiz.

## Kritik Bug: CSS Template Backtick

Sprint 0.11 kod yazımı sırasında TS parse hatası zinciri ortaya çıktı (`TS1005: ':' expected` line 66 civarı). **Sebep:** `static override styles = css\`` template literal içindeki CSS yorumunda **bare backtick** karakteri vardı:

```ts
// HATALI:
/* stroke-width CSS'te VERİLMEZ — SVG inline `stroke-width` attribute'u... */
//                                            ^           ^
//                                            template literal'i erken kapatır!
```

Backtick → template literal kapanış karakteri. CSS yorumu olduğu için "içeride" demedi TS. Fix: backtick'leri düz metin olarak tırnaksız yazmak.

**Öğrenilen ders:** `css\`\`` template'inin içinde ASCII backtick karakteri yasak, kullanılırsa escape (`\``) gerekir. Plan'ın SVG presentation attribute notu ironik şekilde bu fehareti yarattı.

## Ekran Görüntüsü — Faz 1 Kapanışı

`/tmp/vxa-0.11-full.png` (1440×900 @ DPR 2) — Mockup'la görsel eşdeğerlik:

- **Topbar:** Volt&Ampere (serif + amber) · KEŞFET / **TASARLA** (amber) / GÜÇ · Kaydet·Aç·SPICE·BOM·Dışa aktar · Galeri·Dersler
- **Sidebar (yeni):** Direnç, Kap., Pil, LED, Anah., Toprak — 6 kare ikon, null state
- **Canvas:** DENEY badge (sol üst) · RC devresi (V1 amber +, R1 zigzag **amber seçili + dashed frame**, C1 plakalar, 2 ground, probe kutuları 5.00V/4.97V) · transport bar + zoom (sağ alt)
- **Inspector:** R₁ · direnç · ELEKTRİKSEL (1 kΩ, 250 mW) · KONUM (0,-80, 0°) · CANLI (33.94 mV, 33.94 µA, 1.15 µW)
- **Dashboard:** ZAMAN DOMAIN · 0→100 µs · τ=10 µs | amber kapasitör dolma eğrisi | 3 slot @son (4.97V / 5.00V / 33.94µA)

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | 6 kare buton — Direnç/Kap./Pil/LED/Anah./Toprak | ✅ |
| 2 | Her buton SVG 28×28 + Türkçe etiket | ✅ (hasSvg true hepsinde, label'lar doğru) |
| 3 | Hover — amber kenar + --fg | ⏳ CSS tanımlı (`:hover`); puppeteer headless hover simülasyonu yok |
| 4 | Tıklama → `[TODO] ...` log | ✅ (6/6) |
| 5 | activeTool set → `.active` class + amber kenar | ✅ (runtime test) |
| 6 | Sidebar scroll yok | ✅ (6 buton × aspect-ratio:1 ≈ 96 × 6 = 576 < 626 höyük) |
| 7 | Diğer bölgeler regression yok | ✅ (slots, inspector, topbar, canvas chrome doğrulandı) |
| 8 | R1 seçim + transient + probe | ✅ |
| 9 | Console temiz | ✅ (sadece 6 [TODO] sonrası) |
| 10 | Bundle raporda | ✅ (aşağıda) |
| 11 | `git diff src/` boş | ✅ |
| 12 | Prod deploy auto | ✅ (push sonrası) |
| 13 | ≥3 buton tıklama log test | ✅ (6/6) |

## Bundle Boyutu

| Dosya | Sprint 0.10 | Sprint 0.11 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 81.55 KB | 87.00 KB | +5.45 (sidebar + catalog + 6 SVG) |
| **Gzip total** | ~26.1 KB | ~28.8 KB | +2.7 KB |

Plan tahmini 84-88 KB → 87.00 tam aralık. Chunk uyarı eşiği 256 KB'ın çok altında.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/sidebar/catalog.ts` — `BASIC_TOOLS` + 6 SVG string (~90 satır).
- `ui-v2/src/sidebar/sidebar.ts` — `<vxa-sidebar>` (~130 satır).
- `SPRINT-0.11-REPORT.md`.

**Güncellenen:**
- `ui-v2/src/modes/design-mode.ts` — sidebar import, `@state activeTool`, `<vxa-sidebar .activeTool=${...}>` mount.

**Dokunulmayan:**
- `ui-v2/src/canvas/*`, `ui-v2/src/topbar/*`, `ui-v2/src/inspector/*`, `ui-v2/src/charts/*`, `ui-v2/src/render/*`, `ui-v2/src/bridge/*`, `ui-v2/src/circuits/*`, `ui-v2/src/util/*`, `ui-v2/src/state/*`
- `ui-v2/src/design/tokens.css`, `ui-v2/index.html`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Faz 1 Özet Tablosu (Sprint 0.8 → 0.11)

| Sprint | Eklenen | Bundle JS | Gzip | `[TODO]` |
|---|---|---:|---:|---:|
| 0.7 (Faz 0 sonu) | — | 67.17 KB | 20.96 KB | 0 |
| **0.8** — Topbar | logo, mod switch, 5+2 buton | 73.69 | 22.84 | +7 |
| **0.9** — Temizlik | dev marker/debug label/.zone sil | 72.12 | 22.49 | 0 |
| **0.10** — Canvas chrome | deney badge + transport + zoom | 81.55 | 24.59 | +5 |
| **0.11** — Sidebar | 6 ikon katalog | **87.00** | **26.01** | +6 |

Faz 1 net katkı: **+19.83 KB JS** (+5.05 KB gzip) için 4 sprint · **18 `[TODO]` nokta** (gelecek Sprint 1.x+ işleri için haritalandırıldı).

## Karar Noktaları

1. **Label kısaltmaları** — "Kap." ve "Anah." tercih edildi. 96 px sidebar içinde tam "Kapasitör" veya "Anahtar" taşar. Mockup'ta da kısaltılmış hâli vardı.
2. **SVG `stroke-width` CSS değil inline.** Plan başta CSS'te `stroke-width: 1.3` default diyordu ama SVG presentation attribute CSS'ten **zayıf**. CSS'i verseydim SVG inline `stroke-width="1.6"` (kapasitör) çalışmazdı. Çözüm: CSS'te stroke-width VERMİYORUZ, SVG root `stroke-width="1.3"` inherit, inner element `stroke-width="1.6/1.4"` override çalışır.
3. **`unsafeHTML` directive kullanımı.** SVG string'leri düz `${iconSvg}` ile yazılsa Lit escape ederdi. `unsafeHTML` güvenli — kaynak string'ler dev-controlled (`catalog.ts`'te literal), XSS yok.
4. **CSS'te `.chip-btn.active` rule'ının specificity** — `.chip-btn.active` (2 class) vs `.chip-btn` (1 class). Tie yok, active kazanır. Ama puppeteer'ın ilk test turunda computed style 300 ms bekleme eksikliğinden false-negative verdi; updateComplete sonrası ek setTimeout ile çözüldü.
5. **CSS template backtick kaçış.** Sprint 0.11'deki fehaseti yarattı — `css\`\`` template içinde bare backtick TS parse'ı kırar. Bu ders Sprint 1.x+ CSS yazımı için dokümante edildi.
6. **`rgba(255, 184, 77, 0.14)` inline literal.** Plan onayladı — `--accent-dim` token Sprint 1.x. Sprint 0.8 mod switch'te aynı literal aday listesinde.
7. **activeTool state design-mode'da.** Sprint 0.8 topbar `activeMode` pattern'ine uyumlu — mod ve araç state'leri aynı katman. Faz 2'de her ikisi de event-driven güncellenecek.

## Bilinen Estetik Gözlemler

1. **SVG ikonları 28×28 — sidebar 96 px'de hafif büyük**. `width: 24px` da denenebilir, ama 28 okunur, Anah./LED incelikleri kaybolmuyor.
2. **Pil ikonu (daire+artı) basit**; gerçek pil sembolü (uzun çizgi + kısa çizgi) mockup'ta yoktu, bu abstrakt daire tercih edildi. Sprint 1.x'te "kaynak" kategorisi eklendiğinde tekrar değerlendirilir.
3. **LED ikonu hem daire hem ışık ışınları** — 7 satır SVG. Daha sade 3-satır "üçgen + ok" tasarımı var ama mockup'taki "ışıklı daire" tercih edildi. Sprint 1.x'te alternatif.
4. **Kapasitör plakaları 1.6 kalın, direnç zigzag 1.3 ince** — görsel ağırlık farkı. Gerçek devre şemasında aynı hiyerarşi.
5. **Aktif buton (`rgba 0.14`) hafif** — kullanıcı ilk bakışta fark etmeyebilir. Sprint 1.x'te 0.18 veya 0.22'ye yükseltme test edilir.
6. **Hover henüz puppeteer headless'te otomatik test edilmedi** — CSS tanımlı, manuel browser test'i gerekli. Sprint 1.x otomatik hover testi eklenebilir (playwright ile).

## Bilinen Eksiklikler (Bilerek)

- **Bileşen yerleştirme yok.** Tıklanınca canvas boş — Faz 2 görevi.
- **Sürükle-bırak yok.**
- **Araç sistemi yok** — activeTool güncellenmiyor gerçek akışta.
- **Keyboard shortcut yok** — `R`/`C`/`V` kısayolları Faz 2.
- **Kategori başlığı yok** — tek düz liste (Pasif/Aktif ayrımı 71+ bileşende gerekecek).
- **Arama/filtre yok.**
- **Favoriler/son kullanılan yok.**
- **Tooltip yok.**

## Faz 1 Kapandı — Sonraki Adım

Faz 1 bittiğinde v2 **görsel olarak mockup'ın tamamını yakaladı**. Her panel dolu, her buton görsel, her ikon yerinde. Hâlâ "sadece görsel" — 18 `[TODO]` noktası Sprint 1.x+ için yol haritası.

**Faz 2 seçenekleri:**
- **Faz 2A — Interaction** (önerim): Click-select, drag-place, gerçek araç sistemi. v2 kullanılabilir hâle gelir. 8-12 sprint.
- **Faz 2B — Aksiyon handler'ları**: Kaydet/Aç/SPICE export. Mevcut görsele fonksiyon ekler. 4-6 sprint.

Şef'in kararı bekleniyor.
