# Sprint 0.4 — Backend Bridge + Canlı DC Operating Point

**Amaç:** v1 engine'in solver'ını v2'den kullanılabilir hale getirmek, hard-coded bir RC low-pass devresini çözdürüp canlı sayısal sonucu dashboard'a basmak. Canvas'ta devre çizimi yok — "backend konuşuyor" kanıtı.

**Durum:** ✅ Tamamlandı. Dashboard'da V_ÇIKIŞ = 5.00 V (amber), V_GİRİŞ = 5.00 V, I(R1) = 5.10 pA (cyan). v1 regression sıfır.

## Engine Keşfi (v1 yapısı)

| Özellik | Durum |
|---|---|
| Dosya sayısı | 28 (`src/engine/*.js`) |
| Modül sistemi | **IIFE + global `VXA` namespace** — ESM DEĞİL |
| Dependency modeli | Runtime global state (`SIM`, `S`, `S._nodeVoltages`) |
| Build yolu | `build.js` tüm `.js`'leri concat edip `dist/index.html` içine `<script>` olarak gömüyor |
| Worker | `sim-bridge.js` ile ana thread'den worker spawn, worker body `sim-worker-body.js`'te (238 satır) |

**Kritik keşif — `sim-worker-body.js` self-contained:** Worker kendi `circuit`, `nodeV`, `simTime`, `dt`'sini tutuyor; VXA namespace'ine veya başka `.js` dosyasına bağımlı değil. Kendi MNA stamp + Newton-Raphson solver'ı (R/C/L/V/I + Diode/BJT/MOS/OpAmp) içinde. Protokol:

```
postMessage({ command: 'init', circuit: { N, branchCount, dt, comps: [...] } })
  → worker: { type: 'ready', nodeCount }

postMessage({ command: 'dcOP' })
  → worker: { type: 'dcOP', success: true, nodeVoltages: ArrayBuffer }
```

`nodeVoltages` = Float64Array, boyut `N + branchCount`. İlk `N` eleman non-ground düğüm voltajları (MNA index 1..N → arr[0..N-1]); sonraki `branchCount` eleman V-source akımları.

## Bridge Mimarisi

`ui-v2/src/bridge/engine.ts` — **v2'nin engine'e tek erişim noktası.**

```
┌─────────────────────────────────────────────────────────────┐
│ ui-v2/src/bridge/engine.ts                                  │
│                                                              │
│   import workerBody from '@v1-engine/sim-worker-body.js?raw'│
│                    │                                         │
│   Blob + URL.createObjectURL + new Worker(url, 'classic')   │
│                    │                                         │
│   CircuitDef (v2)  ─── toWorkerPayload ───► { N, bc, comps }│
│                                                      │       │
│   SolveResult (v2) ◄── fromWorkerResult ──── ArrayBuffer     │
└─────────────────────────────────────────────────────────────┘
```

v2 tarafındaki public API'ler:
- `solveCircuit(circuit: CircuitDef): Promise<SolveResult>` — tek entry
- `resetBridge(): void` — test/HMR için worker terminate

**v2 hiçbir başka yerden `@v1-engine/...` import etmez.** `vite.config.ts`'teki `resolve.alias['@v1-engine']` ile fiziksel yol `../src/engine` — kopyalama yok, sembolik erişim. Vite build aşamasında `?raw` içeriği bundle'a inline olur, dist'te v1 dosyasına referans kalmaz.

## Devre Çevirisi (v2 → worker)

v2 `CircuitDef` düğüm adları string'dir (`'in'`, `'out'`, `'gnd'`). Worker integer indeks bekler (0 = ground). Bridge mapping:

| v2 input | Worker output |
|---|---|
| `nodes: ['in', 'out', 'gnd']` | `N = 2`, ground (`'gnd'`) → 0, `'in'` → 1, `'out'` → 2 |
| `{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 5 }` | `{ type: 'V', n1: 1, n2: 0, val: 5, bi: 0 }` |
| `{ type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 }` | `{ type: 'R', n1: 1, n2: 2, val: 1000 }` |
| `{ type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 10e-9 }` | `{ type: 'C', n1: 2, n2: 0, val: 10e-9 }` |

**`dt: 1e6`** gönderiyoruz DC operating point için — trapezoidal companion model'de kapasitör Geq = 2C/dt → büyük dt = küçük Geq = ideal open circuit yaklaşımı. Başlangıç `vPrev = 0` olduğundan `ieqC = 0`. Kısacası: "DC'de kapasitör açık devre" standardı garantili.

Ground adı otomatik tespit: `'gnd'`, `'ground'`, veya `'0'` hangi varsa. Yoksa `Error` fırlatılır → `SolveResult` hata durumuyla döner.

## Sonuç Çevirisi (worker → v2)

