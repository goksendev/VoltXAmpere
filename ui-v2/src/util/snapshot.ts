// VoltXAmpere v2 — transient → SolveResult snapshot çıkarıcı (Sprint 0.7).
//
// Transient sonuç belli bir zaman indisindeki (default: son örnek) voltajları
// alıp, bileşen akımlarını Ohm yasasıyla türetip SolveResult yapısında döner.
// Böylece inspector ve dashboard tek "snapshot" formatını tüketiyor — DC
// solver'a gerek kalmıyor, transient steady-state = DC operating point.
import type {
  CircuitDef,
  SolveResult,
  TransientResult,
} from '../bridge/engine.ts';

/** Transient'in `sampleIndex`'inci örneğinden SolveResult üret.
 * Negatif index array sonundan sayılır (JS Array.at semantiği). */
export function snapshotFromTransient(
  transient: TransientResult,
  circuit: CircuitDef,
  sampleIndex = -1,
): SolveResult {
  if (!transient.success || transient.time.length === 0) {
    return {
      success: false,
      nodeVoltages: {},
      branchCurrents: {},
      errorMessage: transient.errorMessage ?? 'Transient başarısız',
    };
  }

  const N = transient.time.length;
  const idx = sampleIndex < 0 ? N + sampleIndex : sampleIndex;
  if (idx < 0 || idx >= N) {
    return {
      success: false,
      nodeVoltages: {},
      branchCurrents: {},
      errorMessage: `sampleIndex ${sampleIndex} geçersiz (N=${N})`,
    };
  }

  // Düğüm voltajları
  const nodeVoltages: Record<string, number> = {};
  for (const [name, series] of Object.entries(transient.nodeVoltages)) {
    nodeVoltages[name] = series[idx] ?? 0;
  }
  // Ground her zaman 0 (transient'e dahil edilmez ama bileşen hesapları için lazım).
  for (const name of circuit.nodes) {
    if (!(name in nodeVoltages)) {
      nodeVoltages[name] = 0; // default (yalnızca ground)
    }
  }

  // Bileşen akımları (bridge'deki fromWorkerResult ile aynı formül)
  const branchCurrents: Record<string, number> = {};
  for (const c of circuit.components) {
    if (c.type === 'R') {
      const v1 = nodeVoltages[c.nodes[0]] ?? 0;
      const v2 = nodeVoltages[c.nodes[1]] ?? 0;
      branchCurrents[c.id] = (v1 - v2) / c.value;
    } else if (c.type === 'C') {
      // Steady-state'te C akımı 0. Ara adımlarda C = I = C · dV/dt; ileride
      // türev serisi eklenirse doğru hesaplanır. Şimdilik 0.
      branchCurrents[c.id] = 0;
    } else if (c.type === 'V') {
      // V-source steady-state akımı: devre akımıyla uyumlu (RC'de 0 when kapasitör dolmuş).
      // Worker bu akımı transient scope'a yazmıyor; Kirchhoff'tan türetmek
      // topolojiye bağlı. Sprint 0.7'de 0 kabul — RC gerçeği bu.
      branchCurrents[c.id] = 0;
    } else if (c.type === 'I') {
      branchCurrents[c.id] = c.value;
    }
  }

  return { success: true, nodeVoltages, branchCurrents };
}
