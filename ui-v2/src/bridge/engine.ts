// VoltXAmpere v2 — Engine köprüsü (Sprint 0.4).
//
// ─── NEDEN KÖPRÜ VAR ────────────────────────────────────────────────────────
// v1 engine (~/src/engine/) ESM değil: IIFE + global `VXA` namespace pattern'i
// ve runtime boyunca canlı `SIM`/`S` global state'lerine dayanıyor. v2'nin
// geri kalanı bu modele DOĞRUDAN bağımlı olmak zorunda değil — bu dosya tek
// erişim noktası olarak kalır, v2 tarafından `solveCircuit(...)` çağrılır.
//
// Somut strateji: `sim-worker-body.js` v1'in içinde **self-contained** bir
// Web Worker body'si (başka VXA dosyasına bağımlılığı yok, kendi stamp +
// Newton-Raphson solver'ına sahip). Bu dosyayı `?raw` ile string olarak alıp
// Blob + Worker'a paketliyoruz. Sonuç: engine worker scope'unda, global
// namespace kirliliği yok, postMessage protokolüyle konuşuluyor.
//
// İleride v1 engine'i WASM'a taşırsak veya kendi solver'ımızı yazarsak
// **yalnızca bu dosya değişir** — design-mode.ts, circuits/*.ts, vb. dokunmaz.
// v2'nin başka hiçbir yerinden `@v1-engine/...` import EDİLMEMELİ.
import workerBody from '@v1-engine/sim-worker-body.js?raw';

// ─── v2 temiz API tipleri ────────────────────────────────────────────────────
export type ComponentType = 'V' | 'R' | 'C' | 'L' | 'I';

export interface ComponentDef {
  type: ComponentType;
  id: string;
  /** İki uçlu bileşen için [pozitif düğüm adı, negatif düğüm adı]. Düğüm adları
   * keyfî string'tir; devrenin `nodes` listesinde olmalıdır. Bir düğüm adı
   * 'gnd' / 'ground' / '0' ise ground olarak işaretlenir (MNA indeks 0). */
  nodes: [string, string];
  /** SI birimi (Ω / F / H / V / A). */
  value: number;
}

export interface CircuitDef {
  components: ComponentDef[];
  /** Tüm düğüm adları, ground dahil. Sıra önemsiz — ground otomatik tespit edilir. */
  nodes: string[];
}

export interface SolveResult {
  success: boolean;
  /** Düğüm adı → voltaj (V). Ground her zaman 0. */
  nodeVoltages: Record<string, number>;
  /** Bileşen ID → akım (A), pozitif düğümden negatif düğüme doğru. */
  branchCurrents: Record<string, number>;
  errorMessage?: string;
}

// ─── Worker yaşam döngüsü ────────────────────────────────────────────────────
// Tek worker instance paylaşılır (lazy init). RC low-pass gibi tek seferlik
// solve için her çağrıda yeni worker yaratmak maliyetli — ileride invalidation
// gerekirse reset() export edilir.
let workerInstance: Worker | null = null;
let workerObjectUrl: string | null = null;

function ensureWorker(): Worker {
  if (workerInstance) return workerInstance;
  // Worker kodunu Blob'dan bootstrap et. type 'classic' çünkü sim-worker-body.js
  // IIFE, ES module değil (v1 legacy mimari).
  const blob = new Blob([workerBody], { type: 'application/javascript' });
  workerObjectUrl = URL.createObjectURL(blob);
  workerInstance = new Worker(workerObjectUrl);
  return workerInstance;
}

// ─── Devre çevirisi: v2 CircuitDef → worker payload ──────────────────────────
//
// Worker formatı (sim-worker-body.js'in beklediği):
//   { N: non-ground düğüm sayısı,
//     branchCount: V-source sayısı (MNA ekstra satır/sütun),
//     dt: simülasyon adımı (DC için büyük değer → kapasitör ≈ open),
//     comps: [ { type, n1, n2, val, [bi] } ...  ] }
//
// Düğüm indeksi: 0 = ground (implicit), 1..N = non-ground. Worker matris
// boyutu N + branchCount. `bi` yalnızca V-source için branch index (0-based).
//
// DC operating point için dt=1e6 gönderiyoruz: trapezoidal/BE companion model
// kapasitörde Geq = 2C/dt → büyük dt = küçük Geq = ideal open approximation.
// Başlangıç vPrev=0 olduğundan ieqC=0, yani "kapasitörün DC'de ideal açık
// devre" davranışı sağlanır. Transient analiz için dt parametresi Sprint 0.5+
// sunulacak.
const DC_OP_DT = 1e6;

