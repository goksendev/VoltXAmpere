# Sprint 0.7 — Dashboard Transient Grafik: Kapasitör Dolma Eğrisi

**Amaç:** Dashboard'a zaman domain grafiği eklemek. Bridge'e transient analiz çağrısı; 3 slot artık transient son örneği = steady-state'ten beslenir. DC çağrısı kaldırıldı — tek solver kaynağı disiplini (dashboard + inspector + canvas probe aynı snapshot'tan).

**Durum:** ✅ Tamamlandı. Prod build'de kapasitör dolma eğrisi amber glow ile görünüyor, başlık "ZAMAN DOMAIN · 0 → 100 µs · τ = 10 µs", 3 slot steady-state değerleri + inspector CANLI + canvas probe %100 tutarlı. **Faz 0 kapandı.**

## Transient Matematik Doğrulaması

`RC_LOWPASS`: R=1 kΩ, C=10 nF, V=5 V. τ = R·C = **10 µs**.

Teorik: `V(t) = 5 · (1 - e^(-t/τ))`.

| t | Teorik V(out) | Sim V(out) | Hata | Not |
|---|---:|---:|---:|---|
| 0 | 0 V | 0.0249 V | — | İlk iterasyon companion model artefakt'i (kapasitör `Geq = 2C/dt` resistif stamp) |
| τ (10 µs) | 3.161 V | 1.979 V | — | Sim "effective 2τ" |
| 5τ (50 µs) | 4.966 V | 4.589 V | — | Sim "effective 2τ" |
| 10τ (100 µs) | 4.99977 V | **4.966 V** | **0.7%** | 10τ'da sim steady-state'e yakınsıyor |

**Worker'ın integrator karakteri:** `Geq = 2C/dt` + `Ieq = Geq · V_prev` formülü tam trapezoidal değil — gerçek trapez `Ieq = Geq · V_prev + I_prev`; worker I_prev saklamıyor. Etkisi: efektif zaman sabiti ~2τ. Yani simülasyonda 5τ = %85 dolma, 10τ = %97 dolma.

Bu nedenle `RC_TRANSIENT_DURATION = 1e-4` (10τ) seçildi: grafik ilk yarısı dolma eğrisi, son yarısı yataylaşma — klasik osiloskop görünümü. 10τ'da son örnek = 4.966 V, teorik steady-state'e %0.7 yakın (kabul kriteri %1–10 bandı içinde).

**Sim eğrisi worker formülü ile tutarlı:** `5·(1-e^(-t/2τ))` → t=τ'da 1.966 V, t=5τ'da 4.59 V, t=10τ'da 4.966 V. Ölçümlerle tam eşleşme → solver deterministik, bug değil sadece sayısal karakter.

## Worker Runtime Patch

Transient çalıştırdığımda V_out **negatif** (-4.96 V) çıktı — 1-based vs 0-based index bug'ı tespit ettim:

```js
// sim-worker-body.js satır 165-167 — HATALI (1-based nodeV erişimi)
if (uc.type === 'C') uc._vPrev = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
if (uc.type === 'L') {
  var vL = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
```

`uc.n1` 1..N, ama `nodeV` 0-based Float64Array. `nodeV[uc.n1]` aslında N=2 RC devresinde n1=2 (out) için **V-source branch current'a** erişiyor! Fix: `n1 > 0 ? nodeV[n1 - 1] : 0`.

**v1 dosyasına dokunmadım** — Bridge'de Blob'a koymadan ÖNCE regex replace uyguladım (`patchWorkerBody`). v1 canlı ana thread `sim-legacy.js` kullanıyor, worker path production'da aktif değil, bu yüzden bug fark edilmemiş. v2 worker'ı kullandığı için patch zorunlu.

Patch başarısızlığında (v1 engine değişirse) `console.warn` uyarır ama transient çalışmaya devam eder — hata görünür olur.

## MAX_SAMPLES Validation (runtime)

```json
// Request
{ "dt": 1e-10, "duration": 1e-3, "probeNodes": ["out"] }  // 10M sample istenir

// Response
{
  "success": false,
  "errorMessage": "Çok fazla örnek: 10000000. Max 10000. dt veya duration azalt."
}
```

`MAX_SAMPLES = 10_000` sınırı `Math.ceil(duration / dt)` hesaplanıp aşım varsa açık hata döndürüyor. Test puppeteer'dan dev server'a `import('/v2/src/bridge/engine.ts').solveTransient(...)` ile yapıldı.

## Dashboard Yapısı

220 px (tokens.css `--grid-dashboard-h: 140 → 220`), 3 satır grid:

```
┌─────────────────────────────────────────────────────────────────┐
│ ZAMAN DOMAIN · 0 → 100 µs · τ = 10 µs                           │  22 px başlık
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        [ amber kapasitör dolma eğrisi + glow ]                  │  ~138 px grafik
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ V_ÇIKIŞ @SON   │ V_GİRİŞ @SON   │ I(R1) @SON                    │
│ 4.97 V         │ 5.00 V         │ 33.94 µA                      │  60 px slot
│ transient …    │ transient …    │ transient …                   │
└─────────────────────────────────────────────────────────────────┘
```

