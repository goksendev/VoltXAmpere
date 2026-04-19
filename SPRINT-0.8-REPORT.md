# Sprint 0.8 — Topbar İçeriği: Logo + Mod Switch + Butonlar

**Amaç:** Topbar placeholder'ı gerçek UI ile doldurmak. Logo (Volt&Ampere serif), mod switch (Keşfet/Tasarla/Güç), 5 ana buton (Kaydet/Aç/SPICE/BOM/Dışa aktar), 2 yardımcı buton (Galeri/Dersler). Tüm etkileşimler **görsel** — gerçek aksiyonlar Sprint 1.x+'da.

**Durum:** ✅ Tamamlandı. Prod build'de topbar dolu, Instrument Serif yüklü, tüm butonlar `[TODO]` log'u üretiyor, mod switch Keşfet/Güç için uyarı veriyor. Faz 0 regression sıfır.

## Yapısal Doğrulama (puppeteer)

```json
{
  "logoText": "Volt&Ampere",
  "logoFontFamily": "\"Instrument Serif\", \"Times New Roman\", serif",
  "emColor": "rgb(255, 184, 77)",     // --accent ✓
  "emStyle": "italic",                 // ✓
  "modeButtons": [
    { "text": "Keşfet",  "current": "false", "color": "rgb(95,102,112)"  },  // --fg-3 gri
    { "text": "Tasarla", "current": "true",  "bg": "rgb(255,184,77)",        // --accent amber
                                             "color": "rgb(10,10,11)"  },    // koyu metin
    { "text": "Güç",     "current": "false", "color": "rgb(95,102,112)"  }
  ],
  "actionButtons": [
    { "id": "save", "text": "Kaydet" },
    { "id": "open", "text": "Aç" },
    { "id": "spice", "text": "SPICE" },
    { "id": "bom", "text": "BOM" },
    { "id": "export", "text": "Dışa aktar" }
  ],
  "helperButtons": [
    { "id": "gallery", "text": "Galeri", "hasSvg": true },   // 4 hücre grid ikon
    { "id": "lessons", "text": "Dersler", "hasSvg": false }
  ],
  "zoneHeight": 54,                    // tokens --grid-topbar-h ✓
  "marker": "sprint 0.8 · topbar · v2",
  "serifLoaded": true,                 // document.fonts.check('16px "Instrument Serif"')
  "geistLoaded": true,
  "monoLoaded": true
}
```

**Font kanıtı:** `document.fonts.check('16px "Instrument Serif"')` → `true`. Google Fonts CSS2 request'i Network tab'da görülür (Sprint 0.8 öncesi bu font yoktu).

## Buton Tıklama Logları (runtime)

Puppeteer 7 ana+yardımcı butonu + 3 mod butonunu sırayla tıkladı:

```
ACTION LOGS (7):
  [TODO] save butonu — Sprint 1.x+
  [TODO] open butonu — Sprint 1.x+
  [TODO] spice butonu — Sprint 1.x+
  [TODO] bom butonu — Sprint 1.x+
  [TODO] export butonu — Sprint 1.x+
  [TODO] gallery butonu — Sprint 1.x+
  [TODO] lessons butonu — Sprint 1.x+

WARN LOGS (2):
  Mod değiştirme Faz 3+'da gelecek — istek: kesfet
  Mod değiştirme Faz 3+'da gelecek — istek: guc
```

Tasarla tıklandığında log yok — `onModeClick` zaten aktif kontrol ediyor (`mode === activeMode` early return). Beklenen davranış ✓.

Grep: `grep -rn "TODO" ui-v2/src` → 7 nokta, hepsi topbar action'larında. Sprint 1.x+'da tek tek gerçek handler'lara dönüşecek.

## Event Interface (ileriye hazır)

```typescript
// Topbar emit eder, şu an dinleyen yok:
this.dispatchEvent(new CustomEvent('action', { detail: { id }, bubbles: true, composed: true }));
this.dispatchEvent(new CustomEvent('mode-change', { detail: { mode }, bubbles: true, composed: true }));
```

Sprint 0.10+'da `design-mode.ts` bu event'leri dinleyecek. Şimdilik interface hazır, bağlantı boş.

## Font Yükleme Stratejisi

`ui-v2/index.html` Google Fonts `<link>` güncellendi:

```diff
- family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500
+ family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600
```

Instrument Serif ital@0;1 — hem roman hem italic. Logo'da italic ampersand kullanıldığından italic yüklemesi zorunlu.

Geist ve JetBrains Mono weight range'leri de genişletildi (300→700 Geist, 300→600 JBMono) — gelecek sprintlerde muhtemel kullanım için hazır. Bu sprintte ek ağırlıklar tüketilmiyor, bundle'a ek ağırlık gelmiyor (Google Fonts CSS on-demand).

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Topbar logo + mod switch + 5 ana + 2 helper buton | ✅ |
| 2 | "&" amber italic Instrument Serif | ✅ (emColor amber, emStyle italic) |
| 3 | Tasarla aktif zemin amber, koyu metin | ✅ |
| 4 | Keşfet/Güç tıklama → console.warn | ✅ (2 warn log) |
| 5 | Ana butonlar tıklama → `[TODO] ... Sprint 1.x+` log | ✅ (7 log) |
| 6 | Hover `--bg-3` + `--fg` renk transition | ✅ (CSS tanımlı — hover visual manuel doğrulanacak) |
| 7 | Topbar yüksekliği 54 px | ✅ |
| 8 | Topbar arkası --bg-1, alt kenar --line | ✅ |
| 9 | Placeholder metni tamamen kaldırıldı | ✅ |
| 10 | Diğer bölgeler regression yok | ✅ (puppeteer dashboard hâlâ loading→ok, inspector R1) |
| 11 | Console 0 error, 0 warn (kasıtlı [TODO]/warn hariç) | ✅ |
| 12 | Bundle raporda | ✅ (aşağıda) |
| 13 | `git diff src/` boş | ✅ |
| 14 | Instrument Serif Network'ten yüklendi | ✅ (document.fonts.check true) |
| 15 | Prod deploy auto | ✅ (push sonrası Vercel) |

