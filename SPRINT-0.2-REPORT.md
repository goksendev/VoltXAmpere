# Sprint 0.2 — Tasarla Grid İskeleti + Token Genişletme Raporu

**Amaç:** v2 design token sistemini genişletmek ve 5-bölgeli Tasarla modu grid layout'unu placeholder olarak ayağa kaldırmak. Canvas 2D, backend ve bileşen yok — yalnızca "doğru kutular doğru yerde" testi.

**Durum:** ✅ Tamamlandı. Production build yeşil, 4 farklı viewport'ta grid ölçümleri tam; v1 regression sıfır.

## Token Sayısı

| Grup | Sayı |
|---|---|
| Sprint 0.1'den korunan | 8 |
| Sprint 0.2'de eklenen | 39 |
| **Toplam** | **47** |

Not: Plan "7 satır" diyordu ama Sprint 0.1'de fontlarla birlikte 8 token yazılmıştı (`--sans`, `--mono` dahil). Aynen korundu.

Yeni token grupları: yüzey (bg-2/3/4, canvas), kenar (line, line-str), metin hiyerarşisi (fg-3, fg-4), devre renkleri (v-pos, v-neg, ground, wire, probe-a/b/c), durum (ok, warn, err), tipografi skalası (fs-xs → 2xl, 7 adım), spacing (sp-1 → 6, 4px tabanlı), radius (r-1 → 4), grid boyutları (topbar/sidebar/inspector/dashboard).

## Grid Boyut Doğrulaması