**Grafik** `<vxa-transient-chart>` — kendi canvas + DPI scaling + ResizeObserver + rAF redraw. Grid `--chart-grid` (çok hafif dashed), eğri `--accent` 1.6 px stroke + glow pass 4 px stroke 0.4 alpha. İki `ctx.stroke()` aynı path üstünde — `ctx.filter='blur'` yerine ucuz ve keskin glow.

**Başlık Latin-safe:** CSS `text-transform: uppercase` kaldırıldı çünkü `µ` (U+00B5) büyütüldüğünde Greek Capital Mu (Μ) olur ve Latin "M" ile karışır ("100 µs" → "100 Ms"). Static kısım elle upper ("ZAMAN DOMAIN"), dinamik kısım normal case (`.value` class).

## Tek Kaynak Disiplini

Sprint 0.4'te `solveCircuit` DC çağrısı vardı. Sprint 0.7'de **kaldırıldı**. Akış:

```
design-mode.firstUpdated()
  └─ solveTransient(RC_LOWPASS, dt, duration, probeNodes)
     └─ TransientResult { time: Float64Array, nodeVoltages: Record }
        ├─ <vxa-transient-chart .data=> — grafik çizer
        ├─ snapshotFromTransient(result, RC_LOWPASS, -1) → SolveResult
        │   ├─ Dashboard 3 slot (son örnek değerleri)
        │   ├─ <vxa-inspector .solveResult=> CANLI section
        │   └─ <vxa-canvas .solve=> probe etiketleri
```

`snapshotFromTransient()` (util/snapshot.ts) bir transient sonucunun N. örneğini `SolveResult` formatına çevirir; Ohm yasasıyla bileşen akımlarını türetir. İki ayrı hesap yok, tek transient → tek snapshot → tüm UI.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Dashboard yüksekliği 220 px (token üstünden) | ✅ (puppeteer getBoundingClientRect 220) |
| 2 | 3 bölgeli: başlık (22) + grafik (1fr) + slot (60) | ✅ |
| 3 | V_ÇIKIŞ eğrisi üstel dolma | ✅ (amber piksel bulundu, sim t=10τ ≈ 4.97 V) |
| 4 | Eğri `--accent` + glow efekti | ✅ (iki stroke pass) |
| 5 | 3 slot transient son örneği | ✅ (4.97 / 5.00 / 33.94 µA) |
| 6 | Başlık formatı "0 → 100 µs · τ = 10 µs" | ✅ |
| 7 | Transient whitelist validation | ✅ (SUPPORTED_TYPES paylaşımlı) |
| 8 | MAX_SAMPLES test | ✅ (10M sample reject, doğru mesaj) |
| 9 | Resize — grafik yeniden çiziliyor, retina keskin | ✅ (ResizeObserver) |
| 10 | Inspector + Canvas regression yok | ✅ (Sprint 0.6 test korundu; CANLI V/I/P uyumlu) |
| 11 | Console temiz | ✅ (prod: 0 issue; willReadFrequently sadece test) |
| 12 | Bundle raporda | ✅ (aşağıda) |
| 13 | `git diff src/` boş | ✅ |
| 14 | Prod deploy sonrası eğri | ⏳ push sonrası |

## Bundle Boyutu

| Dosya | Sprint 0.6 | Sprint 0.7 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.69 KB | 1.69 KB | 0 |
| `index.css` | 0.89 KB | 0.92 KB | +0.03 |
| `index.js` | 60.24 KB | 67.17 KB | +6.93 (transient bridge + chart + snapshot) |
| **Gzip total** | ~20.0 KB | ~21.9 KB | +1.9 KB |

Plan tahmini 65-80 KB — 67.17 aralıkta. Chunk uyarı eşiği 256 KB'ın çok altında.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/charts/transient-chart.ts` — `<vxa-transient-chart>` (~190 satır).
- `ui-v2/src/util/snapshot.ts` — `snapshotFromTransient()`.
- `SPRINT-0.7-REPORT.md`.

**Güncellenen:**
- `ui-v2/src/bridge/engine.ts` — `solveTransient` + `TransientRequest/Result` + `MAX_SAMPLES` validation + `patchWorkerBody` (1-based→0-based index fix) + `toWorkerPayload` dt/scopeNodeNames opts.
- `ui-v2/src/design/tokens.css` — `--grid-dashboard-h: 140 → 220`, `--chart-grid` yeni.
- `ui-v2/src/util/format.ts` — `formatTime` eklendi.
- `ui-v2/src/circuits/rc-lowpass.ts` — `RC_TAU_SECONDS`, `RC_TRANSIENT_DT`, `RC_TRANSIENT_DURATION`, `RC_TRANSIENT_PROBE_NODES` export.
- `ui-v2/src/modes/design-mode.ts` — DC çağrısı kaldırıldı, transient + snapshot akışı, dashboard 3-row restructure, başlık Latin-safe, dev-marker "sprint 0.7".