Worker'ın `Float64Array` view'ından:
- Node voltajları: `arr[idx - 1]` her non-ground düğüm için
- V-source akımı: `arr[N + bi]`
- **Pasif bileşen akımı (R/C/I) bridge tarafında Ohm yasası ile hesaplanır:**
  - R: `(V(n1) - V(n2)) / R` — Kirchhoff current, pozitif n1→n2 yönünde
  - C: `0` (DC steady-state, kapasitör ideal open)
  - I: sabit (devre parametresi)
  - L: Sprint 0.5+ (v1 indüktör branch current'ı worker dcOP response'una dahil değil)

## Ölçümler (production build · puppeteer)

| Slot | Değer | Renk (computed) | Token |
|---|---|---|---|
| V_ÇIKIŞ | `5.00 V` | `rgb(255, 184, 77)` | `--accent` #FFB84D ✓ |
| V_GİRİŞ | `5.00 V` | `rgb(232, 234, 237)` | `--fg` #E8EAED ✓ |
| I(R1)   | `5.10 pA` | `rgb(61, 224, 255)` | `--current` #3DE0FF ✓ |

- V_GİRİŞ = 5V (kaynak değeri, doğrulandı) ✓
- V_ÇIKIŞ = 5V (kapasitör dolmuş DC steady-state, doğru) ✓
- I(R1) = 5.10 pA ≈ 0 (solver hassasiyeti düzeyinde numerik artık, beklendiği gibi) ✓

**Console:** 0 error, 0 warning, 0 failed request. Dev mode warning'leri yok (prod build).

Diğer bölgeler Sprint 0.3'teki gibi:
- Topbar, sidebar, inspector → placeholder metinleri sabit
- Canvas → `<vxa-canvas>` mount, noktalı grid aynen
- Dev marker → "sprint 0.4 · backend bridge + dc op · v2"

## Hata Senaryoları

### 1. Bridge-side validation (runtime test edilmedi, statik garanti)

`toWorkerPayload()` şu durumlarda `Error` fırlatır, `solveCircuit` `success: false` döner:
- Ground düğümü yok (`nodes` listesinde `'gnd'` / `'ground'` / `'0'` hiçbiri yok)
- Bileşen düğümü `nodes[]` listesinde tanımsız

`console.error('[bridge] solver başarısız:', msg)` yazılır + dashboard `.dashboard-zone--error` kutusunu gösterir.

### 2. Worker timeout