const GROUND_NAMES = new Set(['gnd', 'ground', '0']);

interface WorkerPayload {
  N: number;
  branchCount: number;
  dt: number;
  comps: Array<{
    type: string;
    n1: number;
    n2: number;
    val: number;
    bi?: number;
  }>;
}

interface PayloadMeta {
  nodeIdx: Map<string, number>;
  branchIdxByComp: Map<string, number>;
}

function toWorkerPayload(circuit: CircuitDef): {
  payload: WorkerPayload;
  meta: PayloadMeta;
} {
  // Ground düğümünü bul — kullanıcının tercih ettiği herhangi bir takma ad.
  const nodeIdx = new Map<string, number>();
  const ground = circuit.nodes.find((n) => GROUND_NAMES.has(n));
  if (!ground) {
    throw new Error(
      `Devrede ground düğümü yok. nodes[] içinde 'gnd' / 'ground' / '0' olmalı.`,
    );
  }
  nodeIdx.set(ground, 0);
  let nextIdx = 1;
  for (const name of circuit.nodes) {
    if (name === ground) continue;
    if (nodeIdx.has(name)) continue; // duplicate isim yoksay
    nodeIdx.set(name, nextIdx++);
  }
  const N = nextIdx - 1;

  // V-source'lara branch index ata (MNA).
  const branchIdxByComp = new Map<string, number>();
  let branchCount = 0;
  for (const c of circuit.components) {
    if (c.type === 'V') branchIdxByComp.set(c.id, branchCount++);
  }

  const comps = circuit.components.map((c) => {
    const n1 = nodeIdx.get(c.nodes[0]);
    const n2 = nodeIdx.get(c.nodes[1]);
    if (n1 === undefined || n2 === undefined) {
      throw new Error(
        `Bileşen ${c.id} düğüm referansı geçersiz: [${c.nodes[0]}, ${c.nodes[1]}]. nodes[] listesinde tanımlı olmalı.`,
      );
    }
    const base = { type: c.type, n1, n2, val: c.value };
    if (c.type === 'V') {
      return { ...base, bi: branchIdxByComp.get(c.id)! };
    }
    return base;
  });

  return {
    payload: { N, branchCount, dt: DC_OP_DT, comps },
    meta: { nodeIdx, branchIdxByComp },
  };
}

// ─── Worker çıkışını v2 formatına çevir ─────────────────────────────────────
//
// Worker `nodeVoltages` ArrayBuffer'ı Float64Array view'ı alır. Boyut:
//   N + branchCount. İlk N eleman node voltajları (index 1..N için arr[0..N-1]).
//   Sonraki branchCount eleman V-source akımları (arr[N + bi]).
//
// Pasif bileşen (R / C / L) akımları worker tarafından SAĞLANMIYOR — biz
// node voltajlarından Ohm yasası ile hesaplıyoruz:
//   R: I = (V(n1) - V(n2)) / R
//   C: DC steady-state'te 0 (geleceğin transient adımında güncellenir)
//   L: DC'de ideal short; ama worker indüktörü ayrı branch olarak alıyor,
//      Sprint 0.4 kapsamı dışı — gerektiğinde genişletilecek.
function fromWorkerResult(
  nodeBuf: ArrayBuffer,
  circuit: CircuitDef,
  meta: PayloadMeta,
  N: number,
): { nodeVoltages: Record<string, number>; branchCurrents: Record<string, number> } {
  const arr = new Float64Array(nodeBuf);

  const nodeVoltages: Record<string, number> = {};
  for (const [name, idx] of meta.nodeIdx) {
    nodeVoltages[name] = idx === 0 ? 0 : arr[idx - 1] ?? 0;
  }

  const branchCurrents: Record<string, number> = {};
  for (const c of circuit.components) {
    if (c.type === 'V') {
      const bi = meta.branchIdxByComp.get(c.id);
      if (bi !== undefined) {
        branchCurrents[c.id] = arr[N + bi] ?? 0;
      }
    } else if (c.type === 'R') {
      const v1 = nodeVoltages[c.nodes[0]] ?? 0;
      const v2 = nodeVoltages[c.nodes[1]] ?? 0;
      branchCurrents[c.id] = (v1 - v2) / c.value;
    } else if (c.type === 'C') {
      // DC steady-state: kapasitör açık devre → akım 0.
      branchCurrents[c.id] = 0;
    } else if (c.type === 'I') {
      // Akım kaynağı değeri sabit.
      branchCurrents[c.id] = c.value;
    }
    // L Sprint 0.5+ — v1 indüktör branch current'i worker'a ekleyip okuyacak.
  }

  return { nodeVoltages, branchCurrents };
}

