# Sprint 0.5 — Canvas'ta RC Devresi Render + Canlı Probe Etiketleri

**Amaç:** Sprint 0.3 canvas + Sprint 0.4 solver sonucunu birleştirmek. V/R/C sembolleri, Manhattan teller, toprak, probe etiketleri. v2'nin ilk "gözle görülür ürün" sprinti.

**Durum:** ✅ Tamamlandı. Production build'de devre görünüyor (V1 pil + işaretli, R1 zigzag, C1 plakalar, iki toprak, iki probe kutusu). Dashboard ve canvas probe'ları aynı `5.00 V` değerini gösteriyor — tek kaynak garantili. v1 regression sıfır.

## Dosya Yapısı

```
ui-v2/src/
├── bridge/engine.ts              ← Sprint 0.4 bridge + WHITELIST validation
├── circuits/rc-lowpass.ts        ← CircuitDef + RC_LOWPASS_LAYOUT
├── canvas/canvas.ts              ← <vxa-canvas> prop-driven
├── util/format.ts                ← formatVolt + formatAmp (ortak)
└── render/
    ├── helpers.ts                ← Point, RenderColors, drawText, rotatePointCW, roundRectPath
    ├── circuit-renderer.ts       ← drawCircuit orkestratörü
    └── symbols/
        ├── wire.ts               ← Manhattan teller, 1.5 stroke, lineJoin round
        ├── ground.ts             ← 3 rail (20/14/6), --ground renk
        ├── resistor.ts           ← IEEE zigzag, 80 px, 6 diş, 1.8 stroke
        ├── capacitor.ts          ← Paralel plakalar, PLATE_LEN 24, GAP 8, 2.6 stroke
        ├── voltage-source.ts     ← Daire 34 px, + işaret 6 px, 1.8 stroke
        └── probe.ts              ← 108×40 kutu, 0.8 stroke kılçık, junction dot
```

## Bridge Whitelist Validation (Sprint 0.4 debt fix)

Sprint 0.4 keşfinde `sim-worker-body.js`'in match'siz component tipini **sessizce skip** ettiği bulundu. Sprint 0.5'te bridge'e whitelist eklendi:

```typescript
export type ComponentType =
  | 'V' | 'I' | 'R' | 'C' | 'L'
  | 'D' | 'Z' | 'BJT' | 'MOS' | 'OA';

export const SUPPORTED_TYPES: ReadonlySet<ComponentType> = new Set(...);

// solveCircuit() içinde:
const unsupported = circuit.components.filter(
  (c) => !SUPPORTED_TYPES.has(c.type as ComponentType),
);
if (unsupported.length > 0) {
  return { success: false, errorMessage: `...` /* bileşen listesi */ };
}
```

**Runtime test (puppeteer, dev server üzerinden bridge ESM runtime import):**

```json
// Valid devre (V=5, R=1kΩ, a-gnd)
{ "success": true, "nodeVoltages": { "gnd": 0, "a": 5 }, "branchCurrents": { "V1": -0.005, "R1": 0.005 } }

// Geçersiz tip (FOO)
{ "success": false,
  "errorMessage": "Desteklenmeyen bileşen tipleri: X1(FOO). Worker yalnızca V/I/R/C/L/D/Z/BJT/MOS/OA tanıyor." }
```

Console: `[bridge] solver başarısız: Desteklenmeyen bileşen tipleri: ...` (error). Valid devrede V1 branch current `-0.005 A` (MNA convention), R1 branch current `0.005 A` (pin1→pin2 yönünde 5V/1kΩ = 5 mA) — fizik doğru.

## Sembol Tasarım Kararları

### Direnç (IEEE zigzag)

- **80 px toplam** — 5 × grid (16 px) tam oturur.
- **6 diş (3 tepe + 3 dip)** — standart IEEE görünüm, yoğunluk orta.
- **±10 amplitud** — inner 60 px'e oranı 1/3, göz için hoş denge.
- **1.8 px stroke** — tel 1.5'ten belirgin kalın ama "kiremit" değil. Zigzag'ı net çiziyor.
- **Etiket konumu:** rotation 0'da üstte `R1`, altta `1 kΩ` (Y offset ±24). rotation 90'da sağda.