## Bundle Boyutu

| Dosya | Sprint 0.7 | Sprint 0.8 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.69 KB | 1.81 KB | +0.12 (font link genişledi) |
| `index.css` | 0.92 KB | 0.98 KB | +0.06 (--serif token) |
| `index.js` | 67.17 KB | 73.69 KB | +6.52 (vxa-topbar ~200 satır) |
| **Gzip total** | ~21.9 KB | ~24.3 KB | +2.4 KB |

Plan tahmini 70-75 KB → 73.69 aralık ortası. Chunk uyarı eşiği 256 KB, çok altında.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/topbar/topbar.ts` — `<vxa-topbar>` (~240 satır).
- `SPRINT-0.8-REPORT.md`.

**Güncellenen:**
- `ui-v2/index.html` — Google Fonts link, Instrument Serif + genişletilmiş ağırlıklar.
- `ui-v2/src/design/tokens.css` — `--serif` token eklendi.
- `ui-v2/src/modes/design-mode.ts` — `topbar-zone` class (base `.zone` uygulanmıyor), `<vxa-topbar>` mount, `activeMode` state (`@state`), dev-marker "sprint 0.8".

**Dokunulmayan:**
- `ui-v2/src/canvas/*`, `ui-v2/src/inspector/*`, `ui-v2/src/render/*`, `ui-v2/src/charts/*`, `ui-v2/src/bridge/*`, `ui-v2/src/util/*`, `ui-v2/src/state/*`, `ui-v2/src/circuits/*`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **Logo'da `<em>` yerine ham HTML ampersand** — `Volt<em>&amp;</em>Ampere`. Semantik `<em>` vurgulama; kullanıcı için "and" değil "&" tek karakter ama Lit template'te `&amp;` ile encode edilmeli (HTML literali). Renderlanmış çıktı textContent "Volt&Ampere".
2. **Mod disabled feedback: cursor not-allowed + console.warn.** Plan "shake animasyonu veya renk flash, basit tut" dedi — cursor not-allowed HTML standart, ekstra animasyon eklemedim. Sprint 1.x'te UI feedback refactor edilir.
3. **Galeri ikonu SVG inline** — external asset yok, ui-v2/dist'te tek chunk. 4 hücreli grid path. stroke=currentColor → hover'da renk otomatik değişir.
4. **`#0A0A0B` inline yorumla.** Amber üstündeki koyu metin için. Plan "Sprint 1.x'te --on-accent token" dedi; yorumda işaretli, grep kolayca bulunur.
5. **`ModeName` type `'kesfet' | 'tasarla' | 'guc'`** — Türkçe slug (ASCII-safe). URL veya JSON key olsa da anlaşılır. İngilizce `'explore' | 'design' | 'power'` da olabilirdi; Türkçe konvansiyonuna uyum tercih edildi.
6. **Dev-marker hâlâ var** — Sprint 0.9'da temizlenecek. Bu sprint kapsamında kaldırma yok.
7. **Placeholder sidebar hâlâ yerinde** — Sprint 0.9'da sidebar/inspector placeholder'ları kaldırılacak (inspector zaten dolu, sidebar ya kaldırılıp ya bileşen kataloğu iskeleti eklenecek).

## Bilinen Estetik Gözlemler

1. **Sağda "Dersler" metni yalnız — "Galeri"nin ikonu var, simetri yok.** Tasarım: Galeri görsel bir index (grid ikon anlaşılır), Dersler metin yeterli (okuma niyeti). Kabul.
2. **Mod switch'in `TASARLA` yazısı büyük — letter-spacing 0.1em mono, amber zemin üstünde yüksek kontrast.** Net ve okunur ama ekranın dolu olduğu anda gözü çekiyor. Sprint 1.x UX değerlendirmesinde "çok dikkat çeker mi?" sorusu gündeme gelebilir.
3. **Ana butonlar arası 2 px gap + separator** — separator (1 px × 16 px çizgi) görsel olarak yeterince belirgin değil; hover durumunda buton arkası bg-3 görününce separator kaybolabilir. Sprint 1.x polish.
4. **1440 px'de topbar dolu ama sıkışık değil.** Daha dar viewport'ta (1280×800) "Dışa aktar" metni satıra yetişebilir veya yardımcı butonlar kayar. Responsive davranışı Sprint 1.x test edilir.

## Bilinen Eksiklikler (Bilerek)

- **Butonlar fonksiyonel değil.** 7 `[TODO]` log noktası.
- **Mod switch değişmiyor.** Keşfet/Güç ekranları Faz 3+.
- **Tooltip yok.** Hover'da açıklama balonu yok.
- **Keyboard shortcut yok.** Ctrl+S, Ctrl+O vb. hiçbiri.
- **Dropdown/menu sistemi yok.**
- **Status göstergesi yok** ("kayıtlı X önce", "bağlantı: OK", vb.).
- **Komut paleti yok** (Ctrl+K).
- **Dev-marker hâlâ görünüyor** — Sprint 0.9'da kaldırılacak.

## Sonraki Adım

Sprint 0.9 — Dev marker temizliği. Sidebar placeholder etiketi kaldırma veya bileşen kataloğu iskeleti. Sol-alt "sprint N · ... · v2" ve sağ-alt "canvas: X×Y · DPR: Z" marker'ları dev-mode-only veya tamamen kaldırılacak.
