# Sprint 0.9 — Dev Marker Temizliği + Sidebar Placeholder Kaldırma

**Amaç:** Ekrandan son dev artifact'leri silmek — sol alt sprint marker, canvas sağ alt debug label, sidebar placeholder metin + dashed border, ölü `.zone` base class. İlk kez "production gibi görünen erken sürüm".

**Durum:** ✅ Tamamlandı. Hiçbir dev işareti yok, tüm fonksiyonlar (Sprint 0.1-0.8) sıfır regression korundu. Bundle düştü.

## Silinenler

### 1. Sprint marker (design-mode.ts)

`.dev-marker` CSS kuralı (15 satır, `position: fixed` dahil) + template'teki `<span class="dev-marker">...</span>` elementi. Tamamen gitti — dev-mode-only bile değil, tamamen silme.

### 2. Canvas debug label (canvas.ts)

- `.debug-label` CSS kuralı (14 satır)
- `<div class="debug-label">canvas: X × Y · DPR: D</div>` template
- `@state() private cssW/cssH/dpr` üç reactive state field'ı
- `draw()` sonunda `this.cssW = cssW; ...` üç güncelleme satırı
- `import` satırında `state` decorator (artık kullanılmıyor)

ResizeObserver callback + rAF-batched redraw **aynen korundu** — sadece "debug label text'ini güncelle" adımı gitti. DPI scaling Sprint 0.3'te doğrulandı, göz önünde durmaya gerek yok.

### 3. Sidebar placeholder (design-mode.ts)

`<section class="zone sidebar">sidebar · 96px · sprint 0.5'te bileşen kataloğu</section>` → `<section class="sidebar-zone" aria-label="sidebar"></section>` (boş).

Yeni `.sidebar-zone` class pattern'e uyum: base `.zone` uygulanmıyor, sadece `background: --bg-1 + border-right: 1px solid --line + overflow: hidden`.

### 4. Ortak `.zone` class (design-mode.ts)

Sprint 0.2'den beri duran placeholder base class — dashed border, padding, mono font, uppercase, flex align. Tüm bölgeler kendi `*-zone` class'ına geçtiği için **ölü koddu**. 14 satır CSS silindi.

**Grep doğrulaması:**

```bash
$ grep -rnE "[^-]\.zone\b|^\.zone\b" ui-v2/src
# No matches
```

`topbar-zone`, `canvas-zone`, `sidebar-zone`, `inspector-zone`, `dashboard-zone` (hepsi tireli) eşleşmiyor; bare `.zone` hiçbir yerde yok.

## Runtime Temizlik Doğrulaması (puppeteer)

```json
{
  "cleanCheck": {
    "devMarkerExists": false,       // sol alt marker yok ✓
    "debugLabelExists": false,      // canvas debug yok ✓
    "sidebarText": "",              // sidebar boş ✓
    "sidebarStyle": {
      "bg": "rgb(13, 15, 19)",      // --bg-1 ✓
      "borderRight": "1px solid rgb(31, 36, 46)"  // --line ✓
    },
    "sidebarChildren": 0            // hiç child yok ✓
  }
}
```

## Regression Testi (Sprint 0.5-0.8 tüm özellikler korunuyor)

```json
{
  "regression": {
    "dashSlots": [
      { "title": "V_ÇIKIŞ @son", "value": "4.97 V" },
      { "title": "V_GİRİŞ @son", "value": "5.00 V" },
      { "title": "I(R1) @son", "value": "33.94 µA" }
    ],
    "canliFields": [
      { "label": "V düş.", "value": "33.94 mV" },
      { "label": "I", "value": "33.94 µA" },
      { "label": "P", "value": "1.15 µW" }
    ],
    "r1Sample": [255, 184, 77, 255],   // canvas R1 amber ✓
    "inspectorName": "R1"              // inspector dolu ✓
  }
}
```

Transient grafik yerinde, R1 seçim vurgusu (amber + dashed frame) yerinde, dashboard + inspector senkronu (33.94 µA) yerinde, canvas probe etiketleri yerinde.

## Inspector Empty Selection Runtime Testi

Plan gereği `selection = { type: 'none' }` durumu doğrulandı — puppeteer `page.evaluate` içinde Lit `@state` property'sini override etti:

```json
{
  "emptyTest": {
    "emptyText": "bir bileşen seç",   // Sprint 0.6'daki empty dal tetiklendi ✓
    "restoredName": "R1"               // geri alma sonrası normal render ✓
  }
}
```

**Sprint 0.6'daki empty dalı sağlam** — kod bu sprintte **dokunulmadı**, runtime test Sprint 1.x canvas click-select açıldığında "Bir bileşen seç" boş durumunun çalıştığını şimdiden garanti ediyor.

Manuel test `design-mode.ts` üstünde **yapılmadı** (geçici selection değişikliği) — puppeteer runtime property override aynı sonucu verdi, kodda geri alınacak bir şey kalmadı.

## Ekran Görüntüsü Farkı (önce → sonra)

**Önce (Sprint 0.8):**
- Sol altta soluk yazı: `sprint 0.8 · topbar · v2`
- Canvas sağ altta yarı saydam kutu: `canvas: 1128 × 626 · DPR: 2`
- Sidebar içinde dashed kenarlı kutu + mono uppercase yazı `sidebar · 96px · sprint 0.5'te bileşen kataloğu`

