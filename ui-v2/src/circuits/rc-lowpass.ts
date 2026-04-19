// VoltXAmpere v2 — sabit RC low-pass devresi (Sprint 0.4 + 0.5 test zemini).
//
// Topoloji:
//
//         ┌── R1 (1 kΩ) ──┐
//         │               │
//    V1 (●)               ├── V_ÇIKIŞ (probe)
//    5V   │               │
//         │              C1 (10 nF)
//         │               │
//        GND             GND
//
// DC steady-state beklentisi (Sprint 0.4 solver sonucu, doğrulandı):
//   V(in)   = 5 V     (kaynak doğrudan bağlı)
//   V(out)  ≈ 5 V     (kapasitör dolmuş, akım yok)
//   I(R1)   ≈ 0       (steady-state)
//
// Kesim frekansı: fc = 1 / (2π·R·C) ≈ 15.9 kHz. (AC analizi Sprint 0.7+.)
import type { CircuitDef } from '../bridge/engine.ts';
import type { CircuitLayout } from '../render/circuit-renderer.ts';

const V_SOURCE = 5;
const R1_OHM = 1_000;
const C1_FARAD = 10e-9;

export const RC_LOWPASS: CircuitDef = {
  components: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: V_SOURCE },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: R1_OHM },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C1_FARAD },
  ],
  nodes: ['in', 'out', 'gnd'],
};

// ─── Görsel yerleşim (Sprint 0.5) ───────────────────────────────────────────
// Koordinatlar canvas merkezine göre relative. Canvas resize olunca devre
// yeniden merkeze kayar. Layout ~500×320 CSS piksel bounding box'a sığar,
// 1280×800 ekranda her kenarda 380+ piksel boşluk kalır.
//
// Pin hesabı (sembol dosyalarından):
//   V1 (voltage-source): local pin'ler (-35, 0), (+35, 0). Rotation 90 CW:
//       (-35, 0) → (0, -35) ve (+35, 0) → (0, +35) — wait canvas rotation CW
//       convention: cos(90)=0, sin(90)=1 yani (x, y) → (x·0 - y·1, x·1 + y·0) =
//       (-y, x). (-35, 0) → (0, -35), (+35, 0) → (0, +35). V1 merkez (-150, 0)
//       → üst pin (-150, -35), alt pin (-150, +35).
//       Pozitif terminal rotation 0'da sağda (pin2) — rotation 90'da altta
//       olur. Ancak V_SOURCE 5V ve V(in)=5V olduğundan, "in" node + terminale
//       bağlı. Plan'ın topolojisi "üst uç in" — pin mapping sırasını manuel
//       ayarlayamıyoruz, ComponentDef.nodes[0]=+, nodes[1]=-. V1.nodes =
//       ['in','gnd'] → '+' = in, '-' = gnd. rotation 90'da + altta, - üstte.
//       Biz in'i üste istediğimizden rotation 270 (veya -90) kullanmalıyız.
//       Pratik: rotation 270 ile pin1 (sol = -, gnd) üste, pin2 (sağ = +, in)
//       olur mu? (-35, 0) rotation 270: (x', y') = (-y, x) için 90 CCW =
//       (y, -x) → (0, 35). Hmm...
//
//   Kısa kesim: voltage source asymmetric + işaret dairenin sağında (rotation 0).
//   Rotation 90 CW'de + işareti altta olur. Rotation 270 (= -90 CW = 90 CCW)
//   kullanırsak + işareti üstte olur ve V1.nodes[0]='in' üst pin'e düşer.
//   **Kullandık: rotation 270.**
//
//   R1 (resistor): local pin'ler (-40, 0), (+40, 0). Rotation 0 — merkez
//       (0, -80) → sol pin (-40, -80), sağ pin (+40, -80). nodes[0]='in' sol,
//       nodes[1]='out' sağ. Topoloji doğru.
//
//   C1 (capacitor): local pin'ler (-24, 0), (+24, 0). Rotation 90 CW:
//       (-24, 0) → (0, -24), (+24, 0) → (0, +24). Merkez (+150, 0) → üst
//       pin (+150, -24), alt pin (+150, +24). nodes[0]='out' sol (rotation
//       sonrası üstte) → "out" üste; nodes[1]='gnd' altta. Doğru.
export const RC_LOWPASS_LAYOUT: CircuitLayout = {
  components: [
    // Kaynak solda, + işareti üstte (rotation 270). Kullanıcı topolojisi:
    // üst pin 'in' node'a bağlı (R1'e giden tel).
    { id: 'V1', x: -150, y: 0, rotation: 270, displayValue: '5 V' },
    // R1 üstte yatay, sol 'in', sağ 'out'.
    { id: 'R1', x: 0, y: -80, rotation: 0, displayValue: '1 kΩ' },
    // C1 sağda dikey. Üst pin 'out'.
    { id: 'C1', x: 150, y: 0, rotation: 90, displayValue: '10 nF' },
  ],

  // Teller (Manhattan) — canvas merkez relative.
  wires: [
    // V1 üst (in) → R1 sol (in). (-150, -35) → (-150, -80) → (-40, -80)
    { from: { x: -150, y: -35 }, to: { x: -40, y: -80 }, via: [{ x: -150, y: -80 }] },
    // R1 sağ (out) → C1 üst (out). (+40, -80) → (+150, -80) → (+150, -24)
    { from: { x: 40, y: -80 }, to: { x: 150, y: -24 }, via: [{ x: 150, y: -80 }] },
    // V1 alt (gnd) → toprak üstü. (-150, +35) → (-150, +60)
    { from: { x: -150, y: 35 }, to: { x: -150, y: 60 } },
    // C1 alt (gnd) → toprak üstü. (+150, +24) → (+150, +60)
    { from: { x: 150, y: 24 }, to: { x: 150, y: 60 } },
  ],

  // İki toprak sembolü — V1 altında ve C1 altında.
  grounds: [
    { x: -150, y: 60 },
    { x: 150, y: 60 },
  ],

  // Probe etiketleri — R1'in iki ucu.
  probes: [
    {
      node: 'in',
      pin: { x: -40, y: -80 },
      box: { x: -100, y: -150 },
      label: 'V_GİRİŞ',
      tone: 'fg',
    },
    {
      node: 'out',
      pin: { x: 40, y: -80 },
      box: { x: 100, y: -150 },
      label: 'V_ÇIKIŞ',
      tone: 'accent',
    },
  ],
};
