/**
 * Modified Nodal Analysis (MNA) — circuit matrix builder and solver.
 *
 * The MNA system Ax = b is structured as:
 *
 *   | G  B | | v |   | i |
 *   | C  D | | j | = | e |
 *
 * Where:
 *   G = conductance matrix (passive elements)
 *   B, C = voltage source connection matrices
 *   D = dependent source terms
 *   v = node voltages (unknowns)
 *   j = voltage source branch currents (unknowns)
 *   i = current source excitations (known)
 *   e = voltage source values (known)
 *
 * Node "0" / "gnd" is the reference (ground) and is excluded from the matrix.
 */

import type { Component, StampContext } from '../components/component';
import { solveLU } from './solver';

export interface MNAResult {
  /** Node name → voltage (includes "0" = 0V) */
  nodeVoltages: Map<string, number>;
  /** Voltage source name → branch current */
  branchCurrents: Map<string, number>;
  /** Matrix size (nodes + voltage sources) */
  matrixSize: number;
  /** Number of non-ground nodes */
  nodeCount: number;
}

/**
 * Check if a node name represents ground.
 */
function isGround(nodeName: string): boolean {
  const n = nodeName.toLowerCase().trim();
  return n === '0' || n === 'gnd' || n === 'ground';
}

export class MNASystem {
  private nodeMap = new Map<string, number>();
  private nextNodeIndex = 0;
  private components: Component[] = [];
  private vsourceCount = 0;

  /**
   * Get or assign a matrix index for a node name.
   * Ground returns -1 (excluded from matrix).
   */
  getNodeIndex(nodeName: string): number {
    if (isGround(nodeName)) return -1;

    const key = nodeName.toLowerCase().trim();
    let idx = this.nodeMap.get(key);
    if (idx === undefined) {
      idx = this.nextNodeIndex++;
      this.nodeMap.set(key, idx);
    }
    return idx;
  }

  /** Number of non-ground nodes. */
  get nodeCount(): number {
    return this.nextNodeIndex;
  }

  /** Total number of voltage sources. */
  get voltageSourceCount(): number {
    return this.vsourceCount;
  }

  /** Total matrix dimension: nodes + voltage sources. */
  get matrixSize(): number {
    return this.nextNodeIndex + this.vsourceCount;
  }

  /**
   * Add a component to the circuit.
   * Registers its nodes and tracks voltage source count.
   */
  addComponent(component: Component): void {
    // Register all nodes
    for (const pin of component.pins) {
      this.getNodeIndex(pin.node);
    }
    if (component.type === 'vsource') {
      this.vsourceCount++;
    }
    this.components.push(component);
  }

  /**
   * Build the MNA matrix, solve it, and return results.
   */
  solve(): MNAResult {
    const size = this.matrixSize;
    if (size === 0) {
      return {
        nodeVoltages: new Map([['0', 0]]),
        branchCurrents: new Map(),
        matrixSize: 0,
        nodeCount: 0,
      };
    }

    // Allocate matrix A and vector b as Float64Arrays
    const A: Float64Array[] = new Array(size);
    for (let i = 0; i < size; i++) {
      A[i] = new Float64Array(size);
    }
    const b = new Float64Array(size);

    // Stamp context for components
    const ctx: StampContext = {
      getNodeIndex: (name: string) => this.getNodeIndex(name),
      nodeCount: this.nextNodeIndex,
    };

    // Stamp each component
    let vsIdx = 0;
    for (const comp of this.components) {
      comp.stamp(A, b, ctx, vsIdx);
      if (comp.type === 'vsource') vsIdx++;
    }

    // Solve the linear system
    const x = solveLU(A, b);

    // Extract node voltages
    const nodeVoltages = new Map<string, number>();
    nodeVoltages.set('0', 0);
    for (const [name, idx] of this.nodeMap) {
      nodeVoltages.set(name, x[idx]!);
    }

    // Extract voltage source branch currents
    const branchCurrents = new Map<string, number>();
    let vsIdx2 = 0;
    for (const comp of this.components) {
      if (comp.type === 'vsource') {
        branchCurrents.set(comp.name, x[this.nextNodeIndex + vsIdx2]!);
        vsIdx2++;
      }
    }

    return {
      nodeVoltages,
      branchCurrents,
      matrixSize: size,
      nodeCount: this.nextNodeIndex,
    };
  }

  /**
   * Return all registered node names (including ground).
   */
  getNodeNames(): string[] {
    return ['0', ...this.nodeMap.keys()];
  }

  /**
   * Return all components in the circuit.
   */
  getComponents(): readonly Component[] {
    return this.components;
  }
}