Dev server üzerinde (headless Chrome via Puppeteer, v1 `node_modules`'ten) dört çözünürlükte `getBoundingClientRect()` ölçümü alındı. Tüm ölçümler `document.querySelector('vxa-app-root').shadowRoot → vxa-design-mode.shadowRoot → .zone.*` zinciri üzerinden gerçek render boyutları.

| Viewport | Topbar H | Sidebar W | Inspector W | Dashboard H | Canvas W | Canvas H |
|---|---:|---:|---:|---:|---:|---:|
| 1280 × 800 (MacBook Air) | **54** | **96** | **216** | **140** | 968 | 606 |
| 1440 × 900 | **54** | **96** | **216** | **140** | 1128 | 706 |
| 1920 × 1080 (Full HD) | **54** | **96** | **216** | **140** | 1608 | 886 |
| 2560 × 1440 (QHD) | **54** | **96** | **216** | **140** | 2248 | 1246 |

- Sabit boyutlar (kalın) tüm çözünürlüklerde ±0px. Kabul kriteri "±2px bile kabul değil" — **tam sıfır sapma**.
- Canvas genişliği = viewport_w − 96 − 216 = doğru.
- Canvas yüksekliği = viewport_h − 54 − 140 = doğru.
- Marker ("sprint 0.2 · tasarla grid iskelet · v2") her viewport'ta görünür ✅.
- Canvas başlığı "canvas-area" her viewport'ta render ediliyor ✅.

Doğrulama scripti `/tmp/vxa-sprint-0.2-verify.mjs` — tek seferlik, repo'ya commit edilmedi, kullanım sonrası silindi.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | 5-bölgeli grid görünür (topbar/sidebar/canvas/inspector/dashboard) | ✅ |
| 2 | Topbar 54px, sidebar 96px, inspector 216px, dashboard 140px | ✅ (4 viewport'ta ölçüldü) |
| 3 | Pencere genişleyince sidebar/inspector sabit, canvas büyür | ✅ (1280 → 2560 test) |
| 4 | Türkçe placeholder etiketleri doğru | ✅ |
| 5 | Canvas `--canvas` (#050709), diğer bölgeler `--bg-1` (#0D0F13) | ✅ |
| 6 | Bölgeler arası 1px `--line` kenar | ✅ |
| 7 | Bölge içi 1px dashed `--line-str` placeholder kenar | ✅ |
| 8 | Sol altta sprint etiketi | ✅ |
| 9 | `tokens.css` 47 token (8 + 39) | ✅ |
| 10 | `npm run build:v2` hatasız, `npm run build` (v1) hatasız | ✅ (v2: 74ms · v1: 29ms, 131 JS, 30.6K satır) |
| 11 | `git diff src/` boş | ✅ |
| 12 | Production deploy sonrası `/v2` yeni layout, `/` v1 | ⏳ push sonrası doğrulanacak |
| 13 | TypeScript strict + lint temiz | ✅ (`tsc --noEmit` build öncesi çalışır) |

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/modes/design-mode.ts` — `<vxa-design-mode>` grid iskelet component'i.
- `SPRINT-0.2-REPORT.md` (bu dosya).

**Güncellenen:**
- `ui-v2/src/design/tokens.css` — 8 token korundu, 39 yeni token eklendi.
- `ui-v2/src/app-root.ts` — Sprint 0.1 "iskelet çalışıyor" placeholder kaldırıldı, yerine tek satır `<vxa-design-mode>` render.

**Dokunulmayan:**
- `ui-v2/package.json`, `ui-v2/tsconfig.json`, `ui-v2/vite.config.ts`, `ui-v2/index.html`, `ui-v2/src/main.ts`, `ui-v2/src/README.md`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/`, `index.html`, `simulator.html`, `build.js`, `dist/`, `voltix-engine/`, `docs/`, vb.

## Hard-coded Değer Kontrolü

Bu sprintte `design-mode.ts` ve `app-root.ts` içinde **hiçbir renk/boyut literal yazılmadı**. Tüm değerler token:
- Renkler: `var(--bg-0)`, `var(--bg-1)`, `var(--canvas)`, `var(--line)`, `var(--line-str)`, `var(--fg-2)`, `var(--fg-3)`, `var(--fg-4)`
- Boyutlar: `var(--sp-2)`, `var(--sp-3)`, `var(--fs-xs)`, `var(--fs-lg)`, `var(--grid-topbar-h)`, `var(--grid-sidebar-w)`, `var(--grid-inspector-w)`, `var(--grid-dashboard-h)`

**Tek hard-coded değerler:** `1px` (kenar çizgileri) ve `100vh`/`100vw` (viewport tam boyut) ve `0.12em` (letter-spacing). Bunlar token sisteminde ayrı değişken gerektirmeyecek atomik primitive'ler. İleride `--line-weight: 1px` gibi token eklenebilir ama bu sprintte gereksiz.

## Bundle Boyutu

| Dosya | Sprint 0.1 | Sprint 0.2 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.51 KB | 1.51 KB | 0 |
| `index.css` | 0.18 KB | 0.80 KB | +0.62 (tokens büyüdü) |
| `index.js` | 18.26 KB | 20.78 KB | +2.52 (design-mode component) |
| **Gzip total** | ~7.8 KB | ~8.9 KB | +1.1 KB |

Bundle hâlâ cep telefonu dostu. 256KB chunk uyarı eşiğinin çok altında.

## Karar Noktaları (Bilgilendirme)

1. **Dev marker shadow DOM içinde.** Sprint etiketini `<vxa-design-mode>` shadow DOM'unda tuttum — `position: fixed` viewport'a göredir, shadow sınırı etkilemez. Gelecekte dev-mode-only toggle için prop'la kontrol edilecek.
2. **`aria-label` zones için, `aria-hidden` marker için.** Ekran okuyuculara 5 bölge semantik olarak tanıtılıyor, ama sprint etiketi UI gürültüsü olduğu için hidden. WCAG gerektirmiyor ama iyi hijyen.
3. **Grid `minmax(0, 1fr)`** — standart `1fr` yerine min-width 0 ile tanımlandı ki canvas bölgesi içerik taşması (future: uzun canvas) grid'i genişletmesin.
4. **Canvas etiketi merkez hizalı**, diğer bölgeler sol-üst hizalı. Canvas'ın "ana sahne" olduğunu ince bir tasarım koduyla işaretliyor.
5. **Font ailesi inheritance.** `:host` font-family tanımlamıyorum çünkü her `.zone` + `.canvas-title` zaten `var(--mono)` kullanıyor. İleriki sprintlerde bazı bölgeler (örn. dashboard) sans'a geçebilir.

## Bilinen Eksiklikler (Bilerek)

- **Canvas 2D context yok.** `<canvas>` elementi hiç yerleştirilmedi → Sprint 0.3.
- **Backend bağlantısı yok** (`src/engine/`, `src/core/` import edilmedi) → Sprint 0.4.
- **Bileşen / registry yok.** Sidebar boş → Sprint 0.5+.
- **Inspector / dashboard içerikleri yok** → Sprint 0.6-0.7.
- **Toolbar / mod switcher yok.** Topbar boş → Sprint 0.3 veya sonrası.
- **İnteraksiyon yok.** Hover, tıklama, drag hiçbir davranış yok. Bu plan dahilinde.
- **Responsive / mobile yok.** 1280×800 altında test edilmedi (plan hariç).
- **Animasyon yok.** Transition, loading, entrance animasyonları sonraki sprintler.
- **Test altyapısı yok.** Vitest/Playwright hâlâ yok. Bu sprint için puppeteer ad-hoc kullanıldı.

## Sonraki Adım

Sprint 0.3 — Canvas bölgesine `<canvas>` mount, Canvas 2D context, noktalı grid çizimi. Hâlâ backend yok, bileşen yok. Sadece "piksel çizilebiliyor mu" testi.
