import type { Component, Pin, StampContext } from './component';
import { BOLTZMANN, CHARGE, T_NOMINAL, GMIN } from '../utils/constants';

/**
 * SPICE-compatible diode model parameters.
 */
export interface DiodeModelParams {
  /** Saturation current (A). Default: 1e-14 */
  IS: number;
  /** Emission coefficient. Default: 1.0 */
  N: number;
}

const DEFAULT_DIODE_MODEL: DiodeModelParams = {
  IS: 1e-14,
  N: 1.0,
};

/**
 * Diode — nonlinear two-terminal component using the Shockley model.
 *
 * I(V) = IS × (e^(V / (N × Vt)) - 1)
 *
 * During Newton-Raphson iteration, the diode is replaced by a companion
 * model: a parallel conductance Geq and current source Ieq.
 *
 *   Geq = dI/dV evaluated at the current operating point
 *   Ieq = I(V0) - Geq × V0
 *
 * This linearized model is re-stamped into the MNA matrix each iteration.
 */
export class Diode implements Component {
  readonly type = 'diode';
  readonly pins: Pin[];
  readonly model: DiodeModelParams;

  /** Thermal voltage kT/q at nominal temperature */
  private readonly Vt: number;
  /** N × Vt for convenience */
  private readonly nVt: number;
  /** Critical voltage for voltage limiting */
  private readonly Vcrit: number;

  // Companion model values — updated each N-R iteration
  private Geq: number = GMIN;
  private Ieq: number = 0;

  constructor(
    public readonly name: string,
    nodeAnode: string,
    nodeCathode: string,
    model?: Partial<DiodeModelParams>,
  ) {
    this.model = { ...DEFAULT_DIODE_MODEL, ...model };
    this.pins = [
      { name: 'anode', node: nodeAnode },
      { name: 'cathode', node: nodeCathode },
    ];

    this.Vt = (BOLTZMANN * T_NOMINAL) / CHARGE;
    this.nVt = this.model.N * this.Vt;

    // Critical voltage: Vcrit = nVt × ln(nVt / (√2 × IS))
    this.Vcrit = this.nVt * Math.log(this.nVt / (Math.SQRT2 * this.model.IS));
  }

  /**
   * Diode current at a given voltage across the junction.
   * Includes overflow protection for large forward bias.
   */
  current(Vd: number): number {
    const { IS } = this.model;
    const x = Vd / this.nVt;

    // Overflow protection: linear extrapolation beyond exp(40)
    if (x > 40) {
      const I40 = IS * (Math.exp(40) - 1);
      const G40 = IS / this.nVt * Math.exp(40);
      return I40 + G40 * (Vd - 40 * this.nVt);
    }

    // Deep reverse bias: current ≈ -IS
    if (x < -40) {
      return -IS;
    }

    return IS * (Math.exp(x) - 1);
  }

  /**
   * Diode small-signal conductance dI/dV at a given voltage.
   */
  conductance(Vd: number): number {
    const { IS } = this.model;
    const x = Vd / this.nVt;

    if (x > 40) {
      return IS / this.nVt * Math.exp(40);
    }

    // Even in deep reverse, maintain a tiny conductance for convergence
    if (x < -40) {
      return IS / this.nVt;
    }

    return IS / this.nVt * Math.exp(x);
  }

  /**
   * Voltage limiting — prevents Newton-Raphson from taking
   * excessively large voltage steps that cause divergence.
   *
   * This is critical for diode convergence. Without it, the
   * exponential model causes N-R to overshoot wildly.
   */
  limitVoltage(Vnew: number, Vold: number): number {
    if (Vnew > this.Vcrit && Math.abs(Vnew - Vold) > 2 * this.nVt) {
      if (Vold > 0) {
        const arg = (Vnew - Vold) / this.nVt;
        if (arg > 0) {
          return Vold + this.nVt * (2 + Math.log(arg - 2));
        }
        return this.Vcrit;
      }
      return this.nVt * Math.log(Vnew / this.nVt);
    }
    return Vnew;
  }

  /**
   * Update the companion model (Geq, Ieq) for the current operating point.
   * Called once per Newton-Raphson iteration.
   *
   * @param Vd - Diode voltage (anode - cathode) at current iteration
   */
  updateCompanionModel(Vd: number): void {
    this.Geq = this.conductance(Vd) + GMIN;
    this.Ieq = this.current(Vd) - this.Geq * Vd;
  }

  /**
   * Stamp the linearized companion model into the MNA matrix.
   * The diode appears as a conductance Geq in parallel with a current source Ieq.
   */
  stamp(A: Float64Array[], b: Float64Array, ctx: StampContext, _vsIndex: number): void {
    const i = ctx.getNodeIndex(this.pins[0]!.node); // anode
    const j = ctx.getNodeIndex(this.pins[1]!.node); // cathode

    // Conductance stamp (same as resistor)
    if (i >= 0) A[i]![i]! += this.Geq;
    if (j >= 0) A[j]![j]! += this.Geq;
    if (i >= 0 && j >= 0) {
      A[i]![j]! -= this.Geq;
      A[j]![i]! -= this.Geq;
    }

    // Current source stamp (Ieq)
    if (i >= 0) b[i]! -= this.Ieq;
    if (j >= 0) b[j]! += this.Ieq;
  }
}
