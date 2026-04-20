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
import workerBodyRaw from '@v1-engine/sim-worker-body.js?raw';

// ─── Worker body runtime patch'leri (Sprint 0.7) ────────────────────────────
// v1'in transient reactive-element güncelleme satırlarında 1-based vs 0-based
// index karışıklığı var:
//   uc.n1 / uc.n2 1-based (node index 1..N, 0 = ground)
//   nodeV Float64Array 0-based (M elemanlı)
//
// Worker şu an `nodeV[uc.n1]` yazıyor — aslında `nodeV[uc.n1 - 1]` olmalı
// (ground için 0). sim-legacy.js ayrı bir sim path'i kullanıyor, bu yüzden
// v1 production'da fark edilmemiş; worker RC transient'te V_ÇIKIŞ negatif
// döndürüyor.
//
// v1 dosyasına dokunmuyoruz — Blob'a yüklemeden önce string üstünde regex
// replace yapıyoruz. Fix çok dar kapsamlı: sadece C._vPrev ve L._iPrev
// güncelleme satırları. Matches tek seferlik; başarısızlık hâlinde konsolda
// uyarı — transient yine çalışır ama yanlış değerler döner (bug görünür olur).
function patchWorkerBody(src: string): string {
  // Tek satır replace yardımcısı. Match bulamazsa aynen döndürür.
  const fix = (pattern: RegExp, replacement: string, label: string): string => {
    if (!pattern.test(src)) {
      console.warn(`[bridge] worker patch '${label}' bulunamadı — v1 engine değişmiş olabilir.`);
      return src;
    }
    return src.replace(pattern, replacement);
  };

  // C: uc._vPrev = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
  src = fix(
    /uc\._vPrev\s*=\s*\(nodeV\[uc\.n1\][^;]+;/,
    'uc._vPrev = ((uc.n1 > 0 ? (nodeV[uc.n1 - 1] || 0) : 0)) - ((uc.n2 > 0 ? (nodeV[uc.n2 - 1] || 0) : 0));',
    'C vPrev 0-based index',
  );

  // L: var vL = (nodeV[uc.n1] || 0) - (nodeV[uc.n2] || 0);
  src = fix(
    /var\s+vL\s*=\s*\(nodeV\[uc\.n1\][^;]+;/,
    'var vL = ((uc.n1 > 0 ? (nodeV[uc.n1 - 1] || 0) : 0)) - ((uc.n2 > 0 ? (nodeV[uc.n2 - 1] || 0) : 0));',
    'L vL 0-based index',
  );

  return src;
}

const workerBody = patchWorkerBody(workerBodyRaw);

// ─── v2 temiz API tipleri ────────────────────────────────────────────────────
// v1 worker'ın (sim-worker-body.js stampAndSolve) tanıdığı tüm component
// tipleri. Sprint 0.4 keşfinde grep ile çıkarıldı. Buraya yazmayan bir tip
// worker'a gönderilirse SESSIZCE SKİP edilir — Sprint 0.5'ten itibaren
// validation ile önceden reddediyoruz.
export type ComponentType =
  | 'V'     // Voltage source
  | 'I'     // Current source
  | 'R'     // Resistor
  | 'C'     // Capacitor
  | 'L'     // Inductor
  | 'D'     // Diode
  | 'Z'     // Zener diode
  | 'BJT'   // Bipolar junction transistor
  | 'MOS'   // MOSFET
  | 'OA';   // Operational amplifier

// Runtime whitelist — TypeScript union ile senkron. v2 codebase'inin başka
// yerlerinde de referans olarak kullanılabilir.
export const SUPPORTED_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
  'V', 'I', 'R', 'C', 'L', 'D', 'Z', 'BJT', 'MOS', 'OA',
]);

