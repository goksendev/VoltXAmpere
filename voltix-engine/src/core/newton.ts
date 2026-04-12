/**
 * Newton-Raphson nonlinear DC solver.
 *
 * For circuits with nonlinear elements (diodes, transistors), the MNA
 * system becomes nonlinear. We solve it iteratively:
 *
 *   1. Start with an initial guess (all nodes 0V)
 *   2. Linearize nonlinear elements at the current operating point
 *   3. Build and solve the linearized MNA system
 *   4. Apply voltage limiting to the new solution
 *   5. Check convergence of both node voltages AND device operating points
 *   6. If not converged, update and repeat from step 2
 *
 * Convergence aids:
 *   - Voltage limiting on diodes (prevents exponential overshoot)
 *   - GMIN injection (minimum conductance for numerical stability)
 *   - Device operating point convergence tracking
 */

import type { Component, StampContext } from '../components/component';
import { Diode } from '../components/diode';
import { solveLU } from './solver';
import { VTOL, RELTOL } from '../utils/constants';

export interface NROptions {
  /** Maximum Newton-Raphson iterations. Default: 50 */
  maxIterations: number;
  /** Absolute voltage tolerance (V). Default: 1e-6 */
  vTol: number;
  /** Relative tolerance. Default: 1e-3 */
  relTol: number;
}

const DEFAULT_NR_OPTIONS: NROptions = {
  maxIterations: 50,
  vTol: VTOL,
  relTol: RELTOL,
};

export interface DCResult {
  /** Whether the solver converged within tolerance */
  converged: boolean;
  /** Number of N-R iterations used */
  iterations: number;
  /** Node name → voltage */
  nodeVoltages: Map<string, number>;
  /** Voltage source name → branch current */
  branchCurrents: Map<string, number>;
}

/**
 * Solve the DC operating point of a circuit that may contain nonlinear elements.
 *
 * For purely linear circuits (no diodes), returns the direct solution in 1 call.
 * For nonlinear circuits, iterates with Newton-Raphson until convergence.
 *
 * @param components - All circuit components
 * @param options - Solver options
 */