// ─── Ana public API ─────────────────────────────────────────────────────────
const SOLVE_TIMEOUT_MS = 5000;

export function solveCircuit(circuit: CircuitDef): Promise<SolveResult> {
  let worker: Worker;
  let meta: PayloadMeta;
  let payload: WorkerPayload;

  try {
    worker = ensureWorker();
    const conv = toWorkerPayload(circuit);
    payload = conv.payload;
    meta = conv.meta;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bridge] solver başarısız:', msg);
    return Promise.resolve({
      success: false,
      nodeVoltages: {},
      branchCurrents: {},
      errorMessage: msg,
    });
  }

  return new Promise<SolveResult>((resolve) => {
    let readySeen = false;
    let resolved = false;

    const finalize = (r: SolveResult) => {
      if (resolved) return;
      resolved = true;
      worker.removeEventListener('message', onMessage);
      clearTimeout(timeoutHandle);
      if (!r.success && r.errorMessage) {
        console.error('[bridge] solver başarısız:', r.errorMessage);
      }
      resolve(r);
    };

    const timeoutHandle = setTimeout(() => {
      finalize({
        success: false,
        nodeVoltages: {},
        branchCurrents: {},
        errorMessage: `Solver yanıt vermedi (${SOLVE_TIMEOUT_MS} ms zaman aşımı)`,
      });
    }, SOLVE_TIMEOUT_MS);

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg.type !== 'string') return;
      switch (msg.type) {
        case 'ready':
          if (readySeen) return;
          readySeen = true;
          worker.postMessage({ command: 'dcOP' });
          break;
        case 'dcOP':
          if (!msg.success) {
            finalize({
              success: false,
              nodeVoltages: {},
              branchCurrents: {},
              errorMessage: 'Solver DC operating point çözemedi',
            });
            return;
          }
          try {
            const parsed = fromWorkerResult(msg.nodeVoltages, circuit, meta, payload.N);
            finalize({ success: true, ...parsed });
          } catch (err) {
            finalize({
              success: false,
              nodeVoltages: {},
              branchCurrents: {},
              errorMessage: `Sonuç parse edilemedi: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
          break;
        case 'error':
          finalize({
            success: false,
            nodeVoltages: {},
            branchCurrents: {},
            errorMessage: `Worker hatası: ${msg.message || 'bilinmeyen'}`,
          });
          break;
      }
    };

    worker.addEventListener('message', onMessage);
    worker.postMessage({ command: 'init', circuit: payload });
  });
}

// ─── Opsiyonel cleanup ─────────────────────────────────────────────────────
// Test ortamları / HMR için worker sıfırlama. Production'da çağrılmaz.
export function resetBridge(): void {
  if (workerInstance) {
    try { workerInstance.terminate(); } catch { /* yoksay */ }
    workerInstance = null;
  }
  if (workerObjectUrl) {
    try { URL.revokeObjectURL(workerObjectUrl); } catch { /* yoksay */ }
    workerObjectUrl = null;
  }
}
