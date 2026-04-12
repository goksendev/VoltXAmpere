/**
 * Transient Analysis — time-domain simulation.
 *
 * Workflow:
 *   1. Find DC operating point (t=0 initial conditions)
 *   2. For each timestep:
 *      a. Update time-varying sources to current time
 *      b. Update capacitor/inductor companion models
 *      c. Solve the (possibly nonlinear) MNA system via Newton-Raphson
 *      d. Accept timestep — save capacitor/inductor state
 *      e. Record results
 *
 * Integration methods:
 *   - BE (Backward Euler): 1st order, unconditionally stable
 *   - TRAP (Trapezoidal): 2nd order, higher accuracy, slight ringing risk
 */

import type { Component, StampContext } from '../components/component';
import { Capacitor } from '../components/capacitor';
import { Inductor } from '../components/inductor';
import { Diode } from '../components/diode';
import { ACVoltageSource } from '../components/acsource';
import { solveLU } from '../core/solver';
import { VTOL, RELTOL, GMIN } from '../utils/constants';

export type IntegrationMethod = 'BE' | 'TRAP';

export interface TransientOptions {
  /** Timestep size (seconds) */
  tStep: number;
  /** Total simulation time (seconds) */
  tStop: number;
  /** Start recording time (seconds). Default: 0 */
  tStart?: number;
  /** Integration method. Default: 'BE' */
  method?: IntegrationMethod;
  /** Max Newton-Raphson iterations per timestep. Default: 50 */
  maxNRIter?: number;
}

export interface TransientResult {
  /** Time points array */
  time: Float64Array;
  /** Signal name → data array. Names: "V(node)", "I(source)" */
  signals: Map<string, Float64Array>;
  /** Number of timesteps computed */
  steps: number;
  /** True if all timesteps converged */
  allConverged: boolean;
}

/**
 * Callbacks for progress reporting and abort control.
 */
export interface TransientCallbacks {
  /** Called with progress percentage (0-100). */
  onProgress?: (percent: number) => void;
  /** Return true to abort the simulation. Checked each timestep. */
  shouldAbort?: () => boolean;
}