export interface ComponentDef {
  type: ComponentType;
  id: string;
  /** İki uçlu bileşen için [pozitif düğüm adı, negatif düğüm adı]. Düğüm adları
   * keyfî string'tir; devrenin `nodes` listesinde olmalıdır. Bir düğüm adı
   * 'gnd' / 'ground' / '0' ise ground olarak işaretlenir (MNA indeks 0).
   * NOT: Çok pinli bileşenler (BJT, MOS, OA) Sprint 0.5+ nodes[]'u genişletecek. */
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

/** Sprint 2.8: Solver sonucu fiziksel olarak anlamlı sayılar mı?
 *  success=true dönse bile matris near-singular, overflow gibi durumlarda
 *  NaN/Infinity karışabilir. Dashboard ok state'ine bu sayıları yazmak
 *  yerine err state'e düşülmeli — stale değer hiç görünmesin. */
export function isValidSolverResult(
  r: SolveResult | null | undefined,
): boolean {
  if (!r || !r.success) return false;
  for (const v of Object.values(r.nodeVoltages)) {
    if (!Number.isFinite(v)) return false;
  }
  for (const i of Object.values(r.branchCurrents)) {
    if (!Number.isFinite(i)) return false;
  }
  return true;
}

/** Sprint 2.8: Transient simülasyon trace'i baştan sona finite mi?
 *  Nadir durumlarda steady-state sayılar iyi ama ara zaman noktalarından
 *  birinde overflow olur — grafik çizilirken NaN canvas hatası çıkar.
 *  Grafik güvenliği için trace'i de valide et. */
export function isValidTransientResult(
  r: TransientResult | null | undefined,
): boolean {
  if (!r || !r.success) return false;
  for (let i = 0; i < r.time.length; i++) {
    if (!Number.isFinite(r.time[i]!)) return false;
  }
  for (const series of Object.values(r.nodeVoltages)) {
    for (let i = 0; i < series.length; i++) {
      if (!Number.isFinite(series[i]!)) return false;
    }
  }
  return true;
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
  /** Transient tick'lerinde scope buffer'a yazılacak düğüm indisleri. DC
   * solve'da verilmez. */
  scopeNodes?: number[];
}

interface PayloadMeta {
  nodeIdx: Map<string, number>;
  branchIdxByComp: Map<string, number>;
}

interface PayloadOpts {
  /** DC için DC_OP_DT, transient için gerçek dt. */
  dt?: number;
  /** Transient tick'te izlenecek düğüm adları (sırası önemli). */
  scopeNodeNames?: string[];
}

function toWorkerPayload(
  circuit: CircuitDef,
  opts: PayloadOpts = {},
): {
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

  const dt = opts.dt ?? DC_OP_DT;
  const scopeNodes = opts.scopeNodeNames
    ? opts.scopeNodeNames.map((name) => {
        const idx = nodeIdx.get(name);
        if (idx === undefined || idx === 0) {
          throw new Error(
            `scope düğümü '${name}' tanımsız veya ground — non-ground bir düğüm adı olmalı.`,
          );
        }
        return idx;
      })
    : undefined;

  return {
    payload: {
      N,
      branchCount,
      dt,
      comps,
      ...(scopeNodes ? { scopeNodes } : {}),
    },
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
  // ─── Whitelist validation (Sprint 0.5 — Sprint 0.4 silent-skip fix) ────
  // v1 worker match'siz tipi sessizce skip eder; o bileşen devreden kaybolur
  // ve solver başkalarıyla çalışır. Bu sessiz veri kaybını önlemek için
  // desteklenmeyen tipler için açık hata dönüyoruz. Plan: bileşen kataloğu
  // (Sprint 0.5+) bu set'ten okunmalı, UI yalnızca desteklenen tipleri sunmalı.
  const unsupported = circuit.components.filter(
    (c) => !SUPPORTED_TYPES.has(c.type as ComponentType),
  );
  if (unsupported.length > 0) {
    const list = unsupported.map((c) => `${c.id}(${c.type})`).join(', ');
    const msg = `Desteklenmeyen bileşen tipleri: ${list}. Worker yalnızca ${Array.from(SUPPORTED_TYPES).join('/')} tanıyor.`;
    console.error('[bridge] solver başarısız:', msg);
    return Promise.resolve({
      success: false,
      nodeVoltages: {},
      branchCurrents: {},
      errorMessage: msg,
    });
  }

  let worker: Worker;
  let meta: PayloadMeta;
  let payload: WorkerPayload;

  try {
    worker = ensureWorker();
    // DC operating point — dt varsayılan (DC_OP_DT), scope yok.
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

// ────────────────────────────────────────────────────────────────────────────
// ─── Transient analiz (Sprint 0.7) ──────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
//
// Worker protokolü: init → start + speed. Worker her `stepsPerTick × speed`
// adımda bir `tick` mesajı gönderir; mesaj içinde `scopeBuffer` ArrayBuffer'ı
// (steps × channels × Float64). Bridge istenen örnek sayısına ulaşınca stop
// edip Promise'i resolve eder.
//
// Tek shot analiz — transient bittikten sonra worker terminate edilir. Ayrı
// worker instance kullanıyoruz ki solveCircuit'in paylaşılan worker'ıyla
// state çakışmasın.

export interface TransientRequest {
  circuit: CircuitDef;
  /** Zaman adımı (saniye). RC low-pass için 1e-7 (100 ns) iyi bir başlangıç. */
  dt: number;
  /** Toplam süre (saniye). 5·τ kural-ı-kaba. */
  duration: number;
  /** Takip edilecek düğüm adları (ground olamaz, `nodes` listesinde tanımlı). */
  probeNodes: string[];
}

export interface TransientResult {
  success: boolean;
  errorMessage?: string;
  /** N-uzunluk zaman serisi (saniye). */
  time: Float64Array;
  /** probeNodes her biri için N-uzunluk voltaj serisi. */
  nodeVoltages: Record<string, Float64Array>;
}

// Üst örnek sınırı — tarayıcı kilitlenmesini önlemek için.
// 10000 × dt=100ns → 1 ms; 10000 × dt=1µs → 10 ms. RC için çok yeterli.
const MAX_SAMPLES = 10_000;

// Transient tamamlanana kadar beklenecek en fazla süre (ms). Tek worker iyi
// speed ile 500 örneği 50 ms'de bitirir; 5 saniye fazlasıyla güvenli.
const TRANSIENT_TIMEOUT_MS = 5_000;

// Speed çarpanı. Worker her tick'te `stepsPerTick × speed` adım simule eder.
// Default stepsPerTick = 10; speed 50 ile tick başı 500 adım → 500 örnek
// yaklaşık 1 tick (16 ms) sürer. Loading latency'sini minimize ediyor.
const TRANSIENT_SPEED = 50;

function createTransientWorker(): Worker {
  const blob = new Blob([workerBody], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);
  // URL'i worker kapandığında temizle (Chrome otomatik revoke etmez).
  w.addEventListener('error', () => URL.revokeObjectURL(url));
  // Terminate sonrası URL'i serbest bırakmak için closure'da tutuyoruz ama
  // onu çağıran taraf terminate sonrası revoke eder (aşağıda finalize).
  (w as Worker & { _objectUrl?: string })._objectUrl = url;
  return w;
}

function terminateTransientWorker(w: Worker): void {
  try { w.terminate(); } catch { /* yoksay */ }
  const url = (w as Worker & { _objectUrl?: string })._objectUrl;
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* yoksay */ }
  }
}

export function solveTransient(req: TransientRequest): Promise<TransientResult> {
  const emptyResult = (msg: string): TransientResult => ({
    success: false,
    errorMessage: msg,
    time: new Float64Array(0),
    nodeVoltages: {},
  });

  // ─── Validation ──────────────────────────────────────────────────────────
  const unsupported = req.circuit.components.filter(
    (c) => !SUPPORTED_TYPES.has(c.type as ComponentType),
  );
  if (unsupported.length > 0) {
    const list = unsupported.map((c) => `${c.id}(${c.type})`).join(', ');
    const msg = `Desteklenmeyen bileşen tipleri: ${list}. Worker yalnızca ${Array.from(SUPPORTED_TYPES).join('/')} tanıyor.`;
    console.error('[bridge] transient başarısız:', msg);
    return Promise.resolve(emptyResult(msg));
  }

  if (req.dt <= 0 || req.duration <= 0) {
    return Promise.resolve(emptyResult(`dt ve duration pozitif olmalı (dt=${req.dt}, duration=${req.duration}).`));
  }

  const totalSamples = Math.ceil(req.duration / req.dt);
  if (totalSamples > MAX_SAMPLES) {
    const msg = `Çok fazla örnek: ${totalSamples}. Max ${MAX_SAMPLES}. dt veya duration azalt.`;
    console.error('[bridge] transient başarısız:', msg);
    return Promise.resolve(emptyResult(msg));
  }

  if (req.probeNodes.length === 0) {
    return Promise.resolve(emptyResult('En az bir probeNode belirt.'));
  }

  // ─── Payload ─────────────────────────────────────────────────────────────
  let worker: Worker;
  let payload: WorkerPayload;
  try {
    const conv = toWorkerPayload(req.circuit, {
      dt: req.dt,
      scopeNodeNames: req.probeNodes,
    });
    payload = conv.payload;
    worker = createTransientWorker();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[bridge] transient başarısız:', msg);
    return Promise.resolve(emptyResult(msg));
  }

  // ─── Tick toplayıcı ──────────────────────────────────────────────────────
  return new Promise<TransientResult>((resolve) => {
    let resolved = false;
    // Düğüm başına biriken değerler (push-based, final'da Float64Array'e çevrilir).
    const perNode: number[][] = req.probeNodes.map(() => []);
    let sampleCount = 0;

    const finalize = (r: TransientResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutHandle);
      worker.removeEventListener('message', onMessage);
      try { worker.postMessage({ command: 'stop' }); } catch { /* yoksay */ }
      terminateTransientWorker(worker);
      if (!r.success && r.errorMessage) {
        console.error('[bridge] transient başarısız:', r.errorMessage);
      }
      resolve(r);
    };

    const timeoutHandle = setTimeout(() => {
      finalize(emptyResult(`Transient yanıt vermedi (${TRANSIENT_TIMEOUT_MS} ms zaman aşımı, ${sampleCount}/${totalSamples} örnek alındı)`));
    }, TRANSIENT_TIMEOUT_MS);

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'ready':
          try {
            worker.postMessage({ command: 'start', speed: TRANSIENT_SPEED });
          } catch (err) {
            finalize(emptyResult(`Worker start komutu başarısız: ${err}`));
          }
          break;

        case 'tick': {
          if (!msg.scopeBuffer) break;
          const buf = new Float64Array(msg.scopeBuffer as ArrayBuffer);
          const channels = (msg.scopeChannels as number) || req.probeNodes.length;
          const steps = Math.floor(buf.length / channels);
          for (let s = 0; s < steps; s++) {
            if (sampleCount >= totalSamples) break;
            for (let c = 0; c < channels; c++) {
              perNode[c]!.push(buf[s * channels + c]!);
            }
            sampleCount++;
          }
          if (sampleCount >= totalSamples) {
            // Hedef sayıya ulaştık — serileştir ve bitir.
            const time = new Float64Array(totalSamples);
            for (let i = 0; i < totalSamples; i++) time[i] = i * req.dt;
            const nodeVoltages: Record<string, Float64Array> = {};
            for (let c = 0; c < req.probeNodes.length; c++) {
              const name = req.probeNodes[c]!;
              nodeVoltages[name] = new Float64Array(perNode[c]!.slice(0, totalSamples));
            }
            finalize({ success: true, time, nodeVoltages });
          }
          break;
        }

        case 'error':
          finalize(emptyResult(`Worker hatası: ${msg.message || 'bilinmeyen'}`));
          break;
      }
    };

    worker.addEventListener('message', onMessage);
    try {
      worker.postMessage({ command: 'init', circuit: payload });
    } catch (err) {
      finalize(emptyResult(`Worker init komutu başarısız: ${err}`));
    }
  });
}
