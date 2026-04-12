import type { Component, Pin, StampContext } from './component';

/**
 * Resistor — linear two-terminal component.
 *
 * MNA stamp: conductance G = 1/R added to the G-matrix.
 *
 *   A[i][i] += G    A[i][j] -= G
 *   A[j][i] -= G    A[j][j] += G
 *
 * where i = node+, j = node-, skipping ground rows/cols.
 */
export class Resistor implements Component {
  readonly type = 'resistor';
  readonly pins: Pin[];

  constructor(
    public readonly name: string,
    nodePositive: string,
    nodeNegative: string,
    public readonly resistance: number,
  ) {
    if (resistance <= 0 || !isFinite(resistance)) {
      throw new Error(`${name}: resistance must be finite and > 0 (got ${resistance})`);
    }
    this.pins = [
      { name: 'positive', node: nodePositive },
      { name: 'negative', node: nodeNegative },
    ];
  }

  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, _vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node);
    const j = ctx.getNodeIndex(this.pins[1]!.node);
    const G = 1 / this.resistance;

    if (i >= 0) A[i]![i]! += G;
    if (j >= 0) A[j]![j]! += G;
    if (i >= 0 && j >= 0) {
      A[i]![j]! -= G;
      A[j]![i]! -= G;
    }
  }
}
