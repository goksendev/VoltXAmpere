# Sprint 0.10 — Canvas Chrome: Transport + Zoom + Deney Başlığı

**Amaç:** Canvas'a overlay chrome katmanı ekle — sol üstte deney başlığı, sağ altta transport bar + zoom paneli. Hepsi **görsel** — fonksiyonel etkileşim Sprint 1.x+'da.

**Durum:** ✅ Tamamlandı. Prod build'de 3 overlay pozisyonda, tüm butonlar `[TODO]` log, canvas/inspector/dashboard regression sıfır.

## Yapısal Doğrulama (puppeteer)

```json
{
  "ambers": ["DENEY", "f_c ≈ 15.9 kHz"],          // badge 2 amber parça ✓
  "mainSpans": ["Alçak Geçiren RC Süzgeç"],       // orta başlık --fg-2
  "transportBtns": [
    { "label": "önceki",   "cls": "tr-btn",      "bg": "rgba(0, 0, 0, 0)" },
    { "label": "duraklat", "cls": "tr-btn play", "bg": "rgb(255, 184, 77)" },  // --accent ✓
    { "label": "sonraki",  "cls": "tr-btn",      "bg": "rgba(0, 0, 0, 0)" }
  ],
  "trTime": "Çalışıyor · 100.00 µs",              // isPlaying=true → status + time ✓
  "dotClasses": "tr-status-dot ",                 // is-stopped yok, pulse aktif ✓
  "zoomBtns": ["uzaklaştır", "yakınlaştır"],
  "zoomVal": "100%",
  "badgePos": { "top": 66, "left": 108 },         // topbar 54 + sp-3 12 + canvas sol 96 = doğru
  "ctrlPos": { "bottom": 232, "right": 228 }      // dashboard 220 + 12, inspector 216 + 12 ✓
}
```

Badge subtitle `·` ile doğru bölündü — orta kısım `Alçak Geçiren RC Süzgeç`, son kısım `f_c ≈ 15.9 kHz` amber'e terfi etti. Split mantığı:

```ts
"Alçak Geçiren RC Süzgeç · f_c ≈ 15.9 kHz".split('·').map(s => s.trim())
// → ['Alçak Geçiren RC Süzgeç', 'f_c ≈ 15.9 kHz']
// main = parts[0..-1].join(' · ') = 'Alçak Geçiren RC Süzgeç'
// meta = parts.at(-1) = 'f_c ≈ 15.9 kHz'
```

## Tıklama Testleri (puppeteer click simülasyonu)

5/5 buton log bıraktı, gerçek davranış yok:

```
[TODO] timeline prev · Sprint 1.x+
[TODO] play/pause toggle · Sprint 1.x+
[TODO] timeline next · Sprint 1.x+
[TODO] zoom-out · Sprint 1.x+
[TODO] zoom-in · Sprint 1.x+
```

Plan "fake fonksiyonellik yasak" kuralına uyum — tıklama console'a "henüz yok" mesajı bırakır, zoom değeri 100%'de kalır, play butonu state değiştirmez.

`grep -rn "TODO" ui-v2/src` şu an **12 nokta** (Sprint 0.8'deki 7 + Sprint 0.10'daki 5). Sprint 1.x+'da tek tek gerçek handler'lara dönüşecek.

## Regression (tüm önceki sprintler korundu)

```json
{
  "slots": ["4.97 V", "5.00 V", "33.94 µA"],      // dashboard transient son örnek
  "iName": "R1",                                   // inspector dolu
  "logo": "Volt&Ampere"                            // topbar logo
}
```

Canvas çizimi etkilenmedi — chrome shadow DOM'da ayrı katman, canvas `draw()` fonksiyonu değişmedi. Transient grafik, probe etiketleri, R1 selection frame hepsi yerinde.

## Ekran Görüntüsü (1440×900 @ DPR 2)

`/tmp/vxa-0.10.png`:

- **Üstte:** topbar (logo + mod switch + butonlar — Sprint 0.8)
- **Sol üstte canvas içinde:** badge `DENEY · ALÇAK GEÇİREN RC SÜZGEÇ · F_C ≈ 15.9 KHZ` yarı saydam zemin + blur arka plan
- **Canvas ortada:** RC devresi + V_ÇIKIŞ/V_GİRİŞ probe + R1 seçim (Sprint 0.5-0.6)
- **Sağ altta canvas içinde:**
  - Üstte transport bar: prev · **PLAY** (amber glow) · next | `● Çalışıyor · 100.00 µs` (yeşil pulse dot)
  - Altta zoom: `− 100% +` küçük panel
