import type { Component, Pin, StampContext } from './component';

/**
 * Capacitor — energy storage element, requires transient analysis.
 *
 * In transient analysis, the capacitor is replaced each timestep by a
 * companion model: a parallel conductance Geq and current source Ieq.
 *
 * Backward Euler (BE):
 *   I = C × dV/dt ≈ C × (V(n) - V(n-1)) / dt
 *   Companion: Geq = C/dt, Ieq = Geq × V(n-1)
 *
 * Trapezoidal (TRAP):
 *   I = C × dV/dt ≈ 2C/dt × (V(n) - V(n-1)) - I(n-1)
 *   Companion: Geq = 2C/dt, Ieq = Geq × V(n-1) + I(n-1)
 *
 * For DC operating point: capacitor = open circuit (Geq = 0, Ieq = 0).
 */
export class Capacitor implements Component {
  readonly type = 'capacitor';
  readonly pins: Pin[];

  // Companion model values
  private Geq: number = 0;
  private Ieq: number = 0;

  // State from previous timestep
  private _vprev: number = 0;
  private _iprev: number = 0;

  /** True if the user explicitly set an initial condition. */
  private _hasUserIC: boolean = false;

  constructor(
    public readonly name: string,
    nodePositive: string,
    nodeNegative: string,
    public readonly capacitance: number,
  ) {
    if (capacitance <= 0 || !isFinite(capacitance)) {
      throw new Error(`${name}: capacitance must be finite and > 0 (got ${capacitance})`);
    }
    this.pins = [
      { name: 'positive', node: nodePositive },
      { name: 'negative', node: nodeNegative },
    ];
  }

  /** Set initial voltage across capacitor (for .ic or preset charge). */
  setInitialVoltage(v: number): void {
    this._vprev = v;
    this._hasUserIC = true;
  }

  /** Set voltage from DC operating point (only if no user IC). */
  setFromDCOP(v: number): void {
    if (!this._hasUserIC) {
      this._vprev = v;
    }
  }

  /** Whether user explicitly set an initial condition. */
  get hasUserIC(): boolean {
    return this._hasUserIC;
  }

  /** Get the voltage across the capacitor from the previous timestep. */
  get prevVoltage(): number {
    return this._vprev;
  }

  /**
   * Update companion model using Backward Euler method.
   * Call this BEFORE stamping at each transient timestep.
   */
  updateBE(dt: number): void {
    this.Geq = this.capacitance / dt;
    this.Ieq = this.Geq * this._vprev;
  }

  /**
   * Update companion model using Trapezoidal method.
   * Call this BEFORE stamping at each transient timestep.
   */
  updateTRAP(dt: number): void {
    this.Geq = 2 * this.capacitance / dt;
    this.Ieq = this.Geq * this._vprev + this._iprev;
  }

  /**
   * After solving a timestep, save the new voltage and current
   * as the "previous" state for the next timestep.
   */
  acceptTimestep(voltage: number): void {
    const current = this.Geq * voltage - this.Ieq;
    this._iprev = current;
    this._vprev = voltage;
  }

  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, _vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node);
    const j = ctx.getNodeIndex(this.pins[1]!.node);

    // Conductance stamp (same pattern as resistor)
    if (i >= 0) A[i]![i]! += this.Geq;
    if (j >= 0) A[j]![j]! += this.Geq;
    if (i >= 0 && j >= 0) {
      A[i]![j]! -= this.Geq;
      A[j]![i]! -= this.Geq;
    }

    // Current source stamp (Ieq injected into positive node)
    if (i >= 0) b[i]! += this.Ieq;
    if (j >= 0) b[j]! -= this.Ieq;
  }
}