export function runTransient(
  components: readonly Component[],
  options: TransientOptions,
  callbacks?: TransientCallbacks,
): TransientResult {
  const {
    tStep,
    tStop,
    tStart = 0,
    method = 'BE',
    maxNRIter = 50,
  } = options;

  const totalSteps = Math.ceil(tStop / tStep) + 1;

  // ── Categorize components ──
  const capacitors: Capacitor[] = [];
  const inductors: Inductor[] = [];
  const diodes: Diode[] = [];
  const acSources: ACVoltageSource[] = [];
  const allComponents: Component[] = [...components];
  let vsourceCount = 0;

  for (const comp of components) {
    if (comp instanceof Capacitor) capacitors.push(comp);
    if (comp instanceof Inductor) inductors.push(comp);
    if (comp instanceof Diode) diodes.push(comp);
    if (comp instanceof ACVoltageSource) acSources.push(comp);
    if (comp.type === 'vsource') vsourceCount++;
  }

  // ── Build node map ──
  const nodeMap = new Map<string, number>();
  let nextNodeIndex = 0;

  function getNodeIndex(nodeName: string): number {
    const key = nodeName.toLowerCase().trim();
    if (key === '0' || key === 'gnd' || key === 'ground') return -1;
    let idx = nodeMap.get(key);
    if (idx === undefined) {
      idx = nextNodeIndex++;
      nodeMap.set(key, idx);
    }
    return idx;
  }

  for (const comp of allComponents) {
    for (const pin of comp.pins) getNodeIndex(pin.node);
  }

  const nodeCount = nextNodeIndex;
  const matrixSize = nodeCount + vsourceCount;
  const ctx: StampContext = { getNodeIndex, nodeCount };

  // ── Prepare result arrays ──
  const timeArray = new Float64Array(totalSteps);
  const signals = new Map<string, Float64Array>();

  // Pre-allocate signal arrays for all nodes
  for (const [name] of nodeMap) {
    signals.set(`V(${name})`, new Float64Array(totalSteps));
  }
  // Branch currents for voltage sources and inductors
  let vsIdx = 0;
  for (const comp of allComponents) {
    if (comp.type === 'vsource') {
      signals.set(`I(${comp.name})`, new Float64Array(totalSteps));
      vsIdx++;
    }
  }

  // ── Step 1: DC Operating Point (t=0) ──
  // Reset AC sources to DC offset, inductors to short circuit
  for (const src of acSources) src.resetToDC();
  for (const ind of inductors) ind.resetToDC();
  // Capacitors at DC: Geq=0, Ieq=0 (open circuit) — default state

  const dcSolution = solveDCWithNR(allComponents, diodes, ctx, matrixSize, nodeCount, maxNRIter);

  // Initialize capacitor and inductor states from DC solution.
  // Only overwrite if user hasn't explicitly set an IC.
  for (const cap of capacitors) {
    const pi = getNodeIndex(cap.pins[0]!.node);
    const ni = getNodeIndex(cap.pins[1]!.node);
    const vp = pi >= 0 ? dcSolution[pi]! : 0;
    const vn = ni >= 0 ? dcSolution[ni]! : 0;
    cap.setFromDCOP(vp - vn);
  }

  let vsIdx2 = 0;
  for (const comp of allComponents) {
    if (comp instanceof Inductor) {
      comp.setFromDCOP(dcSolution[nodeCount + vsIdx2]!);
    }
    if (comp.type === 'vsource') vsIdx2++;
  }

  // Record DC operating point as step 0
  recordStep(0, 0, dcSolution, nodeMap, allComponents, nodeCount, timeArray, signals);

  // ── Step 2: Time-stepping loop ──
  let allConverged = true;
  let prevSolution = dcSolution;
  let lastReportedPct = -1;

  for (let step = 1; step < totalSteps; step++) {
    // Abort check
    if (callbacks?.shouldAbort?.()) {
      return { time: timeArray, signals, steps: step, allConverged };
    }

    // Progress reporting (every 1%)
    const pct = Math.floor((step / (totalSteps - 1)) * 100);
    if (pct > lastReportedPct) {
      callbacks?.onProgress?.(pct);
      lastReportedPct = pct;
    }

    const t = step * tStep;

    // (a) Update time-varying sources
    for (const src of acSources) src.updateTime(t);

    // (b) Update companion models
    for (const cap of capacitors) {
      if (method === 'TRAP') cap.updateTRAP(tStep);
      else cap.updateBE(tStep);
    }
    for (const ind of inductors) {
      if (method === 'TRAP') ind.updateTRAP(tStep);
      else ind.updateBE(tStep);
    }

    // (c) Solve via Newton-Raphson
    const x = solveDCWithNR(allComponents, diodes, ctx, matrixSize, nodeCount, maxNRIter, prevSolution);

    if (x === null) {
      allConverged = false;
      // Use previous solution as fallback
      recordStep(step, t, prevSolution, nodeMap, allComponents, nodeCount, timeArray, signals);
      continue;
    }

    // (d) Accept timestep — update capacitor/inductor state
    for (const cap of capacitors) {
      const pi = getNodeIndex(cap.pins[0]!.node);
      const ni = getNodeIndex(cap.pins[1]!.node);
      const vp = pi >= 0 ? x[pi]! : 0;
      const vn = ni >= 0 ? x[ni]! : 0;
      cap.acceptTimestep(vp - vn);
    }

    let vsIdx3 = 0;
    for (const comp of allComponents) {
      if (comp instanceof Inductor) {
        const pi = getNodeIndex(comp.pins[0]!.node);
        const ni = getNodeIndex(comp.pins[1]!.node);
        const vp = pi >= 0 ? x[pi]! : 0;
        const vn = ni >= 0 ? x[ni]! : 0;
        comp.acceptTimestep(vp - vn, x[nodeCount + vsIdx3]!);
      }
      if (comp.type === 'vsource') vsIdx3++;
    }

    // (e) Record results
    recordStep(step, t, x, nodeMap, allComponents, nodeCount, timeArray, signals);
    prevSolution = x;
  }

  return {
    time: timeArray,
    signals,
    steps: totalSteps,
    allConverged,
  };
}