- **Sağda:** inspector `R₁ direnç ELEKTRİKSEL/KONUM/CANLI` (Sprint 0.6)
- **Altta:** `ZAMAN DOMAIN · 0 → 100 µs · τ = 10 µs` + eğri + 3 slot (Sprint 0.7)

## Backdrop-Filter Performans

Chrome'un 3 overlay'i (badge + transport + zoom) `backdrop-filter: blur(6-8px)` kullanıyor. İki WebKit prefix versiyonu da var (`-webkit-backdrop-filter`) — Safari'de %100 destek.

**Puppeteer prod build ölçümü** (1440×900 @ DPR 2):
- Canvas draw time (chrome olmadan Sprint 0.9): yaklaşık 2-4 ms
- Chrome overlay'leri ekli: fark ölçülmedi (RO tetiklenmediği için draw re-run olmadı)

Gerçek fark gözlenecek senaryolar: hızlı pan/zoom (Sprint 1.x), büyük devre (Sprint 2.x). Backdrop-filter Chrome/Safari'de GPU-accelerated — pan sırasında bile 60fps'ye yakın kalmalı. Performans regression ölçümü Sprint 2.x profiling'ine bırakıldı.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Sol üstte badge — DENEY + orta + f_c amber | ✅ (2 amber span, 1 orta) |
| 2 | Sağ altta zoom paneli — `− 100% +` | ✅ |
| 3 | Transport bar üstte — 3 buton + süre göstergesi | ✅ |
| 4 | Play amber arka plan + glow | ✅ (rgb 255,184,77 + box-shadow 14px rgba(.45)) |
| 5 | Yeşil pulse dot | ✅ (is-stopped class yok → animation aktif) |
| 6 | Backdrop-filter blur — grid overlay ardından bulanık | ✅ (badge 6px, transport 8px, zoom 6px) |
| 7 | Tüm butonlar `[TODO]` log | ✅ (5/5) |
| 8 | Diğer bölgeler regression yok | ✅ (topbar logo, inspector R1, dashboard slots) |
| 9 | R1 seçim + transient grafik korundu | ✅ |
| 10 | Console temiz | ✅ (error/warn logs: []) |
| 11 | Bundle raporda | ✅ (aşağıda) |
| 12 | `git diff src/` boş | ✅ |
| 13 | Prod deploy auto | ✅ (push sonrası Vercel) |

## Bundle Boyutu

| Dosya | Sprint 0.9 | Sprint 0.10 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.81 KB | 1.81 KB | 0 |
| `index.css` | 0.98 KB | 0.98 KB | 0 |
| `index.js` | 72.12 KB | 81.55 KB | +9.43 (chrome component + 3 overlay CSS) |
| **Gzip total** | ~23.5 KB | ~26.1 KB | +2.6 KB |

Plan tahmini 76-80 KB → 81.55 hafif üstünde (+1.55). Sebep: SVG path string'leri (3 transport + 2 zoom), `@keyframes pulse`, backdrop-filter prefix'leri, 3 ayrı overlay style block'u. 256 KB chunk eşiği çok altında.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/canvas/canvas-chrome.ts` — `<vxa-canvas-chrome>` (~230 satır).
- `SPRINT-0.10-REPORT.md`.

**Güncellenen:**
- `ui-v2/src/canvas/canvas.ts` — 5 chrome prop (`chromeTitle`, `chromeSubtitle`, `isPlaying`, `simTime`, `zoom`) + `<vxa-canvas-chrome>` mount. Chrome shadow DOM içinde `<canvas>`'ın yanında, `:host` `position: relative` zaten vardı.
- `ui-v2/src/modes/design-mode.ts` — `<vxa-canvas>`'a 5 chrome prop geçirildi. `chromeSubtitle="Alçak Geçiren RC Süzgeç · f_c ≈ 15.9 kHz"` hard-coded.

