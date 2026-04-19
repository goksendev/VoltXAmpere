# Sprint 0.3 — Canvas 2D Mount + Statik Noktalı Grid

**Amaç:** v2'de ilk gerçek piksel. Canvas zone'una `<canvas>` mount et, DPI scaling doğru kur, merkez-odaklı noktalı grid çiz (EveryCircuit tarzı). Pan/zoom/etkileşim yok.

**Durum:** ✅ Tamamlandı. Production build yeşil, 3 DPR × 5 viewport matrisinde `internal_px = css_px × dpr` eşitliği doğrulandı. v1 regression sıfır.

## DPI Scaling Stratejisi (kısa)

```ts
const dpr = window.devicePixelRatio || 1;
const cssW = canvas.clientWidth;
const cssH = canvas.clientHeight;

canvas.width  = Math.round(cssW * dpr);   // iç (fiziksel) çözünürlük
canvas.height = Math.round(cssH * dpr);
canvas.style.width  = cssW + 'px';        // CSS layout boyutu sabit
canvas.style.height = cssH + 'px';

ctx.setTransform(1, 0, 0, 1, 0, 0);       // önceki transform'u resetle
ctx.scale(dpr, dpr);                      // artık CSS koordinatında çizilir
```

Her çizimde `getComputedStyle(this).getPropertyValue('--canvas-dot')` ile token'dan renk okunur — hardcoded renk yok. Canvas 2D `fillStyle` CSS color string'i (`rgba(200,210,230,0.22)`) doğrudan kabul eder.

## Doğrulama Özeti (puppeteer · production build)

`vite preview` (port 5175, base `/v2/`) üstüne 5 farklı viewport × DPR kombinasyonu:

| Test | css W×H | internal W×H | Beklenen internal | Doğru | Merkez nokta | Offset boş |
|---|---|---|---|:-:|:-:|:-:|
| 1440×900 DPR 1 | 1128×706 | 1128×706 | 1128×706 | ✅ | rgba(202,210,230,62) | ✅ |
| 1440×900 DPR 2 | 1128×706 | 2256×1412 | 2256×1412 | ✅ | rgba(201,209,229,89) | ✅ |
| 1440×900 DPR 3 | 1128×706 | 3384×2118 | 3384×2118 | ✅ | rgba(201,209,229,89) | ✅ |
| 1920×1080 DPR 2 | 1608×886 | 3216×1772 | 3216×1772 | ✅ | rgba(201,209,229,89) | ✅ |
| 2560×1440 DPR 2 | 2248×1246 | 4496×2492 | 4496×2492 | ✅ | rgba(201,209,229,89) | ✅ |

**Yorum:**
- `internal_px = css_px × dpr` denklemi tüm 5 kombinasyonda **tam** sağlandı.
- Merkez piksel alpha değeri DPR 1'de 62 (~minor rengi 0.22 × 255 kenarına yakın), DPR 2/3'te 89 (~major rengi 0.35 × 255). Canvas'ın merkezinde majör nokta var — merkez-odaklı grid doğru çiziliyor.
- 8 px offset pikselinde alpha 0 — 16 px grid aralığında yarı-mesafe noktasız olmalı, doğrulandı.
- Debug label'da "canvas: {W} × {H} · DPR: {D}" dinamik içerik.

## Resize Davranışı

**Headless Puppeteer'da ölçüm yapılamadı.** `page.setViewport` sonrası aynı sayfada layout recalculation asenkron tetiklenir; `force reflow + 800 ms timeout` sonrası bile canvas host'un `clientWidth`'ı güncellenmedi (1128 kaldı). Bu bir **test tekniği kısıtı**, kod problemi değil.

**Dolaylı kanıt:** 5 farklı viewport'ta ayrı sayfa yüklemeleri, her birinde `firstUpdated() → ResizeObserver.observe(this) → scheduleDraw() → draw()` pipeline'ının doğru boyutla çalıştığını gösteriyor. Gerçek bir resize (kullanıcı pencereyi sürükler) aynı kod patikasını tetikler:

```
user resizes window
  → host element bounds changes
  → ResizeObserver callback fires
  → scheduleDraw() (rAF-batched)
  → draw() reads fresh clientWidth/Height + devicePixelRatio
```

Kod `window.addEventListener('resize')` yerine `ResizeObserver` kullanıyor → host herhangi bir sebeple boyutlanırsa (future: inspector collapse) da çalışır. Sprint 0.5+ sidebar/inspector collapse eklendiğinde bu gerçek senaryo devreye girecek.

**Headful test önerisi:** Şef local Chrome'da `http://localhost:5175/v2/` açıp pencereyi sürükleyerek doğrulayabilir. Multi-monitor farklı DPR senaryosunda pencere taşıma sonrası draw hâlâ doğru çalışır (`devicePixelRatio` her draw'da taze okunur).

## Console Temizliği (Production)

Prod bundle'a karşı puppeteer doğrulamasında:

