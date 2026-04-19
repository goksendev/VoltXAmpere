// VoltXAmpere v2 — sabit RC low-pass devresi (Sprint 0.4 + 0.5 test zemini).
//
// Topoloji:
//   V1 (5V DC) → R1 (1 kΩ) → out düğümü
//                                    │
//                                   C1 (10 nF)
//                                    │
//                                   gnd
//
// DC steady-state beklentisi:
//   V(in)   = 5 V     (kaynak doğrudan bağlı)
//   V(out)  ≈ 5 V     (kapasitör tam dolmuş, hiç akım akmıyor)
//   I(R1)   ≈ 0 A     (steady-state, kapasitör open)
//   I(V1)   ≈ 0 A     (toplam devre akımı sıfır)
//   I(C1)   = 0 A     (DC'de kapasitör ideal open circuit)
//
// Kesim frekansı (referans — Sprint 0.5+ AC analiz için):
//   fc = 1 / (2π · R · C) = 1 / (2π · 1000 · 10e-9) ≈ 15.9 kHz
import type { CircuitDef } from '../bridge/engine.ts';

const V_SOURCE = 5;        // Volt
const R1_OHM = 1_000;      // 1 kΩ
const C1_FARAD = 10e-9;    // 10 nF

export const RC_LOWPASS: CircuitDef = {
  components: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: V_SOURCE },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: R1_OHM },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C1_FARAD },
  ],
  nodes: ['in', 'out', 'gnd'],
};
