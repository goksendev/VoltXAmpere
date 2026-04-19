# Sprint 0.1 — v2 İskelet Raporu

**Amaç:** VoltXAmpere v2 için izole Vite + Lit 3 + TypeScript iskeletini kurmak, v1'e dokunmadan `voltxampere.com/v2` path'ine routing hazırlamak.

**Durum:** ✅ Tamamlandı. Production build yeşil, dev server çalışır, v1 `src/` tertemiz.

## Kurulan Paketler (ui-v2/)

| Paket | Versiyon |
|---|---|
| `lit` | 3.3.2 |
| `vite` | 5.4.21 |
| `typescript` | 5.9.3 |

Toplam: 17 paket (yalnızca Lit + Vite + TS — React/Vue/Preact/Solid yok, ek utility lib yok).

## Port Seçimi

Dev server **5174**'te çalışır (`strictPort: true`). Gerekçe:
- v1 `python3 -m http.server` ile **8765**'i kullanıyor (çakışma yok).
- Vite default 5173 — ileride ikinci bir Vite projesi açma ihtimaline karşı 5174'e sabitledim.
- Preview (build sonrası local test) **5175**.

## Vercel Deploy Yöntemi

Seçim: **repo root rewrite + buildCommand**.

`vercel.json` değişiklikleri:

1. `buildCommand`: `npm --prefix ui-v2 ci && npm --prefix ui-v2 run build`
   - Vercel build aşamasında sadece v2'yi build eder. v1 zaten statik dosya (build gerektirmez).
2. `outputDirectory`: `.` (aynı bırakıldı) — root'taki v1 dosyaları (`index.html`, `simulator.html`, vb.) olduğu gibi serve edilir.
3. Yeni `rewrites`:
   ```json
   { "source": "/v2",       "destination": "/ui-v2/dist/index.html" },
   { "source": "/v2/",      "destination": "/ui-v2/dist/index.html" },
   { "source": "/v2/(.*)",  "destination": "/ui-v2/dist/$1" }
   ```
   - `voltxampere.com/v2` ve `/v2/` → v2 index
   - `voltxampere.com/v2/assets/...` → Vite asset'leri
4. `headers` bloğu aynen korundu (CSP-ish güvenlik başlıkları değişmedi).

**Neden bu yol:** v1'in mevcut "static-everything" Vercel modelini bozmadan, tek build step ile v2'yi ekledim. v1'in `node build.js` scripti Vercel tarafından çağrılmıyordu zaten; dokunmadım.

## Dosya Listesi

**Yeni:**
- `ui-v2/package.json` · `ui-v2/tsconfig.json` · `ui-v2/vite.config.ts`
- `ui-v2/index.html`
- `ui-v2/src/main.ts` · `ui-v2/src/app-root.ts`
- `ui-v2/src/design/tokens.css`
- `ui-v2/src/README.md`
- `SPRINT-0.1-REPORT.md` (bu dosya)

**Değişen:**
- `package.json` — `dev:v2`, `build:v2`, `install:v2`, `vercel-build` script'leri eklendi. Mevcut v1 script'leri (`build`, `dev`, `test`, `scenarios`, `test:sparse`) aynen kalmıştır.
- `vercel.json` — yukarıda açıklandığı gibi.
- `.gitignore` — `ui-v2/node_modules/` ve `ui-v2/dist/` eklendi.

**Dokunulmayan:** `src/`, `index.html`, `simulator.html`, `build.js`, `sw.js`, `manifest.json`, `voltix-engine/`, `docs/`, `dist/`, `test-browser.js`.

`git diff src/` → boş (v1 regression yok).

## Build / Dev Doğrulama

```bash
# v2 build
$ npm run build:v2
✓ 23 modules transformed.
dist/index.html                  1.51 kB │ gzip: 0.83 kB
dist/assets/index-Cy8DUBV0.css   0.18 kB │ gzip: 0.16 kB
dist/assets/index-DpLCyiNG.js   18.26 kB │ gzip: 6.98 kB
✓ built in 73ms

# v2 dev
$ npm run dev:v2
VITE v5.4.21  ready in 83 ms
➜  Local:   http://127.0.0.1:5174/v2/

# Kanıt: HTTP 200, <vxa-app-root> DOM'da, main.ts modülü 200.
```

TypeScript strict kontrolü `tsc --noEmit` ile build öncesi çalışır, hata yok.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | `npm run dev:v2` → localhost:5174 açılır | ✅ |
| 2 | "VoltXAmpere v2 · Sprint 0.1 · iskelet çalışıyor" görülür | ✅ |
| 3 | Koyu zemin + Geist/JetBrains Mono yüklü | ✅ |
| 4 | `<vxa-app-root>` DOM'da | ✅ |
| 5 | `npm run build:v2` hatasız → `ui-v2/dist/` | ✅ |
| 6 | `npm run dev` (v1) aynen çalışır | ✅ (script değişmedi, port çakışmaz) |
| 7 | Vercel deploy: `/` v1, `/v2` Sprint 0.1 sayfası | ⏳ push sonrası doğrulanacak |
| 8 | `tsconfig.json` strict + lint temiz | ✅ |
| 9 | Sadece Lit — React/Vue yok | ✅ (`package.json` minimum) |

Kriter #7 ancak Vercel deploy sonrası doğrulanabilir. Local build output `/v2/assets/...` base path'iyle üretiliyor, rewrite'lar eşleşecek.

## Bilinen Eksiklikler (Bilerek)

- **Canvas yok** → Sprint 0.3.
- **Backend bağlantısı yok** (`src/engine/`, `src/core/` import edilmedi) → Sprint 0.4.
- **Bileşen / registry yok** → Sprint 0.5+.
- **Test altyapısı yok** (Vitest/Playwright kurulmadı) → Sprint 0.2 değerlendirecek.
- **Design token'lar minimum** (7 değişken) → Sprint 0.2 layout + tipografi skalası eklenecek.
- **Tek sayfa**, routing içi başka view yok (Tasarla shell bile yok).

## Karar Noktaları (Bilgilendirme)

1. **npm workspaces kullanmadım.** `ui-v2/` tam izole bir proje (kendi `package.json`, `node_modules`). Workspace kullansaydım root `package-lock.json`'ı şişirir ve v1 ile paylaşılan bağımlılık riski doğurur — plan "tamamen izole" dedi, literal uyguladım. Root'tan `npm --prefix ui-v2` ile çağırıyorum.
2. **`ui-v2/dist/` gitignore'da.** Vercel build aşamasında yeniden üretilir; commit edilen `dist/` stale riski taşır. `.vercel` ve `node_modules/` gibi lokal artifact olarak davrandım.
3. **robots `noindex,nofollow`** (index.html meta'da). v2 hazır olana kadar Google'da görünmesin.
4. **`main.ts` tokens.css'i import ediyor**, HTML'de ayrıca link yok. Vite bundle CSS'i asset olarak çıkarıyor (build output'ta `index-Cy8DUBV0.css`). Bu sayede dev ve prod'da tek yoldan yükleme.
5. **Experimental decorators açık** (`"experimentalDecorators": true`). Lit 3 `@customElement` klasik TS dekoratörlerini kullanıyor — standart decorators aktif olsa Lit uyumsuzluk yaşar.

## Sonraki Adım
Sprint 0.2 — Design tokens + layout grid iskeleti (topbar / sidebar / canvas / inspector / dashboard grid-template-areas). Hâlâ canvas yok, backend yok.