**Dokunulmayan:**
- `ui-v2/src/topbar/*`, `ui-v2/src/inspector/*`, `ui-v2/src/charts/*`, `ui-v2/src/render/*`, `ui-v2/src/bridge/*`, `ui-v2/src/circuits/*`, `ui-v2/src/util/*`, `ui-v2/src/state/*`
- `ui-v2/src/design/tokens.css`, `ui-v2/index.html`
- Root `package.json`, `vercel.json`
- v1: `src/` sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **Chrome `<vxa-canvas>` shadow DOM'u içinde.** Alternatif `<vxa-design-mode>` seviyesine mount etmekti — canvas'ın "bir parçası" olarak chrome davrandığı için child. Gelecekte chrome'u gizlemek tek satır (`@property hideChrome`) değişikliği.
2. **`title` → `expTitle` rename.** HTMLElement'in built-in `title` attribute'ü var (tooltip). Lit `@property() title` onu override etti ve TS `noImplicitOverride` yakaladı. `expTitle` (experiment title) rename; attribute adı `exptitle` ama property binding `.expTitle=${...}` kullanıyoruz.
3. **`rgba(13, 15, 19, ...)` literal'leri tolere edildi.** Plan onayladı — token sistemi `backdrop-filter` ile uyumsuz, Sprint 1.x'te `--overlay-bg-75/88/90` eklenecek.
4. **`#0A0A0B` play buton metin rengi literal.** Sprint 0.8 mod switch amber butonunda da vardı; ortak `--on-accent` token'ı Sprint 1.x'te eklenecek.
5. **Glow rgb literal `rgba(255, 184, 77, 0.45)`** — `--accent`'in alpha varyantı. Sprint 1.x'te `--accent-glow` token.
6. **Subtitle split'i `·` üzerinden, son parça amber.** Plan'ın "[DENEY] title [meta]" formatını subtitle string'inden çıkarmak için. Bu mantık chrome içinde — design-mode düz string geçiyor, split logic chrome'da. Tek kaynak (subtitle prop) korunuyor.
7. **Dot pulse 1.5 s döngü.** Plan "çok hızlı olmamalı". Fitts Law gibi bir estetik çağrışım — yavaş nefes.
8. **Zoom panel transport'un altında, wrapper .canvas-ctrl ile birlikte.** Plan'ın "dayanıklı pattern" önerisi — transport yüksekliği değişirse zoom otomatik kayar.
9. **SVG viewBox 24.** Tüm transport ve zoom ikonları standart ölçek. Button içinde `width: 14px/12px` ile `stroke-width: 2` optik dengeyi korur.

## Bilinen Estetik Gözlemler

1. **Badge uppercase + mono ile "f_c ≈ 15.9 KHZ" görünüyor.** CSS `text-transform: uppercase` badge'e uygulandı — "kHz" → "KHZ" olmuş. Sprint 0.7'deki µ/Μ Latin sorunu yok ama okunurluk açısından "15.9 kHz" daha tanıdık. Rapor: kabul edilebilir, sprint'te `text-transform` kaldırılabilir veya yalnızca `DENEY` kelimesine uygulanabilir — küçük estetik tartışma, Sprint 1.x.
2. **Transport bar gölge `0 6px 20px rgba(0,0,0,0.5)` güçlü.** "Kayan kart" hissi belirgin; bazıları "çok ağır" bulabilir. Şef mockup referansına uygun; zevk tartışması.
3. **Pulse dot çok küçük (5 px).** Hareketi görmek için dikkatli bakmak gerek. 6 veya 7 px düşünülebilir — Sprint 1.x micro-UX.
4. **Zoom paneli "100%" statik görünüyor** — kullanıcı `− +` ile değişmediğinden şüphelenebilir. Sprint 1.x tooltip ("Sprint 1.x+'da aktif olacak") eklenebilir.
5. **Transport süre göstergesi "100.00 µs" — hard-coded sabit**. Gerçek simTime Sprint 1.x'te transient animation current time'dan gelecek.

## Bilinen Eksiklikler (Bilerek)

- **Play/Pause gerçek davranış yok.** Transient grafik statik; canlı simülasyon Sprint 1.x+.
- **Zoom gerçek davranış yok.** Canvas transform yok.
- **Timeline scrubbing yok.** Prev/Next sadece log.
- **f_c otomatik hesaplanmıyor** — circuit'ten türetilmeli (Sprint 1.x).
- **Tooltip yok.**
- **Keyboard shortcut yok.**
- **Overlay responsive davranışı test edilmedi** — 1024×768 altı viewport'larda badge + ctrl çakışabilir. Sprint 1.x test.

## Sonraki Adım

Sprint 0.11 — Sidebar bileşen kataloğu. 6 temel bileşen ikonu (direnç, kapasitör, pil, LED, anahtar, toprak). SVG sembol, hover hali, seçili hali. **Tıklanınca bir şey yerleştirmez** — Faz 1 kapanışı, görsel tamamlama.