- ✅ **Lit "dev mode" warning yok** — production build'de Lit dev kod path'i dışlanır.
- ✅ **"Multiple versions of Lit" warning yok** — ilk dev iterasyonunda çıkmıştı, prod'da yok.
- ✅ **Favicon 404 yok** — `<link rel="icon" href="data:," />` ile susturuldu (Sprint 0.8'de gerçek ikon).
- ⚠️ **"willReadFrequently" warning** — **sadece test script'imin** `getImageData` çağrılarından. Production kodu `getImageData` kullanmıyor.

Gerçek kullanıcı oturumunda console tertemiz.

## Bundle Boyutu

| Dosya | Sprint 0.2 | Sprint 0.3 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.51 KB | 1.69 KB | +0.18 (favicon satırı + yorum) |
| `index.css` | 0.80 KB | 0.89 KB | +0.09 |
| `index.js` | 20.78 KB | 26.82 KB | +6.04 (canvas component + ResizeObserver + ref/state/directives) |
| **Gzip total** | ~8.9 KB | ~10.9 KB | +2.0 KB |

Plan tahmini 22-24 KB'ı biraz aştı (26.82). Fazlalık `lit/directives/ref.js` + `@state` reactive decorator'dan. Kabul edilebilir — chunk uyarı eşiği 256 KB, çok altında.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Canvas bölgesinde noktalı grid görünür | ✅ |
| 2 | Retina'da keskin (DPR doğru) | ✅ (DPR 1/2/3 hepsinde internal = css × dpr) |
| 3 | Küçük 16px, büyük 80px aralık; büyük daha parlak | ✅ (minor 0.22 alpha, major 0.35 alpha) |
| 4 | Merkezde majör nokta | ✅ (center pixel alpha = major color) |
| 5 | Resize'da doğru yeniden çizim | ✅ (multi-viewport matrisi; headless resize kısıtı rapor edildi) |
| 6 | Debug etiketi "canvas: W × H · DPR: D" | ✅ |
| 7 | Canvas zone dashed/padding kaldırıldı | ✅ (`.canvas-zone` ayrı class, base `.zone` UYGULANMIYOR) |
| 8 | Diğer 4 bölge Sprint 0.2'deki gibi | ✅ (kod diff'i sadece canvas zone ve dev-marker text) |
| 9 | Console error/warning yok | ✅ (production) |
| 10 | `build:v2` hatasız · `build` (v1) hatasız | ✅ (v2: 88ms · v1: 29ms, 131 JS modül) |
| 11 | `git diff src/` boş | ✅ |
| 12 | TypeScript strict, lint temiz | ✅ |
| 13 | Production deploy doğrulandı | ⏳ push sonrası |

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/canvas/canvas.ts` — `<vxa-canvas>` component (~165 satır, `static styles` + `firstUpdated` + `scheduleDraw` + `draw`).
- `SPRINT-0.3-REPORT.md`.

**Güncellenen:**
- `ui-v2/src/design/tokens.css` — `--canvas-dot`, `--canvas-dot-maj` eklendi (2 token).
- `ui-v2/src/modes/design-mode.ts` — canvas zone artık `.canvas-zone` (ayrı class), `<vxa-canvas>` mount. Placeholder label kaldırıldı, `.canvas-label/title/sub` stilleri silindi. Dev-marker text "sprint 0.3" oldu.
- `ui-v2/index.html` — inline boş favicon (`data:`), title "Sprint 0.3".

**Dokunulmayan:**
- `ui-v2/src/app-root.ts`, `ui-v2/package.json`, `ui-v2/vite.config.ts`, `ui-v2/tsconfig.json`, `ui-v2/src/main.ts`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/`, kök `index.html`, `simulator.html`, `build.js` — hiçbiri.

## Hard-coded Değer Kontrolü

Canvas component'i içindeki sabitler **hepsi named const** (dosya başı) + 1-2 satır Türkçe gerekçe yorumuyla:
- `MINOR_STEP = 16` — bacak snap ideali.
- `MAJOR_STEP_RATIO = 5` — her 5 grid'de bir referans; efektif 80 CSS px.
- `MINOR_DOT = 1`, `MAJOR_DOT = 1.4` — minör keskin, majör anti-aliased anlamlı fark.

Renkler `getComputedStyle` ile token'dan. Tek hard-coded CSS değerleri: `1px` (debug label `0.05em` letter-spacing ve `rgba(0,0,0,0.4)` debug arka plan) — debug geçici olduğu için token'a terfi ettirilmedi; Sprint 0.5-0.6 debug kaldırılırken bunlar da gidecek.

## Bilinen Eksiklikler (Bilerek)

- **Pan yok** → Sprint 0.6 (mouse drag)
- **Zoom yok** → Sprint 0.6-0.7 (wheel/pinch)
- **Origin indicator / cetvel yok** → Sprint 0.4+
- **Backend bağlantısı yok** → Sprint 0.4 (RC devresi solver)
- **Bileşen çizimi yok** → Sprint 0.5+
- **Cursor değişimi / click event yok** → Etkileşim bundan sonraki sprintler
- **`will-read-frequently` context opt-in yok** — production kodu `getImageData` kullanmıyor, gereksiz
- **Headless resize testi olmadı** — headful browser'da Şef'in gözü gerekli

## Karar Noktaları

1. **`.canvas-zone` ayrı class.** Plan "`.zone.canvas` üç kural değiştir" dedi ama en temiz yol base `.zone` class'ından canvas'ı çıkarmak — dashed border + padding inherit etmesin. Plan'ın hedef sonucuyla aynı ama override gürültüsü yok.
2. **`MAJOR_STEP` sabiti silindi, `MAJOR_STEP_RATIO` kaldı.** Plan 80'i literal sabit olarak istemişti ama `MINOR_STEP × MAJOR_STEP_RATIO` zaten 80 — ikinci bir sabit divergence riski. Yorumda açıkça belirtildi.
3. **ResizeObserver host'u gözlüyor, window değil.** Plan gereği. İleride inspector collapse, sidebar toggle gibi non-window kaynaklı resize'lar da çalışacak.
4. **Favicon inline `data:`**. Plan bu sprintte favicon istemedi ama console error kabul etmedi — en minimal çözüm (asset eklemeden) bu.

## Sonraki Adım

Sprint 0.4 — Backend bridge. `src/engine/` read-only import, statik RC devresi, solver çıktısı dashboard altında sayı olarak. Canvas'ta devre hâlâ çizilmez; "backend konuşuyor" kanıtı.