### Kapasitör (paralel çizgi)

- **Plaka uzunluğu 24 px** — bileşen tanınabilir ama devre merkezine yayılmıyor.
- **Plaka aralığı (GAP) 8 px** — plakalar yeterince ayrık ama kompakt.
- **LEAD 20 px** her iki yan — pin'lerden plakalara temiz tel.
- **Plaka stroke 2.6 px** — elektrot ağırlığı hissi; 1.5 tel, 1.8 gövde, 2.6 plaka kademesi.
- **Lead stroke 1.5 px** (wire ile aynı) — uç teller bileşen gövdesine geçiş öncesi.
- **Etiket:** rotation 0'da üstte id + altta değer, rotation 90'da sağda (C1 projemizde sağda).

### Voltaj Kaynağı (pil)

- **Daire çap 34 px** (radius 17) — R/C'den belirgin küçük; kaynak ikincil aksesuar.
- **İç dolgu `--canvas`** — altındaki grid daireye saklanır, "boşluk" hissi.
- **+ işaret 6 px** daire içinde, merkezden 5 px sağa (rotation 0). Kullanıcı "+ nerede?" ipucu alır.
- **+ işaret rengi `--v-pos`** (= `--accent` = #FFB84D) — pozitif terminal amber.
- **+ işaret stroke 1.6 px** — gövde 1.8'den hafif ince, görsel ayrım.
- **Rotation 270 kullanıldı** RC layout'unda (plan 90 önerdi): `ComponentDef.nodes[0]` pozitif terminale map olduğundan ve V1.nodes[0]='in' devrenin üst pin'i olmalıydı. Rotation 270 (= −90 CW) ile + işareti üstte kalır ve 'in' üst pin'e denk gelir.

### Toprak (3 rail)

- **20 / 14 / 6 px çizgiler** — üstten alta daralan klasik görünüm.
- **6 px rail aralığı** — yeterli hava, tanınır.
- **Dikey tel 20 px** pin'den ilk rail'e.
- **Renk `--ground`** (#6B7280, mat gri) — wire'dan ayrı, "this is ground" işareti.
- **Stroke 1.5 px** — tel ile aynı, telin devamı hissi.

### Tel (Manhattan)

- **Stroke 1.5 px**, lineCap `round`, lineJoin `round` — ince ama net, köşelerde yumuşak.
- **Via noktaları** ile 90° köşeler.

### Probe Etiketi

- **Kutu 108×40 px** — iki satır (label + değer) rahatça sığar.
- **Radius `--r-2` (4 px)** — keskin değil ama oval değil.
- **Border `--line-str` 1 px** — hafif kenar, ayrı durur.
- **Fill `--bg-1` + 0.88 alpha** — altındaki grid hafif sızar, ama metin okunur.
- **Kılçık çizgi 0.8 px, alpha 0.7** — zayıf referans, dikkat dağıtmaz.
- **Junction dot 5 px** pin konumunda, probe renginde (accent veya fg).
- **Üst satır (label):** 10 px mono, probe rengi, weight 600.
- **Alt satır (değer):** 13 px mono, `--fg`, weight 500. Tabular-nums ile hizalı.

## Layout Yerleşimi

Canvas merkezine göre relative (canvas resize'da auto-center):

```
       y = -150  │ ┌───┬───┐       ┌───┬───┐
                 │ │V_GİRİŞ│       │V_ÇIKIŞ│
                 │ │5.00 V │       │5.00 V │
                 │ └─┬─────┘       └─────┬─┘
       y =  -80  │   ●──────[R1 zigzag 80px]──────●
                 │   │          (1 kΩ)          │
       y =    0  │  (V1)                       ║C1
                 │  (+)                        ║(10 nF)
                 │   │                          │
       y =  +60  │   │                          │
                 │   ▼ ground                   ▼ ground
                 │
                 x=-150    x=-40    x=0    x=+40    x=+150
```

- V1 (voltage-source, rotation 270): (−150, 0)
- R1 (resistor, rotation 0): (0, −80)
- C1 (capacitor, rotation 90): (+150, 0)
- Grounds: (−150, +60), (+150, +60)
- Probe V_GİRİŞ pin (−40, −80) → kutu (−100, −150)
- Probe V_ÇIKIŞ pin (+40, −80) → kutu (+100, −150)

Bounding box ≈ 400×220 px. 1280×800 viewport'ta her kenarda 290+ px boşluk.

## Resize Davranışı

Canvas resize → `ResizeObserver` → `scheduleDraw` → `draw`:
1. `cssW/cssH` yeniden okunur.
2. Canvas internal resolution DPR ile yeniden ayarlanır.
3. Grid ve devre `cssW/2, cssH/2` merkezine göre yeniden çizilir.

Devre layout koordinatları "merkez relative" olduğundan, canvas büyüyünce devre canvas'ın yeni merkezine otomatik taşınır. Bileşen boyutları sabit (80px direnç, 34px daire) kalır — zoom değil, sadece origin kayması.

**Multi-viewport doğrulaması** (puppeteer prod build):
- 1440×900 @ DPR 2: canvas 1128×706, internal 2256×1412 ✓
- Console: 0 error, 0 warning, 0 failed request (prod).

## Ekran Görüntüsü

`/tmp/vxa-0.5-final.png` kaydedildi (1440×900 @ DPR 2):

- V1 sol altta — daire + turuncu amber, solda "V1" ve "5 V" etiketleri
- R1 üstte yatay — zigzag, üstünde "R1", altında "1 kΩ"
- C1 sağ altta — iki paralel plaka, sağında "C1" ve "10 nF"
- İki toprak sembolü — V1 altı ve C1 altı
- İki probe kutusu — R1 uçlarının üstünde, V_GİRİŞ (beyaz) ve V_ÇIKIŞ (amber) 5.00 V
- İki turuncu junction dot R1'in iki ucunda (probe pin'leri)
- İki ince kılçık çizgi pin'lerden kutulara
- Sağ alt debug: "canvas: 1128 × 706 · DPR: 2"
- Sol alt sprint marker: "sprint 0.5 · devre render + probe · v2" (canvas zone içinde, dashboard üstünde)

**Piksel kanıtı** (production build, canvas.getImageData):
- V1 daire merkezi içi: `rgb(5,7,9)` = `#050709` = `--canvas` ✓ (iç dolgu)
- V1 daire kenarı: `rgb(184,193,208)` = `#B8C1D0` = `--wire` ✓ (stroke)
- R1 zigzag çizgisinde: `rgb(184,193,208)` = `--wire` ✓
- Ground rail: `rgb(107,114,128)` = `#6B7280` = `--ground` ✓
- Tel üstü: `rgb(184,193,208)` = `--wire` ✓
- Probe kutusu fill: `rgb(13,15,19)` + alpha 224 = `--bg-1` × 0.88 ✓
- Canvas kenarı boş bölgesi: alpha 0 ✓ (grid nokta değil)

## Dashboard ↔ Probe Senkronu

Her ikisi de `solveCircuit(RC_LOWPASS)` Promise'inin `nodeVoltages` çıktısından. Dashboard'da:

```
design-mode.ts
  ↓ firstUpdated()
  ├─ solveCircuit(RC_LOWPASS)  → SolveResult tek çağrı
  ├─ dashboard slot'ları  ← result
  └─ <vxa-canvas .solve=${result}>
         ↓
       circuit-renderer.drawCircuit()
         ↓
       drawProbe({ value: formatVolt(nodeVoltages[pr.node]) })
```

`formatVolt` fonksiyonu `util/format.ts`'te tek kaynak — hem dashboard hem probe aynı fonksiyonu kullanıyor. `V_ÇIKIŞ = 5.00 V` iki yerde de görünür.

## Kabul Kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | Canvas'ta noktalı grid + RC devresi + 2 probe görünür | ✅ |
| 2 | Bileşenler üst üste gelmiyor, teller kesişmiyor | ✅ |
| 3 | Etiketler okunabilir (mono font, `--fs-sm/xs`) | ✅ |
| 4 | V_ÇIKIŞ amber, V_GİRİŞ beyaz | ✅ (computed color doğrulandı) |
| 5 | Probe değeri = dashboard değeri | ✅ (tek solver kaynağı) |
| 6 | Canvas resize'da devre yeni merkeze kayar | ✅ (merkez-relative layout) |
| 7 | Retina keskinlik (Sprint 0.3 DPI scaling korundu) | ✅ |
| 8 | Console temiz | ✅ (prod; willReadFrequently sadece test artifact) |
| 9 | Bundle raporda | ✅ (aşağıda) |
| 10 | `git diff src/` boş | ✅ |
| 11 | Whitelist validation runtime test | ✅ (FOO type → success:false + açıklayıcı mesaj) |
| 12 | Prod deploy `voltxampere.com/v2` devre gösterir | ⏳ push sonrası |

## Bundle Boyutu

| Dosya | Sprint 0.4 | Sprint 0.5 | Fark |
|---|---:|---:|---:|
| `index.html` | 1.69 KB | 1.69 KB | 0 |
| `index.css` | 0.89 KB | 0.89 KB | 0 |
| `index.js` | 44.42 KB | 51.44 KB | +7.02 (render katmanı) |
| **Gzip total** | ~16.1 KB | ~18.0 KB | +1.9 KB |

+7 KB raw: 7 sembol dosyası + helpers + circuit-renderer + whitelist validation. Plan tahmini 40-50 KB; fiili 51 KB (+1 KB tolerance). 256 KB chunk eşiği çok altında.

## Dosya Değişiklikleri

**Yeni (8 dosya + 1 klasör):**
- `ui-v2/src/render/helpers.ts`
- `ui-v2/src/render/circuit-renderer.ts`
- `ui-v2/src/render/symbols/wire.ts`
- `ui-v2/src/render/symbols/ground.ts`
- `ui-v2/src/render/symbols/resistor.ts`
- `ui-v2/src/render/symbols/capacitor.ts`
- `ui-v2/src/render/symbols/voltage-source.ts`
- `ui-v2/src/render/symbols/probe.ts`
- `ui-v2/src/util/format.ts`
- `SPRINT-0.5-REPORT.md`

**Güncellenen:**
- `ui-v2/src/bridge/engine.ts` — `ComponentType` genişletildi (V/I/R/C/L + D/Z/BJT/MOS/OA) + `SUPPORTED_TYPES` + `solveCircuit` whitelist kontrolü.
- `ui-v2/src/circuits/rc-lowpass.ts` — `RC_LOWPASS_LAYOUT` export.
- `ui-v2/src/canvas/canvas.ts` — 3 prop (`circuit`, `layout`, `solve`), `updated()` hook ile otomatik redraw, `drawCircuit` çağrısı.
- `ui-v2/src/modes/design-mode.ts` — canvas'a prop geçirme, `formatVolt/Amp` util import (yerel kopyalar silindi), dev-marker `bottom` dashboard üstüne taşındı.

**Dokunulmayan:**
- `ui-v2/src/design/tokens.css` — yeni token yok.
- `ui-v2/vite.config.ts`, `ui-v2/tsconfig.json`, `ui-v2/index.html`, `ui-v2/package.json`, `ui-v2/src/main.ts`, `ui-v2/src/app-root.ts`
- Root `package.json`, `vercel.json`, `.gitignore`
- v1: `src/`, `build.js`, `index.html`, `simulator.html` — sıfır dokunuş. `git diff src/` boş. v1 build 29ms, 131 modül, temiz.

## Bilinen Estetik Gözlemler (Zenco'nun kendi gözüyle)

1. **V1 "5 V" etiketi daireye biraz yakın.** Sol tarafta `V1` ve `5 V` daireye 31 px mesafede. Biraz daha ferah hissedilebilir (40 px?) ama compact tutmak için şimdilik kabul. Sprint 0.6 inspector bağlantısı gelince revize.
2. **R1 etiketi ortada, zigzag ile probe kutuları arasında baskın.** Etiket `R1` probe kutularının hemen altında — yakın ama çakışmıyor. Biraz hava olabilir ama canvas 708 px yükseklik için yeterli.
3. **Probe kutu kılçık çizgisi basit** — şu an pin'den kutunun alt-orta noktasına düz çizgi. Daha zarifi: L-şekli (dikey önce, sonra yatay). Sprint 0.6+ refactor.
4. **V1 + işareti offset (5 px sağa)** rotation 270'te sola denk gelebilir. Screenshot'ta + işareti dairenin ortasında görünüyor — rotate sonrası simetrik, görsel sorun yok.
5. **Canvas kenarlarındaki grid noktaları** bazen component etiketlerine çok yakın. Grid opacity düşük olduğu için rahatsız etmiyor ama Sprint 0.7+'da label arkasına hafif bir gradient-mask düşünülebilir.

## Karar Noktaları

1. **Rotation 270 for V1** — plan 90 öneriyordu ama `ComponentDef.nodes[0]='in'` üst pin'e map olmalıydı. `nodes` sıralaması (pozitif, negatif) sabit; rotation ile pin sırası değişiyor. 270 = 90 CCW ile + işareti üstte, 'in' üst pin ile uyumlu.
2. **Ayrı `util/format.ts`** — dashboard ve probe aynı fonksiyonu kullansın istedim (plan "iki kaynaktan aynı şey yok"). Alternatif: bridge/engine.ts'ten export etmek. Ayrı util `bridge`'in sadece solver'a odaklanmasını sağlıyor.
3. **Sembol fonksiyonları sadece şekli çiziyor, label'ler ayrı pass** — rotation uygulanan sembol ile rotation uygulanmayan metin ayrı akışta. `ctx.save/restore` + `ctx.rotate` sadece şekle, metinlere değil.
4. **`@property({ attribute: false })`** canvas'ın 3 prop'unda — Lit'e "attribute olarak deserialize etme, direkt JS referansı" diyor. CircuitDef/Layout/SolveResult karmaşık objeler, HTML attribute olamaz.
5. **Marker pozisyonu fix** — dashboard 140 px yüksek; marker `bottom: var(--sp-3)` ile dashboard içine düşüyor ve sub-text'le overlap oluyordu. `bottom: calc(var(--grid-dashboard-h) + var(--sp-3))` ile canvas zone'un sol-altına taşındı. Screenshot'ta temiz.
6. **`allowImportingTsExtensions: true`** Sprint 0.4'te eklenmişti — Sprint 0.5'te 8 yeni dosya hepsi `.ts` uzantılı import ediyor. Bir sorun çıkmadı.

## Bilinen Eksiklikler (Bilerek)

- **İnteraksiyon YOK.** Hover, click, drag, select — hiçbiri. Sprint 0.6+.
- **Bileşen kataloğu (sidebar) YOK.** Sidebar placeholder.
- **Inspector içeriği YOK.** Inspector placeholder.
- **Topbar içeriği YOK.** Topbar placeholder.
- **Zoom/pan YOK.** Devre sabit canvas merkezde.
- **Animasyon YOK.** Akım noktaları kaymıyor, nefes alma yok.
- **Diğer bileşen sembolleri YOK.** D/Z/L/BJT/MOS/OA — whitelist'te ama çizim yok. Sprint 0.6-1.x.
- **Transient/AC analiz YOK.** DC operating point sadece.
- **Probe kılçık çizgisi düz, L-şekli değil.** Sprint 0.6+'da iyileştirme düşünülebilir.

## Sonraki Adım

Sprint 0.6 — Inspector içeriği. "R1 seçili" hard-coded hal, inspector sağ panelde değer/birim/tolerans alanları gösterilir. Henüz input değişim yok, sadece canlı veri bağlantısı.
