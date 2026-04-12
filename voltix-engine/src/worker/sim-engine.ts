/**
 * Simulation engine — the actual work function used by the worker.
 *
 * This module is intentionally separated from the Worker global scope
 * so it can be tested directly without a real Web Worker environment.
 */

import { deserializeCircuit } from '../netlist/builder';
import { solveDCOperatingPoint } from '../core/newton';
import { runTransient } from '../analysis/transient';
import { runAC } from '../analysis/ac';
import type { CircuitDefinition } from '../netlist/builder';
import type { TransientOptions, TransientResult } from '../analysis/transient';
import type { ACOptions, ACResult, ACSource } from '../analysis/ac';
import type { DCResult } from '../core/newton';

/** Abort controller for cancelling running simulations. */
export class AbortFlag {
  private _aborted = false;

  abort(): void {
    this._aborted = true;
  }

  get aborted(): boolean {
    return this._aborted;
  }

  reset(): void {
    this._aborted = false;
  }
}

/**
 * Run DC operating point analysis.
 */
export function engineRunDC(circuit: CircuitDefinition): DCResult {
  const components = deserializeCircuit(circuit);
  return solveDCOperatingPoint(components);
}

/**
 * Run transient analysis with progress and abort support.
 */
export function engineRunTransient(
  circuit: CircuitDefinition,
  options: TransientOptions,
  onProgress?: (pct: number) => void,
  abortFlag?: AbortFlag,
): TransientResult {
  const components = deserializeCircuit(circuit);
  return runTransient(components, options, {
    onProgress,
    shouldAbort: () => abortFlag?.aborted ?? false,
  });
}

/**
 * Run AC frequency analysis.
 */
export function engineRunAC(
  circuit: CircuitDefinition,
  acSource: ACSource,
  options: ACOptions,
): ACResult {
  const components = deserializeCircuit(circuit);
  return runAC(components, acSource, options);
}
