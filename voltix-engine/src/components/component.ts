/**
 * Base interface for all circuit components.
 *
 * Every component must implement `stamp()` which writes its contribution
 * to the MNA conductance matrix (A) and right-hand-side vector (b).
 */

export interface Pin {
  /** Pin label: "positive", "negative", "anode", "cathode", "gate", etc. */
  name: string;
  /** Node name this pin connects to: "1", "out", "vcc", "0" (ground) */
  node: string;
}

export interface StampContext {
  /** Get the matrix index for a node name. Returns -1 for ground. */
  getNodeIndex(nodeName: string): number;
  /** Total number of non-ground nodes (offset for voltage source rows). */
  nodeCount: number;
}

export interface Component {
  /** Instance name: "R1", "V1", "D1" */
  name: string;
  /** Component type identifier */
  type: string;
  /** Pin connections */
  pins: Pin[];

  /**
   * Write this component's contribution to the MNA system.
   *
   * @param A - Conductance/coefficient matrix (mutated in place)
   * @param b - Right-hand-side vector (mutated in place)
   * @param ctx - Stamp context with node index lookup and node count
   * @param vsIndex - This voltage source's sequential index (only used by vsource type)
   */
  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, vsIndex: number): void;
}
