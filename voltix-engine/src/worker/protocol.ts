/**
 * Worker ↔ Controller message protocol.
 *
 * All messages are structured as { type, payload } for type safety.
 */

import type { CircuitDefinition } from '../netlist/builder';
import type { TransientOptions, TransientResult } from '../analysis/transient';
import type { ACOptions, ACResult, ACSource } from '../analysis/ac';
import type { DCResult } from '../core/newton';

// ── Messages: Controller → Worker ──

export type WorkerCommand =
  | { type: 'RUN_DC'; payload: { circuit: CircuitDefinition } }
  | { type: 'RUN_TRANSIENT'; payload: { circuit: CircuitDefinition; options: TransientOptions } }
  | { type: 'RUN_AC'; payload: { circuit: CircuitDefinition; acSource: ACSource; options: ACOptions } }
  | { type: 'ABORT' };

// ── Messages: Worker → Controller ──

export type WorkerResponse =
  | { type: 'DC_RESULT'; payload: DCResult }
  | { type: 'TRANSIENT_RESULT'; payload: SerializedTransientResult }
  | { type: 'AC_RESULT'; payload: SerializedACResult }
  | { type: 'PROGRESS'; payload: number }
  | { type: 'ERROR'; payload: string };

/**
 * TransientResult with Float64Arrays converted for structured clone.
 * Float64Array transfers fine via postMessage, but Map doesn't —
 * so we convert Map to an array of [key, Float64Array] entries.
 */
export interface SerializedTransientResult {
  time: Float64Array;
  signals: [string, Float64Array][];
  steps: number;
  allConverged: boolean;
}

export interface SerializedACResult {
  frequencies: Float64Array;
  magnitude: [string, Float64Array][];
  phase: [string, Float64Array][];
  numPoints: number;
}

export function serializeTransientResult(r: TransientResult): SerializedTransientResult {
  return {
    time: r.time,
    signals: [...r.signals.entries()],
    steps: r.steps,
    allConverged: r.allConverged,
  };
}

export function deserializeTransientResult(r: SerializedTransientResult): TransientResult {
  return {
    time: r.time,
    signals: new Map(r.signals),
    steps: r.steps,
    allConverged: r.allConverged,
  };
}

export function serializeACResult(r: ACResult): SerializedACResult {
  return {
    frequencies: r.frequencies,
    magnitude: [...r.magnitude.entries()],
    phase: [...r.phase.entries()],
    numPoints: r.numPoints,
  };
}

export function deserializeACResult(r: SerializedACResult): ACResult {
  return {
    frequencies: r.frequencies,
    magnitude: new Map(r.magnitude),
    phase: new Map(r.phase),
    numPoints: r.numPoints,
  };
}