/**
 * Solve one timestep using Newton-Raphson (handles nonlinear elements).
 * For linear circuits, converges in 1 iteration.
 * Returns solution vector or null if failed to converge.
 */
function solveDCWithNR(
  components: readonly Component[],
  diodes: Diode[],
  ctx: StampContext,
  matrixSize: number,
  nodeCount: number,
  maxIter: number,
  initialGuess?: Float64Array,
): Float64Array {
  if (diodes.length === 0) {
    // Pure linear — solve directly
    const { A, b } = buildMatrix(matrixSize, components, ctx);
    return solveLU(A, b);
  }

  // Nonlinear — Newton-Raphson
  const diodeVd = new Float64Array(diodes.length);
  let prevSolution = initialGuess ?? new Float64Array(matrixSize);

  // Initialize diode operating points from initial guess
  for (let d = 0; d < diodes.length; d++) {
    const diode = diodes[d]!;
    const ai = ctx.getNodeIndex(diode.pins[0]!.node);
    const ci = ctx.getNodeIndex(diode.pins[1]!.node);
    const Va = ai >= 0 ? prevSolution[ai]! : 0;
    const Vc = ci >= 0 ? prevSolution[ci]! : 0;
    diodeVd[d] = Va - Vc;
    diode.updateCompanionModel(diodeVd[d]!);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const { A, b } = buildMatrix(matrixSize, components, ctx);
    const x = solveLU(A, b);

    // Update diode operating points with limiting
    const newDiodeVd = new Float64Array(diodes.length);
    let devicesConverged = true;

    for (let d = 0; d < diodes.length; d++) {
      const diode = diodes[d]!;
      const ai = ctx.getNodeIndex(diode.pins[0]!.node);
      const ci = ctx.getNodeIndex(diode.pins[1]!.node);
      const Va = ai >= 0 ? x[ai]! : 0;
      const Vc = ci >= 0 ? x[ci]! : 0;
      const VdRaw = Va - Vc;
      const VdLimited = diode.limitVoltage(VdRaw, diodeVd[d]!);
      newDiodeVd[d] = VdLimited;

      if (Math.abs(VdLimited - diodeVd[d]!) > VTOL + RELTOL * Math.abs(VdLimited)) {
        devicesConverged = false;
      }
    }

    let nodesConverged = true;
    if (iter > 0) {
      for (let i = 0; i < matrixSize; i++) {
        if (Math.abs(x[i]! - prevSolution[i]!) > VTOL + RELTOL * Math.abs(x[i]!)) {
          nodesConverged = false;
          break;
        }
      }
    } else {
      nodesConverged = false;
    }

    prevSolution = x;

    if (nodesConverged && devicesConverged && iter > 0) {
      return x;
    }

    for (let d = 0; d < diodes.length; d++) {
      diodes[d]!.updateCompanionModel(newDiodeVd[d]!);
      diodeVd[d] = newDiodeVd[d]!;
    }
  }

  return prevSolution; // best effort
}

function buildMatrix(
  size: number,
  components: readonly Component[],
  ctx: StampContext,
): { A: Float64Array[]; b: Float64Array } {
  const A: Float64Array[] = new Array(size);
  for (let i = 0; i < size; i++) A[i] = new Float64Array(size);
  const b = new Float64Array(size);

  let vsIdx = 0;
  for (const comp of components) {
    comp.stamp(A, b, ctx, vsIdx);
    if (comp.type === 'vsource') vsIdx++;
  }
  return { A, b };
}

function recordStep(
  step: number,
  t: number,
  x: Float64Array,
  nodeMap: Map<string, number>,
  components: readonly Component[],
  nodeCount: number,
  timeArray: Float64Array,
  signals: Map<string, Float64Array>,
): void {
  timeArray[step] = t;

  for (const [name, idx] of nodeMap) {
    const arr = signals.get(`V(${name})`);
    if (arr) arr[step] = x[idx]!;
  }

  let vsIdx = 0;
  for (const comp of components) {
    if (comp.type === 'vsource') {
      const arr = signals.get(`I(${comp.name})`);
      if (arr) arr[step] = x[nodeCount + vsIdx]!;
      vsIdx++;
    }
  }
}
