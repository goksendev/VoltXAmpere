import type { Component, Pin, StampContext } from './component';

/**
 * Independent Current Source — stamps only into the RHS vector.
 *
 * Convention: current flows from node- to node+ through the source
 * (i.e., out of node+ into the external circuit).
 *
 * MNA stamp:
 *   b[i] -= Is   (current leaves node+)
 *   b[j] += Is   (current enters node-)
 */
export class CurrentSource implements Component {
  readonly type = 'isource';
  readonly pins: Pin[];

  public current: number;

  constructor(
    public readonly name: string,
    nodePositive: string,
    nodeNegative: string,
    current: number,
  ) {
    this.current = current;
    this.pins = [
      { name: 'positive', node: nodePositive },
      { name: 'negative', node: nodeNegative },
    ];
  }

  stamp(_A: Float64Array[], b: Float64Array, ctx: StampContext, _vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node);
    const j = ctx.getNodeIndex(this.pins[1]!.node);

    // Current Is flows from node- to node+ internally,
    // so it injects Is into node+ and extracts Is from node-.
    if (i >= 0) b[i]! += this.current;
    if (j >= 0) b[j]! -= this.current;
  }
}
