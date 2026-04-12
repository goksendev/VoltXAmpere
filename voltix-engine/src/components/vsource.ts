import type { Component, Pin, StampContext } from './component';

/**
 * Independent Voltage Source — stamps into the MNA extended rows.
 *
 * Adds one extra unknown (branch current) to the system.
 *
 * MNA stamp (node+ = i, node- = j, voltage = Vs, extra row = n+k):
 *
 *   A[i][n+k] += 1    A[n+k][i] += 1
 *   A[j][n+k] -= 1    A[n+k][j] -= 1
 *   b[n+k]     = Vs
 *
 * The extra equation enforces V(i) - V(j) = Vs.
 * The solution x[n+k] gives the branch current through this source.
 */
export class VoltageSource implements Component {
  readonly type = 'vsource';
  readonly pins: Pin[];

  /** Current voltage value (may change during transient/AC analysis). */
  public voltage: number;

  constructor(
    public readonly name: string,
    nodePositive: string,
    nodeNegative: string,
    voltage: number,
  ) {
    this.voltage = voltage;
    this.pins = [
      { name: 'positive', node: nodePositive },
      { name: 'negative', node: nodeNegative },
    ];
  }

  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node);
    const j = ctx.getNodeIndex(this.pins[1]!.node);
    const row = ctx.nodeCount + vsIndex;

    if (i >= 0) {
      A[i]![row]! += 1;
      A[row]![i]! += 1;
    }
    if (j >= 0) {
      A[j]![row]! -= 1;
      A[row]![j]! -= 1;
    }

    b[row]! = this.voltage;
  }
}