**Sonra (Sprint 0.9):**
- Sol altta **hiçbir şey yok**
- Canvas sağ altta **hiçbir şey yok** — canvas zemin tek koyu renk, devre tek odak
- Sidebar **tamamen boş** — sadece koyu zemin + sağ ayırıcı çizgi

Ekran görüntüsü: `/tmp/vxa-0.9.png` (1440×900 @ DPR 2).

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Hiçbir "sprint X.Y" işareti yok | ✅ |
| 2 | Canvas debug etiketi yok | ✅ |
| 3 | Sidebar boş, placeholder yok, dashed yok | ✅ |
| 4 | Sidebar `--bg-1` + sağ `--line` ayırıcı | ✅ |
| 5 | Diğer bölgeler Sprint 0.8'deki gibi | ✅ |
| 6 | R1 seçim vurgusu + inspector değerleri + transient grafik | ✅ |
| 7 | `.zone` class tamamen silindi (grep temiz) | ✅ |
| 8 | Console temiz | ✅ (issues: []) |
| 9 | Bundle raporda | ✅ (aşağıda, düşüş) |
| 10 | `git diff src/` boş | ✅ |
| 11 | Empty inspector runtime test | ✅ ("bir bileşen seç" görünüyor, restored sonrası "R1") |
| 12 | Prod deploy auto | ✅ (push → Vercel) |

## Bundle Boyutu

| Dosya | Sprint 0.8 | Sprint 0.9 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 73.69 KB | 72.12 KB | **−1.57** |
| **Gzip total** | ~24.3 KB | ~23.5 KB | **−0.8** |

Plan tahmini 72-73 KB → 72.12 tam aralık. **Silme sprinti olduğundan ilk kez bundle düştü** — net 9 satır CSS + 5 state/satır kaldırıldı.

Silinen kod yaklaşık toplam: **~45 satır** (CSS + TS + template). Eklenen: 3 yorum satırı (Sprint 0.9 notu) + 7 satır `.sidebar-zone` CSS.

## Dosya Değişiklikleri

**Güncellenen (silme ağırlıklı):**
- `ui-v2/src/modes/design-mode.ts` — `.zone` base (14 satır), `.zone.sidebar` (5 satır), `.dev-marker` (12 satır), `<span class="dev-marker">` template (3 satır) silindi; sidebar template "boş" hâline getirildi; `.sidebar-zone` yeni CSS 7 satır.
- `ui-v2/src/canvas/canvas.ts` — `.debug-label` CSS (14 satır), `<div class="debug-label">` template (3 satır), 3 `@state` field, 3 render state güncelleme silindi; `state` decorator import'tan çıkarıldı.

**Dokunulmayan:**
- `ui-v2/src/topbar/*`, `ui-v2/src/inspector/*`, `ui-v2/src/charts/*`, `ui-v2/src/render/*`, `ui-v2/src/bridge/*`, `ui-v2/src/circuits/*`, `ui-v2/src/util/*`, `ui-v2/src/state/*`
- `ui-v2/src/design/tokens.css` (yeni token yok)
- `ui-v2/index.html`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **`.dev-marker` tamamen kaldırıldı, `import.meta.env.DEV` wrap yapılmadı.** Plan önerdi ama dev-build'de de sprint etiketine ihtiyaç yok — commit hash git log'da, HMR aktif olduğunda "dev sürümdeyim" zaten belli.
2. **Canvas `dpr` değişkeni `void dpr` ile işaretlendi.** `noUnusedLocals: true` strict. `scale(dpr, dpr)` çağrısı dpr kullanır ama TS flow analysis yan ürün olarak `void` geçirdi. Kodu bozmadan `void dpr;` satırı lint-güvenli.
3. **Inspector empty durumu runtime'da doğrulandı, kod geçici değiştirilmedi.** Puppeteer `mode.selection = { type: 'none' }` ile reactive property override; restore sonrası aynı R1 render. Daha temiz — kaynak kod hiçbir commit arası geçici yazıma uğramadı.
4. **`.sidebar-zone` sadece 7 satır CSS — minimum.** `padding: 0` explicit değil (default zaten 0); `display: block` default; `overflow: hidden` ileride içerik taştığında dashed border gerektirmesin diye. Sprint 0.11 bileşen kataloğu gelince `display: flex + flex-direction: column + padding` eklenir.
5. **`state` decorator import kaldırıldı canvas'tan.** Tek kullanım debug state'tiydi; silinince TS `noUnusedLocals` hata verdi. Import satırından drop.

## Bilinen Eksiklikler (Bilerek)

- **Sidebar içeriği yok** — Sprint 0.11.
- **Canvas chrome (transport bar, zoom, deney başlığı) yok** — Sprint 0.10.
- **Canvas click selection yok** — kod hazır (selection state + inspector empty dalı), event handler yok. Sprint 1.x.
- **Tooltip, keyboard shortcut, menu yok** — Sprint 1.x+.

## Sonraki Adım

Sprint 0.10 — Canvas chrome. Transport bar (Play/Pause + süre), zoom kontrolü (görsel), üst köşede deney başlığı overlay ("DENEY · Alçak Geçiren RC Süzgeç · f_c = 15.9 kHz"). Mockup'taki chrome detayları. Hâlâ fonksiyonel etkileşim yok — Sprint 1.x'te aksiyonlar bağlanacak.