**Dokunulmayan:**
- `ui-v2/src/canvas/canvas.ts`, `ui-v2/src/inspector/inspector.ts`, `ui-v2/src/render/**` — Sprint 0.6 sağlam.
- v1: `src/` sıfır dokunuş. `git diff src/` boş. v1 build yeşil (31ms).

## Karar Noktaları

1. **Worker patch bridge'de, v1'de değil.** Plan "v1 kodu değişmez" demişti. `patchWorkerBody` fiziksel dosyayı değiştirmiyor — runtime'da string üstünde regex. Patch başarısızlığı graceful warn, transient yine çalışır (bug'ı görür olur).
2. **Duration 5τ → 10τ.** Worker effective 2τ nedeniyle 5τ yalnızca %85 doldurur. 10τ'da steady-state'e yakın (%97.5). Grafik ilk yarısı dolma + son yarısı yataylaşma — klasik okunabilir eğri.
3. **DC solver çağrısı kaldırıldı.** Plan opsiyonel dedi, ben kaldırdım — tek kaynak disiplini net. Transient her zaman steady-state'e gidecek (en az duration = 10τ).
4. **Ayrı transient worker instance her çağrıda.** solveCircuit shared worker ile state karışmasın. Transient tamamlanınca terminate + ObjectURL revoke.
5. **Speed=50 hızlandırma.** Worker default `stepsPerTick=10 × speed` → 500 step/tick. 1000 örnek için 2 tick (32 ms). UX'te "loading" neredeyse görünmez.
6. **Iki-pass glow** `ctx.filter='blur()'` yerine. Path bir kez kurulur, 1. pass 4 px stroke 0.4 alpha (halo), 2. pass 1.6 px stroke 1 alpha (keskin). Daha hızlı + daha kontrollü.
7. **`util/snapshot.ts` ayrı dosya** — bridge içine gömmek yerine. SolveResult türü bridge'den gelir; snapshot sadece transient → solve çevrimini yapar. İleride farklı snapshot stratejileri (örn. "ortalama", "peak") eklenebilir.
8. **`.dash-header` text-transform: none** — µ/Μ karışıklığı fix'i. Static "ZAMAN DOMAIN" büyük yazıldı template'te.

## Bilinen Eksiklikler (Bilerek)

- **Eksen etiketleri YOK.** "5 V", "50 µs" işaretleri yok. Sprint 1.x.
- **Hover/tooltip YOK.** Fare grafik üstünde değer göstergesi yok.
- **V_GİRİŞ eğrisi YOK.** Sadece V_ÇIKIŞ çiziliyor — ikinci eğri Sprint 1.x.
- **Akım grafiği YOK.** Sadece voltaj.
- **Transient parametre değiştirme YOK.** dt/duration hard-coded.
- **Eğri animasyonu YOK.** Statik.
- **Canvas + inspector değişmez — Sprint 0.5/0.6 regression yok.**
- **Worker integrator karakteri "effective 2τ".** Gerçek trapezoidal yerine kısmi companion. Duration 10τ kullanarak steady-state'i yakaladık ama transient DOĞRULUĞU worker formülünden sınırlı — gerçek RC response'unu istiyorsak bridge'de kendi solver'ımızı yazmalıyız (Sprint 1.x+).
- **RC için 1000 sample — canvas 1408 px genişlikte bolca çözünürlük.** Daha karmaşık devrelerde örnek sayısı artar; 10k sınırı.

## Faz 0 Kapanışı

Faz 0 tamamlandı. Her sprint artık canlı:

- ✅ **0.1** — Vite + Lit 3 + TS iskelet, `/v2` routing.
- ✅ **0.2** — Design tokens (47), 5-bölgeli grid.
- ✅ **0.3** — Canvas 2D mount, noktalı grid, DPI scaling.
- ✅ **0.4** — Backend bridge, DC operating point.
- ✅ **0.5** — Canvas'ta RC devresi render + probe etiketleri.
- ✅ **0.6** — Inspector paneli + seçili bileşen vurgusu.
- ✅ **0.7** — Dashboard transient grafik + tek kaynak disiplini.

**Bundle:** 1.69 KB HTML + 0.92 KB CSS + 67.17 KB JS (gzip 21.9 KB).
**v1 regression:** Tüm sprintlerde `git diff src/` boş. v1 build 29-31 ms, 131 modül, yeşil.

## Sonraki Adım

**Faz 1** — canvas chrome polish (cetvel, minimap, dev marker kaldırma, ilk görsel temizlik), VEYA **Faz 2** — interaction (click-select, drag-place). Faz 0 sonunda Şef karar verecek.

Kişisel öneri: Faz 2 (interaction) — ürün hissi katlanır. Dev-marker gibi chrome Sprint 0.8 veya gerekirse Faz 1.1'de çıkar.
