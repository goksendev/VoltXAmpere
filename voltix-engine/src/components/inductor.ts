import type { Component, Pin, StampContext } from './component';

/**
 * Inductor — energy storage element, requires transient analysis.
 *
 * In transient analysis, the inductor is replaced each timestep by a
 * companion model. Unlike the capacitor, the inductor companion uses
 * a series resistance + voltage source approach (stamped like a voltage
 * source with extra MNA row).
 *
 * Backward Euler (BE):
 *   V = L × dI/dt ≈ L × (I(n) - I(n-1)) / dt
 *   Companion: Req = L/dt, Veq = Req × I(n-1)
 *   → stamps as: V(i) - V(j) = Req × I_branch + Veq
 *   → rearranged: V(i) - V(j) - Req × I_branch = Veq
 *
 * Trapezoidal (TRAP):
 *   Companion: Req = 2L/dt, Veq = Req × I(n-1) + V(n-1)
 *
 * For DC operating point: inductor = short circuit (Req = 0, Veq = 0) →
 * stamped as a 0V voltage source.
 *
 * The inductor always adds one extra unknown (branch current) to the MNA,
 * similar to a voltage source.
 */
export class Inductor implements Component {
  readonly type = 'vsource'; // uses voltage source stamping pattern
  readonly pins: Pin[];

  // Companion model values
  private Req: number = 0;
  private Veq: number = 0;

  // State from previous timestep
  private _iprev: number = 0;
  private _vprev: number = 0;

  // Track if in transient mode (companion active) vs DC (short circuit)
  private _transientMode: boolean = false;

  /** True if the user explicitly set an initial condition. */
  private _hasUserIC: boolean = false;

  constructor(
    public readonly name: string,
    nodePositive: string,
    nodeNegative: string,
    public readonly inductance: number,
  ) {
    if (inductance <= 0 || !isFinite(inductance)) {
      throw new Error(`${name}: inductance must be finite and > 0 (got ${inductance})`);
    }
    this.pins = [
      { name: 'positive', node: nodePositive },
      { name: 'negative', node: nodeNegative },
    ];
  }

  /** Set initial current through inductor (for .ic). */
  setInitialCurrent(i: number): void {
    this._iprev = i;
    this._hasUserIC = true;
  }

  /** Set current from DC operating point (only if no user IC). */
  setFromDCOP(current: number): void {
    if (!this._hasUserIC) {
      this._iprev = current;
    }
  }

  /** Whether user explicitly set an initial condition. */
  get hasUserIC(): boolean {
    return this._hasUserIC;
  }

  /** Get the current through the inductor from the previous timestep. */
  get prevCurrent(): number {
    return this._iprev;
  }

  /**
   * Update companion model using Backward Euler method.
   *
   * V(+) - V(-) = Req × I(n) - Req × I(n-1)
   * MNA row: V(+) - V(-) - Req × I(n) = -Req × I(n-1)
   * So Veq (RHS) = -Req × I(n-1)
   */
  updateBE(dt: number): void {
    this._transientMode = true;
    this.Req = this.inductance / dt;
    this.Veq = -this.Req * this._iprev;
  }

  /**
   * Update companion model using Trapezoidal method.
   *
   * V_L(n) = 2L/dt × (I(n) - I(n-1)) - V_L(n-1)
   * MNA row: V(+) - V(-) - Req × I(n) = -(Req × I(n-1) + V(n-1))
   */
  updateTRAP(dt: number): void {
    this._transientMode = true;
    this.Req = 2 * this.inductance / dt;
    this.Veq = -(this.Req * this._iprev + this._vprev);
  }

  /**
   * After solving a timestep, save the new current and voltage.
   */
  acceptTimestep(voltage: number, branchCurrent: number): void {
    this._vprev = voltage;
    this._iprev = branchCurrent;
  }

  /**
   * Reset to DC mode (short circuit: 0V source).
   */
  resetToDC(): void {
    this._transientMode = false;
    this.Req = 0;
    this.Veq = 0;
  }

  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node);
    const j = ctx.getNodeIndex(this.pins[1]!.node);
    const row = ctx.nodeCount + vsIndex;

    // KVL equation: V(i) - V(j) - Req × I_branch = Veq
    // This is like a voltage source V(i) - V(j) = Veq + Req × I_branch

    if (i >= 0) {
      A[i]![row]! += 1;
      A[row]![i]! += 1;
    }
    if (j >= 0) {
      A[j]![row]! -= 1;
      A[row]![j]! -= 1;
    }

    // Resistance term: -Req × I_branch on the diagonal
    if (this._transientMode) {
      A[row]![row]! -= this.Req;
    }

    b[row]! = this.Veq;
  }
}
