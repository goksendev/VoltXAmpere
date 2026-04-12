import type { Pin, StampContext } from './component';
import { VoltageSource } from './vsource';
import { sineValue, pulseValue, pwlValue } from '../models/source-functions';
import type { SineParams, PulseParams, PWLParams } from '../models/source-functions';

/**
 * Time-varying voltage source — wraps VoltageSource with a time function.
 * During transient analysis, call updateTime(t) before each timestep.
 * For DC operating point, the source uses its DC offset value.
 */

export type SourceFunction =
  | { type: 'dc'; value: number }
  | { type: 'sin'; params: SineParams }
  | { type: 'pulse'; params: PulseParams }
  | { type: 'pwl'; params: PWLParams };

export class ACVoltageSource extends VoltageSource {
  readonly func: SourceFunction;

  constructor(
    name: string,
    nodePositive: string,
    nodeNegative: string,
    func: SourceFunction,
  ) {
    // Initial voltage = DC offset
    const dcValue = getInitialValue(func);
    super(name, nodePositive, nodeNegative, dcValue);
    this.func = func;
  }

  /**
   * Update voltage for the given time point.
   * Call this before stamping at each transient timestep.
   */
  updateTime(t: number): void {
    this.voltage = evaluateSource(this.func, t);
  }

  /**
   * Reset to DC value (for DC operating point).
   */
  resetToDC(): void {
    this.voltage = getInitialValue(this.func);
  }
}

function getInitialValue(func: SourceFunction): number {
  switch (func.type) {
    case 'dc': return func.value;
    case 'sin': return func.params.vo;
    case 'pulse': return func.params.v1;
    case 'pwl': return func.params.points[0]?.[1] ?? 0;
  }
}

function evaluateSource(func: SourceFunction, t: number): number {
  switch (func.type) {
    case 'dc': return func.value;
    case 'sin': return sineValue(func.params, t);
    case 'pulse': return pulseValue(func.params, t);
    case 'pwl': return pwlValue(func.params, t);
  }
}