`SOLVE_TIMEOUT_MS = 5000`. Worker 5 saniye içinde cevap vermezse `SolveResult` timeout mesajıyla döner, dashboard hata kutusu çıkar. (Runtime'da tetiklenmedi — solver ~1-5 ms sürüyor.)

### 3. Engine bilinmeyen tip (`type: 'FOO'` gibi)

**Statik analiz** (`sim-worker-body.js` line 22+, `stampAndSolve` fonksiyonu): `if/else` zinciri, hiçbir dala uymayan tip **silent skip** edilir. Exception fırlatılmaz, default davranış yok — o bileşen devreden sessizce kaybolur, geri kalanıyla solver çalışır.

Sprint 0.5 için çıkarım: bileşen kataloğu genişlediğinde "v1 engine destekliyor mu?" kontrolü **bridge tarafında** yapılmalı — kullanıcıya "bu bileşen Sprint X'te desteklenecek" uyarısı gösterilebilir. Runtime'da silent skip sessiz veri kaybı yapar.

TypeScript `ComponentType` union'ı şu an `'V' | 'R' | 'C' | 'L' | 'I'` — worker gerçekte 71 tip destekliyor. Union Sprint 0.5+ genişletilirken bridge'de validation katmanı eklenmeli.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | v1 engine bridge ile v2'den import çalışıyor | ✅ (`?raw` + Blob worker) |
| 2 | RC devresi solve → `success: true` | ✅ |
| 3 | Sayısal sonuç mantıklı (5V/5V/~0A) | ✅ (DC steady-state) |
| 4 | Dashboard 3 slot hizalı | ✅ (puppeteer computed style doğru) |
| 5 | V_ÇIKIŞ amber, I(R1) cyan | ✅ (rgb match) |
| 6 | Canvas + placeholder bölgeler Sprint 0.3'teki gibi | ✅ |
| 7 | Console temiz | ✅ (prod build) |
| 8 | Bundle size raporda | ✅ (aşağıda) |
| 9 | `git diff src/` boş | ✅ |
| 10 | v1 build yeşil | ✅ (31 ms, 131 modül) |
| 11 | Prod deploy sonrası canlı değer | ⏳ push sonrası |

## Bundle Boyutu

| Dosya | Sprint 0.3 | Sprint 0.4 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.69 KB | 1.69 KB | 0 |
| `index.css` | 0.89 KB | 0.89 KB | 0 |
| `index.js` | 26.82 KB | 44.42 KB | +17.60 (worker body inline + bridge + dashboard) |
| **Gzip total** | ~10.9 KB | ~16.1 KB | +5.2 KB |

Büyümenin kaynağı: `sim-worker-body.js` (9.7 KB) `?raw` olarak string'e inline edildi + bridge.ts (~10 KB) + design-mode.ts dashboard mantığı. Plan tahmini 30-40 KB'ın üzerinde ama worker body size'ı önceden görülemezdi; kabul edilebilir. Chunk uyarı eşiği 256 KB, çok altında.

## Dosya Değişiklikleri

**Yeni:**
- `ui-v2/src/bridge/engine.ts` — tek köprü, ~250 satır.
- `ui-v2/src/circuits/rc-lowpass.ts` — test devresi tanımı.
- `SPRINT-0.4-REPORT.md`.

**Güncellenen:**
- `ui-v2/vite.config.ts` — `resolve.alias['@v1-engine']`, `node:path` ve `node:url` importları.
- `ui-v2/tsconfig.json` — `types: ["vite/client"]` (`?raw` declaration için) + `allowImportingTsExtensions: true` (named type import'u için).
- `ui-v2/src/modes/design-mode.ts` — dashboard canlı 3-slot (V_ÇIKIŞ/V_GİRİŞ/I(R1)) + loading/error/ok state, `.dashboard-zone` ayrı class.

**Dokunulmayan:**
- `ui-v2/src/canvas/canvas.ts` — Sprint 0.3'teki gibi
- `ui-v2/src/design/tokens.css` — yeni token yok
- `ui-v2/src/app-root.ts`, `ui-v2/src/main.ts`, `ui-v2/index.html`, `ui-v2/package.json`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/`, `build.js`, `index.html`, `simulator.html` — sıfır dokunuş. `git diff src/` boş.

## Karar Noktaları

1. **Worker Blob-from-raw yaklaşımı** yerine Vite native worker import (`new Worker(new URL(...))`) seçmedim çünkü sim-worker-body.js IIFE (classic script), Vite default worker'ı module. Blob + classic daha temiz bir eşleşme — ve engine'e referans inline'lanır, ayrı dosya oluşmaz.
2. **`dt: 1e6` DC hack'i** yerine SPICE stil "kapasitör open, indüktör short" ön-transformu düşündüm ama bridge v2 tarafında bileşen filtreleme karmaşıklığı ekleyecekti. Mevcut yöntem: engine'e dokunmadan büyük dt ile benzer sonuç. Transient için Sprint 0.5+ dt parametresi açılacak.
3. **Pasif bileşen akımları bridge tarafında hesap.** Worker dcOP cevabı sadece node voltajları + V-source akımları. R/C için Ohm/Kirchhoff kendi tarafımızda — hızlı ve doğru. L için worker branch current'ı dahil edilmeli (v1 engine'de mevcut ama dcOP response'una bağlanmamış).
4. **`allowImportingTsExtensions`** tsconfig'e eklendi. Sprint 0.1-0.3'te side-effect import (`import './foo.ts'`) geçiyordu, named import (`import { x } from './foo.ts'`) TS 5.9'da yakalandı. En az dokunuşla çözüm.
5. **Loading state'te 3 slot layout korunuyor, sadece opacity 0.35.** Plan "placeholder değer yok" — değer alanı boş bırakıldı (`${nothing}`), layout zıplaması yok. Solver ~5-10 ms sürüyor; kullanıcı loading'i neredeyse göremiyor.
6. **`.dashboard-zone` ayrı class** (canvas için yaptığım gibi). Base `.zone` class placeholder stillerini (dashed border, merkez hiza) taşıyor — dashboard artık gerçek içerik.
7. **V_ÇIKIŞ/V_GİRİŞ/I(R1) başlık konvansiyonu.** SPICE node formatına yakın. Tam SPICE notasyonu `V(out)` / `V(in)` / `I(R1)` ama görsel sadelik için `V_ÇIKIŞ` tercih edildi.

## Bilinen Eksiklikler

- **Transient analiz yok.** Sadece DC operating point. Kapasitörün dolma eğrisi görülmüyor. Sprint 0.5-0.6.
- **İndüktör akımı yok.** Worker dcOP branch current'ı sadece V-source için.
- **Bileşen kataloğu yok.** Kullanıcı devreyi değiştiremez — RC hard-coded.
- **Canvas'ta devre çizimi yok.** → Sprint 0.5.
- **Runtime hata senaryosu testi yok.** Bridge-side validation + engine silent-skip statik analizle belgelendi; tam end-to-end `error-state` UI testi yapılmadı.
- **AC/Transient/Sweep analiz modu yok.** → Sprint 0.7+.
- **Fresh install sonrası solver soğuk başlatma latency'si ölçülmedi.** Tipik: ~5-10 ms.

## Sonraki Adım

Sprint 0.5 — Canvas'ta RC devresi render. V1 pil sembolü, R1 zigzag, C1 paralel çizgi, düğümler, toprak sembolü. Probe etiketleri canvas'ta (V_ÇIKIŞ / V_GİRİŞ nokta etiketleri). Dashboard aynen kalır — iki kaynak aynı solver çıktısını göstersin.