export function solveDCOperatingPoint(
  components: readonly Component[],
  options?: Partial<NROptions>,
): DCResult {
  const opts = { ...DEFAULT_NR_OPTIONS, ...options };

  // Separate diodes from other components for special handling
  const diodes: Diode[] = [];
  const allComponents: Component[] = [];
  let vsourceCount = 0;

  for (const comp of components) {
    allComponents.push(comp);
    if (comp instanceof Diode) {
      diodes.push(comp);
    }
    if (comp.type === 'vsource') {
      vsourceCount++;
    }
  }

  // Build node map — scan all component pins
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

  // Register all nodes
  for (const comp of allComponents) {
    for (const pin of comp.pins) {
      getNodeIndex(pin.node);
    }
  }

  const nodeCount = nextNodeIndex;
  const matrixSize = nodeCount + vsourceCount;

  if (matrixSize === 0) {
    return {
      converged: true,
      iterations: 0,
      nodeVoltages: new Map([['0', 0]]),
      branchCurrents: new Map(),
    };
  }

  const ctx: StampContext = { getNodeIndex, nodeCount };

  // ── Linear shortcut: no nonlinear elements → solve once ──
  if (diodes.length === 0) {
    // Initialize all diodes (none) and stamp once
    const { A, b } = buildMatrix(matrixSize, allComponents, ctx);
    const x = solveLU(A, b);
    return { ...buildResult(x, nodeMap, allComponents, nodeCount), converged: true, iterations: 1 };
  }

  // ── Nonlinear iteration (Newton-Raphson) ──

  // Diode operating point voltages — start at 0V
  const diodeVd = new Float64Array(diodes.length);

  // Initial guess: use a forward-bias estimate to help convergence.
  // Set each diode's initial operating point to 0V (cold start).
  for (let d = 0; d < diodes.length; d++) {
    diodes[d]!.updateCompanionModel(0);
    diodeVd[d] = 0;
  }

  let prevSolution = new Float64Array(matrixSize);

  for (let iter = 0; iter < opts.maxIterations; iter++) {
    // 1. Build and solve linearized MNA
    const { A, b } = buildMatrix(matrixSize, allComponents, ctx);
    const x = solveLU(A, b);

    // 2. Extract new diode voltages from the solution and apply limiting
    const newDiodeVd = new Float64Array(diodes.length);
    let devicesConverged = true;

    for (let d = 0; d < diodes.length; d++) {
      const diode = diodes[d]!;
      const ai = getNodeIndex(diode.pins[0]!.node);
      const ci = getNodeIndex(diode.pins[1]!.node);
      const Va = ai >= 0 ? x[ai]! : 0;
      const Vc = ci >= 0 ? x[ci]! : 0;
      const VdRaw = Va - Vc;

      // Apply voltage limiting to prevent divergence
      const VdLimited = diode.limitVoltage(VdRaw, diodeVd[d]!);
      newDiodeVd[d] = VdLimited;

      // Check device operating point convergence
      const vdDiff = Math.abs(VdLimited - diodeVd[d]!);
      if (vdDiff > opts.vTol + opts.relTol * Math.abs(VdLimited)) {
        devicesConverged = false;
      }
    }

    // 3. Check node voltage convergence
    let nodesConverged = true;
    if (iter > 0) {
      for (let i = 0; i < matrixSize; i++) {
        const diff = Math.abs(x[i]! - prevSolution[i]!);
        const threshold = opts.vTol + opts.relTol * Math.abs(x[i]!);
        if (diff > threshold) {
          nodesConverged = false;
          break;
        }
      }
    } else {
      nodesConverged = false; // First iteration — always continue
    }

    prevSolution = x;

    // 4. Converged only when BOTH nodes AND devices are stable
    if (nodesConverged && devicesConverged && iter > 0) {
      return {
        ...buildResult(x, nodeMap, allComponents, nodeCount),
        converged: true,
        iterations: iter + 1,
      };
    }

    // 5. Update diode companion models at the limited operating points
    for (let d = 0; d < diodes.length; d++) {
      diodes[d]!.updateCompanionModel(newDiodeVd[d]!);
      diodeVd[d] = newDiodeVd[d]!;
    }
  }

  // Did not converge — return best effort
  return {
    ...buildResult(prevSolution, nodeMap, allComponents, nodeCount),
    converged: false,
    iterations: opts.maxIterations,
  };
}

/**
 * Allocate and stamp the MNA matrix from all components.
 */
function buildMatrix(
  size: number,
  components: readonly Component[],
  ctx: StampContext,
): { A: Float64Array[]; b: Float64Array } {
  const A: Float64Array[] = new Array(size);
  for (let i = 0; i < size; i++) {
    A[i] = new Float64Array(size);
  }
  const b = new Float64Array(size);

  let vsIdx = 0;
  for (const comp of components) {
    comp.stamp(A, b, ctx, vsIdx);
    if (comp.type === 'vsource') vsIdx++;
  }

  return { A, b };
}

/**
 * Build the result object from a solution vector.
 */
function buildResult(
  x: Float64Array,
  nodeMap: Map<string, number>,
  components: readonly Component[],
  nodeCount: number,
): DCResult {
  const nodeVoltages = new Map<string, number>();
  nodeVoltages.set('0', 0);
  for (const [name, idx] of nodeMap) {
    nodeVoltages.set(name, x[idx]!);
  }

  const branchCurrents = new Map<string, number>();
  let vsIdx = 0;
  for (const comp of components) {
    if (comp.type === 'vsource') {
      branchCurrents.set(comp.name, x[nodeCount + vsIdx]!);
      vsIdx++;
    }
  }

  return {
    converged: true,
    iterations: 1,
    nodeVoltages,
    branchCurrents,
  };
}
